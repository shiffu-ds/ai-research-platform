# Phase 2: Research Run Wizard & Real-Time SSE Telemetry Monitor
## Implementation Documentation & Cross-Team Alignment Report

> **Document Classification**: Frontend Engineering Milestone Documentation (Phase 2)  
> **Subsystem**: Client Web Application (`frontend/`)  
> **Target GitHub Issues**: GH-48 (Research Run Interface), GH-51 (SSE Client & Reducer)  
> **Status**: Completed & Verified (100% Passing Tests, Production Build Passed)  
> **Date**: September 25, 2026  
> **Author**: Usman Hameed (M4 — Frontend Lead)  

---

## 1. Executive Summary & Delivered Scope

Phase 2 delivers the operational core of the **Autonomous AI Research & Decision Intelligence Platform**:
1. **Interactive Multi-Step Run Creation Wizard (`/research/new` — GH-48)**:
   - Guided 3-step configuration for formulating research questions, setting candidate source limits, selecting vector embedding models, configuring model routing (primary & fallback), and enabling deterministic contradiction analysis.
   - Enforces RBAC permissions: dynamically restricts run creation for `VIEWER` and `ANALYST` roles per §12.2.2.
2. **Live Real-Time Telemetry Monitor (`/research/[runId]` — GH-48, GH-51)**:
   - **8-Stage Framer Motion Pipeline Tracker (`StageTimeline.tsx`)**: Physics-based spring animated pipeline reflecting all 8 agents from `Research Planner` to `Validation Agent`.
   - **Monotonic Terminal Event Log (`EventLogFeed.tsx`)**: Auto-scrolling terminal displaying all 14 monotonic event types (§10) with sequence IDs (`#001`, `#002`), ISO timestamps, and payload inspection.
   - **Live Telemetry Discovery Cards**: Real-time counters tracking Discovered Sources, Retrieved Chunks, Extracted Claims, and Contradictions Flagged.
3. **10-Second SLA Cancellation Engine (`CancelRunDialog.tsx` — §7.1, §7.2)**:
   - Modal with reason selection, countdown timer, and state machine transition from `RUNNING` → `CANCEL_REQUESTED` → `CANCELLED`.
4. **Idempotent SSE Client & Reducer (`lib/sse/` — GH-51)**:
   - Pure reducer (`event-processor.ts`) enforcing `incoming.id > state.lastEventId`. Out-of-order or duplicate replayed events are strict no-ops.
   - Dual-mode connection (`useSSE.ts`): runs against a high-fidelity client simulation streamer during development and hooks into live FastAPI SSE stream (`/api/v1/research-runs/{id}/events`) in production.
5. **Research Runs Registry (`/research`)**:
   - Filterable runs catalog with search, stage badges, progress bars, and direct links to live telemetry.

---

## 2. Cross-Team Traceability & Boundary Alignment

```
+-----------------------------------------------------------------------------------+
|                              YOUR FRONTEND (M4)                                   |
|   App Shell (Phase 1) ──► Run Wizard (Phase 2) ──► SSE Monitor (Phase 2)          |
+----------------------------------------┬------------------------------------------+
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
+--------------------+         +--------------------+         +--------------------+
|  M1: ORCHESTRATION |         |    M2: RAG / DATA  |         |   M3: FASTAPI / DB |
| (Talha - 100% Done)|         | (Complete & Tested)|         | (In Progress / API)|
+--------------------+         +--------------------+         +--------------------+
| 8-stage visualizer |         | Telemetry counters |         | Strict REST & SSE  |
| mirrors LangGraph  |         | match chunk size   |         | contract mapping   |
| agents/ nodes and  |         | (800t) and SHA-256 |         | (/api/v1/). Zero   |
| 15 state machine.  |         | evidence hashes.   |         | code refactor on   |
| Bounded repair loop|         |                    |         | live backend sync. |
+--------------------+         +--------------------+         +--------------------+
```

### 2.1 Alignment with M1 (AI & Orchestration Lead — Talha)
- **8 Agent Pipeline Stages**: The UI pipeline (`PLANNER`, `DISCOVERY`, `RETRIEVAL`, `EVIDENCE`, `CONTRADICTION`, `ANALYSIS`, `REPORT`, `VALIDATION`) maps 1-to-1 with M1's contracts in `agents/`.
- **15 State Machine States**: Supports all intake, processing, control, success, and terminal failure states defined in §7.
- **Bounded Validation Loop**: State transitions track `REPAIRING` with `repairAttempts` counter governed by `MAX_REPAIR_ATTEMPTS = 3` (§23).

### 2.2 Alignment with M2 (Research / RAG Lead)
- **Chunking & Vector Dimensions**: Wizard explicitly exposes `800 tokens / 120 overlap` and `3072-dim text-embedding-3-large`, locking M2's verified specifications.
- **Evidence Provenance & SHA-256**: Discovered chunks and claims display SHA-256 provenance hashes matching M2's `rag/` implementation.

### 2.3 Alignment with M3 (Backend / Database Lead)
- **Target Endpoints**:
  - `POST /api/v1/research-runs`
  - `GET /api/v1/research-runs/{run_id}/events` (with `Last-Event-ID` header)
  - `POST /api/v1/research-runs/{run_id}/cancel`
