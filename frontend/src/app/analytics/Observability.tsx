"use client";

import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { useQuery } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { qk } from "@/hooks/useWorkspace";
import { useCan } from "@/hooks/useSession";
import { formatCompact, formatDuration, formatMs, formatNumber, formatPercent, formatUSD } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ChartTable, ColumnChart, Legend, LineChart, Sparkline, type Series } from "@/components/charts/charts";
import { cn } from "@/lib/utils/cn";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
const longDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

function ChartPanel({
  title,
  description,
  legend,
  chart,
  table,
}: {
  title: string;
  description: string;
  legend?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Panel>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
          <p className="text-[13px] text-ink-3">{description}</p>
        </div>
        <Segmented label={`${title}: view`} size="sm" value={view} onChange={setView} options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table" }]} />
      </header>
      {legend && view === "chart" && <div className="px-5 pt-3">{legend}</div>}
      <div className="px-5 pt-3 pb-4">{view === "chart" ? chart : table}</div>
    </Panel>
  );
}

function Stat({ label, value, sub, trend, tone }: { label: string; value: string; sub?: string; trend?: number[]; tone?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 bg-surface px-5 py-4">
      <div className="min-w-0">
        <p className="text-[12.5px] text-ink-3">{label}</p>
        <p className={cn("mt-1 text-[26px] leading-none font-semibold text-ink", tone)}>{value}</p>
        {sub && <p className="mt-1.5 text-[12px] text-ink-3">{sub}</p>}
      </div>
      {trend && <Sparkline values={trend} label={`${label} trend`} width={72} height={26} />}
    </div>
  );
}

const OUTCOMES: Series[] = [
  { key: "completed", label: "Completed", color: "var(--viz-1)" },
  { key: "failed", label: "Failed", color: "var(--viz-2)" },
  { key: "cancelled", label: "Cancelled", color: "var(--viz-3)" },
];

const TOKENS: Series[] = [
  { key: "prompt", label: "Prompt", color: "var(--viz-1)" },
  { key: "completion", label: "Completion", color: "var(--viz-2)" },
];

