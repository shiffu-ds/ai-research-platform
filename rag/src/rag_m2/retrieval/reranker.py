from __future__ import annotations

from typing import Any

from rag_m2.config import settings
from rag_m2.retrieval.models import (
    CandidateChunk,
)


class RerankerError(
    RuntimeError
):
    pass


class CrossEncoderReranker:
    def __init__(
        self,
        model_name: str = settings.reranker_model,
        enabled: bool = settings.reranker_enabled,
        model: Any | None = None,
    ):
        self.model_name = model_name
        self.enabled = enabled

        self._model = model

    def _get_model(self):

        if self._model is not None:
            return self._model

        try:
            from sentence_transformers import (
                CrossEncoder,
            )

            self._model = CrossEncoder(
                self.model_name
            )

            return self._model

        except Exception as exc:
            raise RerankerError(
                "Unable to load cross-encoder "
                f"'{self.model_name}': {exc}"
            ) from exc

    def rerank(
        self,
        query: str,
        candidates: list[
            CandidateChunk
        ],
        top_k: int = 10,
    ) -> list[CandidateChunk]:

        if not query.strip():
            raise ValueError(
                "Query cannot be empty."
            )

        if top_k <= 0:
            raise ValueError(
                "top_k must be greater than zero."
            )

        if not candidates:
            return []

        if not self.enabled:
            return sorted(
                candidates,
                key=lambda item: (
                    item.rrf_score
                ),
                reverse=True,
            )[:top_k]

        model = self._get_model()

        pairs = [
            (
                query,
                candidate.text,
            )
            for candidate in candidates
        ]

        try:
            scores = model.predict(
                pairs,
                show_progress_bar=False,
            )

        except Exception as exc:
            raise RerankerError(
                f"Cross-encoder prediction "
                f"failed: {exc}"
            ) from exc

        if len(scores) != len(
            candidates
        ):
            raise RerankerError(
                "Reranker returned an unexpected "
                "number of scores."
            )

        for candidate, score in zip(
            candidates,
            scores,
        ):
            candidate.rerank_score = (
                float(score)
            )

        ranked = sorted(
            candidates,
            key=lambda item: (
                item.rerank_score
                if item.rerank_score
                is not None
                else float("-inf")
            ),
            reverse=True,
        )

        return ranked[
            :top_k
        ]