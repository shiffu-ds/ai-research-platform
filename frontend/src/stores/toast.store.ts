"use client";

import { create } from "zustand";

export type ToastTone = "neutral" | "success" | "warning" | "danger";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
  /** ms; 0 = sticky */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  show: (t: Omit<Toast, "id" | "tone" | "duration"> & Partial<Pick<Toast, "tone" | "duration">>) => string;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  show: (t) => {
    const id = Math.random().toString(36).slice(2, 9);
    set((s) => ({
      toasts: [...s.toasts.slice(-3), { tone: "neutral", duration: t.action ? 7000 : 4500, ...t, id }],
    }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Imperative helper usable outside React components. */
export const toast = (t: Parameters<ToastState["show"]>[0]) => useToasts.getState().show(t);
