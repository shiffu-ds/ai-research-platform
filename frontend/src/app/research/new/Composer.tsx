"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Circle, Lock, Sparkle, ArrowRight } from "lucide-react";
import { useQuery, invalidate } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { qk, useWorkspace } from "@/hooks/useWorkspace";
import { useCan } from "@/hooks/useSession";
import { useHotkeys, modKeyLabel } from "@/hooks/useHotkeys";
import { useHydrated } from "@/hooks/useHydrated";
import { useSession } from "@/stores/session.store";
import { useNotifications } from "@/stores/notification.store";
import { toast } from "@/stores/toast.store";
import { checkQuestion, estimateRunCost } from "@/lib/scoring";
import { formatCompact, formatUSD } from "@/lib/utils/format";
import { AGENT_STAGES, STAGE_META, type ResearchRunConfig } from "@/types/research.types";
import { cn } from "@/lib/utils/cn";
import { Panel } from "@/components/ui/Panel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Range, Segmented, Select, Switch } from "@/components/ui/Field";
import { Kbd } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";

const DRAFT_KEY = "arp.composer.draft";

const EXAMPLES = [
  {
    title: "Retrieval under load",
    text: "What are the throughput and latency trade-offs between dense pgvector search and hybrid BM25 + Reciprocal Rank Fusion at 50+ concurrent clients, based on benchmarks published since 2024?",
  },
  {
    title: "Chip supply risk",
    text: "Which inputs to 2nm semiconductor production face the highest supply concentration risk through 2027, and how do recent export controls change that picture?",
  },
  {
    title: "Inference economics",
    text: "How does the cost per million tokens of self-hosted 70B models on H100 compare with managed APIs at 10M tokens/day, including utilisation and ops overhead?",
  },
];

interface Draft {
  question: string;
  maxSources: number;
  freshness: number;
  reranker: number;
  contradictions: boolean;
  repairs: number;
  primary: string;
  fallback: string;
}

const DEFAULTS: Draft = {
  question: "",
  maxSources: 25,
  freshness: 30,
  reranker: 0.82,
  contradictions: true,
  repairs: 3,
  primary: "gpt-4o-v1",
  fallback: "gemini-1.5-flash-v1",
};

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Draft>) } : null;
  } catch {
    return null;
  }
}

