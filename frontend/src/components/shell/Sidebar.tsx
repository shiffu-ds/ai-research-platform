"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/stores/session.store";
import { can } from "@/types/rbac.types";
import { isRunActive } from "@/types/research.types";
import { useWorkspace, qk } from "@/hooks/useWorkspace";
import { useQuery } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { Menu } from "@/components/ui/Menu";
import { Tip } from "@/components/ui/misc";
import { Logo } from "./Logo";
import { NAV, isActivePath } from "./nav";
import { SystemStatus } from "./SystemStatus";
import { UserMenu } from "./UserMenu";

function useBadges(projectId?: string) {
  const runs = useQuery(projectId ? qk.runs(projectId) : null, () => api.getResearchRuns(projectId));
  const reports = useQuery(projectId ? qk.reports(projectId) : null, () => api.getReports(projectId));
  const decisions = useQuery(qk.allDecisions, api.getAllDecisions);
  const activeRuns = (runs.data ?? []).filter((r) => isRunActive(r.state)).length;
  const pendingDecisions = (reports.data ?? []).filter(
    (r) => !(decisions.data ?? []).some((d) => d.reportVersionId === r.latestVersionId)
  ).length;
  return { activeRuns, pendingDecisions };
}

export function ProjectSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { projects, project, setProject, isLoading } = useWorkspace();
  const router = useRouter();

  return (
    <Menu
      label="Switch project"
      width={272}
      sections={[
        {
          label: "Projects",
          items: projects.map((p) => ({
            key: p.id,
            label: (
              <span className="flex flex-col">
                <span className="truncate font-medium">{p.name}</span>
                <span className="text-[12px] text-ink-3">
                  {p.stats.totalRuns} runs · {p.stats.totalReports} reports
                </span>
              </span>
            ),
            selected: p.id === project?.id,
            onSelect: () => setProject(p.id),
          })),
        },
        {
          items: [
            {
              key: "all",
              label: "All projects",
              icon: <ChevronsUpDown className="h-3.5 w-3.5" />,
              onSelect: () => router.push("/projects"),
            },
            {
              key: "new",
              label: "New project",
              icon: <Plus className="h-3.5 w-3.5" />,
              onSelect: () => router.push("/projects?new=1"),
            },
          ],
        },
      ]}
      trigger={({ toggle, ...aria }) => (
        <button
          type="button"
          onClick={toggle}
          {...aria}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border border-transparent text-left transition-colors hover:border-line hover:bg-surface",
            collapsed ? "justify-center p-1.5" : "px-2 py-1.5"
          )}
          aria-label={`Current project: ${project?.name ?? "loading"}. Switch project`}
        >
          <Logo />
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-ink">
                {isLoading ? <span className="skeleton inline-block h-3.5 w-32 align-middle" /> : project?.name ?? "No project"}
              </span>
              <span className="block truncate text-[11.5px] text-ink-3">AI Research Platform</span>
            </span>
          )}
          {!collapsed && <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-3" />}
        </button>
      )}
    />
  );
}

export function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = useSession((s) => s.role);
  const { projectId } = useWorkspace();
  const badges = useBadges(projectId);

  return (
    <nav aria-label="Main" className="space-y-5">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.requires || can(role, i.requires));
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            {!collapsed && <div className="mb-1 px-2.5 text-[11.5px] font-medium text-ink-3">{group.label}</div>}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                const count = item.badge ? badges[item.badge] : 0;
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md text-[13.5px] transition-colors",
                      collapsed ? "h-9 w-9 justify-center" : "h-8 px-2.5",
                      active ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-2 hover:bg-surface/70 hover:text-ink"
                    )}
                  >
                    {active && !collapsed && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r bg-accent" aria-hidden />}
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-ink" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={1.8} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {count > 0 && !collapsed && (
                      <span
                        className={cn(
                          "tnum rounded-full px-1.5 text-[11px] font-semibold leading-[18px]",
                          item.badge === "activeRuns" ? "bg-st-process-soft text-st-process" : "bg-accent-soft text-accent"
                        )}
                        aria-label={item.badge === "activeRuns" ? `${count} running` : `${count} awaiting a decision`}
                      >
                        {count}
                      </span>
                    )}
                    {count > 0 && collapsed && (
                      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                    )}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? <Tip content={item.label}>{link}</Tip> : link}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const collapsed = useSession((s) => s.sidebarCollapsed);
  const toggle = useSession((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-paper transition-[width] duration-200 lg:flex",
        collapsed ? "w-[60px] items-center px-2" : "w-[244px] px-3"
      )}
      aria-label="Sidebar"
    >
      <div className={cn("pt-3 pb-4", collapsed ? "" : "w-full")}>
        <ProjectSwitcher collapsed={collapsed} />
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto pb-4", !collapsed && "w-full")}>
        <NavList collapsed={collapsed} />
      </div>

      <div className={cn("space-y-1 border-t border-line py-3", !collapsed && "w-full")}>
        {collapsed ? <SystemStatus compact /> : <SystemStatus />}
        <UserMenu collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "flex items-center gap-2 rounded-md text-[12.5px] text-ink-3 transition-colors hover:bg-surface hover:text-ink",
            collapsed ? "h-8 w-8 justify-center" : "h-7 w-full px-2.5"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title="Toggle sidebar  ["
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

