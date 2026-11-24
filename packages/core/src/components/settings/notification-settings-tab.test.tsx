// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGeneralSettingsStore } from "../../stores/general-settings-store";
import { useNotificationStore } from "../../stores/notification-store";
import { NotificationSettingsTab } from "./notification-settings-tab";

const nativeSend = vi.hoisted(() => vi.fn(async () => true));
const requestPermission = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@workspace/core/lib/notification-service", async (original) => ({
  ...(await original<typeof import("../../lib/notification-service")>()),
  sendNativeNotification: nativeSend,
  requestNativeNotificationPermission: requestPermission,
}));

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  useGeneralSettingsStore.getState().resetToDefaults();
  useGeneralSettingsStore.getState().setSoundCues(false);
  useNotificationStore.setState({ items: [] });
  nativeSend.mockClear();
  requestPermission.mockReset().mockResolvedValue(true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  vi.unstubAllGlobals();
});

it("limits desktop-only notification toggles in a browser", async () => {
  await act(async () => root.render(<NotificationSettingsTab />));
  expect(
    host.querySelector<HTMLButtonElement>("#notifications-desktop")?.disabled
  ).toBe(true);
});

it("persists notification toggles and triggers test preview", async () => {
  await act(async () => root.render(<NotificationSettingsTab />));
  await act(async () =>
    host.querySelector<HTMLButtonElement>("#notifications-tasks")?.click()
  );
  expect(useGeneralSettingsStore.getState().responseCompletions).toBe(false);

  await act(async () =>
    host.querySelector<HTMLButtonElement>("#notifications-preview")?.click()
  );
  expect(useNotificationStore.getState().items).toHaveLength(1);
  expect(nativeSend).not.toHaveBeenCalled();
});

it("tests enabled native banners without bypassing disabled desktop preference", async () => {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {},
    configurable: true,
  });
  await act(async () => root.render(<NotificationSettingsTab />));
  expect(
    host.querySelector<HTMLButtonElement>("#notifications-desktop")?.disabled
  ).toBe(false);
  await act(async () =>
    host.querySelector<HTMLButtonElement>("#notifications-preview")?.click()
  );
  expect(nativeSend).toHaveBeenCalledTimes(1);
  expect(requestPermission).toHaveBeenCalledTimes(1);
});
