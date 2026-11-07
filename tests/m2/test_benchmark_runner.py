import json
from types import SimpleNamespace

import pytest

from rag_m2.evaluation.benchmark_models import (
    BenchmarkPrediction,
    GoldenBenchmarkCase,
    GoldenBenchmarkDataset,
)
from rag_m2.evaluation.executor import (
    RAGServiceBenchmarkExecutor,
)
from rag_m2.evaluation.golden_dataset import (
    GoldenDatasetError,
    load_golden_dataset,
)
from rag_m2.evaluation.keys import (
    citation_evaluation_key,
)
from rag_m2.evaluation.reporting import (
    write_benchmark_report,
)
from rag_m2.evaluation.runner import (
    M2BenchmarkRunner,
)


class FakeBenchmarkExecutor:
    def __init__(
        self,
        predictions,
    ):
        self.predictions = (
            predictions
        )

    def execute(
        self,
        case,
    ):
        return self.predictions[
            case.case_id
        ]


def make_passing_case():
    return GoldenBenchmarkCase(
        case_id="case-1",

        research_question=(
            "What does the evidence say?"
        ),

        claim=(
            "The evidence supports "
            "the claim."
        ),

        relevant_chunk_ids=(
            "r1",
            "r2",
            "r3",
            "r4",
            "r5",
            "r6",
            "r7",
            "r8",
        ),

        expected_evidence_hashes=(
            "e1",
            "e2",
        ),

        expected_citation_keys=(
            "c1",
            "c2",
        ),
    )


def make_passing_prediction():
    return BenchmarkPrediction(
        retrieved_chunk_ids=(
            "r1",
            "r2",
            "r3",
            "r4",
            "r5",
            "r6",
            "r7",
            "r8",
            "noise-1",
            "noise-2",
        ),

        predicted_evidence_hashes=(
            "e1",
            "e2",
        ),

        predicted_citation_keys=(
            "c1",
            "c2",
        ),
    )


