from __future__ import annotations

from dataclasses import dataclass
from datetime import (
    datetime,
    timezone,
)
from typing import Sequence
from uuid import (
    UUID,
    uuid4,
)

import psycopg
from psycopg.rows import dict_row

from rag_m2.config import settings
from rag_m2.schemas import (
    RetrievalResult,
)
from rag_m2.utils.hashing import (
    sha256_text,
)


class RetrievalProvenanceError(
    RuntimeError
):
    pass


@dataclass(frozen=True)
class RetrievalRunRecord:
    id: str
    project_id: str
    query_hash: str
    requested_top_k: int
    created_at: datetime


@dataclass(frozen=True)
class PersistedRetrievalResult:
    id: str
    retrieval_run_id: str

    document_chunk_id: str

    retrieval_method: str
    rank: int
    score: float

    retrieval_timestamp: datetime

    query_hash: str

    reranker_version: str | None
    embedding_model: str | None


@dataclass(frozen=True)
class RetrievalProvenanceAudit:
    run_id: str

    result_count: int

    complete_result_count: int

    broken_chain_count: int

    query_hash_consistent: bool

    is_complete: bool


class PostgresRetrievalProvenanceRepository:
    """
    M2 local/reference implementation of
    retrieval provenance persistence.

    Production persistence/migrations remain
    an M3 responsibility.
    """

    def __init__(
        self,
        database_url: str = (
            settings.database_url
        ),
    ):
        self.database_url = (
            database_url
        )

    def connect(self):
        return psycopg.connect(
            self.database_url,
            row_factory=dict_row,
        )

    @staticmethod
    def _validate_results(
        query_hash: str,
        results: Sequence[
            RetrievalResult
        ],
    ) -> None:

        seen_ranks: set[int] = set()

        seen_chunks: set[str] = set()

        allowed_methods = {
            "dense",
            "lexical",
            "fused",
        }

        for result in results:

            if (
                result.query_hash
                != query_hash
            ):
                raise RetrievalProvenanceError(
                    "Retrieval result query_hash "
                    "does not match retrieval run."
                )

            if result.rank <= 0:
                raise RetrievalProvenanceError(
                    "Retrieval rank must be "
                    "greater than zero."
                )

            if result.rank in seen_ranks:
                raise RetrievalProvenanceError(
                    "Duplicate retrieval rank "
                    "detected."
                )

            seen_ranks.add(
                result.rank
            )

            if result.chunk_id in seen_chunks:
                raise RetrievalProvenanceError(
                    "Duplicate chunk detected "
                    "inside retrieval run."
                )

            seen_chunks.add(
                result.chunk_id
            )

            if (
                result.retrieval_method
                not in allowed_methods
            ):
                raise RetrievalProvenanceError(
                    "Unsupported retrieval "
                    f"method: "
                    f"{result.retrieval_method}"
                )

            try:
                UUID(
                    result.chunk_id
                )

            except ValueError as exc:
                raise RetrievalProvenanceError(
                    "Persisted document_chunk_id "
                    "must be a valid UUID."
                ) from exc

    def persist(
        self,
        project_id: str,
        query: str,
        requested_top_k: int,
        results: Sequence[
            RetrievalResult
        ],
    ) -> RetrievalRunRecord:

        project_id = (
            project_id.strip()
        )

        query = query.strip()

        if not project_id:
            raise ValueError(
                "project_id cannot be empty."
            )

        if not query:
            raise ValueError(
                "query cannot be empty."
            )

        if requested_top_k <= 0:
            raise ValueError(
                "requested_top_k must be "
                "greater than zero."
            )

        try:
            project_uuid = UUID(
                project_id
            )

        except ValueError as exc:
            raise ValueError(
                "project_id must be a UUID."
            ) from exc

        query_hash = sha256_text(
            query
        )

        self._validate_results(
            query_hash=query_hash,
            results=results,
        )

        run_id = uuid4()

        created_at = datetime.now(
            timezone.utc
        )

        try:

            with self.connect() as connection:

                with connection.cursor() as cursor:

                    cursor.execute(
                        """
                        INSERT INTO
                            m2_retrieval_runs (
                                id,
                                project_id,
                                query_hash,
                                requested_top_k,
                                created_at
                            )
                        VALUES (
                            %(id)s,
                            %(project_id)s,
                            %(query_hash)s,
                            %(requested_top_k)s,
                            %(created_at)s
                        );
                        """,
                        {
                            "id":
                                run_id,

                            "project_id":
                                project_uuid,

                            "query_hash":
                                query_hash,

                            "requested_top_k":
                                requested_top_k,

                            "created_at":
                                created_at,
                        },
                    )

                    for result in results:

                        cursor.execute(
                            """
                            INSERT INTO
                                m2_retrieval_results (
                                    id,
                                    retrieval_run_id,
                                    document_chunk_id,
                                    retrieval_method,
                                    rank,
                                    score,
                                    retrieval_timestamp,
                                    query_hash,
                                    reranker_version,
                                    embedding_model
                                )
                            VALUES (
                                %(id)s,
                                %(retrieval_run_id)s,
                                %(document_chunk_id)s,
                                %(retrieval_method)s,
                                %(rank)s,
                                %(score)s,
                                %(retrieval_timestamp)s,
                                %(query_hash)s,
                                %(reranker_version)s,
                                %(embedding_model)s
                            );
                            """,
                            {
                                "id":
                                    uuid4(),

                                "retrieval_run_id":
                                    run_id,

                                "document_chunk_id":
                                    UUID(
                                        result.chunk_id
                                    ),

                                "retrieval_method":
                                    result
                                    .retrieval_method,

                                "rank":
                                    result.rank,

                                "score":
                                    float(
                                        result.score
                                    ),

                                "retrieval_timestamp":
                                    result
                                    .retrieval_timestamp,

                                "query_hash":
                                    result
                                    .query_hash,

                                "reranker_version":
                                    result
                                    .reranker_version,

                                "embedding_model":
                                    result
                                    .embedding_model,
                            },
                        )

                connection.commit()

        except Exception as exc:

            raise RetrievalProvenanceError(
                "Failed to persist retrieval "
                f"provenance: {exc}"
            ) from exc

        return RetrievalRunRecord(
            id=str(
                run_id
            ),

            project_id=(
                project_id
            ),

            query_hash=(
                query_hash
            ),

            requested_top_k=(
                requested_top_k
            ),

            created_at=(
                created_at
            ),
        )

    def get_results(
        self,
        run_id: str,
    ) -> list[
        PersistedRetrievalResult
    ]:

        run_uuid = UUID(
            run_id
        )

        with self.connect() as connection:

            with connection.cursor() as cursor:

                cursor.execute(
                    """
                    SELECT
                        id,
                        retrieval_run_id,
                        document_chunk_id,
                        retrieval_method,
                        rank,
                        score,
                        retrieval_timestamp,
                        query_hash,
                        reranker_version,
                        embedding_model

                    FROM m2_retrieval_results

                    WHERE retrieval_run_id =
                        %(run_id)s

                    ORDER BY rank ASC;
                    """,
                    {
                        "run_id":
                            run_uuid
                    },
                )

                rows = cursor.fetchall()

        return [
            PersistedRetrievalResult(
                id=str(
                    row["id"]
                ),

                retrieval_run_id=str(
                    row[
                        "retrieval_run_id"
                    ]
                ),

                document_chunk_id=str(
                    row[
                        "document_chunk_id"
                    ]
                ),

                retrieval_method=row[
                    "retrieval_method"
                ],

                rank=row[
                    "rank"
                ],

                score=float(
                    row["score"]
                ),

                retrieval_timestamp=row[
                    "retrieval_timestamp"
                ],

                query_hash=row[
                    "query_hash"
                ],

                reranker_version=row[
                    "reranker_version"
                ],

                embedding_model=row[
                    "embedding_model"
                ],
            )

            for row in rows
        ]

    def audit(
        self,
        run_id: str,
    ) -> RetrievalProvenanceAudit:

        run_uuid = UUID(
            run_id
        )

        with self.connect() as connection:

            with connection.cursor() as cursor:

                cursor.execute(
                    """
                    SELECT
                        id,
                        query_hash

                    FROM m2_retrieval_runs

                    WHERE id = %(run_id)s;
                    """,
                    {
                        "run_id":
                            run_uuid
                    },
                )

                run = cursor.fetchone()

                if run is None:
                    raise RetrievalProvenanceError(
                        "Retrieval run does not "
                        "exist."
                    )

                cursor.execute(
                    """
                    SELECT
                        rr.retrieval_method,
                        rr.rank,
                        rr.score,
                        rr.retrieval_timestamp,

                        rr.query_hash
                            AS result_query_hash,

                        rr.reranker_version,
                        rr.embedding_model,

                        c.id
                            AS chunk_id,

                        c.document_version_id
                            AS chunk_document_version_id,

                        c.source_version_id
                            AS chunk_source_version_id,

                        dv.id
                            AS document_version_id,

                        dv.source_version_id
                            AS document_source_version_id,

                        d.id
                            AS document_id,

                        d.source_id
                            AS document_source_id,

                        sv.id
                            AS source_version_id,

                        sv.source_id
                            AS version_source_id,

                        s.id
                            AS source_id

                    FROM m2_retrieval_results rr

                    LEFT JOIN m2_document_chunks c
                        ON c.id =
                            rr.document_chunk_id

                    LEFT JOIN m2_document_versions dv
                        ON dv.id =
                            c.document_version_id

                    LEFT JOIN m2_documents d
                        ON d.id =
                            dv.document_id

                    LEFT JOIN m2_source_versions sv
                        ON sv.id =
                            dv.source_version_id

                    LEFT JOIN m2_sources s
                        ON s.id =
                            sv.source_id

                    WHERE rr.retrieval_run_id =
                        %(run_id)s

                    ORDER BY rr.rank ASC;
                    """,
                    {
                        "run_id":
                            run_uuid
                    },
                )

                rows = cursor.fetchall()

        complete_count = 0

        broken_chain_count = 0

        query_hash_consistent = True

        run_query_hash = (
            run["query_hash"]
        )

        for row in rows:

            query_ok = (
                row[
                    "result_query_hash"
                ]
                == run_query_hash
            )

            if not query_ok:
                query_hash_consistent = (
                    False
                )

            fields_ok = all(
                [
                    row[
                        "retrieval_method"
                    ],

                    (
                        row["rank"]
                        is not None
                    ),

                    (
                        row["score"]
                        is not None
                    ),

                    (
                        row[
                            "retrieval_timestamp"
                        ]
                        is not None
                    ),

                    row[
                        "result_query_hash"
                    ],

                    row[
                        "embedding_model"
                    ],
                ]
            )

            chain_values = [
                row[
                    "chunk_id"
                ],

                row[
                    "chunk_document_version_id"
                ],

                row[
                    "chunk_source_version_id"
                ],

                row[
                    "document_version_id"
                ],

                row[
                    "document_source_version_id"
                ],

                row[
                    "document_id"
                ],

                row[
                    "document_source_id"
                ],

                row[
                    "source_version_id"
                ],

                row[
                    "version_source_id"
                ],

                row[
                    "source_id"
                ],
            ]

            chain_ok = all(
                value is not None
                for value
                in chain_values
            )

            if chain_ok:

                chain_ok = (
                    row[
                        "chunk_document_version_id"
                    ]
                    == row[
                        "document_version_id"
                    ]
                    and
                    row[
                        "chunk_source_version_id"
                    ]
                    == row[
                        "source_version_id"
                    ]
                    and
                    row[
                        "document_source_version_id"
                    ]
                    == row[
                        "source_version_id"
                    ]
                    and
                    row[
                        "document_source_id"
                    ]
                    == row[
                        "source_id"
                    ]
                    and
                    row[
                        "version_source_id"
                    ]
                    == row[
                        "source_id"
                    ]
                )

            if not chain_ok:
                broken_chain_count += 1

            if (
                fields_ok
                and chain_ok
                and query_ok
            ):
                complete_count += 1

        result_count = len(
            rows
        )

        return RetrievalProvenanceAudit(
            run_id=(
                run_id
            ),

            result_count=(
                result_count
            ),

            complete_result_count=(
                complete_count
            ),

            broken_chain_count=(
                broken_chain_count
            ),

            query_hash_consistent=(
                query_hash_consistent
            ),

            is_complete=(
                complete_count
                == result_count
                and
                broken_chain_count == 0
                and
                query_hash_consistent
            ),
        )

    def delete_run(
        self,
        run_id: str,
    ) -> None:

        with self.connect() as connection:

            with connection.cursor() as cursor:

                cursor.execute(
                    """
                    DELETE FROM
                        m2_retrieval_runs

                    WHERE id = %(run_id)s;
                    """,
                    {
                        "run_id":
                            UUID(
                                run_id
                            )
                    },
                )

            connection.commit()