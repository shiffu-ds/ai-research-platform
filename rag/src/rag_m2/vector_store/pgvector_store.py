from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from rag_m2.config import settings
from rag_m2.schemas import Chunk
from rag_m2.vector_store.serialization import (
    vector_to_pgvector,
)


class VectorStoreError(RuntimeError):
    pass


@dataclass
class DenseSearchResult:
    chunk_id: str
    project_id: str
    document_version_id: str
    source_version_id: str | None

    text: str
    page_number: int | None

    score: float

    metadata: dict[str, Any]


class PgVectorStore:
    def __init__(
        self,
        database_url: str = settings.database_url,
        embedding_dimensions: int = settings.embedding_dimensions,
    ):
        self.database_url = database_url
        self.embedding_dimensions = embedding_dimensions

    def connect(self):
        return psycopg.connect(
            self.database_url,
            row_factory=dict_row,
        )

    def healthcheck(self) -> bool:
        try:
            with self.connect() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT 1 AS ok;"
                    )

                    row = cursor.fetchone()

                    return (
                        row is not None
                        and row["ok"] == 1
                    )

        except Exception:
            return False

    def upsert_chunk(
        self,
        chunk: Chunk,
        embedding: list[float],
        source_version_id: str | None = None,
        embedding_model: str = settings.embedding_model,
    ) -> None:
        vector = vector_to_pgvector(
            embedding,
            expected_dimensions=self.embedding_dimensions,
        )

        parameters = {
            "id": UUID(chunk.id),
            "project_id": UUID(
                chunk.project_id
            ),
            "document_version_id": UUID(
                chunk.document_version_id
            ),
            "source_version_id": (
                UUID(source_version_id)
                if source_version_id
                else None
            ),
            "chunk_index": chunk.chunk_index,
            "page_number": chunk.page_number,
            "content": chunk.text,
            "token_count": chunk.token_count,
            "metadata": Jsonb(
                chunk.metadata
            ),
            "embedding": vector,
            "embedding_model": embedding_model,
        }

        sql = """
        INSERT INTO m2_document_chunks (
            id,
            project_id,
            document_version_id,
            source_version_id,
            chunk_index,
            page_number,
            content,
            token_count,
            metadata,
            embedding,
            embedding_model
        )
        VALUES (
            %(id)s,
            %(project_id)s,
            %(document_version_id)s,
            %(source_version_id)s,
            %(chunk_index)s,
            %(page_number)s,
            %(content)s,
            %(token_count)s,
            %(metadata)s,
            %(embedding)s::halfvec,
            %(embedding_model)s
        )

        ON CONFLICT (id)
        DO UPDATE SET
            project_id = EXCLUDED.project_id,
            document_version_id = EXCLUDED.document_version_id,
            source_version_id = EXCLUDED.source_version_id,
            chunk_index = EXCLUDED.chunk_index,
            page_number = EXCLUDED.page_number,
            content = EXCLUDED.content,
            token_count = EXCLUDED.token_count,
            metadata = EXCLUDED.metadata,
            embedding = EXCLUDED.embedding,
            embedding_model = EXCLUDED.embedding_model;
        """

        try:
            with self.connect() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        sql,
                        parameters,
                    )

                connection.commit()

        except Exception as exc:
            raise VectorStoreError(
                f"Failed to store chunk: {exc}"
            ) from exc

    def dense_search(
        self,
        query_embedding: list[float],
        project_id: str,
        top_k: int = 50,
    ) -> list[DenseSearchResult]:
        if top_k <= 0:
            raise ValueError(
                "top_k must be greater than zero."
            )

        query_vector = vector_to_pgvector(
            query_embedding,
            expected_dimensions=self.embedding_dimensions,
        )

        parameters = {
            "project_id": UUID(
                project_id
            ),
            "query_embedding": query_vector,
            "top_k": top_k,
        }

        sql = """
        SELECT
            id,
            project_id,
            document_version_id,
            source_version_id,
            content,
            page_number,
            metadata,

            1 - (
                embedding
                <=>
                %(query_embedding)s::halfvec
            ) AS similarity

        FROM m2_document_chunks

        WHERE project_id = %(project_id)s
          AND embedding IS NOT NULL

        ORDER BY
            embedding
            <=>
            %(query_embedding)s::halfvec

        LIMIT %(top_k)s;
        """

        try:
            with self.connect() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        sql,
                        parameters,
                    )

                    rows = cursor.fetchall()

        except Exception as exc:
            raise VectorStoreError(
                f"Dense retrieval failed: {exc}"
            ) from exc

        results: list[
            DenseSearchResult
        ] = []

        for row in rows:
            results.append(
                DenseSearchResult(
                    chunk_id=str(
                        row["id"]
                    ),
                    project_id=str(
                        row["project_id"]
                    ),
                    document_version_id=str(
                        row["document_version_id"]
                    ),
                    source_version_id=(
                        str(
                            row["source_version_id"]
                        )
                        if row["source_version_id"]
                        else None
                    ),
                    text=row["content"],
                    page_number=row["page_number"],
                    score=float(
                        row["similarity"]
                    ),
                    metadata=(
                        row["metadata"]
                        or {}
                    ),
                )
            )

        return results

    def delete_chunk(
        self,
        chunk_id: str,
    ) -> None:
        with self.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE
                    FROM m2_document_chunks
                    WHERE id = %(id)s;
                    """,
                    {
                        "id": UUID(
                            chunk_id
                        )
                    },
                )

            connection.commit()