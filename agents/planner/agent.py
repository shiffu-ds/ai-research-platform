"""
Research Planner Agent (GH-02, v4.0 §6.1).
Decomposes research questions into tasks and evidence categories.
Allowed tools: planning-llm (no web/file tools).
"""

from typing import Any, Callable, Optional
import uuid

from agents.base import BaseAgent
from agents.exceptions import InvalidQuestionError, PlanTimeoutError
from agents.planner.schemas import PlannerInput, PlannerOutput
from agents.schemas import AgentContract, PlanTask, ResearchPlan

PLANNER_CONTRACT = AgentContract(
    name="ResearchPlanner",
    purpose="Interpret the research question; decompose into tasks; identify required evidence categories",
    input_schema=PlannerInput,
    output_schema=PlannerOutput,
    allowed_tools=["planning-llm"],
    allowed_state_read=["research_questions", "prior_plans"],
    state_written=["research_plan"],
    failure_conditions=["INVALID_QUESTION", "PLAN_TIMEOUT"],
    retry_policy="1 retry",
    escalation_policy="escalate to VALIDATION_ERROR",
)


class ResearchPlannerAgent(BaseAgent):
    def __init__(self, contract: AgentContract = PLANNER_CONTRACT):
        super().__init__(contract)

    def run(self, validated_input: PlannerInput, state_reader: Optional[Callable[[str], Any]] = None) -> PlannerOutput:
        question = validated_input.research_question.strip()
        if not question or len(question) < 5:
            raise InvalidQuestionError("Question must be a non-empty string of at least 5 characters.")

        # If a planning-llm tool is registered, use it; otherwise provide deterministic decomposition
        if "planning-llm" in self._tools:
            try:
                llm_res = self.call_tool("planning-llm", question=question, context=validated_input.project_context)
                if isinstance(llm_res, dict) and "tasks" in llm_res:
                    tasks = [PlanTask(**t) for t in llm_res["tasks"]]
                    categories = llm_res.get("categories", ["market_data", "technical_analysis"])
                    plan = ResearchPlan(
                        research_question=question,
                        tasks=tasks,
                        required_evidence_categories=categories,
                    )
                    return PlannerOutput(research_plan=plan)
            except Exception as e:
                if isinstance(e, InvalidQuestionError):
                    raise
                # Fallback to deterministic planning logic below

        # Deterministic decomposition fallback
        tasks = [
            PlanTask(
                task_id=str(uuid.uuid4()),
                description=f"Identify key academic and industry sources for: {question}",
                evidence_category="literature_and_sources",
                priority=1,
            ),
            PlanTask(
                task_id=str(uuid.uuid4()),
                description=f"Extract quantitative findings and empirical metrics regarding: {question}",
                evidence_category="empirical_evidence",
                priority=2,
            ),
            PlanTask(
                task_id=str(uuid.uuid4()),
                description=f"Analyze cross-source contradictions and conflicting claims for: {question}",
                evidence_category="comparative_analysis",
                priority=3,
            ),
        ]
        categories = ["literature_and_sources", "empirical_evidence", "comparative_analysis"]

        plan = ResearchPlan(
            research_question=question,
            tasks=tasks,
            required_evidence_categories=categories,
        )
        return PlannerOutput(research_plan=plan)
