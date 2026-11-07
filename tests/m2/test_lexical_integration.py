import uuid

from rag_m2.retrieval.lexical_retriever import (
    PostgresBM25Retriever,
)
from rag_m2.schemas import Chunk
from rag_m2.vector_store.pgvector_store import (
    PgVectorStore,
)


DIMENSIONS = 3072


def make_vector():
    vector = [
        0.0
        for _ in range(
            DIMENSIONS
        )
    ]

    vector[0] = 1.0

    return vector


def test_bm25_respects_project_scope():

    store = PgVectorStore()

    lexical = (
        PostgresBM25Retriever()
    )

    project_a = str(
        uuid.uuid4()
    )

    project_b = str(
        uuid.uuid4()
    )

    document_a = str(
        uuid.uuid4()
    )

    document_b = str(
        uuid.uuid4()
    )

    chunk_a = Chunk.create(
        project_id=project_a,
        document_version_id=document_a,
        chunk_index=0,
        text=(
            "Artificial intelligence "
            "cancer diagnosis research"
        ),
        token_count=5,
    )

    chunk_b = Chunk.create(
        project_id=project_b,
        document_version_id=document_b,
        chunk_index=0,
        text=(
            "Artificial intelligence "
            "cancer diagnosis private data"
        ),
        token_count=6,
    )

    vector = make_vector()

    try:

        store.upsert_chunk(
            chunk_a,
            vector,
        )

        store.upsert_chunk(
            chunk_b,
            vector,
        )

        results = lexical.search(
            query=(
                "artificial intelligence "
                "cancer diagnosis"
            ),
            project_id=project_a,
            top_k=10,
        )

        ids = {
            result.chunk_id
            for result in results
        }

        assert chunk_a.id in ids

        assert chunk_b.id not in ids

        assert all(
            result.project_id
            == project_a
            for result in results
        )

    finally:

        store.delete_chunk(
            chunk_a.id
        )

        store.delete_chunk(
            chunk_b.id
        )