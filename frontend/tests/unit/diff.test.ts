import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffWords, diffStats, diffSections, tokenize, cleanupSemantic } from "../../src/lib/diff";
import { MOCK_REPORT_VERSIONS } from "../../src/lib/api/mock-data";

const join = (parts: { op: string; text: string }[], keep: "before" | "after") =>
  parts.filter((p) => p.op === "equal" || p.op === (keep === "before" ? "delete" : "insert")).map((p) => p.text).join("");

describe("Report version diff", () => {
  it("tokenizes losslessly", () => {
    const text = "Draft  model\toverhead, sub-linear.";
    assert.equal(tokenize(text).join(""), text);
  });

  it("reconstructs both versions exactly from the diff", () => {
    const a = "Speculative decoding accelerates generation on H100 clusters.";
    const b = "Speculative decoding accelerates autoregressive generation on B200 clusters today.";
    const parts = diffWords(a, b);
    assert.equal(join(parts, "before"), a);
    assert.equal(join(parts, "after"), b);
  });

  it("counts added and removed words", () => {
    const stats = diffStats(diffWords("one two three", "one three four"));
    assert.equal(stats.added, 1);
    assert.equal(stats.removed, 1);
    assert.equal(stats.unchanged, 2);
  });

  it("aligns report sections by order and classifies each change", () => {
    const v1 = MOCK_REPORT_VERSIONS["rep_v1_energy"];
    const v2 = MOCK_REPORT_VERSIONS["rep_v2_energy"];
    const result = diffSections(v1.sections, v2.sections);
    assert.equal(result.length, 4);
    assert.equal(result[0].change, "changed");
    assert.equal(result[2].change, "added");
    assert.equal(result[3].change, "added");
    assert.ok(result[0].stats.added > 0);
  });

  it("groups choppy edits into readable phrases without losing text", () => {
    const a = "Draft model verification overhead remains sub-linear with batch size up to 16 concurrent requests.";
    const b = "Empirical latency measurements over 100k requests show acceptance rate decays with prompt entropy.";
    const raw = diffWords(a, b);
    const clean = cleanupSemantic(raw);
    assert.ok(clean.length < raw.length, "cleanup should merge fragments");
    assert.equal(join(clean, "before"), a);
    assert.equal(join(clean, "after"), b);
  });

  it("reports identical text as unchanged", () => {
    const s = [{ order: 1, title: "A", contentMarkdown: "Same words here." }];
    assert.equal(diffSections(s, s)[0].change, "unchanged");
  });
});
