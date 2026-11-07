"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useQuery } from "@/lib/api/query";
import { api, type ReportBundle } from "@/lib/api/client";
import { qk, useWorkspace } from "@/hooks/useWorkspace";
import { DECISION_META } from "@/types/report.types";
import { Input, Segmented } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/misc";
import { RelativeTime } from "@/components/ui/Time";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { DECISION_TONE } from "@/components/reports/DecisionLog";
import { allCitations, latestDecisionFor } from "@/components/reports/report-utils";

type Filter = "all" | "awaiting" | "approved" | "revision";

export function ReportLibrary() {
  const { projectId, project } = useWorkspace();
  const reports = useQuery(projectId ? qk.reports(projectId) : null, () => api.getReports(projectId));
  const ids = (reports.data ?? []).map((r) => r.id);
  const bundles = useQuery(ids.length ? `report-bundles:${ids.join(",")}` : null, () => Promise.all(ids.map((id) => api.getReport(id))));
  const decisions = useQuery(qk.allDecisions, api.getAllDecisions);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    return (bundles.data ?? []).map((b: ReportBundle) => {
      const latest = b.versions.find((v) => v.id === b.report.latestVersionId) ?? b.versions[b.versions.length - 1];
      const decision = latest ? latestDecisionFor(latest.id, decisions.data ?? []) : undefined;
      return { ...b, latest, decision };
    });
  }, [bundles.data, decisions.data]);

  const visible = rows.filter((r) => {
    if (filter === "awaiting" && r.decision) return false;
    if (filter === "approved" && r.decision?.decisionType !== "APPROVED") return false;
    if (filter === "revision" && r.decision?.decisionType !== "NEEDS_REVISION") return false;
    const q = query.trim().toLowerCase();
    return !q || `${r.report.title} ${r.latest?.summary ?? ""}`.toLowerCase().includes(q);
  });

  const awaiting = rows.filter((r) => !r.decision).length;
  const loading = !reports.data || (ids.length > 0 && !bundles.data);

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        eyebrow={project?.name}
        title="Reports"
        description="Each report is a set of immutable versions. Read one, check where its sources disagree, and record what you decided."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Filter reports"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "awaiting", label: `Awaiting decision${awaiting ? ` ${awaiting}` : ""}` },
            { value: "approved", label: "Approved" },
            { value: "revision", label: "Needs revision" },
          ]}
        />
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles and summaries…" className="pl-8" aria-label="Search reports" />
        </div>
      </div>

      {reports.error && !reports.data ? (
        <ErrorState error={reports.error} onRetry={reports.refetch} />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface/50">
          <EmptyState drawing="notebook" title={rows.length === 0 ? "No reports yet" : "Nothing matches"}>
            {rows.length === 0 ? "Reports appear here when a research run finishes and passes validation." : "Try another filter."}
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map(({ report, latest, decision, versions }) => (
            <Link
              key={report.id}
              href={`/reports/${report.id}`}
              className="group flex flex-col rounded-xl border border-line bg-surface p-6 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                {decision ? (
                  <Badge tone={DECISION_TONE[decision.decisionType]} dot>
                    {DECISION_META[decision.decisionType].label}
                  </Badge>
                ) : (
                  <Badge tone="accent" dot>
                    Awaiting decision
                  </Badge>
                )}
                <span className="text-[12.5px] text-ink-3">
                  Updated <RelativeTime iso={report.updatedAt} />
                </span>
              </div>
              <h2 className="mt-4 font-serif text-[22px] leading-snug font-medium text-ink group-hover:underline group-hover:decoration-line-strong group-hover:decoration-1 group-hover:underline-offset-4">
                {report.title}
              </h2>
              {latest && <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-ink-2">{latest.summary}</p>}
              <dl className="mt-auto flex flex-wrap gap-x-5 gap-y-1 pt-5 text-[12.5px] text-ink-3">
                <div>
                  <dt className="sr-only">Versions</dt>
                  <dd>
                    <span className="tnum font-medium text-ink-2">v{report.currentVersion}</span> · {versions.length} {versions.length === 1 ? "version" : "versions"}
                  </dd>
                </div>
                {latest && (
                  <>
                    <div>
                      <dt className="sr-only">Citations</dt>
                      <dd>
                        <span className="tnum font-medium text-ink-2">{allCitations(latest).length}</span> citations
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Conflicts</dt>
                      <dd>
                        <span className={latest.contradictions.length ? "tnum font-medium text-st-control" : "tnum font-medium text-ink-2"}>{latest.contradictions.length}</span> conflicts
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
