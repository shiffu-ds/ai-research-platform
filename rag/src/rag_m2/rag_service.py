from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Iterable
import logging

from rag_m2.citations.models import (
    CitationRecord,
)
from rag_m2.config import settings
from rag_m2.evidence.pipeline import (
    EvidenceCitationPipeline,
    EvidenceCitationResult,
)
from rag_m2.schemas import (
    EvidenceRecord,
    RetrievalResult,
)


logger = logging.getLogger(
    __name__
)


class RAGServiceStatus(
    str,
    Enum,
):
    SUCCESS = "SUCCESS"

    NO_RETRIEVAL_RESULTS = (
        "NO_RETRIEVAL_RESULTS"
    )

    UNSUPPORTED_CLAIM = (
        "UNSUPPORTED_CLAIM"
    )


class RAGServiceInvariantError(
    RuntimeError
):
    """
    Raised when internal M2 components return
    mutually inconsistent provenance.
    """

    pass


@dataclass(frozen=True)
class RAGProvenanceSummary:
    """
    Compact provenance summary for M1/M3.

    Full provenance remains available inside the
    retrieval/evidence/citation records.
    """

    chunk_ids: tuple[
        str,
        ...
    ]

    document_version_ids: tuple[
        str,
        ...
    ]

    source_version_ids: tuple[
        str,
        ...
    ]

    evidence_ids: tuple[
        str,
        ...
    ]

    citation_ids: tuple[
        str,
        ...
    ]


@dataclass(frozen=True)
class RAGServiceResult:
    """
    Stable M2 integration result.

    This DTO is the boundary that M1 orchestration
    or M3 API code can consume.
    """

    status: RAGServiceStatus

    query: str
    claim: str

    project_id: str
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

    provenance: RAGProvenanceSummary


class M2RAGService:
    """
    Public M2 integration interface.

    M1 owns orchestration.
    M3 owns authentication/API/persistence.

    This service owns:
        retrieval
        evidence extraction
        citation generation
        provenance handoff
    """

    def __init__(
        self,
        pipeline: EvidenceCitationPipeline,
    ):
        self.pipeline = pipeline

    # --------------------------------------
    # Utility
    # --------------------------------------

    @staticmethod
    def _unique(
        values: Iterable[
            str | None
        ],
    ) -> tuple[str, ...]:

        seen: set[str] = set()

        ordered: list[str] = []

        for value in values:

            if not value:
                continue

            if value in seen:
                continue

            seen.add(
                value
            )

            ordered.append(
                value
            )

        return tuple(
            ordered
        )

    # --------------------------------------
    # Internal integrity validation
    # --------------------------------------

    @staticmethod
    def _validate_bundle(
        bundle: EvidenceCitationResult,
    ) -> None:

        evidence_records = (
            bundle.evidence_records
        )

        citations = (
            bundle.citations
        )

        if (
            len(evidence_records)
            != len(citations)
        ):
            raise RAGServiceInvariantError(
                "Evidence/citation count mismatch."
            )

        evidence_ids = [
            evidence.evidence_id
            for evidence
            in evidence_records
        ]

        if (
            len(set(evidence_ids))
            != len(evidence_ids)
        ):
            raise RAGServiceInvariantError(
                "Duplicate evidence_id detected."
            )

        citation_by_evidence = {
            citation.evidence_id:
                citation

            for citation
            in citations
        }

        if (
            len(citation_by_evidence)
            != len(citations)
        ):
            raise RAGServiceInvariantError(
                "Multiple citations reference "
                "the same evidence record."
            )

        for evidence in evidence_records:

            citation = (
                citation_by_evidence.get(
                    evidence.evidence_id
                )
            )

            if citation is None:
                raise RAGServiceInvariantError(
                    "Evidence record has no "
                    "corresponding citation."
                )

            if (
                citation.document_chunk_id
                != evidence.document_chunk_id
            ):
                raise RAGServiceInvariantError(
                    "Citation chunk provenance "
                    "does not match evidence."
                )

            if (
                citation.document_version_id
                != evidence.document_version_id
            ):
                raise RAGServiceInvariantError(
                    "Citation document version "
                    "does not match evidence."
                )

            if (
                citation.source_version_id
                != evidence.source_version_id
            ):
                raise RAGServiceInvariantError(
                    "Citation source version "
                    "does not match evidence."
                )

            if (
                citation.evidence_hash
                != evidence.evidence_hash
            ):
                raise RAGServiceInvariantError(
                    "Citation evidence hash "
                    "does not match evidence."
                )

    # --------------------------------------
    # Retrieval Agent interface
    # --------------------------------------

    def retrieve(
        self,
        query: str,
        project_id: str,
        top_k: int = (
            settings.final_top_k
        ),
    ) -> list[RetrievalResult]:

        query = query.strip()
        project_id = (
            project_id.strip()
        )

        if not query:
            raise ValueError(
                "Query cannot be empty."
            )

        if not project_id:
            raise ValueError(
                "project_id cannot be empty."
            )

        if top_k <= 0:
            raise ValueError(
                "top_k must be greater "
                "than zero."
            )

        return (
            self.pipeline
            .retriever
            .retrieve(
                query=query,
                project_id=project_id,
                top_k=top_k,
            )
        )

    # --------------------------------------
    # Retrieval + evidence + citation
    # --------------------------------------

    def build_evidence_bundle(
        self,
        query: str,
        claim: str,
        project_id: str,
        claim_id: str | None = None,
        retrieval_top_k: int = (
            settings.final_top_k
        ),
        max_evidence: int = 5,
    ) -> RAGServiceResult:

        project_id = (
            project_id.strip()
        )

        if not project_id:
            raise ValueError(
                "project_id cannot be empty."
            )

        bundle = (
            self.pipeline.run(
                query=query,

                claim=claim,

                project_id=(
                    project_id
                ),

                claim_id=(
                    claim_id
                ),

                retrieval_top_k=(
                    retrieval_top_k
                ),

                max_evidence=(
                    max_evidence
                ),
            )
        )

        # Never hand inconsistent evidence to
        # M1/M3.
        self._validate_bundle(
            bundle
        )

        if not bundle.retrieval_results:

            status = (
                RAGServiceStatus
                .NO_RETRIEVAL_RESULTS
            )

        elif not bundle.evidence_records:

            status = (
                RAGServiceStatus
                .UNSUPPORTED_CLAIM
            )

        else:

            status = (
                RAGServiceStatus
                .SUCCESS
            )

        provenance = (
            RAGProvenanceSummary(

                chunk_ids=self._unique(
                    result.chunk_id
                    for result
                    in bundle
                    .retrieval_results
                ),

                document_version_ids=(
                    self._unique(
                        result
                        .document_version_id

                        for result
                        in bundle
                        .retrieval_results
                    )
                ),

                source_version_ids=(
                    self._unique(
                        result
                        .source_version_id

                        for result
                        in bundle
                        .retrieval_results
                    )
                ),

                evidence_ids=self._unique(
                    evidence.evidence_id
                    for evidence
                    in bundle
                    .evidence_records
                ),

                citation_ids=self._unique(
                    citation.citation_id
                    for citation
                    in bundle.citations
                ),
            )
        )

        # Do not log raw query, claim, excerpt,
        # or external source content.
        logger.info(
            "M2 RAG evidence bundle completed",
            extra={
                "project_id":
                    project_id,

                "status":
                    status.value,

                "retrieval_count":
                    len(
                        bundle
                        .retrieval_results
                    ),

                "evidence_count":
                    len(
                        bundle
                        .evidence_records
                    ),

                "citation_count":
                    len(
                        bundle
                        .citations
                    ),
            },
        )

        return RAGServiceResult(
            status=status,

            query=(
                bundle.query
            ),

            claim=(
                bundle.claim
            ),

            project_id=(
                project_id
            ),

            claim_id=(
                bundle.claim_id
            ),

            retrieval_results=list(
                bundle
                .retrieval_results
            ),

            evidence_records=list(
                bundle
                .evidence_records
            ),

            citations=list(
                bundle.citations
            ),

            provenance=provenance,
        )


