import json

import pytest

from rag_m2.evaluation.local_benchmark import (
    DeterministicBenchmarkEmbeddingService,
    LocalM2BenchmarkSeeder,
    build_local_benchmark_rag_service,
    run_local_end_to_end_benchmark,
)
from rag_m2.evaluation.metrics import (
    recall_at_k,
)
from rag_m2.vector_store.pgvector_store import (
    PgVectorStore,
)
from rag_m2.evaluation.metrics import (
    precision_at_k,
)

from rag_m2.retrieval.lexical_retriever import (
    PostgresBM25Retriever,
)


def test_benchmark_embedding_is_deterministic():

    service = (
        DeterministicBenchmarkEmbeddingService()
    )

    query_vector = (
        service.embed_query(
            "solar photovoltaic electricity"
        )
    )

    relevant_vector = (
        service.embed_query(
            "solar renewable energy"
        )
    )

    unrelated_vector = (
        service.embed_query(
            "marine coral reef"
        )
    )

    assert (
        query_vector
        == relevant_vector
    )

    assert (
        query_vector
        != unrelated_vector
    )

    assert (
        len(query_vector)
        == 3072
    )


def test_local_benchmark_seed_builds_expected_case():

    seeder = (
        LocalM2BenchmarkSeeder()
    )

    environment = (
        seeder.seed()
    )

    try:

        assert (
            environment.project_id
        )

        assert (
            len(
                environment.source_ids
            )
            == 10
        )

        assert (
            len(
                environment.dataset.cases
            )
            == 1
        )

        case = (
            environment
            .dataset
            .cases[0]
        )

        assert (
            len(
                case.relevant_chunk_ids
            )
            == 8
        )

        assert (
            len(
                case.expected_evidence_hashes
            )
            == 8
        )

        assert (
            len(
                case.expected_citation_keys
            )
            == 8
        )

    finally:

        environment.cleanup()


def test_real_local_retrieval_preserves_runtime_models():

    seeder = (
        LocalM2BenchmarkSeeder()
    )

    environment = (
        seeder.seed()
    )

    try:

        service = (
            build_local_benchmark_rag_service()
        )

        case = (
            environment
            .dataset
            .cases[0]
        )

        results = service.retrieve(
            query=(
                case.research_question
            ),

            project_id=(
                environment.project_id
            ),

            top_k=10,
        )

        assert (
            len(results)
            == 10
        )

        assert (
            results[0].chunk_id
            in case.relevant_chunk_ids
        )

        assert all(
            result.embedding_model
            == (
                "m2-local-benchmark-"
                "embedding-v1"
            )
            for result
            in results
        )

        assert all(
            result.reranker_version
            == (
                "m2-local-benchmark-"
                "reranker-v1"
            )
            for result
            in results
        )

    finally:

        environment.cleanup()


def test_local_end_to_end_benchmark_passes_gate():

    report = (
        run_local_end_to_end_benchmark()
    )

    assert report.gate.passed

    assert (
        report.retrieval.recall_at_10
        == pytest.approx(
            1.0
        )
    )

    assert (
        report.retrieval.precision_at_10
        == pytest.approx(
            0.8
        )
    )

    assert (
        report.retrieval.mrr
        == pytest.approx(
            1.0
        )
    )

    assert (
        report.evidence
        .attribution_accuracy
        == pytest.approx(
            1.0
        )
    )

    assert (
        report.evidence
        .completeness
        == pytest.approx(
            1.0
        )
    )

    assert (
        report.evidence
        .citation_correctness
        == pytest.approx(
            1.0
        )
    )


def test_local_end_to_end_benchmark_writes_report(
    tmp_path,
):

    output_path = (
        tmp_path
        / "m2-report.json"
    )

    report = (
        run_local_end_to_end_benchmark(
            output_path=(
                output_path
            )
        )
    )

    assert report.gate.passed

    assert output_path.exists()

    data = json.loads(
        output_path.read_text(
            encoding="utf-8"
        )
    )

    assert (
        data["dataset_version"]
        == "m2-local-seed-v1"
    )

    assert (
        data["threshold_version"]
        == "1.0"
    )

    assert (
        data["gate"]["passed"]
        is True
    )

def test_dense_retrieval_meets_recall_gate():

    seeder = (
        LocalM2BenchmarkSeeder()
    )

    environment = (
        seeder.seed()
    )

    try:

        case = (
            environment
            .dataset
            .cases[0]
        )

        embedding_service = (
            DeterministicBenchmarkEmbeddingService()
        )

        query_embedding = (
            embedding_service
            .embed_query(
                case.research_question
            )
        )

        results = (
            PgVectorStore()
            .dense_search(
                query_embedding=(
                    query_embedding
                ),

                project_id=(
                    environment.project_id
                ),

                top_k=10,
            )
        )

        retrieved_ids = [
            result.chunk_id
            for result in results
        ]

        recall = recall_at_k(
            retrieved_ids=(
                retrieved_ids
            ),

            relevant_ids=(
                case.relevant_chunk_ids
            ),

            k=10,
        )

        assert (
            recall
            >= 0.85
        )

    finally:

        environment.cleanup()

def test_bm25_retrieval_meets_precision_gate():

    seeder = (
        LocalM2BenchmarkSeeder()
    )

    environment = (
        seeder.seed()
    )

    try:

        case = (
            environment
            .dataset
            .cases[0]
        )

        retriever = (
            PostgresBM25Retriever()
        )

        results = retriever.search(
            query=(
                case.research_question
            ),

            project_id=(
                environment.project_id
            ),

            top_k=10,
        )

        retrieved_ids = [
            result.chunk_id
            for result in results
        ]

        precision = precision_at_k(
            retrieved_ids=(
                retrieved_ids
            ),

            relevant_ids=(
                case.relevant_chunk_ids
            ),

            k=10,
        )

        assert (
            precision
            >= 0.75
        )

    finally:

        environment.cleanup()