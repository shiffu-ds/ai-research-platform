"use client";

import { useMemo, useState } from "react";
import { Lock, RefreshCw } from "lucide-react";
import { useQuery, setQueryData } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { API_BASE_URL, API_ORIGIN, DATA_MODE } from "@/lib/api/config";
import { qk } from "@/hooks/useWorkspace";
import { useCan, useTimezone } from "@/hooks/useSession";
import { useNow } from "@/hooks/useNow";
import { useSession, type ThemePreference } from "@/stores/session.store";
import { toast } from "@/stores/toast.store";
import { formatLocalizedTime, formatOffset, getDefaultTimezone, SUPPORTED_TIMEZONES, zoneOffsetMinutes } from "@/lib/utils/timezone";
import { formatNumber } from "@/lib/utils/format";
import type { HealthReport, PromptVersion } from "@/types/platform.types";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Segmented, Select } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/misc";
import { RelativeTime } from "@/components/ui/Time";
import { useHydrated } from "@/hooks/useHydrated";

const STATUS_TONE: Record<PromptVersion["status"], Tone> = { ACTIVE: "success", DRAFT: "process", DEPRECATED: "neutral" };

type Section = "preferences" | "connection" | "models" | "prompts";

function Preferences() {
  const theme = useSession((s) => s.theme);
  const setTheme = useSession((s) => s.setTheme);
  const tzPref = useSession((s) => s.timezone);
  const setTz = useSession((s) => s.setTimezone);
  const tz = useTimezone();
  const now = useNow(1000);
  const hydrated = useHydrated();
  const browserTz = hydrated ? getDefaultTimezone() : "UTC";
  const zones = Array.from(new Set([browserTz, ...SUPPORTED_TIMEZONES]));

  return (
    <Panel>
      <PanelHeader title="Preferences" description="Saved in this browser." />
      <div className="divide-y divide-line">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13.5px] font-medium text-ink">Theme</p>
            <p className="text-[12.5px] text-ink-3">Paper by day, charcoal by night — or let your system decide.</p>
          </div>
          <Segmented
            label="Theme"
            value={theme}
            onChange={(v: ThemePreference) => setTheme(v)}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13.5px] font-medium text-ink">Timezone</p>
            <p className="text-[12.5px] text-ink-3">
              Times are stored in UTC and shown in this zone. It&apos;s{" "}
              <span className="tnum font-medium text-ink-2" suppressHydrationWarning>
                {hydrated && now ? formatLocalizedTime(new Date(now).toISOString(), tz, { hour: "2-digit", minute: "2-digit", second: undefined, year: undefined, month: undefined, day: undefined }) : "—"}
              </span>{" "}
              there now. Schedules keep their own zone.
            </p>
          </div>
          <Select value={tzPref} onChange={(e) => setTz(e.target.value)} className="w-64" aria-label="Timezone">
            <option value="">Use my browser&apos;s ({browserTz.replace(/_/g, " ")})</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")} ({formatOffset(zoneOffsetMinutes(z))})
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Panel>
  );
}

