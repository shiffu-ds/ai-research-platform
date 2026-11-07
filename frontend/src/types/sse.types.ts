/**
 * Server-sent events streamed from GET /research-runs/{id}/events.
 * Event ids are monotonic per run; the client replays with Last-Event-ID.
 */

export type SSEEventType =
  | "research.created"
  | "research.queued"
  | "research.started"
  | "research.stage_changed"
  | "research.progress"
  | "research.source_found"
  | "research.evidence_found"
  | "research.validation_started"
  | "research.repair_started"
  | "research.completed"
  | "research.failed"
  | "research.cancel_requested"
  | "research.cancelled";

export interface ResearchEvent<T = Record<string, unknown>> {
  /** Monotonically increasing per-run integer */
  id: number;
  runId: string;
  type: SSEEventType;
  timestamp: string;
  payload: T;
}

export interface StageChangedPayload {
  stage: string;
  previousStage?: string;
  reason?: string;
}

export interface ProgressPayload {
  percent: number;
  message: string;
  currentOperation?: string;
}

export interface SourceFoundPayload {
  sourceId: string;
  title: string;
  url: string;
  authorityScore: number;
  publisher?: string;
}

export interface EvidenceFoundPayload {
  evidenceId: string;
  excerpt: string;
  locator: string;
  confidenceScore: number;
  evidenceHash?: string;
  hasContradiction?: boolean;
}

export interface ValidationPayload {
  pass: boolean;
  attemptNumber: number;
  maxAttempts: number;
  failingChecks?: string[];
}

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "open"
  | "replaying"
  | "reconnecting"
  | "closed";