export function Observability() {
  const allowed = useCan("VIEW_AUDIT_LOG");
  const q = useQuery(allowed ? qk.analytics : null, api.getAnalytics);

  if (!allowed) {
    return (
      <EmptyState
        drawing="notebook"
        title="Observability is for owners and admins"
        action={<p className="flex items-center gap-1.5 text-[13px] text-ink-3"><Lock className="h-3.5 w-3.5" /> Switch roles from the account menu to preview it.</p>}
      >
        It shows spend, latency and failure rates across every project, so it&apos;s limited to the people who manage the platform.
      </EmptyState>
    );
  }

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const d = q.data;

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        title="Observability"
        description="How the platform is doing across every project: throughput, what it costs, how fast retrieval answers, and which agents are slowest. Last 7 days."
      />

      {!d ? (
        <div className="space-y-6">
          <Skeleton className="h-28 rounded-xl" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      ) : (
        <div className={cn("space-y-6 transition-opacity", q.isRefreshing && "opacity-60")}>
          <Panel className="grid gap-px overflow-hidden bg-line sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Success rate"
              value={formatPercent(d.kpi.completedRuns / d.kpi.totalRuns)}
              sub={`${d.kpi.completedRuns} of ${d.kpi.totalRuns} runs · ${d.kpi.failedRuns} failed`}
              trend={d.runs.map((r) => r.completed / Math.max(1, r.completed + r.failed + r.cancelled))}
            />
            <Stat label="Spend" value={formatUSD(d.kpi.totalEstimatedCostUSD)} sub={`${formatCompact(d.kpi.totalTokensConsumed)} tokens`} trend={d.tokens.map((t) => t.estimatedCostUSD)} />
            <Stat label="Retrieval p95" value={formatMs(d.kpi.p95RetrievalLatencyMs)} sub="Target is under 500 ms" tone={d.kpi.p95RetrievalLatencyMs > 500 ? "text-st-failure" : undefined} />
            <Stat label="Average run" value={formatDuration(d.kpi.avgRunDurationSeconds)} sub={`${d.kpi.totalReportsPublished} reports · ${d.kpi.totalEvidenceChunks} evidence chunks`} />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartPanel
              title="Runs per day"
              description="By how they ended."
              legend={<Legend series={OUTCOMES} />}
              chart={
                <ColumnChart
                  ariaLabel="Stacked columns of completed, failed and cancelled runs per day"
                  series={OUTCOMES}
                  data={d.runs.map((r) => ({ label: day(r.date), title: longDay(r.date), values: { completed: r.completed, failed: r.failed, cancelled: r.cancelled } }))}
                />
              }
              table={
                <ChartTable
                  caption="Runs per day"
                  rows={d.runs}
                  columns={[
                    { key: "d", label: "Day", render: (r) => longDay(r.date) },
                    { key: "c", label: "Completed", render: (r) => r.completed, align: "right" },
                    { key: "f", label: "Failed", render: (r) => r.failed, align: "right" },
                    { key: "x", label: "Cancelled", render: (r) => r.cancelled, align: "right" },
                  ]}
                />
              }
            />

            <ChartPanel
              title="Tokens per day"
              description="Prompt vs completion."
              legend={<Legend series={TOKENS} />}
              chart={
                <ColumnChart
                  ariaLabel="Stacked columns of prompt and completion tokens per day"
                  series={TOKENS}
                  format={formatCompact}
                  data={d.tokens.map((t) => ({ label: day(t.date), title: longDay(t.date), values: { prompt: t.promptTokens, completion: t.completionTokens } }))}
                />
              }
              table={
                <ChartTable
                  caption="Tokens per day"
                  rows={d.tokens}
                  columns={[
                    { key: "d", label: "Day", render: (r) => longDay(r.date) },
                    { key: "p", label: "Prompt", render: (r) => formatNumber(r.promptTokens), align: "right" },
                    { key: "c", label: "Completion", render: (r) => formatNumber(r.completionTokens), align: "right" },
                    { key: "t", label: "Total", render: (r) => formatNumber(r.totalTokens), align: "right" },
                  ]}
                />
              }
            />

            <ChartPanel
              title="Spend per day"
              description="Estimated from each model's price per token."
              chart={
                <LineChart
                  ariaLabel="Line chart of estimated spend in US dollars per day"
                  seriesLabel="Spend"
                  format={(v) => formatUSD(v)}
                  data={d.tokens.map((t) => ({ label: day(t.date), title: longDay(t.date), value: t.estimatedCostUSD }))}
                />
              }
              table={
                <ChartTable
                  caption="Spend per day"
                  rows={d.tokens}
                  columns={[
                    { key: "d", label: "Day", render: (r) => longDay(r.date) },
                    { key: "u", label: "Spend", render: (r) => formatUSD(r.estimatedCostUSD), align: "right" },
                  ]}
                />
              }
            />

            <ChartPanel
              title="Retrieval latency"
              description={`${formatPercent(d.latency.filter((b) => b.bucket.startsWith(">")).reduce((n, b) => n + b.percentage, 0) / 100, 0)} of ${formatNumber(d.latency.reduce((n, b) => n + b.count, 0))} retrievals took longer than 500 ms.`}
              chart={
                <ColumnChart
                  ariaLabel="Histogram of retrieval latency with the 500 millisecond target marked"
                  series={[{ key: "count", label: "Retrievals", color: "var(--viz-1)" }]}
                  format={formatCompact}
                  threshold={{ at: d.latency.findIndex((b) => b.bucket.startsWith(">")), label: "500 ms target" }}
                  data={d.latency.map((b) => ({ label: b.bucket.replace("ms", ""), title: `${b.bucket} · ${b.percentage}%`, values: { count: b.count } }))}
                />
              }
              table={
                <ChartTable
                  caption="Retrieval latency buckets"
                  rows={d.latency}
                  columns={[
                    { key: "b", label: "Latency", render: (r) => r.bucket },
                    { key: "n", label: "Retrievals", render: (r) => formatNumber(r.count), align: "right" },
                    { key: "p", label: "Share", render: (r) => `${r.percentage}%`, align: "right" },
                  ]}
                />
              }
            />
          </div>

          <Panel>
            <header className="px-5 pt-4">
              <h2 className="text-[14px] font-semibold text-ink">Agents</h2>
              <p className="text-[13px] text-ink-3">Typical and slow-case (p95) time per run. The bar spans average to p95.</p>
            </header>
            <div className="overflow-x-auto px-5 pt-3 pb-4">
              <table className="w-full min-w-[620px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-ink-3">
                    <th className="py-2 pr-4 font-medium">Agent</th>
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 pr-4 text-right font-medium">Average</th>
                    <th className="py-2 pr-4 text-right font-medium">p95</th>
                    <th className="py-2 text-right font-medium">Success</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(() => {
                    const maxP95 = Math.max(...d.agents.map((a) => a.p95DurationMs));
                    return d.agents.map((a) => (
                      <tr key={a.agent}>
                        <td className="py-2.5 pr-4 text-ink">{a.agent}</td>
                        <td className="w-[40%] py-2.5 pr-4">
                          <div className="relative h-2.5 rounded-full bg-sunken" title={`${formatMs(a.avgDurationMs)} average, ${formatMs(a.p95DurationMs)} p95`}>
                            <span
                              className="absolute top-0 h-full rounded-full bg-viz-1/35"
                              style={{ left: `${(a.avgDurationMs / maxP95) * 100}%`, width: `${((a.p95DurationMs - a.avgDurationMs) / maxP95) * 100}%` }}
                            />
                            <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-viz-1" style={{ left: `${(a.avgDurationMs / maxP95) * 100}%` }} />
                          </div>
                        </td>
                        <td className="tnum py-2.5 pr-4 text-right text-ink-2">{formatMs(a.avgDurationMs)}</td>
                        <td className="tnum py-2.5 pr-4 text-right text-ink-2">{formatMs(a.p95DurationMs)}</td>
                        <td className={cn("tnum py-2.5 text-right", a.successRate < 96 ? "font-medium text-st-process" : "text-ink-2")}>{a.successRate.toFixed(1)}%</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
