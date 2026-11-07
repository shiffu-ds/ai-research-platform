from __future__ import annotations

from dataclasses import dataclass
import re
from pathlib import Path
from uuid import uuid4

from rag_m2.citations.context_provider import (
    PostgresCitationContextProvider,
)
from rag_m2.citations.generator import (
    CitationGenerator,
)
from rag_m2.config import settings
from rag_m2.evaluation.benchmark_models import (
    BenchmarkReport,
    GoldenBenchmarkCase,
    GoldenBenchmarkDataset,
)
from rag_m2.evaluation.executor import (
    RAGServiceBenchmarkExecutor,
)
from rag_m2.evaluation.keys import (
    citation_evaluation_key_from_provenance,
)
from rag_m2.evaluation.reporting import (
    write_benchmark_report,
)
from rag_m2.evaluation.runner import (
    M2BenchmarkRunner,
)
from rag_m2.evidence.extractor import (
    EvidenceExtractor,
)
from rag_m2.evidence.pipeline import (
    EvidenceCitationPipeline,
)
from rag_m2.rag_service import (
    M2RAGService,
)
from rag_m2.retrieval.hybrid_retriever import (
    HybridRetriever,
)
from rag_m2.retrieval.lexical_retriever import (
    PostgresBM25Retriever,
)
from rag_m2.retrieval.reranker import (
    CrossEncoderReranker,
)
from rag_m2.schemas import (
    Chunk,
)
from rag_m2.sources.version_repository import (
    VersionRepository,
)
from rag_m2.utils.hashing import (
    evidence_sha256,
    sha256_text,
)
from rag_m2.vector_store.pgvector_store import (
    PgVectorStore,
)


_WORD_PATTERN = re.compile(
    r"[A-Za-z0-9_]+"
)


class DeterministicBenchmarkEmbeddingService:
    """
    Offline deterministic embedding adapter used
    only by the local M2 benchmark environment.

    It intentionally avoids external APIs so the
    benchmark is repeatable in development and CI.
    """

    model = (
        "m2-local-benchmark-embedding-v1"
    )

    dimensions = (
        settings.embedding_dimensions
    )

    RESEARCH_TERMS = {
        "solar",
        "photovoltaic",
        "sunlight",
        "electricity",
        "renewable",
    }

    @classmethod
    def _vector(
        cls,
        text: str,
    ) -> list[float]:

        terms = {
            token.lower()
            for token
            in _WORD_PATTERN.findall(
                text
            )
        }

        vector = [
            0.0
            for _ in range(
                cls.dimensions
            )
        ]

        if (
            terms
            & cls.RESEARCH_TERMS
        ):
            vector[0] = 1.0

        else:
            vector[1] = 1.0

        return vector

    def embed_texts(
        self,
        texts,
    ) -> list[list[float]]:

        return [
            self._vector(
                text
            )
            for text
            in texts
        ]

    def embed_query(
        self,
        query: str,
    ) -> list[float]:

        return self._vector(
            query
        )


class DeterministicBenchmarkCrossEncoder:
    """
    Small deterministic model implementing the
    interface expected by CrossEncoderReranker.

    The real CrossEncoderReranker code is still
    exercised; only its underlying model is
    replaced for deterministic CI execution.
    """

    @staticmethod
    def _terms(
        text: str,
    ) -> set[str]:

        return {
            token.lower()
            for token
            in _WORD_PATTERN.findall(
                text
            )
            if len(token) > 2
        }

    def predict(
        self,
        pairs,
        show_progress_bar=False,
    ):

        scores = []

        for query, text in pairs:

            query_terms = (
                self._terms(
                    query
                )
            )

            text_terms = (
                self._terms(
                    text
                )
            )

            scores.append(
                float(
                    len(
                        query_terms
                        & text_terms
                    )
                )
            )

        return scores


@dataclass
class SeededBenchmarkEnvironment:
    project_id: str

    dataset: GoldenBenchmarkDataset

    source_ids: tuple[
        str,
        ...
    ]

    repository: VersionRepository

    def cleanup(
        self,
    ) -> None:

        for source_id in reversed(
            self.source_ids
        ):
            self.repository.delete_source(
                source_id
            )


