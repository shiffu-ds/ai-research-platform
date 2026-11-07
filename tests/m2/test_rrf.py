from rag_m2.retrieval.rrf import reciprocal_rank_fusion


def test_rrf_rewards_documents_present_in_multiple_rankings():

    dense = [
        "chunk-a",
        "chunk-b",
        "chunk-c",
    ]

    lexical = [
        "chunk-b",
        "chunk-d",
        "chunk-a",
    ]

    fused = reciprocal_rank_fusion(
        [dense, lexical],
        k=60,
    )

    ids = [
        item[0]
        for item in fused
    ]

    assert ids[0] in {
        "chunk-a",
        "chunk-b",
    }

    assert "chunk-a" in ids
    assert "chunk-b" in ids