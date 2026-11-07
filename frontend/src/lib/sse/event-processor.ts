/**
 * Pure, idempotent reducer for research-run SSE events.
 *
 * Event ids are monotonic per run. Anything with id <= lastEventId is a
 * duplicate or a replay overlap after reconnecting, and is a strict no-op —
 * so reconnecting with Last-Event-ID can never double-count.
 */

import type { ResearchEvent } from "@/types/sse.types";
import type { ResearchRunState, AgentStage } from "@/types/research.types";
import { AGENT_STAGES } from "@/types/research.types";

export interface DiscoveredSource {
  sourceId: string;
  title: string;
  url: string;
  authorityScore: number;
  publisher?: string;
  foundAt: string;
}

export interface FoundEvidence {
  evidenceId: string;
  excerpt: string;
  locator: string;
  confidenceScore: number;
  hasContradiction: boolean;
  foundAt: string;
}

export interface RunMonitorState {
  runId: string;
  lastEventId: number;
  state: ResearchRunState;
  currentStage: AgentStage;
  progressPercent: number;
  sourcesCount: number;
  evidenceCount: number;
  contradictionsCount: number;
  repairAttempts: number;
  /** Newest first, for the log view */
  events: ResearchEvent[];
  sources: DiscoveredSource[];
  evidence: FoundEvidence[];
  /** ISO time each stage was entered */
  stageStartedAt: Partial<Record<AgentStage, string>>;
  startedAt?: string;
  finishedAt?: string;
  reportId?: string;
  error?: string;
  isCancelRequested: boolean;
  cancelRequestedAt?: number;
  cancelReason?: string;
}

export const INITIAL_MONITOR_STATE: RunMonitorState = {
  runId: "",
  lastEventId: 0,
  state: "CREATED",
  currentStage: "PLANNER",
  progressPercent: 0,
  sourcesCount: 0,
  evidenceCount: 0,
  contradictionsCount: 0,
  repairAttempts: 0,
  events: [],
  sources: [],
  evidence: [],
  stageStartedAt: {},
  isCancelRequested: false,
};

const STAGE_TO_STATE: Record<AgentStage, ResearchRunState> = {
  PLANNER: "PLANNING",
  DISCOVERY: "SOURCE_DISCOVERY",
  RETRIEVAL: "RETRIEVING",
  EVIDENCE: "EVIDENCE_ANALYSIS",
  CONTRADICTION: "CONTRADICTION_ANALYSIS",
  ANALYSIS: "SYNTHESIS",
  REPORT: "GENERATING_REPORT",
  VALIDATION: "VALIDATING",
};

function isStage(value: unknown): value is AgentStage {
  return typeof value === "string" && (AGENT_STAGES as string[]).includes(value);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function runEventReducer(state: RunMonitorState, incomingEvent: ResearchEvent): RunMonitorState {
  if (incomingEvent.id <= state.lastEventId) {
    return state;
  }

  const payload: Record<string, unknown> = incomingEvent.payload ?? {};
  const at = incomingEvent.timestamp;

  const next: RunMonitorState = {
    ...state,
    lastEventId: incomingEvent.id,
    events: [incomingEvent, ...state.events],
  };

  switch (incomingEvent.type) {
    case "research.created":
      return { ...next, state: "CREATED", progressPercent: Math.max(state.progressPercent, 2) };

    case "research.queued":
      return { ...next, state: "QUEUED", progressPercent: Math.max(state.progressPercent, 5) };

    case "research.started":
      return {
        ...next,
        state: "RUNNING",
        progressPercent: Math.max(state.progressPercent, 8),
        currentStage: "PLANNER",
        startedAt: state.startedAt ?? at,
      };

    case "research.stage_changed": {
      const stage = isStage(payload.stage) ? payload.stage : state.currentStage;
      return {
        ...next,
        state: STAGE_TO_STATE[stage],
        currentStage: stage,
        stageStartedAt: { ...state.stageStartedAt, [stage]: state.stageStartedAt[stage] ?? at },
      };
    }

    case "research.progress":
      return {
        ...next,
        progressPercent: Math.min(100, Math.max(state.progressPercent, num(payload.percent, state.progressPercent))),
      };

    case "research.source_found":
      return {
        ...next,
        sourcesCount: state.sourcesCount + 1,
        sources: [
          {
            sourceId: str(payload.sourceId, `src_${incomingEvent.id}`),
            title: str(payload.title, "Untitled source"),
            url: str(payload.url),
            authorityScore: num(payload.authorityScore, 0.5),
            publisher: typeof payload.publisher === "string" ? payload.publisher : undefined,
            foundAt: at,
          },
          ...state.sources,
        ],
      };

    case "research.evidence_found": {
      const hasConflict = Boolean(payload.hasContradiction);
      return {
        ...next,
        evidenceCount: state.evidenceCount + 1,
        contradictionsCount: hasConflict ? state.contradictionsCount + 1 : state.contradictionsCount,
        evidence: [
          {
            evidenceId: str(payload.evidenceId, `ev_${incomingEvent.id}`),
            excerpt: str(payload.excerpt),
            locator: str(payload.locator),
            confidenceScore: num(payload.confidenceScore, 0),
            hasContradiction: hasConflict,
            foundAt: at,
          },
          ...state.evidence,
        ],
      };
    }

    case "research.validation_started":
      return {
        ...next,
        state: "VALIDATING",
        currentStage: "VALIDATION",
        stageStartedAt: { ...state.stageStartedAt, VALIDATION: state.stageStartedAt.VALIDATION ?? at },
      };

    case "research.repair_started":
      return { ...next, state: "REPAIRING", repairAttempts: state.repairAttempts + 1 };

    case "research.cancel_requested":
      return {
        ...next,
        state: "CANCEL_REQUESTED",
        isCancelRequested: true,
        cancelRequestedAt: new Date(at).getTime(),
        cancelReason: typeof payload.reason === "string" ? payload.reason : undefined,
      };

    case "research.cancelled":
      return { ...next, state: "CANCELLED", isCancelRequested: false, finishedAt: at };

    case "research.completed":
      return {
        ...next,
        state: "COMPLETED",
        progressPercent: 100,
        finishedAt: at,
        reportId: typeof payload.reportId === "string" ? payload.reportId : state.reportId,
      };

    case "research.failed":
      return {
        ...next,
        state: "FAILED",
        finishedAt: at,
        error: str(payload.error, "Research run execution failed"),
      };

    default:
      return next;
  }
}

/** Applies a batch of events (e.g. a replay burst) in id order. */
export function reduceEvents(state: RunMonitorState, events: ResearchEvent[]): RunMonitorState {
  return [...events].sort((a, b) => a.id - b.id).reduce(runEventReducer, state);
}
