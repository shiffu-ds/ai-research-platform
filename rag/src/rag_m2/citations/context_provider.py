from __future__ import annotations

from typing import Protocol
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from rag_m2.citations.models import (
    CitationContext,
)
from rag_m2.config import settings


class CitationContextError(
    RuntimeError
):
    pass


class CitationContextProvider(
    Protocol
):
    def resolve(
        self,
        source_version_id: str,
        document_version_id: str,
    ) -> CitationContext | None:
        ...


class PostgresCitationContextProvider:
    """
    Resolves the immutable provenance chain:

    document_version
        -> document
        -> source_version
        -> source
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

    def resolve(
        self,
        source_version_id: str,
        document_version_id: str,
    ) -> CitationContext | None:

        try:
            source_version_uuid = UUID(
                source_version_id
            )

            document_version_uuid = UUID(
                document_version_id
            )

        except ValueError as exc:
            raise CitationContextError(
                "Citation provenance IDs must "
                "be valid UUID values."
            ) from exc

        sql = """
        SELECT
            s.id AS source_id,

            s.title AS source_title,

            s.canonical_url,

            sv.id AS source_version_id,

            sv.final_url,

            sv.content_hash
                AS source_content_hash,

            sv.storage_uri
                AS snapshot_uri,

            sv.retrieved_at,

            sv.published_at,

            d.id AS document_id,

            d.title AS document_title,

            dv.id AS document_version_id

        FROM m2_document_versions dv

        JOIN m2_documents d
            ON d.id = dv.document_id

        JOIN m2_source_versions sv
            ON sv.id = dv.source_version_id

        JOIN m2_sources s
            ON s.id = sv.source_id
            AND s.id = d.source_id

        WHERE
            dv.id = %(document_version_id)s

            AND sv.id =
                %(source_version_id)s;
        """

        try:

            with self.connect() as connection:

                with connection.cursor() as cursor:

                    cursor.execute(
                        sql,
                        {
                            "source_version_id":
                                source_version_uuid,

                            "document_version_id":
                                document_version_uuid,
                        },
                    )

                    row = cursor.fetchone()

        except Exception as exc:
            raise CitationContextError(
                "Failed to resolve citation "
                f"context: {exc}"
            ) from exc

        if row is None:
            return None

        return CitationContext(
            source_id=str(
                row["source_id"]
            ),

            source_version_id=str(
                row["source_version_id"]
            ),

            source_title=(
                row["source_title"]
            ),

            canonical_url=(
                row["canonical_url"]
            ),

            final_url=(
                row["final_url"]
            ),

            source_content_hash=(
                row[
                    "source_content_hash"
                ]
            ),

            snapshot_uri=(
                row["snapshot_uri"]
            ),

            retrieved_at=(
                row["retrieved_at"]
            ),

            published_at=(
                row["published_at"]
            ),

            document_id=str(
                row["document_id"]
            ),

            document_version_id=str(
                row[
                    "document_version_id"
                ]
            ),

            document_title=(
                row["document_title"]
            ),
        )