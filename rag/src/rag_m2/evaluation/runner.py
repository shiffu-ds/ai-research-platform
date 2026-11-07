from __future__ import annotations

from datetime import (
    datetime,
    timezone,
)

from rag_m2.evaluation.benchmark_models import (
    BenchmarkCaseResult,
    BenchmarkReport,
    GoldenBenchmarkDataset,
)
from rag_m2.evaluation.executor import (
    BenchmarkExecutor,
)
from rag_m2.evaluation.metrics import (
    evaluate_evidence,
    evaluate_retrieval,
)
from rag_m2.evaluation.models import (
    EvidenceMetrics,
    RetrievalMetrics,
)
from rag_m2.evaluation.thresholds import (
    evaluate_threshold_gate,
    load_thresholds,
)


class BenchmarkRunnerError(
    RuntimeError
):
    pass


def _mean(
    values: list[float],
) -> float:

    if not values:
        raise BenchmarkRunnerError(
            "Cannot average an "
            "empty metric collection."
        )

    return sum(
        values
    ) / len(
        values
    )


class M2BenchmarkRunner:
    """
    Runs a versioned golden dataset through
    an M2 BenchmarkExecutor.

    Aggregate scores use macro averaging:
    every benchmark case contributes equally.
    """

    def __init__(
        self,
        executor: BenchmarkExecutor,
    ):
        self.executor = executor

    def run(
        self,
        dataset: GoldenBenchmarkDataset,
    ) -> BenchmarkReport:

        if not dataset.cases:
            raise BenchmarkRunnerError(
                "Benchmark dataset "
                "contains no cases."
            )

        case_results: list[
            BenchmarkCaseResult
        ] = []

        for case in dataset.cases:

            prediction = (
                self.executor.execute(
                    case
                )
            )

            retrieval_metrics = (
                evaluate_retrieval(
                    retrieved_ids=(
                        prediction
                        .retrieved_chunk_ids
                    ),

                    relevant_ids=(
                        case
                        .relevant_chunk_ids
                    ),
                )
            )

            evidence_metrics = (
                evaluate_evidence(
                    predicted_evidence_ids=(
                        prediction
                        .predicted_evidence_hashes
                    ),

                    expected_evidence_ids=(
                        case
                        .expected_evidence_hashes
                    ),

                    predicted_citation_ids=(
                        prediction
                        .predicted_citation_keys
                    ),

                    expected_citation_ids=(
                        case
                        .expected_citation_keys
                    ),
                )
            )

            case_results.append(
                BenchmarkCaseResult(
                    case_id=(
                        case.case_id
                    ),

                    retrieval=(
                        retrieval_metrics
                    ),

                    evidence=(
                        evidence_metrics
                    ),
                )
            )

        aggregate_retrieval = (
            RetrievalMetrics(
                recall_at_10=_mean(
                    [
                        item.retrieval
                        .recall_at_10

                        for item
                        in case_results
                    ]
                ),

                precision_at_10=_mean(
                    [
                        item.retrieval
                        .precision_at_10

                        for item
                        in case_results
                    ]
                ),

                mrr=_mean(
                    [
                        item.retrieval.mrr

                        for item
                        in case_results
                    ]
                ),
            )
        )

        aggregate_evidence = (
            EvidenceMetrics(
                attribution_accuracy=_mean(
                    [
                        item.evidence
                        .attribution_accuracy

                        for item
                        in case_results
                    ]
                ),

                completeness=_mean(
                    [
                        item.evidence
                        .completeness

                        for item
                        in case_results
                    ]
                ),

                citation_correctness=_mean(
                    [
                        item.evidence
                        .citation_correctness

                        for item
                        in case_results
                    ]
                ),
            )
        )

        thresholds = (
            load_thresholds()
        )

        gate = (
            evaluate_threshold_gate(
                retrieval=(
                    aggregate_retrieval
                ),

                evidence=(
                    aggregate_evidence
                ),

                thresholds=thresholds,
            )
        )

        return BenchmarkReport(
            report_version="1.0",

            dataset_version=(
                dataset.version
            ),

            threshold_version=(
                thresholds.version
            ),

            generated_at=(
                datetime.now(
                    timezone.utc
                ).isoformat()
            ),

            case_count=len(
                case_results
            ),

            retrieval=(
                aggregate_retrieval
            ),

            evidence=(
                aggregate_evidence
            ),

            gate=gate,

            cases=tuple(
                case_results
            ),
        )