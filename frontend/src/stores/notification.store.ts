"use client";

/**
 * Notification inbox. Loaded from the API once, then appended to locally
 * as things happen in this session (runs finishing, decisions needed…).
 */

import { create } from "zustand";
import type { PlatformNotification } from "@/types/notification.types";

interface NotificationState {
  notifications: PlatformNotification[];
  loaded: boolean;
  load: (items: PlatformNotification[]) => void;
  push: (n: Omit<PlatformNotification, "id" | "createdAt" | "isRead">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

export const useNotifications = create<NotificationState>((set) => ({
  notifications: [],
  loaded: false,
  load: (items) =>
    set((s) => {
      // Keep anything pushed locally before the initial load finished.
      const local = s.notifications.filter((n) => !items.some((i) => i.id === n.id));
      return { notifications: [...local, ...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), loaded: true };
    }),
  push: (n) =>
    set((s) => ({
      notifications: [
        { ...n, id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString(), isRead: false },
        ...s.notifications,
      ],
    })),
  markAsRead: (id) =>
    set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)) })),
  markAllAsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, isRead: true })) })),
}));

export const selectUnreadCount = (s: NotificationState) => s.notifications.filter((n) => !n.isRead).length;
