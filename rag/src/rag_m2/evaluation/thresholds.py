from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from rag_m2.evaluation.models import (
    EvaluationGateResult,
    EvaluationThresholds,
    EvidenceMetrics,
    RetrievalMetrics,
)


class EvaluationConfigurationError(
    RuntimeError
):
    pass


def default_threshold_path() -> Path:
    """
    Returns:

        rag/evaluation/m2_thresholds.json
    """

    rag_directory = (
        Path(__file__)
        .resolve()
        .parents[3]
    )

    return (
        rag_directory
        / "evaluation"
        / "m2_thresholds.json"
    )


def _validate_score(
    name: str,
    value: Any,
) -> float:

    if not isinstance(
        value,
        (int, float),
    ):
        raise EvaluationConfigurationError(
            f"{name} must be numeric."
        )

    score = float(
        value
    )

    if not 0.0 <= score <= 1.0:
        raise EvaluationConfigurationError(
            f"{name} must be between "
            "0.0 and 1.0."
        )

    return score


def load_thresholds(
    path: str | Path | None = None,
) -> EvaluationThresholds:

    threshold_path = (
        Path(path)
        if path is not None
        else default_threshold_path()
    )

    if not threshold_path.exists():
        raise EvaluationConfigurationError(
            "M2 evaluation threshold "
            f"configuration not found: "
            f"{threshold_path}"
        )

    try:

        data = json.loads(
            threshold_path.read_text(
                encoding="utf-8"
            )
        )

        version = str(
            data["version"]
        ).strip()

        retrieval = (
            data["retrieval"]
        )

        evidence = (
            data["evidence"]
        )

    except (
        KeyError,
        TypeError,
        json.JSONDecodeError,
    ) as exc:

        raise EvaluationConfigurationError(
            "Invalid M2 evaluation "
            "configuration structure."
        ) from exc

    if not version:
        raise EvaluationConfigurationError(
            "Evaluation configuration "
            "version cannot be empty."
        )

    return EvaluationThresholds(
        version=version,

        retrieval_recall_at_10=(
            _validate_score(
                "retrieval.recall_at_10",
                retrieval[
                    "recall_at_10"
                ],
            )
        ),

        retrieval_precision_at_10=(
            _validate_score(
                "retrieval.precision_at_10",
                retrieval[
                    "precision_at_10"
                ],
            )
        ),

        retrieval_mrr=(
            _validate_score(
                "retrieval.mrr",
                retrieval["mrr"],
            )
        ),

        evidence_attribution_accuracy=(
            _validate_score(
                "evidence."
                "attribution_accuracy",
                evidence[
                    "attribution_accuracy"
                ],
            )
        ),

        evidence_completeness=(
            _validate_score(
                "evidence.completeness",
                evidence[
                    "completeness"
                ],
            )
        ),

        citation_correctness=(
            _validate_score(
                "evidence."
                "citation_correctness",
                evidence[
                    "citation_correctness"
                ],
            )
        ),
    )


def evaluate_threshold_gate(
    retrieval: RetrievalMetrics,
    evidence: EvidenceMetrics,
    thresholds: (
        EvaluationThresholds
        | None
    ) = None,
) -> EvaluationGateResult:

    thresholds = (
        thresholds
        or load_thresholds()
    )

    failures: list[str] = []

    checks = [
        (
            "retrieval.recall_at_10",
            retrieval.recall_at_10,
            thresholds
            .retrieval_recall_at_10,
        ),
        (
            "retrieval.precision_at_10",
            retrieval.precision_at_10,
            thresholds
            .retrieval_precision_at_10,
        ),
        (
            "retrieval.mrr",
            retrieval.mrr,
            thresholds.retrieval_mrr,
        ),
        (
            "evidence."
            "attribution_accuracy",
            evidence
            .attribution_accuracy,
            thresholds
            .evidence_attribution_accuracy,
        ),
        (
            "evidence.completeness",
            evidence.completeness,
            thresholds
            .evidence_completeness,
        ),
        (
            "evidence."
            "citation_correctness",
            evidence
            .citation_correctness,
            thresholds
            .citation_correctness,
        ),
    ]

    for (
        metric_name,
        actual,
        required,
    ) in checks:

        if actual < required:

            failures.append(
                f"{metric_name}: "
                f"{actual:.4f} "
                f"< required "
                f"{required:.4f}"
            )

    return EvaluationGateResult(
        passed=(
            len(failures) == 0
        ),

        threshold_version=(
            thresholds.version
        ),

        failures=tuple(
            failures
        ),
    )