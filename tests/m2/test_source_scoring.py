from datetime import (
    datetime,
    timedelta,
    timezone,
)

from rag_m2.sources.scoring import (
    authority_score,
    freshness_score,
)


def test_authority_formula():

    result = authority_score(
        authority_level=1.0,
        freshness=1.0,
        publisher_reputation=1.0,
    )

    assert result == 1.0


def test_freshness_half_life():

    now = datetime.now(
        timezone.utc
    )

    published = (
        now
        - timedelta(days=30)
    )

    result = freshness_score(
        published_at=published,
        now=now,
        half_life_days=30,
    )

    assert 0.49 <= result <= 0.51