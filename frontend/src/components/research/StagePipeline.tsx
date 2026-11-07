"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { AGENT_STAGES, STAGE_META, type AgentStage, type ResearchRunState } from "@/types/research.types";
import { formatDuration } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type StepState = "done" | "active" | "waiting" | "stopped";

/**
 * The eight agents as a track. Each step shows how long it took (or has
 * been running) so it's obvious where a run spends its time.
 */
export function StagePipeline({
  current,
  runState,
  stageStartedAt,
  finishedAt,
  repairAttempts,
  now,
}: {
  current: AgentStage;
  runState: ResearchRunState;
  stageStartedAt: Partial<Record<AgentStage, string>>;
  finishedAt?: string;
  repairAttempts: number;
  now: number;
}) {
  const currentIdx = AGENT_STAGES.indexOf(current);
  const terminal = runState === "COMPLETED" || runState === "FAILED" || runState === "CANCELLED";
  const notStarted = ["CREATED", "QUEUED", "RUNNING"].includes(runState) && !stageStartedAt.PLANNER;

  const stateOf = (i: number): StepState => {
    if (notStarted) return "waiting";
    if (runState === "COMPLETED") return "done";
    if (i < currentIdx) return "done";
    if (i === currentIdx) return terminal ? "stopped" : "active";
    return "waiting";
  };

  const durationOf = (stage: AgentStage, i: number): number | null => {
    const start = stageStartedAt[stage];
    if (!start) return null;
    const nextStage = AGENT_STAGES[i + 1];
    const end = (nextStage && stageStartedAt[nextStage]) || (i === currentIdx ? finishedAt : undefined);
    const endMs = end ? new Date(end).getTime() : now;
    return Math.max(0, (endMs - new Date(start).getTime()) / 1000);
  };

  return (
    <ol className="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-8 sm:gap-x-0" aria-label="Pipeline stages">
      {AGENT_STAGES.map((stage, i) => {
        const st = stateOf(i);
        const meta = STAGE_META[stage];
        const secs = durationOf(stage, i);
        const isRepairing = stage === "VALIDATION" && runState === "REPAIRING";
        return (
          <li key={stage} className="relative flex flex-col items-start sm:items-center" aria-current={st === "active" ? "step" : undefined}>
            {/* connector */}
            {i > 0 && (
              <span
                className={cn(
                  "absolute top-[13px] right-1/2 left-[-50%] hidden h-[2px] sm:block",
                  st === "waiting" ? "bg-line" : "bg-ink"
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors duration-300",
                st === "done" && "border-ink bg-ink text-paper",
                st === "active" && "border-ink bg-surface text-ink",
                st === "waiting" && "border-line-strong bg-surface text-ink-3",
                st === "stopped" && (runState === "FAILED" ? "border-st-failure bg-st-failure text-white" : "border-st-control bg-st-control text-white")
              )}
            >
              {st === "done" ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : st === "stopped" ? (
                <X className="h-3.5 w-3.5" strokeWidth={3} />
              ) : isRepairing ? (
                <RotateCcw className="h-3.5 w-3.5 animate-spin [animation-duration:2s]" />
              ) : (
                i + 1
              )}
              {st === "active" && <span className="absolute inset-[-5px] animate-ping rounded-full border border-ink/30 [animation-duration:2s]" aria-hidden />}
            </span>
            <span className={cn("mt-2 text-[12.5px] font-medium", st === "waiting" ? "text-ink-3" : "text-ink")}>{meta.label}</span>
            <span className="tnum text-[11.5px] text-ink-3" title={meta.does}>
              {secs !== null && st !== "waiting" ? formatDuration(secs) : meta.agent.split(" ")[0]}
              {stage === "VALIDATION" && repairAttempts > 0 && <span className="text-st-validation"> · {repairAttempts} repair</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
