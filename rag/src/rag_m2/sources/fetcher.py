from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True)
class FetchedSource:
    requested_url: str
    final_url: str

    content: bytes

    http_status: int
    content_type: str | None

    retrieved_at: datetime
    published_at: datetime | None = None

    headers: dict[str, str] = field(
        default_factory=dict
    )


class SourceFetcher(Protocol):
    """
    Contract for a secure source fetcher.

    The production implementation must enforce
    the platform's SSRF protection requirements.
    """

    def fetch(
        self,
        url: str,
    ) -> FetchedSource:
        ...