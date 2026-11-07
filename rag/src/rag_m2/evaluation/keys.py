from __future__ import annotations

from rag_m2.citations.models import (
    CitationRecord,
)
from rag_m2.utils.hashing import (
    sha256_text,
)


def citation_evaluation_key_from_provenance(
    source_version_id: str,
    document_version_id: str,
    document_chunk_id: str,
    locator: str,
    evidence_hash: str,
) -> str:
    """
    Create a deterministic citation evaluation
    key directly from immutable provenance.

    Runtime citation UUIDs are intentionally
    excluded because they change on every run.
    """

    values = [
        source_version_id,
        document_version_id,
        document_chunk_id,
        locator,
        evidence_hash,
    ]

    cleaned = [
        value.strip()
        for value in values
    ]

    if any(
        not value
        for value in cleaned
    ):
        raise ValueError(
            "Citation evaluation provenance "
            "cannot contain empty values."
        )

    payload = "\x1f".join(
        cleaned
    )

    return sha256_text(
        payload
    )


def citation_evaluation_key(
    citation: CitationRecord,
) -> str:
    """
    Produce a deterministic benchmark key from
    an actual CitationRecord.
    """

    return (
        citation_evaluation_key_from_provenance(
            source_version_id=(
                citation.source_version_id
            ),

            document_version_id=(
                citation.document_version_id
            ),

            document_chunk_id=(
                citation.document_chunk_id
            ),

            locator=(
                citation.locator
            ),

            evidence_hash=(
                citation.evidence_hash
            ),
        )
    )