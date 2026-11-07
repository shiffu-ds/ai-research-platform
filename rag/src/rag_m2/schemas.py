from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
import uuid


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class PageText:
    page_number: int
    text: str

    text_coverage: float = 1.0

    ocr_used: bool = False
    ocr_confidence: float | None = None
    ocr_status: str = "NOT_REQUIRED"

    error_code: str | None = None


@dataclass
class Chunk:
    id: str
    project_id: str
    document_version_id: str
    chunk_index: int
    text: str
    token_count: int
    page_number: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        project_id: str,
        document_version_id: str,
        chunk_index: int,
        text: str,
        token_count: int,
        page_number: int | None = None,
        metadata: dict[str, Any] | None = None,
    ):
        return cls(
            id=str(uuid.uuid4()),
            project_id=project_id,
            document_version_id=document_version_id,
            chunk_index=chunk_index,
            text=text,
            token_count=token_count,
            page_number=page_number,
            metadata=metadata or {},
        )


@dataclass
class RetrievalResult:
    chunk_id: str
    document_version_id: str
    text: str

    retrieval_method: str
    rank: int
    score: float

    page_number: int | None = None

    query_hash: str = ""
    retrieval_timestamp: datetime = field(default_factory=utc_now)

    reranker_version: str | None = None
    embedding_model: str | None = None

    source_version_id: str | None = None

    retrieval_run_id: str | None = None

    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class SourceCandidate:
    url: str
    title: str

    source_type: str = "web"

    authority_level: float = 0.5
    freshness_score: float = 0.5
    publisher_reputation: float = 0.5

    publication_date: str | None = None

    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class EvidenceRecord:
    evidence_id: str
    claim_id: str | None

    document_chunk_id: str
    source_version_id: str
    document_version_id: str

    excerpt: str
    locator: str

    extraction_method: str
    model_version: str | None

    created_at: datetime
    evidence_hash: str