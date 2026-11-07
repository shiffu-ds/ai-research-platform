"use client";

import { useState } from "react";
import { Calculator, MessageSquareQuote, ArrowUpRight } from "lucide-react";
import type { Contradiction, ReportVersion } from "@/types/report.types";
import { CONTRADICTION_META } from "@/types/report.types";
import { Segmented } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils/cn";

type Filter = "all" | "calc" | "advisory";

function Side({ label, claim, value, unit, period }: { label: string; claim: string; value?: string | number; unit?: string; period?: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg bg-paper/70 p-4">
      <p className="text-[12px] font-medium text-ink-3">{label}</p>
      {value !== undefined && (
        <p className="tnum mt-1 font-serif text-[26px] leading-none text-ink">
          {value}
          {unit && <span className="ml-1 text-[14px] text-ink-3">{unit}</span>}
        </p>
      )}
      <p className="mt-2 text-[13.5px] leading-snug text-ink-2">{claim}</p>
      {period && <p className="mt-2 text-[12px] text-ink-3">Period: {period}</p>}
    </div>
  );
}

export function ConflictCard({ c, sectionTitle, onJump, highlight }: { c: Contradiction; sectionTitle?: string; onJump?: () => void; highlight?: boolean }) {
  const meta = CONTRADICTION_META[c.type];
  return (
    <article id={`conflict-${c.id}`} className={cn("scroll-mt-24 rounded-xl border bg-surface p-5 shadow-sm transition-colors", highlight ? "border-st-control/60 ring-4 ring-st-control-soft" : "border-line")}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="control">{meta.label}</Badge>
            {c.isDeterministic ? (
              <span className="flex items-center gap-1 text-[12px] text-st-success">
                <Calculator className="h-3.5 w-3.5" /> Calculation service
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[12px] text-st-validation">
                <MessageSquareQuote className="h-3.5 w-3.5" /> Advisory review
              </span>
            )}
          </div>
          <h3 className="mt-2 text-[15px] font-semibold text-ink">{c.entity}</h3>
          {c.metric && <p className="text-[13px] text-ink-3">{c.metric}</p>}
        </div>
        {onJump && sectionTitle && (
          <button type="button" onClick={onJump} className="flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
            In “{sectionTitle}” <ArrowUpRight className="h-3 w-3" />
          </button>
        )}
      </header>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Side label="One source says" claim={c.claimA} value={c.valueA} unit={c.unitA && c.valueA !== undefined && !String(c.valueA).includes(c.unitA) ? c.unitA : undefined} period={c.timePeriodA} />
        <div className="hidden items-center text-[12px] font-medium text-ink-3 sm:flex">vs</div>
        <Side label="Another says" claim={c.claimB} value={c.valueB} unit={c.unitB && c.valueB !== undefined && !String(c.valueB).includes(c.unitB) ? c.unitB : undefined} period={c.timePeriodB} />
      </div>

      {c.resolution && (
        <div className="mt-4 border-t border-line pt-3.5">
          <p className="text-[12px] font-medium text-ink-3">What we concluded</p>
          <p className="mt-1 text-[14px] leading-relaxed text-ink">{c.resolution}</p>
        </div>
      )}
      <p className="mt-3 text-[12px] text-ink-3">{meta.hint}</p>
    </article>
  );
}

export function ConflictList({ version, onJumpToSection, highlightId }: { version: ReportVersion; onJumpToSection: (sectionId: string) => void; highlightId?: string | null }) {
  const [filter, setFilter] = useState<Filter>("all");
  const list = version.contradictions.filter((c) => (filter === "all" ? true : filter === "calc" ? c.isDeterministic : !c.isDeterministic));
  const calc = version.contradictions.filter((c) => c.isDeterministic).length;
  const sectionFor = (id: string) => version.sections.find((s) => s.claims.some((cl) => cl.contradictionIds?.includes(id)));

  if (version.contradictions.length === 0) {
    return (
      <EmptyState drawing="magnifier" title="No conflicts in this version">
        The sources agreed, or conflict detection was switched off for this run.
      </EmptyState>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] text-ink-2">
          {version.contradictions.length} places where sources disagree. {calc} were settled by calculation, {version.contradictions.length - calc} by advisory review.
        </p>
        <Segmented
          label="Filter conflicts"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "calc", label: "Calculated" },
            { value: "advisory", label: "Advisory" },
          ]}
        />
      </div>
      <div className="space-y-4">
        {list.map((c) => {
          const sec = sectionFor(c.id);
          return <ConflictCard key={c.id} c={c} sectionTitle={sec?.title} onJump={sec ? () => onJumpToSection(sec.id) : undefined} highlight={highlightId === c.id} />;
        })}
      </div>
    </div>
  );
}
