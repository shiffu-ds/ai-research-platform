"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession, applyTheme } from "@/stores/session.store";
import { useUI } from "@/stores/ui.store";
import { useNotifications } from "@/stores/notification.store";
import { useHotkeys } from "@/hooks/useHotkeys";
import { api } from "@/lib/api/client";
import { can } from "@/types/rbac.types";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { NotificationsSheet } from "./NotificationsSheet";
import { Toaster } from "./Toaster";
import { ALL_NAV_ITEMS } from "./nav";

function GlobalShortcuts() {
  const router = useRouter();
  const toggle = useUI((s) => s.toggle);
  const open = useUI((s) => s.open);
  const toggleSidebar = useSession((s) => s.toggleSidebar);
  const role = useSession((s) => s.role);

  const map: Record<string, () => void> = {
    "mod+k": () => toggle("command"),
    "?": () => toggle("shortcuts"),
    "[": toggleSidebar,
    i: () => open("notifications"),
    n: () => {
      if (can(role, "CREATE_RESEARCH_RUN")) router.push("/research/new");
    },
  };
  for (const item of ALL_NAV_ITEMS) map[item.keys] = () => router.push(item.href);

  useHotkeys(map, { allowInInputs: ["mod+k"] });
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const load = useNotifications((s) => s.load);

  useEffect(() => {
    // Rehydrate persisted preferences only after the first client render.
    void Promise.resolve(useSession.persist.rehydrate()).then(() => applyTheme(useSession.getState().theme));
    api
      .getNotifications()
      .then(load)
      .catch(() => load([]));
  }, [load]);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" tabIndex={-1} className="flex-1 px-4 pt-6 pb-16 focus:outline-none sm:px-8 sm:pt-8">
          {children}
        </main>
      </div>
      <GlobalShortcuts />
      <CommandPalette />
      <ShortcutsDialog />
      <NotificationsSheet />
      <Toaster />
    </div>
  );
}
