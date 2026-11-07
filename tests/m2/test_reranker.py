from rag_m2.retrieval.models import (
    CandidateChunk,
)
from rag_m2.retrieval.reranker import (
    CrossEncoderReranker,
)


class FakeCrossEncoder:
    def predict(
        self,
        pairs,
        show_progress_bar=False,
    ):
        return [
            0.1,
            0.9,
        ]


def make_candidate(
    chunk_id: str,
    text: str,
):
    return CandidateChunk(
        chunk_id=chunk_id,
        project_id="project",
        document_version_id="document",
        source_version_id=None,
        text=text,
        page_number=1,
    )


def test_reranker_orders_by_cross_encoder_score():

    candidates = [
        make_candidate(
            "a",
            "Less relevant text",
        ),
        make_candidate(
            "b",
            "Highly relevant text",
        ),
    ]

    reranker = (
        CrossEncoderReranker(
            model=FakeCrossEncoder(),
        )
    )

    results = reranker.rerank(
        query="relevant query",
        candidates=candidates,
        top_k=2,
    )

    assert (
        results[0].chunk_id
        == "b"
    )

    assert (
        results[0].rerank_score
        == 0.9
    )


def test_disabled_reranker_uses_rrf():

    first = make_candidate(
        "a",
        "first",
    )

    second = make_candidate(
        "b",
        "second",
    )

    first.rrf_score = 0.01
    second.rrf_score = 0.03

    reranker = (
        CrossEncoderReranker(
            enabled=False
        )
    )

    results = reranker.rerank(
        query="query",
        candidates=[
            first,
            second,
        ],
        top_k=2,
    )

    assert (
        results[0].chunk_id
        == "b"
    )