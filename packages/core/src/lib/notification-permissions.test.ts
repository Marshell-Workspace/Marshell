import { useGeneralSettingsStore } from "@workspace/core/stores/general-settings-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isNativeNotificationsEnabled,
  requestNativeNotificationPermission,
  sendNativeWindowsNotification,
} from "./notification-service";

const notification = vi.hoisted(() => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-notification", () => notification);
vi.mock("@tauri-apps/api/core", () => ({ invoke: notification.invoke }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
  });
  useGeneralSettingsStore.setState({
    nativeBanners: true,
    macNativeNotificationConsent: false,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("notification permission boundaries", () => {
  it("does not treat the plugin's unconditional desktop Granted response as consent", async () => {
    notification.isPermissionGranted.mockResolvedValue(true);
    expect(isNativeNotificationsEnabled()).toBe(false);
    expect(
      await sendNativeWindowsNotification({
        title: "Task complete",
        description: "Ready",
      })
    ).toBe(false);
    expect(notification.isPermissionGranted).not.toHaveBeenCalled();
    expect(notification.requestPermission).not.toHaveBeenCalled();
    expect(notification.sendNotification).not.toHaveBeenCalled();
    expect(notification.invoke).not.toHaveBeenCalled();
  });
  it("does not request permission for background alerts, including repeated denied alerts", async () => {
    notification.isPermissionGranted.mockResolvedValue(false);
    for (let i = 0; i < 3; i++) {
      expect(
        await sendNativeWindowsNotification({
          title: "Task complete",
          description: "Ready",
        })
      ).toBe(false);
    }
    expect(notification.requestPermission).not.toHaveBeenCalled();
    expect(notification.sendNotification).not.toHaveBeenCalled();
    expect(notification.invoke).not.toHaveBeenCalled();
  });
  it("delivers macOS notifications through the plugin instead of the Windows no-op command", async () => {
    notification.isPermissionGranted.mockResolvedValue(true);
    expect(await requestNativeNotificationPermission()).toBe(true);
    expect(
      useGeneralSettingsStore.getState().macNativeNotificationConsent
    ).toBe(true);
    expect(isNativeNotificationsEnabled()).toBe(true);
    expect(
      await sendNativeWindowsNotification({
        title: "Task complete",
        description: "Ready",
      })
    ).toBe(true);
    expect(notification.sendNotification).toHaveBeenCalledOnce();
    expect(notification.invoke).not.toHaveBeenCalled();
    expect(notification.requestPermission).not.toHaveBeenCalled();
  });
  it("coalesces concurrent explicit permission gestures", async () => {
    notification.isPermissionGranted.mockResolvedValue(false);
    let resolve!: (permission: string) => void;
    notification.requestPermission.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      })
    );
    const requests = [
      requestNativeNotificationPermission(),
      requestNativeNotificationPermission(),
    ];
    await vi.waitFor(() =>
      expect(notification.requestPermission).toHaveBeenCalledOnce()
    );
    resolve("denied");
    expect(await Promise.all(requests)).toEqual([false, false]);
    expect(
      useGeneralSettingsStore.getState().macNativeNotificationConsent
    ).toBe(false);
    notification.isPermissionGranted.mockResolvedValue(true);
    expect(await requestNativeNotificationPermission()).toBe(true);
    expect(notification.requestPermission).toHaveBeenCalledOnce();
  });
  it("retains the native Windows notification identity path", async () => {
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0" });
    notification.invoke.mockResolvedValue(undefined);
    expect(
      await sendNativeWindowsNotification({
        title: "Done",
        description: "Ready",
      })
    ).toBe(true);
    expect(notification.invoke).toHaveBeenCalledWith(
      "send_native_notification",
      expect.any(Object)
    );
    expect(notification.sendNotification).not.toHaveBeenCalled();
  });
});
