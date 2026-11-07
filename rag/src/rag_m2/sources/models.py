from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class SearchResult:
    url: str
    title: str

    snippet: str = ""

    published_at: datetime | None = None

    publisher: str | None = None

    metadata: dict[str, Any] = field(
        default_factory=dict
    )


@dataclass
class CandidateSource:
    url: str
    title: str

    snippet: str

    publisher: str | None
    published_at: datetime | None

    source_type: str

    authority_level: float
    freshness_score: float
    publisher_reputation: float

    authority_score: float

    metadata: dict[str, Any] = field(
        default_factory=dict
    )