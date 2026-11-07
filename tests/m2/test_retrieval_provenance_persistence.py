import uuid

import pytest

from rag_m2.retrieval.persisting_retriever import (
    PersistingRetriever,
)
from rag_m2.retrieval.provenance_repository import (
    PostgresRetrievalProvenanceRepository,
    RetrievalProvenanceError,
)
from rag_m2.schemas import (
    Chunk,
    RetrievalResult,
)
from rag_m2.sources.version_repository import (
    VersionRepository,
)
from rag_m2.utils.hashing import (
    sha256_text,
)
from rag_m2.vector_store.pgvector_store import (
    PgVectorStore,
)


DIMENSIONS = 3072


class FakeRetriever:

    def __init__(
        self,
        results,
    ):
        self.results = results

    def retrieve(
        self,
        query,
        project_id,
        top_k,
    ):
        return list(
            self.results
        )


def seed_provenance_chain():

    repository = (
        VersionRepository()
    )

    vector_store = (
        PgVectorStore()
    )

    project_id = str(
        uuid.uuid4()
    )

    source = (
        repository.create_source(
            project_id=project_id,

            canonical_url=(
                "https://example.com/"
                f"{uuid.uuid4()}"
            ),

            title=(
                "Retrieval Provenance Test"
            ),

            source_type="test",
        )
    )

    source_version = (
        repository.create_source_version(
            source_id=source.id,

            content_hash=(
                sha256_text(
                    "source-version-content"
                )
            ),

            final_url=(
                source.canonical_url
            ),

            storage_uri=(
                "test://source-version"
            ),

            parser_version=(
                "test-parser-v1"
            ),

            http_status=200,

            content_type=(
                "text/plain"
            ),
        )
    )

    document = (
        repository.create_document(
            project_id=project_id,

            source_id=source.id,

            title=(
                "Test Document"
            ),
        )
    )

    document_version = (
        repository.create_document_version(
            document_id=(
                document.id
            ),

            source_version_id=(
                source_version.id
            ),

            content_hash=(
                sha256_text(
                    "document-version-content"
                )
            ),

            parser_version=(
                "test-parser-v1"
            ),

            page_count=1,

            storage_location=(
                "test://document-version"
            ),
        )
    )

    chunk = Chunk.create(
        project_id=project_id,

        document_version_id=(
            document_version.id
        ),

        chunk_index=0,

        text=(
            "Solar energy can generate "
            "electricity."
        ),

        token_count=6,

        page_number=1,
    )

    vector = [
        0.0
        for _ in range(
            DIMENSIONS
        )
    ]

    vector[0] = 1.0

    vector_store.upsert_chunk(
        chunk=chunk,

        embedding=vector,

        source_version_id=(
            source_version.id
        ),

        embedding_model=(
            "test-embedding-v1"
        ),
    )

    return (
        repository,
        project_id,
        source,
        source_version,
        document_version,
        chunk,
    )


def test_persisting_retriever_stores_required_fields():

    (
        version_repository,
        project_id,
        source,
        source_version,
        document_version,
        chunk,
    ) = seed_provenance_chain()

    provenance_repository = (
        PostgresRetrievalProvenanceRepository()
    )

    query = (
        "solar electricity"
    )

    result = RetrievalResult(
        chunk_id=chunk.id,

        document_version_id=(
            document_version.id
        ),

        source_version_id=(
            source_version.id
        ),

        text=chunk.text,

        retrieval_method=(
            "fused"
        ),

        rank=1,

        score=0.95,

        page_number=1,

        query_hash=(
            sha256_text(
                query
            )
        ),

        reranker_version=(
            "test-reranker-v1"
        ),

        embedding_model=(
            "test-embedding-v1"
        ),
    )

    retriever = (
        PersistingRetriever(
            retriever=(
                FakeRetriever(
                    [result]
                )
            ),

            provenance_repository=(
                provenance_repository
            ),
        )
    )

    run_id = None

    try:

        returned = retriever.retrieve(
            query=query,

            project_id=(
                project_id
            ),

            top_k=10,
        )

        assert len(
            returned
        ) == 1

        run_id = (
            returned[0]
            .retrieval_run_id
        )

        assert run_id

        persisted = (
            provenance_repository
            .get_results(
                run_id
            )
        )

        assert len(
            persisted
        ) == 1

        stored = persisted[0]

        assert (
            stored.document_chunk_id
            == chunk.id
        )

        assert (
            stored.retrieval_method
            == "fused"
        )

        assert stored.rank == 1

        assert (
            stored.score
            == pytest.approx(
                0.95
            )
        )

        assert (
            stored.query_hash
            == sha256_text(
                query
            )
        )

        assert (
            stored.reranker_version
            == "test-reranker-v1"
        )

        assert (
            stored.embedding_model
            == "test-embedding-v1"
        )

        audit = (
            provenance_repository
            .audit(
                run_id
            )
        )

        assert (
            audit.result_count
            == 1
        )

        assert (
            audit.complete_result_count
            == 1
        )

        assert (
            audit.broken_chain_count
            == 0
        )

        assert (
            audit.query_hash_consistent
            is True
        )

        assert (
            audit.is_complete
            is True
        )

    finally:

        if run_id:

            provenance_repository.delete_run(
                run_id
            )

        version_repository.delete_source(
            source.id
        )


