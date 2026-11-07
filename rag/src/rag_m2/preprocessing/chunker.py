import re

from rag_m2.config import settings
from rag_m2.schemas import Chunk, PageText


_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


class Tokenizer:
    def __init__(self):
        try:
            import tiktoken

            self.encoding = tiktoken.get_encoding("cl100k_base")
        except Exception:
            self.encoding = None

    def encode(self, text: str):
        if self.encoding is not None:
            return self.encoding.encode(text)

        return text.split()

    def decode(self, tokens):
        if self.encoding is not None:
            return self.encoding.decode(tokens)

        return " ".join(tokens)

    def count(self, text: str) -> int:
        return len(self.encode(text))


class SentenceAwareChunker:
    def __init__(
        self,
        chunk_size: int = settings.chunk_size,
        overlap: int = settings.chunk_overlap,
    ):
        if chunk_size <= 0:
            raise ValueError("chunk_size must be greater than 0")

        if overlap < 0:
            raise ValueError("overlap cannot be negative")

        if overlap >= chunk_size:
            raise ValueError("overlap must be smaller than chunk_size")

        self.chunk_size = chunk_size
        self.overlap = overlap
        self.tokenizer = Tokenizer()

    def _split_large_sentence(self, sentence: str) -> list[str]:
        tokens = self.tokenizer.encode(sentence)

        if len(tokens) <= self.chunk_size:
            return [sentence]

        parts = []

        start = 0

        while start < len(tokens):
            end = min(start + self.chunk_size, len(tokens))

            part = self.tokenizer.decode(tokens[start:end]).strip()

            if part:
                parts.append(part)

            if end == len(tokens):
                break

            start = end - self.overlap

        return parts

    def _sentences(self, text: str) -> list[str]:
        raw_sentences = [
            sentence.strip()
            for sentence in _SENTENCE_SPLIT.split(text)
            if sentence.strip()
        ]

        result = []

        for sentence in raw_sentences:
            result.extend(self._split_large_sentence(sentence))

        return result

    def chunk_page(
        self,
        page: PageText,
        project_id: str,
        document_version_id: str,
        starting_index: int,
    ) -> tuple[list[Chunk], int]:

        sentences = self._sentences(page.text)

        if not sentences:
            return [], starting_index

        chunks = []

        current_sentences: list[str] = []
        current_tokens = 0
        chunk_index = starting_index

        for sentence in sentences:
            sentence_tokens = self.tokenizer.count(sentence)

            projected_tokens = current_tokens + sentence_tokens

            if current_sentences and projected_tokens > self.chunk_size:

                text = " ".join(current_sentences).strip()

                chunks.append(
                    Chunk.create(
                        project_id=project_id,
                        document_version_id=document_version_id,
                        chunk_index=chunk_index,
                        text=text,
                        token_count=self.tokenizer.count(text),
                        page_number=page.page_number,
                        metadata={
                            "ocr_used": page.ocr_used,
                            "ocr_confidence": page.ocr_confidence,
                        },
                    )
                )

                chunk_index += 1

                overlap_sentences = []
                overlap_tokens = 0

                for previous in reversed(current_sentences):
                    previous_count = self.tokenizer.count(previous)

                    if (
                        overlap_sentences
                        and overlap_tokens + previous_count > self.overlap
                    ):
                        break

                    overlap_sentences.insert(0, previous)
                    overlap_tokens += previous_count

                    if overlap_tokens >= self.overlap:
                        break

                current_sentences = overlap_sentences
                current_tokens = overlap_tokens

            current_sentences.append(sentence)
            current_tokens += sentence_tokens

        if current_sentences:
            text = " ".join(current_sentences).strip()

            chunks.append(
                Chunk.create(
                    project_id=project_id,
                    document_version_id=document_version_id,
                    chunk_index=chunk_index,
                    text=text,
                    token_count=self.tokenizer.count(text),
                    page_number=page.page_number,
                    metadata={
                        "ocr_used": page.ocr_used,
                        "ocr_confidence": page.ocr_confidence,
                    },
                )
            )

            chunk_index += 1

        return chunks, chunk_index

    def chunk_pages(
        self,
        pages: list[PageText],
        project_id: str,
        document_version_id: str,
    ) -> list[Chunk]:

        all_chunks = []
        index = 0

        for page in pages:
            page_chunks, index = self.chunk_page(
                page,
                project_id,
                document_version_id,
                index,
            )

            all_chunks.extend(page_chunks)

        return all_chunks