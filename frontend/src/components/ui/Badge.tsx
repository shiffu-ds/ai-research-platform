import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type Tone = "neutral" | "intake" | "process" | "validation" | "control" | "success" | "failure" | "accent";

const toneClass: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2 border-line",
  intake: "bg-st-intake-soft text-st-intake border-transparent",
  process: "bg-st-process-soft text-st-process border-transparent",
  validation: "bg-st-validation-soft text-st-validation border-transparent",
  control: "bg-st-control-soft text-st-control border-transparent",
  success: "bg-st-success-soft text-st-success border-transparent",
  failure: "bg-st-failure-soft text-st-failure border-transparent",
  accent: "bg-accent-soft text-accent border-transparent",
};

const dotClass: Record<Tone, string> = {
  neutral: "bg-ink-3",
  intake: "bg-st-intake",
  process: "bg-st-process",
  validation: "bg-st-validation",
  control: "bg-st-control",
  success: "bg-st-success",
  failure: "bg-st-failure",
  accent: "bg-accent",
};

export function Badge({
  tone = "neutral",
  dot,
  pulse,
  className,
  children,
  title,
}: {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5.5 items-center gap-1.5 rounded-full border px-2 text-[12px] font-medium leading-none whitespace-nowrap",
        toneClass[tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[tone], pulse && "live-dot")} aria-hidden />}
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral", pulse, className }: { tone?: Tone; pulse?: boolean; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", dotClass[tone], pulse && "live-dot", className)} aria-hidden />;
}

/** Inline code-ish chip for ids and hashes. */
export function Mono({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <code title={title} className={cn("rounded bg-sunken px-1.5 py-0.5 font-mono text-[12px] text-ink-2", className)}>
      {children}
    </code>
  );
}
