# Runtime Contracts

## Autonomous AI Research & Decision Intelligence Platform

This document records the runtime information required by M5
to containerize, test, monitor, secure, and deploy each project component.

Do not change service commands, ports, environment-variable names,
or health interfaces without updating this document.

---

# M1 — AI / Orchestration

Owner: M1

Required information:

- Worker/process start command: TBD
- Required AI environment variables: TBD
- Model/API secret variable names: TBD
- Worker health signal: TBD
- Metrics exposed: TBD
- Logging interface: TBD
- LangGraph execution entrypoint: TBD

---

# M2 — Research / RAG

Owner: M2

Required information:

- RAG runs inside backend or separate service: TBD
- Service start command: TBD
- Service port if separate: TBD
- Vector database requirement: TBD
- Object storage requirement: TBD
- Storage paths: TBD
- Environment variables: TBD
- Health endpoint: TBD

---

# M3 — Backend / Database

Owner: M3

Required information:

- FastAPI start command: TBD
- Backend port: expected 8000, confirmation required
- DATABASE_URL format: `postgresql://USER:PASSWORD@HOST:PORT/DB` (psycopg 3). The backend also accepts `postgresql+psycopg://…`; the RAG module reads the same variable
- REDIS_URL format: TBD
- Celery worker command: TBD
- Database migration command: `alembic upgrade head` (run from the repository root; requires DATABASE_URL)
- Python dependency installation command: `pip install -r requirements.txt` (RAG extras: `rag/requirements-m2.txt`)
- Liveness endpoint: expected /health/live
- Readiness endpoint: expected /health/ready

---

# M4 — Frontend

Owner: M4

Required information:

- Working directory: `frontend/` (Node.js 24, npm)
- Package installation command: `npm ci`
- Development start command: `npm run dev` (add `-- --port <n>` to change the port)
- Production build command: `npm run build`
- Production start command: `npm run start`
- Quality gates: `npm run typecheck`, `npm run lint`, `npm test` (or `npm run check` for all three)
- Frontend port: 3000 (Next.js default)
- Backend API URL variable: NEXT_PUBLIC_API_BASE_URL (default `http://localhost:8000/api/v1`; inlined at build time)
- Data mode variable: NEXT_PUBLIC_USE_MOCK — anything other than `false` serves the in-browser demo workspace; set `false` for integration so the UI calls the API and SSE stream
- Frontend health-check method: `GET /api/health` → `200 {"status":"alive","service":"frontend","dataMode":…}`
- Backend readiness: the UI polls `GET <API origin>/health/ready` every 30 s in live mode and shows the result in the sidebar

---

# M5 — DevOps / Security / QA

Owner: Shoaib

## PostgreSQL

- Image: postgres:16-alpine
- Internal port: 5432
- Host port: not exposed
- Docker service name: postgres
- Container name: research-postgres
- Persistent volume: research_postgres_data
- Health command: pg_isready

Internal Docker address:

postgres:5432

---

## Redis

- Image: redis:7-alpine
- Internal port: 6379
- Host port: not exposed
- Docker service name: redis
- Container name: research-redis
- Persistent volume: research_redis_data
- Health command: redis-cli ping

Internal Docker address:

redis:6379

---

# Integration Rule

M5 must not invent another module's runtime command.

The owning team member provides the real runtime contract.

M5 then converts that contract into:

- Docker configuration
- CI/CD configuration
- monitoring
- health checks
- security checks
- deployment configuration
- operational documentation
