from rag_m2.preprocessing.chunker import SentenceAwareChunker
from rag_m2.schemas import PageText


def test_chunker_creates_chunks_under_limit():

    text = " ".join(
        [
            f"This is sentence number {i} about artificial intelligence."
            for i in range(300)
        ]
    )

    page = PageText(
        page_number=1,
        text=text,
    )

    chunker = SentenceAwareChunker(
        chunk_size=800,
        overlap=120,
    )

    chunks = chunker.chunk_pages(
        pages=[page],
        project_id="11111111-1111-1111-1111-111111111111",
        document_version_id="22222222-2222-2222-2222-222222222222",
    )

    assert len(chunks) > 1

    for chunk in chunks:
        assert chunk.token_count <= 800
        assert chunk.text.strip()

def test_large_text_preserves_120_token_overlap():

    chunker = SentenceAwareChunker(
        chunk_size=800,
        overlap=120,
    )

    # One intentionally long sentence so the
    # chunker must split it by token boundaries.
    sentence = " ".join(
        f"token{i}"
        for i in range(1000)
    )

    original_tokens = (
        chunker.tokenizer.encode(
            sentence
        )
    )

    assert len(original_tokens) > 800

    parts = (
        chunker._split_large_sentence(
            sentence
        )
    )

    assert len(parts) >= 2

    # First chunk ends at token 800.
    first_expected = (
        chunker.tokenizer.decode(
            original_tokens[
                :800
            ]
        ).strip()
    )

    assert (
        parts[0]
        == first_expected
    )

    # Second chunk must begin 120 tokens
    # before the end of the first chunk.
    expected_overlap = (
        chunker.tokenizer.decode(
            original_tokens[
                680:800
            ]
        ).strip()
    )

    assert expected_overlap

    assert (
        parts[1].startswith(
            expected_overlap
        )
    )