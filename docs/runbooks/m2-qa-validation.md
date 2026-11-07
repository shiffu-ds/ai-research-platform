# M2 Research/RAG - M5 QA Validation Report

## Validation Information

- Validation date: 2026-09-25
- Validated by: M5 - DevOps / Security / QA
- Source branch: feature/m2-research-rag
- Validated commit: 529803af102fc004d7b2e3b14fb89fc6befb5160
- Validation environment: isolated local M5 QA environment

## Scope

M5 independently validated the M2 Research/RAG implementation before final team integration.

Validation covered:

- Python dependency resolution
- PostgreSQL connectivity
- pgvector integration
- M2 database schema
- source and version persistence
- document processing
- OCR
- chunking
- embeddings interface
- dense retrieval
- BM25 lexical retrieval
- hybrid retrieval
- Reciprocal Rank Fusion
- reranking
- retrieval provenance
- evidence extraction
- citation generation
- RAG service integration
- automated tests
- local end-to-end benchmark

## Test Environment

Python: 3.14.7

Tesseract: 5.5.0

Database image:
pgvector/pgvector:0.8.6-pg16

Temporary database endpoint:
127.0.0.1:5434

Database:
rag_dev

Database user:
rag

The temporary validation database container was removed after testing.

## Database Validation

The following SQL scripts were successfully applied:

- rag/sql/001_m2_vector_dev.sql
- rag/sql/002_m2_provenance_dev.sql
- rag/sql/003_m2_retrieval_provenance_dev.sql

Verified database tables:

- m2_document_chunks
- m2_document_versions
- m2_documents
- m2_retrieval_results
- m2_retrieval_runs
- m2_source_versions
- m2_sources

Python-to-PostgreSQL connection result:

M2 database connection PASSED

## Automated Test Validation

Final complete test command executed on the M2 validation branch:

PYTHONPATH=rag/src python -m pytest tests/m2 -q

Result:

101 passed in 12.75s

Status: PASS

No tests were excluded from the final validation run.

## OCR Validation

Tesseract was installed and detected successfully.

OCR-specific validation result:

1 passed in 1.26s

Status: PASS

## M2 Local End-to-End Benchmark

Benchmark command:

PYTHONPATH=rag/src python rag/evaluation/run_local_benchmark.py

Results:

| Metric | Result |
| --- | ---: |
| Retrieval Recall@10 | 1.0000 |
| Retrieval Precision@10 | 0.8000 |
| Retrieval MRR | 1.0000 |
| Evidence Attribution Accuracy | 1.0000 |
| Evidence Completeness | 1.0000 |
| Citation Correctness | 1.0000 |

Dataset version: m2-local-seed-v1

Threshold version: 1.0

Final benchmark result:

FINAL GATE: PASS

## M5 QA Result

Validated commit:

529803af102fc004d7b2e3b14fb89fc6befb5160

Validation result:

- Automated tests: PASS
- PostgreSQL integration: PASS
- pgvector integration: PASS
- OCR: PASS
- RAG benchmark: PASS
- Evidence and citation pipeline: PASS

M2 Research/RAG is QA-validated for the tested commit.

This validation does not merge M2 into main.

If M2 changes after the validated commit, the relevant M5 QA tests must be rerun.

## Remaining Platform-Level Validation

Final application-level validation depends on delivery and integration of the remaining team modules.

Pending checks include:

- backend/API integration
- orchestration and agent integration
- frontend integration
- worker/background-job integration
- application Docker builds
- application health checks
- authentication and authorization testing
- prompt-injection testing
- SSRF and input-security testing
- Retry/DLQ runtime verification
- full end-to-end smoke testing
- staging deployment validation
- final release-readiness validation
