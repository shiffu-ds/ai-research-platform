from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from rag_m2.evaluation.benchmark_models import (
    GoldenBenchmarkCase,
    GoldenBenchmarkDataset,
)


class GoldenDatasetError(
    RuntimeError
):
    pass


def _required_text(
    data: dict[str, Any],
    key: str,
) -> str:

    value = data.get(
        key
    )

    if not isinstance(
        value,
        str,
    ):
        raise GoldenDatasetError(
            f"{key} must be a string."
        )

    value = value.strip()

    if not value:
        raise GoldenDatasetError(
            f"{key} cannot be empty."
        )

    return value


def _string_tuple(
    data: dict[str, Any],
    key: str,
    *,
    allow_empty: bool = True,
) -> tuple[str, ...]:

    value = data.get(
        key
    )

    if not isinstance(
        value,
        list,
    ):
        raise GoldenDatasetError(
            f"{key} must be a list."
        )

    result: list[str] = []

    seen: set[str] = set()

    for item in value:

        if not isinstance(
            item,
            str,
        ):
            raise GoldenDatasetError(
                f"{key} must contain "
                "only strings."
            )

        item = item.strip()

        if not item:
            continue

        if item in seen:
            continue

        seen.add(
            item
        )

        result.append(
            item
        )

    if (
        not allow_empty
        and not result
    ):
        raise GoldenDatasetError(
            f"{key} cannot be empty."
        )

    return tuple(
        result
    )


def load_golden_dataset(
    path: str | Path,
) -> GoldenBenchmarkDataset:

    dataset_path = Path(
        path
    )

    if not dataset_path.exists():
        raise GoldenDatasetError(
            "Golden dataset file "
            f"not found: {dataset_path}"
        )

    try:

        data = json.loads(
            dataset_path.read_text(
                encoding="utf-8"
            )
        )

    except json.JSONDecodeError as exc:

        raise GoldenDatasetError(
            "Golden dataset contains "
            "invalid JSON."
        ) from exc

    if not isinstance(
        data,
        dict,
    ):
        raise GoldenDatasetError(
            "Golden dataset root "
            "must be an object."
        )

    version = _required_text(
        data,
        "version",
    )

    raw_cases = data.get(
        "cases"
    )

    if not isinstance(
        raw_cases,
        list,
    ):
        raise GoldenDatasetError(
            "cases must be a list."
        )

    if not raw_cases:
        raise GoldenDatasetError(
            "Golden dataset must contain "
            "at least one case."
        )

    cases: list[
        GoldenBenchmarkCase
    ] = []

    seen_case_ids: set[str] = set()

    for raw_case in raw_cases:

        if not isinstance(
            raw_case,
            dict,
        ):
            raise GoldenDatasetError(
                "Each benchmark case "
                "must be an object."
            )

        case_id = _required_text(
            raw_case,
            "case_id",
        )

        if case_id in seen_case_ids:
            raise GoldenDatasetError(
                "Duplicate benchmark "
                f"case_id: {case_id}"
            )

        seen_case_ids.add(
            case_id
        )

        cases.append(
            GoldenBenchmarkCase(
                case_id=case_id,

                research_question=(
                    _required_text(
                        raw_case,
                        "research_question",
                    )
                ),

                claim=(
                    _required_text(
                        raw_case,
                        "claim",
                    )
                ),

                relevant_chunk_ids=(
                    _string_tuple(
                        raw_case,
                        "relevant_chunk_ids",
                        allow_empty=False,
                    )
                ),

                expected_evidence_hashes=(
                    _string_tuple(
                        raw_case,
                        "expected_evidence_hashes",
                    )
                ),

                expected_citation_keys=(
                    _string_tuple(
                        raw_case,
                        "expected_citation_keys",
                    )
                ),
            )
        )

    return GoldenBenchmarkDataset(
        version=version,

        cases=tuple(
            cases
        ),
    )