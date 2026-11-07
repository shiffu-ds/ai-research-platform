from __future__ import annotations

from datetime import datetime, timezone
import math


def clamp_score(value: float) -> float:
    return max(
        0.0,
        min(1.0, float(value))
    )


def freshness_score(
    published_at: datetime | None,
    now: datetime | None = None,
    half_life_days: float = 30.0,
) -> float:
    """
    Time-sensitive freshness score.

    1.0 = newly published.
    Score halves every configured half-life.
    """

    if published_at is None:
        return 0.5

    if half_life_days <= 0:
        raise ValueError(
            "half_life_days must be greater than zero."
        )

    now = (
        now
        or datetime.now(timezone.utc)
    )

    if published_at.tzinfo is None:
        published_at = published_at.replace(
            tzinfo=timezone.utc
        )

    age_seconds = (
        now - published_at
    ).total_seconds()

    age_days = max(
        age_seconds / 86400.0,
        0.0,
    )

    score = math.pow(
        0.5,
        age_days / half_life_days,
    )

    return clamp_score(score)


def authority_score(
    authority_level: float,
    freshness: float,
    publisher_reputation: float,
) -> float:
    """
    Platform authority formula:

    0.5 * authority_level
    + 0.3 * freshness
    + 0.2 * publisher_reputation
    """

    authority_level = clamp_score(
        authority_level
    )

    freshness = clamp_score(
        freshness
    )

    publisher_reputation = clamp_score(
        publisher_reputation
    )

    return (
        0.5 * authority_level
        + 0.3 * freshness
        + 0.2 * publisher_reputation
    )