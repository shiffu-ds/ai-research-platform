/**
 * Types for platform surfaces that come from other modules in the repo:
 * - sources        → rag/src/rag_m2/sources (authority scoring, versioning)
 * - schedules      → recurring research with duplicate-run guard
 * - prompts        → agents/prompts/registry.py (DRAFT → ACTIVE → DEPRECATED)
 * - models         → agents/routing/configs.py (versioned model registry)
 * - evaluation     → agents/evaluation/config.py + rag/evaluation/m2_thresholds.json
 */

export type SourceType = "academic" | "government" | "industry" | "web" | "internal";

export interface SourceRecord {
  id: string;
  projectId: string;
  title: string;
  url: string;
  publisher: string;
  sourceType: SourceType;
  publishedAt?: string;
  retrievedAt: string;
  /** 0..1 inputs to the authority formula */
  authorityLevel: number;
  freshness: number;
  publisherReputation: number;
  versions: number;
  chunks: number;
  citedIn: number;
  snapshotHash: string;
}

export type ScheduleFrequency = "daily" | "weekdays" | "weekly" | "monthly";

export interface ResearchSchedule {
  id: string;
  projectId: string;
  name: string;
  questionText: string;
  frequency: ScheduleFrequency;
  /** 24h "HH:MM" in the schedule's own timezone */
  time: string;
  /** 0 = Sunday … 6 = Saturday (weekly only) */
  dayOfWeek?: number;
  /** 1..28 (monthly only) */
  dayOfMonth?: number;
  /** IANA zone the schedule is evaluated in — independent of the viewer */
  timezone: string;
  enabled: boolean;
  /** Skip a tick when the previous run from this schedule is still active */
  skipIfRunning: boolean;
  createdBy: string;
  lastRunAt?: string;
  lastRunId?: string;
  lastOutcome?: "COMPLETED" | "FAILED" | "SKIPPED_DUPLICATE";
}

export type PromptStatus = "DRAFT" | "ACTIVE" | "DEPRECATED";

export interface PromptVersion {
  promptId: string;
  version: string;
  template: string;
  variables: string[];
  status: PromptStatus;
  createdBy: string;
  createdAt: string;
}

export type QualityTier = "frontier" | "high" | "standard" | "economy";

export interface ModelConfig {
  modelId: string;
  name: string;
  provider: string;
  version: string;
  qualityTier: QualityTier;
  contextWindow: number;
  costPer1kTokens: number;
  p95LatencyMs: number;
  supportedTaskTypes: string[];
  isActive: boolean;
}

export interface QualityGate {
  key: string;
  group: "Retrieval" | "Evidence" | "Generation" | "Contradictions" | "System";
  label: string;
  /** Required value */
  threshold: number;
  /** Most recent measured value */
  measured: number;
  /** "min" → measured must be ≥ threshold; "max" → measured must be ≤ threshold */
  direction: "min" | "max";
  owner: "M1" | "M2";
  /** Last N measurements, oldest first, for the trend line */
  history: number[];
}

export interface GoldenSample {
  id: string;
  question: string;
  expectedClaims: number;
  expectedCitations: number;
  expectedContradictions: string[];
}

export interface HealthReport {
  status: "ready" | "not_ready" | "unreachable" | "demo";
  checks: Record<string, string>;
  checkedAt: string;
  latencyMs?: number;
}
