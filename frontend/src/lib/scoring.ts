/**
 * Client copies of small, deterministic formulas defined elsewhere in the
 * repo, so the UI can explain numbers instead of just showing them.
 *
 * - authorityScore / freshnessScore → rag/src/rag_m2/sources/scoring.py
 * - estimateRunCost                 → model registry in agents/routing/configs.py
 */

import type { ModelConfig } from "@/types/platform.types";

export const AUTHORITY_WEIGHTS = { authority: 0.5, freshness: 0.3, reputation: 0.2 } as const;

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** 0.5 * authority_level + 0.3 * freshness + 0.2 * publisher_reputation */
export function authorityScore(authorityLevel: number, freshness: number, publisherReputation: number): number {
  return (
    AUTHORITY_WEIGHTS.authority * clamp(authorityLevel) +
    AUTHORITY_WEIGHTS.freshness * clamp(freshness) +
    AUTHORITY_WEIGHTS.reputation * clamp(publisherReputation)
  );
}

/** Freshness halves every `halfLifeDays`; unknown dates score 0.5. */
export function freshnessScore(publishedAt: string | undefined, now: number, halfLifeDays = 30): number {
  if (!publishedAt) return 0.5;
  const ageDays = Math.max(0, (now - new Date(publishedAt).getTime()) / 86_400_000);
  return clamp(Math.pow(0.5, ageDays / halfLifeDays));
}

export interface CostEstimate {
  tokens: number;
  usd: number;
  minutes: number;
}

/**
 * Rough pre-flight estimate for a run. Token use scales with the number of
 * sources (≈ 4 chunks × 800 tokens per source read, plus synthesis
 * overhead). Deliberately conservative, labelled "estimate" in the UI.
 */
export function estimateRunCost(
  maxSources: number,
  primary: ModelConfig | undefined,
  contradictions: boolean
): CostEstimate {
  const perSource = 4 * 800 * 1.35; // chunks × tokens × prompt overhead
  const synthesis = 18_000;
  const conflictPass = contradictions ? maxSources * 600 : 0;
  const tokens = Math.round(maxSources * perSource + synthesis + conflictPass);
  const usd = primary ? (tokens / 1000) * primary.costPer1kTokens : 0;
  const minutes = Math.max(3, Math.round(4 + maxSources * 0.45 + (contradictions ? 2 : 0)));
  return { tokens, usd, minutes };
}

/** Very small heuristics that help people write better research questions. */
export interface QuestionCheck {
  id: string;
  label: string;
  ok: boolean;
}

export function checkQuestion(text: string): QuestionCheck[] {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  return [
    { id: "length", label: "Specific enough (12+ words)", ok: words >= 12 },
    {
      id: "measure",
      label: "Names something measurable",
      ok: /\d|rate|cost|latency|throughput|yield|price|share|growth|efficien|accuracy|benchmark|impact/i.test(t),
    },
    {
      id: "compare",
      label: "Sets up a comparison or trade-off",
      ok: /\bvs\.?\b|versus|compar|trade-?off|between|against|relative to|differ/i.test(t),
    },
    {
      id: "scope",
      label: "Bounds the scope (time, place or population)",
      ok: /\b(19|20)\d{2}\b|quarter|Q[1-4]\b|since|last \w+ (years?|months?)|region|market|in the (US|EU|UK)|global|under\b|across\b/i.test(
        t
      ),
    },
  ];
}
