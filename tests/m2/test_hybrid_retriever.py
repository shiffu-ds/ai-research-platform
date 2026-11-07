from rag_m2.retrieval.hybrid_retriever import (
    HybridRetriever,
)
from rag_m2.retrieval.lexical_retriever import (
    LexicalSearchResult,
)
from rag_m2.retrieval.models import (
    CandidateChunk,
)
from rag_m2.vector_store.pgvector_store import (
    DenseSearchResult,
)


class FakeEmbeddingService:
    def embed_query(
        self,
        query,
    ):
        return [
            1.0,
            0.0,
            0.0,
        ]


class FakeVectorStore:
    def dense_search(
        self,
        query_embedding,
        project_id,
        top_k,
    ):
        return [
            DenseSearchResult(
                chunk_id="chunk-a",
                project_id=project_id,
                document_version_id="doc-a",
                source_version_id="source-a",
                text="Artificial intelligence healthcare",
                page_number=1,
                score=0.95,
                metadata={},
            ),
            DenseSearchResult(
                chunk_id="chunk-b",
                project_id=project_id,
                document_version_id="doc-b",
                source_version_id="source-b",
                text="Machine learning diagnosis",
                page_number=2,
                score=0.80,
                metadata={},
            ),
        ]


class FakeLexicalRetriever:
    def search(
        self,
        query,
        project_id,
        top_k,
    ):
        return [
            LexicalSearchResult(
                chunk_id="chunk-b",
                project_id=project_id,
                document_version_id="doc-b",
                source_version_id="source-b",
                text="Machine learning diagnosis",
                page_number=2,
                score=4.5,
                metadata={},
            ),
            LexicalSearchResult(
                chunk_id="chunk-c",
                project_id=project_id,
                document_version_id="doc-c",
                source_version_id="source-c",
                text="Healthcare research evidence",
                page_number=3,
                score=3.5,
                metadata={},
            ),
        ]


class FakeReranker:
    enabled = True
    model_name = "fake-cross-encoder"

    def rerank(
        self,
        query,
        candidates,
        top_k,
    ):
        for candidate in candidates:

            if (
                candidate.chunk_id
                == "chunk-b"
            ):
                candidate.rerank_score = 0.99

            else:
                candidate.rerank_score = 0.20

        return sorted(
            candidates,
            key=lambda item: (
                item.rerank_score
            ),
            reverse=True,
        )[:top_k]


def test_hybrid_retrieval_combines_dense_and_bm25():

    retriever = HybridRetriever(
        embedding_service=(
            FakeEmbeddingService()
        ),
        vector_store=(
            FakeVectorStore()
        ),
        lexical_retriever=(
            FakeLexicalRetriever()
        ),
        reranker=(
            FakeReranker()
        ),
    )

    results = retriever.retrieve(
        query=(
            "machine learning healthcare"
        ),
        project_id="project-123",
        top_k=3,
    )

    assert len(results) == 3

    assert (
        results[0].chunk_id
        == "chunk-b"
    )

    assert (
        results[0].retrieval_method
        == "fused"
    )

    assert (
        results[0].rank
        == 1
    )

    assert (
        results[0].query_hash
    )

    assert (
        results[0].metadata[
            "rrf_score"
        ]
        > 0
    )

    assert (
        results[0].metadata[
            "dense_score"
        ]
        is not None
    )

    assert (
        results[0].metadata[
            "lexical_score"
        ]
        is not None
    )

class FiftyCandidateVectorStore:

    def dense_search(
        self,
        query_embedding,
        project_id,
        top_k,
    ):

        assert top_k == 50

        return [
            DenseSearchResult(
                chunk_id=f"chunk-{index}",
                project_id=project_id,
                document_version_id=(
                    f"doc-{index}"
                ),
                source_version_id=(
                    f"source-{index}"
                ),
                text=(
                    f"Candidate text {index}"
                ),
                page_number=1,
                score=(
                    1.0
                    - index * 0.01
                ),
                metadata={},
            )
            for index in range(50)
        ]


class FiftyCandidateLexicalRetriever:

    def search(
        self,
        query,
        project_id,
        top_k,
    ):

        assert top_k == 50

        return [
            LexicalSearchResult(
                chunk_id=f"chunk-{index}",
                project_id=project_id,
                document_version_id=(
                    f"doc-{index}"
                ),
                source_version_id=(
                    f"source-{index}"
                ),
                text=(
                    f"Candidate text {index}"
                ),
                page_number=1,
                score=(
                    50.0 - index
                ),
                metadata={},
            )
            for index in range(50)
        ]


class TrackingTopTenReranker:

    enabled = True

    model_name = (
        "test-cross-encoder"
    )

    def __init__(self):

        self.candidate_count = None
        self.requested_top_k = None

    def rerank(
        self,
        query,
        candidates,
        top_k,
    ):

        self.candidate_count = len(
            candidates
        )

        self.requested_top_k = (
            top_k
        )

        for index, candidate in enumerate(
            candidates
        ):
            candidate.rerank_score = (
                100.0 - index
            )

        return candidates[
            :top_k
        ]


def test_hybrid_retriever_reranks_top_50_to_top_10():

    reranker = (
        TrackingTopTenReranker()
    )

    retriever = HybridRetriever(
        embedding_service=(
            FakeEmbeddingService()
        ),

        vector_store=(
            FiftyCandidateVectorStore()
        ),

        lexical_retriever=(
            FiftyCandidateLexicalRetriever()
        ),

        reranker=(
            reranker
        ),
    )

    results = retriever.retrieve(
        query="research query",

        project_id=(
            "project-123"
        ),

        top_k=10,
    )

    assert (
        reranker.candidate_count
        == 50
    )

    assert (
        reranker.requested_top_k
        == 10
    )

    assert (
        len(results)
        == 10
    )

    assert all(
        result.reranker_version
        == "test-cross-encoder"
        for result in results
    )