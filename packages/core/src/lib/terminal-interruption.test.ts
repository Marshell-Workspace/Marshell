import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "../stores/workspace-store";
import { useTerminalIdleStore } from "./terminal-idle-store";
import { sendTerminalInput } from "./terminal-input";

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));

beforeEach(() => {
  native.invoke.mockReset().mockResolvedValue(true);
  useTerminalIdleStore.setState({ terminals: {} });
  useWorkspaceStore.setState({
    workspaces: [
      {
        id: "workspace",
        name: "Workspace",
        createdAt: 0,
        terminalCount: 1,
        autoCommand: "codex --yolo",
        panes: [{ id: "terminal", title: "Agent" }],
      },
    ],
  });
  vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
});
afterEach(() => vi.unstubAllGlobals());

it("turns manual Ctrl+C into a task interrupt while the configured Codex CLI is alive", async () => {
  await sendTerminalInput("terminal", "\x03");
  expect(native.invoke).toHaveBeenLastCalledWith("write_terminal", {
    id: "terminal",
    data: "\x1b",
  });
  expect(native.invoke).not.toHaveBeenCalledWith(
    "team_unregister_terminal",
    expect.anything()
  );
  expect(native.invoke).not.toHaveBeenCalledWith(
    "close_terminal",
    expect.anything()
  );
});

it("preserves ordinary shell Ctrl+C after the CLI has exited", async () => {
  native.invoke.mockResolvedValueOnce(false);
  await sendTerminalInput("terminal", "\x03");
  expect(native.invoke).toHaveBeenLastCalledWith("write_terminal", {
    id: "terminal",
    data: "\x03",
  });
});

it("does not turn Ctrl+C for a subsequent dev server into Escape based on a remembered CLI", async () => {
  useTerminalIdleStore
    .getState()
    .ingest(
      "terminal",
      "D:\\work>codex --yolo\nTo continue this session, run codex resume id\nD:\\work>pnpm dev\nReady on port 3000"
    );
  await sendTerminalInput("terminal", "\x03");
  expect(native.invoke).toHaveBeenCalledExactlyOnceWith("write_terminal", {
    id: "terminal",
    data: "\x03",
  });
});

it.each([
  "dev@linux:~/project$ pnpm dev",
  "dev@MacBook project % pnpm dev",
  "/Users/Dev Name/project % pnpm dev",
  "~/project $ pnpm dev",
])("sends shell Ctrl+C after a CLI exits to a Unix prompt: %s", async (prompt) => {
  useTerminalIdleStore
    .getState()
    .ingest("terminal", `${prompt}\nReady on port 3000`);
  await sendTerminalInput("terminal", "\x03");
  expect(native.invoke).toHaveBeenLastCalledWith("write_terminal", {
    id: "terminal",
    data: "\x03",
  });
});

it("uses the newly launched Unix CLI instead of the remembered startup command", async () => {
  useTerminalIdleStore
    .getState()
    .ingest(
      "terminal",
      "dev@linux:~/project$ agy --dangerously-skip-permissions\nAntigravity CLI"
    );
  await sendTerminalInput("terminal", "\x03");
  expect(native.invoke).toHaveBeenLastCalledWith("write_terminal", {
    id: "terminal",
    data: "\x03",
  });
});

it("still allows an explicit CLI exit command without rewriting it", async () => {
  await sendTerminalInput("terminal", "/exit\r");
  expect(native.invoke).toHaveBeenCalledExactlyOnceWith("write_terminal", {
    id: "terminal",
    data: "/exit\r",
  });
});

it("does not send the exit shortcut when process inspection fails", async () => {
  native.invoke.mockRejectedValue(new Error("Cannot inspect process"));
  await expect(sendTerminalInput("terminal", "\x03")).rejects.toThrow(
    "Cannot inspect process"
  );
  expect(
    native.invoke.mock.calls.some(([command]) => command === "write_terminal")
  ).toBe(false);
});
