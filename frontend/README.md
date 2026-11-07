# Frontend

The web app for the Autonomous AI Research & Decision Intelligence Platform: start research runs, watch them live, read the reports they produce, check every citation back to its source, and record who signed off on what.

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS 4 · Zustand · TypeScript (strict).

## Running it

```bash
npm ci
npm run dev          # http://localhost:3000
```

With no configuration the app runs as a **demo workspace**: sample projects, runs, reports and sources live in memory in your tab, and research runs are played back by a simulator that emits the same events as the real stream. Nothing is sent anywhere.

To use the backend:

```bash
NEXT_PUBLIC_USE_MOCK=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1 npm run dev
```

Both variables are inlined at build time. Settings → Connection shows what the running build is using and can ping `/health/ready`.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm run start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next + React Compiler rules) |
| `npm test` | Unit tests (`node:test` via `tsx`) |
| `npm run check` | All three of the above |

`GET /api/health` is the frontend's own liveness endpoint.

## What's where

```
src/
  app/                 routes — each page.tsx is a thin server file that sets the title
    page.tsx           Overview: what needs you, runs in flight, recent reports
    research/          runs list · new/ (question composer) · [runId]/ (live run)
    reports/           library · [reportId]/ (reader, conflicts, version diff, decisions)
    sources/           everything the runs read, with authority scoring explained
    schedules/         recurring research, each in its own timezone
    members/  projects/  analytics/  evaluation/  settings/
    api/health/        liveness route
  components/
    shell/             sidebar, top bar, ⌘K command menu, inbox, shortcuts, toasts
    research/          status pill, stage pipeline, event log, cancel dialog, run view
    reports/           reader, evidence panel (provenance + hash check), conflicts, diff, decision log
    charts/            hand-built SVG charts (column, line, sparkline) with tooltips and table views
    ui/                buttons, fields, dialog/sheet, menu, tabs, time, empty/error states
  hooks/               useRunStream (SSE + simulator), useNow, useHotkeys, useWorkspace…
  lib/
    api/               client.ts (live ↔ demo), http.ts (error envelope), query.ts (small cache)
    sse/               idempotent event reducer + demo simulator
    crypto.ts          SHA-256 evidence hashing (Web Crypto)
    diff.ts            word-level LCS diff with readable grouping
    schedule.ts        next-run calculation per timezone, cron equivalents
    scoring.ts         source authority formula, run cost estimate, question checks
  stores/              session (persisted prefs), notifications, toasts, overlays
  types/               domain types mirroring the backend, agents and RAG modules
tests/unit/            53 tests across reducer, RBAC, provenance, diff, schedules, scoring, stream
```

## Things worth knowing

- **Streaming.** `useRunStream` opens `GET /research-runs/{id}/events`. The reducer drops any event whose id is not greater than the last one seen, so reconnect overlap can never double-count. After a hard disconnect it retries at 1, 2, 4, 8, 16 then 30 s, passing the last id as `last_event_id` (EventSource can't set headers; the browser's own retries send `Last-Event-ID`).
- **Evidence hashes** are `SHA-256(excerpt.trim() + "|" + locator.trim())`, the same canonical form the RAG module uses. The demo dataset stores real digests, so "Verify all citations" in a report is a genuine check.
- **Permissions.** `can(role, action)` in `types/rbac.types.ts` mirrors the server matrix. The account menu can preview the app as any role; the API remains the authority.
- **Time.** Everything is stored in UTC and shown in the viewer's zone (Settings → Preferences). Schedules carry their own zone.
- **Design.** Warm paper/ink palette with one terracotta accent; IBM Plex Sans for the interface, Newsreader for reading, IBM Plex Mono for ids and hashes. Light and dark themes are both hand-tuned. Chart colours were checked with a colour-blind-safety validator against both surfaces; every chart has a table view.
- **Keyboard.** `⌘K`/`Ctrl K` command menu, `?` for all shortcuts, `g` then a letter to jump between sections, `n` for new research, `j`/`k` to step through citations.
