/**
 * Reports, provenance, contradictions and human decisions.
 * Reports are immutable: a change produces a new ReportVersion.
 */

export type ContradictionType =
  | "DIRECT_CONTRADICTION"
  | "NUMERIC_CONFLICT"
  | "TEMPORAL_DIFFERENCE"
  | "METHODOLOGY_DIFFERENCE"
  | "SCOPE_DIFFERENCE"
  | "UNIT_DIFFERENCE"
  | "DEFINITION_DIFFERENCE"
  | "ENTITY_AMBIGUITY"
  | "INSUFFICIENT_CONTEXT";

export const CONTRADICTION_META: Record<
  ContradictionType,
  { label: string; hint: string }
> = {
  DIRECT_CONTRADICTION: {
    label: "Direct contradiction",
    hint: "The sources make claims that can't both be true.",
  },
  NUMERIC_CONFLICT: {
    label: "Numbers disagree",
    hint: "Same metric, different values.",
  },
  TEMPORAL_DIFFERENCE: {
    label: "Different time periods",
    hint: "Both may be right — they describe different moments.",
  },
  METHODOLOGY_DIFFERENCE: {
    label: "Different methods",
    hint: "The measurements were taken differently.",
  },
  SCOPE_DIFFERENCE: {
    label: "Different scope",
    hint: "One source measures more (or less) than the other.",
  },
  UNIT_DIFFERENCE: {
    label: "Different units",
    hint: "Checked by the calculation service after conversion.",
  },
  DEFINITION_DIFFERENCE: {
    label: "Different definitions",
    hint: "The same word means different things in each source.",
  },
  ENTITY_AMBIGUITY: {
    label: "Ambiguous entity",
    hint: "The sources may be talking about different things.",
  },
  INSUFFICIENT_CONTEXT: {
    label: "Not enough context",
    hint: "A source omits conditions needed to compare.",
  },
};

export interface Contradiction {
  id: string;
  type: ContradictionType;
  entity: string;
  metric?: string;
  claimA: string;
  claimB: string;
  valueA?: string | number;
  valueB?: string | number;
  unitA?: string;
  unitB?: string;
  timePeriodA?: string;
  timePeriodB?: string;
  /** True if resolved by the Calculation Service, false if LLM advisory */
  isDeterministic: boolean;
  resolution?: string;
}

export interface Citation {
  id: string;
  /** e.g. [1] */
  citationNumber: number;
  claimId: string;
  evidenceId: string;
  documentChunkId: string;
  documentVersionId: string;
  sourceVersionId: string;
  sourceTitle: string;
  sourceUrl: string;
  excerpt: string;
  /** e.g. "Page 4, Paragraph 2" */
  locator: string;
  /** SHA-256 of `${excerpt.trim()}|${locator.trim()}` */
  evidenceHash: string;
  verified: boolean;
  retrievedAt?: string;
  retrievalScore?: number;
  ocrConfidence?: number;
}

export interface Claim {
  id: string;
  sectionId: string;
  text: string;
  citations: Citation[];
  hasContradiction: boolean;
  contradictionIds?: string[];
}

export interface ReportSection {
  id: string;
  order: number;
  title: string;
  contentMarkdown: string;
  claims: Claim[];
}

export interface ReportVersion {
  id: string;
  reportId: string;
  /** e.g. 1, 2, 3 */
  versionNumber: number;
  researchRunId: string;
  title: string;
  summary: string;
  sections: ReportSection[];
  contradictions: Contradiction[];
  evidenceSetHash: string;
  createdBy: string;
  createdAt: string;
  isDraft: boolean;
}

export type DecisionType = "APPROVED" | "REJECTED" | "NEEDS_REVISION" | "POLICY_OVERRIDE";

export const DECISION_META: Record<DecisionType, { label: string; verb: string }> = {
  APPROVED: { label: "Approved", verb: "Approve" },
  NEEDS_REVISION: { label: "Needs revision", verb: "Request revision" },
  REJECTED: { label: "Rejected", verb: "Reject" },
  POLICY_OVERRIDE: { label: "Policy override", verb: "Override" },
};

export interface HumanDecision {
  id: string;
  userId: string;
  userName: string;
  projectId: string;
  reportVersionId: string;
  decisionType: DecisionType;
  decisionValue: string;
  reason: string;
  createdAt: string;
}

export interface Report {
  id: string;
  projectId: string;
  researchQuestionId: string;
  currentVersion: number;
  latestVersionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
