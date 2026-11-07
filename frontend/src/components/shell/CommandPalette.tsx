"use client";

/**
 * ⌘K. Jump anywhere, find a run or report by its words, or do the
 * common things (start research, switch project, change theme) without
 * leaving the keyboard.
 */

import { useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, FlaskConical, BookOpenText, Plus, Moon, Sun, Monitor, Eye, FolderKanban, Keyboard, CornerDownLeft } from "lucide-react";
import { useUI } from "@/stores/ui.store";
import { useSession } from "@/stores/session.store";
import { useQuery } from "@/lib/api/query";
import { api } from "@/lib/api/client";
import { qk, useWorkspace } from "@/hooks/useWorkspace";
import { can, ROLES, ROLE_META } from "@/types/rbac.types";
import { STATE_LABEL } from "@/types/research.types";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/utils/cn";
import { Kbd } from "@/components/ui/misc";
import { ALL_NAV_ITEMS } from "./nav";

interface Command {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void;
}

/** Subsequence match with a bonus for word starts; 0 = no match. */
export function score(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const t = text.toLowerCase();
  if (t.includes(q)) return 100 - t.indexOf(q);
  let ti = 0;
  let s = 0;
  for (const ch of q) {
    if (ch === " ") continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return 0;
    s += found === 0 || t[found - 1] === " " ? 3 : 1;
    ti = found + 1;
  }
  // Scattered letters aren't a match; initials-style hits (word starts) are.
  return s >= q.replace(/\s/g, "").length * 2 ? s : 0;
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const role = useSession((s) => s.role);
  const setRole = useSession((s) => s.setRole);
  const setTheme = useSession((s) => s.setTheme);
  const openOverlay = useUI((s) => s.open);
  const { projects, setProject, project } = useWorkspace();
  const runs = useQuery(qk.runs(), () => api.getResearchRuns());
  const reports = useQuery(qk.reports(), () => api.getReports());

  const go = (href: string) => () => {
    router.push(href);
    onClose();
  };

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    if (can(role, "CREATE_RESEARCH_RUN")) {
      list.push({ id: "new-run", group: "Actions", label: "Start new research", icon: <Plus className="h-4 w-4" />, keywords: "create run question", run: go("/research/new") });
    }
    for (const item of ALL_NAV_ITEMS) {
      if (item.requires && !can(role, item.requires)) continue;
      const Icon = item.icon;
      list.push({ id: `nav-${item.href}`, group: "Go to", label: item.label, sub: item.keys, icon: <Icon className="h-4 w-4" />, run: go(item.href) });
    }
    for (const r of runs.data ?? []) {
      list.push({
        id: `run-${r.id}`,
        group: "Research runs",
        label: r.questionText,
        sub: STATE_LABEL[r.state],
        icon: <FlaskConical className="h-4 w-4" />,
        keywords: `${r.id} ${r.creatorName}`,
        run: go(`/research/${r.id}`),
      });
    }
    for (const r of reports.data ?? []) {
      list.push({ id: `rep-${r.id}`, group: "Reports", label: r.title, sub: `v${r.currentVersion}`, icon: <BookOpenText className="h-4 w-4" />, run: go(`/reports/${r.id}`) });
    }
    for (const p of projects) {
      if (p.id === project?.id) continue;
      list.push({
        id: `proj-${p.id}`,
        group: "Switch project",
        label: p.name,
        icon: <FolderKanban className="h-4 w-4" />,
        run: () => {
          setProject(p.id);
          onClose();
        },
      });
    }
    list.push(
      { id: "theme-light", group: "Preferences", label: "Use light theme", icon: <Sun className="h-4 w-4" />, keywords: "appearance", run: () => { setTheme("light"); onClose(); } },
      { id: "theme-dark", group: "Preferences", label: "Use dark theme", icon: <Moon className="h-4 w-4" />, keywords: "appearance night", run: () => { setTheme("dark"); onClose(); } },
      { id: "theme-system", group: "Preferences", label: "Match system theme", icon: <Monitor className="h-4 w-4" />, keywords: "appearance auto", run: () => { setTheme("system"); onClose(); } },
      { id: "shortcuts", group: "Preferences", label: "Keyboard shortcuts", sub: "?", icon: <Keyboard className="h-4 w-4" />, run: () => openOverlay("shortcuts") }
    );
    for (const r of ROLES) {
      if (r === role) continue;
      list.push({
        id: `role-${r}`,
        group: "Preview as role",
        label: `Preview as ${ROLE_META[r].label}`,
        sub: ROLE_META[r].blurb,
        icon: <Eye className="h-4 w-4" />,
        keywords: "rbac permission",
        run: () => {
          setRole(r);
          onClose();
        },
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, runs.data, reports.data, projects, project?.id]);

  const results = useMemo(() => {
    const scored = commands
      .map((c) => ({ c, s: score(query, `${c.label} ${c.keywords ?? ""} ${c.group}`) }))
      .filter((x) => x.s > 0);
    if (query.trim()) scored.sort((a, b) => b.s - a.s);
    const limitPerGroup = query.trim() ? 6 : 4;
    const counts: Record<string, number> = {};
    return scored
      .map((x) => x.c)
      .filter((c) => {
        if (!query.trim() && (c.group === "Preview as role" || c.group === "Preferences")) return false;
        counts[c.group] = (counts[c.group] ?? 0) + 1;
        return counts[c.group] <= limitPerGroup;
      });
  }, [commands, query]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup: Record<string, Command[]> = {};
    for (const c of results) {
      if (!byGroup[c.group]) {
        byGroup[c.group] = [];
        order.push(c.group);
      }
      byGroup[c.group].push(c);
    }
    return order.map((g) => ({ group: g, items: byGroup[g] }));
  }, [results]);

  const flat = groups.flatMap((g) => g.items);
  const safeActive = Math.min(active, Math.max(0, flat.length - 1));

  const scrollIntoView = (i: number) => {
    listRef.current?.querySelector(`[data-index="${i}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const groupOffsets = groups.reduce<number[]>((acc, g, i) => [...acc, i === 0 ? 0 : acc[i - 1] + groups[i - 1].items.length], []);

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center px-3 pt-[12vh]">
      <div className="absolute inset-0 animate-fade bg-overlay" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        className="relative w-full max-w-[600px] animate-pop overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                const n = (safeActive + 1) % Math.max(1, flat.length);
                setActive(n);
                scrollIntoView(n);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const n = (safeActive - 1 + flat.length) % Math.max(1, flat.length);
                setActive(n);
                scrollIntoView(n);
              } else if (e.key === "Enter") {
                e.preventDefault();
                flat[safeActive]?.run();
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search runs and reports, or type a command…"
            className="h-13 w-full bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={flat[safeActive] ? `cmd-${flat[safeActive].id}` : undefined}
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} id="command-results" role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
          {flat.length === 0 && (
            <p className="px-3 py-10 text-center text-[13.5px] text-ink-3">
              Nothing matches &ldquo;{query}&rdquo;. Try fewer words.
            </p>
          )}
          {groups.map((g, gi) => (
            <div key={g.group} className="mb-1">
              <div className="px-3 pt-2 pb-1 text-[11.5px] font-medium text-ink-3">{g.group}</div>
              {g.items.map((c, ci) => {
                const i = groupOffsets[gi] + ci;
                const isActive = i === safeActive;
                return (
                  <div
                    key={c.id}
                    id={`cmd-${c.id}`}
                    data-index={i}
                    role="option"
                    aria-selected={isActive}
                    onMouseMove={() => setActive(i)}
                    onClick={() => c.run()}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[13.5px]",
                      isActive ? "bg-sunken text-ink" : "text-ink-2"
                    )}
                  >
                    <span className={cn("shrink-0", isActive ? "text-ink" : "text-ink-3")}>{c.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    {c.sub && <span className="max-w-[40%] shrink-0 truncate text-[12px] text-ink-3">{c.sub}</span>}
                    {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-3" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-paper/60 px-4 py-2 text-[12px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to move
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>
              <CornerDownLeft className="h-3 w-3" />
            </Kbd>{" "}
            to open
          </span>
        </div>
      </div>
    </div>
  );
}

export function CommandPalette() {
  const open = useUI((s) => s.overlay === "command");
  const close = useUI((s) => s.close);
  const hydrated = useHydrated();
  if (!open || !hydrated) return null;
  return createPortal(<Palette onClose={close} />, document.body);
}
