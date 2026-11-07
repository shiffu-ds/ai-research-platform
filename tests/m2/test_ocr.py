from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from rag_m2.ingestion.pdf_processor import PDFProcessor


def get_test_font():
    font_candidates = [
        Path(r"C:\Windows\Fonts\arial.ttf"),
        Path(r"C:\Windows\Fonts\calibri.ttf"),
        Path(r"C:\Windows\Fonts\segoeui.ttf"),
    ]

    for font_path in font_candidates:
        if font_path.exists():
            return ImageFont.truetype(
                str(font_path),
                72,
            )

    return ImageFont.load_default()


def create_image_only_pdf(output_path: Path):
    image = Image.new(
        "RGB",
        (1800, 1000),
        "white",
    )

    draw = ImageDraw.Draw(image)
    font = get_test_font()

    draw.text(
        (120, 250),
        "AUTONOMOUS AI RESEARCH PLATFORM",
        fill="black",
        font=font,
    )

    draw.text(
        (120, 430),
        "RELIABLE EVIDENCE RETRIEVAL",
        fill="black",
        font=font,
    )

    image.save(
        output_path,
        "PDF",
        resolution=150.0,
    )


def test_ocr_fallback_extracts_image_only_pdf(tmp_path):
    pdf_path = tmp_path / "image_only.pdf"

    create_image_only_pdf(pdf_path)

    processor = PDFProcessor(
        ocr_enabled=True
    )

    pages = processor.process(pdf_path)

    assert len(pages) == 1

    page = pages[0]

    assert page.ocr_used is True

    assert page.ocr_status in {
        "OK",
        "LOW_CONFIDENCE",
    }

    assert page.ocr_confidence is not None

    extracted_text = page.text.upper()

    assert len(extracted_text) > 10
    assert "RESEARCH" in extracted_text
    assert "EVIDENCE" in extracted_text
