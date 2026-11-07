import math
import re
from collections import Counter


TOKEN_PATTERN = re.compile(r"\b\w+\b", re.UNICODE)


def tokenize(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(text.lower())


class BM25Retriever:
    def __init__(
        self,
        documents: list[tuple[str, str]],
        k1: float = 1.5,
        b: float = 0.75,
    ):
        self.documents = documents
        self.k1 = k1
        self.b = b

        self.tokenized_documents = [
            tokenize(text)
            for _, text in documents
        ]

        self.document_lengths = [
            len(tokens)
            for tokens in self.tokenized_documents
        ]

        self.average_document_length = (
            sum(self.document_lengths) / len(self.document_lengths)
            if self.document_lengths
            else 0.0
        )

        self.document_frequencies = Counter()

        for tokens in self.tokenized_documents:
            self.document_frequencies.update(set(tokens))

        self.total_documents = len(documents)

    def _idf(self, term: str) -> float:
        frequency = self.document_frequencies.get(term, 0)

        return math.log(
            1
            + (
                self.total_documents
                - frequency
                + 0.5
            )
            / (
                frequency
                + 0.5
            )
        )

    def score_document(
        self,
        query_tokens: list[str],
        document_tokens: list[str],
        document_length: int,
    ) -> float:

        if not document_tokens:
            return 0.0

        frequencies = Counter(document_tokens)

        score = 0.0

        for term in query_tokens:
            term_frequency = frequencies.get(term, 0)

            if term_frequency == 0:
                continue

            idf = self._idf(term)

            denominator = (
                term_frequency
                + self.k1
                * (
                    1
                    - self.b
                    + self.b
                    * document_length
                    / max(self.average_document_length, 1)
                )
            )

            score += (
                idf
                * term_frequency
                * (self.k1 + 1)
                / denominator
            )

        return score

    def search(
        self,
        query: str,
        top_k: int = 50,
    ) -> list[tuple[str, float]]:

        if not self.documents:
            return []

        query_tokens = tokenize(query)

        scored = []

        for index, (document_id, _) in enumerate(self.documents):

            score = self.score_document(
                query_tokens=query_tokens,
                document_tokens=self.tokenized_documents[index],
                document_length=self.document_lengths[index],
            )

            if score > 0:
                scored.append((document_id, score))

        scored.sort(
            key=lambda item: item[1],
            reverse=True,
        )

        return scored[:top_k]