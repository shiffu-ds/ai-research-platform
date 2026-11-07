from rag_m2.evidence.extractor import (
    EvidenceExtractionError,
    EvidenceExtractor,
)
from rag_m2.evidence.models import (
    SelectedExcerpt,
)
from rag_m2.schemas import (
    RetrievalResult,
)
from rag_m2.utils.hashing import (
    evidence_sha256,
)

import pytest


def make_result(
    *,
    chunk_id: str = "chunk-1",
    document_version_id: str = "doc-version-1",
    source_version_id: str | None = (
        "source-version-1"
    ),
    text: str = (
        "Artificial intelligence supports "
        "medical diagnosis. "
        "Weather forecasting uses "
        "different models."
    ),
    page_number: int | None = 3,
    rank: int = 1,
) -> RetrievalResult:

    return RetrievalResult(
        chunk_id=chunk_id,

        document_version_id=(
            document_version_id
        ),

        source_version_id=(
            source_version_id
        ),

        text=text,

        retrieval_method="fused",

        rank=rank,

        score=0.95,

        page_number=(
            page_number
        ),
    )


def test_evidence_preserves_full_provenance():

    extractor = (
        EvidenceExtractor()
    )

    result = make_result()

    evidence = extractor.extract(
        claim=(
            "Artificial intelligence "
            "supports diagnosis."
        ),

        claim_id="claim-1",

        ranked_chunks=[
            result
        ],
    )

    assert len(evidence) == 1

    record = evidence[0]

    assert (
        record.claim_id
        == "claim-1"
    )

    assert (
        record.document_chunk_id
        == result.chunk_id
    )

    assert (
        record.document_version_id
        == result.document_version_id
    )

    assert (
        record.source_version_id
        == result.source_version_id
    )

    assert (
        record.excerpt
        == (
            "Artificial intelligence "
            "supports medical diagnosis."
        )
    )

    assert (
        record.locator
        == "page:3;chunk:chunk-1"
    )

    assert (
        record.evidence_hash
        == evidence_sha256(
            record.excerpt,
            record.locator,
        )
    )


def test_evidence_hash_changes_with_locator():

    extractor = EvidenceExtractor()

    first = make_result(
        chunk_id="chunk-1",
        page_number=1,
    )

    second = make_result(
        chunk_id="chunk-2",
        page_number=2,
    )

    first_record = extractor.extract(
        claim=(
            "Artificial intelligence "
            "supports diagnosis."
        ),
        ranked_chunks=[first],
    )[0]

    second_record = extractor.extract(
        claim=(
            "Artificial intelligence "
            "supports diagnosis."
        ),
        ranked_chunks=[second],
    )[0]

    assert (
        first_record.evidence_hash
        != second_record.evidence_hash
    )


def test_missing_source_version_is_rejected():

    extractor = EvidenceExtractor()

    result = make_result(
        source_version_id=None
    )

    with pytest.raises(
        EvidenceExtractionError
    ):
        extractor.extract(
            claim=(
                "Artificial intelligence "
                "supports diagnosis."
            ),
            ranked_chunks=[
                result
            ],
        )


class InvalidSelector:
    """
    Simulates an extraction model inventing
    evidence that does not occur in the source.
    """

    def select(
        self,
        claim: str,
        chunk_text: str,
    ) -> SelectedExcerpt:

        return SelectedExcerpt(
            excerpt=(
                "This sentence was never "
                "in the retrieved document."
            ),
            extraction_method=(
                "fake-extraction-model"
            ),
            model_version="fake-v1",
        )


def test_hallucinated_excerpt_is_rejected():

    extractor = EvidenceExtractor(
        selector=InvalidSelector()
    )

    result = make_result()

    with pytest.raises(
        EvidenceExtractionError
    ):
        extractor.extract(
            claim="Some claim",
            ranked_chunks=[
                result
            ],
        )