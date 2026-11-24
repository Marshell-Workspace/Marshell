// @vitest-environment jsdom
import {
  formatNotificationTimestamp,
  useNotificationStore,
} from "@workspace/core/stores/notification-store";
import { beforeEach, describe, expect, it } from "vitest";

describe("notification-store", () => {
  beforeEach(() => {
    useNotificationStore.setState({
      isOpen: false,
      items: [],
    });
  });

  describe("formatNotificationTimestamp", () => {
    it("formats recent timestamps as Just now", () => {
      const now = Date.now();
      expect(formatNotificationTimestamp(now)).toBe("Just now");
      expect(formatNotificationTimestamp(now - 30_000)).toBe("Just now");
    });

    it("formats minutes ago", () => {
      const now = Date.now();
      expect(formatNotificationTimestamp(now - 5 * 60 * 1000)).toBe(
        "5 min ago"
      );
    });

    it("formats hours ago", () => {
      const now = Date.now();
      expect(formatNotificationTimestamp(now - 3 * 3600 * 1000)).toBe(
        "3 hr ago"
      );
    });
  });

  describe("store actions", () => {
    it("adds notification with default priority and unread state", () => {
      const store = useNotificationStore.getState();
      store.addNotification({
        title: "Build Success",
        description: "Tauri static export build completed cleanly.",
      });

      const state = useNotificationStore.getState();
      expect(state.items.length).toBe(1);
      const item = state.items[0];
      expect(item?.title).toBe("Build Success");
      expect(item?.unread).toBe(true);
      expect(item?.priority).toBe("info");
    });

    it("assigns action_required priority if user action is needed", () => {
      const store = useNotificationStore.getState();
      store.addNotification({
        title: "Permission Request",
        description: "Agent requests permission to execute shell command.",
        requiresUserAction: true,
      });

      expect(useNotificationStore.getState().items[0]?.priority).toBe(
        "action_required"
      );
    });

    it("marks single and all notifications as read", () => {
      const store = useNotificationStore.getState();
      store.addNotification({ title: "Item 1", description: "Desc 1" });
      store.addNotification({ title: "Item 2", description: "Desc 2" });

      const items = useNotificationStore.getState().items;
      store.markAsRead(items[0]!.id);

      expect(useNotificationStore.getState().items[0]!.unread).toBe(false);
      expect(useNotificationStore.getState().items[1]!.unread).toBe(true);

      store.markAllAsRead();
      expect(
        useNotificationStore.getState().items.every((i) => !i.unread)
      ).toBe(true);
    });

    it("removes and clears notifications", () => {
      const store = useNotificationStore.getState();
      store.addNotification({ title: "To Remove", description: "Desc" });
      const id = useNotificationStore.getState().items[0]!.id;

      store.removeNotification(id);
      expect(useNotificationStore.getState().items.length).toBe(0);

      store.addNotification({ title: "N1", description: "D1" });
      store.addNotification({ title: "N2", description: "D2" });
      store.clearAll();
      expect(useNotificationStore.getState().items.length).toBe(0);
    });

    it("toggles panel open/close state", () => {
      const store = useNotificationStore.getState();
      expect(store.isOpen).toBe(false);

      store.toggle();
      expect(useNotificationStore.getState().isOpen).toBe(true);

      store.setOpen(false);
      expect(useNotificationStore.getState().isOpen).toBe(false);
    });
  });
});

describe("real notification history", () => {
  it("starts a clean installation with no sample notifications", async () => {
    localStorage.removeItem("marshell-notifications-store");
    await useNotificationStore.persist.rehydrate();
    expect(useNotificationStore.getState().items).toEqual([]);
  });

  it.each([
    0, 1, 2,
  ])("removes demos from version %s without deleting real events", async (version) => {
    const real = {
      id: "n-1720000000000",
      title: "Task Completed",
      description: "Actual tester task",
      timestamp: 1_720_000_000_000,
      time: "Just now",
      unread: true,
      targetWorkspaceId: "tester-workspace",
    };
    const sampleIds = [
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
      "n-1",
    ];
    localStorage.setItem(
      "marshell-notifications-store",
      JSON.stringify({
        version,
        state: {
          isOpen: true,
          items: [real, ...sampleIds.map((id) => ({ ...real, id }))],
        },
      })
    );
    await useNotificationStore.persist.rehydrate();
    expect(useNotificationStore.getState().items).toEqual([real]);
    expect(useNotificationStore.getState().isOpen).toBe(false);
    expect(
      JSON.parse(localStorage.getItem("marshell-notifications-store") ?? "{}")
        .version
    ).toBe(3);
  });

  it("restores valid events newest first and ignores malformed entries", async () => {
    const older = {
      id: "n-100-real",
      title: "Old",
      description: "Real",
      timestamp: 100,
      unread: false,
    };
    const newer = { ...older, id: "n-200-real", title: "New", timestamp: 200 };
    localStorage.setItem(
      "marshell-notifications-store",
      JSON.stringify({
        version: 3,
        state: { items: [older, null, { title: "Broken" }, newer] },
      })
    );
    await useNotificationStore.persist.rehydrate();
    expect(
      useNotificationStore.getState().items.map((item) => item.id)
    ).toEqual([newer.id, older.id]);
  });

  it("persists real incoming events and keeps cleared history empty after reload", async () => {
    useNotificationStore.getState().clearAll();
    const before = Date.now();
    useNotificationStore.getState().addNotification({
      title: "Run finished",
      description: "Tester task complete",
      category: "tasks",
    });
    await useNotificationStore.persist.rehydrate();
    const item = useNotificationStore.getState().items[0];
    expect(item?.description).toBe("Tester task complete");
    expect(item?.timestamp).toBeGreaterThanOrEqual(before);
    useNotificationStore.getState().clearAll();
    await useNotificationStore.persist.rehydrate();
    expect(useNotificationStore.getState().items).toEqual([]);
  });
});
