from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class CitationContext:
    """
    Immutable provenance context resolved
    from the database.
    """

    source_id: str
    source_version_id: str

    source_title: str
    canonical_url: str
    final_url: str

    source_content_hash: str
    snapshot_uri: str

    retrieved_at: datetime
    published_at: datetime | None

    document_id: str
    document_version_id: str
    document_title: str


@dataclass(frozen=True)
class CitationRecord:
    """
    M2 citation DTO.

    A citation always preserves the immutable
    source/document version chain.
    """

    citation_id: str

    evidence_id: str
    claim_id: str | None

    document_chunk_id: str

    document_id: str
    document_version_id: str

    source_id: str
    source_version_id: str

    source_title: str
    document_title: str

    canonical_url: str
    final_url: str

    snapshot_uri: str
    source_content_hash: str

    excerpt: str
    locator: str
    evidence_hash: str

    retrieved_at: datetime
    published_at: datetime | None

    created_at: datetime

    @property
    def audit_reference(
        self,
    ) -> str:
        return (
            f"source_version:"
            f"{self.source_version_id};"
            f"document_version:"
            f"{self.document_version_id};"
            f"{self.locator}"
        )