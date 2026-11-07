import uuid

from rag_m2.schemas import Chunk
from rag_m2.vector_store.pgvector_store import (
    PgVectorStore,
)


DIMENSIONS = 3072


def make_vector(
    position: int,
) -> list[float]:
    vector = [
        0.0
        for _ in range(
            DIMENSIONS
        )
    ]

    vector[position] = 1.0

    return vector


def test_pgvector_healthcheck():
    store = PgVectorStore()

    assert store.healthcheck() is True


def test_dense_search_respects_project_scope():
    store = PgVectorStore()

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
        text="Artificial intelligence supports medical diagnosis.",
        token_count=6,
        page_number=1,
    )

    chunk_b = Chunk.create(
        project_id=project_b,
        document_version_id=document_b,
        chunk_index=0,
        text="Confidential content from another project.",
        token_count=5,
        page_number=1,
    )

    same_vector = make_vector(
        0
    )

    try:
        store.upsert_chunk(
            chunk_a,
            same_vector,
        )

        store.upsert_chunk(
            chunk_b,
            same_vector,
        )

        results = store.dense_search(
            query_embedding=same_vector,
            project_id=project_a,
            top_k=10,
        )

        returned_ids = {
            result.chunk_id
            for result in results
        }

        assert chunk_a.id in returned_ids

        assert chunk_b.id not in returned_ids

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


def test_dense_search_ranks_similar_vector_first():
    store = PgVectorStore()

    project_id = str(
        uuid.uuid4()
    )

    document_id = str(
        uuid.uuid4()
    )

    relevant = Chunk.create(
        project_id=project_id,
        document_version_id=document_id,
        chunk_index=0,
        text="Relevant semantic information.",
        token_count=3,
        page_number=1,
    )

    unrelated = Chunk.create(
        project_id=project_id,
        document_version_id=document_id,
        chunk_index=1,
        text="Unrelated semantic information.",
        token_count=3,
        page_number=2,
    )

    relevant_vector = make_vector(
        0
    )

    unrelated_vector = make_vector(
        1
    )

    try:
        store.upsert_chunk(
            relevant,
            relevant_vector,
        )

        store.upsert_chunk(
            unrelated,
            unrelated_vector,
        )

        results = store.dense_search(
            query_embedding=relevant_vector,
            project_id=project_id,
            top_k=2,
        )

        assert len(results) == 2

        assert (
            results[0].chunk_id
            == relevant.id
        )

        assert (
            results[0].score
            > results[1].score
        )

    finally:
        store.delete_chunk(
            relevant.id
        )

        store.delete_chunk(
            unrelated.id
        )