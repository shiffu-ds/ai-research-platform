# Frontend rebuild — November 2026

The UI from phases 1–4 was removed and rebuilt from scratch. The phase documents in this folder describe the earlier implementation and are kept as history; this note records what changed and why.

## Why

- The old interface looked generated: cyan-on-navy glassmorphism, glowing borders, and spec references (§12.2, GH-48) printed in the UI.
- QA (docs/runbooks/frontend-qa-validation.md) failed the build on 5 ESLint errors and 29 warnings.
- The sidebar linked to `/sources`, which didn't exist. Projects, schedules, settings and the quality gates had no screens at all.

## Kept, as contracts

The domain logic and its 24 tests carry over unchanged in behaviour: the RBAC matrix and `can()`, the idempotent SSE reducer, SHA-256 provenance hashing, timezone formatting, and the demo dataset's exported shapes. Everything that imported them was rewritten.

## New

| Area | What it does |
|---|---|
| Shell | Project switcher, ⌘K command menu, `g`-then-letter navigation, inbox with "needs you" filter, backend health indicator, role preview, light/dark/system themes, mobile drawer |
| Overview | Greeting in the viewer's timezone, a list of what needs you (decisions, conflicts, failed runs), runs in flight, quick ask |
| Composer | Question coaching, live time/token/cost estimate from the model registry, draft autosave, ⌘↵ to launch, retry from a failed run |
| Run view | Replay-then-live stream, per-stage timings, filterable event log that follows the newest event, cancel with reason and a 10-second acknowledgement clock |
| Report reader | Serif reading layout with margin notes, highlighted claims, evidence panel with the provenance chain and an in-browser SHA-256 check (plus a "change a word" tamper demo), conflict ledger, readable word-level version diff, append-only decisions with confirmation |
| Sources | Authority score broken down by the RAG formula (0.5 authority + 0.3 freshness + 0.2 reputation), snapshots, versions |
| Schedules | Daily/weekday/weekly/monthly schedules in their own timezone, next runs in both zones, cron equivalent, duplicate-run guard |
| Quality gates | M1/M2 release thresholds against the latest benchmark, with trend lines and the golden dataset |
| Settings | Preferences, connection details, model registry, prompt registry with draft → active → deprecated lifecycle |
| Projects | Directory and creation |
| Platform | `GET /api/health`, frontend job in CI, filled-in M4 runtime contract |

## Verification

`npm run typecheck`, `npm run lint` (0 errors, 0 warnings), `npm test` (53 passing, including the original 24), and `npm run build` (13 routes plus `/api/health`) all pass. Each screen was checked in a browser at desktop and phone widths, in light and dark.

## Still open (needs the backend)

Only `/health/live` and `/health/ready` exist on the API today. The client already calls the documented `/api/v1` routes (projects, research-runs and their events/cancel, reports and versions, decisions, members, sources, schedules, prompts, models, evaluation, analytics), so they'll work once M3 implements them. Real sign-in is still to come; until then the role switcher is a preview.
