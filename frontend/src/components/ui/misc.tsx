"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { initials, hueFor } from "@/lib/utils/format";

export function Avatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const hue = hueFor(name);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.38),
        background: `oklch(0.9 0.045 ${hue})`,
        color: `oklch(0.36 0.07 ${hue})`,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-line border-b-2 bg-surface px-1 font-sans text-[11px] font-medium text-ink-2",
        className
      )}
    >
      {children}
    </kbd>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden />;
}

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard blocked */
        }
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-ink-3 transition-colors hover:bg-sunken hover:text-ink",
        className
      )}
      aria-label={copied ? "Copied" : `${label}: ${value}`}
    >
      {copied ? <Check className="h-3 w-3 text-st-success" /> : <Copy className="h-3 w-3" />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

export function ProgressBar({
  value,
  tone = "ink",
  className,
  label,
}: {
  value: number;
  tone?: "ink" | "accent" | "success" | "failure" | "process";
  className?: string;
  label?: string;
}) {
  const color = {
    ink: "bg-ink",
    accent: "bg-accent",
    success: "bg-st-success",
    failure: "bg-st-failure",
    process: "bg-st-process",
  }[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-sunken", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/** A tiny hover/focus tooltip for icon buttons and dense numbers. */
export function Tip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-[240px] -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[12px] leading-snug text-paper opacity-0 shadow-md transition-opacity delay-150 duration-150",
          "group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
        )}
      >
        {content}
      </span>
    </span>
  );
}
