import { describe, it } from "node:test";
import assert from "node:assert";
import {
  runEventReducer,
  INITIAL_MONITOR_STATE,
  RunMonitorState,
} from "../../src/lib/sse/event-processor";
import { ResearchEvent } from "../../src/types/sse.types";

describe("SSE Idempotent Event Reducer (v4.0 §10 & GH-51)", () => {
  it("processes monotonically increasing events in order", () => {
    let state: RunMonitorState = { ...INITIAL_MONITOR_STATE, runId: "test-run" };

    const evt1: ResearchEvent = {
      id: 1,
      runId: "test-run",
      type: "research.created",
      timestamp: new Date().toISOString(),
      payload: {},
    };

    state = runEventReducer(state, evt1);
    assert.strictEqual(state.lastEventId, 1);
    assert.strictEqual(state.state, "CREATED");
    assert.strictEqual(state.events.length, 1);

    const evt2: ResearchEvent = {
      id: 2,
      runId: "test-run",
      type: "research.stage_changed",
      timestamp: new Date().toISOString(),
      payload: { stage: "RETRIEVAL" },
    };

    state = runEventReducer(state, evt2);
    assert.strictEqual(state.lastEventId, 2);
    assert.strictEqual(state.currentStage, "RETRIEVAL");
    assert.strictEqual(state.state, "RETRIEVING");
    assert.strictEqual(state.events.length, 2);
  });

  it("strictly drops duplicate or replayed events (id <= lastEventId)", () => {
    const state: RunMonitorState = {
      ...INITIAL_MONITOR_STATE,
      runId: "test-run",
      lastEventId: 5,
      sourcesCount: 3,
    };

    const replayedEvt: ResearchEvent = {
      id: 4, // lower than lastEventId 5
      runId: "test-run",
      type: "research.source_found",
      timestamp: new Date().toISOString(),
      payload: { sourceId: "src_old" },
    };

    const nextState = runEventReducer(state, replayedEvt);
    // Should be strict no-op!
    assert.strictEqual(nextState.lastEventId, 5);
    assert.strictEqual(nextState.sourcesCount, 3);
    assert.strictEqual(nextState.events.length, 0);

    const duplicateEvt: ResearchEvent = {
      id: 5, // equal to lastEventId 5
      runId: "test-run",
      type: "research.source_found",
      timestamp: new Date().toISOString(),
      payload: { sourceId: "src_duplicate" },
    };

    const nextState2 = runEventReducer(state, duplicateEvt);
    assert.strictEqual(nextState2.lastEventId, 5);
    assert.strictEqual(nextState2.sourcesCount, 3);
  });

  it("handles cancellation requested and completed states (§7.1, §7.2)", () => {
    let state: RunMonitorState = {
      ...INITIAL_MONITOR_STATE,
      runId: "test-run",
      lastEventId: 10,
    };

    const cancelReqEvt: ResearchEvent = {
      id: 11,
      runId: "test-run",
      type: "research.cancel_requested",
      timestamp: new Date().toISOString(),
      payload: { reason: "User triggered cancellation" },
    };

    state = runEventReducer(state, cancelReqEvt);
    assert.strictEqual(state.state, "CANCEL_REQUESTED");
    assert.strictEqual(state.isCancelRequested, true);

    const cancelledEvt: ResearchEvent = {
      id: 12,
      runId: "test-run",
      type: "research.cancelled",
      timestamp: new Date().toISOString(),
      payload: { reason: "User triggered cancellation" },
    };

    state = runEventReducer(state, cancelledEvt);
    assert.strictEqual(state.state, "CANCELLED");
    assert.strictEqual(state.isCancelRequested, false);
  });
});

describe("Reconnect backoff", () => {
  it("doubles from 1s and caps at 30s", async () => {
    const { backoffDelay } = await import("../../src/hooks/useRunStream");
    assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 9].map(backoffDelay), [1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});
