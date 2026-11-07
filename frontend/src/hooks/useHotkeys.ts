"use client";

import { useEffect, useRef } from "react";

/**
 * Keyboard shortcuts. Keys are written the way people say them:
 *   "mod+k"  → ⌘K on macOS, Ctrl+K elsewhere
 *   "g r"    → press g, then r (within a second)
 *   "?"      → shift+/
 * Shortcuts are ignored while typing in inputs unless `allowInInputs`.
 */

export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function matchesChord(chord: string, e: KeyboardEvent): boolean {
  const parts = chord.toLowerCase().split("+");
  const key = parts.pop()!;
  const wantMod = parts.includes("mod");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt");
  const mod = e.metaKey || e.ctrlKey;
  if (wantMod !== mod) return false;
  if (wantAlt !== e.altKey) return false;
  if (parts.includes("shift") && !e.shiftKey) return false;
  if (!wantShift && key.length === 1 && /[a-z]/.test(key) && e.shiftKey) return false;
  return e.key.toLowerCase() === key;
}

export function useHotkeys(map: HotkeyMap, opts: { enabled?: boolean; allowInInputs?: string[] } = {}) {
  const mapRef = useRef(map);
  const pending = useRef<{ key: string; at: number } | null>(null);
  const { enabled = true, allowInInputs = [] } = opts;

  useEffect(() => {
    mapRef.current = map;
  });

  useEffect(() => {
    if (!enabled) return;

    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing) return;
      const typing = isTypingTarget(e.target);
      const entries = Object.entries(mapRef.current);

      // Two-key sequences ("g r")
      const now = performance.now();
      if (pending.current && now - pending.current.at < 1000 && !typing) {
        const seq = `${pending.current.key} ${e.key.toLowerCase()}`;
        const hit = entries.find(([k]) => k === seq);
        pending.current = null;
        if (hit) {
          e.preventDefault();
          hit[1](e);
          return;
        }
      }

      for (const [combo, handler] of entries) {
        if (combo.includes(" ")) continue;
        if (typing && !allowInInputs.includes(combo)) continue;
        if (matchesChord(combo, e)) {
          e.preventDefault();
          handler(e);
          return;
        }
      }

      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) {
        const starts = entries.some(([k]) => k.startsWith(`${e.key.toLowerCase()} `));
        if (starts) pending.current = { key: e.key.toLowerCase(), at: now };
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, allowInInputs]);
}

/** "⌘" on Apple platforms, "Ctrl" elsewhere. Safe to call during SSR. */
export function modKeyLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";
}
