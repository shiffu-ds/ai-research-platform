"""
Tests for Evaluation Framework & Golden Dataset Staging Gates (GH-18, v4.0 §24).
"""

import pytest

from agents.evaluation import (
    BenchmarkRunner,
    DEFAULT_EVALUATION_THRESHOLDS,
    EvaluationMetrics,
    EvaluationThresholds,
)


def test_evaluation_metric_calculations():
    # Recall@10
    retrieved = ["c1", "c2", "c3", "c4"]
    relevant = ["c2", "c4", "c5"]
    recall = EvaluationMetrics.calculate_recall_at_k(retrieved, relevant, k=10)
    assert recall == 2.0 / 3.0

    # MRR (first hit is c2 at rank 2)
    mrr = EvaluationMetrics.calculate_mrr(retrieved, relevant)
    assert mrr == 0.5

    # Citation correctness
    citations = [{"evidence_id": "ev-1"}, {"evidence_id": "ev-2"}]
    verified = {"ev-1", "ev-2"}
    assert EvaluationMetrics.calculate_citation_correctness(citations, verified) == 1.0


def test_benchmark_runner_staging_gate_pass():
    runner = BenchmarkRunner()

    mock_pipeline_results = [
        {
            "retrieval_results": [{"chunk_id": "chk-gold-0-001"}, {"chunk_id": "chk-gold-0-002"}],
            "evidence": [{"evidence_id": "ev-1"}],
            "report": {"citations": [{"evidence_id": "ev-1"}]},
            "claims": [{"is_supported": True, "evidence_ids": ["ev-1"]}],
        },
        {
            "retrieval_results": [{"chunk_id": "chk-gold-1-001"}, {"chunk_id": "chk-gold-1-002"}],
            "evidence": [{"evidence_id": "ev-2"}],
            "report": {"citations": [{"evidence_id": "ev-2"}]},
            "claims": [{"is_supported": True, "evidence_ids": ["ev-2"]}],
        },
    ]

    report = runner.evaluate_pipeline_output(mock_pipeline_results)
    assert report.passed is True
    assert len(report.failing_metrics) == 0
    assert report.scores["citation_correctness"] >= DEFAULT_EVALUATION_THRESHOLDS.citation_correctness
    assert report.scores["supported_claim_rate"] >= DEFAULT_EVALUATION_THRESHOLDS.supported_claim_rate


def test_benchmark_runner_staging_gate_blocks_regression():
    # Artificially strict threshold
    strict_thresholds = EvaluationThresholds(retrieval_recall_at_10=0.99)
    runner = BenchmarkRunner(thresholds=strict_thresholds)

    mock_regressed_results = [
        {
            "retrieval_results": [{"chunk_id": "chk-other"}],
            "evidence": [],
            "report": {"citations": []},
            "claims": [],
        }
    ]

    report = runner.evaluate_pipeline_output(mock_regressed_results)
    assert report.passed is False
    assert any("retrieval_recall_at_10" in f for f in report.failing_metrics)