def test_load_versioned_golden_dataset(
    tmp_path,
):

    path = (
        tmp_path
        / "golden.json"
    )

    path.write_text(
        json.dumps(
            {
                "version": "1.0",
                "cases": [
                    {
                        "case_id":
                            "case-1",

                        "research_question":
                            "Question?",

                        "claim":
                            "Claim.",

                        "relevant_chunk_ids":
                            ["r1"],

                        "expected_evidence_hashes":
                            ["e1"],

                        "expected_citation_keys":
                            ["c1"],
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    dataset = (
        load_golden_dataset(
            path
        )
    )

    assert (
        dataset.version
        == "1.0"
    )

    assert len(
        dataset.cases
    ) == 1

    assert (
        dataset.cases[0]
        .case_id
        == "case-1"
    )


def test_duplicate_case_ids_are_rejected(
    tmp_path,
):

    path = (
        tmp_path
        / "invalid.json"
    )

    case = {
        "case_id": "duplicate",
        "research_question": "Question?",
        "claim": "Claim.",
        "relevant_chunk_ids": ["r1"],
        "expected_evidence_hashes": [],
        "expected_citation_keys": [],
    }

    path.write_text(
        json.dumps(
            {
                "version": "1.0",
                "cases": [
                    case,
                    case,
                ],
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(
        GoldenDatasetError
    ):
        load_golden_dataset(
            path
        )


def test_citation_evaluation_key_is_stable():

    citation = SimpleNamespace(
        source_version_id=(
            "source-version-1"
        ),

        document_version_id=(
            "document-version-1"
        ),

        document_chunk_id=(
            "chunk-1"
        ),

        locator=(
            "page:1;chunk:chunk-1"
        ),

        evidence_hash=(
            "a" * 64
        ),
    )

    first = (
        citation_evaluation_key(
            citation
        )
    )

    second = (
        citation_evaluation_key(
            citation
        )
    )

    assert first == second
    assert len(first) == 64


def test_rag_service_executor_converts_outputs():

    class FakeService:

        def build_evidence_bundle(
            self,
            **kwargs,
        ):

            citation = SimpleNamespace(
                source_version_id="sv1",
                document_version_id="dv1",
                document_chunk_id="chunk1",
                locator="page:1;chunk:chunk1",
                evidence_hash="b" * 64,
            )

            return SimpleNamespace(
                retrieval_results=[
                    SimpleNamespace(
                        chunk_id="chunk1"
                    )
                ],

                evidence_records=[
                    SimpleNamespace(
                        evidence_hash=(
                            "b" * 64
                        )
                    )
                ],

                citations=[
                    citation
                ],
            )

    case = GoldenBenchmarkCase(
        case_id="case-1",
        research_question="Question?",
        claim="Claim.",
        relevant_chunk_ids=(
            "chunk1",
        ),
        expected_evidence_hashes=(),
        expected_citation_keys=(),
    )

    executor = (
        RAGServiceBenchmarkExecutor(
            rag_service=FakeService(),
            project_id="project-1",
        )
    )

    prediction = executor.execute(
        case
    )

    assert (
        prediction.retrieved_chunk_ids
        == ("chunk1",)
    )

    assert (
        prediction
        .predicted_evidence_hashes
        == ("b" * 64,)
    )

    assert len(
        prediction
        .predicted_citation_keys[0]
    ) == 64


def test_benchmark_runner_passes_good_results():

    case = make_passing_case()

    dataset = (
        GoldenBenchmarkDataset(
            version="golden-1.0",
            cases=(case,),
        )
    )

    executor = (
        FakeBenchmarkExecutor(
            {
                "case-1":
                    make_passing_prediction()
            }
        )
    )

    report = (
        M2BenchmarkRunner(
            executor
        ).run(
            dataset
        )
    )

    assert report.case_count == 1

    assert (
        report.dataset_version
        == "golden-1.0"
    )

    assert (
        report.retrieval
        .recall_at_10
        == pytest.approx(1.0)
    )

    assert (
        report.retrieval
        .precision_at_10
        == pytest.approx(0.8)
    )

    assert (
        report.retrieval.mrr
        == pytest.approx(1.0)
    )

    assert report.gate.passed


def test_benchmark_runner_fails_bad_results():

    case = make_passing_case()

    dataset = (
        GoldenBenchmarkDataset(
            version="golden-1.0",
            cases=(case,),
        )
    )

    prediction = (
        BenchmarkPrediction(
            retrieved_chunk_ids=(
                "wrong",
            ),

            predicted_evidence_hashes=(
                "wrong-evidence",
            ),

            predicted_citation_keys=(
                "wrong-citation",
            ),
        )
    )

    report = (
        M2BenchmarkRunner(
            FakeBenchmarkExecutor(
                {
                    "case-1":
                        prediction
                }
            )
        ).run(
            dataset
        )
    )

    assert not report.gate.passed

    assert len(
        report.gate.failures
    ) == 6


def test_benchmark_report_written_as_json(
    tmp_path,
):

    case = make_passing_case()

    dataset = (
        GoldenBenchmarkDataset(
            version="golden-1.0",
            cases=(case,),
        )
    )

    report = (
        M2BenchmarkRunner(
            FakeBenchmarkExecutor(
                {
                    "case-1":
                        make_passing_prediction()
                }
            )
        ).run(
            dataset
        )
    )

    output = (
        tmp_path
        / "reports"
        / "m2-report.json"
    )

    result_path = (
        write_benchmark_report(
            report,
            output,
        )
    )

    assert result_path.exists()

    data = json.loads(
        result_path.read_text(
            encoding="utf-8"
        )
    )

    assert (
        data["dataset_version"]
        == "golden-1.0"
    )

    assert (
        data["threshold_version"]
        == "1.0"
    )

    assert (
        data["gate"]["passed"]
        is True
    )