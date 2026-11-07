/**
 * Observability metrics: throughput, tokens and cost, retrieval latency,
 * per-agent performance.
 */

export interface RunCompletionDataPoint {
  /** ISO date string e.g. "2026-09-20" */
  date: string;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface TokenExpenditureDataPoint {
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Estimated cost in USD */
  estimatedCostUSD: number;
}

export interface LatencyDistributionBucket {
  /** Latency bucket label e.g. "<50ms", "50-100ms" */
  bucket: string;
  /** Number of retrievals in this latency bucket */
  count: number;
  /** Percentage of total retrievals */
  percentage: number;
}

export interface AgentPerformanceMetric {
  agent: string;
  avgDurationMs: number;
  p95DurationMs: number;
  successRate: number;
}

export interface PlatformKpiSnapshot {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  totalTokensConsumed: number;
  totalEstimatedCostUSD: number;
  avgRunDurationSeconds: number;
  p95RetrievalLatencyMs: number;
  totalReportsPublished: number;
  totalContradictionsResolved: number;
  totalEvidenceChunks: number;
}
