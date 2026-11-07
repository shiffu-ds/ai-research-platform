from __future__ import annotations

from rag_m2.sources.models import (
    CandidateSource,
)
from rag_m2.sources.provider import (
    SearchProvider,
)
from rag_m2.sources.reputation import (
    authority_level_for_url,
    publisher_reputation_for_url,
)
from rag_m2.sources.scoring import (
    authority_score,
    freshness_score,
)


class SourceDiscoveryService:
    def __init__(
        self,
        provider: SearchProvider,
    ):
        self.provider = provider

    def discover(
        self,
        query: str,
        max_results: int = 10,
    ) -> list[CandidateSource]:

        if not query.strip():
            raise ValueError(
                "Search query cannot be empty."
            )

        if max_results <= 0:
            raise ValueError(
                "max_results must be greater than zero."
            )

        results = self.provider.search(
            query=query,
            max_results=max_results,
        )

        candidates: list[
            CandidateSource
        ] = []

        seen_urls: set[str] = set()

        for result in results:

            url = result.url.strip()

            if not url:
                continue

            if url in seen_urls:
                continue

            seen_urls.add(url)

            authority = (
                authority_level_for_url(
                    url
                )
            )

            reputation = (
                publisher_reputation_for_url(
                    url
                )
            )

            freshness = freshness_score(
                result.published_at
            )

            final_authority_score = (
                authority_score(
                    authority_level=authority,
                    freshness=freshness,
                    publisher_reputation=(
                        reputation
                    ),
                )
            )

            candidates.append(
                CandidateSource(
                    url=url,
                    title=result.title,
                    snippet=result.snippet,
                    publisher=result.publisher,
                    published_at=(
                        result.published_at
                    ),
                    source_type="web",
                    authority_level=authority,
                    freshness_score=(
                        freshness
                    ),
                    publisher_reputation=(
                        reputation
                    ),
                    authority_score=(
                        final_authority_score
                    ),
                    metadata=dict(
                        result.metadata
                    ),
                )
            )

        candidates.sort(
            key=lambda item: (
                item.authority_score
            ),
            reverse=True,
        )

        return candidates[
            :max_results
        ]