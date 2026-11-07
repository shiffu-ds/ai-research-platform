from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from rag_m2.sources.fetcher import (
    SourceFetcher,
)
from rag_m2.sources.snapshot_store import (
    SnapshotStore,
)
from rag_m2.sources.version_repository import (
    VersionRepository,
)
from rag_m2.sources.versioning_models import (
    SourceRecord,
    SourceVersionRecord,
)
from rag_m2.utils.hashing import (
    sha256_bytes,
)


class SourceIngestionError(
    RuntimeError
):
    pass


@dataclass(frozen=True)
class SourceIngestionResult:
    source: SourceRecord
    source_version: SourceVersionRecord


class SourceIngestionService:
    """
    Converts a fetched external source into an
    immutable source-version snapshot.
    """

    def __init__(
        self,
        repository: VersionRepository,
        fetcher: SourceFetcher,
        snapshot_store: SnapshotStore,
        parser_version: str = "m2-source-ingestion-v1",
    ):
        self.repository = repository
        self.fetcher = fetcher
        self.snapshot_store = snapshot_store
        self.parser_version = parser_version

    def ingest(
        self,
        project_id: str,
        url: str,
        title: str,
        source_type: str = "web",
        metadata: dict[str, Any] | None = None,
    ) -> SourceIngestionResult:

        if not project_id.strip():
            raise ValueError(
                "project_id cannot be empty."
            )

        if not url.strip():
            raise ValueError(
                "url cannot be empty."
            )

        if not title.strip():
            raise ValueError(
                "title cannot be empty."
            )

        # ----------------------------------
        # 1. Fetch through security boundary
        # ----------------------------------

        try:
            fetched = self.fetcher.fetch(
                url
            )

        except Exception as exc:
            raise SourceIngestionError(
                f"Source fetch failed: {exc}"
            ) from exc

        if not fetched.content:
            raise SourceIngestionError(
                "Fetched source contained no data."
            )

        # ----------------------------------
        # 2. Hash exact raw bytes
        # ----------------------------------

        content_hash = sha256_bytes(
            fetched.content
        )

        # ----------------------------------
        # 3. Create/reuse logical source
        # ----------------------------------

        source = (
            self.repository.create_source(
                project_id=project_id,
                canonical_url=url,
                title=title,
                source_type=source_type,
            )
        )

        # ----------------------------------
        # 4. Persist immutable snapshot
        # ----------------------------------

        try:
            storage_uri = (
                self.snapshot_store.save(
                    project_id=project_id,
                    source_id=source.id,
                    content_hash=content_hash,
                    content=fetched.content,
                )
            )

        except Exception as exc:
            raise SourceIngestionError(
                f"Snapshot storage failed: {exc}"
            ) from exc

        # ----------------------------------
        # 5. Preserve source metadata
        # ----------------------------------

        version_metadata = dict(
            metadata or {}
        )

        version_metadata.update(
            {
                "requested_url":
                    fetched.requested_url,

                "final_url":
                    fetched.final_url,
            }
        )

        # ----------------------------------
        # 6. Create immutable SourceVersion
        # ----------------------------------

        source_version = (
            self.repository.create_source_version(
                source_id=source.id,

                content_hash=content_hash,

                final_url=(
                    fetched.final_url
                ),

                storage_uri=(
                    storage_uri
                ),

                parser_version=(
                    self.parser_version
                ),

                retrieved_at=(
                    fetched.retrieved_at
                ),

                published_at=(
                    fetched.published_at
                ),

                http_status=(
                    fetched.http_status
                ),

                content_type=(
                    fetched.content_type
                ),

                metadata=(
                    version_metadata
                ),
            )
        )

        return SourceIngestionResult(
            source=source,
            source_version=source_version,
        )