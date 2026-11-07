from __future__ import annotations

import io
from pathlib import Path
import shutil

import pymupdf
import pytesseract
from PIL import Image

from rag_m2.config import settings
from rag_m2.ingestion.models import (
    ExtractedImage,
)
from rag_m2.preprocessing.normalizer import (
    normalize_text,
)
from rag_m2.utils.hashing import (
    sha256_bytes,
)


class ImageExtractor:
    """
    Extract embedded PDF images larger than the
    configured minimum.

    Image OCR is gated by a conservative text
    candidate heuristic. Ordinary images are not
    sent to OCR.
    """

    def __init__(
        self,
        ocr_enabled: bool = (
            settings.image_ocr_enabled
        ),
        tesseract_cmd: str | None = (
            settings.tesseract_cmd
        ),
    ):
        self.ocr_enabled = (
            ocr_enabled
        )

        if tesseract_cmd:

            pytesseract.pytesseract.tesseract_cmd = (
                tesseract_cmd
            )

    @staticmethod
    def _tesseract_available() -> bool:

        configured = (
            pytesseract
            .pytesseract
            .tesseract_cmd
        )

        if configured:

            path = Path(
                configured
            )

            if path.exists():
                return True

        return (
            shutil.which(
                "tesseract"
            )
            is not None
        )

    @staticmethod
    def _is_text_candidate(
        page: pymupdf.Page,
        positions: list[
            tuple[
                float,
                float,
                float,
                float,
            ]
        ],
    ) -> bool:
        """
        Conservative heuristic.

        An embedded image is considered a
        possible text/scanned-page image when:

        1. the PDF page has little native text,
        and
        2. the image occupies a significant
           fraction of the page.

        This prevents ordinary illustrations
        inside text-heavy pages from being sent
        to OCR unnecessarily.
        """

        native_text = (
            page.get_text(
                "text"
            ).strip()
        )

        if len(native_text) >= 80:
            return False

        if not positions:
            return False

        page_area = (
            page.rect.get_area()
        )

        if page_area <= 0:
            return False

        largest_image_area = max(
            (
                pymupdf.Rect(
                    *position
                ).get_area()
            )
            for position
            in positions
        )

        image_ratio = (
            largest_image_area
            / page_area
        )

        return image_ratio >= 0.25

    def _ocr_image(
        self,
        raw_bytes: bytes,
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

        try:

            image = Image.open(
                io.BytesIO(
                    raw_bytes
                )
            ).convert(
                "RGB"
            )

            result = (
                pytesseract.image_to_data(
                    image,

                    output_type=(
                        pytesseract
                        .Output
                        .DICT
                    ),
                )
            )

        except Exception:

            return (
                "",
                None,
                "OCR_FAILED",
            )

        words: list[str] = []

        confidences: list[
            float
        ] = []

        for (
            word,
            raw_confidence,
        ) in zip(
            result.get(
                "text",
                [],
            ),
            result.get(
                "conf",
                [],
            ),
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

                confidence = -1.0

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
                sum(
                    confidences
                )
                / len(
                    confidences
                )
                / 100.0
            )

        else:

            mean_confidence = 0.0

        if (
            mean_confidence
            < settings
            .ocr_confidence_threshold
        ):

            status = (
                "LOW_CONFIDENCE"
            )

        else:

            status = "OK"

        return (
            text,
            mean_confidence,
            status,
        )

    def extract(
        self,
        file_path: str | Path,
        output_directory: str | Path,
    ) -> list[
        ExtractedImage
    ]:

        output_directory = Path(
            output_directory
        )

        output_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        document = pymupdf.open(
            file_path
        )

        extracted_images: list[
            ExtractedImage
        ] = []

        try:

            for page_index in range(
                document.page_count
            ):

                page = (
                    document.load_page(
                        page_index
                    )
                )

                images = (
                    page.get_images(
                        full=True
                    )
                )

                seen_xrefs: set[int] = (
                    set()
                )

                for (
                    image_index,
                    image,
                ) in enumerate(
                    images
                ):

                    xref = int(
                        image[0]
                    )

                    if xref in seen_xrefs:
                        continue

                    seen_xrefs.add(
                        xref
                    )

                    image_data = (
                        document.extract_image(
                            xref
                        )
                    )

                    raw_bytes = (
                        image_data.get(
                            "image",
                            b"",
                        )
                    )

                    if (
                        len(raw_bytes)
                        <= settings.image_min_bytes
                    ):
                        continue

                    extension = (
                        image_data.get(
                            "ext",
                            "bin",
                        )
                    )

                    width = int(
                        image_data.get(
                            "width",
                            0,
                        )
                    )

                    height = int(
                        image_data.get(
                            "height",
                            0,
                        )
                    )

                    digest = (
                        sha256_bytes(
                            raw_bytes
                        )
                    )

                    filename = (
                        f"page_{page_index + 1}_"
                        f"image_{image_index}_"
                        f"{digest[:12]}."
                        f"{extension}"
                    )

                    destination = (
                        output_directory
                        / filename
                    )

                    destination.write_bytes(
                        raw_bytes
                    )

                    positions: list[
                        tuple[
                            float,
                            float,
                            float,
                            float,
                        ]
                    ] = []

                    try:

                        rects = (
                            page
                            .get_image_rects(
                                xref
                            )
                        )

                        for rect in rects:

                            positions.append(
                                (
                                    float(
                                        rect.x0
                                    ),
                                    float(
                                        rect.y0
                                    ),
                                    float(
                                        rect.x1
                                    ),
                                    float(
                                        rect.y1
                                    ),
                                )
                            )

                    except Exception:

                        positions = []

                    text_candidate = (
                        self._is_text_candidate(
                            page=page,
                            positions=positions,
                        )
                    )

                    ocr_used = False
                    ocr_text = None
                    ocr_confidence = None

                    if not text_candidate:

                        ocr_status = (
                            "NOT_CANDIDATE"
                        )

                    elif not self.ocr_enabled:

                        ocr_status = (
                            "OCR_SKIPPED"
                        )

                    else:

                        (
                            extracted_text,
                            ocr_confidence,
                            ocr_status,
                        ) = self._ocr_image(
                            raw_bytes
                        )

                        if (
                            ocr_status
                            not in {
                                "OCR_UNAVAILABLE",
                                "OCR_FAILED",
                            }
                        ):

                            ocr_used = True

                        if extracted_text:

                            ocr_text = (
                                extracted_text
                            )

                    extracted_images.append(
                        ExtractedImage(
                            page_number=(
                                page_index
                                + 1
                            ),

                            image_index=(
                                image_index
                            ),

                            file_path=str(
                                destination
                            ),

                            extension=(
                                extension
                            ),

                            size_bytes=len(
                                raw_bytes
                            ),

                            width=width,

                            height=height,

                            sha256=digest,

                            positions=(
                                positions
                            ),

                            text_candidate=(
                                text_candidate
                            ),

                            ocr_used=(
                                ocr_used
                            ),

                            ocr_text=(
                                ocr_text
                            ),

                            ocr_confidence=(
                                ocr_confidence
                            ),

                            ocr_status=(
                                ocr_status
                            ),
                        )
                    )

        finally:

            document.close()

        return extracted_images