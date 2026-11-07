import type { Citation, HumanDecision, ReportVersion } from "@/types/report.types";

export function allCitations(version: ReportVersion): Citation[] {
  return version.sections
    .flatMap((s) => s.claims.flatMap((c) => c.citations))
    .sort((a, b) => a.citationNumber - b.citationNumber);
}

export function claimCount(version: ReportVersion): number {
  return version.sections.reduce((n, s) => n + s.claims.length, 0);
}

/** Latest decision recorded against a specific version (decisions are append-only). */
export function latestDecisionFor(versionId: string, decisions: HumanDecision[]): HumanDecision | undefined {
  return [...decisions].filter((d) => d.reportVersionId === versionId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "claim"; text: string; citation: number }
  | { kind: "cite"; citation: number };

/**
 * Splits section prose into plain text, cited claims and citation marks.
 * A claim is the sentence (or clause) immediately before a [n] marker.
 */
export function segmentProse(content: string): Segment[] {
  const parts = content.split(/(\[\d+\])/);
  const out: Segment[] = [];
  for (const part of parts) {
    const m = part.match(/^\[(\d+)\]$/);
    if (!m) {
      if (part) out.push({ kind: "text", text: part });
      continue;
    }
    const n = Number(m[1]);
    const prev = out[out.length - 1];
    if (prev && prev.kind === "text") {
      // Split the trailing sentence off the preceding text.
      const idx = Math.max(prev.text.lastIndexOf(". "), prev.text.lastIndexOf("? "), prev.text.lastIndexOf("! "));
      const lead = idx >= 0 ? prev.text.slice(0, idx + 2) : "";
      // The space before a superscript mark is dropped, as in print.
      const claim = (idx >= 0 ? prev.text.slice(idx + 2) : prev.text).replace(/\s+$/, "");
      out.pop();
      if (lead) out.push({ kind: "text", text: lead });
      out.push({ kind: "claim", text: claim, citation: n });
    }
    out.push({ kind: "cite", citation: n });
  }
  return out;
}
