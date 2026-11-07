from __future__ import annotations

from rag_m2.config import settings
from rag_m2.retrieval.lexical_retriever import (
    PostgresBM25Retriever,
)
from rag_m2.retrieval.models import (
    CandidateChunk,
)
from rag_m2.retrieval.reranker import (
    CrossEncoderReranker,
)
from rag_m2.retrieval.rrf import (
    reciprocal_rank_fusion,
)
from rag_m2.schemas import (
    RetrievalResult,
)
from rag_m2.utils.hashing import (
    sha256_text,
)
from rag_m2.vector_store.pgvector_store import (
    PgVectorStore,
)


class HybridRetriever:
    """
    Main M2 retrieval interface.

    Pipeline:
        query
          ↓
        embedding
          ↓
        dense search
          +
        BM25 search
          ↓
        RRF
          ↓
        top candidates
          ↓
        cross-encoder
          ↓
        final ranked chunks
    """

    def __init__(
        self,
        embedding_service,
        vector_store: PgVectorStore | None = None,
        lexical_retriever: (
            PostgresBM25Retriever
            | None
        ) = None,
        reranker: (
            CrossEncoderReranker
            | None
        ) = None,
    ):
        self.embedding_service = (
            embedding_service
        )

        self.vector_store = (
            vector_store
            or PgVectorStore()
        )

        self.lexical_retriever = (
            lexical_retriever
            or PostgresBM25Retriever()
        )

        self.reranker = (
            reranker
            or CrossEncoderReranker()
        )

    def retrieve(
        self,
        query: str,
        project_id: str,
        top_k: int = settings.final_top_k,
    ) -> list[RetrievalResult]:

        if not query.strip():
            raise ValueError(
                "Query cannot be empty."
            )

        if top_k <= 0:
            raise ValueError(
                "top_k must be greater than zero."
            )

        # ---------------------------------
        # Query embedding
        # ---------------------------------

        query_embedding = (
            self.embedding_service.embed_query(
                query
            )
        )

        # ---------------------------------
        # Dense search
        # ---------------------------------

        dense_results = (
            self.vector_store.dense_search(
                query_embedding=(
                    query_embedding
                ),
                project_id=project_id,
                top_k=settings.dense_top_k,
            )
        )

        # ---------------------------------
        # Lexical / BM25 search
        # ---------------------------------

        lexical_results = (
            self.lexical_retriever.search(
                query=query,
                project_id=project_id,
                top_k=(
                    settings.lexical_top_k
                ),
            )
        )

        dense_ranking = [
            item.chunk_id
            for item in dense_results
        ]

        lexical_ranking = [
            item.chunk_id
            for item
            in lexical_results
        ]

        # ---------------------------------
        # RRF fusion
        # ---------------------------------

        fused = reciprocal_rank_fusion(
            [
                dense_ranking,
                lexical_ranking,
            ],
            k=settings.rrf_k,
        )

        fused_score_map = dict(
            fused
        )

        candidate_map: dict[
            str,
            CandidateChunk,
        ] = {}

        # ---------------------------------
        # Dense candidates
        # ---------------------------------

        for item in dense_results:

            candidate_map[
                item.chunk_id
            ] = CandidateChunk(
                chunk_id=item.chunk_id,
                project_id=item.project_id,
                document_version_id=(
                    item.document_version_id
                ),
                source_version_id=(
                    item.source_version_id
                ),
                text=item.text,
                page_number=(
                    item.page_number
                ),
                metadata=dict(
                    item.metadata
                ),
                dense_score=item.score,
            )

        # ---------------------------------
        # Lexical candidates
        # ---------------------------------

        for item in lexical_results:

            candidate = (
                candidate_map.get(
                    item.chunk_id
                )
            )

            if candidate is None:

                candidate = CandidateChunk(
                    chunk_id=(
                        item.chunk_id
                    ),
                    project_id=(
                        item.project_id
                    ),
                    document_version_id=(
                        item.document_version_id
                    ),
                    source_version_id=(
                        item.source_version_id
                    ),
                    text=item.text,
                    page_number=(
                        item.page_number
                    ),
                    metadata=dict(
                        item.metadata
                    ),
                )

                candidate_map[
                    item.chunk_id
                ] = candidate

            candidate.lexical_score = (
                item.score
            )

        # ---------------------------------
        # Attach RRF scores
        # ---------------------------------

        fused_candidates: list[
            CandidateChunk
        ] = []

        for (
            chunk_id,
            fused_score,
        ) in fused[
            :settings.fused_top_k
        ]:

            candidate = candidate_map.get(
                chunk_id
            )

            if candidate is None:
                continue

            candidate.rrf_score = (
                fused_score
            )

            fused_candidates.append(
                candidate
            )

        # ---------------------------------
        # Cross-encoder
        # ---------------------------------

        final_candidates = (
            self.reranker.rerank(
                query=query,
                candidates=(
                    fused_candidates
                ),
                top_k=top_k,
            )
        )

        # ---------------------------------
        # Provenance
        # ---------------------------------

        query_hash = sha256_text(
            query
        )

        retrieval_results: list[
            RetrievalResult
        ] = []

        for rank, item in enumerate(
            final_candidates,
            start=1,
        ):

            final_score = (
                item.rerank_score
                if item.rerank_score
                is not None
                else item.rrf_score
            )

            metadata = dict(
                item.metadata
            )

            metadata.update(
                {
                    "dense_score":
                        item.dense_score,

                    "lexical_score":
                        item.lexical_score,

                    "rrf_score":
                        item.rrf_score,

                    "rerank_score":
                        item.rerank_score,
                }
            )

            retrieval_results.append(
                RetrievalResult(
                    chunk_id=(
                        item.chunk_id
                    ),
                    document_version_id=(
                        item.document_version_id
                    ),
                    source_version_id=(
                        item.source_version_id
                    ),
                    text=item.text,

                    retrieval_method=(
                        "fused"
                    ),

                    rank=rank,

                    score=float(
                        final_score
                    ),

                    page_number=(
                        item.page_number
                    ),

                    query_hash=query_hash,

                    reranker_version=(
                        self.reranker.model_name
                        if self.reranker.enabled
                        else None
                    ),

                    embedding_model=(
                        getattr(
                            self.embedding_service,
                            "model",
                            settings.embedding_model,
                        )
                    ),

                    metadata=metadata,
                )
            )

        return retrieval_results