class LocalM2BenchmarkSeeder:
    """
    Seeds a dedicated M2 development project with
    immutable source/document provenance and
    pgvector chunks.

    This is an integration fixture, not the
    authoritative production golden dataset.
    """

    EVIDENCE_SENTENCE = (
        "Solar photovoltaic systems convert "
        "sunlight into electricity."
    )

    QUERY = (
        "How do solar photovoltaic systems "
        "generate electricity from sunlight?"
    )

    CLAIM = (
        "Solar photovoltaic systems convert "
        "sunlight into electricity."
    )

    def __init__(
        self,
        repository: (
            VersionRepository
            | None
        ) = None,
        vector_store: (
            PgVectorStore
            | None
        ) = None,
        embedding_service: (
            DeterministicBenchmarkEmbeddingService
            | None
        ) = None,
    ):

        self.repository = (
            repository
            or VersionRepository()
        )

        self.vector_store = (
            vector_store
            or PgVectorStore()
        )

        self.embedding_service = (
            embedding_service
            or DeterministicBenchmarkEmbeddingService()
        )

    def seed(
        self,
    ) -> SeededBenchmarkEnvironment:

        project_id = str(
            uuid4()
        )

        source_ids: list[str] = []

        relevant_chunk_ids: list[
            str
        ] = []

        evidence_hashes: list[
            str
        ] = []

        citation_keys: list[
            str
        ] = []

        relevant_documents = [
            (
                self.EVIDENCE_SENTENCE
                + " Renewable energy study "
                + f"number {index} evaluates "
                + "solar power generation."
            )
            for index
            in range(
                1,
                9,
            )
        ]

        distractor_documents = [
            (
                "Marine biology examines coral "
                "reef ecosystems and ocean habitats."
            ),
            (
                "Ancient archaeology studies pottery, "
                "settlements, and historical artifacts."
            ),
        ]

        seeded_documents = [
            (
                True,
                text,
            )
            for text
            in relevant_documents
        ] + [
            (
                False,
                text,
            )
            for text
            in distractor_documents
        ]

        try:

            for index, (
                relevant,
                text,
            ) in enumerate(
                seeded_documents,
                start=1,
            ):

                content_hash = (
                    sha256_text(
                        text
                    )
                )

                source = (
                    self.repository
                    .create_source(
                        project_id=(
                            project_id
                        ),

                        canonical_url=(
                            "https://benchmark.local/"
                            f"source/{index}"
                        ),

                        title=(
                            "M2 Benchmark Source "
                            f"{index}"
                        ),

                        source_type=(
                            "benchmark"
                        ),
                    )
                )

                source_ids.append(
                    source.id
                )

                source_version = (
                    self.repository
                    .create_source_version(
                        source_id=(
                            source.id
                        ),

                        content_hash=(
                            content_hash
                        ),

                        final_url=(
                            source.canonical_url
                        ),

                        storage_uri=(
                            "benchmark://snapshot/"
                            f"{project_id}/{index}"
                        ),

                        parser_version=(
                            "m2-local-benchmark-v1"
                        ),

                        http_status=200,

                        content_type=(
                            "text/plain"
                        ),

                        metadata={
                            "benchmark": True,
                            "relevant": relevant,
                        },
                    )
                )

                document = (
                    self.repository
                    .create_document(
                        project_id=(
                            project_id
                        ),

                        source_id=(
                            source.id
                        ),

                        title=(
                            "Benchmark Document "
                            f"{index}"
                        ),
                    )
                )

                document_version = (
                    self.repository
                    .create_document_version(
                        document_id=(
                            document.id
                        ),

                        source_version_id=(
                            source_version.id
                        ),

                        content_hash=(
                            content_hash
                        ),

                        parser_version=(
                            "m2-local-benchmark-v1"
                        ),

                        page_count=1,

                        storage_location=(
                            "benchmark://document/"
                            f"{project_id}/{index}"
                        ),

                        extraction_metadata={
                            "benchmark": True
                        },

                        ocr_status=(
                            "NOT_REQUIRED"
                        ),

                        extraction_status=(
                            "COMPLETE"
                        ),
                    )
                )

                chunk = Chunk.create(
                    project_id=(
                        project_id
                    ),

                    document_version_id=(
                        document_version.id
                    ),

                    chunk_index=0,

                    text=text,

                    token_count=len(
                        text.split()
                    ),

                    page_number=1,

                    metadata={
                        "benchmark": True,
                        "relevant": relevant,
                    },
                )

                embedding = (
                    self.embedding_service
                    .embed_texts(
                        [
                            text
                        ]
                    )[0]
                )

                self.vector_store.upsert_chunk(
                    chunk=chunk,

                    embedding=embedding,

                    source_version_id=(
                        source_version.id
                    ),

                    embedding_model=(
                        self.embedding_service
                        .model
                    ),
                )

                if relevant:

                    relevant_chunk_ids.append(
                        chunk.id
                    )

                    locator = (
                        "page:1;"
                        f"chunk:{chunk.id}"
                    )

                    evidence_hash = (
                        evidence_sha256(
                            excerpt=(
                                self.EVIDENCE_SENTENCE
                            ),

                            locator=(
                                locator
                            ),
                        )
                    )

                    evidence_hashes.append(
                        evidence_hash
                    )

                    citation_keys.append(
                        citation_evaluation_key_from_provenance(
                            source_version_id=(
                                source_version.id
                            ),

                            document_version_id=(
                                document_version.id
                            ),

                            document_chunk_id=(
                                chunk.id
                            ),

                            locator=(
                                locator
                            ),

                            evidence_hash=(
                                evidence_hash
                            ),
                        )
                    )

        except Exception:

            for source_id in reversed(
                source_ids
            ):
                try:
                    self.repository.delete_source(
                        source_id
                    )
                except Exception:
                    pass

            raise

        benchmark_case = (
            GoldenBenchmarkCase(
                case_id=(
                    "m2-local-solar-case"
                ),

                research_question=(
                    self.QUERY
                ),

                claim=(
                    self.CLAIM
                ),

                relevant_chunk_ids=tuple(
                    relevant_chunk_ids
                ),

                expected_evidence_hashes=tuple(
                    evidence_hashes
                ),

                expected_citation_keys=tuple(
                    citation_keys
                ),
            )
        )

        dataset = (
            GoldenBenchmarkDataset(
                version=(
                    "m2-local-seed-v1"
                ),

                cases=(
                    benchmark_case,
                ),
            )
        )

        return (
            SeededBenchmarkEnvironment(
                project_id=(
                    project_id
                ),

                dataset=dataset,

                source_ids=tuple(
                    source_ids
                ),

                repository=(
                    self.repository
                ),
            )
        )


