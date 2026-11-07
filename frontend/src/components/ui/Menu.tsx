"use client";

/**
 * A small dropdown menu: click or ↓ to open, arrow keys to move,
 * Enter to choose, Escape or outside click to close.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface MenuItem {
  key: string;
  label: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

export interface MenuSection {
  label?: string;
  items: MenuItem[];
}

export function Menu({
  trigger,
  sections,
  align = "start",
  width = 240,
  label,
  footer,
  side = "bottom",
}: {
  trigger: (props: { open: boolean; toggle: () => void; id: string; "aria-expanded": boolean; "aria-haspopup": "menu" }) => ReactNode;
  sections: MenuSection[];
  align?: "start" | "end";
  width?: number;
  label: string;
  footer?: ReactNode;
  side?: "bottom" | "top";
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const items = sections.flatMap((s) => s.items);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    const raf = requestAnimationFrame(() => list.current?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  const choose = (i: number) => {
    const item = items[i];
    if (!item || item.disabled) return;
    item.onSelect();
    setOpen(false);
  };

  const toggle = () => {
    setOpen((o) => {
      if (!o) setActive(Math.max(0, items.findIndex((i) => i.selected)));
      return !o;
    });
  };

  // Index of each section's first item in the flattened list (for keyboard focus).
  const offsets = sections.reduce<number[]>((acc, sec, i) => [...acc, i === 0 ? 0 : acc[i - 1] + sections[i - 1].items.length], []);

  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle, id, "aria-expanded": open, "aria-haspopup": "menu" })}
      {open && (
        <div
          ref={list}
          role="menu"
          aria-label={label}
          aria-activedescendant={`${id}-item-${active}`}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % items.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + items.length) % items.length);
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              choose(active);
            } else if (e.key === "Escape" || e.key === "Tab") {
              setOpen(false);
            }
          }}
          style={{ width }}
          className={cn(
            "absolute z-40 max-h-[70vh] animate-pop overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg focus:outline-none",
            side === "top" ? "bottom-full mb-1.5" : "mt-1.5",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          {sections.map((section, si) => (
            <div key={si} className={cn(si > 0 && "mt-1 border-t border-line pt-1")}>
              {section.label && <div className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-medium text-ink-3">{section.label}</div>}
              {section.items.map((item, ii) => {
                const i = offsets[si] + ii;
                return (
                  <div
                    key={item.key}
                    id={`${id}-item-${i}`}
                    role="menuitem"
                    aria-disabled={item.disabled || undefined}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px]",
                      i === active && "bg-sunken",
                      item.danger ? "text-st-failure" : "text-ink",
                      item.disabled && "cursor-not-allowed opacity-45"
                    )}
                  >
                    {item.icon && <span className="text-ink-3">{item.icon}</span>}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="shrink-0 text-[12px] text-ink-3">{item.hint}</span>}
                    {item.selected && <Check className="h-3.5 w-3.5 shrink-0 text-ink" />}
                  </div>
                );
              })}
            </div>
          ))}
          {footer && <div className="mt-1 border-t border-line px-2.5 pt-2 pb-1.5 text-[12px] text-ink-3">{footer}</div>}
        </div>
      )}
    </div>
  );
}
