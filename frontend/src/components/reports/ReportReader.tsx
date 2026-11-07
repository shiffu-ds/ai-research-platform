"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ShieldCheck, ShieldAlert, Printer, FlaskConical } from "lucide-react";
import { useQuery } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { qk, useWorkspace } from "@/hooks/useWorkspace";
import { useHotkeys } from "@/hooks/useHotkeys";
import { computeEvidenceSetHash, verifyEvidenceHash } from "@/lib/crypto";
import { shortHash, pluralize } from "@/lib/utils/format";
import type { Contradiction } from "@/types/report.types";
import { DECISION_META } from "@/types/report.types";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Menu } from "@/components/ui/Menu";
import { Avatar, CopyButton, Skeleton } from "@/components/ui/misc";
import { LocalTime, DATE_TIME } from "@/components/ui/Time";
import { ErrorState } from "@/components/ui/states";
import { ReportBody } from "./ReportBody";
import { EvidencePanel } from "./EvidencePanel";
import { ConflictList } from "./ConflictList";
import { VersionCompare } from "./VersionCompare";
import { DecisionLog, DECISION_TONE } from "./DecisionLog";
import { allCitations, latestDecisionFor } from "./report-utils";

type Tab = "read" | "conflicts" | "compare" | "decisions";

type Integrity = { state: "idle" } | { state: "checking" } | { state: "done"; ok: number; total: number; rootMatches: boolean };

const AUTHORS: Record<string, string> = {
  usr_lead_001: "Muhammad Shoaib",
  usr_m1_lead: "Talha Rehman",
  usr_m2_lead: "Abdullah Malik",
};