def create_default_rag_service(
    api_key: str | None = None,
    provenance_repository=None,
    evidence_selector=None,
) -> M2RAGService:
    """
    Build the normal M2 runtime stack.

    M3 must authorize the caller/project before
    passing project_id into this service.
    """

    from rag_m2.citations.context_provider import (
        PostgresCitationContextProvider,
    )
    from rag_m2.citations.generator import (
        CitationGenerator,
    )
    from rag_m2.embeddings.embedding_service import (
        OpenAIEmbeddingService,
    )
    from rag_m2.evidence.extractor import (
        EvidenceExtractor,
    )
    from rag_m2.retrieval.hybrid_retriever import (
        HybridRetriever,
    )
    from rag_m2.evidence.structured_selector import (
        OpenAIStructuredEvidenceClient,
        StructuredLLMEvidenceSelector,
    )

    embedding_service = (
        OpenAIEmbeddingService(
            api_key=api_key
        )
    )

    retriever = (
        HybridRetriever(
            embedding_service=(
                embedding_service
            )
        )
    )
    if provenance_repository is not None:

        from rag_m2.retrieval.persisting_retriever import (
            PersistingRetriever,
        )

        retriever = (
            PersistingRetriever(
                retriever=(
                    retriever
                ),

                provenance_repository=(
                    provenance_repository
                ),
            )
        )

    resolved_evidence_selector = (
        evidence_selector
    )

    resolved_api_key = (
        api_key
        or settings.openai_api_key
    )

    if (
        resolved_evidence_selector
        is None
        and resolved_api_key
    ):

        structured_client = (
            OpenAIStructuredEvidenceClient(
                api_key=(
                    resolved_api_key
                ),

                model=(
                    settings
                    .evidence_extraction_model
                ),
            )
        )

        resolved_evidence_selector = (
            StructuredLLMEvidenceSelector(
                client=(
                    structured_client
                ),

                max_attempts=2,
            )
        )

    evidence_extractor = (
        EvidenceExtractor(
            selector=(
                resolved_evidence_selector
            )
        )
    )

    citation_generator = (
        CitationGenerator(
            context_provider=(
                PostgresCitationContextProvider()
            )
        )
    )

    pipeline = (
        EvidenceCitationPipeline(
            retriever=retriever,

            evidence_extractor=(
                evidence_extractor
            ),

            citation_generator=(
                citation_generator
            ),
        )
    )

    return M2RAGService(
        pipeline=pipeline
    )