"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpenText, CircleAlert, RotateCcw, Sparkle, CornerDownLeft } from "lucide-react";
import { useQuery } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { qk, useWorkspace } from "@/hooks/useWorkspace";
import { useCan, useTimezone } from "@/hooks/useSession";
import { useNow } from "@/hooks/useNow";
import { useHydrated } from "@/hooks/useHydrated";
import { useSession } from "@/stores/session.store";
import { useNotifications } from "@/stores/notification.store";
import { isRunActive, STAGE_META } from "@/types/research.types";
import { DECISION_META } from "@/types/report.types";
import { greetingFor, formatLocalizedTime } from "@/lib/utils/timezone";
import { firstName, pluralize } from "@/lib/utils/format";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar, Skeleton } from "@/components/ui/misc";
import { RelativeTime } from "@/components/ui/Time";
import { Sparkline } from "@/components/charts/charts";
import { RunStatus } from "@/components/research/RunStatus";
import { DECISION_TONE } from "@/components/reports/DecisionLog";
import { latestDecisionFor } from "@/components/reports/report-utils";

interface Todo {
  id: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  href: string;
  cta: string;
}

function QuickAsk() {
  const router = useRouter();
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const prev = JSON.parse(localStorage.getItem("arp.composer.draft") ?? "{}");
          localStorage.setItem("arp.composer.draft", JSON.stringify({ ...prev, question: text }));
        } catch {
          /* storage unavailable */
        }
        router.push("/research/new");
      }}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-sm transition-[border-color,box-shadow] focus-within:border-ink focus-within:shadow-md"
    >
      <Sparkle className="h-4 w-4 shrink-0 text-accent" />
      <label htmlFor="quick-ask" className="sr-only">
        Start research with a question
      </label>
      <input
        id="quick-ask"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask something worth an afternoon of reading…"
        className="min-w-0 flex-1 bg-transparent font-serif text-[17px] text-ink placeholder:text-ink-3 focus:outline-none"
      />
      <button
        type="submit"
        className="flex shrink-0 items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[13px] font-medium text-paper opacity-0 transition-opacity group-focus-within:opacity-100 disabled:opacity-0"
        disabled={!text.trim()}
      >
        Continue <CornerDownLeft className="h-3 w-3" />
      </button>
    </form>
  );
}

