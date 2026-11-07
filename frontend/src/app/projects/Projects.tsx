"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, FolderPlus, Users } from "lucide-react";
import { api } from "@/lib/api/client";
import { invalidate } from "@/lib/api/query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/stores/toast.store";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/misc";
import { RelativeTime } from "@/components/ui/Time";
import { ErrorState } from "@/components/ui/states";

function NewProjectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameErr = name.trim().length < 3 ? "A short, specific name helps — e.g. “EU energy pricing”." : undefined;

  async function create() {
    setTried(true);
    if (nameErr) return;
    setSaving(true);
    try {
      const p = await api.createProject({ name: name.trim(), description: description.trim() });
      invalidate("projects");
      toast({ title: `Created ${p.name}`, description: "You're the owner. Invite people from Members.", tone: "success" });
      setName("");
      setDescription("");
      setTried(false);
      onCreated(p.id);
    } catch (err) {
      toast({ title: "Couldn't create the project", description: err instanceof Error ? err.message : undefined, tone: "danger" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New project"
      description="A project groups research, reports, sources and the people allowed to see them."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={create}>
            Create project
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Field label="Name" error={tried ? nameErr : undefined}>
          {(p) => <Input {...p} data-autofocus value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="What's it for?" optional hint="One or two sentences. It shows on the project card.">
          {(p) => <Textarea {...p} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

export function Projects() {
  const router = useRouter();
  const params = useSearchParams();
  const { projects, project, setProject, isLoading, error } = useWorkspace();
  const [creating, setCreating] = useState(params.get("new") === "1");

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        title="Projects"
        description="Switch between workspaces. Everything else in the app — runs, reports, sources, members — is scoped to the project you pick here."
        actions={
          <Button variant="primary" icon={<FolderPlus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New project
          </Button>
        }
      />

      {error && projects.length === 0 ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const current = p.id === project?.id;
            const rate = p.stats.totalRuns ? Math.round((p.stats.completedRuns / p.stats.totalRuns) * 100) : 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProject(p.id);
                  router.push("/");
                }}
                className={cn(
                  "group flex flex-col rounded-xl border bg-surface p-6 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md",
                  current ? "border-ink" : "border-line hover:border-line-strong"
                )}
                aria-current={current ? "true" : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-[22px] leading-snug font-medium text-ink">{p.name}</h2>
                  {current && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11.5px] font-medium text-paper">
                      <Check className="h-3 w-3" /> Current
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-[14px] text-ink-2">{p.description || "No description yet."}</p>
                <dl className="mt-auto grid grid-cols-4 gap-3 pt-6 text-[12px]">
                  {[
                    ["Runs", p.stats.totalRuns],
                    ["Finished", `${rate}%`],
                    ["Reports", p.stats.totalReports],
                    ["Sources", p.stats.totalSources],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <dt className="text-ink-3">{k}</dt>
                      <dd className="tnum mt-0.5 text-[16px] font-semibold text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 flex items-center gap-3 border-t border-line pt-3 text-[12.5px] text-ink-3">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {p.membersCount}
                  </span>
                  <span>
                    updated <RelativeTime iso={p.updatedAt} />
                  </span>
                </p>
              </button>
            );
          })}
        </div>
      )}

      <NewProjectDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          setProject(id);
          router.push("/");
        }}
      />
    </div>
  );
}