def build_local_benchmark_rag_service(
) -> M2RAGService:
    """
    Construct the real M2 service pipeline using
    deterministic model adapters.
    """

    embedding_service = (
        DeterministicBenchmarkEmbeddingService()
    )

    reranker = (
        CrossEncoderReranker(
            model_name=(
                "m2-local-benchmark-reranker-v1"
            ),

            enabled=True,

            model=(
                DeterministicBenchmarkCrossEncoder()
            ),
        )
    )

    retriever = HybridRetriever(
        embedding_service=(
            embedding_service
        ),

        vector_store=(
            PgVectorStore()
        ),

        lexical_retriever=(
            PostgresBM25Retriever()
        ),

        reranker=(
            reranker
        ),
    )

    citation_generator = (
        CitationGenerator(
            context_provider=(
                PostgresCitationContextProvider()
            )
        )
    )

    pipeline = (
        EvidenceCitationPipeline(
            retriever=retriever,

            evidence_extractor=(
                EvidenceExtractor()
            ),

            citation_generator=(
                citation_generator
            ),
        )
    )

    return M2RAGService(
        pipeline=pipeline
    )


def run_local_end_to_end_benchmark(
    output_path: (
        str
        | Path
        | None
    ) = None,
) -> BenchmarkReport:
    """
    Seed -> retrieve -> extract evidence ->
    generate citations -> evaluate -> cleanup.
    """

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

        executor = (
            RAGServiceBenchmarkExecutor(
                rag_service=(
                    service
                ),

                project_id=(
                    environment.project_id
                ),

                retrieval_top_k=10,

                max_evidence=10,
            )
        )

        report = (
            M2BenchmarkRunner(
                executor=executor
            ).run(
                environment.dataset
            )
        )

        if output_path is not None:

            write_benchmark_report(
                report=report,
                output_path=(
                    output_path
                ),
            )

        return report

    finally:

        environment.cleanup()