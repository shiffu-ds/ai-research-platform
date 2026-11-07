"use client";

/**
 * Live state for one research run.
 *
 * Live mode: EventSource on /research-runs/{id}/events. The browser's
 * own reconnects send Last-Event-ID automatically; when the connection is
 * closed for good we reconnect ourselves with exponential backoff
 * (1s, 2s, 4s, 8s … capped at 30s) and pass the last id as a query
 * parameter, since EventSource can't set headers.
 *
 * Demo mode: a simulator produces the same events. Runs that started in
 * the past replay their history first, exactly like a reconnect would.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ResearchEvent, ConnectionStatus } from "@/types/sse.types";
import type { ResearchRun } from "@/types/research.types";
import { isRunActive } from "@/types/research.types";
import { INITIAL_MONITOR_STATE, runEventReducer, type RunMonitorState } from "@/lib/sse/event-processor";
import { SimulatedRunStreamer, timelineDuration, demoRunRepairs } from "@/lib/sse/event-simulator";
import { API_BASE_URL, USE_MOCK } from "@/lib/api/config";
import { api } from "@/lib/api/client";

type Action = { type: "event"; event: ResearchEvent } | { type: "reset"; runId: string };

function reducer(state: RunMonitorState, action: Action): RunMonitorState {
  if (action.type === "reset") return { ...INITIAL_MONITOR_STATE, runId: action.runId };
  return runEventReducer(state, action.event);
}

export const BACKOFF_STEPS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

export function backoffDelay(attempt: number): number {
  return BACKOFF_STEPS_MS[Math.min(attempt, BACKOFF_STEPS_MS.length - 1)];
}

/** How far into its scripted timeline a demo run already is. */
function demoOffsetFor(run: ResearchRun, now: number): number {
  const total = timelineDuration(run.id, demoRunRepairs(run.id));
  if (!isRunActive(run.state)) return Number.POSITIVE_INFINITY;
  const started = run.startedAt ? new Date(run.startedAt).getTime() : now;
  const elapsed = now - started;
  // Seeded runs started long ago; place them by their stored progress instead.
  if (elapsed > total) return Math.round((run.progressPercent / 100) * total);
  return Math.max(0, elapsed);
}

export interface RunStream {
  state: RunMonitorState;
  connection: ConnectionStatus;
  replayed: number;
  retryInMs: number | null;
  speed: number;
  replay: (atSpeed?: number) => void;
  requestCancel: (reason: string) => Promise<void>;
}

export function useRunStream(run: ResearchRun | undefined): RunStream {
  const runId = run?.id ?? "";
  const [state, dispatch] = useReducer(reducer, { ...INITIAL_MONITOR_STATE, runId });
  const [connection, setConnection] = useState<ConnectionStatus>("idle");
  const [replayed, setReplayed] = useState(0);
  const [retryInMs, setRetryInMs] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [generation, setGeneration] = useState(0);
  const streamer = useRef<SimulatedRunStreamer | null>(null);
  const lastId = useRef(0);
  const runRef = useRef(run);

  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    lastId.current = state.lastEventId;
  }, [state.lastEventId]);

  const hasRun = Boolean(run);

  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // ── Demo stream ───────────────────────────────────────────────
  useEffect(() => {
    if (!USE_MOCK || !hasRun) return;
    const current = runRef.current!;
    dispatch({ type: "reset", runId: current.id });

    const fromStart = generation > 0;
    const endWith =
      current.state === "FAILED"
        ? { kind: "failed" as const, atFraction: current.progressPercent / 100, message: current.error }
        : current.state === "CANCELLED"
          ? { kind: "cancelled" as const, atFraction: current.progressPercent / 100, message: "Stopped by the run owner" }
          : undefined;

    const now = Date.now();
    const startedMs = current.startedAt ? Date.parse(current.startedAt) : undefined;
    // A seeded "in progress" run that started long ago resumes as if it were running now.
    const resumesNow =
      isRunActive(current.state) &&
      startedMs !== undefined &&
      now - startedMs > timelineDuration(current.id, demoRunRepairs(current.id));

    const s = new SimulatedRunStreamer(current.id, (event) => dispatch({ type: "event", event }), {
      offsetMs: fromStart ? 0 : demoOffsetFor(current, now),
      speed: speedRef.current,
      startedAtMs: fromStart || resumesNow ? undefined : startedMs,
      withRepair: demoRunRepairs(current.id),
      endWith,
    });
    streamer.current = s;
    const replayCount = s.replayCount;
    s.start();
    // Status updates go through a timer so the effect body itself stays free of setState.
    const flag = setTimeout(() => {
      setReplayed(replayCount);
      setConnection(replayCount > 0 ? "replaying" : "open");
    }, 0);
    const settle = setTimeout(() => setConnection("open"), 900);

    return () => {
      clearTimeout(flag);
      clearTimeout(settle);
      s.stop();
      streamer.current = null;
    };
  }, [runId, hasRun, generation]);

  // ── Live stream ───────────────────────────────────────────────
  useEffect(() => {
    if (USE_MOCK || !runId) return;
    let closed = false;
    let attempt = 0;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let countdown: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      if (closed) return;
      setConnection(attempt === 0 ? "connecting" : "reconnecting");
      const qs = lastId.current > 0 ? `?last_event_id=${lastId.current}` : "";
      es = new EventSource(`${API_BASE_URL}/research-runs/${runId}/events${qs}`, { withCredentials: true });

      es.onopen = () => {
        attempt = 0;
        setRetryInMs(null);
        setConnection("open");
      };
      es.onmessage = (msg) => {
        try {
          dispatch({ type: "event", event: JSON.parse(msg.data) as ResearchEvent });
        } catch {
          /* ignore malformed frames; the reducer would reject them anyway */
        }
      };
      es.onerror = () => {
        if (!es || es.readyState !== EventSource.CLOSED) {
          setConnection("reconnecting"); // browser is retrying with Last-Event-ID
          return;
        }
        es.close();
        const delay = backoffDelay(attempt++);
        const until = Date.now() + delay;
        setRetryInMs(delay);
        setConnection("reconnecting");
        clearInterval(countdown);
        countdown = setInterval(() => setRetryInMs(Math.max(0, until - Date.now())), 250);
        timer = setTimeout(() => {
          clearInterval(countdown);
          connect();
        }, delay);
      };
    };

    queueMicrotask(connect);
    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(countdown);
      es?.close();
      setConnection("closed");
    };
  }, [runId]);

  // Keep the demo run record in step with what the stream says.
  useEffect(() => {
    if (!USE_MOCK || !runId || state.lastEventId === 0) return;
    api.syncDemoRun(runId, {
      state: state.state,
      currentStage: state.currentStage,
      progressPercent: state.progressPercent,
      ...(state.finishedAt ? { completedAt: state.finishedAt } : {}),
    });
  }, [runId, state.state, state.currentStage, state.progressPercent, state.finishedAt, state.lastEventId]);

  const requestCancel = useCallback(
    async (reason: string) => {
      if (USE_MOCK) {
        streamer.current?.requestCancel(reason);
        return;
      }
      await api.cancelResearchRun(runId, reason);
    },
    [runId]
  );

  /** Demo only: watch the run again from the first event at the given speed. */
  const replay = useCallback((atSpeed?: number) => {
    if (atSpeed) {
      speedRef.current = atSpeed;
      setSpeed(atSpeed);
    }
    setGeneration((g) => g + 1);
  }, []);

  return { state, connection, replayed, retryInMs, speed, replay, requestCancel };
}
