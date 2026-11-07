"use client";

/**
 * What sits behind one citation: the verbatim excerpt, where it came
 * from, the full provenance chain down to the stored snapshot, and a hash
 * check computed in this browser — with a way to see it fail.
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, ShieldCheck, ShieldAlert, FlaskConical, Undo2 } from "lucide-react";
import type { Citation, ReportSection, ReportVersion } from "@/types/report.types";
import { verifyEvidenceHash } from "@/lib/crypto";
import { formatPercent, hostname, shortHash } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Sheet } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/misc";
import { LocalTime, DATE_TIME } from "@/components/ui/Time";
import { Textarea } from "@/components/ui/Field";

type Check = { status: "checking" } | { status: "done"; match: boolean; computed: string };

function useHashCheck(excerpt: string, locator: string, expected: string) {
  const [result, setResult] = useState<Check>({ status: "checking" });
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      verifyEvidenceHash(excerpt, locator, expected)
        .then((r) => alive && setResult({ status: "done", match: r.match, computed: r.computedHash }))
        .catch(() => alive && setResult({ status: "done", match: false, computed: "" }));
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [excerpt, locator, expected]);
  return result;
}

function Chain({ citation, section, version }: { citation: Citation; section?: ReportSection; version: ReportVersion }) {
  const steps: { label: string; id: string; note?: string }[] = [
    { label: "Report version", id: `v${version.versionNumber}`, note: version.title },
    { label: "Section", id: section?.id ?? "—", note: section?.title },
    { label: "Claim", id: citation.claimId },
    { label: "Evidence", id: citation.evidenceId, note: "Verbatim excerpt + locator, hashed" },
    { label: "Document chunk", id: citation.documentChunkId, note: "≤ 800 tokens, 120 overlap" },
    { label: "Document version", id: citation.documentVersionId, note: citation.ocrConfidence ? `OCR confidence ${formatPercent(citation.ocrConfidence)}` : undefined },
    { label: "Source version", id: citation.sourceVersionId, note: hostname(citation.sourceUrl) },
    { label: "Stored snapshot", id: "immutable", note: "Original bytes kept in object storage" },
  ];
  return (
    <ol className="relative ml-1.5">
      {steps.map((s, i) => (
        <li key={s.label} className="relative pb-3.5 pl-6 last:pb-0">
          {i < steps.length - 1 && <span className="absolute top-3 bottom-0 left-[3.5px] w-px bg-line-strong" aria-hidden />}
          <span className={cn("absolute top-1.5 left-0 h-2 w-2 rounded-full border-2", i === 3 ? "border-accent bg-accent" : "border-ink-3 bg-surface")} aria-hidden />
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn("text-[13px]", i === 3 ? "font-semibold text-ink" : "text-ink-2")}>{s.label}</span>
            <code className="truncate font-mono text-[11.5px] text-ink-3">{s.id}</code>
          </div>
          {s.note && <p className="truncate text-[12px] text-ink-3">{s.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export function EvidencePanel({
  citation,
  version,
  onClose,
  onStep,
  total,
}: {
  citation: Citation | null;
  version: ReportVersion;
  onClose: () => void;
  onStep: (dir: 1 | -1) => void;
  total: number;
}) {
  const [tampering, setTampering] = useState(false);
  const [edited, setEdited] = useState("");
  const [forId, setForId] = useState<string | null>(null);

  // Reset the experiment when the citation changes (derived during render, no effect needed).
  if (citation && citation.id !== forId) {
    setForId(citation.id);
    setTampering(false);
    setEdited(citation.excerpt);
  }

  const excerpt = tampering ? edited : citation?.excerpt ?? "";
  const check = useHashCheck(excerpt, citation?.locator ?? "", citation?.evidenceHash ?? "");
  const section = citation ? version.sections.find((s) => s.claims.some((c) => c.id === citation.claimId)) : undefined;

  return (
    <Sheet
      open={citation !== null}
      onClose={onClose}
      width="lg"
      title={citation ? `Citation ${citation.citationNumber}` : ""}
      description={section?.title}
      headerExtra={
        <div className="mr-1 flex items-center">
          <button type="button" onClick={() => onStep(-1)} className="rounded-md p-1.5 text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Previous citation (k)" title="Previous (k)">
            <ChevronUp className="h-4 w-4" />
          </button>
          <span className="tnum px-1 text-[12px] text-ink-3">
            {citation?.citationNumber}/{total}
          </span>
          <button type="button" onClick={() => onStep(1)} className="rounded-md p-1.5 text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Next citation (j)" title="Next (j)">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      }
    >
      {citation && (
        <div className="space-y-7 px-5 py-5">
          {/* Excerpt */}
          <section>
            <p className="mb-2 text-[12px] font-medium text-ink-3">The evidence, word for word</p>
            {tampering ? (
              <Textarea
                value={edited}
                onChange={(e) => setEdited(e.target.value)}
                rows={4}
                className="font-serif text-[16px]"
                aria-label="Edit the excerpt to see the hash check fail"
                autoFocus
              />
            ) : (
              <blockquote className="border-l-[3px] border-mark-strong pl-4 font-serif text-[18px] leading-relaxed text-ink">
                <span className="marker" data-on="true">
                  {citation.excerpt}
                </span>
              </blockquote>
            )}
            <p className="mt-2 text-[12.5px] text-ink-3">{citation.locator}</p>
          </section>

          {/* Source */}
          <section className="rounded-lg border border-line p-4">
            <p className="text-[12px] font-medium text-ink-3">Source</p>
            <a href={citation.sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-1 flex items-start gap-1.5 text-[14px] font-medium text-ink hover:underline">
              {citation.sourceTitle}
              <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-ink-3" />
            </a>
            <p className="text-[12.5px] text-ink-3">{hostname(citation.sourceUrl)}</p>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-[12.5px]">
              <div>
                <dt className="text-ink-3">Retrieved</dt>
                <dd className="text-ink">
                  <LocalTime iso={citation.retrievedAt} options={DATE_TIME} />
                </dd>
              </div>
              <div>
                <dt className="text-ink-3">Retrieval score</dt>
                <dd className="tnum text-ink">{citation.retrievalScore?.toFixed(2) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-3">OCR confidence</dt>
                <dd className="tnum text-ink">{citation.ocrConfidence ? formatPercent(citation.ocrConfidence) : "—"}</dd>
              </div>
            </dl>
          </section>

          {/* Integrity */}
          <section>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium text-ink-3">Integrity</p>
              {tampering ? (
                <Button size="sm" variant="ghost" icon={<Undo2 className="h-3.5 w-3.5" />} onClick={() => setTampering(false)}>
                  Put it back
                </Button>
              ) : (
                <Button size="sm" variant="ghost" icon={<FlaskConical className="h-3.5 w-3.5" />} onClick={() => setTampering(true)}>
                  Try changing a word
                </Button>
              )}
            </div>
            <div
              className={cn(
                "mt-2 rounded-lg border p-4 transition-colors",
                check.status === "checking" ? "border-line" : check.match ? "border-st-success/30 bg-st-success-soft" : "border-st-failure/30 bg-st-failure-soft"
              )}
              aria-live="polite"
            >
              <div className="flex items-center gap-2">
                {check.status === "done" && check.match ? (
                  <ShieldCheck className="h-4.5 w-4.5 text-st-success" />
                ) : check.status === "done" ? (
                  <ShieldAlert className="h-4.5 w-4.5 text-st-failure" />
                ) : (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
                )}
                <p className="text-[13.5px] font-medium text-ink">
                  {check.status === "checking"
                    ? "Checking in your browser…"
                    : check.match
                      ? "Matches the stored hash"
                      : tampering
                        ? "Doesn't match — this is what tampering looks like"
                        : "Doesn't match the stored hash"}
                </p>
              </div>
              <p className="mt-1 text-[12.5px] text-ink-2">
                SHA-256 of the excerpt and locator, computed here with Web Crypto. Nothing is sent anywhere.
              </p>
              <dl className="mt-3 space-y-1.5 font-mono text-[11.5px]">
                <div className="flex items-center gap-2">
                  <dt className="w-16 shrink-0 font-sans text-ink-3">Stored</dt>
                  <dd className="truncate text-ink-2" title={citation.evidenceHash}>
                    {shortHash(citation.evidenceHash, 20, 8)}
                  </dd>
                  <CopyButton value={citation.evidenceHash} label="" />
                </div>
                <div className="flex items-center gap-2">
                  <dt className="w-16 shrink-0 font-sans text-ink-3">Computed</dt>
                  <dd className={cn("truncate", check.status === "done" && !check.match ? "text-st-failure" : "text-ink-2")}>
                    {check.status === "done" ? shortHash(check.computed, 20, 8) : "…"}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Provenance */}
          <section>
            <p className="mb-3 text-[12px] font-medium text-ink-3">How this claim traces back</p>
            <Chain citation={citation} section={section} version={version} />
          </section>
        </div>
      )}
    </Sheet>
  );
}
