from pathlib import Path
import uuid

import pymupdf

from rag_m2.ingestion.document_processor import (
    DocumentProcessor,
)
from rag_m2.indexing.indexing_service import (
    PDFIndexingService,
)
from rag_m2.preprocessing.chunker import (
    SentenceAwareChunker,
)
from rag_m2.sources.version_repository import (
    VersionRepository,
)
from rag_m2.utils.hashing import (
    sha256_file,
)
from rag_m2.vector_store.pgvector_store import (
    PgVectorStore,
)


DIMENSIONS = 3072


class FakeEmbeddingService:
    model = "fake-test-embedding-v1"

    @staticmethod
    def _vector(
        text: str,
    ) -> list[float]:

        vector = [
            0.0
            for _ in range(
                DIMENSIONS
            )
        ]

        text_lower = text.lower()

        if (
            "artificial intelligence"
            in text_lower
        ):
            vector[0] = 1.0

        else:
            vector[1] = 1.0

        return vector

    def embed_texts(
        self,
        texts,
    ) -> list[list[float]]:

        return [
            self._vector(text)
            for text in texts
        ]

    def embed_query(
        self,
        query: str,
    ) -> list[float]:

        return self._vector(
            query
        )


def create_test_pdf(
    path: Path,
) -> None:

    document = pymupdf.open()

    page = document.new_page()

    page.insert_text(
        (72, 72),
        (
            "Artificial intelligence supports "
            "evidence-based research. "
            "Reliable retrieval systems preserve "
            "source provenance and citations."
        ),
    )

    document.save(
        path
    )

    document.close()


def create_source_chain(
    repository: VersionRepository,
    project_id: str,
    pdf_path: Path,
):

    source = (
        repository.create_source(
            project_id=project_id,

            canonical_url=(
                "https://example.com/"
                "research-paper.pdf"
            ),

            title="Research Paper",

            source_type="pdf",
        )
    )

    source_version = (
        repository.create_source_version(
            source_id=source.id,

            content_hash=(
                sha256_file(
                    pdf_path
                )
            ),

            final_url=(
                "https://example.com/"
                "research-paper.pdf"
            ),

            storage_uri=(
                pdf_path
                .resolve()
                .as_uri()
            ),

            parser_version=(
                "test-source-v1"
            ),

            http_status=200,

            content_type=(
                "application/pdf"
            ),
        )
    )

    return (
        source,
        source_version,
    )


def test_pdf_indexing_creates_versioned_chunks(
    tmp_path,
):

    repository = VersionRepository()

    vector_store = PgVectorStore()

    project_id = str(
        uuid.uuid4()
    )

    pdf_path = (
        tmp_path
        / "research.pdf"
    )

    images_directory = (
        tmp_path
        / "images"
    )

    create_test_pdf(
        pdf_path
    )

    source, source_version = (
        create_source_chain(
            repository,
            project_id,
            pdf_path,
        )
    )

    service = PDFIndexingService(
        repository=repository,

        document_processor=(
            DocumentProcessor(
                ocr_enabled=False
            )
        ),

        chunker=(
            SentenceAwareChunker()
        ),

        embedding_service=(
            FakeEmbeddingService()
        ),

        vector_store=(
            vector_store
        ),
    )

    try:

        result = service.index_pdf(
            project_id=project_id,

            source_id=source.id,

            source_version_id=(
                source_version.id
            ),

            pdf_path=pdf_path,

            title="Research Paper",

            image_output_directory=(
                images_directory
            ),
        )

        assert (
            result.chunks_indexed
            >= 1
        )

        assert (
            result.document.source_id
            == source.id
        )

        assert (
            result.document_version
            .source_version_id
            == source_version.id
        )

        assert (
            result.document_version
            .content_hash
            == sha256_file(
                pdf_path
            )
        )

        assert len(
            result.chunk_ids
        ) == result.chunks_indexed

    finally:
        repository.delete_source(
            source.id
        )


def test_indexed_pdf_is_dense_retrievable(
    tmp_path,
):

    repository = VersionRepository()

    vector_store = PgVectorStore()

    embedding_service = (
        FakeEmbeddingService()
    )

    project_id = str(
        uuid.uuid4()
    )

    pdf_path = (
        tmp_path
        / "retrieval.pdf"
    )

    images_directory = (
        tmp_path
        / "images"
    )

    create_test_pdf(
        pdf_path
    )

    source, source_version = (
        create_source_chain(
            repository,
            project_id,
            pdf_path,
        )
    )

    service = PDFIndexingService(
        repository=repository,

        document_processor=(
            DocumentProcessor(
                ocr_enabled=False
            )
        ),

        chunker=(
            SentenceAwareChunker()
        ),

        embedding_service=(
            embedding_service
        ),

        vector_store=(
            vector_store
        ),
    )

    try:

        indexing_result = (
            service.index_pdf(
                project_id=project_id,

                source_id=source.id,

                source_version_id=(
                    source_version.id
                ),

                pdf_path=pdf_path,

                title="Retrieval Paper",

                image_output_directory=(
                    images_directory
                ),
            )
        )

        query_embedding = (
            embedding_service
            .embed_query(
                "artificial intelligence"
            )
        )

        results = (
            vector_store.dense_search(
                query_embedding=(
                    query_embedding
                ),

                project_id=project_id,

                top_k=10,
            )
        )

        assert results

        returned_chunk_ids = {
            result.chunk_id
            for result in results
        }

        assert (
            indexing_result.chunk_ids[0]
            in returned_chunk_ids
        )

        matched = next(
            result
            for result in results
            if (
                result.chunk_id
                == indexing_result.chunk_ids[0]
            )
        )

        assert (
            matched.document_version_id
            == indexing_result
            .document_version.id
        )

        assert (
            matched.source_version_id
            == source_version.id
        )

    finally:
        repository.delete_source(
            source.id
        )