from pathlib import Path

import pymupdf

from rag_m2.ingestion.image_extractor import (
    ImageExtractor,
)
from rag_m2.ingestion.table_extractor import (
    TableExtractor,
)


def create_simple_pdf(
    path: Path,
):

    document = pymupdf.open()

    page = document.new_page()

    page.insert_text(
        (72, 72),
        "Simple document without tables or images.",
    )

    document.save(
        path
    )

    document.close()


def test_extractors_handle_empty_pdf_content(
    tmp_path,
):

    pdf_path = (
        tmp_path
        / "simple.pdf"
    )

    image_directory = (
        tmp_path
        / "images"
    )

    create_simple_pdf(
        pdf_path
    )

    table_extractor = (
        TableExtractor()
    )

    image_extractor = (
        ImageExtractor()
    )

    tables = (
        table_extractor.extract(
            pdf_path
        )
    )

    images = (
        image_extractor.extract(
            pdf_path,
            image_directory,
        )
    )

    assert tables == []

    assert images == []