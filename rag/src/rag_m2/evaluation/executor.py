from __future__ import annotations

from typing import Protocol

from rag_m2.evaluation.benchmark_models import (
    BenchmarkPrediction,
    GoldenBenchmarkCase,
)
from rag_m2.evaluation.keys import (
    citation_evaluation_key,
)


class BenchmarkExecutor(
    Protocol
):
    def execute(
        self,
        case: GoldenBenchmarkCase,
    ) -> BenchmarkPrediction:
        ...


class RAGServiceBenchmarkExecutor:
    """
    Executes golden benchmark cases through
    the real public M2RAGService interface.

    The benchmark project must already contain
    the indexed versioned documents belonging
    to the golden dataset.
    """

    def __init__(
        self,
        rag_service,
        project_id: str,
        retrieval_top_k: int = 10,
        max_evidence: int = 5,
    ):

        project_id = (
            project_id.strip()
        )

        if not project_id:
            raise ValueError(
                "project_id cannot be empty."
            )

        if retrieval_top_k <= 0:
            raise ValueError(
                "retrieval_top_k must be "
                "greater than zero."
            )

        if max_evidence <= 0:
            raise ValueError(
                "max_evidence must be "
                "greater than zero."
            )

        self.rag_service = (
            rag_service
        )

        self.project_id = (
            project_id
        )

        self.retrieval_top_k = (
            retrieval_top_k
        )

        self.max_evidence = (
            max_evidence
        )

    def execute(
        self,
        case: GoldenBenchmarkCase,
    ) -> BenchmarkPrediction:

        result = (
            self.rag_service
            .build_evidence_bundle(
                query=(
                    case.research_question
                ),

                claim=(
                    case.claim
                ),

                project_id=(
                    self.project_id
                ),

                claim_id=(
                    case.case_id
                ),

                retrieval_top_k=(
                    self.retrieval_top_k
                ),

                max_evidence=(
                    self.max_evidence
                ),
            )
        )

        return BenchmarkPrediction(
            retrieved_chunk_ids=tuple(
                item.chunk_id
                for item
                in result.retrieval_results
            ),

            predicted_evidence_hashes=tuple(
                evidence.evidence_hash

                for evidence
                in result.evidence_records
            ),

            predicted_citation_keys=tuple(
                citation_evaluation_key(
                    citation
                )

                for citation
                in result.citations
            ),
        )