from __future__ import annotations

from dataclasses import dataclass

from rag_m2.evaluation.models import (
    EvaluationGateResult,
    EvidenceMetrics,
    RetrievalMetrics,
)


@dataclass(frozen=True)
class GoldenBenchmarkCase:
    """
    M2 adapter representation of one case
    from the team's versioned golden dataset.

    This does not replace the authoritative
    M1/M5 golden-dataset schema.
    """

    case_id: str

    research_question: str

    claim: str

    relevant_chunk_ids: tuple[
        str,
        ...
    ]

    expected_evidence_hashes: tuple[
        str,
        ...
    ]

    expected_citation_keys: tuple[
        str,
        ...
    ]


@dataclass(frozen=True)
class GoldenBenchmarkDataset:
    """
    Versioned collection of M2 benchmark cases.
    """

    version: str

    cases: tuple[
        GoldenBenchmarkCase,
        ...
    ]


@dataclass(frozen=True)
class BenchmarkPrediction:
    """
    Actual output produced by the M2 system
    for one golden benchmark case.
    """

    retrieved_chunk_ids: tuple[
        str,
        ...
    ]

    predicted_evidence_hashes: tuple[
        str,
        ...
    ]

    predicted_citation_keys: tuple[
        str,
        ...
    ]


@dataclass(frozen=True)
class BenchmarkCaseResult:
    """
    Evaluation result for one golden case.
    """

    case_id: str

    retrieval: RetrievalMetrics

    evidence: EvidenceMetrics


@dataclass(frozen=True)
class BenchmarkReport:
    """
    Complete machine-readable M2 benchmark
    result.
    """

    report_version: str

    dataset_version: str

    threshold_version: str

    generated_at: str

    case_count: int

    retrieval: RetrievalMetrics

    evidence: EvidenceMetrics

    gate: EvaluationGateResult

    cases: tuple[
        BenchmarkCaseResult,
        ...
    ]