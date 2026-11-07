# Autonomous AI Research & Decision Intelligence Platform
## Frontend Architecture Specification & Implementation Baseline (v4.0 Aligned)

> **Document Classification**: Frontend Architecture Baseline & Technical Specification  
> **Target Subsystem**: Client Web Application (`frontend/`)  
> **Team Role**: M4 — Frontend Lead & Core Team (2–3 Engineers)  
> **Change Baseline**: GH-47 through GH-56 (M4 Traceability Set)  
> **Status**: Approved Implementation Baseline  

---

## Table of Contents
1. [Executive Summary & Scope Boundary](#1-executive-summary--scope-boundary)
2. [Document Traceability & Gap Resolution Analysis](#2-document-traceability--gap-resolution-analysis)
   - 2.1 [Directly Derived from v4.0 Specification](#21-directly-derived-from-v40-specification)
   - 2.2 [Identified Gaps & Missing Frontend Details in v4.0](#22-identified-gaps--missing-frontend-details-in-v40)
   - 2.3 [Architectural Additions & Industry Best Practices Injected](#23-architectural-additions--industry-best-practices-injected)
3. [Technology Stack Rationale & Standards](#3-technology-stack-rationale--standards)
4. [Spec-Driven Documentation Architecture (`frontend/docs/`)](#4-spec-driven-documentation-architecture-frontenddocs)
5. [Complete Frontend Directory & Code Structure](#5-complete-frontend-directory--code-structure)
6. [Design System & UI Aesthetics (AI-Era Premium Dark Mode)](#6-design-system--ui-aesthetics-ai-era-premium-dark-mode)
7. [Page Inventory, Routing & RBAC Gate Matrix](#7-page-inventory-routing--rbac-gate-matrix)
8. [Core Complex Component Specifications](#8-core-complex-component-specifications)
   - 8.1 [SSE-Driven Research Run Monitor (GH-48, GH-51)](#81-sse-driven-research-run-monitor-gh-48-gh-51)
   - 8.2 [Immutable Report Viewer & Diff Engine (GH-49)](#82-immutable-report-viewer--diff-engine-gh-49)
   - 8.3 [Evidence Provenance Chain Visualizer (§17, §18)](#83-evidence-provenance-chain-visualizer-17-18)
   - 8.4 [Contradiction Analysis Inspector (§20)](#84-contradiction-analysis-inspector-20)
9. [State Management Architecture & SSE Idempotency](#9-state-management-architecture--sse-idempotency)
10. [M4 Traceability Matrix (GH-47 – GH-56)](#10-m4-traceability-matrix-gh-47--gh-56)
11. [Verification, Testing & CI/CD Quality Gates](#11-verification-testing--cicd-quality-gates)
12. [10-Week Phased Implementation Roadmap](#12-10-week-phased-implementation-roadmap)

---

## 1. Executive Summary & Scope Boundary

This document establishes the authoritative, implementation-ready architectural baseline for the frontend of the **Autonomous AI Research & Decision Intelligence Platform**. 

The frontend team (M4) is solely responsible for client-side execution, user interaction, real-time telemetry streaming, report visualization, evidence inspection, collaboration, and accessibility.

### Hard Architectural Boundary:
- **FastAPI / Celery / LangGraph / PostgreSQL / Object Storage / Qdrant** are external dependencies owned by M1, M2, M3, and M5.
- The frontend interacts with the system strictly through:
  1. Authenticated REST API (`/api/v1/` endpoints per §34).
  2. Server-Sent Events (SSE) stream (`/api/v1/research-runs/{run_id}/events` per §10).
- The frontend **never** runs autonomous agent logic, raw embedding calculations, or untrusted external scraping directly.

---

## 2. Document Traceability & Gap Resolution Analysis

To ensure complete architectural fidelity and professional transparency, this section details what was extracted directly from the system specification, what was underspecified or absent regarding the frontend, and what enterprise patterns were introduced.

### 2.1 Directly Derived from v4.0 Specification
These elements are mapped 1-to-1 from the core system design document without deviation:

| Specification Area | Source Section in v4.0 | Concrete Mandatory Requirement |
|---|---|---|
| **Research Run State Machine** | §7 (Figure 7.1, §7.1) | States: `QUEUED`, `PLANNING`, `SOURCE_DISCOVERY`, `RETRIEVAL`, `EVIDENCE_EXTRACTION`, `CONTRADICTION_ANALYSIS`, `SYNTHESIS`, `REPORT_GENERATION`, `VALIDATION`, `REPAIRING`, `PAUSED`, `CANCEL_REQUESTED`, `CANCELLED`, `FAILED`, `COMPLETED`. Categorical colors: Blue (Intake), Gold (Processing), Purple (Validation/Repair), Orange (Control), Green (Success), Red (Terminal Failure). |
| **Run Cancellation SLA** | §7.1, §7.2 | Cancellation endpoint `POST /api/v1/research-runs/{run_id}/cancel`. UI must acknowledge transition to `CANCEL_REQUESTED` within 10 seconds. |
| **SSE Replay & Reconnection** | §10 (Figure 10.1) | Endpoint `GET /api/v1/research-runs/{run_id}/events`. Reconnection must send `Last-Event-ID` header. Server returns all events with greater ID. Heartbeat interval: 15 seconds. Client backoff: 1s, 2s, 4s, 8s, capped at 30s. |
| **SSE Event Catalog** | §10 | All 14 mandatory event types: `research.created`, `research.queued`, `research.started`, `research.stage_changed`, `research.progress`, `research.source_found`, `research.evidence_found`, `research.validation_started`, `research.repair_started`, `research.completed`, `research.failed`, `research.cancel_requested`, `research.cancelled`. |
| **RBAC Roles & Matrix** | §11.2.1, §11.2.2 | 5 roles: `OWNER`, `ADMIN`, `RESEARCHER`, `ANALYST`, `VIEWER`. Exact permission matrix applied to run creation, cancellation, report viewing, human decisions, prompt configs, and audit logs. |
| **Evidence & Citation Provenance Chain** | §17, §18 (Figure 18.1) | Strict 7-tier traceability: `Report Version` → `Report Section` → `Claim` → `Evidence` → `Document Chunk` → `Document Version` → `Source Version` → `Immutable Snapshot`. Evidence hash is SHA-256(excerpt + locator). |
| **Contradiction Classifications** | §20.1 | 9 deterministic classification categories: `DIRECT_CONTRADICTION`, `NUMERIC_CONFLICT`, `TEMPORAL_DIFFERENCE`, `METHODOLOGY_DIFFERENCE`, `SCOPE_DIFFERENCE`, `UNIT_DIFFERENCE`, `DEFINITION_DIFFERENCE`, `ENTITY_AMBIGUITY`, `INSUFFICIENT_CONTEXT`. |
| **Validation Bounds** | §23 | `MAX_REPAIR_ATTEMPTS = 3`, `MAX_VALIDATION_TIME = 180s`. Escalation to `VALIDATION_FAILED` on exhaustion; never silently mark complete. |
| **Performance Targets** | §24 / §25 | API p95 ≤ 300ms, SSE event latency ≤ 500ms server-to-client, Retrieval latency ≤ 800ms. |
| **Security & Prompt Injection** | §26.3 | Strict UI boundary: external retrieved text is data, never rendered as executable script; tool outputs schema-validated. |
| **API Versioning Standard** | §34 | Strict `/api/v1/` prefix, standard rate-limit headers. |
| **Report Immutability** | §35 | Reports are versioned snapshots (`Report` → `v1`, `v2`, ... `vN`). Never destructive edits. Version diffing is a first-class feature. |
| **Human Decision Audit** | §36 | Append-only decision records with `decision_id`, `user_id`, `project_id`, `report_version_id`, `decision_type`, `decision_value`, `reason`. |
| **Accessibility Conformance** | §38 | WCAG 2.1 AA conformance, keyboard navigation, 3:1 focus contrast, 4.5:1 text contrast, `aria-live` for SSE streams, axe-core scans. |
| **Notification Types** | §39 | 8 notification events scoped strictly by project membership and role. |
| **Scheduled Research Duplicate Guard** | §40 | UI must support cron/interval scheduling and display next scheduled run times. |
| **Localization & Timezone** | §42 | Backend stores exclusively in UTC; frontend renders according to user timezone preference. Scheduled research stores its own explicit timezone. |
| **Analytics Metric Domains** | §47 | Tracking Research metrics, AI metrics (agent execution, tokens, costs), and RAG metrics (latency, retrieval mix, citation coverage). |
| **GitHub Issue Mapping** | §52.4 | GH-47 through GH-56 assigned to M4 Frontend. |

---

### 2.2 Identified Gaps & Missing Frontend Details in v4.0
While v4.0 is comprehensive for backend, data models, and agent boundaries, it deliberately leaves specific client-side architectural and technical details unspecified:

1. **Specific Framework Variant & Routing Paradigm**: The document specifies "Next.js Web Application" (§3.1) but does not define whether to use Pages Router or App Router (RSC), or which React version to target.
2. **Component Library & Design Tokens**: No design system, color palette hex codes, spacing scales, or component libraries were defined.
3. **Client State Engine**: §37 states "Server (React Query-style cache)" and "Local component state", but does not specify the exact libraries for client-side state, global UI state, or the SSE stream reducer.
4. **Form Handling & Validation**: No specification on how client-side form validation coordinates with backend Zod/Pydantic schemas.
5. **Interactive Visualization & Graph Representation**: No charting library or graph visualization tools were designated for the Analytics and Evidence Provenance displays.
6. **Authentication Handshake & Token Refresh**: §26.1 notes authentication is required (session/bearer) but leaves client-side token refresh, storage, and middleware route interception unspecified.
7. **Bundle Budgets & Core Web Vitals**: While backend latency targets are set in §25, frontend performance metrics (LCP, INP, CLS, bundle chunk sizes) were omitted.

---

### 2.3 Architectural Additions & Industry Best Practices Injected
To resolve the above gaps and align with elite 2025/2026 AI SaaS market standards, the following professional architectural solutions are introduced:

1. **Next.js 15 with App Router & React 19 (Server Components)**:
   - Server-side data fetching for static metadata, reports, and initial project contexts (zero client waterfall).
   - Dynamic client boundaries (`"use client"`) isolated specifically to interactive nodes (SSE Run Monitor, Decision Modals, Diff Engine).
2. **Hybrid State Architecture (TanStack Query v5 + Zustand)**:
   - **Server State**: Managed via TanStack Query (automatic garbage collection, cache invalidation on mutations, optimistic updates).
   - **Client/Streaming State**: Managed via lightweight Zustand stores for SSE event batching, audio/visual cues, drawer states, and user preferences.
3. **Idempotent SSE Event Reducer**:
   - A dedicated reducer layer (`lib/sse/event-processor.ts`) that enforces monotonic `event_id` tracking. Duplicate or out-of-order replayed events are processed as strict no-ops, preventing state corruption during connection dropouts.
4. **Design System Built on shadcn/ui & Radix Primitives**:
   - Eliminates bloated runtime CSS libraries; full ownership of components.
   - Built-in WAI-ARIA compliance guaranteeing satisfaction of the §38 WCAG 2.1 AA mandate.
   - Dark-mode-first aesthetic with customized glassmorphic depth (`backdrop-blur-md`, subtle border translucency) tailored for high-density AI data platforms.
5. **Framer Motion for Stage Telemetry**:
   - Physics-based spring animations for the 8-stage agent pipeline, live source card ingestion, and evidence counter tickers to deliver an engaging user experience without UI jitter.
6. **Unified Type-Safe RBAC Engine (`can(role, action)`)**:
   - Strongly-typed helper derived directly from §12.2.2 matrix. Centralizes permission checks across route middleware, navigation bars, and action buttons.
7. **Spec-Driven Documentation Architecture (`frontend/docs/`)**:
   - Dedicated folder inside `frontend/` housing 19 modular `.md` technical specs. This provides persistent context for both human developers and future AI agent sessions.

---

## 3. Technology Stack Rationale & Standards

```
+-------------------------------------------------------------------------+
|                              Next.js 15                                 |
|                       (App Router, React 19, RSC)                       |
+--------------------+-------------------------------+--------------------+
|  UI & Presentation |       State & Streaming       | Data & Networking  |
+--------------------+-------------------------------+--------------------+
| Tailwind CSS v4    | TanStack Query v5 (Server)    | Axios Instance     |
| shadcn/ui (Radix)  | Zustand (Client & SSE State)  | EventSource (SSE)  |
| Framer Motion      | Custom Idempotent Reducer     | Zod v3 Validation  |
| Lucide Icons       | Local Storage (Timezone Pref) | React Hook Form    |
+--------------------+-------------------------------+--------------------+
|                               Tooling                                   |
|       TypeScript 5 (Strict) | pnpm | Vitest | Playwright | axe-core     |
+-------------------------------------------------------------------------+
```

| Layer | Technology Choice | Version | Architectural Justification |
|---|---|---|---|
| **Framework** | Next.js App Router | 15.x | High-performance React Server Components, file-system routing, built-in SEO metadata management, optimized edge middleware. |
| **Language** | TypeScript (Strict Mode) | 5.x | End-to-end type safety. `noImplicitAny`, `strictNullChecks` enforced. Eliminates runtime contract mismatches. |
| **Styling** | Tailwind CSS | 4.x | High-speed compilation, CSS variable design tokens, utility-first consistency, zero runtime overhead. |
| **Component Primitives** | shadcn/ui + Radix UI | Latest | Unstyled, fully accessible, accessible modal/dialog focus traps, screen-reader ready out of the box. |
| **Animation** | Framer Motion | 11.x | Fluid spring transitions for agent state progression, collapsible diff views, and dynamic telemetry cards. |
| **Server State** | TanStack Query | v5 | Robust cache synchronization, background refetching, mutation lifecycle hooks, query deduplication. |
| **Streaming & Local State** | Zustand | v5 | Zero-boilerplate client state store. Excellent performance for handling high-frequency SSE event dispatches without re-rendering parent tree. |
| **Visualizations & Charts** | Recharts | 2.x | Composable SVG-based charting library; easily themed to match dark mode for all §47 analytics views. |
| **Forms & Schemas** | React Hook Form + Zod | Latest | High-performance uncontrolled form inputs coupled with strict schema validation mirroring backend contracts. |
| **Testing** | Vitest + Playwright + axe-core | Latest | Fast unit testing, cross-browser End-to-End browser validation, and automated WCAG 2.1 AA accessibility gating in CI. |

---

## 4. Spec-Driven Documentation Architecture (`frontend/docs/`)

To support long-term maintainability, developer onboarding, and seamless AI agent pair programming, the `frontend/docs/` directory is structured as follows:

```
frontend/docs/
├── 00-overview.md              # High-level vision, guidelines, quick start
├── 01-tech-stack.md            # Detailed package matrix, peer dependencies, scripts
├── 02-design-system.md         # Design tokens, color palette, typography, glassmorphism
├── 03-folder-structure.md      # Architectural directory standards and import boundaries
├── 04-auth.md                  # JWT/Session handling, Route Guards, RBAC Middleware
├── 05-api-client.md            # Axios setup, interceptors, error mapping, rate limiting
├── 06-sse-client.md            # EventSource protocol, Last-Event-ID, reconnection, backoff
├── 07-state-architecture.md    # TanStack Query keys, Zustand stores, cache invalidation
├── 08-dashboard.md             # Dashboard layout, project overview, quick launch widgets
├── 09-research-interface.md    # Multi-step Run Wizard, SSE Monitor, Run Cancellation
├── 10-report-interface.md      # Report Viewer, Section Renderer, Citation Panel, Diff Engine
├── 11-notifications.md         # Toast alerts, Notification drawer, Unread badge tracking
├── 12-collaboration.md         # Project Members table, Role assignments, Invite modal
├── 13-accessibility.md         # WCAG 2.1 AA checklist, keyboard navigation, axe-core tests
├── 14-localization.md          # UTC normalization, client-side timezone formatting
├── 15-analytics.md             # Research, AI, and RAG metric charts & KPI cards
├── 16-scheduled-research.md    # Cron selector, schedule manager, duplicate run guard
├── 17-testing-strategy.md      # Unit, integration, E2E, and regression test suites
├── 18-ci-cd-gates.md           # Lint, typecheck, coverage, and security pipelines
└── 19-performance.md           # Core Web Vitals, code splitting, bundle size budgets
```

---

## 5. Complete Frontend Directory & Code Structure

```
frontend/
├── docs/                           # 19 Spec-Driven Architectural Markdown Documents
│   ├── base-frontend-architecture.md
│   └── ...
├── public/
│   ├── fonts/                      # Self-hosted Inter & JetBrains Mono fonts
│   └── icons/                      # Branded vector icons and SVG emblems
├── src/
│   ├── app/                        # Next.js 15 App Router Directory
│   │   ├── (auth)/                 # Unauthenticated route group
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/            # Authenticated protected route group
│   │   │   ├── layout.tsx          # Master shell: Sidebar, Header, Breadcrumbs
│   │   │   ├── page.tsx            # Global Dashboard / Recent Runs
│   │   │   ├── analytics/page.tsx  # Cross-project telemetry analytics (§47)
│   │   │   └── projects/
│   │   │       ├── page.tsx        # Project Directory & Creation
│   │   │       └── [projectId]/
│   │   │           ├── page.tsx    # Project Summary & Activity
│   │   │           ├── research/
│   │   │           │   ├── page.tsx         # Runs table with state badges
│   │   │           │   ├── new/page.tsx     # Wizard: Question, Scope, Params
│   │   │           │   └── [runId]/
│   │   │           │       ├── page.tsx     # Live SSE Run Telemetry Monitor
│   │   │           │       └── report/page.tsx # Final/Snapshot Report Viewer
│   │   │           ├── reports/page.tsx     # Versioned Report Index
│   │   │           ├── sources/page.tsx     # Source repository & authority scores
│   │   │           ├── members/page.tsx     # RBAC Collaboration & Invitations
│   │   │           ├── schedule/page.tsx    # Scheduled recurring research runs
│   │   │           └── settings/page.tsx    # Project configs & API keys
│   │   ├── api/                    # Route Handlers for client-side proxying if needed
│   │   ├── globals.css             # Tailwind v4 theme, tokens & utility layers
│   │   └── layout.tsx              # Root HTML wrapper with theme & query providers
│   │
│   ├── components/                 # Reusable UI Component Hierarchy
│   │   ├── ui/                     # shadcn/ui primitives (Button, Dialog, Dropdown, etc.)
│   │   ├── layout/                 # Shell, Navigation, TopBar, Breadcrumb, UserMenu
│   │   ├── auth/                   # LoginForm, AuthGuard, SessionTimeoutModal
│   │   ├── projects/               # ProjectCard, CreateProjectModal, ProjectBadge
│   │   ├── research/               # Research Run components:
│   │   │   ├── RunCreationWizard/  # Stepper: Prompt -> Sources -> Configuration
│   │   │   ├── RunMonitor/         # SSE streaming telemetry layout
│   │   │   ├── StageTimeline/      # 8-stage visual pipeline with live status
│   │   │   ├── EventLogFeed/       # Real-time auto-scrolling terminal event stream
│   │   │   ├── RunStatusBadge/     # Strict color-coded status badge (§7)
│   │   │   └── CancelRunDialog/    # 10s SLA cancellation modal with reason prompt
│   │   ├── reports/                # Report generation & review components:
│   │   │   ├── ReportViewer/       # Markdown/HTML section renderer with citations
│   │   │   ├── CitationCard/       # Inline popover & sidebar citation display
│   │   │   ├── ContradictionBadge/ # Badges for the 9 contradiction types (§20)
│   │   │   ├── VersionSelector/    # Report snapshot dropdown with timestamp/diff
│   │   │   ├── ReportDiffView/     # Side-by-side claim & citation comparison
│   │   │   └── HumanDecisionForm/  # Append-only decision auditor modal (§36)
│   │   ├── evidence/               # Evidence verification components:
│   │   │   ├── ProvenanceChain/    # Visual node path from Report -> Source Snapshot
│   │   │   ├── EvidenceDrawer/     # Slide-over inspector for raw text chunks
│   │   │   └── HashVerifier/       # SHA-256 evidence integrity check button
│   │   ├── sources/                # Source discovery & versioning components
│   │   ├── collaboration/          # MemberTable, RoleSelector, InviteModal
│   │   ├── notifications/          # NotificationBell, SlideDrawer, ToastContainer
│   │   ├── analytics/              # LatencyCharts, TokenUsage, RAGMetricsGrid
│   │   └── shared/                 # EmptyState, ErrorBoundary, SkeletonLoader, ConfirmModal
│   │
│   ├── hooks/                      # Custom React Hooks
│   │   ├── useSSE.ts               # Core EventSource hook with reconnect & Last-Event-ID
│   │   ├── useResearchRun.ts       # Orchestrates run polling, mutations & streaming
│   │   ├── useReport.ts            # Report version fetcher and diff calculator
│   │   ├── usePermissions.ts       # RBAC permission checker (`can(action)`)
│   │   ├── useTimezone.ts          # Formats UTC timestamps to user's localized timezone
│   │   └── useNotifications.ts     # SSE/REST notification subscriber
│   │
│   ├── stores/                     # Zustand State Stores (Client/Transient State)
│   │   ├── run-monitor.store.ts    # Holds live streaming run state & event arrays
│   │   ├── notification.store.ts   # Real-time toast queue & unread count
│   │   └── ui.store.ts             # Sidebar collapsed, active modal IDs, inspector open
│   │
│   ├── lib/                        # Business Logic, Helpers & Utilities
│   │   ├── api/
│   │   │   ├── client.ts           # Axios instance with baseURL, interceptors, auth headers
│   │   │   ├── endpoints.ts        # Typed API endpoint map
│   │   │   └── errors.ts           # Error parser mapping backend codes to user feedback
│   │   ├── sse/
│   │   │   ├── event-processor.ts  # Pure idempotent reducer function for SSE events
│   │   │   └── event-types.ts      # TypeScript interfaces for all 14 SSE payloads
│   │   ├── auth/
│   │   │   ├── rbac.ts             # Permission matrix logic implementation (§12.2.2)
│   │   │   └── tokens.ts           # Session and token storage abstraction
│   │   └── utils/
│   │       ├── timezone.ts         # UTC -> Local timezone parsing (date-fns / Intl)
│   │       ├── hash.ts             # Client-side SHA-256 validator for evidence verification
│   │       └── cn.ts               # Tailwind class merger (clsx + tailwind-merge)
│   │
│   ├── types/                      # Domain-wide TypeScript Type Declarations
│   │   ├── api.types.ts            # Mirrors PostgreSQL entities (§11 ERD)
│   │   ├── research.types.ts       # Run states, configuration params, task nodes
│   │   ├── sse.types.ts            # Strict SSE event payloads & metadata
│   │   ├── rbac.types.ts           # Role enums, permission matrix action keys
│   │   ├── report.types.ts         # Report versions, sections, claims, citations
│   │   └── evidence.types.ts       # Chunks, source versions, contradiction objects
│   │
│   └── styles/
│       └── globals.css             # Base styles, dark-mode CSS variables, scrollbars
│
├── tests/                          # Test Suites
│   ├── unit/                       # Vitest unit tests (reducers, rbac, formatters)
│   ├── integration/                # React Testing Library (RunWizard, ReportViewer)
│   └── e2e/                        # Playwright E2E & Accessibility scenarios
│       ├── auth.spec.ts
│       ├── run-lifecycle.spec.ts
│       ├── sse-reconnect.spec.ts
│       └── a11y-wcag.spec.ts
│
├── .env.example                    # Environment variable template
├── next.config.ts                  # CSP headers, image hosts, compiler settings
├── tailwind.config.ts              # Custom colors, animation keyframes, font families
├── tsconfig.json                   # Strict mode TypeScript configuration
├── vitest.config.ts                # Unit testing configuration
├── playwright.config.ts            # E2E test runner configuration
└── package.json                    # Project dependencies and operational scripts
```

---

## 6. Design System & UI Aesthetics (AI-Era Premium Dark Mode)

The UI adheres to a sleek, dark-mode-first aesthetic inspired by leading developer platforms and modern AI interfaces.

### 6.1 Color Palette & Token Architecture
```css
:root {
  /* Surface Foundations */
  --bg-base: #07070a;          /* Deepest obsidian background */
  --bg-subtle: #0f1015;        /* Card & panel surfaces */
  --bg-elevated: #161720;      /* Modals, popovers & floating dropdowns */
  --border-subtle: #1e202e;    /* Standard card borders */
  --border-highlight: #2f334a; /* Hover & active focus borders */

  /* Text Hierarchy */
  --text-primary: #f3f4f6;     /* Pure high-contrast readable text */
  --text-secondary: #9ca3af;   /* Metadata labels and descriptions */
  --text-muted: #6b7280;       /* Timestamps and inactive icons */

  /* Brand Accents */
  --brand-primary: #6366f1;    /* Electric Indigo */
  --brand-glow: rgba(99, 102, 241, 0.15);

  /* Status Colors (Strict §7 & §11 Alignment) */
  --status-intake: #3b82f6;     /* Blue: QUEUED, INTAKE */
  --status-process: #f59e0b;    /* Gold/Amber: PROCESSING, RETRIEVAL */
  --status-validation: #a855f7; /* Purple: VALIDATION, REPAIR */
  --status-control: #ec4899;    /* Pink/Orange: CANCEL_REQUESTED, PAUSED */
  --status-success: #10b981;    /* Emerald: COMPLETED */
  --status-failure: #ef4444;    /* Crimson: FAILED, CANCELLED */

  /* 8-Agent Pipeline Visualizer Colors (§6) */
  --agent-planner: #818cf8;
  --agent-discovery: #34d399;
  --agent-retrieval: #60a5fa;
  --agent-evidence: #c084fc;
  --agent-contradiction: #f472b6;
  --agent-analysis: #fb923c;
  --agent-report: #facc15;
  --agent-validation: #a3e635;
}
```

### 6.2 Typography Tokens
- **Display & Interface**: `Inter, system-ui, sans-serif` — optimized for high-density dashboard layouts.
- **Code, Evidence, Citations & Hashes**: `JetBrains Mono, monospace` — ensures tabular numbers and hash strings (`SHA-256`) align cleanly.

### 6.3 Card & Elevation Aesthetic
- **Glassmorphism**: `.glass-panel { background: rgba(15, 16, 21, 0.75); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); }`
- **Subtle Gradients**: Cards feature faint ambient glow highlights on hover to signal interactive affordance.

---

## 7. Page Inventory, Routing & RBAC Gate Matrix

Every route is guarded by Next.js middleware and client-side authorization checks adhering strictly to §12.2.2:

| Path | View / Description | Allowed Roles | Enforcement Mechanism |
|---|---|---|---|
| `/login`, `/register` | Authentication portals | Public | Redirects to `/` if session exists |
| `/` | System Overview Dashboard | All Roles | Authenticated Session Check |
| `/projects` | Project directory | All Roles | Filtered to user's assigned projects |
| `/projects/[id]` | Project detail & activity feed | All Roles | Member of project required |
| `/projects/[id]/research` | Runs history & status table | All Roles | Member of project |
| `/projects/[id]/research/new` | Run Creation Wizard | `OWNER`, `ADMIN`, `RESEARCHER` | Blocked for `ANALYST`, `VIEWER` (403 modal) |
| `/projects/[id]/research/[runId]` | Live Telemetry Run Monitor | All Roles | Member of project |
| `.../cancel` action | Cancel active run | `OWNER`, `ADMIN`, `RESEARCHER` (own runs only) | UI button disabled + backend 403 handling |
| `/projects/[id]/reports` | Versioned reports catalog | All Roles | Member of project |
| `/projects/[id]/reports/[repId]`| Report viewer & diff view | All Roles | Member of project |
| `.../human-decision` action | Record final human decision | `OWNER`, `ADMIN`, `RESEARCHER`, `ANALYST` | Blocked for `VIEWER` (§12.2.2) |
| `/projects/[id]/members` | Manage collaboration & invites | `OWNER`, `ADMIN` | Read-only view for others; actions hidden |
| `/projects/[id]/schedule` | Recurring research cron config | `OWNER`, `ADMIN`, `RESEARCHER` | Viewable by all; mutations gated |
| `/analytics` | System-wide observability metrics | `OWNER`, `ADMIN` | Hidden from navigation for standard users |

---

## 8. Core Complex Component Specifications

### 8.1 SSE-Driven Research Run Monitor (GH-48, GH-51)
The Run Monitor is the platform's primary real-time operational interface.

```
+-------------------------------------------------------------------------+
| [Header] Run ID: 7a8f...  Status: [EVIDENCE_EXTRACTION]  Timer: 04:32    |
| [Action Bar] [Pause Run]  [Request Cancel (10s SLA)]                    |
+-------------------------------------------------------------------------+
| Pipeline Progression (Framer Motion Animated):                          |
| (1) Plan -> (2) Discover -> (3) Retrieve -> [4] Evidence -> (5) Analyze |
|      [Complete]    [Complete]    [Complete]    [Active 64%]  [Waiting]  |
+------------------------------------+------------------------------------+
| Live Stream Event Feed             | Live Telemetry Discovery Cards     |
| [14:22:01] research.source_found   | Discovered Sources: 12             |
| [14:22:03] research.evidence_found | Retrieved Chunks: 84               |
| [14:22:05] Chunk #42 parsed (0.92) | Extracted Claims: 19               |
|                                    | Contradictions Detected: 2         |
+------------------------------------+------------------------------------+
```

#### Technical Contract:
1. **Connection Lifecycle**:
   - Initializes `EventSource` to `/api/v1/research-runs/{run_id}/events`.
   - Caches highest received event sequence number in memory (`lastEventId`).
   - On unexpected disconnection, initiates exponential backoff: `1s -> 2s -> 4s -> 8s -> 30s max` (§10).
   - Reconnect request sets header `Last-Event-ID: {lastEventId}`.
2. **Cancellation Flow (§7.2)**:
   - User triggers "Cancel Run" dialog.
   - Dispatches `POST /api/v1/research-runs/{run_id}/cancel`.
   - UI switches status badge to `CANCEL_REQUESTED` immediately with a 10-second timer countdown.
   - Final transition to `CANCELLED` triggered upon receiving SSE event `research.cancelled`.

### 8.2 Immutable Report Viewer & Diff Engine (GH-49)
Reports are immutable audit records (§35).
- **Version Selector**: Allows seamless switching between `v1`, `v2`, ... `vN`.
- **Claim-Citation Interactive Hover**: Clicking an inline citation reference (e.g., `[1]`, `[2]`) instantly opens the **Evidence Provenance Drawer**, highlighting the specific excerpt, document chunk, and similarity score.
- **Side-by-Side Diff Engine**: Visualizes semantic diffs between versions (e.g., claims added, citations modified, contradictions resolved).

### 8.3 Evidence Provenance Chain Visualizer (§17, §18)
Renders a visual node diagram that links a specific claim back to its primary source:
```
[Report v2 - Section 3]
         |
    [Claim #14]
         |
  [Evidence #891] (SHA-256 Verified)
         |
 [Document Chunk #104] (800 tokens, sentence-bounded)
         |
[Document Version 1.2] (OCR Confidence: 0.94)
         |
 [Source Version] (Retrieved: 2026-09-12T10:00:00Z)
         |
 [Immutable S3 Snapshot] (SHA-256 Content Hash)
```

### 8.4 Contradiction Analysis Inspector (§20)
Provides an interactive review table when the `Contradiction Agent` identifies conflicting claims:
- Displays **Entity**, **Metric**, **Value A vs Value B**, **Normalized Units**, and **Timeframe**.
- Color-coded classification tags for all 9 types (e.g., `DIRECT_CONTRADICTION`, `NUMERIC_CONFLICT`, `UNIT_DIFFERENCE`).
- Explicitly flags whether the conflict was resolved deterministically via the Calculation Service (§21) or classified via advisory LLM heuristics.

---

## 9. State Management Architecture & SSE Idempotency

### 9.1 Storage Separation
1. **Server State (TanStack Query)**:
   - Projects, Members, Historic Reports, Analytics snapshots.
   - Cache keys standardized: `['projects', projectId]`, `['reports', reportId, version]`.
   - Automatic invalidation triggered when mutation actions complete.
2. **Transient Streaming State (Zustand)**:
   - Active SSE connections, live event buffer, progress bars, audio/visual chime triggers.
   - Resets when leaving the `/research/[runId]` route.

### 9.2 The Idempotent Reducer Contract (§10)
```typescript
interface ResearchEvent {
  id: number; // Monotonic per-run integer
  type: string;
  timestamp: string;
  payload: Record<string, any>;
}

interface RunMonitorState {
  lastEventId: number;
  currentStage: string;
  progressPercent: number;
  events: ResearchEvent[];
  sourcesCount: number;
  evidenceCount: number;
}

export function runEventReducer(
  state: RunMonitorState,
  incomingEvent: ResearchEvent
): RunMonitorState {
  // Enforce monotonicity: drop duplicate or out-of-order replayed events
  if (incomingEvent.id <= state.lastEventId) {
    return state;
  }

  const nextEvents = [...state.events, incomingEvent];

  switch (incomingEvent.type) {
    case 'research.stage_changed':
      return {
        ...state,
        lastEventId: incomingEvent.id,
        currentStage: incomingEvent.payload.stage,
        events: nextEvents,
      };
    case 'research.progress':
      return {
        ...state,
        lastEventId: incomingEvent.id,
        progressPercent: incomingEvent.payload.percent,
        events: nextEvents,
      };
    case 'research.source_found':
      return {
        ...state,
        lastEventId: incomingEvent.id,
        sourcesCount: state.sourcesCount + 1,
        events: nextEvents,
      };
    case 'research.evidence_found':
      return {
        ...state,
        lastEventId: incomingEvent.id,
        evidenceCount: state.evidenceCount + 1,
        events: nextEvents,
      };
    default:
      return {
        ...state,
        lastEventId: incomingEvent.id,
        events: nextEvents,
      };
  }
}
```

---

## 10. M4 Traceability Matrix (GH-47 – GH-56)

This matrix establishes the acceptance criteria for all 10 GitHub issues owned by M4:

| Issue | Title | Baseline Ref | Concrete Acceptance Criteria | Test Target |
|---|---|---|---|---|
| **GH-47** | Next.js Dashboard Shell | §37 | Shell loads responsive navigation, user profile, project switcher, and theme provider. | Unit + Smoke Test |
| **GH-48** | Research Run Interface | §37, §7 | Multi-step creation wizard validates schema; live monitor tracks all 15 states; cancellation works within 10s SLA. | E2E Integration |
| **GH-49** | Report Interface & Viewer | §35, §37 | Renders markdown sections, clickable citations, version switcher, and claim diff view. | E2E Scenario |
| **GH-50** | Frontend State Architecture | §37 | Clean separation of Zustand client slices and TanStack Query server caches; zero memory leaks. | State Unit Tests |
| **GH-51** | SSE Client & Reducer | §10, §37 | Monotonic ID ordering, reconnection backoff (1s–30s), replay drops duplicates without UI glitching. | Mock SSE Test |
| **GH-52** | Notifications UI System | §39 | Delivers all 8 notification types in drawer and toasts; strictly authorized by project role. | Integration Test |
| **GH-53** | Collaboration & RBAC UI | §41, §12.2 | Member invite, role changing, and removal modals; UI buttons conditionally hidden based on role. | RBAC Matrix Test |
| **GH-54** | Accessibility (WCAG 2.1 AA) | §38 | Full keyboard navigability, 3:1 focus contrast, 4.5:1 text contrast, `aria-live` on SSE updates, axe-core clean. | Playwright axe-core |
| **GH-55** | Timezone Localization | §42 | UTC strings converted to user's local timezone; scheduled runs show configured target timezone. | Unit Test |
| **GH-56** | Analytics Dashboard | §47 | Charts for research runs, AI token/cost, and RAG retrieval latency/top-k distributions. | E2E Render Test |

---

## 11. Verification, Testing & CI/CD Quality Gates

In strict accordance with the pipeline specified in §44, the frontend enforces four automated quality gates prior to merging:

```
[Git Push] 
    │
    ▼
[Gate 1: Static Analysis] ────► ESLint + Prettier + TypeScript (tsc --noEmit)
    │
    ▼
[Gate 2: Unit & State]    ────► Vitest (Reducer tests, RBAC tests, Timezone tests)
    │
    ▼
[Gate 3: Accessibility]   ────► Playwright + @axe-core/playwright (Zero WCAG 2.1 AA violations)
    │
    ▼
[Gate 4: E2E Workflows]   ────► Playwright (Run creation, SSE streaming, Report generation)
    │
    ▼
[Production Build]        ────► Next.js Production Build (Bundle budget < 200KB initial JS)
```

---

## 12. 10-Week Phased Implementation Roadmap

```
Week  1 - 2: Phase 1 — Foundation & Design System (GH-47, GH-50)
Week  3 - 5: Phase 2 — SSE Client & Run Monitor Engine (GH-48, GH-51)
Week  6 - 7: Phase 3 — Report Viewer, Citations & Diff Engine (GH-49, GH-55)
Week      8: Phase 4 — Collaboration, RBAC & Notifications (GH-52, GH-53)
Week  9 - 10: Phase 5 — Analytics, Accessibility & Hardening (GH-54, GH-56)
```

- **Deliverable Milestone 1 (End of Week 2)**: Core Next.js 15 repository scaffolded, shadcn/ui design tokens configured, auth route guards and RBAC utility operating.
- **Deliverable Milestone 2 (End of Week 5)**: Complete Run Creation Wizard and live SSE-driven telemetry monitor with simulation harness.
- **Deliverable Milestone 3 (End of Week 7)**: Interactive Report viewer with expandable citation provenance chains and side-by-side version diffing.
- **Deliverable Milestone 4 (End of Week 8)**: Full project collaboration, user roles management, and live notification drawer.
- **Deliverable Milestone 5 (End of Week 10)**: Analytics dashboard with live charts, complete WCAG 2.1 AA audit pass, and automated CI test suite.

---
*Autonomous AI Research & Decision Intelligence Platform — Frontend Implementation Baseline (Approved).*
