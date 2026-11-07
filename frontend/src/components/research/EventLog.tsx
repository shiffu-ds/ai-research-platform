"use client";

/**
 * The run's event stream, readable by people: plain-language lines,
 * filter chips, and "follow" that pauses itself when you scroll away.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ChevronRight } from "lucide-react";
import type { ResearchEvent, SSEEventType } from "@/types/sse.types";
import { STAGE_META, type AgentStage } from "@/types/research.types";
import { formatLocalizedTime } from "@/lib/utils/timezone";
import { useTimezone } from "@/hooks/useSession";
import { cn } from "@/lib/utils/cn";

type Filter = "all" | "findings" | "lifecycle";

const FINDINGS: SSEEventType[] = ["research.source_found", "research.evidence_found"];

function describe(e: ResearchEvent): { text: string; tone: string } {
  const p = e.payload as Record<string, unknown>;
  switch (e.type) {
    case "research.created":
      return { text: "Run created", tone: "text-ink-2" };
    case "research.queued":
      return { text: `Queued on ${String(p.workerSlot ?? "a worker")}`, tone: "text-ink-2" };
    case "research.started":
      return { text: `Picked up by ${String(p.workerId ?? "worker")}`, tone: "text-ink-2" };
    case "research.stage_changed": {
      const meta = STAGE_META[p.stage as AgentStage];
      return { text: meta ? `${meta.agent} started` : `Stage → ${String(p.stage)}`, tone: "text-ink font-medium" };
    }
    case "research.progress":
      return { text: `${String(p.message ?? "Progress")} — ${String(p.percent)}%`, tone: "text-ink-3" };
    case "research.source_found":
      return { text: `Source: ${String(p.title)}`, tone: "text-st-intake" };
    case "research.evidence_found":
      return {
        text: `${p.hasContradiction ? "Conflicting evidence" : "Evidence"}: “${String(p.excerpt).slice(0, 110)}${String(p.excerpt).length > 110 ? "…" : ""}”`,
        tone: p.hasContradiction ? "text-st-control" : "text-st-success",
      };
    case "research.validation_started":
      return { text: `Validation pass ${String(p.attemptNumber ?? 1)} of ${String(p.maxAttempts ?? 3)}`, tone: "text-st-validation" };
    case "research.repair_started":
      return {
        text: `Repairing: ${Array.isArray(p.failingChecks) ? (p.failingChecks as string[]).join(", ") : "validation failed"}`,
        tone: "text-st-validation",
      };
    case "research.completed":
      return { text: "Run completed", tone: "text-st-success font-medium" };
    case "research.failed":
      return { text: `Failed: ${String(p.error ?? "unknown error")}`, tone: "text-st-failure font-medium" };
    case "research.cancel_requested":
      return { text: `Cancellation requested${p.reason ? ` — ${String(p.reason)}` : ""}`, tone: "text-st-control" };
    case "research.cancelled":
      return { text: "Cancelled, worker cleaned up", tone: "text-st-control font-medium" };
  }
}

export function EventLog({ events, live }: { events: ResearchEvent[]; live: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [follow, setFollow] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const tz = useTimezone();

  const ordered = useMemo(() => {
    const asc = [...events].reverse();
    if (filter === "findings") return asc.filter((e) => FINDINGS.includes(e.type));
    if (filter === "lifecycle") return asc.filter((e) => !FINDINGS.includes(e.type) && e.type !== "research.progress");
    return asc;
  }, [events, filter]);

  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [ordered.length, follow]);

  const latest = events[0];
  const latestText = latest ? describe(latest).text : "";

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <div className="flex gap-1" role="group" aria-label="Filter events">
          {(
            [
              ["all", `All ${events.length}`],
              ["findings", "Findings"],
              ["lifecycle", "Lifecycle"],
            ] as [Filter, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              aria-pressed={filter === v}
              className={cn(
                "tnum rounded-full px-2.5 py-0.5 text-[12px] font-medium transition-colors",
                filter === v ? "bg-ink text-paper" : "text-ink-3 hover:bg-sunken hover:text-ink"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-3 select-none">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-[var(--ink)]" />
          Follow
        </label>
      </div>

      {/* Screen readers hear the newest line without the whole log being re-read. */}
      <p className="sr-only" aria-live="polite">
        {live ? latestText : ""}
      </p>

      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          if (!atBottom && follow) setFollow(false);
        }}
        className="relative min-h-0 flex-1 overflow-y-auto py-1.5 font-mono text-[12.5px] leading-relaxed"
        role="log"
        aria-label="Run events"
      >
        {ordered.length === 0 && <p className="px-4 py-8 text-center font-sans text-[13px] text-ink-3">Waiting for the first event…</p>}
        {ordered.map((e) => {
          const d = describe(e);
          const expanded = open === e.id;
          return (
            <div key={e.id} className="group animate-fade">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : e.id)}
                className="flex w-full items-start gap-3 px-4 py-0.5 text-left hover:bg-sunken/70"
                aria-expanded={expanded}
              >
                <span className="tnum w-9 shrink-0 text-right text-ink-3">{String(e.id).padStart(3, "0")}</span>
                <span className="tnum w-[64px] shrink-0 text-ink-3" suppressHydrationWarning>
                  {formatLocalizedTime(e.timestamp, tz, { hour: "2-digit", minute: "2-digit", second: "2-digit", year: undefined, month: undefined, day: undefined })}
                </span>
                <span className={cn("min-w-0 flex-1 font-sans text-[13px]", d.tone)}>{d.text}</span>
                <ChevronRight className={cn("mt-1 h-3 w-3 shrink-0 text-ink-3 opacity-0 transition group-hover:opacity-100", expanded && "rotate-90 opacity-100")} />
              </button>
              {expanded && (
                <pre className="mx-4 mb-1.5 ml-[124px] overflow-x-auto rounded-md bg-sunken p-2.5 text-[11.5px] text-ink-2">
                  {JSON.stringify({ type: e.type, ...e.payload }, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      {!follow && (
        <button
          type="button"
          onClick={() => setFollow(true)}
          className="absolute right-4 bottom-4 flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[12px] font-medium text-paper shadow-md"
        >
          <ArrowDown className="h-3 w-3" /> Latest
        </button>
      )}
    </div>
  );
}
