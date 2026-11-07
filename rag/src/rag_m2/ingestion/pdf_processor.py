import io
from pathlib import Path
import shutil

import pymupdf
import pytesseract
from PIL import Image

from rag_m2.config import settings
from rag_m2.preprocessing.normalizer import normalize_text
from rag_m2.schemas import PageText


class PDFValidationError(ValueError):
    pass


class PDFProcessingError(RuntimeError):
    def __init__(
        self,
        error_code: str,
        message: str,
    ):
        super().__init__(message)

        self.error_code = error_code


def validate_pdf(
    file_path: str | Path,
) -> Path:

    path = Path(file_path)

    if not path.exists():
        raise PDFValidationError(
            f"File does not exist: {path}"
        )

    if not path.is_file():
        raise PDFValidationError(
            f"Path is not a file: {path}"
        )

    max_size = (
        settings.max_upload_mb
        * 1024
        * 1024
    )

    if path.stat().st_size > max_size:
        raise PDFValidationError(
            f"PDF exceeds maximum size of "
            f"{settings.max_upload_mb} MB"
        )

    # Content validation.
    # Do not trust extension alone.
    with path.open("rb") as file:
        header = file.read(5)

    if header != b"%PDF-":
        raise PDFValidationError(
            "File content is not a valid PDF."
        )

    return path


class PDFProcessor:
    def __init__(
        self,
        ocr_enabled: bool = settings.ocr_enabled,
        tesseract_cmd: str | None = settings.tesseract_cmd,
    ):
        self.ocr_enabled = ocr_enabled

        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = (
                tesseract_cmd
            )

    @staticmethod
    def _text_coverage_ratio(
        page: pymupdf.Page,
    ) -> float:

        page_area = page.rect.get_area()

        if page_area <= 0:
            return 0.0

        total_text_area = 0.0

        blocks = page.get_text(
            "blocks"
        )

        for block in blocks:

            if len(block) < 5:
                continue

            text = str(
                block[4]
            ).strip()

            if not text:
                continue

            rect = pymupdf.Rect(
                block[0],
                block[1],
                block[2],
                block[3],
            )

            area = max(
                rect.get_area(),
                0.0,
            )

            total_text_area += area

        return min(
            total_text_area
            / page_area,
            1.0,
        )

    @staticmethod
    def _tesseract_available() -> bool:

        configured = (
            pytesseract
            .pytesseract
            .tesseract_cmd
        )

        if configured:
            configured_path = Path(
                configured
            )

            if configured_path.exists():
                return True

        return (
            shutil.which(
                "tesseract"
            )
            is not None
        )

    def _ocr_page(
        self,
        page: pymupdf.Page,
    ) -> tuple[
        str,
        float | None,
        str,
    ]:

        if not self._tesseract_available():
            return (
                "",
                None,
                "OCR_UNAVAILABLE",
            )

        matrix = pymupdf.Matrix(
            2.0,
            2.0,
        )

        pixmap = page.get_pixmap(
            matrix=matrix,
            alpha=False,
        )

        image_bytes = pixmap.tobytes(
            "png"
        )

        image = Image.open(
            io.BytesIO(
                image_bytes
            )
        )

        result = pytesseract.image_to_data(
            image,
            output_type=pytesseract.Output.DICT,
        )

        words: list[str] = []
        confidences: list[float] = []

        texts = result.get(
            "text",
            [],
        )

        raw_confidences = result.get(
            "conf",
            [],
        )

        for word, raw_confidence in zip(
            texts,
            raw_confidences,
        ):

            word = str(
                word
            ).strip()

            try:
                confidence = float(
                    raw_confidence
                )
            except (
                TypeError,
                ValueError,
            ):
                confidence = -1

            if word:
                words.append(
                    word
                )

            if confidence >= 0:
                confidences.append(
                    confidence
                )

        text = normalize_text(
            " ".join(
                words
            )
        )

        if confidences:
            mean_confidence = (
                sum(confidences)
                / len(confidences)
                / 100.0
            )
        else:
            mean_confidence = 0.0

        if (
            mean_confidence
            < settings.ocr_confidence_threshold
        ):
            status = "LOW_CONFIDENCE"
        else:
            status = "OK"

        return (
            text,
            mean_confidence,
            status,
        )

    def process(
        self,
        file_path: str | Path,
    ) -> list[PageText]:

        path = validate_pdf(
            file_path
        )

        try:
            document = pymupdf.open(
                path
            )
        except Exception as exc:
            raise PDFProcessingError(
                "PDF_OPEN_FAILED",
                f"Unable to open PDF: {exc}",
            ) from exc

        pages: list[PageText] = []

        try:

            for page_index in range(
                document.page_count
            ):

                page = document.load_page(
                    page_index
                )

                raw_text = page.get_text(
                    "text"
                )

                normalized_text = normalize_text(
                    raw_text
                )

                coverage = (
                    self._text_coverage_ratio(
                        page
                    )
                )

                ocr_used = False
                ocr_confidence = None
                ocr_status = "NOT_REQUIRED"

                if (
                    coverage
                    < settings.pdf_text_coverage_threshold
                ):

                    if self.ocr_enabled:

                        (
                            ocr_text,
                            ocr_confidence,
                            ocr_status,
                        ) = self._ocr_page(
                            page
                        )

                        if ocr_text:
                            normalized_text = (
                                ocr_text
                            )

                            ocr_used = True

                    else:
                        ocr_status = (
                            "OCR_DISABLED"
                        )

                pages.append(
                    PageText(
                        page_number=(
                            page_index
                            + 1
                        ),
                        text=normalized_text,
                        text_coverage=coverage,
                        ocr_used=ocr_used,
                        ocr_confidence=(
                            ocr_confidence
                        ),
                        ocr_status=(
                            ocr_status
                        ),
                    )
                )

        except Exception as exc:

            raise PDFProcessingError(
                "PDF_EXTRACTION_FAILED",
                f"PDF extraction failed: {exc}",
            ) from exc

        finally:
            document.close()

        return pages