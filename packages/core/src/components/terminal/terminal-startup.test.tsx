// @vitest-environment jsdom

import { useTerminalIdleStore } from "@workspace/core/lib/terminal-idle-store";
import { terminalLayoutManager } from "@workspace/core/lib/terminal-layout-manager";
import { useGeneralSettingsStore } from "@workspace/core/stores/general-settings-store";
import { messages, NextIntlClientProvider } from "@workspace/i18n";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TerminalPane } from "./terminal-pane";

const native = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  invoke: vi.fn(),
  listen: vi.fn(),
  output: vi.fn(),
  deferWrites: false,
  parsed: [] as (() => void)[],
  screenLines: [] as string[],
  inputs: [] as ReturnType<typeof vi.fn>[],
  dimensions: { cols: 80, rows: 24 },
  terminals: [] as { options: Record<string, unknown> }[],
}));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: native.isTauri,
  invoke: native.invoke,
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: native.listen }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ onResized: async () => () => {} }),
}));
vi.mock("@workspace/core/hooks/use-mounted", () => ({
  useMounted: () => true,
}));
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    textarea = document.createElement("textarea");
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown> = {}) {
      this.options = { ...options };
      native.terminals.push(this);
    }
    unicode = { activeVersion: "6" };
    buffer = {
      active: {
        type: "normal",
        baseY: 0,
        cursorY: 0,
        get length() {
          return native.screenLines.length;
        },
        getLine: (row: number) =>
          native.screenLines[row] === undefined
            ? undefined
            : { translateToString: () => native.screenLines[row]! },
      },
    };
    loadAddon(addon: {
      activate?: (terminal: { cols: number; rows: number }) => void;
    }) {
      addon.activate?.(this);
    }
    open() {}
    attachCustomKeyEventHandler() {}
    onSelectionChange() {}
    dispose() {}
    focus() {}
    blur() {}
    refresh() {}
    write(data: unknown, callback?: () => void) {
      if (native.deferWrites && data instanceof Uint8Array && callback) {
        native.parsed.push(callback);
        return;
      }
      callback?.();
    }
    writeln = native.output;
    onData() {
      const dispose = vi.fn();
      native.inputs.push(dispose);
      return { dispose };
    }
  },
}));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    terminal: { cols: number; rows: number } | null = null;
    activate(terminal: { cols: number; rows: number }) {
      this.terminal = terminal;
    }
    fit() {
      if (this.terminal) {
        Object.assign(this.terminal, native.dimensions);
      }
    }
    proposeDimensions() {
      return native.dimensions;
    }
  },
}));
vi.mock("@xterm/addon-web-links", () => ({ WebLinksAddon: class {} }));
vi.mock("@xterm/addon-unicode11", () => ({ Unicode11Addon: class {} }));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let pending = true;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("isTauri", true);
  vi.stubGlobal("__TAURI_INTERNALS__", {
    invoke: native.invoke,
    transformCallback: () => 1,
    metadata: { currentWindow: { label: "main" } },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  native.inputs.length = 0;
  native.terminals.length = 0;
  native.dimensions = { cols: 80, rows: 24 };
  native.isTauri.mockReset().mockReturnValue(true);
  native.output.mockClear();
  native.deferWrites = false;
  native.parsed.length = 0;
  native.screenLines = [];
  native.listen.mockResolvedValue(() => {});
  pending = true;
  native.invoke.mockReset().mockImplementation(async (command: string) => {
    if (command === "create_terminal") {
      return { is_new: false, instance_id: 42 };
    }
    if (command === "get_terminal_history") {
      return {
        startup_pending: pending,
        history: "PS D:\\project> ",
        total_read: 0,
      };
    }
    if (command === "launch_terminal_command") {
      pending = false;
      return true;
    }
    return;
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const render = async (key = "first") =>
  act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={messages.en} timeZone="UTC">
        <TerminalPane
          autoCommand="echo startup"
          id="startup-terminal"
          key={key}
          title="Terminal"
        />
      </NextIntlClientProvider>
    )
  );
const launches = () =>
  native.invoke.mock.calls.filter(
    ([command]) => command === "launch_terminal_command"
  );

it("recovers a pending startup on an existing PTY and does not launch again after remount", async () => {
  await render();
  await vi.waitFor(() => expect(launches()).toHaveLength(1));
  expect(launches()[0]?.[1]).toEqual({
    id: "startup-terminal",
    instanceId: 42,
    command: "echo startup",
  });
  await render("remounted");
  await vi.waitFor(() =>
    expect(
      native.invoke.mock.calls.filter(
        ([command]) => command === "get_terminal_history"
      )
    ).toHaveLength(2)
  );
  expect(launches()).toHaveLength(1);
});

it("retries history loading without losing startup or duplicating input listeners", async () => {
  const implementation = native.invoke.getMockImplementation()!;
  let failHistory = true;
  native.invoke.mockImplementation(async (...args) => {
    if (args[0] === "get_terminal_history" && failHistory) {
      failHistory = false;
      throw new Error("temporary history failure");
    }
    return await implementation(...args);
  });
  await render();
  await vi.waitFor(() => expect(launches()).toHaveLength(1), { timeout: 4000 });
  expect(native.inputs).toHaveLength(2);
  expect(native.inputs[0]).toHaveBeenCalledOnce();
});

it("reports native startup failure instead of running a demo shell", async () => {
  native.invoke.mockRejectedValue(new Error("PTY could not start"));
  await render();
  await vi.waitFor(
    () =>
      expect(native.output).toHaveBeenCalledWith(
        expect.stringContaining("Terminal initialization failed")
      ),
    { timeout: 4000 }
  );
  expect(launches()).toHaveLength(0);
  expect(native.output).toHaveBeenCalledWith(
    expect.stringContaining("Terminal initialization failed")
  );
  expect(native.output.mock.calls.flat().join(" ")).not.toContain(
    "marshell-demo"
  );
});

it("waits for the native grid size acknowledgement before starting a CLI", async () => {
  let resized = () => {};
  const resizing = new Promise<void>((resolve) => {
    resized = resolve;
  });
  const implementation = native.invoke.getMockImplementation()!;
  native.invoke.mockImplementation(async (...args) => {
    if (args[0] === "resize_terminal") {
      await resizing;
    }
    return await implementation(...args);
  });
  await render();
  await vi.waitFor(() =>
    expect(
      native.invoke.mock.calls.some(
        ([command, size]) =>
          command === "resize_terminal" && size.cols === 80 && size.rows === 24
      )
    ).toBe(true)
  );
  expect(launches()).toHaveLength(0);
  await act(async () => resized());
  await vi.waitFor(() => expect(launches()).toHaveLength(1));
});

it("restores the original PTY width when a resize reverses before its acknowledgement", async () => {
  await render();
  await vi.waitFor(() => expect(launches()).toHaveLength(1));
  const viewport = container.querySelector('[aria-label="Terminal terminal"]');
  Object.defineProperties(viewport!, {
    clientWidth: { value: 800 },
    clientHeight: { value: 500 },
  });
  let resized = () => {};
  const resizing = new Promise<void>((resolve) => {
    resized = resolve;
  });
  const implementation = native.invoke.getMockImplementation()!;
  native.invoke.mockImplementation(async (...args) => {
    const size = args[1] as { cols?: number } | undefined;
    if (args[0] === "resize_terminal" && size?.cols === 47) {
      await resizing;
    }
    return await implementation(...args);
  });
  const before = native.invoke.mock.calls.length;
  native.dimensions = { cols: 47, rows: 24 };
  terminalLayoutManager.syncTerminalSize("startup-terminal", true);
  await vi.waitFor(() =>
    expect(native.invoke).toHaveBeenCalledWith(
      "resize_terminal",
      expect.objectContaining({ cols: 47 })
    )
  );
  native.dimensions = { cols: 80, rows: 24 };
  terminalLayoutManager.syncTerminalSize("startup-terminal", true);
  await act(async () => resized());
  await vi.waitFor(() =>
    expect(native.invoke.mock.calls.slice(before)).toContainEqual([
      "resize_terminal",
      { id: "startup-terminal", cols: 80, rows: 24 },
    ])
  );
});

it("returns output credits only after xterm parsing and detaches the exact lease", async () => {
  const invoke = native.invoke.getMockImplementation()!;
  let stdout:
    | ((event: {
        payload: {
          data: string;
          bytes: number[];
          offset: number;
          instance_id: number;
        };
      }) => void)
    | undefined;
  native.listen.mockImplementation(async (name, callback) => {
    if (name === "terminal-stdout-startup-terminal") {
      stdout = callback;
    }
    return () => {};
  });
  native.invoke.mockImplementation(async (...args) =>
    args[0] === "attach_terminal_output" ? 17 : invoke(...args)
  );
  await render();
  await vi.waitFor(() => expect(launches()).toHaveLength(1));
  await vi.waitFor(() =>
    expect(native.invoke).toHaveBeenCalledWith(
      "acknowledge_terminal_output",
      expect.objectContaining({ offset: 0 })
    )
  );
  native.invoke.mockClear();
  native.deferWrites = true;
  useTerminalIdleStore.getState().markBusy("startup-terminal");
  native.screenLines = [
    "› [Pasted content 7524 chars]",
    "GPT-6-Astra medium · D:\\karm\\Voicela",
    "⚠ 2 warnings · f2 to view",
  ];
  await act(async () =>
    stdout?.({
      payload: {
        data: "😀",
        bytes: [240, 159, 152, 128],
        offset: 0,
        instance_id: 42,
      },
    })
  );
  await vi.waitFor(() => expect(native.parsed).toHaveLength(1));
  expect(
    useTerminalIdleStore.getState().terminals["startup-terminal"]
      ?.screenSinceInput
  ).toBeUndefined();
  expect(
    native.invoke.mock.calls.some(
      ([command]) => command === "acknowledge_terminal_output"
    )
  ).toBe(false);
  native.parsed.shift()?.();
  expect(
    useTerminalIdleStore.getState().terminals["startup-terminal"]
      ?.screenSinceInput
  ).toContain("[Pasted content 7524 chars]");
  await vi.waitFor(() =>
    expect(native.invoke).toHaveBeenCalledWith("acknowledge_terminal_output", {
      id: "startup-terminal",
      instanceId: 42,
      lease: 17,
      offset: 4,
    })
  );
  await act(async () => root.render(null));
  await vi.waitFor(() =>
    expect(native.invoke).toHaveBeenCalledWith("detach_terminal_output", {
      id: "startup-terminal",
      instanceId: 42,
      lease: 17,
    })
  );
});

it("preserves readiness glyphs split across native UTF-8 output events", async () => {
  let stdout:
    | ((event: {
        payload: {
          data: string;
          bytes: number[];
          offset: number;
          instance_id: number;
        };
      }) => void)
    | undefined;
  native.listen.mockImplementation(async (name, callback) => {
    if (name === "terminal-stdout-startup-terminal") {
      stdout = callback;
    }
    return () => {};
  });
  await render();
  await vi.waitFor(() => expect(launches()).toHaveLength(1));
  useTerminalIdleStore.getState().markBusy("startup-terminal");
  await act(async () =>
    stdout?.({
      payload: { data: "�", bytes: [226, 157], offset: 0, instance_id: 42 },
    })
  );
  await act(async () =>
    stdout?.({
      payload: { data: "� ", bytes: [175, 32], offset: 2, instance_id: 42 },
    })
  );
  expect(
    useTerminalIdleStore.getState().terminals["startup-terminal"]
      ?.outputSinceInput
  ).toBe("❯ ");
});

it("creates terminals from the saved settings and applies later changes to the open terminal", async () => {
  const settings = useGeneralSettingsStore.getState();
  settings.setDefaultShell("powershell");
  settings.setTerminalFontSize(16);
  settings.setTerminalCursorStyle("bar");
  settings.setTerminalCursorBlink(false);
  settings.setTerminalScrollback(10_000);
  await render();
  await vi.waitFor(() => expect(native.terminals.length).toBeGreaterThan(0));
  const terminal = native.terminals.at(-1)!;
  expect(terminal.options).toMatchObject({
    fontSize: 16,
    cursorStyle: "bar",
    cursorBlink: false,
    scrollback: 10_000,
  });
  await vi.waitFor(() =>
    expect(
      native.invoke.mock.calls.find(
        ([command]) => command === "create_terminal"
      )?.[1]
    ).toMatchObject({ shell: "powershell" })
  );

  await act(async () => {
    useGeneralSettingsStore.getState().setTerminalFontSize(20);
    useGeneralSettingsStore.getState().setTerminalCursorStyle("underline");
    useGeneralSettingsStore.getState().setTerminalCursorBlink(true);
    useGeneralSettingsStore.getState().setTerminalScrollback(50_000);
  });
  expect(terminal.options).toMatchObject({
    fontSize: 20,
    cursorStyle: "underline",
    cursorBlink: true,
    scrollback: 50_000,
  });
  useGeneralSettingsStore.getState().resetToDefaults();
});
