from rag_m2.retrieval.bm25 import BM25Retriever


def test_bm25_ranks_relevant_document_first():

    documents = [
        (
            "doc1",
            "Artificial intelligence improves cancer diagnosis."
        ),
        (
            "doc2",
            "Agriculture rainfall and crop production."
        ),
        (
            "doc3",
            "Cancer diagnosis using machine learning models."
        ),
    ]

    retriever = BM25Retriever(documents)

    results = retriever.search(
        "cancer diagnosis",
        top_k=3,
    )

    assert len(results) >= 2

    returned_ids = [
        result[0]
        for result in results
    ]

    assert "doc1" in returned_ids
    assert "doc3" in returned_ids

    assert returned_ids[0] in {
        "doc1",
        "doc3",
    }