import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  INITIAL_NOTIFICATIONS,
  type NotificationItem,
  type NotificationType,
} from "@/config/notifications";

interface AddNotificationOptions {
  avatar?: string;
  category?: string;
  description: string;
  iconName?: string;
  title: string;
  type?: NotificationType;
}

interface NotificationStore {
  addNotification: (options: AddNotificationOptions) => void;
  clearAll: () => void;
  isOpen: boolean;
  items: NotificationItem[];
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
  removeNotification: (id: string) => void;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return "Just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  return `${diffDay}d ago`;
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set) => ({
      isOpen: false,
      items: INITIAL_NOTIFICATIONS,

      setOpen: (isOpen) => set({ isOpen }),

      toggle: () => set((state) => ({ isOpen: !state.isOpen })),

      markAsRead: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, unread: false } : item
          ),
        })),

      markAllAsRead: () =>
        set((state) => ({
          items: state.items.map((item) => ({ ...item, unread: false })),
        })),

      removeNotification: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      clearAll: () => set({ items: [] }),

      addNotification: (options) => {
        const now = Date.now();
        const newItem: NotificationItem = {
          id: `n-${now}-${Math.random().toString(36).slice(2, 7)}`,
          title: options.title,
          description: options.description,
          time: formatRelativeTime(now),
          timestamp: now,
          unread: true,
          avatar: options.avatar,
          iconName: options.iconName,
          type: options.type ?? "info",
          category: options.category,
        };

        set((state) => ({
          items: [newItem, ...state.items],
        }));
      },
    }),
    {
      name: "hyperion-notifications-store",
    }
  )
);
