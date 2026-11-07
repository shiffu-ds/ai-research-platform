import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ContradictionType } from "../../src/types/report.types";
import { MOCK_REPORT_VERSIONS } from "../../src/lib/api/mock-data";

describe("Contradiction Analysis Engine & Conflict Taxonomy (§20)", () => {
  const allExpectedTypes: ContradictionType[] = [
    "DIRECT_CONTRADICTION",
    "NUMERIC_CONFLICT",
    "TEMPORAL_DIFFERENCE",
    "METHODOLOGY_DIFFERENCE",
    "SCOPE_DIFFERENCE",
    "UNIT_DIFFERENCE",
    "DEFINITION_DIFFERENCE",
    "ENTITY_AMBIGUITY",
    "INSUFFICIENT_CONTEXT",
  ];

  test("contains all 9 standardized conflict categories in mock catalog", () => {
    const presentTypes = new Set<ContradictionType>();

    Object.values(MOCK_REPORT_VERSIONS).forEach((version) => {
      version.contradictions.forEach((c) => {
        presentTypes.add(c.type);
      });
    });

    for (const expectedType of allExpectedTypes) {
      assert.equal(
        presentTypes.has(expectedType),
        true,
        `Contradiction type ${expectedType} should be represented in report mock data`
      );
    }
  });

  test("accurately partitions deterministic calculations vs LLM heuristic advisories", () => {
    const contradictions = MOCK_REPORT_VERSIONS["rep_v2_energy"].contradictions;

    const deterministic = contradictions.filter((c) => c.isDeterministic);
    const advisory = contradictions.filter((c) => !c.isDeterministic);

    assert.ok(deterministic.length > 0, "Should have deterministic conflicts");
    assert.ok(advisory.length > 0, "Should have LLM advisory conflicts");

    // Check that every deterministic contradiction has resolution notes
    deterministic.forEach((c) => {
      assert.ok(c.resolution, `Deterministic contradiction ${c.id} must have resolution strategy`);
    });
  });

  test("validates unit conversion resolution in unit difference conflict", () => {
    const semiconContradictions =
      MOCK_REPORT_VERSIONS["rep_v1_semicon"].contradictions;

    const unitConflict = semiconContradictions.find(
      (c) => c.type === "UNIT_DIFFERENCE"
    );

    assert.ok(unitConflict, "UNIT_DIFFERENCE conflict should exist");
    assert.equal(unitConflict?.isDeterministic, true);
    assert.match(unitConflict?.resolution || "", /500 W = 0.5 kW/);
  });
});
