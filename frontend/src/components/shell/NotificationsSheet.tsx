"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCheck, CircleAlert, CircleCheck, CircleX, Info } from "lucide-react";
import { Sheet } from "@/components/ui/Dialog";
import { Segmented } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { RelativeTime } from "@/components/ui/Time";
import { EmptyState } from "@/components/ui/states";
import { useUI } from "@/stores/ui.store";
import { useNotifications } from "@/stores/notification.store";
import { NOTIFICATION_META, notificationHref, type PlatformNotification } from "@/types/notification.types";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils/cn";

const severityIcon = {
  INFO: <Info className="h-4 w-4 text-st-intake" />,
  SUCCESS: <CircleCheck className="h-4 w-4 text-st-success" />,
  WARNING: <CircleAlert className="h-4 w-4 text-st-process" />,
  ERROR: <CircleX className="h-4 w-4 text-st-failure" />,
};

type Filter = "all" | "unread" | "action";

function groupByDay(items: PlatformNotification[], now: number) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const week = today - 6 * 86_400_000;
  const groups: { label: string; items: PlatformNotification[] }[] = [
    { label: "Today", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const n of items) {
    const t = new Date(n.createdAt).getTime();
    groups[t >= today ? 0 : t >= week ? 1 : 2].items.push(n);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function NotificationsSheet() {
  const open = useUI((s) => s.overlay === "notifications");
  const close = useUI((s) => s.close);
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");
  const now = useNow(60_000);

  const filtered = useMemo(
    () =>
      notifications.filter((n) =>
        filter === "unread" ? !n.isRead : filter === "action" ? NOTIFICATION_META[n.type].needsAction : true
      ),
    [notifications, filter]
  );
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Inbox"
      description={unread ? `${unread} unread` : "You're all caught up"}
      headerExtra={
        unread > 0 ? (
          <Button size="sm" variant="ghost" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={markAllAsRead}>
            Mark all read
          </Button>
        ) : null
      }
    >
      <div className="sticky top-0 z-10 border-b border-line bg-surface px-5 py-2.5">
        <Segmented
          label="Filter notifications"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: `Unread${unread ? ` · ${unread}` : ""}` },
            { value: "action", label: "Needs you" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nothing here" drawing="notebook">
          {filter === "all" ? "Run updates, review requests and team changes will show up here." : "Nothing matches this filter."}
        </EmptyState>
      ) : (
        <div className="pb-6">
          {groupByDay(filtered, now).map((g) => (
            <section key={g.label}>
              <h3 className="px-5 pt-4 pb-1.5 text-[12px] font-medium text-ink-3">{g.label}</h3>
              <ul>
                {g.items.map((n) => {
                  const href = notificationHref(n);
                  const body = (
                    <div className="flex gap-3">
                      <span className="mt-0.5 shrink-0">{severityIcon[n.severity]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className={cn("text-[13.5px] text-ink", !n.isRead && "font-semibold")}>{n.title}</p>
                          <RelativeTime iso={n.createdAt} className="shrink-0 text-[12px] text-ink-3" />
                        </div>
                        <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{n.message}</p>
                        {n.projectName && <p className="mt-1 text-[12px] text-ink-3">{n.projectName}</p>}
                      </div>
                      {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                    </div>
                  );
                  const cls = cn(
                    "block px-5 py-3 transition-colors hover:bg-sunken/70 focus-visible:bg-sunken",
                    !n.isRead && "bg-accent-soft/35"
                  );
                  return (
                    <li key={n.id} className="border-b border-line/70 last:border-b-0">
                      {href ? (
                        <Link
                          href={href}
                          className={cls}
                          onClick={() => {
                            markAsRead(n.id);
                            close();
                          }}
                        >
                          {body}
                        </Link>
                      ) : (
                        <button type="button" className={cn(cls, "w-full text-left")} onClick={() => markAsRead(n.id)}>
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
