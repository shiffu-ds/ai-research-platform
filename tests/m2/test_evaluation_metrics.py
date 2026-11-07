import pytest

from rag_m2.evaluation.metrics import (
    evaluate_evidence,
    evaluate_retrieval,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
)
from rag_m2.evaluation.models import (
    EvidenceMetrics,
    RetrievalMetrics,
)
from rag_m2.evaluation.thresholds import (
    evaluate_threshold_gate,
    load_thresholds,
)


def test_recall_at_10():

    retrieved = [
        "a",
        "x",
        "b",
        "y",
        "c",
    ]

    relevant = [
        "a",
        "b",
        "c",
        "d",
    ]

    score = recall_at_k(
        retrieved,
        relevant,
        k=10,
    )

    assert score == pytest.approx(
        0.75
    )


def test_precision_at_10():

    retrieved = [
        "a",
        "b",
        "c",
        "x",
        "y",
        "z",
        "u",
        "v",
        "w",
        "q",
    ]

    relevant = [
        "a",
        "b",
        "c",
    ]

    score = precision_at_k(
        retrieved,
        relevant,
        k=10,
    )

    assert score == pytest.approx(
        0.30
    )


def test_reciprocal_rank():

    retrieved = [
        "wrong-1",
        "wrong-2",
        "correct",
        "wrong-3",
    ]

    relevant = [
        "correct"
    ]

    score = reciprocal_rank(
        retrieved,
        relevant,
    )

    assert score == pytest.approx(
        1.0 / 3.0
    )


def test_evaluate_retrieval_returns_all_metrics():

    retrieved = [
        "r1",
        "r2",
        "x1",
        "x2",
        "x3",
        "x4",
        "x5",
        "x6",
        "x7",
        "x8",
    ]

    relevant = [
        "r1",
        "r2",
    ]

    metrics = evaluate_retrieval(
        retrieved,
        relevant,
    )

    assert (
        metrics.recall_at_10
        == pytest.approx(1.0)
    )

    assert (
        metrics.precision_at_10
        == pytest.approx(0.2)
    )

    assert (
        metrics.mrr
        == pytest.approx(1.0)
    )


def test_evidence_metrics():

    metrics = evaluate_evidence(
        predicted_evidence_ids=[
            "e1",
            "e2",
            "wrong",
        ],

        expected_evidence_ids=[
            "e1",
            "e2",
            "e3",
        ],

        predicted_citation_ids=[
            "c1",
            "c2",
        ],

        expected_citation_ids=[
            "c1",
            "c2",
        ],
    )

    assert (
        metrics.attribution_accuracy
        == pytest.approx(
            2 / 3
        )
    )

    assert (
        metrics.completeness
        == pytest.approx(
            2 / 3
        )
    )

    assert (
        metrics.citation_correctness
        == pytest.approx(1.0)
    )


def test_threshold_configuration_matches_spec():

    thresholds = (
        load_thresholds()
    )

    assert (
        thresholds
        .retrieval_recall_at_10
        == 0.85
    )

    assert (
        thresholds
        .retrieval_precision_at_10
        == 0.75
    )

    assert (
        thresholds.retrieval_mrr
        == 0.70
    )

    assert (
        thresholds
        .evidence_attribution_accuracy
        == 0.95
    )

    assert (
        thresholds
        .evidence_completeness
        == 0.90
    )

    assert (
        thresholds
        .citation_correctness
        == 0.98
    )


def test_threshold_gate_reports_pass_and_fail():

    passing = (
        evaluate_threshold_gate(
            retrieval=(
                RetrievalMetrics(
                    recall_at_10=0.90,
                    precision_at_10=0.80,
                    mrr=0.75,
                )
            ),

            evidence=(
                EvidenceMetrics(
                    attribution_accuracy=0.97,
                    completeness=0.93,
                    citation_correctness=0.99,
                )
            ),
        )
    )

    assert passing.passed
    assert passing.failures == ()

    failing = (
        evaluate_threshold_gate(
            retrieval=(
                RetrievalMetrics(
                    recall_at_10=0.50,
                    precision_at_10=0.40,
                    mrr=0.30,
                )
            ),

            evidence=(
                EvidenceMetrics(
                    attribution_accuracy=0.80,
                    completeness=0.70,
                    citation_correctness=0.75,
                )
            ),
        )
    )

    assert not failing.passed

    assert len(
        failing.failures
    ) == 6