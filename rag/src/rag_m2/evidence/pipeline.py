from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence

from rag_m2.citations.generator import (
    CitationGenerator,
)
from rag_m2.citations.models import (
    CitationRecord,
)
from rag_m2.config import settings
from rag_m2.evidence.extractor import (
    EvidenceExtractor,
)
from rag_m2.schemas import (
    EvidenceRecord,
    RetrievalResult,
)


class Retriever(Protocol):
    def retrieve(
        self,
        query: str,
        project_id: str,
        top_k: int,
    ) -> list[RetrievalResult]:
        ...


@dataclass(frozen=True)
class EvidenceCitationResult:
    """
    Complete output of the M2
    retrieval -> evidence -> citation flow.
    """

    query: str
    claim: str
    claim_id: str | None

    retrieval_results: list[
        RetrievalResult
    ]

    evidence_records: list[
        EvidenceRecord
    ]

    citations: list[
        CitationRecord
    ]


class EvidenceCitationPipeline:
    """
    Connects the three major M2 stages:

    Hybrid Retrieval
        -> Evidence Extraction
        -> Citation Generation
    """

    def __init__(
        self,
        retriever: Retriever,
        evidence_extractor: EvidenceExtractor,
        citation_generator: CitationGenerator,
    ):
        self.retriever = retriever

        self.evidence_extractor = (
            evidence_extractor
        )

        self.citation_generator = (
            citation_generator
        )

    def run(
        self,
        query: str,
        claim: str,
        project_id: str,
        claim_id: str | None = None,
        retrieval_top_k: int = (
            settings.final_top_k
        ),
        max_evidence: int = 5,
    ) -> EvidenceCitationResult:

        query = query.strip()
        claim = claim.strip()
        project_id = project_id.strip()

        if not query:
            raise ValueError(
                "Query cannot be empty."
            )

        if not claim:
            raise ValueError(
                "Claim cannot be empty."
            )

        if not project_id:
            raise ValueError(
                "project_id cannot be empty."
            )

        if retrieval_top_k <= 0:
            raise ValueError(
                "retrieval_top_k must be "
                "greater than zero."
            )

        if max_evidence <= 0:
            raise ValueError(
                "max_evidence must be "
                "greater than zero."
            )

        # ----------------------------------
        # 1. Hybrid retrieval
        # ----------------------------------

        retrieval_results = (
            self.retriever.retrieve(
                query=query,
                project_id=project_id,
                top_k=retrieval_top_k,
            )
        )

        # No retrieval result means no evidence
        # and therefore no valid citation.
        if not retrieval_results:

            return EvidenceCitationResult(
                query=query,
                claim=claim,
                claim_id=claim_id,
                retrieval_results=[],
                evidence_records=[],
                citations=[],
            )

        # ----------------------------------
        # 2. Evidence extraction
        # ----------------------------------

        evidence_records = (
            self.evidence_extractor.extract(
                claim=claim,

                ranked_chunks=(
                    retrieval_results
                ),

                claim_id=claim_id,

                max_evidence=(
                    max_evidence
                ),
            )
        )

        # ----------------------------------
        # 3. Citation generation
        # ----------------------------------

        citations = (
            self.citation_generator
            .generate_many(
                evidence_records
            )
        )

        return EvidenceCitationResult(
            query=query,

            claim=claim,

            claim_id=claim_id,

            retrieval_results=list(
                retrieval_results
            ),

            evidence_records=list(
                evidence_records
            ),

            citations=list(
                citations
            ),
        )