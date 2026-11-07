from datetime import (
    datetime,
    timezone,
)

import pytest

from rag_m2.citations.generator import (
    CitationGenerator,
)
from rag_m2.citations.models import (
    CitationContext,
)
from rag_m2.evidence.extractor import (
    EvidenceExtractor,
)
from rag_m2.evidence.pipeline import (
    EvidenceCitationPipeline,
    EvidenceCitationResult,
)
from rag_m2.rag_service import (
    M2RAGService,
    RAGServiceInvariantError,
    RAGServiceStatus,
)
from rag_m2.schemas import (
    EvidenceRecord,
    RetrievalResult,
)
from rag_m2.utils.hashing import (
    evidence_sha256,
)


class FakeRetriever:
    def __init__(
        self,
        results,
    ):
        self.results = list(
            results
        )

        self.last_query = None
        self.last_project_id = None
        self.last_top_k = None

    def retrieve(
        self,
        query: str,
        project_id: str,
        top_k: int,
    ):
        self.last_query = query

        self.last_project_id = (
            project_id
        )

        self.last_top_k = top_k

        return list(
            self.results
        )


class FakeCitationContextProvider:
    def resolve(
        self,
        source_version_id: str,
        document_version_id: str,
    ):

        return CitationContext(
            source_id="source-1",

            source_version_id=(
                source_version_id
            ),

            source_title=(
                "Research Source"
            ),

            canonical_url=(
                "https://example.com/"
                "research"
            ),

            final_url=(
                "https://example.com/"
                "research"
            ),

            source_content_hash=(
                "a" * 64
            ),

            snapshot_uri=(
                "local://snapshot/"
                "source-version-1"
            ),

            retrieved_at=(
                datetime.now(
                    timezone.utc
                )
            ),

            published_at=None,

            document_id=(
                "document-1"
            ),

            document_version_id=(
                document_version_id
            ),

            document_title=(
                "Research Document"
            ),
        )


def make_retrieval_result(
    text: str = (
        "Artificial intelligence supports "
        "medical diagnosis. "
        "Reliable systems preserve "
        "evidence provenance."
    ),
):

    return RetrievalResult(
        chunk_id="chunk-1",

        document_version_id=(
            "document-version-1"
        ),

        source_version_id=(
            "source-version-1"
        ),

        text=text,

        retrieval_method="fused",

        rank=1,

        score=0.98,

        page_number=2,

        query_hash="query-hash",

        reranker_version=(
            "test-reranker"
        ),

        embedding_model=(
            "test-embedding"
        ),
    )


def create_service(
    results,
):

    retriever = FakeRetriever(
        results
    )

    pipeline = (
        EvidenceCitationPipeline(
            retriever=retriever,

            evidence_extractor=(
                EvidenceExtractor()
            ),

            citation_generator=(
                CitationGenerator(
                    context_provider=(
                        FakeCitationContextProvider()
                    )
                )
            ),
        )
    )

    return (
        M2RAGService(
            pipeline
        ),
        retriever,
    )


def test_rag_service_returns_success_bundle():

    service, _ = create_service(
        [
            make_retrieval_result()
        ]
    )

    result = (
        service.build_evidence_bundle(
            query=(
                "AI medical diagnosis"
            ),

            claim=(
                "Artificial intelligence "
                "supports diagnosis."
            ),

            project_id="project-1",

            claim_id="claim-1",
        )
    )

    assert (
        result.status
        == RAGServiceStatus.SUCCESS
    )

    assert len(
        result.retrieval_results
    ) == 1

    assert len(
        result.evidence_records
    ) == 1

    assert len(
        result.citations
    ) == 1

    assert (
        result.provenance.chunk_ids
        == ("chunk-1",)
    )

    assert (
        result.provenance
        .document_version_ids
        == (
            "document-version-1",
        )
    )

    assert (
        result.provenance
        .source_version_ids
        == (
            "source-version-1",
        )
    )

    assert len(
        result.provenance
        .evidence_ids
    ) == 1

    assert len(
        result.provenance
        .citation_ids
    ) == 1


def test_rag_service_reports_no_retrieval_results():

    service, _ = create_service(
        []
    )

    result = (
        service.build_evidence_bundle(
            query="missing topic",

            claim="Some claim",

            project_id="project-1",
        )
    )

    assert (
        result.status
        ==
        RAGServiceStatus
        .NO_RETRIEVAL_RESULTS
    )

    assert (
        result.retrieval_results
        == []
    )

    assert (
        result.evidence_records
        == []
    )

    assert (
        result.citations
        == []
    )


def test_rag_service_marks_unsupported_claim():

    service, _ = create_service(
        [
            make_retrieval_result(
                text=(
                    "Quantum computing uses "
                    "qubits and quantum gates."
                )
            )
        ]
    )

    result = (
        service.build_evidence_bundle(
            query=(
                "quantum computing"
            ),

            claim=(
                "Bananas improve "
                "automobile engines."
            ),

            project_id="project-1",
        )
    )

    assert (
        result.status
        ==
        RAGServiceStatus
        .UNSUPPORTED_CLAIM
    )

    assert len(
        result.retrieval_results
    ) == 1

    assert (
        result.evidence_records
        == []
    )

    assert (
        result.citations
        == []
    )


def test_rag_service_exposes_retrieval_contract():

    service, retriever = (
        create_service(
            [
                make_retrieval_result()
            ]
        )
    )

    results = service.retrieve(
        query=(
            "AI diagnosis"
        ),

        project_id=(
            "project-123"
        ),

        top_k=7,
    )

    assert len(
        results
    ) == 1

    assert (
        retriever.last_query
        == "AI diagnosis"
    )

    assert (
        retriever.last_project_id
        == "project-123"
    )

    assert (
        retriever.last_top_k
        == 7
    )


class BrokenPipeline:
    """
    Simulates an internal component returning
    evidence without its required citation.
    """

    def __init__(
        self,
        result,
    ):
        self.result = result

        self.retriever = (
            FakeRetriever([])
        )

    def run(
        self,
        **kwargs,
    ):
        return self.result


def test_rag_service_rejects_inconsistent_bundle():

    retrieval = (
        make_retrieval_result()
    )

    excerpt = (
        "Artificial intelligence supports "
        "medical diagnosis."
    )

    locator = (
        "page:2;chunk:chunk-1"
    )

    evidence = EvidenceRecord(
        evidence_id="evidence-1",

        claim_id="claim-1",

        document_chunk_id=(
            "chunk-1"
        ),

        source_version_id=(
            "source-version-1"
        ),

        document_version_id=(
            "document-version-1"
        ),

        excerpt=excerpt,

        locator=locator,

        extraction_method=(
            "test"
        ),

        model_version=None,

        created_at=(
            datetime.now(
                timezone.utc
            )
        ),

        evidence_hash=(
            evidence_sha256(
                excerpt,
                locator,
            )
        ),
    )

    broken_result = (
        EvidenceCitationResult(
            query="AI diagnosis",

            claim=(
                "AI supports diagnosis."
            ),

            claim_id="claim-1",

            retrieval_results=[
                retrieval
            ],

            evidence_records=[
                evidence
            ],

            # Deliberately broken.
            citations=[],
        )
    )

    service = M2RAGService(
        BrokenPipeline(
            broken_result
        )
    )

    with pytest.raises(
        RAGServiceInvariantError
    ):
        service.build_evidence_bundle(
            query=(
                "AI diagnosis"
            ),

            claim=(
                "AI supports diagnosis."
            ),

            project_id="project-1",
        )