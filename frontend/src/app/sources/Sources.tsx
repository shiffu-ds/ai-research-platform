"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronRight, ExternalLink, Search } from "lucide-react";
import { useQuery } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { qk, useWorkspace } from "@/hooks/useWorkspace";
import { authorityScore, AUTHORITY_WEIGHTS } from "@/lib/scoring";
import type { SourceRecord, SourceType } from "@/types/platform.types";
import { hostname, shortHash } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input, Segmented } from "@/components/ui/Field";
import { Badge, type Tone } from "@/components/ui/Badge";
import { CopyButton, Skeleton } from "@/components/ui/misc";
import { LocalTime, DATE_SHORT, DATE_YEAR } from "@/components/ui/Time";
import { EmptyState, ErrorState } from "@/components/ui/states";

const TYPE_META: Record<SourceType, { label: string; tone: Tone }> = {
  academic: { label: "Academic", tone: "validation" },
  government: { label: "Government", tone: "intake" },
  industry: { label: "Industry", tone: "process" },
  web: { label: "Web", tone: "neutral" },
  internal: { label: "Internal", tone: "control" },
};

type Sort = "authority" | "cited" | "recent";

function Factor({ label, value, weight }: { label: string; value: number; weight: number }) {
  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[12.5px]">
      <span className="text-ink-2">{label}</span>
      <span className="h-1.5 rounded-full bg-sunken">
        <span className="block h-full rounded-full bg-ink" style={{ width: `${value * 100}%` }} />
      </span>
      <span className="tnum w-[120px] text-right text-ink-3">
        {value.toFixed(2)} × {weight} = <span className="font-medium text-ink">{(value * weight).toFixed(3)}</span>
      </span>
    </div>
  );
}

