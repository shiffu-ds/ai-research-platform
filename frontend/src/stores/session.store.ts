"use client";

/**
 * Who is using the app and how they like it. Persisted to localStorage;
 * hydration is deferred (skipHydration) and triggered from <Providers/>
 * so the server render and the first client render always agree.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Role } from "@/types/rbac.types";
import { DEMO_USER } from "@/lib/api/mock-data";
import { applyTheme, type ThemePreference } from "@/lib/theme";

export { applyTheme, type ThemePreference };

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  title?: string;
}

interface SessionState {
  user: UserProfile;
  /**
   * The role the UI renders for. Until real auth lands this doubles as a
   * "preview as role" control so the permission gates can be exercised.
   */
  role: Role;
  /** Empty string = follow the browser */
  timezone: string;
  theme: ThemePreference;
  sidebarCollapsed: boolean;
  currentProjectId: string | null;
  setRole: (role: Role) => void;
  setTimezone: (tz: string) => void;
  setTheme: (theme: ThemePreference) => void;
  toggleSidebar: () => void;
  setCurrentProjectId: (id: string) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: DEMO_USER,
      role: "OWNER",
      timezone: "",
      theme: "system",
      sidebarCollapsed: false,
      currentProjectId: null,
      setRole: (role) => set({ role }),
      setTimezone: (timezone) => set({ timezone }),
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),
    }),
    {
      name: "arp.session",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        role: s.role,
        timezone: s.timezone,
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        currentProjectId: s.currentProjectId,
      }),
    }
  )
);
