import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MOCK_PLATFORM_KPI,
  MOCK_TOKEN_EXPENDITURE_SERIES,
  MOCK_LATENCY_DISTRIBUTION,
  MOCK_AGENT_PERFORMANCE,
} from "@/lib/api/mock-data";

describe("Observability & Analytics Metrics (§41 & GH-56)", () => {
  it("verifies platform KPI health and SLA thresholds", () => {
    assert.ok(MOCK_PLATFORM_KPI.totalRuns > 0);
    const successRate = (MOCK_PLATFORM_KPI.completedRuns / MOCK_PLATFORM_KPI.totalRuns) * 100;
    assert.ok(successRate >= 80, `Success rate (${successRate}%) meets target SLA`);
    assert.ok(MOCK_PLATFORM_KPI.avgRunDurationSeconds > 0);
    assert.ok(MOCK_PLATFORM_KPI.totalTokensConsumed > 0);
    assert.ok(MOCK_PLATFORM_KPI.p95RetrievalLatencyMs <= 500, "P95 retrieval latency meets SLA (<500ms)");
  });

  it("verifies all 8 agent performance records and error rates", () => {
    assert.equal(MOCK_AGENT_PERFORMANCE.length, 8, "Must track all 8 autonomous agents");

    const expectedAgents = [
      "Research Planner",
      "Source Discovery",
      "Retrieval",
      "Evidence Analysis",
      "Contradiction Analysis",
      "Synthesis",
      "Report Generator",
      "Validation",
    ];

    for (const expected of expectedAgents) {
      const record = MOCK_AGENT_PERFORMANCE.find((a) => a.agent === expected);
      assert.ok(record, `Agent record missing for ${expected}`);
      assert.ok(record.avgDurationMs > 0);
      assert.ok(record.p95DurationMs >= record.avgDurationMs, "P95 duration must be >= avg duration");
      assert.ok(record.successRate >= 95, `Success rate for ${expected} must meet >= 95% SLA`);
    }
  });

  it("verifies latency distribution percentage totals", () => {
    assert.ok(MOCK_LATENCY_DISTRIBUTION.length >= 4);
    let totalPercentage = 0;
    for (const dist of MOCK_LATENCY_DISTRIBUTION) {
      assert.ok(dist.count >= 0);
      assert.ok(dist.percentage >= 0);
      totalPercentage += dist.percentage;
    }
    assert.ok(Math.abs(totalPercentage - 100) < 1, "Percentages should sum to approximately 100%");
  });

  it("verifies token expenditure series has valid breakdown", () => {
    assert.ok(MOCK_TOKEN_EXPENDITURE_SERIES.length > 0);
    for (const item of MOCK_TOKEN_EXPENDITURE_SERIES) {
      assert.ok(item.promptTokens >= 0);
      assert.ok(item.completionTokens >= 0);
      assert.equal(item.totalTokens, item.promptTokens + item.completionTokens);
      assert.ok(item.estimatedCostUSD > 0);
    }
  });
});
