// @vitest-environment jsdom

import { useWorkspaceShortcuts } from "@workspace/core/hooks/use-workspace-shortcuts";
import { shouldTerminalHandleKeyboardEvent } from "@workspace/core/lib/app-shortcuts";
import { registerKeyboardOverlay } from "@workspace/core/lib/keyboard-ownership";
import { sendTerminalInput } from "@workspace/core/lib/terminal-input";
import { useCommandPaletteStore } from "@workspace/core/stores/command-palette-store";
import { usePanelStore } from "@workspace/core/stores/panel-store";
import { useTerminalFocusStore } from "@workspace/core/stores/terminal-focus-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import type { Terminal } from "@xterm/xterm";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke, isTauri: () => false }));

let terminal: Terminal;
let shortcutsRoot: Root;
const disposers: Array<() => void> = [];

function ShortcutsRegistrar() {
  useWorkspaceShortcuts();
  return null;
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  const { Terminal: XtermTerminal } = await import("@xterm/xterm");
  terminal = new XtermTerminal({ cols: 80, rows: 24 });
  const host = document.createElement("div");
  document.body.append(host);
  terminal.open(host);
  terminal.attachCustomKeyEventHandler(shouldTerminalHandleKeyboardEvent);
  terminal.textarea?.addEventListener("focus", () =>
    useTerminalFocusStore.getState().setFocusedTerminalId("term-2")
  );
  terminal.textarea?.addEventListener("blur", () =>
    useTerminalFocusStore.getState().setFocusedTerminalId(null)
  );
  terminal.focus();
  const shortcutsHost = document.createElement("div");
  document.body.append(shortcutsHost);
  shortcutsRoot = createRoot(shortcutsHost);
  await act(async () =>
    shortcutsRoot.render(createElement(ShortcutsRegistrar))
  );
  invoke.mockClear();
});

afterEach(async () => {
  await act(async () => shortcutsRoot.unmount());
  for (const dispose of disposers.splice(0)) {
    dispose();
  }
  terminal.dispose();
  document.body.replaceChildren();
  useTerminalFocusStore.setState({
    focusedTerminalId: null,
    activeTerminalId: null,
    fullscreenTerminalId: null,
    isAppFullscreen: false,
    pendingTerminalId: null,
  });
  useCommandPaletteStore.setState({ isOpen: false });
  usePanelStore.setState({ isSettingsOpen: false });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  ["Escape", "Escape", 27, {}, "\x1b"],
  ["c", "KeyC", 67, { ctrlKey: true }, "\x03"],
  ["[", "BracketLeft", 219, { ctrlKey: true }, "\x1b"],
  ["ArrowUp", "ArrowUp", 38, {}, "\x1b[A"],
  ["ArrowDown", "ArrowDown", 40, {}, "\x1b[B"],
  ["ArrowLeft", "ArrowLeft", 37, {}, "\x1b[D"],
  ["ArrowRight", "ArrowRight", 39, {}, "\x1b[C"],
  ["Enter", "Enter", 13, {}, "\r"],
  ["Tab", "Tab", 9, {}, "\t"],
] as const)("routes %s through real xterm onData to only Terminal 2", async (key, code, keyCode, modifiers, expected) => {
  const writes: Promise<void>[] = [];
  terminal.onData((data) => writes.push(sendTerminalInput("term-2", data)));
  terminal.textarea?.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      code,
      keyCode,
      ...modifiers,
      bubbles: true,
      cancelable: true,
    })
  );
  await Promise.all(writes);
  expect(invoke).toHaveBeenCalledExactlyOnceWith("write_terminal", {
    id: "term-2",
    data: expected,
  });
  expect(useTerminalFocusStore.getState().focusedTerminalId).toBe("term-2");
});

it("releases focus with Shift+Escape without sending input or leaving fullscreen", () => {
  const input = vi.fn();
  terminal.onData(input);
  useTerminalFocusStore.setState({
    fullscreenTerminalId: "term-2",
    isAppFullscreen: true,
  });
  terminal.textarea?.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
  expect(input).not.toHaveBeenCalled();
  expect(document.activeElement).not.toBe(terminal.textarea);
  expect(useTerminalFocusStore.getState().focusedTerminalId).toBeNull();
  expect(useTerminalFocusStore.getState().fullscreenTerminalId).toBe("term-2");
  expect(useTerminalFocusStore.getState().isAppFullscreen).toBe(true);
});

it("passes normal text through xterm without an application shortcut consuming it", async () => {
  const writes: Promise<void>[] = [];
  terminal.onData((data) => writes.push(sendTerminalInput("term-2", data)));
  terminal.textarea?.dispatchEvent(
    new KeyboardEvent("keypress", {
      key: "a",
      code: "KeyA",
      charCode: 97,
      keyCode: 97,
      bubbles: true,
      cancelable: true,
    })
  );
  await Promise.all(writes);
  expect(invoke).toHaveBeenCalledExactlyOnceWith("write_terminal", {
    id: "term-2",
    data: "a",
  });
});

it("gives a custom overlay priority over the terminal", () => {
  const dismiss = vi.fn();
  disposers.push(registerKeyboardOverlay(dismiss));
  const input = vi.fn();
  terminal.onData(input);
  terminal.textarea?.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      keyCode: 27,
      bubbles: true,
      cancelable: true,
    })
  );
  expect(dismiss).toHaveBeenCalledOnce();
  expect(input).not.toHaveBeenCalled();
});

