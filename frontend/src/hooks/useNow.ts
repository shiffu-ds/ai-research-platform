"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared ticking clock. Components read "now" from here instead of
 * calling Date.now() while rendering, which keeps renders pure and lets
 * every relative timestamp on the page update together.
 *
 * One ticker per interval; `subscribe` and `getSnapshot` are stable per
 * interval so React never re-subscribes on re-render, and the snapshot
 * only changes when the ticker fires.
 */

interface Ticker {
  now: number;
  listeners: Set<() => void>;
  timer?: ReturnType<typeof setInterval>;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number;
}

const tickers = new Map<number, Ticker>();

function getTicker(interval: number): Ticker {
  const existing = tickers.get(interval);
  if (existing) return existing;

  const t: Ticker = {
    now: typeof window === "undefined" ? 0 : Date.now(),
    listeners: new Set(),
    subscribe: (listener) => {
      t.listeners.add(listener);
      if (!t.timer) {
        t.timer = setInterval(() => {
          t.now = Date.now();
          t.listeners.forEach((l) => l());
        }, interval);
      }
      return () => {
        t.listeners.delete(listener);
        if (t.listeners.size === 0 && t.timer) {
          clearInterval(t.timer);
          t.timer = undefined;
        }
      };
    },
    getSnapshot: () => t.now,
  };
  tickers.set(interval, t);
  return t;
}

const serverSnapshot = () => 0;

export function useNow(intervalMs = 30_000): number {
  const t = getTicker(intervalMs);
  return useSyncExternalStore(t.subscribe, t.getSnapshot, serverSnapshot);
}
