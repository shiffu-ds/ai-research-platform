from collections import defaultdict


def reciprocal_rank_fusion(
    rankings: list[list[str]],
    k: int = 60,
) -> list[tuple[str, float]]:

    if k <= 0:
        raise ValueError("RRF k must be greater than 0")

    scores: dict[str, float] = defaultdict(float)

    for ranking in rankings:

        for rank, document_id in enumerate(
            ranking,
            start=1,
        ):
            scores[document_id] += 1.0 / (k + rank)

    return sorted(
        scores.items(),
        key=lambda item: item[1],
        reverse=True,
    )