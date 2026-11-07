import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { authorityScore, freshnessScore, estimateRunCost, checkQuestion } from "../../src/lib/scoring";
import { MOCK_MODELS } from "../../src/lib/api/mock-data";

describe("Source authority (mirrors rag_m2.sources.scoring)", () => {
  it("weights authority 0.5, freshness 0.3, reputation 0.2", () => {
    assert.ok(Math.abs(authorityScore(1, 0, 0) - 0.5) < 1e-9);
    assert.ok(Math.abs(authorityScore(0, 1, 0) - 0.3) < 1e-9);
    assert.ok(Math.abs(authorityScore(0, 0, 1) - 0.2) < 1e-9);
    assert.ok(Math.abs(authorityScore(0.9, 0.42, 0.85) - (0.45 + 0.126 + 0.17)) < 1e-9);
  });

  it("clamps inputs to 0..1", () => {
    assert.equal(authorityScore(2, -1, 5), 0.5 + 0 + 0.2);
  });

  it("halves freshness every half-life and treats unknown dates as 0.5", () => {
    const now = Date.parse("2026-10-31T00:00:00Z");
    assert.equal(freshnessScore(undefined, now), 0.5);
    assert.ok(Math.abs(freshnessScore("2026-10-01T00:00:00Z", now, 30) - 0.5) < 1e-9);
    assert.ok(Math.abs(freshnessScore("2026-09-01T00:00:00Z", now, 30) - 0.25) < 1e-9);
  });
});

describe("Run pre-flight estimate", () => {
  it("scales with sources and model price", () => {
    const cheap = MOCK_MODELS.find((m) => m.modelId === "gemini-1.5-flash-v1");
    const pricey = MOCK_MODELS.find((m) => m.modelId === "claude-3-5-sonnet-v1");
    const a = estimateRunCost(10, cheap, true);
    const b = estimateRunCost(40, cheap, true);
    const c = estimateRunCost(10, pricey, true);
    assert.ok(b.tokens > a.tokens);
    assert.ok(c.usd > a.usd);
    assert.ok(estimateRunCost(10, cheap, false).tokens < a.tokens);
  });
});

describe("Question coaching", () => {
  it("rewards specific, measurable, comparative, scoped questions", () => {
    const strong = checkQuestion(
      "What are the throughput and latency trade-offs between dense search and hybrid BM25 retrieval under 50 concurrent clients since 2024?"
    );
    assert.ok(strong.every((c) => c.ok), JSON.stringify(strong));
    const weak = checkQuestion("Tell me about AI");
    assert.ok(weak.filter((c) => c.ok).length <= 1);
  });
});
