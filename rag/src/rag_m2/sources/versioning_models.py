from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class SourceRecord:
    id: str
    project_id: str

    canonical_url: str
    title: str
    source_type: str

    created_at: datetime


@dataclass(frozen=True)
class SourceVersionRecord:
    id: str
    source_id: str

    retrieved_at: datetime
    published_at: datetime | None

    final_url: str
    content_hash: str
    storage_uri: str

    http_status: int | None
    content_type: str | None

    parser_version: str

    metadata: dict[str, Any] = field(
        default_factory=dict
    )


@dataclass(frozen=True)
class DocumentRecord:
    id: str
    project_id: str
    source_id: str

    title: str

    created_at: datetime


@dataclass(frozen=True)
class DocumentVersionRecord:
    id: str

    document_id: str
    source_version_id: str

    content_hash: str
    parser_version: str

    extraction_metadata: dict[str, Any]

    ocr_status: str
    page_count: int

    processing_timestamp: datetime

    storage_location: str

    extraction_status: str
    error_code: str | None