export function Sources() {
  const { projectId, project } = useWorkspace();
  const q = useQuery(projectId ? qk.sources(projectId) : null, () => api.getSources(projectId));
  const [type, setType] = useState<SourceType | "all">("all");
  const [sort, setSort] = useState<Sort>("authority");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = (q.data ?? [])
      .map((s) => ({ ...s, score: authorityScore(s.authorityLevel, s.freshness, s.publisherReputation) }))
      .filter((s) => (type === "all" ? true : s.sourceType === type))
      .filter((s) => `${s.title} ${s.publisher} ${s.url}`.toLowerCase().includes(query.trim().toLowerCase()));
    return list.sort((a, b) => (sort === "authority" ? b.score - a.score : sort === "cited" ? b.citedIn - a.citedIn : b.retrievedAt.localeCompare(a.retrievedAt)));
  }, [q.data, type, sort, query]);

  const all = q.data ?? [];
  const avg = all.length ? all.reduce((n, s) => n + authorityScore(s.authorityLevel, s.freshness, s.publisherReputation), 0) / all.length : 0;
  const uncited = all.filter((s) => s.citedIn === 0).length;
  const types = Array.from(new Set(all.map((s) => s.sourceType)));

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        eyebrow={project?.name}
        title="Sources"
        description="Everything the runs in this project have read. Each source is versioned and snapshotted, so a citation always points at exactly what was read — even if the page changes later."
      />

      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : !q.data ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : all.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong">
          <EmptyState drawing="magnifier" title="No sources yet">
            Sources are collected during discovery. Start a run and they&apos;ll show up here.
          </EmptyState>
        </div>
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-sm">
            {[
              ["Sources", String(all.length)],
              ["Average authority", avg.toFixed(2)],
              ["Not yet cited", String(uncited)],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface px-5 py-3.5">
                <dt className="text-[12px] text-ink-3">{k}</dt>
                <dd className="mt-0.5 text-[22px] font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Segmented
              label="Source type"
              value={type}
              onChange={setType}
              options={[{ value: "all", label: "All" }, ...types.map((t) => ({ value: t, label: TYPE_META[t].label }))]}
            />
            <div className="flex items-center gap-2">
              <Segmented
                label="Sort sources"
                size="sm"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "authority", label: "Authority" },
                  { value: "cited", label: "Most cited" },
                  { value: "recent", label: "Recent" },
                ]}
              />
              <div className="relative w-56">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title, publisher, URL" className="pl-8" aria-label="Search sources" />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            <table className="w-full text-[13.5px]">
              <thead className="hidden border-b border-line bg-paper/50 text-left text-[12px] text-ink-3 md:table-header-group">
                <tr>
                  <th className="py-2.5 pr-3 pl-5 font-medium">Source</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Authority</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cited</th>
                  <th className="py-2.5 pr-5 pl-3 text-right font-medium">Retrieved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((s: SourceRecord & { score: number }) => {
                  const expanded = open === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr className={cn("cursor-pointer transition-colors hover:bg-paper/60", expanded && "bg-paper/60")} onClick={() => setOpen(expanded ? null : s.id)}>
                        <td className="py-3 pr-3 pl-5">
                          <button
                            type="button"
                            className="flex items-start gap-2 text-left"
                            aria-expanded={expanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpen(expanded ? null : s.id);
                            }}
                          >
                            <ChevronRight className={cn("mt-1 h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform", expanded && "rotate-90")} />
                            <span>
                              <span className="line-clamp-1 font-medium text-ink">{s.title}</span>
                              <span className="block text-[12.5px] text-ink-3">{s.publisher}</span>
                            </span>
                          </button>
                        </td>
                        <td className="hidden px-3 py-3 md:table-cell">
                          <Badge tone={TYPE_META[s.sourceType].tone}>{TYPE_META[s.sourceType].label}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-16 rounded-full bg-sunken" aria-hidden>
                              <span className="block h-full rounded-full bg-st-intake" style={{ width: `${s.score * 100}%` }} />
                            </span>
                            <span className="tnum text-ink">{s.score.toFixed(2)}</span>
                          </div>
                        </td>
                        <td className={cn("tnum hidden px-3 py-3 text-right md:table-cell", s.citedIn ? "text-ink" : "text-ink-3")}>{s.citedIn}</td>
                        <td className="hidden py-3 pr-5 pl-3 text-right text-[12.5px] text-ink-3 md:table-cell">
                          <LocalTime iso={s.retrievedAt} options={DATE_SHORT} />
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-paper/60">
                          <td colSpan={5} className="px-5 pt-1 pb-5">
                            <div className="grid gap-6 pl-5 md:grid-cols-[minmax(0,1fr)_280px]">
                              <div className="space-y-2.5">
                                <p className="text-[12px] font-medium text-ink-3">Why it scores {s.score.toFixed(2)}</p>
                                <Factor label="Authority level" value={s.authorityLevel} weight={AUTHORITY_WEIGHTS.authority} />
                                <Factor label="Freshness" value={s.freshness} weight={AUTHORITY_WEIGHTS.freshness} />
                                <Factor label="Publisher reputation" value={s.publisherReputation} weight={AUTHORITY_WEIGHTS.reputation} />
                                <p className="pt-1 text-[12px] text-ink-3">
                                  Freshness was measured when the source was retrieved; it halves every 30 days after publication. Government, academic and well-known institutional domains start with higher authority.
                                </p>
                              </div>
                              <dl className="space-y-2 text-[12.5px]">
                                <div className="flex justify-between gap-3">
                                  <dt className="text-ink-3">Published</dt>
                                  <dd className="text-ink"><LocalTime iso={s.publishedAt} options={DATE_YEAR} /></dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <dt className="text-ink-3">Versions kept</dt>
                                  <dd className="tnum text-ink">{s.versions}</dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <dt className="text-ink-3">Chunks indexed</dt>
                                  <dd className="tnum text-ink">{s.chunks}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <dt className="text-ink-3">Snapshot</dt>
                                  <dd className="flex items-center font-mono text-[11.5px] text-ink-2">
                                    {shortHash(s.snapshotHash, 8, 4)}
                                    <CopyButton value={s.snapshotHash} label="" />
                                  </dd>
                                </div>
                                <a href={s.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 pt-1 text-ink-2 hover:text-ink hover:underline">
                                  {hostname(s.url)} <ExternalLink className="h-3 w-3" />
                                </a>
                              </dl>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && <p className="px-5 py-10 text-center text-[13.5px] text-ink-3">No sources match.</p>}
          </div>
        </>
      )}
    </div>
  );
}
