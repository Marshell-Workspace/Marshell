import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/core/lib/fullscreen-manager", () => ({
  toggleApplicationFullscreen: vi.fn(),
}));

import { toggleApplicationFullscreen } from "@workspace/core/lib/fullscreen-manager";
import { useCommandPaletteStore } from "@workspace/core/stores/command-palette-store";
import { useHotkeysDialogStore } from "@workspace/core/stores/hotkeys-store";
import { useLayoutStore } from "../stores/layout-store";
import { usePanelStore } from "../stores/panel-store";
import { useTerminalFocusStore } from "../stores/terminal-focus-store";
import { useTutorialStore } from "../stores/tutorial-store";
import { useWorkspaceStore } from "../stores/workspace-store";
import { handleApplicationShortcut } from "./app-shortcuts";

const makeEvent = (key: string, code = key) =>
  ({
    key,
    code,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  }) as unknown as KeyboardEvent;

describe("keyboard focus/fullscreen state", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    useLayoutStore.setState({ activePanel: "none" });
    usePanelStore.setState({ isSettingsOpen: false });
    useCommandPaletteStore.setState({ isOpen: false });
    useHotkeysDialogStore.setState({ isOpen: false });
    useTutorialStore.setState({ isCreateWorkspaceDialogOpen: false });
    useTerminalFocusStore.setState({
      activeTerminalId: null,
      focusedTerminalId: null,
      fullscreenTerminalId: null,
      isAppFullscreen: false,
      focusCallbacks: {},
    });
    useWorkspaceStore.setState({
      activeWorkspaceId: null,
      workspaces: [],
      recentDirectories: [],
    });
  });

  it("toggles the sidebar via Ctrl+B", () => {
    useLayoutStore.setState({ activePanel: "none" });
    const sidebarToggleEvent = makeEvent("b", "KeyB");
    Object.defineProperty(sidebarToggleEvent, "ctrlKey", { value: true });

    expect(handleApplicationShortcut(sidebarToggleEvent)).toBe(true);
    expect(useLayoutStore.getState().activePanel).toBe("sidebar");

    expect(handleApplicationShortcut(sidebarToggleEvent)).toBe(true);
    expect(useLayoutStore.getState().activePanel).toBe("none");
  });

  it("does not auto-focus a terminal when switching workspaces", () => {
    useWorkspaceStore.setState({
      activeWorkspaceId: "workspace-a",
      workspaces: [
        {
          id: "workspace-a",
          name: "A",
          createdAt: Date.now(),
          terminalCount: 1,
          panes: [{ id: "term-a", title: "Terminal 1" }],
        },
        {
          id: "workspace-b",
          name: "B",
          createdAt: Date.now(),
          terminalCount: 1,
          panes: [{ id: "term-b", title: "Terminal 1" }],
        },
      ],
    });

    useWorkspaceStore.getState().setActiveWorkspace("workspace-b");

    expect(useTerminalFocusStore.getState().focusedTerminalId).toBeNull();
  });

  it("leaves plain Escape to a focused terminal while remaining fullscreen", () => {
    useTerminalFocusStore.setState({
      focusedTerminalId: "term-a",
      isAppFullscreen: true,
    });

    const escapeEvent = makeEvent("Escape", "Escape");
    expect(handleApplicationShortcut(escapeEvent)).toBe(false);

    expect(useTerminalFocusStore.getState().focusedTerminalId).toBe("term-a");
    expect(useTerminalFocusStore.getState().isAppFullscreen).toBe(true);
    expect(escapeEvent.preventDefault).not.toHaveBeenCalled();
    expect(escapeEvent.stopImmediatePropagation).not.toHaveBeenCalled();
  });

  it("exits app fullscreen on the second Escape after terminal focus has been released", async () => {
    useTerminalFocusStore.setState({
      focusedTerminalId: null,
      isAppFullscreen: true,
    });

    vi.mocked(toggleApplicationFullscreen).mockResolvedValue(false);
    const escapeEvent = makeEvent("Escape", "Escape");

    expect(handleApplicationShortcut(escapeEvent)).toBe(true);
    await Promise.resolve();
    expect(useTerminalFocusStore.getState().isAppFullscreen).toBe(false);
  });

  it("exits app fullscreen on a single Escape when no terminal was ever focused", async () => {
    useTerminalFocusStore.setState({
      focusedTerminalId: null,
      isAppFullscreen: true,
    });

    vi.mocked(toggleApplicationFullscreen).mockResolvedValue(false);
    const escapeEvent = makeEvent("Escape", "Escape");

    expect(handleApplicationShortcut(escapeEvent)).toBe(true);
    await Promise.resolve();
    expect(useTerminalFocusStore.getState().isAppFullscreen).toBe(false);
  });

  it("releases terminal focus on Shift+Escape when the app is not fullscreen", () => {
    useTerminalFocusStore.setState({
      focusedTerminalId: "term-a",
      isAppFullscreen: false,
    });

    const escapeEvent = makeEvent("Escape", "Escape");
    Object.defineProperty(escapeEvent, "shiftKey", { value: true });
    expect(handleApplicationShortcut(escapeEvent)).toBe(true);
    expect(useTerminalFocusStore.getState().focusedTerminalId).toBeNull();
    expect(useTerminalFocusStore.getState().isAppFullscreen).toBe(false);
  });

  it("F11 enters application fullscreen when no terminal is focused, even if activeTerminalId is set", async () => {
    useTerminalFocusStore.setState({
      activeTerminalId: "term-a",
      focusedTerminalId: null,
      fullscreenTerminalId: null,
      isAppFullscreen: false,
    });

    vi.mocked(toggleApplicationFullscreen).mockResolvedValue(true);
    const f11Event = makeEvent("F11", "F11");

    expect(handleApplicationShortcut(f11Event)).toBe(true);
    await Promise.resolve();
    expect(useTerminalFocusStore.getState().fullscreenTerminalId).toBeNull();
    expect(useTerminalFocusStore.getState().isAppFullscreen).toBe(true);
  });

  it("F11 toggles terminal pane fullscreen when a terminal is focused", () => {
    useTerminalFocusStore.setState({
      focusedTerminalId: "term-a",
      fullscreenTerminalId: null,
      isAppFullscreen: false,
    });

    const f11Event = makeEvent("F11", "F11");

    expect(handleApplicationShortcut(f11Event)).toBe(true);
    expect(useTerminalFocusStore.getState().fullscreenTerminalId).toBe(
      "term-a"
    );
    expect(useTerminalFocusStore.getState().isAppFullscreen).toBe(false);
  });

  it("navigates to settings via G -> S sequence when no terminal or form element is focused", () => {
    const navigate = vi.fn();

    const gEvent = makeEvent("g", "KeyG");
    const sEvent = makeEvent("s", "KeyS");

    expect(handleApplicationShortcut(gEvent, { navigate })).toBe(false);
    expect(handleApplicationShortcut(sEvent, { navigate })).toBe(true);
    expect(navigate).toHaveBeenCalledWith("/settings");
  });

  it("triggers the New Workspace action via Ctrl+N and opens exactly one dialog", () => {
    useTutorialStore.setState({ isCreateWorkspaceDialogOpen: false });
    const ctrlNEvent = makeEvent("n", "KeyN");
    Object.defineProperty(ctrlNEvent, "ctrlKey", { value: true });

    expect(handleApplicationShortcut(ctrlNEvent)).toBe(true);
    expect(useTutorialStore.getState().isCreateWorkspaceDialogOpen).toBe(true);
    expect(ctrlNEvent.preventDefault).toHaveBeenCalled();

    // Repeated key events (event.repeat = true) are ignored
    const repeatEvent = makeEvent("n", "KeyN");
    Object.defineProperty(repeatEvent, "ctrlKey", { value: true });
    Object.defineProperty(repeatEvent, "repeat", { value: true });

    const openSpy = vi.spyOn(
      useTutorialStore.getState(),
      "setCreateWorkspaceDialogOpen"
    );
    expect(handleApplicationShortcut(repeatEvent)).toBe(true);
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
