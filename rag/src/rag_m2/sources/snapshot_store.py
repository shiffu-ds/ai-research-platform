from __future__ import annotations

from pathlib import Path
from typing import Protocol


class SnapshotStore(Protocol):
    def save(
        self,
        project_id: str,
        source_id: str,
        content_hash: str,
        content: bytes,
    ) -> str:
        ...


class LocalSnapshotStore:
    """
    Local-development snapshot store.

    Production storage can later be replaced by
    private object storage without changing the
    ingestion service.
    """

    def __init__(
        self,
        root_directory: str | Path,
    ):
        self.root_directory = Path(
            root_directory
        )

    def save(
        self,
        project_id: str,
        source_id: str,
        content_hash: str,
        content: bytes,
    ) -> str:

        if not content:
            raise ValueError(
                "Cannot store an empty source snapshot."
            )

        target_directory = (
            self.root_directory
            / project_id
            / source_id
        )

        target_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        target_file = (
            target_directory
            / f"{content_hash}.bin"
        )

        # Content-addressed snapshot.
        # Existing identical content is not rewritten.
        if not target_file.exists():
            target_file.write_bytes(
                content
            )

        return target_file.resolve().as_uri()