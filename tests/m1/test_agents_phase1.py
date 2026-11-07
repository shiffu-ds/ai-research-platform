"""
Unit tests for the Eight LangGraph Research Agents (GH-02 through GH-09).
"""

import pytest

from agents.analysis import AnalysisAgent, AnalysisInput
from agents.contradiction import CalculationService, ContradictionAgent, ContradictionInput
from agents.discovery import SourceDiscoveryAgent, SourceDiscoveryInput
from agents.evidence import EvidenceAgent, EvidenceInput
from agents.exceptions import InvalidQuestionError, NoSourcesFoundError, RetrievalError
from agents.planner import PlannerInput, ResearchPlannerAgent
from agents.report import ReportAgent, ReportInput
from agents.retrieval import RetrievalAgent, RetrievalInput
from agents.schemas import (
    Claim,
    ConflictType,
    EvidenceItem,
    PlanTask,
    ReportDraft,
    RetrievalItem,
)
from agents.validation import ValidationAgent, ValidationInput


# --- GH-02: Research Planner Tests ---
def test_planner_decomposition():
    planner = ResearchPlannerAgent()
    out = planner.execute(PlannerInput(research_question="Analyze global semiconductor supply chains for 2026."))
    plan = out.research_plan
    assert plan.version >= 1
    assert len(plan.tasks) >= 3
    assert "literature_and_sources" in plan.required_evidence_categories


def test_planner_invalid_question():
    planner = ResearchPlannerAgent()
    with pytest.raises(InvalidQuestionError):
        planner.execute(PlannerInput(research_question="   "))
    with pytest.raises(InvalidQuestionError):
        planner.execute(PlannerInput(research_question="abc"))


# --- GH-03: Source Discovery Agent Tests ---
def test_source_discovery_ranking():
    discovery = SourceDiscoveryAgent()
    task = PlanTask(description="Find authoritative sources", evidence_category="semiconductor")
    out = discovery.execute(SourceDiscoveryInput(task=task, query="Semiconductor manufacturing reports", max_candidates=3))
    assert len(out.candidate_sources) > 0
    top = out.candidate_sources[0]
    assert top.authority_level > 0.0
    assert top.url.startswith("https://")


# --- GH-04: Retrieval Agent Tests ---
def test_retrieval_acl_scoping():
    retrieval = RetrievalAgent()
    with pytest.raises(RetrievalError):
        retrieval.execute(RetrievalInput(query="test", project_id=""))

    out = retrieval.execute(RetrievalInput(query="Quantum computing benchmarks", project_id="proj-123", top_k=2))
    assert len(out.retrieval_results) == 2
    assert out.retrieval_results[0].metadata["project_id"] == "proj-123"


def test_retrieval_m2_service_integration():
    class MockM2Service:
        def retrieve(self, query: str, project_id: str, top_k: int):
            return [
                {
                    "chunk_id": "m2-chk-1",
                    "document_version_id": "doc-v1",
                    "source_version_id": "src-v1",
                    "text": "M2 retrieved chunk content",
                    "rank": 1,
                    "score": 0.95,
                    "retrieval_method": "m2_hybrid",
                }
            ]

    retrieval = RetrievalAgent(rag_service=MockM2Service())
    out = retrieval.execute(RetrievalInput(query="test", project_id="proj-456", top_k=5))
    assert len(out.retrieval_results) == 1
    assert out.retrieval_results[0].chunk_id == "m2-chk-1"


# --- GH-05: Evidence Agent Tests ---
def test_evidence_extraction_and_provenance_hashing():
    evidence_agent = EvidenceAgent()
    chunks = [
        RetrievalItem(
            chunk_id="chk-01",
            document_version_id="doc-v1",
            source_version_id="src-v1",
            text="Autonomous systems increased operational efficiency by 40% in laboratory trials.",
            rank=1,
            score=0.9,
        )
    ]
    out = evidence_agent.execute(EvidenceInput(ranked_chunks=chunks))
    assert len(out.evidence) > 0
    ev = out.evidence[0]
    assert len(ev.evidence_hash) == 64  # SHA-256 length
    assert ev.document_chunk_id == "chk-01"


# --- GH-06: Contradiction Agent & Calculation Service Tests ---
def test_calculation_service():
    # Unit conversion
    rec1 = CalculationService.convert_unit(100.0, "gb", "mb")
    assert rec1.result == 102400.0
    assert rec1.operation == "convert_unit"

    # Weighted average
    rec2 = CalculationService.weighted_average([10.0, 20.0], [1.0, 3.0])
    assert rec2.result == 17.5

    # Statistical comparison
    rec3 = CalculationService.statistical_comparison(100.0, 150.0)
    assert rec3.result == 50.0


