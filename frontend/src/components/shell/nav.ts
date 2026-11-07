import {
  Home,
  FlaskConical,
  BookOpenText,
  Library,
  CalendarClock,
  Users,
  FolderKanban,
  Activity,
  Gauge,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import type { Action } from "@/types/rbac.types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Keyboard sequence, e.g. "g r" */
  keys: string;
  /** Hide unless the role can do this */
  requires?: Action;
  badge?: "activeRuns" | "pendingDecisions";
}

export const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/", icon: Home, keys: "g o" },
      { label: "Research", href: "/research", icon: FlaskConical, keys: "g r", badge: "activeRuns" },
      { label: "Reports", href: "/reports", icon: BookOpenText, keys: "g p", badge: "pendingDecisions" },
      { label: "Sources", href: "/sources", icon: Library, keys: "g s" },
      { label: "Schedules", href: "/schedules", icon: CalendarClock, keys: "g c" },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "Members", href: "/members", icon: Users, keys: "g m" },
      { label: "Projects", href: "/projects", icon: FolderKanban, keys: "g j" },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Observability", href: "/analytics", icon: Activity, keys: "g a", requires: "VIEW_AUDIT_LOG" },
      { label: "Quality gates", href: "/evaluation", icon: Gauge, keys: "g q" },
      { label: "Settings", href: "/settings", icon: Settings2, keys: "g ," },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV.flatMap((g) => g.items);

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