export function Composer() {
  const router = useRouter();
  const params = useSearchParams();
  const fromRunId = params.get("from");
  const canCreate = useCan("CREATE_RESEARCH_RUN");
  const { project, projectId } = useWorkspace();
  const user = useSession((s) => s.user);
  const push = useNotifications((s) => s.push);
  const models = useQuery(qk.models, api.getModels);
  const fromRun = useQuery(fromRunId ? qk.run(fromRunId) : null, () => api.getResearchRun(fromRunId!));
  const hydrated = useHydrated();

  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [launching, setLaunching] = useState(false);
  const [touched, setTouched] = useState(false);
  const loaded = useRef(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Restore: a failed run to retry wins over a saved draft.
  useEffect(() => {
    if (loaded.current || !hydrated) return;
    if (fromRunId && !fromRun.data) return;
    loaded.current = true;
    const next: Draft = fromRun.data
      ? {
          ...DEFAULTS,
          question: fromRun.data.questionText,
          maxSources: fromRun.data.config.maxSources ?? DEFAULTS.maxSources,
          contradictions: fromRun.data.config.enableContradictionDetection ?? true,
          repairs: fromRun.data.config.maxRepairAttempts ?? 3,
          primary: fromRun.data.config.primaryModelId ?? DEFAULTS.primary,
        }
      : readDraft() ?? DEFAULTS;
    const t = setTimeout(() => setDraft(next), 0);
    return () => clearTimeout(t);
  }, [hydrated, fromRunId, fromRun.data]);

  // Autosave, debounced.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setSavedAt(Date.now());
      } catch {
        /* storage unavailable */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [draft]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const checks = useMemo(() => checkQuestion(draft.question), [draft.question]);
  const passed = checks.filter((c) => c.ok).length;
  const words = draft.question.trim().split(/\s+/).filter(Boolean).length;
  const tooShort = words < 6;

  const modelList = models.data ?? [];
  const primaryModel = modelList.find((m) => m.modelId === draft.primary);
  const primaryOptions = modelList.filter((m) => m.supportedTaskTypes.includes("synthesis") || m.supportedTaskTypes.includes("analysis"));
  const fallbackOptions = modelList.filter((m) => m.modelId !== draft.primary);
  const estimate = estimateRunCost(draft.maxSources, primaryModel, draft.contradictions);

  async function launch() {
    setTouched(true);
    if (tooShort || !projectId || !canCreate) {
      textRef.current?.focus();
      return;
    }
    setLaunching(true);
    const config: ResearchRunConfig = {
      maxSources: draft.maxSources,
      embeddingModel: "text-embedding-3-large (3072-dim)",
      rerankerThreshold: draft.reranker,
      enableContradictionDetection: draft.contradictions,
      maxRepairAttempts: draft.repairs,
      primaryModelId: draft.primary,
      fallbackModelId: draft.fallback,
      freshnessHalfLifeDays: draft.freshness,
    };
    try {
      const run = await api.createResearchRun({ projectId, questionText: draft.question.trim(), config }, user);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      invalidate("runs:");
      push({
        type: "RUN_STARTED",
        severity: "INFO",
        title: "You started a run",
        message: draft.question.trim().slice(0, 120),
        resourceId: run.id,
        resourceType: "research_run",
        projectId,
        projectName: project?.name,
      });
      router.push(`/research/${run.id}`);
    } catch (err) {
      setLaunching(false);
      toast({ title: "Couldn't start the run", description: err instanceof Error ? err.message : undefined, tone: "danger" });
    }
  }

  useHotkeys({ "mod+enter": () => void launch() }, { allowInInputs: ["mod+enter"] });

  if (hydrated && !canCreate) {
    return (
      <div className="mx-auto max-w-xl pt-10">
        <EmptyState
          drawing="notebook"
          title="Your role can read, not start runs"
          action={
            <ButtonLink href="/research" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
              Back to research
            </ButtonLink>
          }
        >
          Researchers, admins and owners can start research. Ask one of them to run this, or to change your role on the Members page.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1120px]">
      <Link href="/research" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Research
      </Link>

      <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <div>
            <h1 className="font-serif text-[32px] leading-tight font-medium text-ink">What do you want to find out?</h1>
            <p className="mt-1.5 text-[14.5px] text-ink-2">
              Write it the way you&apos;d brief a colleague. The planner breaks it into tasks; everything it concludes will cite its evidence.
            </p>
          </div>

          {fromRun.data && (
            <div className="rounded-lg border border-line bg-surface px-4 py-3 text-[13px] text-ink-2">
              Retrying <Link href={`/research/${fromRun.data.id}`} className="font-medium text-ink underline decoration-line-strong underline-offset-2">a run that {fromRun.data.state === "FAILED" ? "failed" : "stopped"}</Link>. Its question and settings are filled in below.
            </div>
          )}

          <Panel className="overflow-hidden">
            <label htmlFor="question" className="sr-only">
              Research question
            </label>
            <textarea
              id="question"
              ref={textRef}
              autoFocus
              rows={5}
              value={draft.question}
              onChange={(e) => set("question", e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="e.g. How much does hybrid retrieval actually add to p95 latency at 50 concurrent users, and is the accuracy gain worth it?"
              className="block w-full resize-none bg-transparent px-5 pt-5 pb-3 font-serif text-[19px] leading-relaxed text-ink placeholder:text-ink-3/80 focus:outline-none"
              aria-invalid={touched && tooShort ? true : undefined}
              aria-describedby="question-help"
            />
            <div id="question-help" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-paper/50 px-5 py-2.5">
              {checks.map((c) => (
                <span key={c.id} className={cn("flex items-center gap-1.5 text-[12.5px] transition-colors", c.ok ? "text-st-success" : "text-ink-3")}>
                  {c.ok ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Circle className="h-3 w-3" />}
                  {c.label}
                </span>
              ))}
              <span className="tnum ml-auto text-[12px] text-ink-3">{words} words</span>
            </div>
          </Panel>
          {touched && tooShort && (
            <p className="-mt-3 text-[13px] text-st-failure" role="alert">
              A few more words, please — short questions produce vague plans.
            </p>
          )}

          {draft.question.trim().length === 0 && (
            <div>
              <p className="mb-2 text-[13px] text-ink-3">Or start from one of these and edit it:</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.title}
                    type="button"
                    onClick={() => {
                      set("question", ex.text);
                      textRef.current?.focus();
                    }}
                    className="group rounded-lg border border-line bg-surface p-3 text-left shadow-sm transition-colors hover:border-line-strong"
                  >
                    <span className="flex items-center justify-between text-[13px] font-medium text-ink">
                      {ex.title}
                      <ArrowRight className="h-3.5 w-3.5 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="mt-1 line-clamp-3 block text-[12.5px] leading-snug text-ink-3">{ex.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Panel>
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-[14px] font-semibold text-ink">Scope</h2>
              <p className="text-[13px] text-ink-3">How wide to cast the net, and how fussy to be about what comes back.</p>
            </div>
            <div className="grid gap-6 px-5 py-5 sm:grid-cols-2">
              <Field label="Sources to read" aside={<span className="tnum text-[13px] font-medium text-ink">{draft.maxSources}</span>} hint="More sources means better coverage and a longer, costlier run.">
                {(p) => <Range {...p} min={5} max={60} step={5} value={draft.maxSources} onChange={(v) => set("maxSources", v)} />}
              </Field>
              <Field label="Freshness half-life" aside={<span className="tnum text-[13px] font-medium text-ink">{draft.freshness} days</span>} hint="A source this old counts half as fresh. Use longer for slow-moving topics.">
                {(p) => <Range {...p} min={7} max={365} step={1} value={draft.freshness} onChange={(v) => set("freshness", v)} />}
              </Field>
              <Field label="Reranker threshold" aside={<span className="tnum text-[13px] font-medium text-ink">{draft.reranker.toFixed(2)}</span>} hint="Chunks scoring below this after cross-encoder reranking are dropped.">
                {(p) => <Range {...p} min={0.5} max={0.95} step={0.01} value={draft.reranker} onChange={(v) => set("reranker", v)} />}
              </Field>
              <div className="space-y-1.5">
                <p className="text-[13px] font-medium text-ink">Repair attempts</p>
                <Segmented
                  label="Repair attempts"
                  value={String(draft.repairs) as "1" | "2" | "3"}
                  onChange={(v) => set("repairs", Number(v))}
                  options={[
                    { value: "1", label: "1" },
                    { value: "2", label: "2" },
                    { value: "3", label: "3" },
                  ]}
                />
                <p className="text-[12.5px] text-ink-3">If validation fails, the report is repaired at most this many times before the run is marked failed.</p>
              </div>
            </div>
            <div className="border-t border-line px-5 py-4">
              <Switch
                checked={draft.contradictions}
                onChange={(v) => set("contradictions", v)}
                label="Look for conflicts between sources"
                description="Numeric and unit conflicts are checked by the calculation service; the rest get an advisory read."
              />
            </div>
          </Panel>

          <Panel>
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-[14px] font-semibold text-ink">Models</h2>
              <p className="text-[13px] text-ink-3">From the routing registry. The fallback takes over if the primary is unavailable or too slow.</p>
            </div>
            <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
              <Field label="Primary (planning, synthesis, report)">
                {(p) => (
                  <Select {...p} value={draft.primary} onChange={(e) => set("primary", e.target.value)} disabled={!models.data}>
                    {primaryOptions.map((m) => (
                      <option key={m.modelId} value={m.modelId}>
                        {m.name} — ${(m.costPer1kTokens * 1000).toFixed(2)}/M tokens
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Fallback">
                {(p) => (
                  <Select {...p} value={draft.fallback} onChange={(e) => set("fallback", e.target.value)} disabled={!models.data}>
                    {fallbackOptions.map((m) => (
                      <option key={m.modelId} value={m.modelId}>
                        {m.name} ({m.qualityTier})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Panel>
        </div>

        {/* Summary rail */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Panel className="overflow-hidden">
            <div className="px-5 pt-4 pb-3">
              <p className="text-[12px] text-ink-3">Running in</p>
              <p className="truncate text-[14px] font-medium text-ink">{project?.name ?? "…"}</p>
            </div>
            <dl className="grid grid-cols-3 border-y border-line text-center">
              <div className="px-2 py-3">
                <dt className="text-[11.5px] text-ink-3">Time</dt>
                <dd className="tnum mt-0.5 font-serif text-[19px] text-ink">~{estimate.minutes}m</dd>
              </div>
              <div className="border-x border-line px-2 py-3">
                <dt className="text-[11.5px] text-ink-3">Tokens</dt>
                <dd className="tnum mt-0.5 font-serif text-[19px] text-ink">{formatCompact(estimate.tokens)}</dd>
              </div>
              <div className="px-2 py-3">
                <dt className="text-[11.5px] text-ink-3">Cost</dt>
                <dd className="tnum mt-0.5 font-serif text-[19px] text-ink">{formatUSD(estimate.usd)}</dd>
              </div>
            </dl>
            <p className="px-5 pt-2 text-[11.5px] text-ink-3">Rough estimate from source count and the primary model&apos;s price.</p>

            <ol className="space-y-2.5 px-5 py-4">
              {AGENT_STAGES.map((st, i) => (
                <li key={st} className={cn("flex gap-3 text-[12.5px]", st === "CONTRADICTION" && !draft.contradictions && "opacity-40")}>
                  <span className="tnum mt-px flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border border-line-strong text-[10px] text-ink-3">{i + 1}</span>
                  <span className="text-ink-2">
                    <span className="font-medium text-ink">{STAGE_META[st].agent}.</span> {STAGE_META[st].does}
                  </span>
                </li>
              ))}
            </ol>

            <div className="border-t border-line bg-paper/50 px-5 py-4">
              <Button variant="primary" size="lg" className="w-full" loading={launching} onClick={launch} icon={!launching ? <Sparkle className="h-4 w-4" /> : undefined}>
                Start research
              </Button>
              <div className="mt-2.5 flex items-center justify-between text-[12px] text-ink-3">
                <span>
                  {passed}/{checks.length} question checks
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>{hydrated ? modKeyLabel() : "Ctrl"}</Kbd>
                  <Kbd>↵</Kbd>
                </span>
              </div>
              <p className="mt-2 text-[11.5px] text-ink-3" aria-live="polite">
                {savedAt ? "Draft saved on this device." : " "}
              </p>
            </div>
          </Panel>
          {!canCreate && (
            <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-ink-3">
              <Lock className="h-3.5 w-3.5" /> Your role can&apos;t start runs.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
