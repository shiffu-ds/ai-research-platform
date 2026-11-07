"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { ReportVersion } from "@/types/report.types";
import { CONTRADICTION_META } from "@/types/report.types";
import { diffSections, type DiffPart } from "@/lib/diff";
import { Select, Segmented } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils/cn";
import { allCitations, claimCount } from "./report-utils";

function Inline({ parts }: { parts: DiffPart[] }) {
  return (
    <p>
      {parts.map((p, i) =>
        p.op === "equal" ? (
          <span key={i}>{p.text}</span>
        ) : p.op === "insert" ? (
          <ins key={i} className="rounded-sm bg-st-success-soft text-st-success no-underline">
            {p.text}
          </ins>
        ) : (
          <del key={i} className="mr-1 rounded-sm bg-st-failure-soft text-st-failure decoration-st-failure/60">
            {p.text}
          </del>
        )
      )}
    </p>
  );
}

function SideBySide({ parts }: { parts: DiffPart[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <p className="rounded-lg bg-paper/70 p-3">
        {parts.filter((p) => p.op !== "insert").map((p, i) =>
          p.op === "delete" ? (
            <del key={i} className="rounded-sm bg-st-failure-soft text-st-failure">
              {p.text}
            </del>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </p>
      <p className="rounded-lg bg-paper/70 p-3">
        {parts.filter((p) => p.op !== "delete").map((p, i) =>
          p.op === "insert" ? (
            <ins key={i} className="rounded-sm bg-st-success-soft text-st-success no-underline">
              {p.text}
            </ins>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </p>
    </div>
  );
}

function Delta({ label, before, after }: { label: string; before: number; after: number }) {
  const d = after - before;
  return (
    <div className="px-4 py-3">
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className="tnum mt-0.5 flex items-baseline gap-1.5 font-serif text-[22px] leading-none text-ink">
        {before}
        <ArrowRight className="h-3.5 w-3.5 self-center text-ink-3" />
        {after}
        {d !== 0 && <span className={cn("font-sans text-[12.5px] font-medium", d > 0 ? "text-st-success" : "text-st-failure")}>{d > 0 ? `+${d}` : d}</span>}
      </p>
    </div>
  );
}

export function VersionCompare({ versions, initialTarget }: { versions: ReportVersion[]; initialTarget: string }) {
  const sorted = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  const targetDefault = sorted.find((v) => v.id === initialTarget) ?? sorted[sorted.length - 1];
  const baseDefault = sorted[sorted.indexOf(targetDefault) - 1] ?? sorted[0];
  const [baseId, setBaseId] = useState(baseDefault.id);
  const [targetId, setTargetId] = useState(targetDefault.id);
  const [mode, setMode] = useState<"inline" | "split">("inline");
  const [hideUnchanged, setHideUnchanged] = useState(true);

  const base = sorted.find((v) => v.id === baseId)!;
  const target = sorted.find((v) => v.id === targetId)!;
  const diffs = diffSections(base.sections, target.sections);

  const conflictKey = (c: { entity: string; type: string }) => `${c.type}:${c.entity.toLowerCase()}`;
  const baseKeys = new Set(base.contradictions.map(conflictKey));
  const targetKeys = new Set(target.contradictions.map(conflictKey));
  const newConflicts = target.contradictions.filter((c) => !baseKeys.has(conflictKey(c)));
  const goneConflicts = base.contradictions.filter((c) => !targetKeys.has(conflictKey(c)));
  const changedResolution = target.contradictions.filter((c) => {
    const prev = base.contradictions.find((b) => conflictKey(b) === conflictKey(c));
    return prev && prev.resolution !== c.resolution;
  });

  if (sorted.length < 2) {
    return (
      <EmptyState drawing="notebook" title="Only one version so far">
        When a run is repeated or a report is revised, the new version lands here and you can compare it word by word.
      </EmptyState>
    );
  }

  const visibleDiffs = hideUnchanged ? diffs.filter((d) => d.change !== "unchanged") : diffs;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-[12px] text-ink-3">From</span>
          <Select value={baseId} onChange={(e) => setBaseId(e.target.value)} className="w-44">
            {sorted.map((v) => (
              <option key={v.id} value={v.id} disabled={v.id === targetId}>
                Version {v.versionNumber}
              </option>
            ))}
          </Select>
        </label>
        <ArrowRight className="mb-2.5 h-4 w-4 text-ink-3" />
        <label className="space-y-1">
          <span className="block text-[12px] text-ink-3">To</span>
          <Select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-44">
            {sorted.map((v) => (
              <option key={v.id} value={v.id} disabled={v.id === baseId}>
                Version {v.versionNumber}
              </option>
            ))}
          </Select>
        </label>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <input type="checkbox" checked={hideUnchanged} onChange={(e) => setHideUnchanged(e.target.checked)} className="accent-[var(--ink)]" />
            Hide unchanged
          </label>
          <Segmented label="Diff layout" size="sm" value={mode} onChange={setMode} options={[{ value: "inline", label: "Inline" }, { value: "split", label: "Side by side" }]} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 divide-x divide-line rounded-xl border border-line bg-surface shadow-sm sm:grid-cols-4">
        <Delta label="Sections" before={base.sections.length} after={target.sections.length} />
        <Delta label="Claims" before={claimCount(base)} after={claimCount(target)} />
        <Delta label="Citations" before={allCitations(base).length} after={allCitations(target).length} />
        <Delta label="Conflicts" before={base.contradictions.length} after={target.contradictions.length} />
      </div>

      {(newConflicts.length > 0 || goneConflicts.length > 0 || changedResolution.length > 0) && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-[13.5px] shadow-sm">
          <p className="font-medium text-ink">Conflicts</p>
          <ul className="mt-2 space-y-1.5 text-ink-2">
            {newConflicts.map((c) => (
              <li key={`n-${c.id}`} className="flex items-baseline gap-2">
                <Badge tone="success">new</Badge>
                {CONTRADICTION_META[c.type].label} — {c.entity}
              </li>
            ))}
            {goneConflicts.map((c) => (
              <li key={`g-${c.id}`} className="flex items-baseline gap-2">
                <Badge tone="failure">gone</Badge>
                {CONTRADICTION_META[c.type].label} — {c.entity}
              </li>
            ))}
            {changedResolution.map((c) => (
              <li key={`r-${c.id}`} className="flex items-baseline gap-2">
                <Badge tone="validation">re-resolved</Badge>
                {c.entity}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 space-y-5">
        {visibleDiffs.length === 0 && <p className="py-8 text-center text-[13.5px] text-ink-3">The text is identical between these versions.</p>}
        {visibleDiffs.map((d) => (
          <section key={d.key} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-[18px] text-ink">{d.title}</h3>
              <div className="flex items-center gap-2 text-[12px]">
                {d.change === "added" && <Badge tone="success">New section</Badge>}
                {d.change === "removed" && <Badge tone="failure">Removed</Badge>}
                {d.change === "unchanged" && <Badge>Unchanged</Badge>}
                {d.change === "changed" && (
                  <span className="tnum text-ink-3">
                    <span className="text-st-success">+{d.stats.added}</span> / <span className="text-st-failure">−{d.stats.removed}</span> words
                  </span>
                )}
              </div>
            </header>
            <div className="font-serif text-[16px] leading-relaxed text-ink">{mode === "inline" ? <Inline parts={d.parts} /> : <SideBySide parts={d.parts} />}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