export function Overview() {
  const user = useSession((s) => s.user);
  const tz = useTimezone();
  const now = useNow(60_000);
  const hydrated = useHydrated();
  const canCreate = useCan("CREATE_RESEARCH_RUN");
  const canDecide = useCan("APPROVE_HUMAN_DECISION");
  const { project, projectId } = useWorkspace();
  const runs = useQuery(projectId ? qk.runs(projectId) : null, () => api.getResearchRuns(projectId));
  const reports = useQuery(projectId ? qk.reports(projectId) : null, () => api.getReports(projectId));
  const decisions = useQuery(qk.allDecisions, api.getAllDecisions);
  const analytics = useQuery(qk.analytics, api.getAnalytics);
  const notifications = useNotifications((s) => s.notifications);

  const active = (runs.data ?? []).filter((r) => isRunActive(r.state));
  const awaiting = (reports.data ?? []).filter((r) => !latestDecisionFor(r.latestVersionId, decisions.data ?? []));
  const failed = (runs.data ?? []).filter((r) => r.state === "FAILED");
  const conflictAlerts = notifications.filter((n) => n.type === "CONTRADICTION_FLAGGED" && !n.isRead && (!n.projectId || n.projectId === projectId));

  const todos = useMemo<Todo[]>(() => {
    const list: Todo[] = [];
    if (canDecide) {
      for (const r of awaiting) {
        list.push({ id: `dec-${r.id}`, icon: <BookOpenText className="h-4 w-4 text-accent" />, title: r.title, detail: `Version ${r.currentVersion} needs a decision before anyone relies on it.`, href: `/reports/${r.id}`, cta: "Review" });
      }
    }
    for (const n of conflictAlerts) {
      list.push({ id: n.id, icon: <CircleAlert className="h-4 w-4 text-st-control" />, title: n.title, detail: n.message, href: n.resourceType === "report" ? `/reports/${n.resourceId}` : `/research/${n.resourceId}`, cta: "Look" });
    }
    if (canCreate) {
      for (const r of failed.slice(0, 2)) {
        list.push({ id: `fail-${r.id}`, icon: <RotateCcw className="h-4 w-4 text-st-failure" />, title: r.questionText, detail: r.error ?? "This run failed.", href: `/research/new?from=${r.id}`, cta: "Retry" });
      }
    }
    return list;
  }, [awaiting, conflictAlerts, failed, canDecide, canCreate]);

  const loading = !runs.data || !reports.data;
  const greeting = hydrated && now ? `${greetingFor(now, tz)}, ${firstName(user.name)}.` : `Hello, ${firstName(user.name)}.`;
  const dateLine = hydrated && now ? formatLocalizedTime(new Date(now).toISOString(), tz, { weekday: "long", month: "long", day: "numeric", year: undefined, hour: undefined, minute: undefined, second: undefined }) : " ";

  const summaryBits = [
    active.length ? pluralize(active.length, "run") + " in progress" : null,
    canDecide && awaiting.length ? `${pluralize(awaiting.length, "report")} waiting on a decision` : null,
    conflictAlerts.length ? `${pluralize(conflictAlerts.length, "new conflict alert")}` : null,
  ].filter(Boolean) as string[];

  const series = analytics.data?.runs ?? [];

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="pb-8">
        <p className="text-[13px] text-ink-3" suppressHydrationWarning>
          {dateLine}
        </p>
        <h1 className="mt-1 font-serif text-[34px] leading-tight font-medium text-ink sm:text-[40px]" suppressHydrationWarning>
          {greeting}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-2">
          {loading ? (
            <span className="skeleton inline-block h-4 w-72 align-middle" />
          ) : summaryBits.length ? (
            <>In {project?.name}: {summaryBits.length > 1 ? `${summaryBits.slice(0, -1).join(", ")} and ${summaryBits[summaryBits.length - 1]}` : summaryBits[0]}.</>
          ) : (
            <>Nothing needs you in {project?.name} right now.</>
          )}
        </p>
        {canCreate && (
          <div className="mt-6 max-w-2xl">
            <QuickAsk />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Needs you */}
          <Panel>
            <PanelHeader title="Needs you" description={todos.length ? undefined : "Decisions, conflicts and failed runs land here."} />
            {loading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : todos.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-ink-3">You&apos;re clear. Nice.</p>
            ) : (
              <ul className="divide-y divide-line">
                {todos.map((t) => (
                  <li key={t.id}>
                    <Link href={t.href} className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60">
                      <span className="mt-0.5 shrink-0">{t.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-[14px] font-medium text-ink">{t.title}</span>
                        <span className="line-clamp-1 text-[13px] text-ink-3">{t.detail}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-ink-2 group-hover:text-ink">
                        {t.cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* In progress */}
          <Panel>
            <PanelHeader
              title="In progress"
              actions={
                <Link href="/research" className="text-[13px] text-ink-3 hover:text-ink">
                  All runs
                </Link>
              }
            />
            {loading ? (
              <div className="p-5">
                <Skeleton className="h-16" />
              </div>
            ) : active.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-ink-3">No runs going right now.</p>
            ) : (
              <ul className="divide-y divide-line">
                {active.map((r) => (
                  <li key={r.id}>
                    <Link href={`/research/${r.id}`} className="block px-5 py-4 transition-colors hover:bg-paper/60">
                      <div className="flex items-start justify-between gap-4">
                        <p className="line-clamp-2 text-[14px] font-medium text-ink">{r.questionText}</p>
                        <RunStatus state={r.state} className="shrink-0" />
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar value={r.progressPercent} className="flex-1" label="Progress" />
                        <span className="tnum w-9 text-right text-[12px] text-ink-3">{r.progressPercent}%</span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] text-ink-3">
                        {r.currentStage ? STAGE_META[r.currentStage].agent : "Queued"} · {r.creatorName} · {r.sourceCount} sources · {r.evidenceCount} evidence
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          {/* This week */}
          <Panel>
            <PanelHeader title="This week" description="Runs finished per day, all projects." />
            <div className="flex items-end justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-serif text-[34px] leading-none text-ink">{series.reduce((n, d) => n + d.completed, 0) || "—"}</p>
                <p className="mt-1 text-[12.5px] text-ink-3">runs completed</p>
              </div>
              <Sparkline values={series.map((d) => d.completed)} width={130} height={40} label="Completed runs per day, last 7 days" />
            </div>
            <dl className="grid grid-cols-3 border-t border-line text-center">
              {[
                ["Reports", project?.stats.totalReports],
                ["Sources", project?.stats.totalSources],
                ["Conflicts", project?.stats.contradictionsFound],
              ].map(([k, v]) => (
                <div key={String(k)} className="border-r border-line px-2 py-3 last:border-r-0">
                  <dt className="text-[11.5px] text-ink-3">{k}</dt>
                  <dd className="tnum mt-0.5 text-[16px] font-semibold text-ink">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {/* Recent reports */}
          <Panel>
            <PanelHeader
              title="Recent reports"
              actions={
                <Link href="/reports" className="text-[13px] text-ink-3 hover:text-ink">
                  Library
                </Link>
              }
            />
            {!reports.data ? (
              <div className="p-5">
                <Skeleton className="h-12" />
              </div>
            ) : reports.data.length === 0 ? (
              <p className="px-5 py-6 text-[13.5px] text-ink-3">None yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {reports.data.slice(0, 4).map((r) => {
                  const d = latestDecisionFor(r.latestVersionId, decisions.data ?? []);
                  return (
                    <li key={r.id}>
                      <Link href={`/reports/${r.id}`} className="block px-5 py-3.5 transition-colors hover:bg-paper/60">
                        <p className="line-clamp-2 font-serif text-[16px] leading-snug text-ink">{r.title}</p>
                        <div className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-3">
                          {d ? <Badge tone={DECISION_TONE[d.decisionType]}>{DECISION_META[d.decisionType].label}</Badge> : <Badge tone="accent">Awaiting decision</Badge>}
                          <span>v{r.currentVersion}</span>·<RelativeTime iso={r.updatedAt} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {canCreate && (
            <ButtonLink href="/schedules" variant="ghost" className="w-full justify-between">
              Set up recurring research <ArrowRight className="h-3.5 w-3.5" />
            </ButtonLink>
          )}
        </div>
      </div>
    </div>
  );
}
