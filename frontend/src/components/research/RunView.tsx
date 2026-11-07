"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenText, CircleStop, RotateCcw, Repeat2, Wifi, WifiOff, History, AlertTriangle } from "lucide-react";
import { useQuery, invalidate } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { USE_MOCK } from "@/lib/api/config";
import { qk } from "@/hooks/useWorkspace";
import { useRunStream } from "@/hooks/useRunStream";
import { useNow } from "@/hooks/useNow";
import { useSession } from "@/stores/session.store";
import { useNotifications } from "@/stores/notification.store";
import { toast } from "@/stores/toast.store";
import { canCancelRun } from "@/types/rbac.types";
import { isRunActive, STAGE_META } from "@/types/research.types";
import { formatClock, formatDuration, formatPercent, hostname } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Avatar, CopyButton, ProgressBar, Skeleton, Tip } from "@/components/ui/misc";
import { Menu } from "@/components/ui/Menu";
import { LocalTime, DATE_TIME } from "@/components/ui/Time";
import { ErrorState } from "@/components/ui/states";
import { RunStatus } from "./RunStatus";
import { StagePipeline } from "./StagePipeline";
import { EventLog } from "./EventLog";
import { CancelRunDialog } from "./CancelRunDialog";

function ConnectionPill({ status, replayed, retryInMs }: { status: string; replayed: number; retryInMs: number | null }) {
  if (status === "replaying") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-st-intake">
        <History className="h-3.5 w-3.5" /> Caught up on {replayed} earlier events
      </span>
    );
  }
  if (status === "reconnecting") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-st-process">
        <WifiOff className="h-3.5 w-3.5" />
        {retryInMs ? `Reconnecting in ${Math.ceil(retryInMs / 1000)}s` : "Reconnecting…"}
      </span>
    );
  }
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3">
        <Wifi className="h-3.5 w-3.5" /> {USE_MOCK ? "Simulated stream" : "Live"}
      </span>
    );
  }
  return <span className="text-[12.5px] text-ink-3">Connecting…</span>;
}

function Counter({ label, value, tone, hint }: { label: string; value: number; tone?: string; hint?: string }) {
  return (
    <div className="px-4 py-3" title={hint}>
      <p className="text-[12px] text-ink-3">{label}</p>
      <p key={value} className={cn("tnum mt-0.5 animate-rise font-serif text-[26px] leading-none", tone ?? "text-ink")}>
        {value}
      </p>
    </div>
  );
}

