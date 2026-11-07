"use client";

import { Bell, Menu as MenuIcon, Plus, Search } from "lucide-react";
import { useUI } from "@/stores/ui.store";
import { useNotifications, selectUnreadCount } from "@/stores/notification.store";
import { useCan } from "@/hooks/useSession";
import { useHydrated } from "@/hooks/useHydrated";
import { modKeyLabel } from "@/hooks/useHotkeys";
import { ButtonLink } from "@/components/ui/Button";
import { Kbd, Tip } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/Dialog";
import { Logo } from "./Logo";
import { NavList, ProjectSwitcher } from "./Sidebar";
import { SystemStatus } from "./SystemStatus";
import { UserMenu } from "./UserMenu";

function MobileNav() {
  const open = useUI((s) => s.overlay === "mobile-nav");
  const close = useUI((s) => s.close);
  return (
    <Sheet open={open} onClose={close} side="left" width="sm" title="Menu">
      <div className="space-y-5 p-3">
        <ProjectSwitcher />
        <NavList onNavigate={close} />
        <div className="border-t border-line pt-3">
          <SystemStatus />
          <UserMenu />
        </div>
      </div>
    </Sheet>
  );
}

export function Topbar() {
  const openOverlay = useUI((s) => s.open);
  const unread = useNotifications(selectUnreadCount);
  const canCreate = useCan("CREATE_RESEARCH_RUN");
  const hydrated = useHydrated();
  const mod = hydrated ? modKeyLabel() : "Ctrl";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        className="-ml-1 rounded-md p-2 text-ink-2 hover:bg-sunken lg:hidden"
        onClick={() => openOverlay("mobile-nav")}
        aria-label="Open menu"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <span className="lg:hidden">
        <Logo size={24} />
      </span>

      <button
        type="button"
        onClick={() => openOverlay("command")}
        className="group ml-auto flex h-8.5 w-full max-w-[420px] items-center gap-2.5 rounded-md border border-line bg-surface px-3 text-[13.5px] text-ink-3 shadow-sm transition-colors hover:border-line-strong lg:ml-0"
        aria-label="Search and commands"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 truncate text-left">Search or jump to…</span>
        <span className="hidden items-center gap-0.5 sm:flex">
          <Kbd>{mod}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="flex items-center gap-1.5 lg:ml-auto">
        <Tip content={unread ? `${unread} unread` : "Inbox"} side="bottom">
          <button
            type="button"
            onClick={() => openOverlay("notifications")}
            className="relative rounded-md p-2 text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            aria-label={unread ? `Inbox, ${unread} unread` : "Inbox"}
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
            {unread > 0 && (
              <span className="tnum absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </Tip>
        {canCreate && (
          <ButtonLink href="/research/new" variant="primary" size="md" icon={<Plus className="h-3.5 w-3.5" />} className="hidden sm:inline-flex">
            New research
          </ButtonLink>
        )}
      </div>
      <MobileNav />
    </header>
  );
}