def test_query_hash_mismatch_is_rejected():

    repository = (
        PostgresRetrievalProvenanceRepository()
    )

    result = RetrievalResult(
        chunk_id=str(
            uuid.uuid4()
        ),

        document_version_id=str(
            uuid.uuid4()
        ),

        source_version_id=str(
            uuid.uuid4()
        ),

        text="test",

        retrieval_method="fused",

        rank=1,

        score=0.5,

        query_hash=(
            "0" * 64
        ),

        embedding_model=(
            "test-embedding"
        ),
    )

    with pytest.raises(
        RetrievalProvenanceError
    ):

        repository.persist(
            project_id=str(
                uuid.uuid4()
            ),

            query=(
                "different query"
            ),

            requested_top_k=10,

            results=[
                result
            ],
        )


def test_duplicate_ranks_are_rejected():

    repository = (
        PostgresRetrievalProvenanceRepository()
    )

    query = "test query"

    query_hash = (
        sha256_text(
            query
        )
    )

    results = [
        RetrievalResult(
            chunk_id=str(
                uuid.uuid4()
            ),

            document_version_id=str(
                uuid.uuid4()
            ),

            source_version_id=str(
                uuid.uuid4()
            ),

            text="one",

            retrieval_method="fused",

            rank=1,

            score=0.9,

            query_hash=query_hash,

            embedding_model=(
                "test-embedding"
            ),
        ),

        RetrievalResult(
            chunk_id=str(
                uuid.uuid4()
            ),

            document_version_id=str(
                uuid.uuid4()
            ),

            source_version_id=str(
                uuid.uuid4()
            ),

            text="two",

            retrieval_method="fused",

            rank=1,

            score=0.8,

            query_hash=query_hash,

            embedding_model=(
                "test-embedding"
            ),
        ),
    ]

    with pytest.raises(
        RetrievalProvenanceError
    ):

        repository.persist(
            project_id=str(
                uuid.uuid4()
            ),

            query=query,

            requested_top_k=10,

            results=results,
        )


def test_empty_retrieval_run_is_preserved():

    repository = (
        PostgresRetrievalProvenanceRepository()
    )

    run = repository.persist(
        project_id=str(
            uuid.uuid4()
        ),

        query=(
            "query with no results"
        ),

        requested_top_k=10,

        results=[],
    )

    try:

        persisted = (
            repository.get_results(
                run.id
            )
        )

        assert persisted == []

        audit = (
            repository.audit(
                run.id
            )
        )

        assert (
            audit.result_count
            == 0
        )

        assert (
            audit.is_complete
            is True
        )

    finally:

        repository.delete_run(
            run.id
        )


def test_retrieval_result_run_id_is_optional():

    result = RetrievalResult(
        chunk_id="chunk",

        document_version_id="document",

        text="content",

        retrieval_method="fused",

        rank=1,

        score=1.0,
    )

    assert (
        result.retrieval_run_id
        is None
    )