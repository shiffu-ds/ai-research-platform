from datetime import (
    datetime,
    timezone,
)
import uuid

from rag_m2.sources.fetcher import (
    FetchedSource,
)
from rag_m2.sources.ingestion_service import (
    SourceIngestionService,
)
from rag_m2.sources.snapshot_store import (
    LocalSnapshotStore,
)
from rag_m2.sources.version_repository import (
    VersionRepository,
)
from rag_m2.utils.hashing import (
    sha256_bytes,
)


class FakeFetcher:
    def __init__(
        self,
        content: bytes,
    ):
        self.content = content

    def fetch(
        self,
        url: str,
    ) -> FetchedSource:

        return FetchedSource(
            requested_url=url,
            final_url=url,
            content=self.content,
            http_status=200,
            content_type="text/html",
            retrieved_at=datetime.now(
                timezone.utc
            ),
        )


def test_source_ingestion_creates_snapshot(
    tmp_path,
):
    repository = VersionRepository()

    project_id = str(
        uuid.uuid4()
    )

    content = (
        b"<html>research evidence</html>"
    )

    service = SourceIngestionService(
        repository=repository,

        fetcher=FakeFetcher(
            content
        ),

        snapshot_store=(
            LocalSnapshotStore(
                tmp_path
            )
        ),
    )

    result = None

    try:
        result = service.ingest(
            project_id=project_id,

            url=(
                "https://example.com/research"
            ),

            title="Research Source",
        )

        assert (
            result.source.project_id
            == project_id
        )

        assert (
            result.source_version.content_hash
            == sha256_bytes(
                content
            )
        )

        assert (
            result.source_version.http_status
            == 200
        )

        assert (
            result.source_version.content_type
            == "text/html"
        )

        assert (
            result.source_version.storage_uri
            .startswith("file:")
        )

    finally:
        if result is not None:
            repository.delete_source(
                result.source.id
            )


def test_changed_content_creates_new_source_version(
    tmp_path,
):
    repository = VersionRepository()

    project_id = str(
        uuid.uuid4()
    )

    snapshot_store = (
        LocalSnapshotStore(
            tmp_path
        )
    )

    service_v1 = (
        SourceIngestionService(
            repository=repository,

            fetcher=FakeFetcher(
                b"version one"
            ),

            snapshot_store=(
                snapshot_store
            ),
        )
    )

    service_v2 = (
        SourceIngestionService(
            repository=repository,

            fetcher=FakeFetcher(
                b"version two"
            ),

            snapshot_store=(
                snapshot_store
            ),
        )
    )

    first = None

    try:
        first = service_v1.ingest(
            project_id=project_id,

            url=(
                "https://example.com/changing"
            ),

            title="Changing Source",
        )

        second = service_v2.ingest(
            project_id=project_id,

            url=(
                "https://example.com/changing"
            ),

            title="Changing Source",
        )

        # Logical source stays the same.
        assert (
            first.source.id
            == second.source.id
        )

        # But observations are immutable versions.
        assert (
            first.source_version.id
            != second.source_version.id
        )

        assert (
            first.source_version.content_hash
            != second.source_version.content_hash
        )

    finally:
        if first is not None:
            repository.delete_source(
                first.source.id
            )