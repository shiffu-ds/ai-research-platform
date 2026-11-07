from dataclasses import dataclass, field
from typing import Any


@dataclass
class CandidateChunk:
    chunk_id: str
    project_id: str
    document_version_id: str

    source_version_id: str | None

    text: str
    page_number: int | None

    metadata: dict[str, Any] = field(
        default_factory=dict
    )

    dense_score: float | None = None
    lexical_score: float | None = None

    rrf_score: float = 0.0

    rerank_score: float | None = None