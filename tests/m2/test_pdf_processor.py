from pathlib import Path

import pymupdf
import pytest

from rag_m2.ingestion.pdf_processor import (
    PDFProcessor,
    PDFValidationError,
)


def create_test_pdf(
    path: Path,
):

    document = pymupdf.open()

    page = document.new_page()

    page.insert_text(
        (72, 72),
        (
            "Autonomous AI Research Platform "
            "supports evidence retrieval."
        ),
    )

    document.save(
        path
    )

    document.close()


def test_pdf_processor_extracts_text(
    tmp_path,
):

    pdf_path = (
        tmp_path
        / "sample.pdf"
    )

    create_test_pdf(
        pdf_path
    )

    processor = PDFProcessor(
        ocr_enabled=False
    )

    pages = processor.process(
        pdf_path
    )

    assert len(pages) == 1

    assert (
        "Autonomous AI Research Platform"
        in pages[0].text
    )

    assert pages[0].page_number == 1


def test_pdf_validation_rejects_fake_pdf(
    tmp_path,
):

    fake_pdf = (
        tmp_path
        / "fake.pdf"
    )

    fake_pdf.write_text(
        "This is not a PDF.",
        encoding="utf-8",
    )

    processor = PDFProcessor(
        ocr_enabled=False
    )

    with pytest.raises(
        PDFValidationError
    ):
        processor.process(
            fake_pdf
        )