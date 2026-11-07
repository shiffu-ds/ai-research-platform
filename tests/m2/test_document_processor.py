from pathlib import Path

import pymupdf

from rag_m2.ingestion.document_processor import (
    DocumentProcessor,
)


def create_document(
    path: Path,
):

    document = pymupdf.open()

    page = document.new_page()

    page.insert_text(
        (72, 72),
        (
            "Artificial intelligence research "
            "requires reliable evidence."
        ),
    )

    document.save(
        path
    )

    document.close()


def test_complete_document_processing(
    tmp_path,
):

    pdf_path = (
        tmp_path
        / "research.pdf"
    )

    images_directory = (
        tmp_path
        / "images"
    )

    create_document(
        pdf_path
    )

    processor = DocumentProcessor(
        ocr_enabled=False
    )

    result = processor.process_pdf(
        pdf_path,
        images_directory,
    )

    assert result.page_count == 1

    assert len(
        result.file_sha256
    ) == 64

    assert (
        "Artificial intelligence"
        in result.pages[0].text
    )

    assert result.extraction_status == (
        "COMPLETE"
    )