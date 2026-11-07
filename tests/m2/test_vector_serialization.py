import pytest

from rag_m2.vector_store.serialization import (
    vector_to_pgvector,
)


def test_vector_serialization():
    result = vector_to_pgvector(
        [0.1, 0.2, -0.3],
        expected_dimensions=3,
    )

    assert result == "[0.1,0.2,-0.3]"


def test_vector_dimension_validation():
    with pytest.raises(ValueError):
        vector_to_pgvector(
            [0.1, 0.2],
            expected_dimensions=3,
        )


def test_vector_rejects_infinity():
    with pytest.raises(ValueError):
        vector_to_pgvector(
            [0.1, float("inf")],
            expected_dimensions=2,
        )