function Connection() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    setHealth(await api.getHealth());
    setChecking(false);
  };
  return (
    <Panel>
      <PanelHeader
        title="Connection"
        description="Where this app gets its data. Set at build time through environment variables."
        actions={
          <Button size="sm" icon={<RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} />} onClick={check} disabled={checking}>
            Check now
          </Button>
        }
      />
      <dl className="divide-y divide-line text-[13px]">
        {[
          ["Mode", DATA_MODE === "demo" ? "Demo workspace — sample data, kept in this tab" : "Live API"],
          ["API base", API_BASE_URL],
          ["Health check", `${API_ORIGIN}/health/ready`],
          ["Switch with", "NEXT_PUBLIC_USE_MOCK=false and NEXT_PUBLIC_API_BASE_URL"],
        ].map(([k, v]) => (
          <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[160px_1fr]">
            <dt className="text-ink-3">{k}</dt>
            <dd className="font-mono text-[12.5px] break-all text-ink">{v}</dd>
          </div>
        ))}
        {health && (
          <div className="grid gap-1 px-5 py-3 sm:grid-cols-[160px_1fr]" aria-live="polite">
            <dt className="text-ink-3">Result</dt>
            <dd className="text-ink">
              {health.status === "demo" ? (
                "Demo mode doesn't call the backend."
              ) : (
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={health.status === "ready" ? "success" : health.status === "not_ready" ? "process" : "failure"} dot>
                    {health.status.replace("_", " ")}
                  </Badge>
                  {Object.entries(health.checks).map(([k, v]) => (
                    <span key={k} className="font-mono text-[12px] text-ink-2">
                      {k}: {v}
                    </span>
                  ))}
                  {health.latencyMs !== undefined && <span className="text-[12px] text-ink-3">{health.latencyMs} ms</span>}
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}

function Models() {
  const q = useQuery(qk.models, api.getModels);
  return (
    <Panel>
      <PanelHeader title="Model registry" description="Versioned models the router can pick from. Runs pin the exact version they used." />
      {!q.data ? (
        <div className="p-5">
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-ink-3">
                <th className="py-2.5 pr-3 pl-5 font-medium">Model</th>
                <th className="px-3 py-2.5 font-medium">Tier</th>
                <th className="px-3 py-2.5 text-right font-medium">Context</th>
                <th className="px-3 py-2.5 text-right font-medium">$ / M tokens</th>
                <th className="px-3 py-2.5 text-right font-medium">p95</th>
                <th className="py-2.5 pr-5 pl-3 font-medium">Used for</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {q.data.map((m) => (
                <tr key={m.modelId}>
                  <td className="py-2.5 pr-3 pl-5">
                    <p className="font-medium text-ink">{m.name}</p>
                    <p className="font-mono text-[11.5px] text-ink-3">
                      {m.provider} · {m.version}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-ink-2 capitalize">{m.qualityTier}</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink-2">{m.contextWindow >= 1_000_000 ? "1M" : `${formatNumber(m.contextWindow / 1000)}k`}</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink-2">{(m.costPer1kTokens * 1000).toFixed(2)}</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink-2">{m.p95LatencyMs} ms</td>
                  <td className="py-2.5 pr-5 pl-3 text-[12.5px] text-ink-3">{m.supportedTaskTypes.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Prompts() {
  const q = useQuery(qk.prompts, api.getPrompts);
  const canEdit = useCan("EDIT_PROMPTS");
  const [busy, setBusy] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const map = new Map<string, PromptVersion[]>();
    for (const p of q.data ?? []) map.set(p.promptId, [...(map.get(p.promptId) ?? []), p]);
    return [...map.entries()].map(([id, versions]) => ({ id, versions: versions.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true })) }));
  }, [q.data]);

  async function activate(p: PromptVersion) {
    setBusy(`${p.promptId}@${p.version}`);
    try {
      const next = await api.activatePrompt(p.promptId, p.version);
      setQueryData<PromptVersion[]>(qk.prompts, () => next);
      toast({ title: `${p.promptId} ${p.version} is now active`, description: "New runs use it. Earlier runs keep the version they were pinned to.", tone: "success" });
    } catch {
      toast({ title: "Couldn't activate", tone: "danger" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Prompt registry"
        description="Prompts are immutable once written: draft → active → deprecated. Activating a draft retires the previous active version."
        actions={!canEdit ? <span className="flex items-center gap-1 text-[12px] text-ink-3"><Lock className="h-3.5 w-3.5" /> Owners and admins edit</span> : undefined}
      />
      {!q.data ? (
        <div className="p-5">
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="divide-y divide-line">
          {grouped.map((g) => (
            <section key={g.id} className="px-5 py-4">
              <h3 className="font-mono text-[13px] font-medium text-ink">{g.id}</h3>
              <ul className="mt-2 space-y-2">
                {g.versions.map((p) => (
                  <li key={p.version} className={cn("rounded-lg border p-3", p.status === "ACTIVE" ? "border-line-strong bg-paper/50" : "border-line")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12.5px] font-semibold text-ink">{p.version}</span>
                      <Badge tone={STATUS_TONE[p.status]}>{p.status.toLowerCase()}</Badge>
                      <span className="text-[12px] text-ink-3">
                        {p.createdBy} · <RelativeTime iso={p.createdAt} />
                      </span>
                      {p.status === "DRAFT" && canEdit && (
                        <Button size="sm" variant="secondary" className="ml-auto" loading={busy === `${p.promptId}@${p.version}`} onClick={() => activate(p)}>
                          Activate
                        </Button>
                      )}
                    </div>
                    <pre className="mt-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-2">
                      {p.template.split(/(\{[a-z0-9_]+\})/g).map((part, i) =>
                        /^\{[a-z0-9_]+\}$/.test(part) ? (
                          <span key={i} className="rounded bg-accent-soft px-0.5 text-accent">
                            {part}
                          </span>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                    </pre>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function Settings() {
  const [section, setSection] = useState<Section>("preferences");
  const items: { value: Section; label: string }[] = [
    { value: "preferences", label: "Preferences" },
    { value: "connection", label: "Connection" },
    { value: "models", label: "Models" },
    { value: "prompts", label: "Prompts" },
  ];
  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader title="Settings" description="Your preferences, where the data comes from, and the model and prompt versions the agents run on." />
      <div className="grid gap-8 md:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="md:sticky md:top-20 md:self-start">
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {items.map((i) => (
              <li key={i.value}>
                <button
                  type="button"
                  onClick={() => setSection(i.value)}
                  aria-current={section === i.value ? "page" : undefined}
                  className={cn(
                    "w-full rounded-md px-3 py-1.5 text-left text-[13.5px] whitespace-nowrap transition-colors",
                    section === i.value ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-2 hover:bg-surface/70 hover:text-ink"
                  )}
                >
                  {i.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 animate-fade" key={section}>
          {section === "preferences" && <Preferences />}
          {section === "connection" && <Connection />}
          {section === "models" && <Models />}
          {section === "prompts" && <Prompts />}
        </div>
      </div>
    </div>
  );
}
