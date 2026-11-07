import pytest

from rag_m2.config import (
    settings,
)
from rag_m2.sources.scoring import (
    authority_score,
)


def test_source_authority_formula():

    score = authority_score(
        authority_level=0.8,
        freshness=0.6,
        publisher_reputation=0.4,
    )

    assert score == pytest.approx(
        0.66
    )


def test_chunking_contract():

    assert settings.chunk_size == 800

    assert settings.chunk_overlap == 120


def test_retrieval_contract():

    assert settings.dense_top_k == 50

    assert settings.lexical_top_k == 50

    assert settings.fused_top_k == 50

    assert settings.final_top_k == 10

    assert settings.rrf_k == 60


def test_embedding_contract():

    assert (
        settings.embedding_model
        == "text-embedding-3-large"
    )

    assert (
        settings.embedding_dimensions
        == 3072
    )


def test_document_processing_contract():

    assert settings.max_upload_mb == 100

    assert (
        settings.pdf_text_coverage_threshold
        == pytest.approx(
            0.85
        )
    )

    assert (
        settings.ocr_confidence_threshold
        == pytest.approx(
            0.75
        )
    )

    assert (
        settings.table_unresolved_threshold
        == pytest.approx(
            0.10
        )
    )

    assert (
        settings.image_min_bytes
        == 50 * 1024
    )


def test_reranker_contract():

    assert (
        settings.reranker_enabled
        is True
    )

    assert (
        settings.reranker_model
    )