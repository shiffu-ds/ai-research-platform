from __future__ import annotations

import hmac
from typing import Sequence
import uuid

from rag_m2.citations.context_provider import (
    CitationContextProvider,
)
from rag_m2.citations.models import (
    CitationRecord,
)
from rag_m2.schemas import (
    EvidenceRecord,
    utc_now,
)
from rag_m2.utils.hashing import (
    evidence_sha256,
)


class CitationGenerationError(
    RuntimeError
):
    pass


class CitationGenerator:
    """
    Converts validated EvidenceRecord objects
    into reproducible citations.

    Citations resolve to immutable source and
    document versions, never only a mutable URL.
    """

    def __init__(
        self,
        context_provider: CitationContextProvider,
    ):
        self.context_provider = (
            context_provider
        )

    @staticmethod
    def _verify_evidence_integrity(
        evidence: EvidenceRecord,
    ) -> None:

        expected_hash = (
            evidence_sha256(
                excerpt=(
                    evidence.excerpt
                ),
                locator=(
                    evidence.locator
                ),
            )
        )

        if not hmac.compare_digest(
            expected_hash,
            evidence.evidence_hash,
        ):
            raise CitationGenerationError(
                "Evidence integrity validation "
                "failed. The excerpt or locator "
                "may have been modified."
            )

    def generate(
        self,
        evidence: EvidenceRecord,
    ) -> CitationRecord:

        if not evidence.evidence_id:
            raise CitationGenerationError(
                "Evidence has no evidence_id."
            )

        if not evidence.source_version_id:
            raise CitationGenerationError(
                "Evidence has no "
                "source_version_id."
            )

        if not evidence.document_version_id:
            raise CitationGenerationError(
                "Evidence has no "
                "document_version_id."
            )

        if not evidence.document_chunk_id:
            raise CitationGenerationError(
                "Evidence has no "
                "document_chunk_id."
            )

        # ----------------------------------
        # 1. Detect evidence tampering
        # ----------------------------------

        self._verify_evidence_integrity(
            evidence
        )

        # ----------------------------------
        # 2. Resolve immutable chain
        # ----------------------------------

        context = (
            self.context_provider.resolve(
                source_version_id=(
                    evidence.source_version_id
                ),

                document_version_id=(
                    evidence.document_version_id
                ),
            )
        )

        if context is None:
            raise CitationGenerationError(
                "Unable to resolve the evidence "
                "to an immutable source/document "
                "version chain."
            )

        # ----------------------------------
        # 3. Defensive provenance checks
        # ----------------------------------

        if (
            context.source_version_id
            != evidence.source_version_id
        ):
            raise CitationGenerationError(
                "Resolved source_version_id "
                "does not match evidence."
            )

        if (
            context.document_version_id
            != evidence.document_version_id
        ):
            raise CitationGenerationError(
                "Resolved document_version_id "
                "does not match evidence."
            )

        # ----------------------------------
        # 4. Generate citation
        # ----------------------------------

        return CitationRecord(
            citation_id=str(
                uuid.uuid4()
            ),

            evidence_id=(
                evidence.evidence_id
            ),

            claim_id=(
                evidence.claim_id
            ),

            document_chunk_id=(
                evidence.document_chunk_id
            ),

            document_id=(
                context.document_id
            ),

            document_version_id=(
                context.document_version_id
            ),

            source_id=(
                context.source_id
            ),

            source_version_id=(
                context.source_version_id
            ),

            source_title=(
                context.source_title
            ),

            document_title=(
                context.document_title
            ),

            canonical_url=(
                context.canonical_url
            ),

            final_url=(
                context.final_url
            ),

            snapshot_uri=(
                context.snapshot_uri
            ),

            source_content_hash=(
                context.source_content_hash
            ),

            excerpt=(
                evidence.excerpt
            ),

            locator=(
                evidence.locator
            ),

            evidence_hash=(
                evidence.evidence_hash
            ),

            retrieved_at=(
                context.retrieved_at
            ),

            published_at=(
                context.published_at
            ),

            created_at=utc_now(),
        )

    def generate_many(
        self,
        evidence_records: Sequence[
            EvidenceRecord
        ],
    ) -> list[CitationRecord]:

        return [
            self.generate(
                evidence
            )
            for evidence
            in evidence_records
        ]