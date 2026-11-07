# Autonomous AI Research & Decision Intelligence Platform

Ask a research question; a pipeline of agents plans it, finds and scores sources, retrieves and extracts evidence, checks where sources disagree, and writes a report in which every claim cites a hashed excerpt. People review the report and record decisions against an immutable version.

## What's in the repository

| Folder | Owner | What it holds |
|---|---|---|
| `agents/` | M1 | The eight agents, LangGraph orchestration, run lifecycle, prompt registry, model routing, evaluation gates |
| `rag/` | M2 | Source discovery and scoring, ingestion (PDF, OCR, tables), chunking, embeddings, hybrid retrieval (pgvector + BM25 + RRF + reranker), evidence and citations |
| `backend/` | M3 | FastAPI app (health endpoints so far), SQLAlchemy models, Celery worker that runs one LangGraph execution per research run |
| `alembic/` | M3 | Database migrations (extensions, users, projects, project members) |
| `frontend/` | M4 | Next.js web app — see `frontend/README.md` |
| `infrastructure/` | M5 | Prometheus, Alertmanager, Grafana, Loki, Tempo, Alloy, OTel collector configs; Terraform skeleton; environment templates |
| `scripts/` | M5 | Stack health checks, backup/restore, security and SBOM scans |
| `tests/` | M1, M2 | `tests/m1` (agents), `tests/m2` (RAG); backend tests live in `backend/tests` |
| `docs/` | all | Runtime contracts, runbooks, QA reports |

## Running things locally

Infrastructure (Postgres with pgvector, Redis, monitoring):

```bash
cp .env.example .env
docker compose up -d
./scripts/check-local-stack.sh
```

Python (3.12):

```bash
pip install -r requirements.txt -r rag/requirements-m2.txt
DATABASE_URL=postgresql://research:local_only_change_me@localhost:5432/research alembic upgrade head
```

Tests — the RAG integration tests need the M2 dev database:

```bash
docker compose -f rag/docker-compose.m2.yml up -d
for f in rag/sql/00*.sql; do PGPASSWORD=rag psql -h localhost -p 5433 -U rag -d rag_dev -f "$f"; done
DATABASE_URL=postgresql://rag:rag@localhost:5433/rag_dev pytest
```

Frontend (runs on demo data unless pointed at the API):

```bash
cd frontend && npm ci && npm run dev
```

For the browser to call the API, list the frontend's origin in `CORS_ORIGINS` (already `http://localhost:3000` in `.env.example`).

## CI

`.github/workflows/ci.yml` validates infrastructure configs and alert rules (with unit tests), scans for secrets and vulnerabilities, runs the frontend quality gates, and runs all Python suites plus a migration check against a pgvector service container.

Ports, commands and environment variables each team exposes are recorded in `docs/runtime-contracts.md`.
