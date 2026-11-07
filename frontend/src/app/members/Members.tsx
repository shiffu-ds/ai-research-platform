"use client";

import { useState } from "react";
import { Check, Minus, UserPlus, MoreHorizontal, Search } from "lucide-react";
import { useQuery, invalidate, setQueryData } from "@/lib/api/query";
import { api, ApiError } from "@/lib/api/client";
import { qk, useWorkspace } from "@/hooks/useWorkspace";
import { useCan } from "@/hooks/useSession";
import { useSession } from "@/stores/session.store";
import { useNotifications } from "@/stores/notification.store";
import { toast } from "@/stores/toast.store";
import { ROLES, ROLE_META, PERMISSION_MATRIX, ACTION_LABEL, type Action, type Role } from "@/types/rbac.types";
import type { ProjectMember } from "@/types/project.types";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { Avatar, Skeleton } from "@/components/ui/misc";
import { RelativeTime } from "@/components/ui/Time";
import { ErrorState } from "@/components/ui/states";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function InviteDialog({ open, onClose, projectId, existing }: { open: boolean; onClose: () => void; projectId: string; existing: ProjectMember[] }) {
  const user = useSession((s) => s.user);
  const push = useNotifications((s) => s.push);
  const { project } = useWorkspace();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("RESEARCHER");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const dup = existing.some((m) => m.status !== "REMOVED" && m.userEmail.toLowerCase() === email.trim().toLowerCase());
  const nameErr = name.trim().length < 2 ? "Their name, as teammates know it." : undefined;
  const emailErr = !EMAIL.test(email.trim()) ? "That doesn't look like an email address." : dup ? "They're already on this project." : undefined;
  const assignable = ROLES.filter((r) => r !== "OWNER");

  async function submit() {
    setTried(true);
    if (nameErr || emailErr) return;
    setSaving(true);
    try {
      const m = await api.inviteMember(projectId, { name: name.trim(), email: email.trim(), role }, user.id);
      invalidate(`members:${projectId}`);
      push({ type: "MEMBER_INVITED", severity: "INFO", title: `${m.userName} invited as ${ROLE_META[role].label}`, message: `Invitation sent to ${m.userEmail}.`, projectId, projectName: project?.name, resourceId: m.id, resourceType: "member" });
      toast({ title: "Invitation sent", description: `${m.userName} will appear as invited until they accept.`, tone: "success" });
      setName("");
      setEmail("");
      setTried(false);
      onClose();
    } catch (err) {
      toast({ title: "Couldn't invite", description: err instanceof ApiError ? err.friendly : undefined, tone: "danger" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite someone"
      description={`They'll get access to ${project?.name ?? "this project"} only.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            Send invite
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Name" error={tried ? nameErr : undefined}>
          {(p) => <Input {...p} data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Fatima Noor" autoComplete="off" />}
        </Field>
        <Field label="Email" error={tried ? emailErr : undefined}>
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="off" />}
        </Field>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink">Role</legend>
          <div className="space-y-1.5">
            {assignable.map((r) => (
              <label key={r} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors", role === r ? "border-ink bg-paper/60" : "border-line hover:border-line-strong")}>
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-[var(--ink)]" />
                <span>
                  <span className="block text-[13.5px] font-medium text-ink">{ROLE_META[r].label}</span>
                  <span className="block text-[12.5px] text-ink-3">{ROLE_META[r].blurb}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function PermissionMatrix({ highlight }: { highlight: Role }) {
  const actions = Object.keys(ACTION_LABEL) as Action[];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-line">
            <th className="py-2.5 pr-4 pl-5 text-left text-[12px] font-medium text-ink-3">Can…</th>
            {ROLES.map((r) => (
              <th key={r} className={cn("px-2 py-2.5 text-center text-[12px] font-medium", r === highlight ? "text-ink" : "text-ink-3")}>
                {ROLE_META[r].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {actions.map((a) => (
            <tr key={a}>
              <td className="py-2 pr-4 pl-5 text-ink-2">{ACTION_LABEL[a]}</td>
              {ROLES.map((r) => (
                <td key={r} className={cn("px-2 py-2 text-center", r === highlight && "bg-paper/70")}>
                  {PERMISSION_MATRIX[r][a] ? (
                    <Check className="mx-auto h-4 w-4 text-st-success" aria-label="Yes" />
                  ) : (
                    <Minus className="mx-auto h-4 w-4 text-line-strong" aria-label="No" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-5 py-3 text-[12px] text-ink-3">Researchers can cancel only runs they started. The API enforces all of this; the app just mirrors it.</p>
    </div>
  );
}

export function Members() {
  const { projectId, project } = useWorkspace();
  const key = projectId ? qk.members(projectId) : null;
  const members = useQuery(key, () => api.getMembers(projectId!));
  const canManage = useCan("MANAGE_MEMBERS");
  const me = useSession((s) => s.user);
  const myRole = useSession((s) => s.role);
  const [inviting, setInviting] = useState(false);
  const [query, setQuery] = useState("");

  const list = (members.data ?? []).filter((m) => m.status !== "REMOVED");
  const owners = list.filter((m) => m.role === "OWNER");
  const visible = list.filter((m) => `${m.userName} ${m.userEmail} ${m.role}`.toLowerCase().includes(query.trim().toLowerCase()));

  async function changeRole(m: ProjectMember, role: Role) {
    if (!key || role === m.role) return;
    const undo = setQueryData<ProjectMember[]>(key, (prev = []) => prev.map((x) => (x.id === m.id ? { ...x, role } : x)));
    try {
      await api.updateMemberRole(m.projectId, m.id, role);
      toast({ title: `${m.userName} is now ${ROLE_META[role].label === "Admin" ? "an" : "a"} ${ROLE_META[role].label.toLowerCase()}` });
    } catch (err) {
      undo();
      toast({ title: "Role not changed", description: err instanceof ApiError ? err.friendly : undefined, tone: "danger" });
    }
  }

  async function remove(m: ProjectMember) {
    if (!key) return;
    const prevStatus = m.status;
    const undo = setQueryData<ProjectMember[]>(key, (prev = []) => prev.map((x) => (x.id === m.id ? { ...x, status: "REMOVED" } : x)));
    try {
      await api.removeMember(m.projectId, m.id);
      toast({
        title: `${m.userName} removed`,
        description: "They lose access straight away.",
        action: {
          label: "Undo",
          onClick: async () => {
            await api.restoreMember(m.projectId, m.id, prevStatus);
            invalidate(key);
          },
        },
      });
    } catch (err) {
      undo();
      toast({ title: "Couldn't remove", description: err instanceof ApiError ? err.friendly : undefined, tone: "danger" });
    }
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        eyebrow={project?.name}
        title="Members"
        description="Who can see this project and what they can do in it."
        actions={
          canManage ? (
            <Button variant="primary" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setInviting(true)}>
              Invite
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6">
        <Panel>
          <PanelHeader
            title={members.data ? `${list.length} people` : "People"}
            actions={
              <div className="relative w-48 sm:w-60">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find someone" className="h-7.5 pl-8 text-[13px]" aria-label="Find a member" />
              </div>
            }
          />
          {members.error && !members.data ? (
            <ErrorState error={members.error} onRetry={members.refetch} />
          ) : !members.data ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((m) => {
                const isMe = m.userId === me.id;
                const lastOwner = m.role === "OWNER" && owners.length === 1;
                const editable = canManage && !isMe && !lastOwner && !(m.role === "OWNER" && myRole !== "OWNER");
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                    <Avatar name={m.userName} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
                        {m.userName}
                        {isMe && <span className="text-[12px] font-normal text-ink-3">(you)</span>}
                        {m.status === "INVITED" && <Badge tone="process">Invited</Badge>}
                      </p>
                      <p className="truncate text-[12.5px] text-ink-3">
                        {m.userEmail} · joined <RelativeTime iso={m.createdAt} />
                      </p>
                    </div>
                    {editable ? (
                      <Select
                        value={m.role}
                        onChange={(e) => void changeRole(m, e.target.value as Role)}
                        className="h-8 w-36 text-[13px]"
                        aria-label={`Role for ${m.userName}`}
                      >
                        {ROLES.filter((r) => r !== "OWNER" || myRole === "OWNER").map((r) => (
                          <option key={r} value={r}>
                            {ROLE_META[r].label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="w-36 text-[13px] text-ink-2" title={lastOwner ? "A project always needs an owner." : isMe ? "You can't change your own role." : undefined}>
                        {ROLE_META[m.role].label}
                      </span>
                    )}
                    {editable ? (
                      <Menu
                        label={`Actions for ${m.userName}`}
                        align="end"
                        width={200}
                        sections={[{ items: [{ key: "remove", label: "Remove from project", danger: true, onSelect: () => void remove(m) }] }]}
                        trigger={({ toggle, ...aria }) => (
                          <button type="button" onClick={toggle} {...aria} className="rounded-md p-1.5 text-ink-3 hover:bg-sunken hover:text-ink" aria-label={`More actions for ${m.userName}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        )}
                      />
                    ) : (
                      <span className="w-7" aria-hidden />
                    )}
                  </li>
                );
              })}
              {visible.length === 0 && <li className="px-5 py-8 text-center text-[13.5px] text-ink-3">No one matches “{query}”.</li>}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="What each role can do" description={`Your column is shaded — you're viewing as ${ROLE_META[myRole].label.toLowerCase()}.`} />
          <PermissionMatrix highlight={myRole} />
        </Panel>
      </div>

      {projectId && <InviteDialog open={inviting} onClose={() => setInviting(false)} projectId={projectId} existing={members.data ?? []} />}
    </div>
  );
}
