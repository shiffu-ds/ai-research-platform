"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpDown, Plus } from "lucide-react";
import type { ResearchRun } from "@/types/research.types";
import { isRunActive, STATE_LABEL } from "@/types/research.types";
import { cn } from "@/lib/utils/cn";
import { Input, Segmented } from "@/components/ui/Field";
import { Avatar, ProgressBar } from "@/components/ui/misc";
import { RelativeTime } from "@/components/ui/Time";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/Button";
import { RunStatus } from "./RunStatus";

type Filter = "all" | "active" | "done" | "attention";
type Sort = "newest" | "oldest" | "conflicts";

export function RunsTable({ runs, compact, canCreate }: { runs: ResearchRun[]; compact?: boolean; canCreate?: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const counts = useMemo(
    () => ({
      all: runs.length,
      active: runs.filter((r) => isRunActive(r.state)).length,
      done: runs.filter((r) => r.state === "COMPLETED").length,
      attention: runs.filter((r) => r.state === "FAILED" || r.state === "CANCELLED").length,
    }),
    [runs]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = runs.filter((r) => {
      if (filter === "active" && !isRunActive(r.state)) return false;
      if (filter === "done" && r.state !== "COMPLETED") return false;
      if (filter === "attention" && !(r.state === "FAILED" || r.state === "CANCELLED")) return false;
      if (!q) return true;
      return `${r.questionText} ${r.creatorName} ${r.id} ${STATE_LABEL[r.state]}`.toLowerCase().includes(q);
    });
    return [...list].sort((a, b) =>
      sort === "conflicts" ? b.contradictionCount - a.contradictionCount : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)
    );
  }, [runs, filter, query, sort]);

  return (
    <div>
      {!compact && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            label="Filter runs"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All ${counts.all}` },
              { value: "active", label: `Running ${counts.active}` },
              { value: "done", label: `Finished ${counts.done}` },
              { value: "attention", label: `Stopped ${counts.attention}` },
            ]}
          />
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions, people…" className="pl-8" aria-label="Search runs" />
            </div>
            <button
              type="button"
              onClick={() => setSort(sort === "newest" ? "oldest" : sort === "oldest" ? "conflicts" : "newest")}
              className="flex h-8.5 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[13px] text-ink-2 shadow-sm hover:border-line-strong"
              aria-label={`Sort: ${sort}`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sort === "newest" ? "Newest" : sort === "oldest" ? "Oldest" : "Most conflicts"}
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface/50">
          <EmptyState
            title={runs.length === 0 ? "No research yet" : "No runs match"}
            drawing={runs.length === 0 ? "notebook" : "magnifier"}
            action={
              runs.length === 0 && canCreate ? (
                <ButtonLink href="/research/new" variant="primary" icon={<Plus className="h-3.5 w-3.5" />}>
                  Ask the first question
                </ButtonLink>
              ) : undefined
            }
          >
            {runs.length === 0 ? "Start with a question you'd normally spend an afternoon on." : "Try a different filter or fewer words."}
          </EmptyState>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          <table className="w-full text-left text-[13.5px]">
            <thead className="hidden border-b border-line bg-paper/50 text-[12px] text-ink-3 md:table-header-group">
              <tr>
                <th className="py-2.5 pr-3 pl-5 font-medium">Question</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                {!compact && <th className="px-3 py-2.5 text-right font-medium">Sources</th>}
                {!compact && <th className="px-3 py-2.5 text-right font-medium">Conflicts</th>}
                <th className="py-2.5 pr-5 pl-3 text-right font-medium">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((r) => {
                const active = isRunActive(r.state);
                return (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/research/${r.id}`)}
                    className="group cursor-pointer transition-colors hover:bg-paper/70"
                  >
                    <td className="py-3.5 pr-3 pl-5 align-top">
                      <a
                        href={`/research/${r.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(`/research/${r.id}`);
                        }}
                        className="line-clamp-2 font-medium text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-2"
                      >
                        {r.questionText}
                      </a>
                      <div className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-3">
                        <Avatar name={r.creatorName} size={16} />
                        {r.creatorName}
                        <span className="md:hidden">
                          · <RunStatus state={r.state} className="ml-1" />
                        </span>
                      </div>
                    </td>
                    <td className="hidden w-[170px] px-3 py-3.5 align-top md:table-cell">
                      <RunStatus state={r.state} />
                      {active && <ProgressBar value={r.progressPercent} className="mt-2 w-28" label="Progress" />}
                    </td>
                    {!compact && <td className="tnum hidden px-3 py-3.5 text-right align-top text-ink-2 md:table-cell">{r.sourceCount}</td>}
                    {!compact && (
                      <td className={cn("tnum hidden px-3 py-3.5 text-right align-top md:table-cell", r.contradictionCount ? "text-st-control" : "text-ink-3")}>
                        {r.contradictionCount}
                      </td>
                    )}
                    <td className="w-[110px] py-3.5 pr-5 pl-3 text-right align-top text-[12.5px] text-ink-3">
                      <RelativeTime iso={r.startedAt ?? r.createdAt} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
