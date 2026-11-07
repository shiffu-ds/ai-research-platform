from __future__ import annotations

from typing import Protocol

from rag_m2.schemas import (
    RetrievalResult,
)


class RetrievalProvenanceWriter(
    Protocol
):
    def persist(
        self,
        project_id: str,
        query: str,
        requested_top_k: int,
        results: list[
            RetrievalResult
        ],
    ):
        ...


class PersistingRetriever:
    """
    Decorator around an existing retriever.

    Retrieval behavior remains owned by the
    wrapped retriever.

    This class adds persistence without coupling
    HybridRetriever directly to PostgreSQL.
    """

    def __init__(
        self,
        retriever,
        provenance_repository: (
            RetrievalProvenanceWriter
        ),
    ):
        self.retriever = (
            retriever
        )

        self.provenance_repository = (
            provenance_repository
        )

    def retrieve(
        self,
        query: str,
        project_id: str,
        top_k: int,
    ) -> list[
        RetrievalResult
    ]:

        results = (
            self.retriever.retrieve(
                query=query,
                project_id=project_id,
                top_k=top_k,
            )
        )

        run = (
            self.provenance_repository
            .persist(
                project_id=project_id,
                query=query,
                requested_top_k=top_k,
                results=results,
            )
        )

        for result in results:

            result.retrieval_run_id = (
                run.id
            )

        return results