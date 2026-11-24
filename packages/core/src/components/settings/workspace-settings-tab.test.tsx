// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGeneralSettingsStore } from "../../stores/general-settings-store";
import {
  getShellOptions,
  WorkspaceSettingsTab,
} from "./workspace-settings-tab";

vi.mock("@workspace/i18n", () => ({
  useTranslations: () => (key: string) => key,
}));

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
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  vi.unstubAllGlobals();
});

it("limits desktop-only shell settings in a browser environment", async () => {
  await act(async () => root.render(<WorkspaceSettingsTab />));
  expect(
    host.querySelector<HTMLButtonElement>("#workspace-shell")?.disabled
  ).toBe(true);
  expect(getShellOptions(true).map((shell) => shell.value)).not.toContain(
    "zsh"
  );
  expect(getShellOptions(false).map((shell) => shell.value)).not.toContain(
    "cmd"
  );
});

it("persists workspace layout and restore toggles", async () => {
  await act(async () => root.render(<WorkspaceSettingsTab />));
  await act(async () =>
    host.querySelector<HTMLButtonElement>("#workspace-auto-save")?.click()
  );
  expect(useGeneralSettingsStore.getState().autoSaveSession).toBe(false);
  expect(
    JSON.parse(localStorage.getItem("marshell-general-settings") ?? "{}").state
      ?.autoSaveSession
  ).toBe(false);

  await act(async () =>
    host.querySelector<HTMLButtonElement>("#workspace-restore")?.click()
  );
  expect(useGeneralSettingsStore.getState().restoreTabsOnStartup).toBe(false);
});

it("persists the blinking cursor toggle", async () => {
  await act(async () => root.render(<WorkspaceSettingsTab />));
  await act(async () =>
    host.querySelector<HTMLButtonElement>("#terminal-cursor-blink")?.click()
  );
  expect(useGeneralSettingsStore.getState().terminalCursorBlink).toBe(false);
  expect(
    JSON.parse(localStorage.getItem("marshell-general-settings") ?? "{}").state
      ?.terminalCursorBlink
  ).toBe(false);
});

it("renders every terminal appearance control with its saved value", async () => {
  useGeneralSettingsStore.getState().setTerminalFontSize(16);
  useGeneralSettingsStore.getState().setTerminalCursorStyle("bar");
  useGeneralSettingsStore.getState().setTerminalScrollback(10_000);
  await act(async () => root.render(<WorkspaceSettingsTab />));
  const text = (id: string) => host.querySelector(`#${id}`)?.textContent;
  expect(text("terminal-font-size")).toContain("16 px");
  expect(text("terminal-cursor-style")).toContain("Bar");
  expect(text("terminal-scrollback")).toContain("10,000 lines");
});

it("keeps a saved shell visible when this platform does not offer it", async () => {
  useGeneralSettingsStore.getState().setDefaultShell("cmd");
  await act(async () => root.render(<WorkspaceSettingsTab />));
  expect(host.querySelector("#workspace-shell")?.textContent).toContain(
    "Command Prompt (unavailable here)"
  );
});

it("clamps and validates terminal settings", () => {
  const store = useGeneralSettingsStore.getState();
  store.setTerminalFontSize(99);
  expect(useGeneralSettingsStore.getState().terminalFontSize).toBe(24);
  store.setTerminalFontSize(2);
  expect(useGeneralSettingsStore.getState().terminalFontSize).toBe(10);
  store.setTerminalFontSize(Number.NaN);
  expect(useGeneralSettingsStore.getState().terminalFontSize).toBe(13);
  store.setTerminalScrollback(123);
  expect(useGeneralSettingsStore.getState().terminalScrollback).toBe(5000);
  store.setTerminalCursorStyle("nonsense" as "block");
  expect(useGeneralSettingsStore.getState().terminalCursorStyle).toBe("block");
  store.setTerminalFontSize(18);
  store.resetToDefaults();
  expect(useGeneralSettingsStore.getState().terminalFontSize).toBe(13);
});

it("offers only the shells the desktop backend reports as installed", () => {
  const values = (installed: string[]) =>
    getShellOptions(true, installed).map((shell) => shell.value);
  expect(values(["cmd", "powershell"])).toEqual([
    "default",
    "powershell",
    "cmd",
  ]);
  expect(values(["cmd", "gitbash"])).toContain("gitbash");
  expect(values(["cmd"])).not.toContain("bash");
});

it("loads the installed shell list from the desktop backend", async () => {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
  const invoke = vi.fn(async () => ["cmd", "bash"]);
  vi.doMock("@tauri-apps/api/core", () => ({ invoke, isTauri: () => true }));
  await act(async () => root.render(<WorkspaceSettingsTab />));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(invoke).toHaveBeenCalledWith("list_available_shells");
  vi.doUnmock("@tauri-apps/api/core");
});
