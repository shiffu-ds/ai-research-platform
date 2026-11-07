"""
Evaluation Thresholds Configuration (GH-18, v4.0 §24).
Maintains versioned staging gate quality criteria.
Never embed magic numbers in code.
"""

from pydantic import BaseModel, Field


class EvaluationThresholds(BaseModel):
    """
    Staging gate criteria specified in v4.0 §24.
    Any regression below these thresholds blocks CI/CD release gate.
    """
    version: str = "v4.0"

    # Retrieval thresholds
    retrieval_recall_at_10: float = Field(default=0.85, ge=0.0, le=1.0)
    retrieval_precision_at_10: float = Field(default=0.75, ge=0.0, le=1.0)
    retrieval_mrr: float = Field(default=0.70, ge=0.0, le=1.0)

    # Evidence thresholds
    evidence_attribution_accuracy: float = Field(default=0.95, ge=0.0, le=1.0)
    evidence_completeness: float = Field(default=0.90, ge=0.0, le=1.0)
    citation_correctness: float = Field(default=0.98, ge=0.0, le=1.0)

    # Generation thresholds
    supported_claim_rate: float = Field(default=0.97, ge=0.0, le=1.0)
    unsupported_claim_rate: float = Field(default=0.03, ge=0.0, le=1.0)
    citation_coverage: float = Field(default=0.95, ge=0.0, le=1.0)

    # Contradiction thresholds
    contradiction_precision: float = Field(default=0.80, ge=0.0, le=1.0)
    contradiction_recall: float = Field(default=0.80, ge=0.0, le=1.0)
    contradiction_f1: float = Field(default=0.80, ge=0.0, le=1.0)

    # System thresholds
    system_completion_rate: float = Field(default=0.98, ge=0.0, le=1.0)
    system_failure_rate: float = Field(default=0.02, ge=0.0, le=1.0)


DEFAULT_EVALUATION_THRESHOLDS = EvaluationThresholds()
