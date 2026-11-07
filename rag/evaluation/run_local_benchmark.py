from pathlib import Path

from rag_m2.evaluation.local_benchmark import (
    run_local_end_to_end_benchmark,
)


def main() -> int:

    output_path = (
        Path("rag")
        / "evaluation"
        / "output"
        / "m2-local-benchmark-report.json"
    )

    report = (
        run_local_end_to_end_benchmark(
            output_path=output_path
        )
    )

    print()
    print(
        "M2 LOCAL END-TO-END BENCHMARK"
    )
    print(
        "=" * 40
    )

    print(
        f"Dataset version: "
        f"{report.dataset_version}"
    )

    print(
        f"Threshold version: "
        f"{report.threshold_version}"
    )

    print(
        f"Cases: "
        f"{report.case_count}"
    )

    print()

    print(
        "Retrieval Recall@10: "
        f"{report.retrieval.recall_at_10:.4f}"
    )

    print(
        "Retrieval Precision@10: "
        f"{report.retrieval.precision_at_10:.4f}"
    )

    print(
        "Retrieval MRR: "
        f"{report.retrieval.mrr:.4f}"
    )

    print()

    print(
        "Evidence attribution accuracy: "
        f"{report.evidence.attribution_accuracy:.4f}"
    )

    print(
        "Evidence completeness: "
        f"{report.evidence.completeness:.4f}"
    )

    print(
        "Citation correctness: "
        f"{report.evidence.citation_correctness:.4f}"
    )

    print()

    print(
        "FINAL GATE: "
        + (
            "PASS"
            if report.gate.passed
            else "FAIL"
        )
    )

    if report.gate.failures:

        print()

        print(
            "Failures:"
        )

        for failure in (
            report.gate.failures
        ):
            print(
                f"- {failure}"
            )

    print()

    print(
        f"Report written to: "
        f"{output_path}"
    )

    return (
        0
        if report.gate.passed
        else 1
    )


if __name__ == "__main__":
    raise SystemExit(
        main()
    )