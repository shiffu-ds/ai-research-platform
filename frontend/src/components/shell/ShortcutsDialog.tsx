"use client";

import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/misc";
import { useUI } from "@/stores/ui.store";
import { modKeyLabel } from "@/hooks/useHotkeys";
import { ALL_NAV_ITEMS } from "./nav";

function Keys({ combo }: { combo: string }) {
  const mod = modKeyLabel();
  return (
    <span className="flex items-center gap-1">
      {combo.split(" ").map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-[11px] text-ink-3">then</span>}
          {part.split("+").map((k) => (
            <Kbd key={k}>{k === "mod" ? mod : k === "," ? "," : k.toUpperCase()}</Kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

const GENERAL: [string, string][] = [
  ["mod+k", "Search and commands"],
  ["n", "Start new research"],
  ["?", "Show this list"],
  ["[", "Collapse or expand the sidebar"],
  ["i", "Open notifications"],
];

export function ShortcutsDialog() {
  const open = useUI((s) => s.overlay === "shortcuts");
  const close = useUI((s) => s.close);
  return (
    <Dialog open={open} onClose={close} title="Keyboard shortcuts" description="Everything here also works from the command menu." size="md">
      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="mb-2 text-[12px] font-medium text-ink-3">General</h3>
          <ul className="space-y-2">
            {GENERAL.map(([combo, label]) => (
              <li key={combo} className="flex items-center justify-between gap-3 text-[13.5px] text-ink-2">
                {label}
                <Keys combo={combo} />
              </li>
            ))}
          </ul>
          <h3 className="mt-5 mb-2 text-[12px] font-medium text-ink-3">In a report</h3>
          <ul className="space-y-2 text-[13.5px] text-ink-2">
            <li className="flex items-center justify-between gap-3">Next / previous citation <span className="flex gap-1"><Kbd>J</Kbd><Kbd>K</Kbd></span></li>
            <li className="flex items-center justify-between gap-3">Close evidence panel <Kbd>Esc</Kbd></li>
          </ul>
        </section>
        <section>
          <h3 className="mb-2 text-[12px] font-medium text-ink-3">Go to</h3>
          <ul className="space-y-2">
            {ALL_NAV_ITEMS.map((n) => (
              <li key={n.href} className="flex items-center justify-between gap-3 text-[13.5px] text-ink-2">
                {n.label}
                <Keys combo={n.keys} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}
