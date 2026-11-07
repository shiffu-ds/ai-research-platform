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
    EvidenceExtractionError,
    EvidenceExtractor,
)
from rag_m2.evidence.pipeline import (
    EvidenceCitationPipeline,
)
from rag_m2.schemas import (
    RetrievalResult,
)


class FakeRetriever:
    def __init__(
        self,
        results,
    ):
        self.results = results

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
        self.last_project_id = project_id
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
                "AI Research Source"
            ),

            canonical_url=(
                "https://example.com/ai"
            ),

            final_url=(
                "https://example.com/ai"
            ),

            source_content_hash=(
                "a" * 64
            ),

            snapshot_uri=(
                "local://snapshot/ai"
            ),

            retrieved_at=(
                datetime.now(
                    timezone.utc
                )
            ),

            published_at=None,

            document_id="document-1",

            document_version_id=(
                document_version_id
            ),

            document_title=(
                "AI Research Document"
            ),
        )


def make_retrieval_result():
    return RetrievalResult(
        chunk_id="chunk-1",

        document_version_id=(
            "document-version-1"
        ),

        source_version_id=(
            "source-version-1"
        ),

        text=(
            "Artificial intelligence "
            "supports medical diagnosis. "
            "Agriculture uses different "
            "prediction systems."
        ),

        retrieval_method="fused",

        rank=1,

        score=0.97,

        page_number=4,

        query_hash="query-hash",

        reranker_version=(
            "test-reranker"
        ),

        embedding_model=(
            "test-embedding-model"
        ),
    )


def create_pipeline(
    results,
):
    return EvidenceCitationPipeline(
        retriever=FakeRetriever(
            results
        ),

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


def test_pipeline_connects_retrieval_evidence_and_citation():

    pipeline = create_pipeline(
        [
            make_retrieval_result()
        ]
    )

    result = pipeline.run(
        query=(
            "AI medical diagnosis"
        ),

        claim=(
            "Artificial intelligence "
            "supports diagnosis."
        ),

        project_id="project-1",

        claim_id="claim-1",

        retrieval_top_k=10,

        max_evidence=5,
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

    evidence = (
        result.evidence_records[0]
    )

    citation = (
        result.citations[0]
    )

    assert (
        evidence.claim_id
        == "claim-1"
    )

    assert (
        citation.claim_id
        == "claim-1"
    )

    assert (
        citation.evidence_id
        == evidence.evidence_id
    )

    assert (
        citation.document_chunk_id
        == evidence.document_chunk_id
    )

    assert (
        citation.document_version_id
        == evidence.document_version_id
    )

    assert (
        citation.source_version_id
        == evidence.source_version_id
    )

    assert (
        citation.evidence_hash
        == evidence.evidence_hash
    )


def test_pipeline_returns_empty_when_retrieval_is_empty():

    retriever = FakeRetriever(
        []
    )

    pipeline = EvidenceCitationPipeline(
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

    result = pipeline.run(
        query="missing topic",

        claim="Some claim",

        project_id="project-1",
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

    assert (
        retriever.last_query
        == "missing topic"
    )


def test_pipeline_rejects_retrieval_without_provenance():

    invalid_result = (
        make_retrieval_result()
    )

    invalid_result.source_version_id = (
        None
    )

    pipeline = create_pipeline(
        [
            invalid_result
        ]
    )

    with pytest.raises(
        EvidenceExtractionError
    ):
        pipeline.run(
            query=(
                "AI diagnosis"
            ),

            claim=(
                "Artificial intelligence "
                "supports diagnosis."
            ),

            project_id="project-1",
        )