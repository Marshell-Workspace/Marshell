import { useGeneralSettingsStore } from "@workspace/core/stores/general-settings-store";
import { useNotificationStore } from "@workspace/core/stores/notification-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isNativeNotificationsEnabled,
  setNativeNotificationsEnabled,
  triggerNotification,
} from "./notification-service";

function fakeLocalStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
    clear: () => {
      data.clear();
    },
  };
}

class MockAudioContext {
  currentTime = 0;
  destination = {};
  createOscillator() {
    return {
      type: "sine",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
}

describe("notification-service settings integration", () => {
  let ls: ReturnType<typeof fakeLocalStorage>;

  beforeEach(() => {
    ls = fakeLocalStorage();
    vi.stubGlobal("window", {
      AudioContext: MockAudioContext,
    });
    vi.stubGlobal("document", {
      hidden: true,
      visibilityState: "hidden",
      hasFocus: () => false,
    });
    vi.stubGlobal("localStorage", ls);
    useGeneralSettingsStore.getState().resetToDefaults();
    useNotificationStore.setState({ items: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("filters response completions when responseCompletions is false", () => {
    useGeneralSettingsStore.getState().setResponseCompletions(false);

    triggerNotification({
      title: "Agent Finished Execution",
      description: "Build completed",
      category: "agent",
      type: "success",
      dedupeKey: "resp-comp-1",
    });

    expect(useNotificationStore.getState().items.length).toBe(0);

    // Re-enable
    useGeneralSettingsStore.getState().setResponseCompletions(true);
    triggerNotification({
      title: "Agent Finished Execution 2",
      description: "Build completed 2",
      category: "agent",
      type: "success",
      dedupeKey: "resp-comp-2",
    });

    expect(useNotificationStore.getState().items.length).toBe(1);
  });

  it("filters scheduled tasks when scheduledTasks is false", () => {
    useGeneralSettingsStore.getState().setScheduledTasks(false);

    triggerNotification({
      title: "Scheduled Cron Run",
      description: "Cron executed",
      category: "cron",
      dedupeKey: "cron-1",
    });

    expect(useNotificationStore.getState().items.length).toBe(0);

    useGeneralSettingsStore.getState().setScheduledTasks(true);
    triggerNotification({
      title: "Scheduled Cron Run 2",
      description: "Cron executed 2",
      category: "cron",
      dedupeKey: "cron-2",
    });

    expect(useNotificationStore.getState().items.length).toBe(1);
  });

  it("filters code notifications when codeNotifications is false", () => {
    useGeneralSettingsStore.getState().setCodeNotifications(false);

    triggerNotification({
      title: "Build Succeeded",
      description: "TypeScript build clean",
      category: "build",
      dedupeKey: "build-1",
    });

    expect(useNotificationStore.getState().items.length).toBe(0);

    useGeneralSettingsStore.getState().setCodeNotifications(true);
    triggerNotification({
      title: "Build Succeeded 2",
      description: "TypeScript build clean 2",
      category: "build",
      dedupeKey: "build-2",
    });

    expect(useNotificationStore.getState().items.length).toBe(1);
  });

  it("filters permission requests when permissionRequests is false", () => {
    useGeneralSettingsStore.getState().setPermissionRequests(false);

    triggerNotification({
      title: "Permission Required",
      description: "Needs terminal access",
      category: "permission",
      priority: "critical",
      dedupeKey: "perm-1",
    });

    expect(useNotificationStore.getState().items.length).toBe(0);

    useGeneralSettingsStore.getState().setPermissionRequests(true);
    triggerNotification({
      title: "Permission Required 2",
      description: "Needs terminal access 2",
      category: "permission",
      priority: "critical",
      dedupeKey: "perm-2",
    });

    expect(useNotificationStore.getState().items.length).toBe(1);
  });

  it("syncs native banners with isNativeNotificationsEnabled and setNativeNotificationsEnabled", () => {
    expect(isNativeNotificationsEnabled()).toBe(true);

    setNativeNotificationsEnabled(false);
    expect(useGeneralSettingsStore.getState().nativeBanners).toBe(false);
    expect(isNativeNotificationsEnabled()).toBe(false);

    setNativeNotificationsEnabled(true);
    expect(useGeneralSettingsStore.getState().nativeBanners).toBe(true);
    expect(isNativeNotificationsEnabled()).toBe(true);
  });
  it("keeps critical task failures independent of approval alerts", () => {
    useGeneralSettingsStore.getState().setPermissionRequests(false);
    triggerNotification({
      category: "agent",
      title: "Task failed",
      description: "Provider unavailable",
      priority: "critical",
      type: "error",
      dedupeKey: "critical-task-failure",
    });
    expect(useNotificationStore.getState().items).toHaveLength(1);
  });
  it("filters untagged builds before their titles are normalized", () => {
    useGeneralSettingsStore.getState().setCodeNotifications(false);
    triggerNotification({
      title: "Build completed",
      description: "Build is ready",
      type: "success",
      dedupeKey: "normalized-build-filter",
    });
    expect(useNotificationStore.getState().items).toHaveLength(0);
  });
  it("delivers explicit system previews with task categories muted", () => {
    useGeneralSettingsStore.getState().setResponseCompletions(false);
    useGeneralSettingsStore.getState().setCodeNotifications(false);
    triggerNotification({
      category: "system",
      title: "Notification preview",
      description: "Preview alert",
      dedupeKey: "system-preview",
    });
    expect(useNotificationStore.getState().items).toHaveLength(1);
  });
  it("does not deduplicate previously filtered notifications", () => {
    const notification = {
      category: "agent",
      title: "Task completed",
      description: "Result is ready",
      type: "success" as const,
      dedupeKey: "muted-then-enabled",
    };
    useGeneralSettingsStore.getState().setResponseCompletions(false);
    triggerNotification(notification);
    useGeneralSettingsStore.getState().setResponseCompletions(true);
    triggerNotification(notification);
    expect(useNotificationStore.getState().items).toHaveLength(1);
  });
  it("uses the current preference instead of a stale legacy native toggle", () => {
    ls.setItem("marshell_native_notifications_enabled", "false");
    useGeneralSettingsStore.getState().setNativeBanners(true);
    expect(isNativeNotificationsEnabled()).toBe(true);
  });
});