- **Dual-Mode Engine**: Our `useSSE` hook includes a realistic mock streamer during frontend development. When M3 deploys the FastAPI backend, setting `NEXT_PUBLIC_USE_MOCK=false` instantly hooks to the live stream.

### 2.4 Alignment with M5 (DevOps / QA Lead — Shoaib)
- **10-Second Cancellation SLA**: The `CancelRunDialog` enforces the exact 10s cancellation window specified in §7.1 and monitored by M5's Prometheus alerts.

---

## 3. Component Architecture & Files Delivered

```
frontend/src/
├── app/
│   ├── research/
│   │   ├── page.tsx               # Runs catalog & search/filter table
│   │   ├── new/page.tsx           # Multi-step Run Creation Wizard (GH-48)
│   │   └── [runId]/page.tsx       # Live SSE Run Monitor Route (GH-48, GH-51)
├── components/
│   └── research/
│       ├── StageTimeline.tsx      # 8-Stage Framer Motion Animated Pipeline
│       ├── EventLogFeed.tsx       # Monospace Terminal Event Stream
│       ├── CancelRunDialog.tsx    # 10s SLA Cancellation Modal (§7.2)
│       └── RunMonitor.tsx         # Master Telemetry Layout
├── hooks/
│   └── useSSE.ts                  # EventSource hook with backoff & mock fallback
├── lib/
│   └── sse/
│       ├── event-processor.ts     # Pure idempotent event reducer
│       └── event-simulator.ts     # Realistic client-side event streamer
└── tests/
    └── unit/
        └── event-processor.test.ts # Reducer unit tests (dedup, monotonicity, states)
```

---

## 4. Verification & Automated Quality Gates

### 4.1 Unit Test Suite (`npm test`)
```text
▶ SSE Idempotent Event Reducer (v4.0 §10 & GH-51)
  ✔ processes monotonically increasing events in order (2.44ms)
  ✔ strictly drops duplicate or replayed events (id <= lastEventId) (0.31ms)
  ✔ handles cancellation requested and completed states (§7.1, §7.2) (0.21ms)
✔ SSE Idempotent Event Reducer (v4.0 §10 & GH-51) (4.33ms)

▶ RBAC Permission Matrix (§11.2.2 & §12.2.2)
  ✔ OWNER has full administrative rights (1.71ms)
  ✔ ADMIN can manage members and runs but cannot delete project (0.30ms)
  ✔ RESEARCHER can create runs and cancel own runs only (0.19ms)
  ✔ ANALYST can view reports and approve decisions but cannot create runs (0.31ms)
  ✔ VIEWER is strictly read-only (0.19ms)
✔ RBAC Permission Matrix (§11.2.2 & §12.2.2) (4.96ms)

▶ Timezone Localization Engine (§42 & GH-55)
  ✔ formats UTC timestamp accurately to specified timezone (33.40ms)
  ✔ handles empty or null timestamps gracefully (1.36ms)
✔ Timezone Localization Engine (§42 & GH-55) (37.71ms)

ℹ tests 10
ℹ suites 3
ℹ pass 10
ℹ fail 0
```

### 4.2 Production Bundle Compilation (`npm run build`)
- Next.js 16 / React 19 Turbopack build: **Passed in 2.3s with zero errors**.
- All static and dynamic routes generated successfully.

---

## 5. How to Run and Demo Phase 2 in Browser

1. Start your local dev server:
   ```powershell
   cd "d:\MD SOFT\A.I RESEARCH_AGENT\autonomous-ai-research-platform\frontend"
   npm run dev
   ```
2. Open [http://localhost:3000](http://localhost:3000):
   - Click **"New Research Run"** on the dashboard (or navigate to `/research/new`).
   - Fill out the 3-step wizard (or pick one of the quick starter templates).
   - Click **"Launch Autonomous Run"**:
     - You will be automatically routed to the **Live Run Telemetry Monitor** (`/research/[runId]`).
     - Watch the **8-stage Framer Motion pipeline animate** in real time as agents progress.
     - Watch the **terminal event feed populate** with monotonic IDs (`#001`, `#002`, `#003...`).
     - Watch the live discovery cards increment (*Sources*, *Chunks*, *Extracted Claims*, *Conflicts*).
   - Click **"Cancel Run (10s SLA)"** to test the 10-second SLA cancellation countdown modal.
3. Open [http://localhost:3000/research](http://localhost:3000/research):
   - Browse the full list of research runs, filter by state, or search by query.

---

## 6. Next Step: Phase 3 Ready
With Phase 2 delivered and verified, we are prepared to proceed with **Phase 3: Immutable Report Viewer, 7-Tier Citation Inspector & Contradiction Engine**:
- **GH-49 (Report Interface & Viewer)**: Section-by-section markdown rendering with interactive citation pills (`[1]`, `[2]`).
- **Evidence Provenance Drawer & SHA-256 Verifier (§17, §18)**: Slide-over drawer displaying raw text chunks, confidence scores, and client-side SHA-256 hash validation.
- **Contradiction Analysis Inspector (§20)**: Interactive review table comparing normalized claims across all 9 conflict categories.
- **Report Diff Engine & Human Decision Form (GH-43 / §36)**: Version comparison (`v1` vs `v2`) and append-only decision audit logging.
