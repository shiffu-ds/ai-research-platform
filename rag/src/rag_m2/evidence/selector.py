from __future__ import annotations

import re
from typing import Protocol

from rag_m2.evidence.models import (
    SelectedExcerpt,
)


_WORD_PATTERN = re.compile(
    r"[A-Za-z0-9_]+"
)

_SENTENCE_SPLIT_PATTERN = re.compile(
    r"(?<=[.!?])\s+|\n+"
)


class ExcerptSelector(Protocol):
    """
    Interface for evidence extraction.

    A production implementation can later use
    a structured-output extraction model.
    """

    def select(
        self,
        claim: str,
        chunk_text: str,
    ) -> SelectedExcerpt | None:
        ...


class SentenceOverlapSelector:
    """
    Deterministic development selector.

    Chooses the sentence sharing the greatest
    number of terms with the claim.

    This is not intended to replace the final
    structured extraction model.
    """

    extraction_method = (
        "deterministic_sentence_overlap_v1"
    )

    model_version = None

    @staticmethod
    def _terms(
        text: str,
    ) -> set[str]:

        return {
            term.lower()
            for term in _WORD_PATTERN.findall(
                text
            )
            if len(term) > 2
        }

    def select(
        self,
        claim: str,
        chunk_text: str,
    ) -> SelectedExcerpt | None:

        claim_terms = self._terms(
            claim
        )

        if not claim_terms:
            return None

        sentences = [
            sentence.strip()
            for sentence
            in _SENTENCE_SPLIT_PATTERN.split(
                chunk_text
            )
            if sentence.strip()
        ]

        best_sentence = None
        best_score = 0

        for sentence in sentences:

            sentence_terms = self._terms(
                sentence
            )

            score = len(
                claim_terms
                & sentence_terms
            )

            if score > best_score:
                best_score = score
                best_sentence = sentence

        if (
            best_sentence is None
            or best_score <= 0
        ):
            return None

        return SelectedExcerpt(
            excerpt=best_sentence,
            extraction_method=(
                self.extraction_method
            ),
            model_version=(
                self.model_version
            ),
        )