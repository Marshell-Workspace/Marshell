import type {
  NotificationItem,
  NotificationPriority,
  NotificationType,
} from "@workspace/core/config/notifications";
import { safeStorage } from "@workspace/core/lib/safe-json";
import { z } from "zod";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AddNotificationOptions {
  avatar?: string;
  category?: string;
  description: string;
  iconName?: string;
  priority?: NotificationPriority;
  requiresUserAction?: boolean;
  targetSessionId?: string;
  targetWorkspaceId?: string;
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
  toggleRead: (id: string) => void;
}

export function formatNotificationTimestamp(timestamp: number): string {
  if (!timestamp || Number.isNaN(timestamp)) {
    return "Just now";
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    return "Just now";
  }
  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }
  if (diffHour < 24) {
    return `${diffHour} hr ago`;
  }

  const date = new Date(timestamp);
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);

  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return `Yesterday, ${timeStr}`;
  }

  if (date.getFullYear() === today.getFullYear()) {
    const monthDayStr = date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
    return `${monthDayStr}, ${timeStr}`;
  }

  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Remove only known sample entries from older installations; keep real event history.
const DEMO_NOTIFICATION_IDS = new Set([
  "n-1",
  "n-2",
  "n-3",
  "n-4",
  "n-5",
  "n-task-issue",
  "n-response-needed",
  "n-task-completed",
  "n-new-task-assigned",
  "n-task-updated",
  "n-task-commented",
  "n-task-moved",
  "n-payment-success",
  "n-login-success",
  "n-sys-runtime",
  "n-export-completed",
  "n-version-released",
  "n-pr-assigned",
  "n-report-generated",
  "n-review-approved",
  "n-audit-cleared",
]);
const notificationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  timestamp: z.number().finite().positive(),
  time: z.string().default(""),
  unread: z.boolean(),
  type: z.enum(["info", "success", "warning", "error", "system"]).optional(),
  priority: z
    .enum(["info", "success", "warning", "action_required", "error"])
    .optional(),
  requiresUserAction: z.boolean().optional(),
  avatar: z.string().optional(),
  iconName: z.string().optional(),
  category: z.string().optional(),
  targetSessionId: z.string().optional(),
  targetWorkspaceId: z.string().optional(),
});

function restoreNotificationHistory(persisted: unknown): NotificationItem[] {
  const saved = z.object({ items: z.array(z.unknown()) }).safeParse(persisted);
  if (!saved.success) {
    return [];
  }
  const items: NotificationItem[] = [];
  for (const candidate of saved.data.items) {
    const parsed = notificationSchema.safeParse(candidate);
    if (!parsed.success) {
      continue;
    }
    const item = parsed.data;
    if (DEMO_NOTIFICATION_IDS.has(item.id)) {
      continue;
    }
    items.push(item);
  }
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set) => ({
      isOpen: false,
      items: [],

      setOpen: (isOpen) => set({ isOpen }),

      toggle: () => set((state) => ({ isOpen: !state.isOpen })),

      markAsRead: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, unread: false } : item
          ),
        })),

      toggleRead: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, unread: !item.unread } : item
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
          time: formatNotificationTimestamp(now),
          timestamp: now,
          unread: true,
          avatar: options.avatar,
          iconName: options.iconName,
          type: options.type ?? "info",
          priority:
            options.priority ??
            (options.requiresUserAction ? "action_required" : "info"),
          requiresUserAction: options.requiresUserAction ?? false,
          category: options.category,
          targetWorkspaceId: options.targetWorkspaceId,
          targetSessionId: options.targetSessionId,
        };

        set((state) => ({
          items: [newItem, ...state.items],
        }));
      },
    }),
    {
      name: "marshell-notifications-store",
      storage: createJSONStorage(() => safeStorage),
      version: 3,
      partialize: (state) => ({ items: state.items }),
      migrate: (persistedState: unknown) => ({
        items: restoreNotificationHistory(persistedState),
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        items: restoreNotificationHistory(persistedState),
        isOpen: false,
      }),
    }
  )
);
