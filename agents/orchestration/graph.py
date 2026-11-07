"""
LangGraph Node Sequencing and Workflow Graph (GH-10, v4.0 §5.2, §23).
Constructs the full multi-agent pipeline with conditional validation/repair branching
and boundary cancellation enforcement.
"""

import logging
from typing import Any, Callable, Literal, Optional
from langgraph.graph import StateGraph, END

from agents.analysis import AnalysisAgent, AnalysisInput
from agents.contradiction import ContradictionAgent, ContradictionInput
from agents.discovery import SourceDiscoveryAgent, SourceDiscoveryInput
from agents.evidence import EvidenceAgent, EvidenceInput
from agents.orchestration.lifecycle import ResearchRunLifecycle, RunState
from agents.orchestration.state import ResearchState, sanitize_state_dict, utc_now_iso
from agents.planner import ResearchPlannerAgent, PlannerInput
from agents.report import ReportAgent, ReportInput
from agents.retrieval import RetrievalAgent, RetrievalInput
from agents.schemas import (
    AnalysisObject,
    CandidateSource,
    Claim,
    ContradictionItem,
    EvidenceItem,
    PlanTask,
    ReportDraft,
    ResearchPlan,
    RetrievalItem,
    ValidationResult,
)
from agents.validation import ValidationAgent, ValidationInput

logger = logging.getLogger("m1.graph")

MAX_REPAIR_ATTEMPTS = 3
MAX_VALIDATION_TIME_SECONDS = 180


