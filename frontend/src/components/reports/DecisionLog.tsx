"use client";

/**
 * Human decisions are append-only: you can add one, never edit or delete.
 * The form asks for a one-line decision and the reasoning behind it,
 * then confirms before anything is written to the audit trail.
 */

import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import type { DecisionType, HumanDecision, ReportVersion } from "@/types/report.types";
import { DECISION_META } from "@/types/report.types";
import { can, canOverridePolicy } from "@/types/rbac.types";
import { useSession } from "@/stores/session.store";
import { api } from "@/lib/api/client";
import { invalidate } from "@/lib/api/query";
import { toast } from "@/stores/toast.store";
import { cn } from "@/lib/utils/cn";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/misc";
import { LocalTime, RelativeTime, DATE_TIME } from "@/components/ui/Time";

export const DECISION_TONE: Record<DecisionType, Tone> = {
  APPROVED: "success",
  NEEDS_REVISION: "process",
  REJECTED: "failure",
  POLICY_OVERRIDE: "validation",
};

const PROMPTS: Record<DecisionType, { summary: string; reason: string }> = {
  APPROVED: { summary: "e.g. Approved for Q4 capacity planning", reason: "What did you check? Which conflicts did you accept, and why?" },
  NEEDS_REVISION: { summary: "e.g. Needs long-context benchmarks", reason: "What's missing or wrong, specifically enough that the next run can fix it?" },
  REJECTED: { summary: "e.g. Not fit for the pricing decision", reason: "Why shouldn't anyone rely on this version?" },
  POLICY_OVERRIDE: { summary: "e.g. Published despite one open conflict", reason: "Which policy is being overridden, and who agreed to it?" },
};

export function DecisionLog({
  decisions,
  versions,
  current,
  projectId,
}: {
  decisions: HumanDecision[];
  versions: ReportVersion[];
  current: ReportVersion;
  projectId: string;
}) {
  const user = useSession((s) => s.user);
  const role = useSession((s) => s.role);
  const allowed = can(role, "APPROVE_HUMAN_DECISION");
  const [type, setType] = useState<DecisionType>("APPROVED");
  const [summary, setSummary] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const vNum = (id: string) => versions.find((v) => v.id === id)?.versionNumber;
  const ordered = [...decisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const summaryErr = summary.trim().length < 8 ? "Say what you decided in a short line (8+ characters)." : undefined;
  const reasonErr = reason.trim().length < 20 ? "Give the reasoning someone will need later (20+ characters)." : undefined;
  const types: DecisionType[] = canOverridePolicy(role) ? ["APPROVED", "NEEDS_REVISION", "REJECTED", "POLICY_OVERRIDE"] : ["APPROVED", "NEEDS_REVISION", "REJECTED"];

  async function submit() {
    setSaving(true);
    try {
      await api.recordDecision({
        userId: user.id,
        userName: user.name,
        projectId,
        reportVersionId: current.id,
        decisionType: type,
        decisionValue: summary.trim(),
        reason: reason.trim(),
      });
      invalidate("decisions:");
      toast({ title: `Recorded: ${DECISION_META[type].label.toLowerCase()}`, description: `On version ${current.versionNumber}. It's now part of the audit trail.`, tone: "success" });
      setSummary("");
      setReason("");
      setConfirming(false);
      setTried(false);
    } catch (err) {
      toast({ title: "Couldn't record the decision", description: err instanceof Error ? err.message : undefined, tone: "danger" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Timeline */}
      <section>
        <h3 className="mb-1 text-[14px] font-semibold text-ink">Decision history</h3>
        <p className="mb-5 text-[13px] text-ink-3">Across all versions, newest first. Entries can&apos;t be edited or removed.</p>
        {ordered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-5 py-10 text-center text-[13.5px] text-ink-3">
            No one has signed off on this report yet.
          </p>
        ) : (
          <ol className="relative space-y-6 border-l border-line pl-6">
            {ordered.map((d) => (
              <li key={d.id} className="relative animate-rise">
                <span className="absolute top-1 -left-[31px] rounded-full bg-paper p-0.5">
                  <Avatar name={d.userName} size={20} />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={DECISION_TONE[d.decisionType]}>{DECISION_META[d.decisionType].label}</Badge>
                  <span className="text-[12.5px] text-ink-3">
                    on version {vNum(d.reportVersionId) ?? "?"} · {d.userName} · <RelativeTime iso={d.createdAt} />
                  </span>
                </div>
                <p className="mt-1.5 text-[14.5px] font-medium text-ink">{d.decisionValue}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{d.reason}</p>
                <p className="mt-1.5 text-[11.5px] text-ink-3">
                  <LocalTime iso={d.createdAt} options={DATE_TIME} /> · <span className="font-mono">{d.id}</span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Form */}
      <aside>
        <Panel className="lg:sticky lg:top-20">
          <div className="border-b border-line px-5 py-3.5">
            <h3 className="text-[14px] font-semibold text-ink">Record a decision on v{current.versionNumber}</h3>
            <p className="text-[12.5px] text-ink-3">Signed as {user.name}.</p>
          </div>
          {!allowed ? (
            <div className="flex items-start gap-3 px-5 py-5 text-[13.5px] text-ink-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
              Viewers can read the decision history but can&apos;t add to it. Analysts, researchers, admins and owners can.
            </div>
          ) : confirming ? (
            <div className="space-y-4 px-5 py-5">
              <div className="rounded-lg bg-paper/70 p-4">
                <Badge tone={DECISION_TONE[type]}>{DECISION_META[type].label}</Badge>
                <p className="mt-2 text-[14px] font-medium text-ink">{summary}</p>
                <p className="mt-1 text-[13px] text-ink-2">{reason}</p>
              </div>
              <p className="flex items-start gap-2 text-[12.5px] text-ink-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This is permanent. It joins the audit trail for version {current.versionNumber} and can&apos;t be changed afterwards — only followed by another decision.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Edit
                </Button>
                <Button variant="primary" loading={saving} onClick={submit}>
                  Record it
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="space-y-4 px-5 py-5"
              onSubmit={(e) => {
                e.preventDefault();
                setTried(true);
                if (!summaryErr && !reasonErr) setConfirming(true);
              }}
            >
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-ink">Decision</legend>
                <div className="grid grid-cols-2 gap-1.5">
                  {types.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={type === t}
                      onClick={() => setType(t)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-left text-[13px] transition-colors",
                        type === t ? "border-ink bg-ink text-paper" : "border-line text-ink-2 hover:border-line-strong"
                      )}
                    >
                      {DECISION_META[t].verb}
                    </button>
                  ))}
                </div>
              </fieldset>
              <Field label="In one line" error={tried ? summaryErr : undefined}>
                {(p) => <Input {...p} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={PROMPTS[type].summary} maxLength={140} />}
              </Field>
              <Field label="Why" error={tried ? reasonErr : undefined} hint={!tried ? PROMPTS[type].reason : undefined}>
                {(p) => <Textarea {...p} rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />}
              </Field>
              <Button type="submit" variant="primary" className="w-full">
                Review and record
              </Button>
            </form>
          )}
        </Panel>
      </aside>
    </div>
  );
}
