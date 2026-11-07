from __future__ import annotations

from typing import Protocol

from rag_m2.sources.models import (
    SearchResult,
)


class SearchProvider(Protocol):
    def search(
        self,
        query: str,
        max_results: int = 10,
    ) -> list[SearchResult]:
        ...