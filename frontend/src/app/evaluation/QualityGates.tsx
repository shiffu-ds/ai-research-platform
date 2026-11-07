"use client";

/**
 * Release gates from agents/evaluation/config.py (M1) and
 * rag/evaluation/m2_thresholds.json (M2). A regression below any
 * threshold blocks promotion to staging.
 */

import { Check, X } from "lucide-react";
import { useQuery } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { qk } from "@/hooks/useWorkspace";
import type { QualityGate } from "@/types/platform.types";
import { CONTRADICTION_META, type ContradictionType } from "@/types/report.types";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/misc";
import { LocalTime, DATE_TIME } from "@/components/ui/Time";
import { ErrorState } from "@/components/ui/states";
import { Sparkline } from "@/components/charts/charts";

const passes = (g: QualityGate) => (g.direction === "min" ? g.measured >= g.threshold : g.measured <= g.threshold);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** How close to the line: positive = headroom. */
function margin(g: QualityGate) {
  return g.direction === "min" ? g.measured - g.threshold : g.threshold - g.measured;
}

function GateRow({ g }: { g: QualityGate }) {
  const ok = passes(g);
  const m = margin(g);
  const tight = ok && m < 0.005;
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_110px_120px_100px]">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
          {ok ? <Check className="h-3.5 w-3.5 text-st-success" aria-label="Passing" /> : <X className="h-3.5 w-3.5 text-st-failure" aria-label="Failing" />}
          {g.label}
        </p>
        <p className="pl-5.5 text-[12px] text-ink-3">
          {g.direction === "min" ? "at least" : "at most"} {pct(g.threshold)} · owned by {g.owner}
        </p>
      </div>
      <p className={cn("tnum text-right text-[15px] font-semibold", ok ? "text-ink" : "text-st-failure")}>{pct(g.measured)}</p>
      <p className={cn("tnum hidden text-right text-[12.5px] sm:block", !ok ? "text-st-failure" : tight ? "text-st-process" : "text-ink-3")}>
        {m >= 0 ? "+" : "−"}
        {(Math.abs(m) * 100).toFixed(1)} pts {ok ? (tight ? "· tight" : "headroom") : "short"}
      </p>
      <div className="hidden justify-end sm:flex">
        <Sparkline values={g.history} reference={g.threshold} label={`${g.label}: last ${g.history.length} measurements against the threshold`} width={88} height={26} />
      </div>
    </li>
  );
}

export function QualityGates() {
  const q = useQuery(qk.gates, api.getQualityGates);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const d = q.data;
  const failing = d ? d.gates.filter((g) => !passes(g)) : [];
  const groups = d ? Array.from(new Set(d.gates.map((g) => g.group))) : [];

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader
        title="Quality gates"
        description="The bar every release has to clear, measured against the golden dataset. If any number falls on the wrong side of its line, promotion to staging is blocked."
      />

      {!d ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="space-y-6">
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4",
              failing.length ? "border-st-failure/30 bg-st-failure-soft" : "border-st-success/30 bg-st-success-soft"
            )}
          >
            <div>
              <p className={cn("text-[15px] font-semibold", failing.length ? "text-st-failure" : "text-st-success")}>
                {failing.length ? `Blocked — ${failing.length} of ${d.gates.length} gates failing` : `Clear — all ${d.gates.length} gates passing`}
              </p>
              <p className="text-[13px] text-ink-2">
                {failing.length ? `Fix ${failing.map((g) => `${g.group.toLowerCase()} ${g.label.toLowerCase()}`).join(", ")} before the next release.` : "Nothing is holding up a release."}
              </p>
            </div>
            <p className="text-[12.5px] text-ink-3">
              Measured <LocalTime iso={d.measuredAt} options={DATE_TIME} />
            </p>
          </div>

          <div className="space-y-6">
            {groups.map((group) => {
              const gates = d.gates.filter((g) => g.group === group);
              const bad = gates.filter((g) => !passes(g)).length;
              return (
                <Panel key={group}>
                  <PanelHeader title={group} actions={bad ? <Badge tone="failure">{bad} failing</Badge> : <Badge tone="success">Passing</Badge>} />
                  <ul className="divide-y divide-line">
                    {gates.map((g) => (
                      <GateRow key={g.key} g={g} />
                    ))}
                  </ul>
                </Panel>
              );
            })}
          </div>

          <Panel>
            <PanelHeader title="Golden dataset" description="The questions every build is scored against, with the evidence and conflicts a correct run must find." />
            <ul className="divide-y divide-line">
              {d.samples.map((s) => (
                <li key={s.id} className="px-5 py-3.5">
                  <p className="font-serif text-[16px] leading-snug text-ink">{s.question}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
                    <span className="font-mono">{s.id}</span>
                    <span>
                      {s.expectedClaims} claims · {s.expectedCitations} citations
                    </span>
                    {s.expectedContradictions.length ? (
                      s.expectedContradictions.map((c) => (
                        <Badge key={c} tone="control">
                          {CONTRADICTION_META[c as ContradictionType]?.label ?? c}
                        </Badge>
                      ))
                    ) : (
                      <span>no conflicts expected</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
