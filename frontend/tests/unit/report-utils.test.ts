import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { segmentProse, allCitations, latestDecisionFor } from "../../src/components/reports/report-utils";
import { MOCK_REPORT_VERSIONS, MOCK_HUMAN_DECISIONS } from "../../src/lib/api/mock-data";
import { verifyEvidenceHash, computeEvidenceSetHash } from "../../src/lib/crypto";

describe("Report prose segmentation", () => {
  it("attaches each citation mark to the sentence before it", () => {
    const segs = segmentProse("First point holds [1]. Second point also holds [2]. Closing remark.");
    const claims = segs.filter((s) => s.kind === "claim");
    assert.deepEqual(
      claims.map((c) => (c.kind === "claim" ? [c.text, c.citation] : null)),
      [
        ["First point holds", 1],
        ["Second point also holds", 2],
      ]
    );
    const text = segs.map((s) => (s.kind === "cite" ? `[${s.citation}]` : s.text)).join("");
    assert.equal(text.replace(/\s+\[/g, "["), "First point holds[1]. Second point also holds[2]. Closing remark.");
  });

  it("leaves uncited prose alone", () => {
    assert.deepEqual(segmentProse("No citations here."), [{ kind: "text", text: "No citations here." }]);
  });
});

describe("Demo dataset integrity", () => {
  it("stores real SHA-256 hashes for every citation", async () => {
    for (const v of Object.values(MOCK_REPORT_VERSIONS)) {
      for (const c of allCitations(v)) {
        const r = await verifyEvidenceHash(c.excerpt, c.locator, c.evidenceHash);
        assert.ok(r.match, `${v.id} citation ${c.citationNumber} hash mismatch`);
      }
    }
  });

  it("stores the evidence-set root of each version", async () => {
    for (const v of Object.values(MOCK_REPORT_VERSIONS)) {
      const root = await computeEvidenceSetHash(allCitations(v).map((c) => c.evidenceHash));
      assert.equal(root, v.evidenceSetHash, `${v.id} evidence set root`);
    }
  });

  it("finds the latest decision for a version", () => {
    assert.equal(latestDecisionFor("rep_v2_energy", MOCK_HUMAN_DECISIONS)?.decisionType, "APPROVED");
    assert.equal(latestDecisionFor("rep_v1_semicon", MOCK_HUMAN_DECISIONS), undefined);
  });
});