export function RunView({ runId }: { runId: string }) {
  const runQ = useQuery(qk.run(runId), () => api.getResearchRun(runId));
  const run = runQ.data;
  const stream = useRunStream(run);
  const s = stream.state;
  const now = useNow(250);
  const user = useSession((st) => st.user);
  const role = useSession((st) => st.role);
  const push = useNotifications((st) => st.push);
  const [cancelOpen, setCancelOpen] = useState(false);
  const prevState = useRef(s.state);

  const active = isRunActive(s.state);
  const started = s.startedAt ? new Date(s.startedAt).getTime() : undefined;
  const ended = s.finishedAt ? new Date(s.finishedAt).getTime() : undefined;
  const elapsed = started ? ((ended ?? now) - started) / 1000 : 0;
  const allowedToCancel = run ? canCancelRun(role, user.id, run.createdBy) : false;

  // Announce outcomes that happen while someone is watching (not replays).
  useEffect(() => {
    const before = prevState.current;
    prevState.current = s.state;
    if (!run || before === s.state || isRunActive(s.state) || stream.connection === "replaying") return;
    const finished = s.finishedAt ? new Date(s.finishedAt).getTime() : 0;
    if (Date.now() - finished > 15_000) return;

    invalidate("runs:");
    const short = run.questionText.length > 60 ? `${run.questionText.slice(0, 60)}…` : run.questionText;
    if (s.state === "COMPLETED") {
      toast({ title: "Run finished", description: `${s.sourcesCount} sources, ${s.evidenceCount} evidence excerpts.`, tone: "success" });
      push({ type: "RUN_COMPLETED", severity: "SUCCESS", title: "Run finished", message: short, resourceId: run.id, resourceType: "research_run", projectId: run.projectId });
    } else if (s.state === "CANCELLED") {
      push({ type: "CANCELLATION_ACKNOWLEDGED", severity: "WARNING", title: "Cancellation acknowledged", message: short, resourceId: run.id, resourceType: "research_run", projectId: run.projectId });
    } else if (s.state === "FAILED") {
      toast({ title: "Run failed", description: s.error, tone: "danger" });
      push({ type: "RUN_FAILED", severity: "ERROR", title: "Run failed", message: s.error ?? short, resourceId: run.id, resourceType: "research_run", projectId: run.projectId });
    }
  }, [s.state, s.finishedAt, s.sourcesCount, s.evidenceCount, s.error, run, push, stream.connection]);

  const latestMessage = useMemo(() => {
    const p = s.events.find((e) => e.type === "research.progress");
    return p ? String((p.payload as { message?: string }).message ?? "") : "";
  }, [s.events]);

  if (runQ.error && !run) return <ErrorState error={runQ.error} onRetry={runQ.refetch} />;

  if (!run) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const config = run.config;

  return (
    <div className="mx-auto max-w-[1180px]">
      <Link href="/research" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Research
      </Link>

      <header className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <h1 className="font-serif text-[26px] leading-snug font-medium text-ink sm:text-[30px]">{run.questionText}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-2">
            <RunStatus state={s.lastEventId ? s.state : run.state} />
            <span className="flex items-center gap-1.5">
              <Avatar name={run.creatorName} size={20} /> {run.creatorName}
            </span>
            <span className="flex items-center gap-1 font-mono text-[12px] text-ink-3">
              {run.id}
              <CopyButton value={run.id} label="" />
            </span>
            <ConnectionPill status={stream.connection} replayed={stream.replayed} retryInMs={stream.retryInMs} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {active && allowedToCancel && (
            <Button variant="secondary" icon={<CircleStop className="h-3.5 w-3.5" />} onClick={() => setCancelOpen(true)} disabled={s.isCancelRequested}>
              {s.isCancelRequested ? "Cancelling…" : "Cancel run"}
            </Button>
          )}
          {active && !allowedToCancel && (
            <Tip content="Only the run owner, admins and owners can cancel this run.">
              <Button variant="secondary" disabled icon={<CircleStop className="h-3.5 w-3.5" />}>
                Cancel run
              </Button>
            </Tip>
          )}
          {USE_MOCK && (
            <Menu
              label="Replay"
              align="end"
              width={200}
              sections={[
                {
                  label: "Watch from the first event",
                  items: [1, 2, 4].map((x) => ({
                    key: String(x),
                    label: x === 1 ? "Real time" : `${x}× speed`,
                    selected: stream.speed === x,
                    onSelect: () => stream.replay(x),
                  })),
                },
              ]}
              trigger={({ toggle, ...aria }) => (
                <Button {...aria} onClick={toggle} variant="ghost" icon={<Repeat2 className="h-3.5 w-3.5" />}>
                  Replay
                </Button>
              )}
            />
          )}
          {s.state === "COMPLETED" && run.reportId && (
            <ButtonLink href={`/reports/${run.reportId}`} variant="primary" icon={<BookOpenText className="h-3.5 w-3.5" />}>
              Read report
            </ButtonLink>
          )}
        </div>
      </header>

      {/* Progress */}
      <Panel className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <p className="text-[12px] text-ink-3">{active ? "Now" : "Final stage"}</p>
            <p className="truncate text-[15px] font-medium text-ink">
              {active ? latestMessage || STAGE_META[s.currentStage].does : STAGE_META[s.currentStage].agent}
            </p>
          </div>
          <div className="flex items-end gap-6">
            <div className="text-right">
              <p className="text-[12px] text-ink-3">Elapsed</p>
              <p className="tnum font-serif text-[22px] leading-none text-ink">{formatClock(elapsed)}</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-ink-3">Progress</p>
              <p className="tnum font-serif text-[22px] leading-none text-ink">{Math.round(s.progressPercent)}%</p>
            </div>
          </div>
        </div>
        <ProgressBar
          value={s.progressPercent}
          tone={s.state === "FAILED" ? "failure" : s.state === "COMPLETED" ? "success" : "ink"}
          className="h-1 rounded-none"
          label="Run progress"
        />
        <div className="px-5 pt-6 pb-5">
          <StagePipeline
            current={s.currentStage}
            runState={s.lastEventId ? s.state : run.state}
            stageStartedAt={s.stageStartedAt}
            finishedAt={s.finishedAt}
            repairAttempts={s.repairAttempts}
            now={now}
          />
        </div>
      </Panel>

      {/* Outcome */}
      {s.state === "COMPLETED" && (
        <div className="mt-4 flex animate-rise flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-st-success/30 bg-st-success-soft px-5 py-3.5 text-[13.5px] text-ink">
          <span className="font-medium text-st-success">Finished in {formatDuration(elapsed)}.</span>
          <span className="text-ink-2">
            {s.sourcesCount} sources read, {s.evidenceCount} evidence excerpts hashed, {s.contradictionsCount} conflicts flagged
            {s.repairAttempts ? `, ${s.repairAttempts} repair pass` : ""}.
          </span>
          {!run.reportId && (
            <span className="text-ink-3">
              {USE_MOCK ? (
                <>
                  Report drafting happens on the backend; in the demo you can open a{" "}
                  <Link className="underline decoration-line-strong underline-offset-2 hover:text-ink" href="/reports/rep_energy_benchmarks_v1">
                    sample report
                  </Link>
                  .
                </>
              ) : (
                "The report will appear in Reports once it's published."
              )}
            </span>
          )}
        </div>
      )}
      {s.state === "FAILED" && (
        <div className="mt-4 flex animate-rise items-start gap-3 rounded-xl border border-st-failure/30 bg-st-failure-soft px-5 py-3.5 text-[13.5px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-st-failure" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-st-failure">This run stopped during {STAGE_META[s.currentStage].agent.toLowerCase()}.</p>
            <p className="mt-0.5 text-ink-2">{s.error ?? run.error}</p>
          </div>
          <ButtonLink href={`/research/new?from=${run.id}`} size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />}>
            Try again
          </ButtonLink>
        </div>
      )}
      {s.state === "CANCELLED" && (
        <div className="mt-4 animate-rise rounded-xl border border-st-control/30 bg-st-control-soft px-5 py-3.5 text-[13.5px] text-ink-2">
          <span className="font-medium text-st-control">Cancelled.</span> {s.cancelReason ? `Reason: ${s.cancelReason}.` : ""} What it found before stopping is
          kept below.
        </div>
      )}

      {/* Live detail */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="flex h-[520px] flex-col overflow-hidden">
          <PanelHeader title="What's happening" description="Every event the run has sent, oldest at the top." />
          <div className="min-h-0 flex-1">
            <EventLog events={s.events} live={active} />
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <div className="grid grid-cols-2 divide-x divide-y divide-line">
              <Counter label="Sources" value={s.sourcesCount} />
              <Counter label="Evidence" value={s.evidenceCount} />
              <Counter label="Conflicts" value={s.contradictionsCount} tone={s.contradictionsCount ? "text-st-control" : undefined} />
              <Counter label="Repair passes" value={s.repairAttempts} hint={`At most ${config.maxRepairAttempts ?? 3}`} tone={s.repairAttempts ? "text-st-validation" : undefined} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Sources found" description={s.sources.length ? "Scored by authority, freshness and reputation." : undefined} />
            {s.sources.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-ink-3">{active ? "Discovery hasn't started yet." : "No sources were recorded."}</p>
            ) : (
              <ul className="divide-y divide-line">
                {s.sources.slice(0, 6).map((src) => (
                  <li key={src.sourceId} className="animate-rise px-5 py-2.5">
                    <a href={src.url} target="_blank" rel="noreferrer noopener" className="line-clamp-2 text-[13px] leading-snug text-ink hover:underline">
                      {src.title}
                    </a>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="truncate text-[12px] text-ink-3">{src.publisher ?? hostname(src.url)}</span>
                      <span className="ml-auto h-1 w-14 overflow-hidden rounded-full bg-sunken" aria-hidden>
                        <span className="block h-full rounded-full bg-st-intake" style={{ width: `${src.authorityScore * 100}%` }} />
                      </span>
                      <span className="tnum w-8 text-right text-[12px] text-ink-2" title="Authority score">
                        {src.authorityScore.toFixed(2)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Evidence" />
            {s.evidence.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-ink-3">Excerpts appear here as they are extracted.</p>
            ) : (
              <ul className="divide-y divide-line">
                {s.evidence.slice(0, 5).map((ev) => (
                  <li key={ev.evidenceId} className="animate-rise px-5 py-3">
                    <p className="font-serif text-[14.5px] leading-snug text-ink">&ldquo;{ev.excerpt}&rdquo;</p>
                    <p className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
                      {ev.locator}
                      <span>·</span>
                      <span className="tnum">{formatPercent(ev.confidenceScore)} confident</span>
                      {ev.hasContradiction && <span className="ml-auto font-medium text-st-control">conflicts</span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* Configuration */}
      <details className="group mt-6 rounded-xl border border-line bg-surface shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-[13.5px] font-medium text-ink">
          How this run was configured
          <span className="text-[12px] font-normal text-ink-3 group-open:hidden">Show</span>
          <span className="hidden text-[12px] font-normal text-ink-3 group-open:inline">Hide</span>
        </summary>
        <dl className="grid gap-x-8 gap-y-3 border-t border-line px-5 py-4 text-[13px] sm:grid-cols-3">
          {[
            ["Started", <LocalTime key="s" iso={run.startedAt ?? run.createdAt} options={DATE_TIME} />],
            ["Max sources", config.maxSources ?? "—"],
            ["Embedding model", config.embeddingModel ?? "—"],
            ["Reranker threshold", config.rerankerThreshold ?? "—"],
            ["Conflict detection", config.enableContradictionDetection ? "On" : "Off"],
            ["Repair attempts", config.maxRepairAttempts ?? 3],
            ["Primary model", config.primaryModelId ?? "Router default"],
            ["Fallback model", config.fallbackModelId ?? "Router default"],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt className="text-ink-3">{k}</dt>
              <dd className="mt-0.5 text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </details>

      <CancelRunDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason) => {
          try {
            await stream.requestCancel(reason);
          } catch {
            toast({ title: "Couldn't send the cancellation", description: "Check your connection and try again.", tone: "danger" });
          }
        }}
        cancelRequestedAt={s.cancelRequestedAt}
        acknowledged={s.state === "CANCELLED"}
        acknowledgedAt={s.state === "CANCELLED" && s.finishedAt ? new Date(s.finishedAt).getTime() : undefined}
        now={now}
      />
    </div>
  );
}
