"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { DATA_MODE, API_BASE_URL } from "@/lib/api/config";
import type { HealthReport } from "@/types/platform.types";
import { cn } from "@/lib/utils/cn";
import { Tip } from "@/components/ui/misc";

/**
 * Honest connection indicator. In demo mode it says so; in live mode it
 * polls /health/ready every 30s and shows what the backend reports.
 */
export function useHealth(intervalMs = 30_000) {
  const [health, setHealth] = useState<HealthReport | null>(null);
  useEffect(() => {
    let alive = true;
    const run = () =>
      api.getHealth().then((h) => {
        if (alive) setHealth(h);
      });
    run();
    if (DATA_MODE === "demo") return () => void (alive = false);
    const t = setInterval(run, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [intervalMs]);
  return health;
}

const LABEL: Record<HealthReport["status"], string> = {
  demo: "Demo workspace",
  ready: "Backend ready",
  not_ready: "Backend degraded",
  unreachable: "Backend offline",
};

export function SystemStatus({ compact }: { compact?: boolean }) {
  const health = useHealth();
  const status = health?.status ?? (DATA_MODE === "demo" ? "demo" : "unreachable");
  const color = {
    demo: "bg-st-process",
    ready: "bg-st-success",
    not_ready: "bg-st-process",
    unreachable: "bg-st-failure",
  }[status];

  const detail =
    status === "demo"
      ? "Sample data, kept in memory for this tab. Set NEXT_PUBLIC_USE_MOCK=false to use the API."
      : Object.keys(health?.checks ?? {}).length
        ? Object.entries(health!.checks)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ")
        : `No response from ${API_BASE_URL.replace(/\/api\/v1$/, "")}`;

  const dot = <span className={cn("h-2 w-2 shrink-0 rounded-full", color, status !== "unreachable" && "live-dot")} />;

  if (compact) {
    return (
      <Tip content={`${LABEL[status]} — ${detail}`}>
        <span className="flex h-8 w-8 items-center justify-center" aria-label={LABEL[status]}>
          {dot}
        </span>
      </Tip>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg px-2.5 py-2" title={detail}>
      <span className="mt-1.5">{dot}</span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-ink-2">{LABEL[status]}</p>
        <p className="truncate text-[11.5px] text-ink-3">
          {status === "demo" ? "Nothing leaves your browser" : health?.latencyMs ? `${health.latencyMs} ms · ${detail}` : detail}
        </p>
      </div>
    </div>
  );
}
