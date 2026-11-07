from types import SimpleNamespace

import pytest

from rag_m2.embeddings.embedding_service import (
    EmbeddingGenerationError,
    OpenAIEmbeddingService,
)


class FakeEmbeddingsAPI:
    def create(
        self,
        model,
        input,
        dimensions,
        encoding_format,
    ):

        data = []

        for index, _ in enumerate(input):

            vector = [
                float(index + 1)
                for _ in range(dimensions)
            ]

            data.append(
                SimpleNamespace(
                    index=index,
                    embedding=vector,
                )
            )

        return SimpleNamespace(
            data=data
        )


class FakeOpenAIClient:
    def __init__(self):
        self.embeddings = (
            FakeEmbeddingsAPI()
        )


def test_embedding_service_returns_correct_dimensions():

    service = OpenAIEmbeddingService(
        dimensions=8,
        client=FakeOpenAIClient(),
    )

    vectors = service.embed_texts(
        [
            "Artificial intelligence research",
            "Evidence retrieval platform",
        ]
    )

    assert len(vectors) == 2

    assert len(vectors[0]) == 8
    assert len(vectors[1]) == 8


def test_embedding_query_returns_single_vector():

    service = OpenAIEmbeddingService(
        dimensions=8,
        client=FakeOpenAIClient(),
    )

    vector = service.embed_query(
        "What is retrieval augmented generation?"
    )

    assert len(vector) == 8


def test_embedding_service_rejects_empty_text():

    service = OpenAIEmbeddingService(
        dimensions=8,
        client=FakeOpenAIClient(),
    )

    with pytest.raises(ValueError):

        service.embed_texts(
            [""]
        )


def test_embedding_service_batches_requests():

    service = OpenAIEmbeddingService(
        dimensions=8,
        batch_size=2,
        client=FakeOpenAIClient(),
    )

    vectors = service.embed_texts(
        [
            "document one",
            "document two",
            "document three",
            "document four",
            "document five",
        ]
    )

    assert len(vectors) == 5

    for vector in vectors:
        assert len(vector) == 8