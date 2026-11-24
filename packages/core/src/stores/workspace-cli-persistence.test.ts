// @vitest-environment jsdom

import { getSubmittedTerminalCliCommand } from "@workspace/core/lib/terminal-cli-logo";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { beforeEach, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke, isTauri: () => false }));

beforeEach(() => {
  localStorage.clear();
  invoke.mockClear();
  useWorkspaceStore.setState({
    activeWorkspaceId: "workspace-1",
    workspaces: [
      {
        id: "workspace-1",
        name: "GameHub",
        createdAt: 0,
        terminalCount: 2,
        autoCommand: "codex --yolo",
        panes: [
          { id: "term-1", title: "Terminal 1" },
          { id: "term-2", title: "Terminal 2" },
        ],
      },
    ],
  });
});

it("restores a manually selected CLI and its flags for only that terminal after reopening", async () => {
  const command = getSubmittedTerminalCliCommand(
    {
      baseY: 0,
      cursorY: 0,
      getLine: () => ({
        isWrapped: false,
        translateToString: () => "PS D:\\GameHub> agy --mode=plan",
      }),
    },
    "\r"
  );
  expect(command).toBe("agy --mode=plan");
  useWorkspaceStore.getState().setTerminalCliCommand("term-2", command ?? "");
  const persisted = localStorage.getItem("marshell-workspaces-v2");
  expect(persisted).not.toBeNull();

  // Simulate a fresh in-memory store loading the previous application's storage.
  useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });
  localStorage.setItem("marshell-workspaces-v2", persisted ?? "");
  await useWorkspaceStore.persist.rehydrate();

  const store = useWorkspaceStore.getState();
  expect(store.getTerminalStartupCommand("term-2")).toBe("agy --mode=plan");
  expect(store.getTerminalStartupCommand("term-1")).toBe("codex --yolo");
  expect(store.workspaces[0]?.autoCommand).toBe("codex --yolo");
  expect(store.workspaces[0]?.panes.map((pane) => pane.id)).toEqual([
    "term-1",
    "term-2",
  ]);
  expect(invoke).not.toHaveBeenCalled();
});

it("preserves each pane's original override until explicitly changed", () => {
  useWorkspaceStore.setState({
    workspaces: [
      {
        id: "workspace-1",
        name: "GameHub",
        createdAt: 0,
        terminalCount: 2,
        autoCommand: "codex",
        panes: [
          { id: "term-1", title: "Terminal 1", autoCommand: "claude --resume" },
          { id: "term-2", title: "Terminal 2" },
        ],
      },
    ],
  });
  const store = useWorkspaceStore.getState();
  expect(store.getTerminalStartupCommand("term-1")).toBe("claude --resume");
  store.setTerminalCliCommand("term-1", "agy");
  expect(store.getTerminalStartupCommand("term-1")).toBe("agy");
  expect(store.getTerminalStartupCommand("term-2")).toBe("codex");
});

it.each([
  "PS D:\\GameHub> echo agy",
  "> switch to agy",
  "Please run codex",
  "PS D:\\GameHub> cd D:/codex",
])("does not treat %s as a manual CLI selection", (text) => {
  expect(
    getSubmittedTerminalCliCommand(
      {
        baseY: 0,
        cursorY: 0,
        getLine: () => ({ isWrapped: false, translateToString: () => text }),
      },
      "\r"
    )
  ).toBeNull();
});
