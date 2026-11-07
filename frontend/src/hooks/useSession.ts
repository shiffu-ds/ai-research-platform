"use client";

import { useSession } from "@/stores/session.store";
import { can, type Action } from "@/types/rbac.types";
import { getDefaultTimezone } from "@/lib/utils/timezone";
import { useHydrated } from "./useHydrated";

/** The viewer's timezone (explicit preference, or the browser's). UTC on the server. */
export function useTimezone(): string {
  const tz = useSession((s) => s.timezone);
  const hydrated = useHydrated();
  if (!hydrated) return "UTC";
  return tz || getDefaultTimezone();
}

export function useCan(action: Action): boolean {
  const role = useSession((s) => s.role);
  return can(role, action);
}
