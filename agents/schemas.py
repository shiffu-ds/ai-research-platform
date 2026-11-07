"""
M1 Core Data Models, Schemas and Agent Contract Specifications (v4.0 §6, §11, §20, §21).
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
import uuid

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# =====================================================================
# AGENT CONTRACT SPECIFICATION MODEL (GH-01, §6)
# =====================================================================

class AgentContract(BaseModel):
    """
    Formal representation of an agent's architectural contract (§6).
    Enforces boundary isolation, tool allowlisting, state read/write rules,
    and failure escalation paths.
    """
    name: str
    purpose: str
    input_schema: type[BaseModel]
    output_schema: type[BaseModel]
    allowed_tools: list[str] = Field(default_factory=list)
    allowed_state_read: list[str] = Field(default_factory=list)
    state_written: list[str] = Field(default_factory=list)
    failure_conditions: list[str] = Field(default_factory=list)
    retry_policy: str
    escalation_policy: str


# =====================================================================
# DOMAIN ENTITY MODELS
# =====================================================================

class PlanTask(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    evidence_category: str
    priority: int = 1
    status: str = "PENDING"


class ResearchPlan(BaseModel):
    plan_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    version: int = 1
    research_question: str
    tasks: list[PlanTask] = Field(default_factory=list)
    required_evidence_categories: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)


class CandidateSource(BaseModel):
    source_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str
    title: str
    source_type: str = "web"
    authority_level: float = Field(ge=0.0, le=1.0, default=0.5)
    freshness_score: float = Field(ge=0.0, le=1.0, default=0.5)
    publisher_reputation: float = Field(ge=0.0, le=1.0, default=0.5)
    publication_date: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class RetrievalItem(BaseModel):
    chunk_id: str
    document_version_id: str
    source_version_id: Optional[str] = None
    text: str
    retrieval_method: str = "hybrid"
    rank: int
    score: float
    page_number: Optional[int] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Claim(BaseModel):
    claim_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    category: str = "general"
    is_supported: bool = False
    evidence_ids: list[str] = Field(default_factory=list)


class EvidenceItem(BaseModel):
    evidence_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    claim_id: Optional[str] = None
    document_chunk_id: str
    source_version_id: str
    document_version_id: str
    excerpt: str
    locator: str = ""
    extraction_method: str = "structured-llm"
    model_version: Optional[str] = None
    evidence_hash: str
    created_at: datetime = Field(default_factory=utc_now)


class ConflictType(str, Enum):
    DIRECT_CONTRADICTION = "DIRECT_CONTRADICTION"
    NUMERIC_CONFLICT = "NUMERIC_CONFLICT"
    TEMPORAL_DIFFERENCE = "TEMPORAL_DIFFERENCE"
    METHODOLOGY_DIFFERENCE = "METHODOLOGY_DIFFERENCE"
    SCOPE_DIFFERENCE = "SCOPE_DIFFERENCE"
    UNIT_DIFFERENCE = "UNIT_DIFFERENCE"
    DEFINITION_DIFFERENCE = "DEFINITION_DIFFERENCE"
    ENTITY_AMBIGUITY = "ENTITY_AMBIGUITY"
    INSUFFICIENT_CONTEXT = "INSUFFICIENT_CONTEXT"


class ContradictionItem(BaseModel):
    contradiction_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    claim_ids: list[str] = Field(default_factory=list)
    conflict_type: ConflictType
    entity: str
    metric: Optional[str] = None
    description: str
    deterministic_basis: Optional[str] = None
    llm_advisory_agreed: bool = True
    resolved: bool = False
    resolution_notes: Optional[str] = None


class AnalysisObject(BaseModel):
    analysis_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    summary: str
    key_findings: list[str] = Field(default_factory=list)
    synthesized_evidence: dict[str, Any] = Field(default_factory=dict)
    contradictions_addressed: list[str] = Field(default_factory=list)
    status: str = "COMPLETE"  # or "SYNTHESIS_INCOMPLETE"
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.85)


class CitationItem(BaseModel):
    citation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    claim_id: str
    evidence_id: str
    source_version_id: str
    document_version_id: str
    document_chunk_id: str
    excerpt: str
    locator: str = ""


class ReportSection(BaseModel):
    section_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    claim_ids: list[str] = Field(default_factory=list)
    citation_ids: list[str] = Field(default_factory=list)


class ReportDraft(BaseModel):
    report_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    version: int = 1
    title: str
    executive_summary: str
    sections: list[ReportSection] = Field(default_factory=list)
    citations: list[CitationItem] = Field(default_factory=list)
    claims: list[Claim] = Field(default_factory=list)
    status: str = "DRAFT"  # "DRAFT", "VALIDATED", "FAILED"
    prompt_version: str = "v1.0"
    created_at: datetime = Field(default_factory=utc_now)


class ValidationResult(BaseModel):
    is_valid: bool
    status: str  # "PASS" or "FAIL"
    reasons: list[str] = Field(default_factory=list)
    failing_checks: list[str] = Field(default_factory=list)
    repair_recommendations: list[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=utc_now)


class CalculationRecord(BaseModel):
    calculation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operation: str
    input_data: dict[str, Any]
    formula: str
    result: float
    unit: Optional[str] = None
    precision: int = 4
    timestamp: datetime = Field(default_factory=utc_now)
