"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, MoreHorizontal, ShieldCheck } from "lucide-react";
import { useQuery, invalidate, setQueryData } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { qk, useWorkspace } from "@/hooks/useWorkspace";
import { useCan, useTimezone } from "@/hooks/useSession";
import { useNow } from "@/hooks/useNow";
import { useSession } from "@/stores/session.store";
import { toast } from "@/stores/toast.store";
import { describeSchedule, nextRuns, toCron, DAY_NAMES } from "@/lib/schedule";
import { formatLocalizedTime, formatOffset, SUPPORTED_TIMEZONES, zoneLabel, zoneOffsetMinutes, formatRelativeTime } from "@/lib/utils/timezone";
import type { ResearchSchedule, ScheduleFrequency } from "@/types/platform.types";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Segmented, Select, Switch, Textarea } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { Skeleton } from "@/components/ui/misc";
import { RelativeTime } from "@/components/ui/Time";
import { EmptyState, ErrorState } from "@/components/ui/states";

const fmtNext = (d: Date, tz: string) =>
  formatLocalizedTime(d.toISOString(), tz, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: undefined, year: undefined });

function blank(projectId: string, tz: string, createdBy: string): ResearchSchedule {
  return {
    id: `sch_${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    name: "",
    questionText: "",
    frequency: "weekdays",
    time: "09:00",
    dayOfWeek: 1,
    dayOfMonth: 1,
    timezone: tz,
    enabled: true,
    skipIfRunning: true,
    createdBy,
  };
}

function ScheduleDialog({ initial, isNew, onClose }: { initial: ResearchSchedule; isNew: boolean; onClose: () => void }) {
  const [s, setS] = useState(initial);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const viewerTz = useTimezone();
  const now = useNow(60_000);
  const set = <K extends keyof ResearchSchedule>(k: K, v: ResearchSchedule[K]) => setS((p) => ({ ...p, [k]: v }));
  const preview = useMemo(() => (now ? nextRuns(s, new Date(now), 3) : []), [s, now]);
  const zones = Array.from(new Set([s.timezone, viewerTz, ...SUPPORTED_TIMEZONES]));
  const nameErr = s.name.trim().length < 3 ? "Give it a name you'll recognise in a list." : undefined;
  const qErr = s.questionText.trim().split(/\s+/).length < 6 ? "The question needs a bit more detail." : undefined;

  async function save() {
    setTried(true);
    if (nameErr || qErr) return;
    setSaving(true);
    try {
      await api.saveSchedule({ ...s, name: s.name.trim(), questionText: s.questionText.trim() }, isNew);
      invalidate("schedules:");
      toast({ title: isNew ? "Schedule created" : "Schedule saved", description: `${describeSchedule(s)} ${zoneLabel(s.timezone)} time.`, tone: "success" });
      onClose();
    } catch (err) {
      toast({ title: "Couldn't save", description: err instanceof Error ? err.message : undefined, tone: "danger" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={isNew ? "Schedule recurring research" : "Edit schedule"}
      description="The same question, asked again on a timetable. Each run is a normal run with its own report."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {isNew ? "Create schedule" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          <Field label="Name" error={tried ? nameErr : undefined}>
            {(p) => <Input {...p} data-autofocus value={s.name} onChange={(e) => set("name", e.target.value)} placeholder="Weekly pricing check" />}
          </Field>
          <Field label="Question" error={tried ? qErr : undefined}>
            {(p) => <Textarea {...p} rows={3} value={s.questionText} onChange={(e) => set("questionText", e.target.value)} placeholder="What changed in … this week?" className="font-serif text-[15.5px]" />}
          </Field>
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-ink">How often</p>
            <Segmented
              label="Frequency"
              value={s.frequency}
              onChange={(v: ScheduleFrequency) => set("frequency", v)}
              options={[
                { value: "daily", label: "Daily" },
                { value: "weekdays", label: "Weekdays" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {s.frequency === "weekly" && (
              <Field label="Day">
                {(p) => (
                  <Select {...p} value={s.dayOfWeek} onChange={(e) => set("dayOfWeek", Number(e.target.value))}>
                    {DAY_NAMES.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {s.frequency === "monthly" && (
              <Field label="Day of month" hint="Up to the 28th, so every month has it.">
                {(p) => (
                  <Select {...p} value={s.dayOfMonth} onChange={(e) => set("dayOfMonth", Number(e.target.value))}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Field label="Time">{(p) => <Input {...p} type="time" value={s.time} onChange={(e) => set("time", e.target.value || "09:00")} />}</Field>
            <Field label="Timezone" className={s.frequency === "daily" || s.frequency === "weekdays" ? "sm:col-span-2" : undefined}>
              {(p) => (
                <Select {...p} value={s.timezone} onChange={(e) => set("timezone", e.target.value)}>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z.replace(/_/g, " ")} ({formatOffset(zoneOffsetMinutes(z))})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Switch
            checked={s.skipIfRunning}
            onChange={(v) => set("skipIfRunning", v)}
            label="Skip if the last one is still running"
            description="Prevents duplicate runs piling up when a run takes longer than the interval."
          />
        </div>

        <aside className="rounded-lg bg-paper/70 p-4">
          <p className="text-[12px] font-medium text-ink-3">Next runs</p>
          <ol className="mt-2 space-y-2.5">
            {preview.map((d) => (
              <li key={d.toISOString()} className="text-[13px]">
                <span className="block font-medium text-ink">{fmtNext(d, s.timezone)}</span>
                {viewerTz !== s.timezone && <span className="block text-[12px] text-ink-3">{fmtNext(d, viewerTz)} your time</span>}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[12px] text-ink-3">As cron</p>
          <code className="font-mono text-[12.5px] text-ink-2">{toCron(s)}</code>
        </aside>
      </div>
    </Dialog>
  );
}

export function Schedules() {
  const { projectId, project } = useWorkspace();
  const key = projectId ? qk.schedules(projectId) : null;
  const q = useQuery(key, () => api.getSchedules(projectId));
  const canEdit = useCan("CREATE_RESEARCH_RUN");
  const viewerTz = useTimezone();
  const user = useSession((s) => s.user);
  const now = useNow(60_000);
  const [editing, setEditing] = useState<{ s: ResearchSchedule; isNew: boolean } | null>(null);

  async function toggle(s: ResearchSchedule, patch: Partial<ResearchSchedule>) {
    if (!key) return;
    const undo = setQueryData<ResearchSchedule[]>(key, (prev = []) => prev.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
    try {
      await api.saveSchedule({ ...s, ...patch }, false);
      if ("enabled" in patch) toast({ title: patch.enabled ? `${s.name} resumed` : `${s.name} paused` });
    } catch {
      undo();
      toast({ title: "Couldn't update the schedule", tone: "danger" });
    }
  }

  async function remove(s: ResearchSchedule) {
    if (!key) return;
    const undo = setQueryData<ResearchSchedule[]>(key, (prev = []) => prev.filter((x) => x.id !== s.id));
    try {
      await api.deleteSchedule(s.id);
      toast({
        title: `Deleted “${s.name}”`,
        description: "Past runs and their reports are kept.",
        action: {
          label: "Undo",
          onClick: async () => {
            await api.saveSchedule(s, true);
            invalidate("schedules:");
          },
        },
      });
    } catch {
      undo();
      toast({ title: "Couldn't delete", tone: "danger" });
    }
  }

  const list = q.data ?? [];

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        eyebrow={project?.name}
        title="Schedules"
        description="Questions worth asking again — weekly price checks, daily digests. Each schedule keeps its own timezone, so 9:00 means 9:00 where it matters."
        actions={
          canEdit && projectId ? (
            <Button variant="primary" icon={<CalendarPlus className="h-3.5 w-3.5" />} onClick={() => setEditing({ s: blank(projectId, viewerTz, user.name), isNew: true })}>
              New schedule
            </Button>
          ) : undefined
        }
      />

      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : !q.data ? (
        <div className="space-y-4">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong">
          <EmptyState
            drawing="calendar"
            title="Nothing on the calendar"
            action={
              canEdit && projectId ? (
                <Button variant="primary" onClick={() => setEditing({ s: blank(projectId, viewerTz, user.name), isNew: true })}>
                  Schedule a question
                </Button>
              ) : undefined
            }
          >
            Set up a question to run on a timetable and its reports will line up here.
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((s) => {
            const upcoming = now && s.enabled ? nextRuns(s, new Date(now), 3) : [];
            return (
              <Panel key={s.id} className={cn("transition-opacity", !s.enabled && "opacity-70")}>
                <div className="flex flex-col gap-5 p-5 md:flex-row md:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-semibold text-ink">{s.name}</h2>
                      {!s.enabled && <Badge>Paused</Badge>}
                      {s.lastOutcome === "COMPLETED" && <Badge tone="success">Last run completed</Badge>}
                      {s.lastOutcome === "FAILED" && <Badge tone="failure">Last run failed</Badge>}
                      {s.lastOutcome === "SKIPPED_DUPLICATE" && (
                        <Badge tone="process" title="The previous run was still going, so this tick was skipped">
                          Last tick skipped
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1.5 font-serif text-[16px] leading-snug text-ink-2">{s.questionText}</p>
                    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
                      <span className="font-medium text-ink-2">
                        {describeSchedule(s)} · {zoneLabel(s.timezone)} ({formatOffset(zoneOffsetMinutes(s.timezone))})
                      </span>
                      <code className="font-mono">{toCron(s)}</code>
                      {s.skipIfRunning && (
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" /> No duplicates
                        </span>
                      )}
                      {s.lastRunAt && (
                        <span>
                          last ran <RelativeTime iso={s.lastRunAt} />
                          {s.lastRunId && (
                            <>
                              {" · "}
                              <Link href={`/research/${s.lastRunId}`} className="underline decoration-line-strong underline-offset-2 hover:text-ink">
                                open run
                              </Link>
                            </>
                          )}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="w-full shrink-0 md:w-64">
                    <p className="text-[12px] font-medium text-ink-3">{s.enabled ? "Coming up" : "Paused — nothing scheduled"}</p>
                    <ol className="mt-1.5 space-y-1.5">
                      {upcoming.map((d, i) => (
                        <li key={d.toISOString()} className="text-[13px]">
                          <span className={cn("text-ink", i === 0 && "font-medium")}>{fmtNext(d, viewerTz)}</span>
                          {i === 0 && <span className="ml-1.5 text-[12px] text-ink-3">{formatRelativeTime(d.toISOString(), now)}</span>}
                        </li>
                      ))}
                    </ol>
                    {viewerTz !== s.timezone && s.enabled && <p className="mt-1.5 text-[11.5px] text-ink-3">Shown in your time ({zoneLabel(viewerTz)}).</p>}
                  </div>

                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-2 md:flex-col md:items-end">
                      <div className="w-36">
                        <Switch checked={s.enabled} onChange={(v) => void toggle(s, { enabled: v })} label={s.enabled ? "On" : "Off"} />
                      </div>
                      <Menu
                        label={`Actions for ${s.name}`}
                        align="end"
                        width={210}
                        sections={[
                          {
                            items: [
                              { key: "edit", label: "Edit", onSelect: () => setEditing({ s, isNew: false }) },
                              { key: "dup", label: s.skipIfRunning ? "Allow overlapping runs" : "Skip if still running", onSelect: () => void toggle(s, { skipIfRunning: !s.skipIfRunning }) },
                              { key: "del", label: "Delete schedule", danger: true, onSelect: () => void remove(s) },
                            ],
                          },
                        ]}
                        trigger={({ toggle: t, ...aria }) => (
                          <Button size="icon-sm" variant="ghost" onClick={t} {...aria} aria-label={`More actions for ${s.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        )}
                      />
                    </div>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {editing && <ScheduleDialog key={editing.s.id} initial={editing.s} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  );
}
