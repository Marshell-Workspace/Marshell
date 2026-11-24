// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGeneralSettingsStore } from "../../stores/general-settings-store";
import { AppearanceSettingsTab } from "./appearance-settings-tab";

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  useGeneralSettingsStore.getState().resetToDefaults();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("renders theme switcher and updates theme mode in store", async () => {
  await act(async () => root.render(<AppearanceSettingsTab />));
  const themeTrigger =
    host.querySelector<HTMLButtonElement>("#appearance-theme");
  expect(themeTrigger).not.toBeNull();
  expect(useGeneralSettingsStore.getState().theme).toBe("system");
  act(() => {
    useGeneralSettingsStore.getState().setTheme("dark");
  });
  expect(useGeneralSettingsStore.getState().theme).toBe("dark");
});