export function ReportReader({ reportId }: { reportId: string }) {
  const bundle = useQuery(qk.report(reportId), () => api.getReport(reportId));
  const versions = useMemo(() => [...(bundle.data?.versions ?? [])].sort((a, b) => a.versionNumber - b.versionNumber), [bundle.data]);
  const versionIds = versions.map((v) => v.id);
  const decisionsQ = useQuery(versionIds.length ? qk.decisions(versionIds) : null, () => api.getDecisions(versionIds));
  const { projects } = useWorkspace();

  const [chosenVersion, setChosenVersion] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("read");
  const [citationNo, setCitationNo] = useState<number | null>(null);
  const [highlightConflict, setHighlightConflict] = useState<string | null>(null);
  const [integrity, setIntegrity] = useState<Integrity>({ state: "idle" });

  const report = bundle.data?.report;
  const version = versions.find((v) => v.id === (chosenVersion ?? report?.latestVersionId)) ?? versions[versions.length - 1];
  const citations = useMemo(() => (version ? allCitations(version) : []), [version]);
  const activeCitation = citations.find((c) => c.citationNumber === citationNo) ?? null;
  const decisions = decisionsQ.data ?? [];
  const latestDecision = version ? latestDecisionFor(version.id, decisions) : undefined;
  const isLatest = version?.id === report?.latestVersionId;
  const project = projects.find((p) => p.id === report?.projectId);

  const step = (dir: 1 | -1) => {
    if (citations.length === 0) return;
    const idx = citations.findIndex((c) => c.citationNumber === citationNo);
    const next = citations[(idx + dir + citations.length) % citations.length];
    setCitationNo(next.citationNumber);
  };

  useHotkeys(
    {
      j: () => tab === "read" && step(1),
      k: () => tab === "read" && step(-1),
    },
    { enabled: Boolean(version) }
  );

  async function verifyAll() {
    if (!version) return;
    setIntegrity({ state: "checking" });
    const results = await Promise.all(citations.map((c) => verifyEvidenceHash(c.excerpt, c.locator, c.evidenceHash)));
    const root = await computeEvidenceSetHash(citations.map((c) => c.evidenceHash));
    setIntegrity({ state: "done", ok: results.filter((r) => r.match).length, total: results.length, rootMatches: root === version.evidenceSetHash });
  }

  const showConflict = (c: Contradiction) => {
    setHighlightConflict(c.id);
    setTab("conflicts");
    requestAnimationFrame(() => document.getElementById(`conflict-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  if (bundle.error && !bundle.data) return <ErrorState error={bundle.error} onRetry={bundle.refetch} />;

  if (!report || !version) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 pt-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="mt-8 h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/reports" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Reports
        </Link>
        <Button size="sm" variant="ghost" icon={<Printer className="h-3.5 w-3.5" />} onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <header className="mx-auto mt-4 max-w-3xl text-center xl:max-w-4xl">
        {project && <p className="text-[13px] text-ink-3">{project.name}</p>}
        <h1 className="mt-2 font-serif text-[32px] leading-[1.15] font-medium tracking-[-0.01em] text-balance text-ink sm:text-[40px]">{version.title}</h1>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] text-ink-2">
          <Menu
            label="Choose version"
            width={250}
            sections={[
              {
                label: "Versions are immutable",
                items: [...versions].reverse().map((v) => ({
                  key: v.id,
                  label: `Version ${v.versionNumber}${v.id === report.latestVersionId ? " · latest" : ""}`,
                  hint: latestDecisionFor(v.id, decisions) ? DECISION_META[latestDecisionFor(v.id, decisions)!.decisionType].label : "No decision",
                  selected: v.id === version.id,
                  onSelect: () => {
                    setChosenVersion(v.id);
                    setIntegrity({ state: "idle" });
                    setCitationNo(null);
                  },
                })),
              },
            ]}
            trigger={({ toggle, ...aria }) => (
              <button type="button" onClick={toggle} {...aria} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 font-medium text-ink shadow-sm hover:border-line-strong">
                Version {version.versionNumber}
                <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
              </button>
            )}
          />
          <span className="flex items-center gap-1.5">
            <Avatar name={AUTHORS[version.createdBy] ?? version.createdBy} size={18} />
            {AUTHORS[version.createdBy] ?? version.createdBy}
          </span>
          <LocalTime iso={version.createdAt} options={DATE_TIME} />
          <Link href={`/research/${version.researchRunId}`} className="text-ink-3 underline decoration-line-strong underline-offset-2 hover:text-ink">
            from run {version.researchRunId}
          </Link>
          {latestDecision ? (
            <Badge tone={DECISION_TONE[latestDecision.decisionType]} dot>
              {DECISION_META[latestDecision.decisionType].label}
            </Badge>
          ) : (
            <Badge tone="accent" dot>
              Awaiting decision
            </Badge>
          )}
        </div>

        {!isLatest && (
          <p className="mx-auto mt-4 max-w-xl rounded-lg bg-st-process-soft px-4 py-2 text-[13px] text-st-process">
            You&apos;re reading an earlier version.{" "}
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setChosenVersion(report.latestVersionId)}>
              Go to version {report.currentVersion}
            </button>
          </p>
        )}

        {/* Integrity strip */}
        <div className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-[12.5px] shadow-sm print:hidden">
          <span className="text-ink-3">Evidence set</span>
          <code className="font-mono text-ink-2" title={version.evidenceSetHash}>
            {shortHash(version.evidenceSetHash, 12, 6)}
          </code>
          <CopyButton value={version.evidenceSetHash} label="" />
          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
          {integrity.state === "done" ? (
            <span className={integrity.ok === integrity.total && integrity.rootMatches ? "flex items-center gap-1 font-medium text-st-success" : "flex items-center gap-1 font-medium text-st-failure"} aria-live="polite">
              {integrity.ok === integrity.total && integrity.rootMatches ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {integrity.ok}/{integrity.total} excerpts match · root {integrity.rootMatches ? "matches" : "differs"}
            </span>
          ) : (
            <Button size="sm" variant="ghost" loading={integrity.state === "checking"} icon={<FlaskConical className="h-3.5 w-3.5" />} onClick={verifyAll}>
              Verify all {pluralize(citations.length, "citation")}
            </Button>
          )}
        </div>
      </header>

      <Tabs
        className="mt-10 print:hidden"
        label="Report views"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "read", label: "Read" },
          { value: "conflicts", label: "Conflicts", count: version.contradictions.length },
          { value: "compare", label: "Compare versions", count: versions.length > 1 ? versions.length : undefined },
          { value: "decisions", label: "Decisions", count: decisions.length },
        ]}
      />

      <div className="pt-8" role="tabpanel">
        {tab === "read" && (
          <ReportBody
            version={version}
            activeCitation={citationNo}
            onOpenCitation={setCitationNo}
            onShowConflict={showConflict}
          />
        )}
        {tab === "conflicts" && (
          <ConflictList
            version={version}
            highlightId={highlightConflict}
            onJumpToSection={(sectionId) => {
              setTab("read");
              requestAnimationFrame(() => document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: "smooth" }));
            }}
          />
        )}
        {tab === "compare" && <VersionCompare versions={versions} initialTarget={version.id} />}
        {tab === "decisions" && <DecisionLog decisions={decisions} versions={versions} current={version} projectId={report.projectId} />}
      </div>

      <EvidencePanel citation={activeCitation} version={version} onClose={() => setCitationNo(null)} onStep={step} total={citations.length} />
    </div>
  );
}
