from __future__ import annotations

from dataclasses import (
    asdict,
)
import json
from pathlib import Path

from rag_m2.evaluation.benchmark_models import (
    BenchmarkReport,
)


def write_benchmark_report(
    report: BenchmarkReport,
    output_path: str | Path,
) -> Path:
    """
    Write the benchmark result as a
    deterministic machine-readable JSON
    artifact for CI/integration use.
    """

    path = Path(
        output_path
    )

    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    payload = asdict(
        report
    )

    path.write_text(
        json.dumps(
            payload,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    return path