from __future__ import annotations

from collections.abc import Iterable

from rag_m2.evaluation.models import (
    EvidenceMetrics,
    RetrievalMetrics,
)


def _clean_ids(
    values: Iterable[str],
) -> list[str]:
    """
    Normalize evaluation identifiers.

    Empty IDs are ignored.

    Duplicate IDs are removed while
    preserving their original order.
    """

    seen: set[str] = set()

    cleaned: list[str] = []

    for value in values:

        value = value.strip()

        if not value:
            continue

        if value in seen:
            continue

        seen.add(
            value
        )

        cleaned.append(
            value
        )

    return cleaned


def recall_at_k(
    retrieved_ids: Iterable[str],
    relevant_ids: Iterable[str],
    k: int,
) -> float:
    """
    Recall@K:

        relevant retrieved in top K
        ---------------------------
        total relevant items
    """

    if k <= 0:
        raise ValueError(
            "k must be greater than zero."
        )

    retrieved = _clean_ids(
        retrieved_ids
    )

    relevant = set(
        _clean_ids(
            relevant_ids
        )
    )

    if not relevant:
        raise ValueError(
            "relevant_ids cannot be empty "
            "when calculating recall."
        )

    top_k = retrieved[:k]

    hits = sum(
        1
        for item_id in top_k
        if item_id in relevant
    )

    return hits / len(
        relevant
    )


def precision_at_k(
    retrieved_ids: Iterable[str],
    relevant_ids: Iterable[str],
    k: int,
) -> float:
    """
    Precision@K:

        relevant retrieved in top K
        ---------------------------
                 K

    Using K as the denominator means that
    returning fewer than K results is also
    reflected in the score.
    """

    if k <= 0:
        raise ValueError(
            "k must be greater than zero."
        )

    retrieved = _clean_ids(
        retrieved_ids
    )

    relevant = set(
        _clean_ids(
            relevant_ids
        )
    )

    top_k = retrieved[:k]

    hits = sum(
        1
        for item_id in top_k
        if item_id in relevant
    )

    return hits / k


def reciprocal_rank(
    retrieved_ids: Iterable[str],
    relevant_ids: Iterable[str],
) -> float:
    """
    Reciprocal rank of the first
    relevant retrieved item.

    If no relevant result is retrieved,
    the score is 0.0.
    """

    retrieved = _clean_ids(
        retrieved_ids
    )

    relevant = set(
        _clean_ids(
            relevant_ids
        )
    )

    if not relevant:
        raise ValueError(
            "relevant_ids cannot be empty "
            "when calculating reciprocal rank."
        )

    for rank, item_id in enumerate(
        retrieved,
        start=1,
    ):

        if item_id in relevant:
            return 1.0 / rank

    return 0.0


def evaluate_retrieval(
    retrieved_ids: Iterable[str],
    relevant_ids: Iterable[str],
) -> RetrievalMetrics:
    """
    Evaluate one retrieval case using
    the project's required top-10 metrics.
    """

    retrieved = list(
        retrieved_ids
    )

    relevant = list(
        relevant_ids
    )

    return RetrievalMetrics(
        recall_at_10=recall_at_k(
            retrieved,
            relevant,
            k=10,
        ),

        precision_at_10=precision_at_k(
            retrieved,
            relevant,
            k=10,
        ),

        mrr=reciprocal_rank(
            retrieved,
            relevant,
        ),
    )


def _set_precision(
    predicted_ids: Iterable[str],
    expected_ids: Iterable[str],
) -> float:

    predicted = set(
        _clean_ids(
            predicted_ids
        )
    )

    expected = set(
        _clean_ids(
            expected_ids
        )
    )

    if not predicted:
        return (
            1.0
            if not expected
            else 0.0
        )

    correct = len(
        predicted
        & expected
    )

    return correct / len(
        predicted
    )


def _set_recall(
    predicted_ids: Iterable[str],
    expected_ids: Iterable[str],
) -> float:

    predicted = set(
        _clean_ids(
            predicted_ids
        )
    )

    expected = set(
        _clean_ids(
            expected_ids
        )
    )

    if not expected:
        return 1.0

    correct = len(
        predicted
        & expected
    )

    return correct / len(
        expected
    )


def evaluate_evidence(
    predicted_evidence_ids: Iterable[str],
    expected_evidence_ids: Iterable[str],
    predicted_citation_ids: Iterable[str],
    expected_citation_ids: Iterable[str],
) -> EvidenceMetrics:
    """
    M2 evidence evaluation.

    Attribution accuracy:
        precision of predicted evidence.

    Completeness:
        recall of expected evidence.

    Citation correctness:
        precision of generated citations.

    The caller supplies canonical golden
    identifiers/keys.
    """

    predicted_evidence = list(
        predicted_evidence_ids
    )

    expected_evidence = list(
        expected_evidence_ids
    )

    predicted_citations = list(
        predicted_citation_ids
    )

    expected_citations = list(
        expected_citation_ids
    )

    return EvidenceMetrics(
        attribution_accuracy=(
            _set_precision(
                predicted_evidence,
                expected_evidence,
            )
        ),

        completeness=(
            _set_recall(
                predicted_evidence,
                expected_evidence,
            )
        ),

        citation_correctness=(
            _set_precision(
                predicted_citations,
                expected_citations,
            )
        ),
    )