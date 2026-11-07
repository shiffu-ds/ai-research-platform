"use client";

import { useId, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export interface TabDef<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** Underline tabs with roving focus (←/→, Home/End). */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (to: number) => {
    const i = (to + tabs.length) % tabs.length;
    onChange(tabs[i].value);
    refs.current[i]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cn("flex items-end gap-5 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none]", className)}>
      {tabs.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${id}-tab-${t.value}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") move(i + 1);
              else if (e.key === "ArrowLeft") move(i - 1);
              else if (e.key === "Home") move(0);
              else if (e.key === "End") move(tabs.length - 1);
            }}
            className={cn(
              "relative -mb-px flex shrink-0 items-center gap-1.5 pb-2.5 pt-1 text-[13.5px] font-medium transition-colors",
              active ? "text-ink" : "text-ink-3 hover:text-ink-2"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "tnum rounded-full px-1.5 text-[11.5px] leading-[18px]",
                  active ? "bg-ink text-paper" : "bg-sunken text-ink-3"
                )}
              >
                {t.count}
              </span>
            )}
            {active && (
              <motion.span
                layoutId={`${id}-underline`}
                className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-ink"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
