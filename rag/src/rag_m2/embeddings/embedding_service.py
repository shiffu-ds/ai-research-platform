from __future__ import annotations

from typing import Any, Sequence

from openai import OpenAI

from rag_m2.config import settings


class EmbeddingConfigurationError(RuntimeError):
    pass


class EmbeddingGenerationError(RuntimeError):
    pass


class OpenAIEmbeddingService:
    """
    Production embedding service for the M2 RAG pipeline.

    Responsibilities:
    - Generate embeddings for document chunks
    - Generate query embeddings
    - Batch API requests
    - Validate returned vector dimensions
    - Keep model configuration centralized
    """

    def __init__(
        self,
        api_key: str | None = None,
        model: str = settings.embedding_model,
        dimensions: int = settings.embedding_dimensions,
        batch_size: int = 64,
        client: Any | None = None,
    ):
        if dimensions <= 0:
            raise ValueError(
                "dimensions must be greater than zero"
            )

        if batch_size <= 0:
            raise ValueError(
                "batch_size must be greater than zero"
            )

        self.model = model
        self.dimensions = dimensions
        self.batch_size = batch_size

        if client is not None:
            self.client = client
            return

        resolved_api_key = (
            api_key
            or settings.openai_api_key
        )

        if not resolved_api_key:
            raise EmbeddingConfigurationError(
                "OPENAI_API_KEY is not configured."
            )

        self.client = OpenAI(
            api_key=resolved_api_key,
            timeout=60.0,
            max_retries=3,
        )

    def _validate_texts(
        self,
        texts: Sequence[str],
    ) -> list[str]:

        if not texts:
            raise ValueError(
                "At least one text is required."
            )

        cleaned_texts: list[str] = []

        for index, text in enumerate(texts):

            if not isinstance(text, str):
                raise TypeError(
                    f"Text at index {index} must be a string."
                )

            cleaned = text.strip()

            if not cleaned:
                raise ValueError(
                    f"Text at index {index} is empty."
                )

            cleaned_texts.append(
                cleaned
            )

        return cleaned_texts

    def _embed_batch(
        self,
        texts: list[str],
    ) -> list[list[float]]:

        try:

            response = (
                self.client.embeddings.create(
                    model=self.model,
                    input=texts,
                    dimensions=self.dimensions,
                    encoding_format="float",
                )
            )

        except Exception as exc:
            raise EmbeddingGenerationError(
                f"Embedding API request failed: {exc}"
            ) from exc

        ordered_data = sorted(
            response.data,
            key=lambda item: item.index,
        )

        vectors: list[list[float]] = []

        for item in ordered_data:

            vector = list(
                item.embedding
            )

            if len(vector) != self.dimensions:
                raise EmbeddingGenerationError(
                    "Embedding dimension mismatch. "
                    f"Expected {self.dimensions}, "
                    f"received {len(vector)}."
                )

            vectors.append(
                vector
            )

        if len(vectors) != len(texts):
            raise EmbeddingGenerationError(
                "Embedding API returned an unexpected "
                "number of vectors."
            )

        return vectors

    def embed_texts(
        self,
        texts: Sequence[str],
    ) -> list[list[float]]:

        cleaned_texts = self._validate_texts(
            texts
        )

        embeddings: list[
            list[float]
        ] = []

        for start in range(
            0,
            len(cleaned_texts),
            self.batch_size,
        ):

            batch = cleaned_texts[
                start:
                start + self.batch_size
            ]

            batch_embeddings = (
                self._embed_batch(
                    batch
                )
            )

            embeddings.extend(
                batch_embeddings
            )

        return embeddings

    def embed_query(
        self,
        query: str,
    ) -> list[float]:

        results = self.embed_texts(
            [query]
        )

        return results[0]