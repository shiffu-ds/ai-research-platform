from rag_m2.ingestion.document_processor import (
    DocumentProcessor,
)
from rag_m2.ingestion.models import (
    ExtractedImage,
    ExtractedTable,
)
from rag_m2.ingestion.table_extractor import (
    TableExtractor,
)
from rag_m2.schemas import (
    PageText,
)
from PIL import Image
import pymupdf

from rag_m2.ingestion.image_extractor import (
    ImageExtractor,
)
import uuid

import psycopg

from rag_m2.indexing.indexing_service import (
    IndexingPipelineError,
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

def test_normal_document_is_complete():

    status = (
        DocumentProcessor
        ._resolve_extraction_status(
            pages=[
                PageText(
                    page_number=1,
                    text="Normal document text.",
                    ocr_status="NOT_REQUIRED",
                )
            ],
            tables=[],
            images=[],
        )
    )

    assert status == "COMPLETE"


def test_low_confidence_ocr_makes_document_partial():

    status = (
        DocumentProcessor
        ._resolve_extraction_status(
            pages=[
                PageText(
                    page_number=1,
                    text="OCR text",
                    ocr_used=True,
                    ocr_confidence=0.60,
                    ocr_status="LOW_CONFIDENCE",
                )
            ],
            tables=[],
            images=[],
        )
    )

    assert status == "PARTIAL"


def test_partial_table_makes_document_partial():

    table = ExtractedTable(
        page_number=1,
        table_index=0,
        bbox=None,
        cell_bboxes=[],
        rows=[],
        unresolved_cells=2,
        total_cells=10,
        unresolved_ratio=0.20,
        extraction_status="PARTIAL",
    )

    status = (
        DocumentProcessor
        ._resolve_extraction_status(
            pages=[],
            tables=[table],
            images=[],
        )
    )

    assert status == "PARTIAL"


def test_problematic_image_makes_document_partial():

    image = ExtractedImage(
        page_number=1,
        image_index=0,
        file_path="test.png",
        extension="png",
        size_bytes=60000,
        width=1000,
        height=1000,
        sha256="a" * 64,
        positions=[],
        text_candidate=True,
        ocr_used=False,
        ocr_status="OCR_UNAVAILABLE",
    )

    status = (
        DocumentProcessor
        ._resolve_extraction_status(
            pages=[],
            tables=[],
            images=[image],
        )
    )


    assert status == "PARTIAL"


def test_image_ocr_requires_text_candidate(
    tmp_path,
):

    class TrackingExtractor(
        ImageExtractor
    ):

        def __init__(self):

            super().__init__(
                ocr_enabled=True
            )

            self.ocr_calls = 0

        def _ocr_image(
            self,
            raw_bytes,
        ):

            self.ocr_calls += 1

            return (
                "detected text",
                0.99,
                "OK",
            )

    image_path = (
        tmp_path
        / "image.png"
    )

    image = Image.effect_noise(
        (1000, 1000),
        100,
    )

    image.save(
        image_path
    )

    pdf_path = (
        tmp_path
        / "image-test.pdf"
    )

    pdf = pymupdf.open()

    page = pdf.new_page()

    page.insert_text(
        (40, 40),
        (
            "This is ordinary native PDF text. "
            * 10
        ),
    )

    page.insert_image(
        pymupdf.Rect(
            50,
            100,
            500,
            500,
        ),

        filename=str(
            image_path
        ),
    )

    pdf.save(
        pdf_path
    )

    pdf.close()

    extractor = (
        TrackingExtractor()
    )

    images = extractor.extract(
        pdf_path,
        tmp_path / "out",
    )

    assert images

    extracted = images[0]

    assert (
        extracted.page_number
        == 1
    )

    assert (
        extracted.size_bytes
        > 50 * 1024
    )

    assert (
        len(
            extracted.sha256
        )
        == 64
    )

    assert (
        extracted.positions
    )

    assert (
        len(
            extracted.positions[0]
        )
        == 4
    )

    assert (
        images[0].text_candidate
        is False
    )

    assert (
        images[0].ocr_used
        is False
    )

    assert (
        images[0].ocr_status
        == "NOT_CANDIDATE"
    )

    assert (
        extractor.ocr_calls
        == 0
    )

def test_failed_processing_creates_failed_document_version(
    tmp_path,
):

    class FailingProcessor:

        def process_pdf(
            self,
            file_path,
            image_output_directory,
        ):

            error = RuntimeError(
                "simulated parser failure"
            )

            error.error_code = (
                "SIMULATED_PARSE_FAILURE"
            )

            raise error


    class FakeEmbeddingService:

        model = (
            "compliance-test-embedding"
        )

        def embed_texts(
            self,
            texts,
        ):

            return [
                [
                    0.0
                    for _ in range(
                        3072
                    )
                ]
                for _ in texts
            ]


    repository = (
        VersionRepository()
    )

    project_id = str(
        uuid.uuid4()
    )

    pdf_path = (
        tmp_path
        / "failed.pdf"
    )

    pdf_path.write_bytes(
        b"%PDF-1.4 simulated failure"
    )

    source = (
        repository.create_source(
            project_id=project_id,

            canonical_url=(
                "https://example.com/"
                f"{uuid.uuid4()}.pdf"
            ),

            title=(
                "Failure Test"
            ),

            source_type="pdf",
        )
    )

    source_version = (
        repository
        .create_source_version(
            source_id=(
                source.id
            ),

            content_hash=(
                sha256_file(
                    pdf_path
                )
            ),

            final_url=(
                source.canonical_url
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

    service = (
        PDFIndexingService(
            repository=repository,

            document_processor=(
                FailingProcessor()
            ),

            chunker=(
                SentenceAwareChunker()
            ),

            embedding_service=(
                FakeEmbeddingService()
            ),

            vector_store=(
                PgVectorStore()
            ),
        )
    )

    try:

        try:

            service.index_pdf(
                project_id=(
                    project_id
                ),

                source_id=(
                    source.id
                ),

                source_version_id=(
                    source_version.id
                ),

                pdf_path=(
                    pdf_path
                ),

                title=(
                    "Failure Test"
                ),

                image_output_directory=(
                    tmp_path
                    / "images"
                ),
            )

            assert False, (
                "Expected "
                "IndexingPipelineError"
            )

        except IndexingPipelineError:

            pass


        with psycopg.connect(
            repository.database_url
        ) as connection:

            with connection.cursor() as cursor:

                cursor.execute(
                    """
                    SELECT
                        extraction_status,
                        error_code,
                        page_count

                    FROM m2_document_versions

                    WHERE source_version_id = %s;
                    """,
                    (
                        source_version.id,
                    ),
                )

                row = (
                    cursor.fetchone()
                )


        assert row is not None

        assert (
            row[0]
            == "FAILED"
        )

        assert (
            row[1]
            == "SIMULATED_PARSE_FAILURE"
        )

        assert (
            row[2]
            == 0
        )

    finally:

        repository.delete_source(
            source.id
        )    

def test_table_extraction_preserves_bounding_boxes(
    tmp_path,
):

    pdf_path = (
        tmp_path
        / "table-test.pdf"
    )

    document = pymupdf.open()

    page = document.new_page()

    # Draw a simple 2 x 2 table.
    x0 = 100
    y0 = 100

    cell_width = 150
    cell_height = 60

    x1 = x0 + cell_width
    x2 = x1 + cell_width

    y1 = y0 + cell_height
    y2 = y1 + cell_height

    # Horizontal lines
    page.draw_line(
        (x0, y0),
        (x2, y0),
    )

    page.draw_line(
        (x0, y1),
        (x2, y1),
    )

    page.draw_line(
        (x0, y2),
        (x2, y2),
    )

    # Vertical lines
    page.draw_line(
        (x0, y0),
        (x0, y2),
    )

    page.draw_line(
        (x1, y0),
        (x1, y2),
    )

    page.draw_line(
        (x2, y0),
        (x2, y2),
    )

    # Add cell text
    page.insert_text(
        (115, 135),
        "Name",
    )

    page.insert_text(
        (265, 135),
        "Score",
    )

    page.insert_text(
        (115, 195),
        "Ahmad",
    )

    page.insert_text(
        (265, 195),
        "95",
    )

    document.save(
        pdf_path
    )

    document.close()

    extractor = (
        TableExtractor()
    )

    tables = extractor.extract(
        pdf_path
    )

    assert tables

    table = tables[0]

    assert (
        table.page_number
        == 1
    )

    assert (
        table.table_index
        == 0
    )

    assert (
        table.bbox
        is not None
    )

    assert (
        len(
            table.bbox
        )
        == 4
    )

    assert (
        table.cell_bboxes
    )

    assert all(
        len(cell_bbox) == 4
        for cell_bbox
        in table.cell_bboxes
    )

    assert (
        table.total_cells
        >= 4
    )

    assert (
        table.extraction_status
        in {
            "COMPLETE",
            "PARTIAL",
        }
    )        