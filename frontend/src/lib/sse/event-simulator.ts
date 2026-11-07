/**
 * Client-side stand-in for the SSE endpoint, used in demo mode.
 *
 * It builds a deterministic timeline for a run and behaves like the real
 * stream: events already "in the past" are replayed in a quick burst
 * (as the server would after a Last-Event-ID reconnect), the rest arrive
 * in real time. `speed` lets people watch a run faster than real time.
 */

import type { ResearchEvent, SSEEventType } from "@/types/sse.types";
import type { AgentStage } from "@/types/research.types";

export type EventCallback = (event: ResearchEvent) => void;

interface ScriptedEvent {
  at: number; // ms from start
  type: SSEEventType;
  payload: Record<string, unknown>;
}

interface TopicPack {
  sources: { title: string; url: string; publisher: string; authorityScore: number }[];
  evidence: { excerpt: string; locator: string; confidenceScore: number; hasContradiction: boolean }[];
}

const PACKS: TopicPack[] = [
  {
    sources: [
      { title: "Reciprocal Rank Fusion outperforms Condorcet and individual rank learning methods", url: "https://dl.acm.org/doi/10.1145/1571941.1572114", publisher: "ACM SIGIR", authorityScore: 0.91 },
      { title: "pgvector 0.8: HNSW index build and query benchmarks", url: "https://github.com/pgvector/pgvector", publisher: "pgvector", authorityScore: 0.74 },
      { title: "BEIR: A heterogeneous benchmark for zero-shot IR", url: "https://arxiv.org/abs/2104.08663", publisher: "arXiv", authorityScore: 0.88 },
      { title: "Hybrid search in production: lessons from 2B queries", url: "https://engineering.example.org/hybrid-search", publisher: "Industry blog", authorityScore: 0.58 },
      { title: "Okapi BM25 parameter sensitivity across domains", url: "https://www.nist.gov/itl/iad/trec-bm25", publisher: "NIST", authorityScore: 0.93 },
    ],
    evidence: [
      { excerpt: "RRF with k=60 improved nDCG@10 over the best single ranker on 11 of 13 collections.", locator: "Table 3, p. 759", confidenceScore: 0.94, hasContradiction: false },
      { excerpt: "At 50 concurrent clients, HNSW p95 latency rose to 38 ms with ef_search=100.", locator: "README, Benchmarks section", confidenceScore: 0.87, hasContradiction: false },
      { excerpt: "Hybrid retrieval added a median 41 ms over dense-only search under peak load.", locator: "Section 4, Figure 2", confidenceScore: 0.79, hasContradiction: true },
      { excerpt: "BM25 remains a strong baseline, outperforming dense retrievers on 6 of 18 datasets zero-shot.", locator: "Section 5.1, Table 2", confidenceScore: 0.92, hasContradiction: false },
    ],
  },
  {
    sources: [
      { title: "ASML annual report: EUV and High-NA shipments", url: "https://www.asml.com/en/investors/annual-report", publisher: "ASML", authorityScore: 0.86 },
      { title: "Semiconductor supply chain resilience review", url: "https://www.commerce.gov/semiconductor-review", publisher: "U.S. Department of Commerce", authorityScore: 0.92 },
      { title: "IEEE IRDS: Lithography roadmap 2026", url: "https://irds.ieee.org/editions/2026/lithography", publisher: "IEEE", authorityScore: 0.95 },
      { title: "Analyst note: N2 wafer pricing and ramp", url: "https://research.example.com/n2-pricing", publisher: "Sell-side research", authorityScore: 0.55 },
    ],
    evidence: [
      { excerpt: "High-NA EUV systems target 185 wafers per hour at full production illumination.", locator: "p. 42, Products section", confidenceScore: 0.9, hasContradiction: true },
      { excerpt: "Leading-edge capacity remains concentrated in two geographic regions.", locator: "Executive summary, para 3", confidenceScore: 0.95, hasContradiction: false },
      { excerpt: "Defect density for 2nm-class nodes must fall below 0.1 per cm² for volume yield.", locator: "Table LITH-4", confidenceScore: 0.88, hasContradiction: false },
    ],
  },
  {
    sources: [
      { title: "Fast inference from transformers via speculative decoding", url: "https://arxiv.org/abs/2211.17192", publisher: "arXiv", authorityScore: 0.93 },
      { title: "MLPerf Inference v4.1 results", url: "https://mlcommons.org/benchmarks/inference-datacenter/", publisher: "MLCommons", authorityScore: 0.9 },
      { title: "Blackwell architecture technical brief", url: "https://www.nvidia.com/en-us/data-center/technologies/blackwell-architecture/", publisher: "NVIDIA", authorityScore: 0.78 },
      { title: "Measuring energy per token on shared clusters", url: "https://www.energy.gov/eere/ai-energy", publisher: "U.S. DOE", authorityScore: 0.89 },
    ],
    evidence: [
      { excerpt: "Speculative decoding achieved 2–3× speedups with identical output distributions.", locator: "Abstract", confidenceScore: 0.96, hasContradiction: false },
      { excerpt: "Energy per generated token dropped from 12.8 mJ to 5.3 mJ with 8-bit quantisation.", locator: "Table 4, row 3", confidenceScore: 0.84, hasContradiction: true },
      { excerpt: "Acceptance rate fell sharply on high-entropy prompts above temperature 0.7.", locator: "Section 4.2, Figure 6", confidenceScore: 0.91, hasContradiction: false },
    ],
  },
];

