from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from rag_m2.config import settings
from rag_m2.retrieval.bm25 import (
    BM25Retriever,
)


class LexicalRetrievalError(
    RuntimeError
):
    pass


@dataclass
class LexicalSearchResult:
    chunk_id: str
    project_id: str
    document_version_id: str

    source_version_id: str | None

    text: str
    page_number: int | None

    score: float

    metadata: dict[str, Any]


class PostgresBM25Retriever:
    """
    BM25 retrieval over the same chunk store
    used by pgvector.

    Security:
    project filtering is performed BEFORE
    BM25 scoring.
    """

    def __init__(
        self,
        database_url: str = settings.database_url,
    ):
        self.database_url = database_url

    def _fetch_project_chunks(
        self,
        project_id: str,
    ) -> list[dict]:

        sql = """
        SELECT
            id,
            project_id,
            document_version_id,
            source_version_id,
            content,
            page_number,
            metadata

        FROM m2_document_chunks

        WHERE project_id = %(project_id)s;
        """

        try:
            with psycopg.connect(
                self.database_url,
                row_factory=dict_row,
            ) as connection:

                with connection.cursor() as cursor:

                    cursor.execute(
                        sql,
                        {
                            "project_id": UUID(
                                project_id
                            )
                        },
                    )

                    rows = cursor.fetchall()

                    return rows

        except Exception as exc:
            raise LexicalRetrievalError(
                f"Unable to load chunks "
                f"for BM25 retrieval: {exc}"
            ) from exc

    def search(
        self,
        query: str,
        project_id: str,
        top_k: int = 50,
    ) -> list[LexicalSearchResult]:

        if not query.strip():
            raise ValueError(
                "Query cannot be empty."
            )

        if top_k <= 0:
            raise ValueError(
                "top_k must be greater than zero."
            )

        rows = self._fetch_project_chunks(
            project_id
        )

        if not rows:
            return []

        documents = [
            (
                str(row["id"]),
                row["content"],
            )
            for row in rows
        ]

        bm25 = BM25Retriever(
            documents
        )

        rankings = bm25.search(
            query,
            top_k=top_k,
        )

        row_map = {
            str(row["id"]): row
            for row in rows
        }

        results: list[
            LexicalSearchResult
        ] = []

        for chunk_id, score in rankings:

            row = row_map[
                chunk_id
            ]

            results.append(
                LexicalSearchResult(
                    chunk_id=chunk_id,
                    project_id=str(
                        row["project_id"]
                    ),
                    document_version_id=str(
                        row[
                            "document_version_id"
                        ]
                    ),
                    source_version_id=(
                        str(
                            row[
                                "source_version_id"
                            ]
                        )
                        if row[
                            "source_version_id"
                        ]
                        else None
                    ),
                    text=row["content"],
                    page_number=(
                        row["page_number"]
                    ),
                    score=float(
                        score
                    ),
                    metadata=(
                        row["metadata"]
                        or {}
                    ),
                )
            )

        return results