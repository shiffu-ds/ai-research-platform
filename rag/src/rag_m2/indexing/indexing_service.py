from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, Sequence
from rag_m2.utils.hashing import (
    sha256_file,
)
from rag_m2.config import settings
from rag_m2.ingestion.document_processor import (
    DocumentProcessor,
)
from rag_m2.preprocessing.chunker import (
    SentenceAwareChunker,
)
from rag_m2.sources.version_repository import (
    VersionRepository,
)
from rag_m2.sources.versioning_models import (
    DocumentRecord,
    DocumentVersionRecord,
)
from rag_m2.vector_store.pgvector_store import (
    PgVectorStore,
)


class EmbeddingService(Protocol):
    model: str

    def embed_texts(
        self,
        texts: Sequence[str],
    ) -> list[list[float]]:
        ...


class IndexingPipelineError(
    RuntimeError
):
    pass


@dataclass(frozen=True)
class IndexingResult:
    document: DocumentRecord
    document_version: DocumentVersionRecord

    chunk_ids: list[str]

    chunks_indexed: int


class PDFIndexingService:
    """
    M2 bridge between:

    document processing
        -> immutable document version
        -> chunking
        -> embeddings
        -> pgvector indexing
    """

    def __init__(
        self,
        repository: VersionRepository,
        document_processor: DocumentProcessor,
        chunker: SentenceAwareChunker,
        embedding_service: EmbeddingService,
        vector_store: PgVectorStore,
        parser_version: str = "m2-pdf-pipeline-v1",
    ):
        self.repository = repository

        self.document_processor = (
            document_processor
        )

        self.chunker = chunker

        self.embedding_service = (
            embedding_service
        )

        self.vector_store = vector_store

        self.parser_version = (
            parser_version
        )

    @staticmethod
    def _resolve_ocr_status(
        processed_document,
    ) -> str:

        statuses = {
            page.ocr_status
            for page in processed_document.pages
        }

        if "LOW_CONFIDENCE" in statuses:
            return "LOW_CONFIDENCE"

        if "OCR_UNAVAILABLE" in statuses:
            return "OCR_UNAVAILABLE"

        if "OCR_DISABLED" in statuses:
            return "OCR_DISABLED"

        if "OK" in statuses:
            return "OK"

        return "NOT_REQUIRED"

    def index_pdf(
        self,
        project_id: str,
        source_id: str,
        source_version_id: str,
        pdf_path: str | Path,
        title: str,
        image_output_directory: str | Path,
    ) -> IndexingResult:

        if not project_id.strip():
            raise ValueError(
                "project_id cannot be empty."
            )

        if not source_id.strip():
            raise ValueError(
                "source_id cannot be empty."
            )

        if not source_version_id.strip():
            raise ValueError(
                "source_version_id cannot be empty."
            )

        if not title.strip():
            raise ValueError(
                "title cannot be empty."
            )

        pdf_path = Path(
            pdf_path
        )

        # ----------------------------------
        # 1. Create logical document first
        #
        # If PDF processing fails, we still
        # need a document record so that the
        # failed DocumentVersion can be saved.
        # ----------------------------------

        document = (
            self.repository.create_document(
                project_id=project_id,
                source_id=source_id,
                title=title,
            )
        )

        # ----------------------------------
        # 2. Process PDF
        # ----------------------------------

        try:

            processed = (
                self.document_processor
                .process_pdf(
                    pdf_path,
                    image_output_directory,
                )
            )

        except Exception as exc:

            error_code = getattr(
                exc,
                "error_code",
                "DOCUMENT_PROCESSING_FAILED",
            )

            # Save the failed processing attempt
            # if the source file actually exists.
            if (
                pdf_path.exists()
                and pdf_path.is_file()
            ):

                try:

                    self.repository.create_document_version(
                        document_id=(
                            document.id
                        ),

                        source_version_id=(
                            source_version_id
                        ),

                        content_hash=(
                            sha256_file(
                                pdf_path
                            )
                        ),

                        parser_version=(
                            self.parser_version
                        ),

                        page_count=0,

                        storage_location=(
                            pdf_path
                            .resolve()
                            .as_uri()
                        ),

                        extraction_metadata={
                            "failure_stage":
                                "document_processing",

                            "exception_type":
                                exc
                                .__class__
                                .__name__,
                        },

                        ocr_status=(
                            "NOT_REQUIRED"
                        ),

                        extraction_status=(
                            "FAILED"
                        ),

                        error_code=str(
                            error_code
                        ),
                    )

                except Exception as persistence_error:

                    raise IndexingPipelineError(
                        "Document processing failed "
                        "and the FAILED document "
                        "version could not be saved: "
                        f"{persistence_error}"
                    ) from exc

            raise IndexingPipelineError(
                "Document processing failed: "
                f"{exc}"
            ) from exc

        # ----------------------------------
        # 3. Persist immutable
        #    DocumentVersion
        # ----------------------------------

        extraction_metadata = {
            "table_count": len(
                processed.tables
            ),

            "image_count": len(
                processed.images
            ),

            "page_count": (
                processed.page_count
            ),

            "pages": [
                {
                    "page_number":
                        page.page_number,

                    "ocr_used":
                        page.ocr_used,

                    "ocr_confidence":
                        page.ocr_confidence,

                    "ocr_status":
                        page.ocr_status,

                    "text_coverage":
                        page.text_coverage,
                }
                for page
                in processed.pages
            ],

            "tables": [
                {
                    "page_number":
                        table.page_number,

                    "table_index":
                        table.table_index,

                    "extraction_status":
                        table.extraction_status,

                    "unresolved_ratio":
                        table.unresolved_ratio,

                    "bbox":
                        table.bbox,
                }
                for table
                in processed.tables
            ],

            "images": [
                {
                    "page_number":
                        image.page_number,

                    "image_index":
                        image.image_index,

                    "size_bytes":
                        image.size_bytes,

                    "sha256":
                        image.sha256,

                    "positions":
                        image.positions,

                    "text_candidate":
                        image.text_candidate,

                    "ocr_used":
                        image.ocr_used,

                    "ocr_confidence":
                        image.ocr_confidence,

                    "ocr_status":
                        image.ocr_status,
                }
                for image
                in processed.images
            ],
        }

        document_version = (
            self.repository
            .create_document_version(
                document_id=document.id,

                source_version_id=(
                    source_version_id
                ),

                content_hash=(
                    processed.file_sha256
                ),

                parser_version=(
                    self.parser_version
                ),

                page_count=(
                    processed.page_count
                ),

                storage_location=(
                    pdf_path
                    .resolve()
                    .as_uri()
                ),

                extraction_metadata=(
                    extraction_metadata
                ),

                ocr_status=(
                    self._resolve_ocr_status(
                        processed
                    )
                ),

                extraction_status=(
                    processed.extraction_status
                ),

                error_code=(
                    processed.error_code
                ),
            )
        )

        # ----------------------------------
        # 4. Chunk pages
        # ----------------------------------

        chunks = (
            self.chunker.chunk_pages(
                pages=processed.pages,

                project_id=project_id,

                document_version_id=(
                    document_version.id
                ),
            )
        )

        if not chunks:
            return IndexingResult(
                document=document,

                document_version=(
                    document_version
                ),

                chunk_ids=[],

                chunks_indexed=0,
            )

        # ----------------------------------
        # 5. Generate embeddings
        # ----------------------------------

        try:
            embeddings = (
                self.embedding_service
                .embed_texts(
                    [
                        chunk.text
                        for chunk in chunks
                    ]
                )
            )

        except Exception as exc:
            raise IndexingPipelineError(
                f"Embedding generation failed: {exc}"
            ) from exc

        if (
            len(embeddings)
            != len(chunks)
        ):
            raise IndexingPipelineError(
                "Embedding count does not match "
                "chunk count."
            )

        # ----------------------------------
        # 6. Store chunks + provenance
        # ----------------------------------

        stored_chunk_ids: list[str] = []

        embedding_model = getattr(
            self.embedding_service,
            "model",
            settings.embedding_model,
        )

        try:

            for chunk, embedding in zip(
                chunks,
                embeddings,
            ):

                self.vector_store.upsert_chunk(
                    chunk=chunk,

                    embedding=embedding,

                    source_version_id=(
                        source_version_id
                    ),

                    embedding_model=(
                        embedding_model
                    ),
                )

                stored_chunk_ids.append(
                    chunk.id
                )

        except Exception as exc:

            # Avoid leaving a partially indexed
            # document in the development store.
            for chunk_id in stored_chunk_ids:
                try:
                    self.vector_store.delete_chunk(
                        chunk_id
                    )
                except Exception:
                    pass

            raise IndexingPipelineError(
                f"Vector indexing failed: {exc}"
            ) from exc

        return IndexingResult(
            document=document,

            document_version=(
                document_version
            ),

            chunk_ids=stored_chunk_ids,

            chunks_indexed=len(
                stored_chunk_ids
            ),
        )