it.each([
  "dialog",
  "alertdialog",
  "menu",
])("lets the open %s own Escape without sending terminal input", (role) => {
  const overlay = document.createElement("div");
  overlay.setAttribute("role", role);
  overlay.dataset.state = "open";
  document.body.append(overlay);
  const input = vi.fn();
  terminal.onData(input);
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    keyCode: 27,
    bubbles: true,
    cancelable: true,
  });
  terminal.textarea?.dispatchEvent(event);
  expect(input).not.toHaveBeenCalled();
  expect(event.defaultPrevented).toBe(false);
});

it.each([
  "\x1b",
  "\x03",
])("sends fallback byte %j directly to exactly the selected session", async (data) => {
  await sendTerminalInput("term-1", data);
  expect(invoke).toHaveBeenCalledExactlyOnceWith("write_terminal", {
    id: "term-1",
    data,
  });
});

it("releases focus on an outside pointer click and restores normal Marshell Escape", () => {
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  expect(useTerminalFocusStore.getState().focusedTerminalId).toBeNull();
  expect(document.activeElement).not.toBe(terminal.textarea);
  useTerminalFocusStore.setState({ fullscreenTerminalId: "term-2" });
  outside.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  expect(useTerminalFocusStore.getState().fullscreenTerminalId).toBeNull();
});

it("switches the actual keyboard target between split terminals without broadcasting input", async () => {
  const { Terminal: XtermTerminal } = await import("@xterm/xterm");
  const first = new XtermTerminal({ cols: 80, rows: 24 });
  const host = document.createElement("div");
  document.body.append(host);
  first.open(host);
  first.attachCustomKeyEventHandler(shouldTerminalHandleKeyboardEvent);
  disposers.push(() => first.dispose());
  disposers.push(
    useTerminalFocusStore.getState().registerTerminal("term-1", () => {
      first.focus();
      return document.activeElement === first.textarea;
    })
  );
  disposers.push(
    useTerminalFocusStore.getState().registerTerminal("term-2", () => {
      terminal.focus();
      return document.activeElement === terminal.textarea;
    })
  );
  useWorkspaceStore.setState({
    activeWorkspaceId: "workspace",
    activeView: "terminals",
    workspaces: [
      {
        id: "workspace",
        name: "Workspace",
        createdAt: 0,
        terminalCount: 2,
        panes: [
          { id: "term-1", title: "Terminal 1" },
          { id: "term-2", title: "Terminal 2" },
        ],
      },
    ],
  });
  const firstInput = vi.fn();
  const secondInput = vi.fn();
  first.onData(firstInput);
  terminal.onData(secondInput);

  terminal.textarea?.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "1",
      code: "Digit1",
      keyCode: 49,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
  expect(document.activeElement).toBe(first.textarea);
  expect(useTerminalFocusStore.getState().focusedTerminalId).toBe("term-1");
  first.textarea?.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      keyCode: 27,
      bubbles: true,
      cancelable: true,
    })
  );
  expect(firstInput).toHaveBeenCalledExactlyOnceWith("\x1b");
  expect(secondInput).not.toHaveBeenCalled();

  first.textarea?.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "2",
      code: "Digit2",
      keyCode: 50,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
  expect(document.activeElement).toBe(terminal.textarea);
  expect(useTerminalFocusStore.getState().focusedTerminalId).toBe("term-2");
  useWorkspaceStore.getState().setActiveView("preview");
  expect(useTerminalFocusStore.getState().focusedTerminalId).toBeNull();
  expect(document.activeElement).not.toBe(terminal.textarea);
});

it("lets the real Marshell Radix dialog dismiss on Escape ahead of terminal input", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onOpenChange = vi.fn();
  const input = vi.fn();
  terminal.onData(input);
  try {
    await act(async () =>
      root.render(
        createElement(
          Dialog,
          { open: true, onOpenChange },
          createElement(
            DialogContent,
            { "aria-describedby": undefined },
            createElement(DialogTitle, null, "Test dialog")
          )
        )
      )
    );
    await act(async () =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          keyCode: 27,
          bubbles: true,
          cancelable: true,
        })
      )
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(input).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
  }
}, 15_000);

it("focuses a new session when xterm registers, without a timer", () => {
  useWorkspaceStore.setState({
    activeWorkspaceId: "workspace",
    activeView: "terminals",
    workspaces: [
      {
        id: "workspace",
        name: "Workspace",
        createdAt: 0,
        terminalCount: 1,
        panes: [{ id: "new-session", title: "Terminal 1" }],
      },
    ],
  });
  const store = useTerminalFocusStore.getState();
  store.releaseTerminalFocus();
  expect(store.focusTerminal("new-session")).toBe(true);
  expect(useTerminalFocusStore.getState().focusedTerminalId).toBeNull();
  expect(useTerminalFocusStore.getState().pendingTerminalId).toBe(
    "new-session"
  );
  disposers.push(
    store.registerTerminal("new-session", () => {
      terminal.focus();
      return document.activeElement === terminal.textarea;
    })
  );
  expect(document.activeElement).toBe(terminal.textarea);
  expect(useTerminalFocusStore.getState().focusedTerminalId).toBe(
    "new-session"
  );
  expect(useTerminalFocusStore.getState().pendingTerminalId).toBeNull();
});

it("cancels pending session focus when the user clicks outside", () => {
  useTerminalFocusStore.getState().releaseTerminalFocus();
  useTerminalFocusStore.setState({ pendingTerminalId: "new-session" });
  document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  expect(useTerminalFocusStore.getState().pendingTerminalId).toBeNull();
  const focus = vi.fn(() => true);
  disposers.push(
    useTerminalFocusStore.getState().registerTerminal("new-session", focus)
  );
  expect(focus).not.toHaveBeenCalled();
});