function packFor(runId: string): TopicPack {
  let h = 0;
  for (let i = 0; i < runId.length; i++) h = (h * 31 + runId.charCodeAt(i)) >>> 0;
  return PACKS[h % PACKS.length];
}

const STAGE_PLAN: { stage: AgentStage; duration: number; percent: number; message: string }[] = [
  { stage: "PLANNER", duration: 2400, percent: 14, message: "Decomposing the question into research tasks" },
  { stage: "DISCOVERY", duration: 4200, percent: 30, message: "Searching and scoring candidate sources" },
  { stage: "RETRIEVAL", duration: 3200, percent: 46, message: "Hybrid retrieval: dense + BM25, fused with RRF" },
  { stage: "EVIDENCE", duration: 4600, percent: 64, message: "Extracting and hashing evidence excerpts" },
  { stage: "CONTRADICTION", duration: 2800, percent: 76, message: "Comparing claims across sources" },
  { stage: "ANALYSIS", duration: 3000, percent: 86, message: "Synthesising findings" },
  { stage: "REPORT", duration: 2600, percent: 94, message: "Drafting cited report sections" },
  { stage: "VALIDATION", duration: 2600, percent: 99, message: "Validating citations and claims" },
];

export interface TimelineEnding {
  kind: "failed" | "cancelled";
  /** 0..1 — how far through the run it stopped */
  atFraction: number;
  message?: string;
}

/** Builds the scripted timeline for a run, optionally cut short by a failure or cancellation. */
export function buildTimeline(
  runId: string,
  opts: { withRepair?: boolean; endWith?: TimelineEnding } = {}
): ScriptedEvent[] {
  const full = buildFullTimeline(runId, opts);
  if (!opts.endWith) return full;
  const endAt = Math.round(full[full.length - 1].at * Math.min(0.98, Math.max(0.05, opts.endWith.atFraction)));
  const cut = full.filter((e) => e.at <= endAt && e.type !== "research.completed");
  if (opts.endWith.kind === "failed") {
    cut.push({ at: endAt + 200, type: "research.failed", payload: { error: opts.endWith.message ?? "Run failed" } });
  } else {
    const reason = opts.endWith.message ?? "Cancelled by user";
    cut.push({ at: endAt + 100, type: "research.cancel_requested", payload: { reason } });
    cut.push({ at: endAt + 2100, type: "research.cancelled", payload: { reason, acknowledgedWithinSla: true } });
  }
  return cut;
}

