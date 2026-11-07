from datetime import (
    datetime,
    timezone,
)

from rag_m2.sources.discovery import (
    SourceDiscoveryService,
)
from rag_m2.sources.models import (
    SearchResult,
)


class FakeSearchProvider:
    def search(
        self,
        query,
        max_results=10,
    ):
        return [
            SearchResult(
                url=(
                    "https://www.who.int/"
                    "health-topic"
                ),
                title="WHO Health Research",
                snippet=(
                    "Evidence about health."
                ),
                publisher="WHO",
                published_at=datetime.now(
                    timezone.utc
                ),
            ),
            SearchResult(
                url=(
                    "https://example.com/"
                    "article"
                ),
                title="General Article",
                snippet=(
                    "General health article."
                ),
                publisher="Example",
                published_at=None,
            ),
        ]


def test_source_discovery_returns_candidates():

    service = SourceDiscoveryService(
        provider=FakeSearchProvider()
    )

    results = service.discover(
        query="AI healthcare research",
        max_results=10,
    )

    assert len(results) == 2

    assert (
        results[0].url
        == "https://www.who.int/health-topic"
    )


def test_authority_source_ranks_higher():

    service = SourceDiscoveryService(
        provider=FakeSearchProvider()
    )

    results = service.discover(
        query="health evidence",
    )

    assert (
        results[0].authority_score
        > results[1].authority_score
    )


def test_source_discovery_rejects_empty_query():

    service = SourceDiscoveryService(
        provider=FakeSearchProvider()
    )

    try:
        service.discover("")
        assert False

    except ValueError:
        assert True