class ResearchGraphBuilder:
    """
    Builds the compiled LangGraph workflow enforcing §5.2 sequencing:
    Planning -> Source Discovery -> Retrieval -> Evidence ->
    Contradiction -> Analysis -> Report -> Validation -> [Pass/Repair loop]
    """

    def __init__(
        self,
        planner_agent: Optional[ResearchPlannerAgent] = None,
        discovery_agent: Optional[SourceDiscoveryAgent] = None,
        retrieval_agent: Optional[RetrievalAgent] = None,
        evidence_agent: Optional[EvidenceAgent] = None,
        contradiction_agent: Optional[ContradictionAgent] = None,
        analysis_agent: Optional[AnalysisAgent] = None,
        report_agent: Optional[ReportAgent] = None,
        validation_agent: Optional[ValidationAgent] = None,
        redis_client: Optional[Any] = None,
        cancellation_checker: Optional[Callable[[str], bool]] = None,
    ):
        self.planner = planner_agent or ResearchPlannerAgent()
        self.discovery = discovery_agent or SourceDiscoveryAgent()
        self.retrieval = retrieval_agent or RetrievalAgent()
        self.evidence = evidence_agent or EvidenceAgent()
        self.contradiction = contradiction_agent or ContradictionAgent()
        self.analysis = analysis_agent or AnalysisAgent()
        self.report = report_agent or ReportAgent()
        self.validation = validation_agent or ValidationAgent()
        self.redis_client = redis_client
        self.cancellation_checker = cancellation_checker

    def _is_cancelled(self, state: ResearchState) -> bool:
        """Check for cancellation acknowledgment at node boundary (§7.2)."""
        run_id = state.get("run_id", "")
        if self.cancellation_checker and self.cancellation_checker(run_id):
            return True
        if self.redis_client:
            try:
                flag = self.redis_client.get(f"cancel_run:{run_id}")
                if flag and (flag == b"1" or flag == "1"):
                    return True
            except Exception:
                pass
        return state.get("run_status") == RunState.CANCEL_REQUESTED.value

    # -------------------------------------------------------------
    # GRAPH NODES
    # -------------------------------------------------------------

    def node_planning(self, state: ResearchState) -> dict[str, Any]:
        if self._is_cancelled(state):
            return {"run_status": RunState.CANCELLED.value, "current_stage": RunState.CANCELLED.value}

        logger.info("Executing node: PLANNING", extra={"run_id": state["run_id"]})
        out = self.planner.execute(
            PlannerInput(
                research_question=state["research_question"],
                project_context=state.get("project_context", {}),
            )
        )
        plan_dict = out.research_plan.model_dump()
        return {
            "research_plan": plan_dict,
            "current_stage": RunState.PLANNING.value,
            "run_status": RunState.RUNNING.value,
            "timestamps": {**state.get("timestamps", {}), "planning_completed_at": utc_now_iso()},
        }

    def node_source_discovery(self, state: ResearchState) -> dict[str, Any]:
        if self._is_cancelled(state):
            return {"run_status": RunState.CANCELLED.value, "current_stage": RunState.CANCELLED.value}

        logger.info("Executing node: SOURCE_DISCOVERY", extra={"run_id": state["run_id"]})
        plan_data = state.get("research_plan") or {}
        tasks = [PlanTask(**t) for t in plan_data.get("tasks", [])]
        task0 = tasks[0] if tasks else PlanTask(description=state["research_question"], evidence_category="general")

        out = self.discovery.execute(
            SourceDiscoveryInput(
                task=task0,
                query=state["research_question"],
                project_context=state.get("project_context", {}),
            )
        )
        sources_data = [s.model_dump() for s in out.candidate_sources]
        return {
            "candidate_sources": sources_data,
            "current_stage": RunState.SOURCE_DISCOVERY.value,
            "timestamps": {**state.get("timestamps", {}), "source_discovery_completed_at": utc_now_iso()},
        }

    def node_retrieval(self, state: ResearchState) -> dict[str, Any]:
        if self._is_cancelled(state):
            return {"run_status": RunState.CANCELLED.value, "current_stage": RunState.CANCELLED.value}

        logger.info("Executing node: RETRIEVAL", extra={"run_id": state["run_id"]})
        out = self.retrieval.execute(
            RetrievalInput(
                query=state["research_question"],
                project_id=state["project_id"],
                top_k=10,
            )
        )
        retrieval_data = [r.model_dump() for r in out.retrieval_results]
        return {
            "retrieval_results": retrieval_data,
            "current_stage": RunState.RETRIEVAL.value,
            "timestamps": {**state.get("timestamps", {}), "retrieval_completed_at": utc_now_iso()},
        }

    def node_evidence(self, state: ResearchState) -> dict[str, Any]:
        if self._is_cancelled(state):
            return {"run_status": RunState.CANCELLED.value, "current_stage": RunState.CANCELLED.value}

        logger.info("Executing node: EVIDENCE", extra={"run_id": state["run_id"]})
        chunks = [RetrievalItem(**r) for r in state.get("retrieval_results", [])]
        out = self.evidence.execute(
            EvidenceInput(
                ranked_chunks=chunks,
                draft_claims=[],
            )
        )
        ev_data = [e.model_dump() for e in out.evidence]
        claims_data = [c.model_dump() for c in out.claims]
        return {
            "evidence": ev_data,
            "claims": claims_data,
            "current_stage": RunState.EVIDENCE.value,
            "timestamps": {**state.get("timestamps", {}), "evidence_completed_at": utc_now_iso()},
        }

    def node_contradiction(self, state: ResearchState) -> dict[str, Any]:
        if self._is_cancelled(state):
            return {"run_status": RunState.CANCELLED.value, "current_stage": RunState.CANCELLED.value}

        logger.info("Executing node: CONTRADICTION", extra={"run_id": state["run_id"]})
        claims = [Claim(**c) for c in state.get("claims", [])]
        evidence = [EvidenceItem(**e) for e in state.get("evidence", [])]
        out = self.contradiction.execute(
            ContradictionInput(
                claims=claims,
                evidence=evidence,
            )
        )
        contra_data = [c.model_dump() for c in out.contradictions]
        return {
            "contradictions": contra_data,
            "current_stage": RunState.CONTRADICTION.value,
            "timestamps": {**state.get("timestamps", {}), "contradiction_completed_at": utc_now_iso()},
        }

    def node_analysis(self, state: ResearchState) -> dict[str, Any]:
        if self._is_cancelled(state):
            return {"run_status": RunState.CANCELLED.value, "current_stage": RunState.CANCELLED.value}

        logger.info("Executing node: ANALYSIS", extra={"run_id": state["run_id"]})
        evidence = [EvidenceItem(**e) for e in state.get("evidence", [])]
        contradictions = [ContradictionItem(**c) for c in state.get("contradictions", [])]
        out = self.analysis.execute(
            AnalysisInput(
                validated_evidence=evidence,
                contradictions=contradictions,
                project_context=state.get("project_context", {}),
            )
        )
        return {
            "analysis": out.analysis.model_dump(),
            "current_stage": RunState.ANALYSIS.value,
            "timestamps": {**state.get("timestamps", {}), "analysis_completed_at": utc_now_iso()},
        }

    def node_report(self, state: ResearchState) -> dict[str, Any]:
        if self._is_cancelled(state):
            return {"run_status": RunState.CANCELLED.value, "current_stage": RunState.CANCELLED.value}

        logger.info("Executing node: REPORT", extra={"run_id": state["run_id"], "version": state.get("report_version", 1)})
        analysis = AnalysisObject(**state["analysis"]) if state.get("analysis") else AnalysisObject(summary="Summary")
        claims = [Claim(**c) for c in state.get("claims", [])]
        evidence = [EvidenceItem(**e) for e in state.get("evidence", [])]
        pv = state.get("prompt_versions", {}).get("report", "prompt-v1.0")

        out = self.report.execute(
            ReportInput(
                analysis_object=analysis,
                prompt_version=pv,
                claims=claims,
                evidence=evidence,
                title=f"Research Report: {state['research_question'][:60]}",
            )
        )
        return {
            "report": out.report_draft.model_dump(),
            "current_stage": RunState.REPORT.value,
            "timestamps": {**state.get("timestamps", {}), "report_completed_at": utc_now_iso()},
        }

    def node_validation(self, state: ResearchState) -> dict[str, Any]:
        if self._is_cancelled(state):
            return {"run_status": RunState.CANCELLED.value, "current_stage": RunState.CANCELLED.value}

        logger.info("Executing node: VALIDATION", extra={"run_id": state["run_id"]})
        report_data = state.get("report") or {}
        report = ReportDraft(**report_data) if report_data else ReportDraft(title="Empty", executive_summary="")
        evidence = [EvidenceItem(**e) for e in state.get("evidence", [])]
        claims = [Claim(**c) for c in state.get("claims", [])]
        contradictions = [ContradictionItem(**c) for c in state.get("contradictions", [])]

        val_res = self.validation.execute(
            ValidationInput(
                report_draft=report,
                evidence=evidence,
                claims=claims,
                contradictions=contradictions,
            )
        )
        is_pass = val_res.is_valid
        return {
            "validation_result": val_res.model_dump(),
            "current_stage": RunState.VALIDATING.value,
            "run_status": RunState.COMPLETED.value if is_pass else RunState.VALIDATING.value,
            "timestamps": {**state.get("timestamps", {}), "validation_completed_at": utc_now_iso()},
        }

    def node_repair(self, state: ResearchState) -> dict[str, Any]:
        """Bounded repair handler (§23) increments attempt and adjusts draft."""
        current_attempts = state.get("repair_attempt", 0) + 1
        logger.info(
            "Executing node: REPAIR",
            extra={"run_id": state["run_id"], "repair_attempt": current_attempts},
        )
        return {
            "repair_attempt": current_attempts,
            "report_version": state.get("report_version", 1) + 1,
            "current_stage": RunState.REPAIRING.value,
            "timestamps": {**state.get("timestamps", {}), f"repair_attempt_{current_attempts}_at": utc_now_iso()},
        }

    # -------------------------------------------------------------
    # CONDITIONAL EDGES
    # -------------------------------------------------------------

    def route_after_node(self, state: ResearchState) -> str:
        """Route to END if cancellation occurred at boundary."""
        if state.get("run_status") == RunState.CANCELLED.value:
            return "cancelled_end"
        return "continue"

    def route_validation_decision(self, state: ResearchState) -> Literal["completed", "repair", "validation_failed"]:
        """
        Validation Branching (§23):
        - PASS -> completed
        - FAIL and repair_attempt < MAX_REPAIR_ATTEMPTS -> repair
        - FAIL and repair_attempt >= MAX_REPAIR_ATTEMPTS -> validation_failed
        """
        if state.get("run_status") == RunState.CANCELLED.value:
            return "completed"

        val_data = state.get("validation_result") or {}
        is_valid = val_data.get("is_valid", False)
        attempts = state.get("repair_attempt", 0)

        if is_valid:
            return "completed"

        if attempts < MAX_REPAIR_ATTEMPTS:
            return "repair"
        else:
            return "validation_failed"

    def node_validation_failed(self, state: ResearchState) -> dict[str, Any]:
        """Terminal failure node when MAX_REPAIR_ATTEMPTS is exhausted (§23)."""
        logger.error(
            "Repair limit exhausted -> transitioning to VALIDATION_FAILED",
            extra={"run_id": state["run_id"], "attempts": state.get("repair_attempt")},
        )
        return {
            "run_status": RunState.VALIDATION_FAILED.value,
            "current_stage": RunState.VALIDATION_FAILED.value,
            "error": "Validation repair attempts exhausted (MAX_REPAIR_ATTEMPTS = 3).",
        }

    # -------------------------------------------------------------
    # COMPILE GRAPH
    # -------------------------------------------------------------

    def build(self) -> Any:
        workflow = StateGraph(ResearchState)

        workflow.add_node("planning", self.node_planning)
        workflow.add_node("source_discovery", self.node_source_discovery)
        workflow.add_node("retrieval", self.node_retrieval)
        workflow.add_node("evidence", self.node_evidence)
        workflow.add_node("contradiction", self.node_contradiction)
        workflow.add_node("analysis", self.node_analysis)
        workflow.add_node("report", self.node_report)
        workflow.add_node("validation", self.node_validation)
        workflow.add_node("repair", self.node_repair)
        workflow.add_node("validation_failed", self.node_validation_failed)

        # Edges
        workflow.set_entry_point("planning")
        workflow.add_edge("planning", "source_discovery")
        workflow.add_edge("source_discovery", "retrieval")
        workflow.add_edge("retrieval", "evidence")
        workflow.add_edge("evidence", "contradiction")
        workflow.add_edge("contradiction", "analysis")
        workflow.add_edge("analysis", "report")
        workflow.add_edge("report", "validation")

        # Conditional branch after validation
        workflow.add_conditional_edges(
            "validation",
            self.route_validation_decision,
            {
                "completed": END,
                "repair": "repair",
                "validation_failed": "validation_failed",
            },
        )

        # Loop repair back to report -> validation
        workflow.add_edge("repair", "report")
        workflow.add_edge("validation_failed", END)

        return workflow.compile()
