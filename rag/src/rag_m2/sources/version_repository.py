from __future__ import annotations

from datetime import datetime, timezone
from string import hexdigits
from typing import Any
from uuid import UUID, uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from rag_m2.config import settings
from rag_m2.sources.versioning_models import (
    DocumentRecord,
    DocumentVersionRecord,
    SourceRecord,
    SourceVersionRecord,
)


class VersionRepositoryError(RuntimeError):
    pass


def _validate_sha256(value: str) -> None:
    if len(value) != 64:
        raise ValueError(
            "SHA-256 hash must contain 64 characters."
        )

    if any(
        character not in hexdigits
        for character in value
    ):
        raise ValueError(
            "Invalid SHA-256 hexadecimal value."
        )


class VersionRepository:
    """
    Local M2 repository for immutable
    source/document provenance.

    Final production persistence and migrations
    are integrated with M3.
    """

    def __init__(
        self,
        database_url: str = settings.database_url,
    ):
        self.database_url = database_url

    def connect(self):
        return psycopg.connect(
            self.database_url,
            row_factory=dict_row,
        )

    # --------------------------------------------------
    # Logical source
    # --------------------------------------------------

    def create_source(
        self,
        project_id: str,
        canonical_url: str,
        title: str,
        source_type: str = "web",
    ) -> SourceRecord:

        if not canonical_url.strip():
            raise ValueError(
                "canonical_url cannot be empty."
            )

        if not title.strip():
            raise ValueError(
                "title cannot be empty."
            )

        source_id = uuid4()

        sql = """
        INSERT INTO m2_sources (
            id,
            project_id,
            canonical_url,
            title,
            source_type
        )
        VALUES (
            %(id)s,
            %(project_id)s,
            %(canonical_url)s,
            %(title)s,
            %(source_type)s
        )

        ON CONFLICT (
            project_id,
            canonical_url
        )
        DO UPDATE SET
            title = EXCLUDED.title,
            source_type = EXCLUDED.source_type

        RETURNING *;
        """

        try:
            with self.connect() as connection:
                with connection.cursor() as cursor:

                    cursor.execute(
                        sql,
                        {
                            "id": source_id,
                            "project_id": UUID(
                                project_id
                            ),
                            "canonical_url": (
                                canonical_url.strip()
                            ),
                            "title": title.strip(),
                            "source_type": (
                                source_type.strip()
                            ),
                        },
                    )

                    row = cursor.fetchone()

        except Exception as exc:
            raise VersionRepositoryError(
                f"Failed to create source: {exc}"
            ) from exc

        return SourceRecord(
            id=str(row["id"]),
            project_id=str(
                row["project_id"]
            ),
            canonical_url=row[
                "canonical_url"
            ],
            title=row["title"],
            source_type=row[
                "source_type"
            ],
            created_at=row[
                "created_at"
            ],
        )

    # --------------------------------------------------
    # Immutable source version
    # --------------------------------------------------

    def create_source_version(
        self,
        source_id: str,
        content_hash: str,
        final_url: str,
        storage_uri: str,
        parser_version: str,
        retrieved_at: datetime | None = None,
        published_at: datetime | None = None,
        http_status: int | None = None,
        content_type: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> SourceVersionRecord:

        _validate_sha256(
            content_hash
        )

        retrieved_at = (
            retrieved_at
            or datetime.now(
                timezone.utc
            )
        )

        version_id = uuid4()

        sql = """
        INSERT INTO m2_source_versions (
            id,
            source_id,
            retrieved_at,
            published_at,
            final_url,
            content_hash,
            storage_uri,
            http_status,
            content_type,
            parser_version,
            metadata
        )
        VALUES (
            %(id)s,
            %(source_id)s,
            %(retrieved_at)s,
            %(published_at)s,
            %(final_url)s,
            %(content_hash)s,
            %(storage_uri)s,
            %(http_status)s,
            %(content_type)s,
            %(parser_version)s,
            %(metadata)s
        )
        RETURNING *;
        """

        try:
            with self.connect() as connection:
                with connection.cursor() as cursor:

                    cursor.execute(
                        sql,
                        {
                            "id": version_id,
                            "source_id": UUID(
                                source_id
                            ),
                            "retrieved_at": (
                                retrieved_at
                            ),
                            "published_at": (
                                published_at
                            ),
                            "final_url": (
                                final_url
                            ),
                            "content_hash": (
                                content_hash
                            ),
                            "storage_uri": (
                                storage_uri
                            ),
                            "http_status": (
                                http_status
                            ),
                            "content_type": (
                                content_type
                            ),
                            "parser_version": (
                                parser_version
                            ),
                            "metadata": Jsonb(
                                metadata or {}
                            ),
                        },
                    )

                    row = cursor.fetchone()

        except Exception as exc:
            raise VersionRepositoryError(
                "Failed to create immutable "
                f"source version: {exc}"
            ) from exc

        return SourceVersionRecord(
            id=str(row["id"]),
            source_id=str(
                row["source_id"]
            ),
            retrieved_at=row[
                "retrieved_at"
            ],
            published_at=row[
                "published_at"
            ],
            final_url=row[
                "final_url"
            ],
            content_hash=row[
                "content_hash"
            ],
            storage_uri=row[
                "storage_uri"
            ],
            http_status=row[
                "http_status"
            ],
            content_type=row[
                "content_type"
            ],
            parser_version=row[
                "parser_version"
            ],
            metadata=row[
                "metadata"
            ] or {},
        )

    # --------------------------------------------------
    # Logical document
    # --------------------------------------------------

    def create_document(
        self,
        project_id: str,
        source_id: str,
        title: str,
    ) -> DocumentRecord:

        document_id = uuid4()

        sql = """
        INSERT INTO m2_documents (
            id,
            project_id,
            source_id,
            title
        )
        VALUES (
            %(id)s,
            %(project_id)s,
            %(source_id)s,
            %(title)s
        )
        RETURNING *;
        """

        try:
            with self.connect() as connection:
                with connection.cursor() as cursor:

                    cursor.execute(
                        sql,
                        {
                            "id": document_id,
                            "project_id": UUID(
                                project_id
                            ),
                            "source_id": UUID(
                                source_id
                            ),
                            "title": title.strip(),
                        },
                    )

                    row = cursor.fetchone()

        except Exception as exc:
            raise VersionRepositoryError(
                f"Failed to create document: {exc}"
            ) from exc

        return DocumentRecord(
            id=str(row["id"]),
            project_id=str(
                row["project_id"]
            ),
            source_id=str(
                row["source_id"]
            ),
            title=row["title"],
            created_at=row[
                "created_at"
            ],
        )

    # --------------------------------------------------
    # Immutable document version
    # --------------------------------------------------

    def create_document_version(
        self,
        document_id: str,
        source_version_id: str,
        content_hash: str,
        parser_version: str,
        page_count: int,
        storage_location: str,
        extraction_metadata: (
            dict[str, Any] | None
        ) = None,
        ocr_status: str = "NOT_REQUIRED",
        extraction_status: str = "COMPLETE",
        error_code: str | None = None,
        processing_timestamp: (
            datetime | None
        ) = None,
    ) -> DocumentVersionRecord:

        _validate_sha256(
            content_hash
        )

        if page_count < 0:
            raise ValueError(
                "page_count cannot be negative."
            )

        processing_timestamp = (
            processing_timestamp
            or datetime.now(
                timezone.utc
            )
        )

        version_id = uuid4()

        sql = """
        INSERT INTO m2_document_versions (
            id,
            document_id,
            source_version_id,
            content_hash,
            parser_version,
            extraction_metadata,
            ocr_status,
            page_count,
            processing_timestamp,
            storage_location,
            extraction_status,
            error_code
        )
        VALUES (
            %(id)s,
            %(document_id)s,
            %(source_version_id)s,
            %(content_hash)s,
            %(parser_version)s,
            %(extraction_metadata)s,
            %(ocr_status)s,
            %(page_count)s,
            %(processing_timestamp)s,
            %(storage_location)s,
            %(extraction_status)s,
            %(error_code)s
        )
        RETURNING *;
        """

        try:
            with self.connect() as connection:
                with connection.cursor() as cursor:

                    cursor.execute(
                        sql,
                        {
                            "id": version_id,
                            "document_id": UUID(
                                document_id
                            ),
                            "source_version_id": UUID(
                                source_version_id
                            ),
                            "content_hash": (
                                content_hash
                            ),
                            "parser_version": (
                                parser_version
                            ),
                            "extraction_metadata": Jsonb(
                                extraction_metadata
                                or {}
                            ),
                            "ocr_status": (
                                ocr_status
                            ),
                            "page_count": (
                                page_count
                            ),
                            "processing_timestamp": (
                                processing_timestamp
                            ),
                            "storage_location": (
                                storage_location
                            ),
                            "extraction_status": (
                                extraction_status
                            ),
                            "error_code": (
                                error_code
                            ),
                        },
                    )

                    row = cursor.fetchone()

        except Exception as exc:
            raise VersionRepositoryError(
                "Failed to create immutable "
                f"document version: {exc}"
            ) from exc

        return DocumentVersionRecord(
            id=str(row["id"]),
            document_id=str(
                row["document_id"]
            ),
            source_version_id=str(
                row["source_version_id"]
            ),
            content_hash=row[
                "content_hash"
            ],
            parser_version=row[
                "parser_version"
            ],
            extraction_metadata=row[
                "extraction_metadata"
            ] or {},
            ocr_status=row[
                "ocr_status"
            ],
            page_count=row[
                "page_count"
            ],
            processing_timestamp=row[
                "processing_timestamp"
            ],
            storage_location=row[
                "storage_location"
            ],
            extraction_status=row[
                "extraction_status"
            ],
            error_code=row[
                "error_code"
            ],
        )

    # --------------------------------------------------
    # Cleanup for integration tests
    # --------------------------------------------------

    def delete_source(
        self,
        source_id: str,
    ) -> None:
        """
        Development/test cleanup helper.

        Deletes dependent records in the correct
        foreign-key order.

        This is not the normal production workflow
        for immutable provenance records.
        """

        source_uuid = UUID(
            source_id
        )

        with self.connect() as connection:
            with connection.cursor() as cursor:

                                # ----------------------------------
                # 0. Indexed document chunks
                # ----------------------------------

                cursor.execute(
                    """
                    DELETE FROM m2_document_chunks
                    WHERE document_version_id IN (
                        SELECT dv.id
                        FROM m2_document_versions dv
                        JOIN m2_documents d
                            ON d.id = dv.document_id
                        WHERE d.source_id = %(source_id)s
                    )
                    OR source_version_id IN (
                        SELECT id
                        FROM m2_source_versions
                        WHERE source_id = %(source_id)s
                    );
                    """,
                    {
                        "source_id": source_uuid
                    },
                )

                # ----------------------------------
                # 1. Document versions
                # ----------------------------------

                cursor.execute(
                    """
                    DELETE FROM m2_document_versions
                    WHERE source_version_id IN (
                        SELECT id
                        FROM m2_source_versions
                        WHERE source_id = %(source_id)s
                    );
                    """,
                    {
                        "source_id": source_uuid
                    },
                )

                # ----------------------------------
                # 2. Logical documents
                # ----------------------------------

                cursor.execute(
                    """
                    DELETE FROM m2_documents
                    WHERE source_id = %(source_id)s;
                    """,
                    {
                        "source_id": source_uuid
                    },
                )

                # ----------------------------------
                # 3. Source versions
                # ----------------------------------

                cursor.execute(
                    """
                    DELETE FROM m2_source_versions
                    WHERE source_id = %(source_id)s;
                    """,
                    {
                        "source_id": source_uuid
                    },
                )

                # ----------------------------------
                # 4. Logical source
                # ----------------------------------

                cursor.execute(
                    """
                    DELETE FROM m2_sources
                    WHERE id = %(source_id)s;
                    """,
                    {
                        "source_id": source_uuid
                    },
                )

            connection.commit()