def test_contradiction_numeric_and_direct():
    contradiction_agent = ContradictionAgent()
    c1 = Claim(claim_id="c1", text="Company revenue increased by 20% in 2025.", is_supported=True)
    c2 = Claim(claim_id="c2", text="Company revenue decreased by 10% in 2025.", is_supported=True)
    out = contradiction_agent.execute(ContradictionInput(claims=[c1, c2]))

    assert len(out.contradictions) > 0
    types = [c.conflict_type for c in out.contradictions]
    assert ConflictType.DIRECT_CONTRADICTION in types or ConflictType.NUMERIC_CONFLICT in types


# --- GH-07: Analysis Agent Tests ---
def test_analysis_synthesis():
    agent = AnalysisAgent()
    ev = [
        EvidenceItem(
            document_chunk_id="chk-1",
            source_version_id="src-1",
            document_version_id="doc-1",
            excerpt="High productivity noted.",
            evidence_hash="hash1",
        )
    ]
    out = agent.execute(AnalysisInput(validated_evidence=ev))
    assert out.analysis.status == "COMPLETE"
    assert len(out.analysis.key_findings) > 0


# --- GH-08: Report Agent Tests ---
def test_report_agent_draft_generation():
    agent = ReportAgent()
    analysis = agent.execute(
        ReportInput(
            analysis_object=agent.execute(
                ReportInput(
                    analysis_object=agent.validate_input({
                        "analysis_object": {
                            "summary": "Valid executive summary of research findings.",
                            "key_findings": ["Finding A", "Finding B"],
                        }
                    }).analysis_object
                )
            ).report_draft.executive_summary  # helper
        )
    ) if False else None

    from agents.schemas import AnalysisObject
    analysis_obj = AnalysisObject(
        summary="Executive summary regarding autonomous intelligence systems.",
        key_findings=["Productivity accelerated", "Errors decreased"],
    )
    c1 = Claim(claim_id="claim-1", text="Productivity accelerated", is_supported=True, evidence_ids=["ev-1"])
    e1 = EvidenceItem(
        evidence_id="ev-1",
        document_chunk_id="chk-1",
        source_version_id="src-1",
        document_version_id="doc-1",
        excerpt="Empirical proof of productivity",
        evidence_hash="hash1",
    )
    out = agent.execute(ReportInput(analysis_object=analysis_obj, claims=[c1], evidence=[e1]))
    assert len(out.report_draft.sections) >= 4
    assert len(out.report_draft.citations) == 1
    assert out.report_draft.citations[0].evidence_id == "ev-1"


# --- GH-09: Validation Agent Tests ---
def test_validation_agent_rules():
    agent = ValidationAgent()
    from agents.schemas import ReportDraft, ReportSection, CitationItem

    # Valid report
    draft_valid = ReportDraft(
        title="Valid Report",
        executive_summary="This is an extensive and thorough executive summary covering key points.",
        sections=[
            ReportSection(title="Executive Summary", content="Summary"),
            ReportSection(title="Key Findings & Synthesis", content="Synthesis"),
            ReportSection(title="Evidence & Citations", content="Evidence"),
            ReportSection(title="Contradictions & Divergences", content="Contradictions"),
        ],
        citations=[
            CitationItem(
                claim_id="c1",
                evidence_id="ev-1",
                source_version_id="s1",
                document_version_id="d1",
                document_chunk_id="chk1",
                excerpt="Excerpt",
            )
        ],
    )
    ev = [
        EvidenceItem(
            evidence_id="ev-1",
            document_chunk_id="chk1",
            source_version_id="s1",
            document_version_id="d1",
            excerpt="Excerpt",
            evidence_hash="h1",
        )
    ]
    cl = [Claim(claim_id="c1", text="Supported claim", is_supported=True, evidence_ids=["ev-1"])]

    val_res = agent.execute(ValidationInput(report_draft=draft_valid, evidence=ev, claims=cl))
    assert val_res.is_valid is True
    assert val_res.status == "PASS"

    # Missing section failure
    draft_invalid = draft_valid.model_copy(deep=True)
    draft_invalid.sections = draft_invalid.sections[:2]
    val_fail = agent.execute(ValidationInput(report_draft=draft_invalid, evidence=ev, claims=cl))
    assert val_fail.is_valid is False
    assert "MISSING_SECTION" in val_fail.failing_checks
