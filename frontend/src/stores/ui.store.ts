"use client";

import { create } from "zustand";

type Overlay = "command" | "notifications" | "shortcuts" | "mobile-nav" | null;

interface UIState {
  overlay: Overlay;
  open: (o: Exclude<Overlay, null>) => void;
  close: () => void;
  toggle: (o: Exclude<Overlay, null>) => void;
}

/** Only one global overlay is open at a time. */
export const useUI = create<UIState>((set) => ({
  overlay: null,
  open: (overlay) => set({ overlay }),
  close: () => set({ overlay: null }),
  toggle: (o) => set((s) => ({ overlay: s.overlay === o ? null : o })),
}));
