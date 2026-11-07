from pathlib import Path

from rag_m2.config import (
    settings,
)
from rag_m2.ingestion.image_extractor import (
    ImageExtractor,
)
from rag_m2.ingestion.models import (
    ProcessedDocument,
)
from rag_m2.ingestion.pdf_processor import (
    PDFProcessor,
)
from rag_m2.ingestion.table_extractor import (
    TableExtractor,
)
from rag_m2.utils.hashing import (
    sha256_file,
)


class DocumentProcessor:
    def __init__(
        self,
        ocr_enabled: bool = True,
        image_ocr_enabled: bool = (
            settings.image_ocr_enabled
        ),
    ):

        self.pdf_processor = (
            PDFProcessor(
                ocr_enabled=(
                    ocr_enabled
                )
            )
        )

        self.table_extractor = (
            TableExtractor()
        )

        self.image_extractor = (
            ImageExtractor(
                ocr_enabled=(
                    image_ocr_enabled
                )
            )
        )

    @staticmethod
    def _resolve_extraction_status(
        pages,
        tables,
        images,
    ) -> str:

        page_problem = any(
            page.ocr_status
            in {
                "LOW_CONFIDENCE",
                "OCR_UNAVAILABLE",
            }
            for page in pages
        )

        table_problem = any(
            table.extraction_status
            == "PARTIAL"
            for table in tables
        )

        image_problem = any(
            (
                image.text_candidate
                and image.ocr_status
                in {
                    "LOW_CONFIDENCE",
                    "OCR_UNAVAILABLE",
                    "OCR_FAILED",
                }
            )
            for image in images
        )

        if (
            page_problem
            or table_problem
            or image_problem
        ):
            return "PARTIAL"

        return "COMPLETE"

    def process_pdf(
        self,
        file_path: str | Path,
        image_output_directory: (
            str
            | Path
        ),
    ) -> ProcessedDocument:

        path = Path(
            file_path
        )

        pages = (
            self.pdf_processor
            .process(
                path
            )
        )

        tables = (
            self.table_extractor
            .extract(
                path
            )
        )

        images = (
            self.image_extractor
            .extract(
                path,
                image_output_directory,
            )
        )

        extraction_status = (
            self._resolve_extraction_status(
                pages=pages,
                tables=tables,
                images=images,
            )
        )

        return ProcessedDocument(
            file_path=str(
                path
            ),

            file_sha256=(
                sha256_file(
                    path
                )
            ),

            page_count=len(
                pages
            ),

            pages=pages,

            tables=tables,

            images=images,

            extraction_status=(
                extraction_status
            ),
        )