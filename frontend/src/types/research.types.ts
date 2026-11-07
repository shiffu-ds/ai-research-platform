/**
 * Research runs: lifecycle states, agent stages and run configuration.
 * Mirrors the orchestration state machine owned by M1 (agents/orchestration).
 */

export type ResearchRunState =
  | "CREATED"
  | "QUEUED"
  | "RUNNING"
  | "PLANNING"
  | "SOURCE_DISCOVERY"
  | "DOCUMENT_PROCESSING"
  | "RETRIEVING"
  | "EVIDENCE_ANALYSIS"
  | "CONTRADICTION_ANALYSIS"
  | "SYNTHESIS"
  | "VALIDATING"
  | "GENERATING_REPORT"
  | "REPAIRING"
  | "PAUSED"
  | "CANCEL_REQUESTED"
  | "CANCELLED"
  | "FAILED"
  | "COMPLETED";

export type StateCategory =
  | "intake"
  | "process"
  | "validation"
  | "control"
  | "success"
  | "failure";

export function getStateCategory(state: ResearchRunState): StateCategory {
  switch (state) {
    case "CREATED":
    case "QUEUED":
    case "RUNNING":
      return "intake";
    case "PLANNING":
    case "SOURCE_DISCOVERY":
    case "DOCUMENT_PROCESSING":
    case "RETRIEVING":
    case "EVIDENCE_ANALYSIS":
    case "CONTRADICTION_ANALYSIS":
    case "SYNTHESIS":
      return "process";
    case "VALIDATING":
    case "GENERATING_REPORT":
    case "REPAIRING":
      return "validation";
    case "PAUSED":
    case "CANCEL_REQUESTED":
      return "control";
    case "COMPLETED":
      return "success";
    case "CANCELLED":
    case "FAILED":
      return "failure";
  }
}

/** True while the run can still change on its own. */
export function isRunActive(state: ResearchRunState): boolean {
  return !["COMPLETED", "FAILED", "CANCELLED"].includes(state);
}

/** Plain-language label for each state, used across the UI. */
export const STATE_LABEL: Record<ResearchRunState, string> = {
  CREATED: "Created",
  QUEUED: "Queued",
  RUNNING: "Starting",
  PLANNING: "Planning",
  SOURCE_DISCOVERY: "Finding sources",
  DOCUMENT_PROCESSING: "Reading documents",
  RETRIEVING: "Retrieving",
  EVIDENCE_ANALYSIS: "Extracting evidence",
  CONTRADICTION_ANALYSIS: "Checking conflicts",
  SYNTHESIS: "Synthesising",
  VALIDATING: "Validating",
  GENERATING_REPORT: "Writing report",
  REPAIRING: "Repairing",
  PAUSED: "Paused",
  CANCEL_REQUESTED: "Cancelling",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
  COMPLETED: "Completed",
};

export type AgentStage =
  | "PLANNER"
  | "DISCOVERY"
  | "RETRIEVAL"
  | "EVIDENCE"
  | "CONTRADICTION"
  | "ANALYSIS"
  | "REPORT"
  | "VALIDATION";

export const AGENT_STAGES: AgentStage[] = [
  "PLANNER",
  "DISCOVERY",
  "RETRIEVAL",
  "EVIDENCE",
  "CONTRADICTION",
  "ANALYSIS",
  "REPORT",
  "VALIDATION",
];

export const STAGE_META: Record<
  AgentStage,
  { label: string; agent: string; does: string }
> = {
  PLANNER: {
    label: "Plan",
    agent: "Research Planner",
    does: "Breaks the question into tasks and evidence categories.",
  },
  DISCOVERY: {
    label: "Discover",
    agent: "Source Discovery",
    does: "Finds candidate sources and scores their authority.",
  },
  RETRIEVAL: {
    label: "Retrieve",
    agent: "Retrieval",
    does: "Hybrid dense + BM25 search, fused with RRF and reranked.",
  },
  EVIDENCE: {
    label: "Evidence",
    agent: "Evidence Analysis",
    does: "Pulls verbatim excerpts and hashes them for provenance.",
  },
  CONTRADICTION: {
    label: "Conflicts",
    agent: "Contradiction Analysis",
    does: "Compares claims; unit and numeric checks are deterministic.",
  },
  ANALYSIS: {
    label: "Synthesis",
    agent: "Synthesis",
    does: "Weighs the evidence into findings with a confidence score.",
  },
  REPORT: {
    label: "Report",
    agent: "Report Generator",
    does: "Drafts sections where every claim carries a citation.",
  },
  VALIDATION: {
    label: "Validate",
    agent: "Validation",
    does: "Checks citations and claims; repairs up to 3 times.",
  },
};

export interface ResearchRunConfig {
  maxSources?: number;
  embeddingModel?: string;
  rerankerThreshold?: number;
  enableContradictionDetection?: boolean;
  maxRepairAttempts?: number;
  primaryModelId?: string;
  fallbackModelId?: string;
  freshnessHalfLifeDays?: number;
}

export interface ResearchRun {
  id: string;
  projectId: string;
  researchQuestionId: string;
  questionText: string;
  state: ResearchRunState;
  currentStage?: AgentStage;
  progressPercent: number;
  createdBy: string;
  creatorName: string;
  config: ResearchRunConfig;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  sourceCount: number;
  evidenceCount: number;
  contradictionCount: number;
  reportId?: string;
  error?: string;
}

export interface CreateResearchRunInput {
  projectId: string;
  questionText: string;
  config: ResearchRunConfig;
}
