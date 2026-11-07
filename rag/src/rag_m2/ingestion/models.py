from dataclasses import dataclass, field
from pathlib import Path

from rag_m2.schemas import PageText


@dataclass
class ExtractedTable:
    page_number: int
    table_index: int

    bbox: tuple[
        float,
        float,
        float,
        float,
    ] | None

    cell_bboxes: list[
        tuple[
            float,
            float,
            float,
            float,
        ]
    ]

    rows: list[list[str | None]]

    unresolved_cells: int
    total_cells: int
    unresolved_ratio: float

    extraction_status: str


@dataclass
class ExtractedImage:
    page_number: int
    image_index: int

    file_path: str
    extension: str

    size_bytes: int

    width: int
    height: int

    sha256: str

    positions: list[
        tuple[
            float,
            float,
            float,
            float,
        ]
    ] = field(
        default_factory=list
    )
    
    text_candidate: bool = False

    ocr_used: bool = False

    ocr_text: str | None = None

    ocr_confidence: float | None = None

    ocr_status: str = "NOT_CANDIDATE"


@dataclass
class ProcessedDocument:
    file_path: str
    file_sha256: str

    page_count: int

    pages: list[PageText]

    tables: list[ExtractedTable]

    images: list[ExtractedImage]

    extraction_status: str = "COMPLETE"

    error_code: str | None = None

    @property
    def filename(self) -> str:
        return Path(
            self.file_path
        ).name