function buildFullTimeline(runId: string, opts: { withRepair?: boolean }): ScriptedEvent[] {
  const pack = packFor(runId);
  const out: ScriptedEvent[] = [
    { at: 0, type: "research.created", payload: { runId } },
    { at: 500, type: "research.queued", payload: { queueDepth: 1, workerSlot: "worker-04" } },
    { at: 1300, type: "research.started", payload: { workerId: "worker-04", concurrency: 4 } },
  ];

  let t = 1600;
  for (const step of STAGE_PLAN) {
    out.push({ at: t, type: "research.stage_changed", payload: { stage: step.stage } });
    out.push({ at: t + 80, type: "research.progress", payload: { percent: step.percent - 6, message: step.message } });

    if (step.stage === "DISCOVERY") {
      pack.sources.forEach((s, i) => {
        out.push({
          at: t + 500 + i * Math.floor((step.duration - 800) / pack.sources.length),
          type: "research.source_found",
          payload: { sourceId: `src_${runId}_${i + 1}`, ...s },
        });
      });
    }

    if (step.stage === "EVIDENCE") {
      pack.evidence.forEach((e, i) => {
        out.push({
          at: t + 600 + i * Math.floor((step.duration - 900) / pack.evidence.length),
          type: "research.evidence_found",
          payload: { evidenceId: `ev_${runId}_${i + 1}`, ...e },
        });
      });
    }

    if (step.stage === "VALIDATION") {
      out.push({ at: t + 200, type: "research.validation_started", payload: { attemptNumber: 1, maxAttempts: 3 } });
      if (opts.withRepair) {
        out.push({
          at: t + 1200,
          type: "research.repair_started",
          payload: { attemptNumber: 1, maxAttempts: 3, failingChecks: ["citation_coverage < 0.95 in section 3"] },
        });
        t += 2400;
        out.push({ at: t, type: "research.validation_started", payload: { attemptNumber: 2, maxAttempts: 3 } });
      }
    }

    out.push({ at: t + step.duration - 200, type: "research.progress", payload: { percent: step.percent, message: step.message } });
    t += step.duration;
  }

  out.push({
    at: t + 400,
    type: "research.completed",
    payload: { reportVersion: 1, totalExecutionTimeMs: t + 400 },
  });

  return out.sort((a, b) => a.at - b.at);
}

export function timelineDuration(runId: string, withRepair = false): number {
  const tl = buildTimeline(runId, { withRepair });
  return tl[tl.length - 1].at;
}

/** Demo runs whose id ends in an even char code go through one repair loop. */
export function demoRunRepairs(runId: string): boolean {
  return runId.charCodeAt(runId.length - 1) % 2 === 0;
}

export interface SimulatorOptions {
  /** How far into the run (ms) the stream "already is" — those events replay instantly */
  offsetMs?: number;
  /** Real-time multiplier for the remaining events */
  speed?: number;
  /** Wall-clock time the run started (for realistic timestamps) */
  startedAtMs?: number;
  withRepair?: boolean;
  endWith?: TimelineEnding;
}

export class SimulatedRunStreamer {
  private readonly runId: string;
  private readonly onEvent: EventCallback;
  private readonly timeline: ScriptedEvent[];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private currentEventId = 0;
  private stopped = false;
  private cancelled = false;
  private readonly startedAtMs: number;

  constructor(runId: string, onEvent: EventCallback, private readonly options: SimulatorOptions = {}) {
    this.runId = runId;
    this.onEvent = onEvent;
    this.timeline = buildTimeline(runId, { withRepair: options.withRepair, endWith: options.endWith });
    const lastAt = this.timeline[this.timeline.length - 1]?.at ?? 0;
    const offset = Math.min(options.offsetMs ?? 0, lastAt);
    this.startedAtMs = options.startedAtMs ?? Date.now() - offset;
  }

  private emit(type: SSEEventType, payload: Record<string, unknown>, atMs: number) {
    if (this.stopped) return;
    this.currentEventId += 1;
    this.onEvent({
      id: this.currentEventId,
      runId: this.runId,
      type,
      timestamp: new Date(atMs).toISOString(),
      payload,
    });
  }

  /** Number of events that will be replayed rather than streamed. */
  get replayCount(): number {
    const offset = this.options.offsetMs ?? 0;
    return this.timeline.filter((e) => e.at <= offset).length;
  }

  start() {
    const offset = this.options.offsetMs ?? 0;
    const speed = Math.max(0.25, this.options.speed ?? 1);

    for (const ev of this.timeline) {
      const stamp = this.startedAtMs + ev.at;
      if (ev.at <= offset) {
        this.emit(ev.type, ev.payload, stamp);
      } else {
        const delay = (ev.at - offset) / speed;
        this.timers.push(
          setTimeout(() => {
            if (this.cancelled) return;
            this.emit(ev.type, ev.payload, Date.now());
          }, delay)
        );
      }
    }
  }

  /** Mirrors POST /research-runs/{id}/cancel: acknowledged, then cancelled. */
  requestCancel(reason: string) {
    if (this.cancelled || this.stopped) return;
    this.cancelled = true;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.emit("research.cancel_requested", { reason }, Date.now());
    this.timers.push(
      setTimeout(() => {
        this.emit("research.cancelled", { reason, acknowledgedWithinSla: true, cleanupComplete: true }, Date.now());
      }, 2600)
    );
  }

  stop() {
    this.stopped = true;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
