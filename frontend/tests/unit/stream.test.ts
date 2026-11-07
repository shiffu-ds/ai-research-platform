import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, SimulatedRunStreamer } from "../../src/lib/sse/event-simulator";
import { INITIAL_MONITOR_STATE, reduceEvents, runEventReducer } from "../../src/lib/sse/event-processor";
import type { ResearchEvent } from "../../src/types/sse.types";

function collect(runId: string, opts: ConstructorParameters<typeof SimulatedRunStreamer>[2]) {
  const events: ResearchEvent[] = [];
  const s = new SimulatedRunStreamer(runId, (e) => events.push(e), opts);
  s.start();
  s.stop();
  return { events, replayCount: s.replayCount };
}

describe("Simulated SSE stream", () => {
  it("replays an entire finished run synchronously with monotonic ids", () => {
    const { events, replayCount } = collect("run_test_a", { offsetMs: Number.POSITIVE_INFINITY });
    assert.equal(events.length, replayCount);
    events.forEach((e, i) => assert.equal(e.id, i + 1));
    const final = reduceEvents({ ...INITIAL_MONITOR_STATE, runId: "run_test_a" }, events);
    assert.equal(final.state, "COMPLETED");
    assert.equal(final.progressPercent, 100);
    assert.ok(final.sourcesCount > 0 && final.evidenceCount > 0);
    assert.equal(final.sources.length, final.sourcesCount);
  });

  it("visits all eight agent stages in order", () => {
    const stages = buildTimeline("run_test_b")
      .filter((e) => e.type === "research.stage_changed")
      .map((e) => e.payload.stage);
    assert.deepEqual(stages, ["PLANNER", "DISCOVERY", "RETRIEVAL", "EVIDENCE", "CONTRADICTION", "ANALYSIS", "REPORT", "VALIDATION"]);
  });

  it("can end a run early with a failure or a cancellation", () => {
    const failed = buildTimeline("run_test_c", { endWith: { kind: "failed", atFraction: 0.4, message: "rate limited" } });
    assert.equal(failed[failed.length - 1].type, "research.failed");
    assert.ok(!failed.some((e) => e.type === "research.completed"));

    const cancelled = buildTimeline("run_test_c", { endWith: { kind: "cancelled", atFraction: 0.3 } });
    const types = cancelled.map((e) => e.type);
    assert.ok(types.indexOf("research.cancel_requested") < types.indexOf("research.cancelled"));
  });

  it("includes a bounded repair loop when asked", () => {
    const tl = buildTimeline("run_test_d", { withRepair: true });
    const validations = tl.filter((e) => e.type === "research.validation_started").length;
    assert.equal(validations, 2);
    assert.equal(tl.filter((e) => e.type === "research.repair_started").length, 1);
  });

  it("only replays events up to the offset", () => {
    const all = buildTimeline("run_test_e");
    const offset = all[Math.floor(all.length / 2)].at;
    const { events } = collect("run_test_e", { offsetMs: offset });
    assert.equal(events.length, all.filter((e) => e.at <= offset).length);
  });
});

describe("Reconnect replay overlap", () => {
  it("ignores events re-sent after a reconnect", () => {
    const { events } = collect("run_test_f", { offsetMs: Number.POSITIVE_INFINITY });
    const once = reduceEvents({ ...INITIAL_MONITOR_STATE }, events);
    // The server replays everything after Last-Event-ID; overlap must be a no-op.
    const twice = events.slice(5).reduce(runEventReducer, once);
    assert.equal(twice, once);
  });
});
