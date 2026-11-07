"use client";

import { useRouter } from "next/navigation";
import { Monitor, Moon, Sun, Settings2, Keyboard, Eye } from "lucide-react";
import { useSession } from "@/stores/session.store";
import { useUI } from "@/stores/ui.store";
import { ROLES, ROLE_META } from "@/types/rbac.types";
import { Menu } from "@/components/ui/Menu";
import { Avatar } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";

export function UserMenu({ collapsed }: { collapsed?: boolean }) {
  const user = useSession((s) => s.user);
  const role = useSession((s) => s.role);
  const theme = useSession((s) => s.theme);
  const setRole = useSession((s) => s.setRole);
  const setTheme = useSession((s) => s.setTheme);
  const openOverlay = useUI((s) => s.open);
  const router = useRouter();

  return (
    <Menu
      label="Account"
      width={264}
      side="top"
      sections={[
        {
          label: "Preview the app as…",
          items: ROLES.map((r) => ({
            key: r,
            label: ROLE_META[r].label,
            hint: r === "OWNER" ? "you" : undefined,
            icon: <Eye className="h-3.5 w-3.5" />,
            selected: r === role,
            onSelect: () => setRole(r),
          })),
        },
        {
          label: "Theme",
          items: [
            { key: "system", label: "Match system", icon: <Monitor className="h-3.5 w-3.5" />, selected: theme === "system", onSelect: () => setTheme("system") },
            { key: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" />, selected: theme === "light", onSelect: () => setTheme("light") },
            { key: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" />, selected: theme === "dark", onSelect: () => setTheme("dark") },
          ],
        },
        {
          items: [
            { key: "shortcuts", label: "Keyboard shortcuts", hint: "?", icon: <Keyboard className="h-3.5 w-3.5" />, onSelect: () => openOverlay("shortcuts") },
            { key: "settings", label: "Settings", icon: <Settings2 className="h-3.5 w-3.5" />, onSelect: () => router.push("/settings") },
          ],
        },
      ]}
      footer="Role preview only changes what this browser shows. The API still enforces real permissions."
      trigger={({ toggle, ...aria }) => (
        <button
          type="button"
          onClick={toggle}
          {...aria}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md text-left transition-colors hover:bg-surface",
            collapsed ? "h-9 w-9 justify-center" : "px-2 py-1.5"
          )}
          aria-label={`${user.name}, viewing as ${ROLE_META[role].label}. Account menu`}
        >
          <Avatar name={user.name} size={26} />
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
              <span className="block truncate text-[11.5px] text-ink-3">
                {role === "OWNER" ? "Owner" : <>Previewing as <span className="font-medium text-accent">{ROLE_META[role].label}</span></>}
              </span>
            </span>
          )}
        </button>
      )}
    />
  );
}
