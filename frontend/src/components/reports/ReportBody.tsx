"use client";

/**
 * The reading view. Prose in a serif at a comfortable measure, citations
 * as superscripts, and the sources set in the margin beside the paragraph
 * that uses them — the way a careful printed report would do it.
 */

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Citation, Contradiction, ReportVersion } from "@/types/report.types";
import { CONTRADICTION_META } from "@/types/report.types";
import { cn } from "@/lib/utils/cn";
import { hostname } from "@/lib/utils/format";
import { segmentProse } from "./report-utils";

function Prose({
  content,
  citations,
  active,
  hovered,
  onHover,
  onOpen,
  conflictedNumbers,
}: {
  content: string;
  citations: Map<number, Citation>;
  active: number | null;
  hovered: number | null;
  onHover: (n: number | null) => void;
  onOpen: (n: number) => void;
  conflictedNumbers: Set<number>;
}) {
  const segments = segmentProse(content);
  return (
    <p>
      {segments.map((seg, i) => {
        if (seg.kind === "text") return <span key={i}>{seg.text}</span>;
        if (seg.kind === "claim") {
          const on = hovered === seg.citation || active === seg.citation;
          return (
            <span
              key={i}
              className={cn("marker", conflictedNumbers.has(seg.citation) && "underline decoration-st-control/50 decoration-dotted decoration-[1.5px] underline-offset-[5px]")}
              data-on={on}
            >
              {seg.text}
            </span>
          );
        }
        const c = citations.get(seg.citation);
        return (
          <sup key={i}>
            <button
              type="button"
              data-citation={seg.citation}
              onMouseEnter={() => onHover(seg.citation)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(seg.citation)}
              onBlur={() => onHover(null)}
              onClick={() => onOpen(seg.citation)}
              className={cn(
                "tnum rounded px-[2px] font-sans text-[11.5px] font-semibold transition-colors",
                active === seg.citation ? "bg-accent text-on-accent" : "text-accent hover:bg-accent-soft"
              )}
              aria-label={c ? `Citation ${seg.citation}: ${c.sourceTitle}` : `Citation ${seg.citation}`}
            >
              {seg.citation}
            </button>
          </sup>
        );
      })}
    </p>
  );
}

function useScrollSpy(ids: string[]) {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    if (ids.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setCurrent(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);
  return current ?? ids[0] ?? null;
}

export function ReportBody({
  version,
  activeCitation,
  onOpenCitation,
  onShowConflict,
}: {
  version: ReportVersion;
  activeCitation: number | null;
  onOpenCitation: (n: number) => void;
  onShowConflict: (c: Contradiction) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const sections = [...version.sections].sort((a, b) => a.order - b.order);
  const sectionIds = sections.map((s) => `section-${s.id}`);
  const current = useScrollSpy(sectionIds);
  const conflictsById = new Map(version.contradictions.map((c) => [c.id, c]));

  return (
    <div className="grid gap-10 xl:grid-cols-[180px_minmax(0,680px)_240px]">
      {/* Outline */}
      <nav aria-label="Sections" className="hidden xl:block">
        <div className="sticky top-24">
          <p className="mb-2 text-[12px] font-medium text-ink-3">In this report</p>
          <ol className="space-y-1 border-l border-line">
            {sections.map((s, i) => {
              const id = `section-${s.id}`;
              const on = current === id;
              return (
                <li key={s.id}>
                  <a
                    href={`#${id}`}
                    className={cn(
                      "-ml-px block border-l-2 py-1 pr-2 pl-3 text-[13px] leading-snug transition-colors",
                      on ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink-2"
                    )}
                  >
                    <span className="tnum mr-1.5 text-ink-3">{i + 1}</span>
                    {s.title}
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>

      {/* Article */}
      <article className="min-w-0">
        <p className="font-serif text-[20px] leading-relaxed text-ink-2 italic">{version.summary}</p>
        <hr className="my-8 w-16 border-t-2 border-ink" />

        {sections.map((s, i) => {
          const sectionCitations = new Map(s.claims.flatMap((c) => c.citations.map((ct) => [ct.citationNumber, ct] as const)));
          const conflicted = new Set(s.claims.filter((c) => c.hasContradiction).flatMap((c) => c.citations.map((ct) => ct.citationNumber)));
          const sectionConflicts = s.claims.flatMap((c) => c.contradictionIds ?? []).map((id) => conflictsById.get(id)).filter(Boolean) as Contradiction[];
          const notes = [...sectionCitations.values()].sort((a, b) => a.citationNumber - b.citationNumber);

          return (
            <section key={s.id} id={`section-${s.id}`} className="relative scroll-mt-24 pb-10">
              <h2 className="font-serif text-[24px] leading-snug font-medium text-ink">
                <span className="tnum mr-2 text-ink-3">{i + 1}.</span>
                {s.title}
              </h2>
              <div className="prose-report mt-3">
                <Prose
                  content={s.contentMarkdown}
                  citations={sectionCitations}
                  active={activeCitation}
                  hovered={hovered}
                  onHover={setHovered}
                  onOpen={onOpenCitation}
                  conflictedNumbers={conflicted}
                />
              </div>

              {sectionConflicts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {sectionConflicts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onShowConflict(c)}
                      className="flex w-full items-start gap-2.5 rounded-lg border border-st-control/25 bg-st-control-soft/60 px-3.5 py-2.5 text-left text-[13px] transition-colors hover:border-st-control/50"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-st-control" />
                      <span>
                        <span className="font-medium text-st-control">{CONTRADICTION_META[c.type].label}</span>
                        <span className="text-ink-2"> on {c.entity.toLowerCase()}. </span>
                        <span className="text-ink-3">{c.isDeterministic ? "Resolved by calculation" : "Explained by advisory review"} — see how</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Margin notes: beside the text on wide screens, under it otherwise */}
              {notes.length > 0 && (
                <aside className="mt-5 space-y-3 xl:absolute xl:top-12 xl:-right-[280px] xl:mt-0 xl:w-[240px]" aria-label={`Sources for section ${i + 1}`}>
                  {notes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onOpenCitation(c.citationNumber)}
                      onMouseEnter={() => setHovered(c.citationNumber)}
                      onMouseLeave={() => setHovered(null)}
                      className={cn(
                        "block w-full rounded-md border-l-2 py-1 pl-3 text-left transition-colors",
                        hovered === c.citationNumber || activeCitation === c.citationNumber ? "border-accent" : "border-line hover:border-line-strong"
                      )}
                    >
                      <span className="tnum text-[12px] font-semibold text-accent">{c.citationNumber}</span>
                      <span className="ml-1.5 text-[12.5px] leading-snug text-ink-2">{c.sourceTitle}</span>
                      <span className="mt-0.5 block text-[11.5px] text-ink-3">
                        {hostname(c.sourceUrl)} · {c.locator}
                      </span>
                    </button>
                  ))}
                </aside>
              )}
            </section>
          );
        })}

        <footer className="border-t border-line pt-5 text-[12.5px] text-ink-3">
          Every numbered claim links to a verbatim excerpt. Select a number to see the evidence and check its hash.
        </footer>
      </article>
      <div className="hidden xl:block" aria-hidden />
    </div>
  );
}
