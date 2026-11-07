from __future__ import annotations

from typing import Sequence
import uuid

from rag_m2.evidence.selector import (
    ExcerptSelector,
    SentenceOverlapSelector,
)
from rag_m2.schemas import (
    EvidenceRecord,
    RetrievalResult,
    utc_now,
)
from rag_m2.utils.hashing import (
    evidence_sha256,
)


class EvidenceExtractionError(
    RuntimeError
):
    pass


class EvidenceExtractor:
    """
    Converts ranked retrieval results into
    provenance-preserving EvidenceRecord objects.

    Important:
    an evidence excerpt must exist verbatim inside
    the retrieved document chunk.
    """

    def __init__(
        self,
        selector: ExcerptSelector | None = None,
    ):
        self.selector = (
            selector
            or SentenceOverlapSelector()
        )

    @staticmethod
    def _build_locator(
        result: RetrievalResult,
    ) -> str:

        parts: list[str] = []

        if result.page_number is not None:
            parts.append(
                f"page:{result.page_number}"
            )

        parts.append(
            f"chunk:{result.chunk_id}"
        )

        return ";".join(
            parts
        )

    @staticmethod
    def _validate_provenance(
        result: RetrievalResult,
    ) -> None:

        if not result.chunk_id:
            raise EvidenceExtractionError(
                "Retrieved result has no chunk_id."
            )

        if not result.document_version_id:
            raise EvidenceExtractionError(
                "Retrieved result has no "
                "document_version_id."
            )

        if not result.source_version_id:
            raise EvidenceExtractionError(
                "Retrieved result has no "
                "source_version_id."
            )

    def extract(
        self,
        claim: str,
        ranked_chunks: Sequence[
            RetrievalResult
        ],
        claim_id: str | None = None,
        max_evidence: int = 5,
    ) -> list[EvidenceRecord]:

        claim = claim.strip()

        if not claim:
            raise ValueError(
                "Claim cannot be empty."
            )

        if max_evidence <= 0:
            raise ValueError(
                "max_evidence must be "
                "greater than zero."
            )

        evidence_records: list[
            EvidenceRecord
        ] = []

        ordered_results = sorted(
            ranked_chunks,
            key=lambda result: (
                result.rank
            ),
        )

        for result in ordered_results:

            self._validate_provenance(
                result
            )

            selected = (
                self.selector.select(
                    claim=claim,
                    chunk_text=result.text,
                )
            )

            if selected is None:
                continue

            excerpt = (
                selected.excerpt.strip()
            )

            if not excerpt:
                continue

            # Critical hallucination protection:
            # extracted evidence must be copied
            # directly from the retrieved chunk.
            if excerpt not in result.text:

                raise EvidenceExtractionError(
                    "Selected evidence excerpt "
                    "does not exist verbatim in "
                    "the retrieved chunk."
                )

            locator = (
                self._build_locator(
                    result
                )
            )

            evidence_hash = (
                evidence_sha256(
                    excerpt=excerpt,
                    locator=locator,
                )
            )

            evidence_records.append(
                EvidenceRecord(
                    evidence_id=str(
                        uuid.uuid4()
                    ),

                    claim_id=claim_id,

                    document_chunk_id=(
                        result.chunk_id
                    ),

                    source_version_id=(
                        result.source_version_id
                    ),

                    document_version_id=(
                        result.document_version_id
                    ),

                    excerpt=excerpt,

                    locator=locator,

                    extraction_method=(
                        selected
                        .extraction_method
                    ),

                    model_version=(
                        selected.model_version
                    ),

                    created_at=utc_now(),

                    evidence_hash=(
                        evidence_hash
                    ),
                )
            )

            if (
                len(evidence_records)
                >= max_evidence
            ):
                break

        return evidence_records