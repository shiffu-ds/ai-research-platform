from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RetrievalMetrics:
    """
    M2 retrieval evaluation metrics.

    Values are expected to be in the
    inclusive range [0.0, 1.0].
    """

    recall_at_10: float
    precision_at_10: float
    mrr: float


@dataclass(frozen=True)
class EvidenceMetrics:
    """
    M2 evidence/citation evaluation metrics.
    """

    attribution_accuracy: float
    completeness: float
    citation_correctness: float


@dataclass(frozen=True)
class EvaluationThresholds:
    """
    Versioned staging thresholds loaded
    from configuration.
    """

    version: str

    retrieval_recall_at_10: float
    retrieval_precision_at_10: float
    retrieval_mrr: float

    evidence_attribution_accuracy: float
    evidence_completeness: float
    citation_correctness: float


@dataclass(frozen=True)
class EvaluationGateResult:
    """
    Final M2 acceptance-gate result.
    """

    passed: bool

    threshold_version: str

    failures: tuple[
        str,
        ...
    ]