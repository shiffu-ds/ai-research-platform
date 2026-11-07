from collections.abc import Sequence
import math


def vector_to_pgvector(
    vector: Sequence[float],
    expected_dimensions: int | None = None,
) -> str:
    if not vector:
        raise ValueError(
            "Vector cannot be empty."
        )

    if (
        expected_dimensions is not None
        and len(vector) != expected_dimensions
    ):
        raise ValueError(
            "Vector dimension mismatch. "
            f"Expected {expected_dimensions}, "
            f"received {len(vector)}."
        )

    values: list[str] = []

    for index, value in enumerate(vector):
        number = float(value)

        if not math.isfinite(number):
            raise ValueError(
                f"Non-finite vector value at index {index}."
            )

        values.append(
            repr(number)
        )

    return "[" + ",".join(values) + "]"