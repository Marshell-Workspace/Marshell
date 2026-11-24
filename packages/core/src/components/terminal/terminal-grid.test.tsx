// @vitest-environment jsdom
import { prewarmWorkspace } from "@workspace/core/lib/workspace-prewarm";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TerminalGrid } from "./terminal-grid";

vi.mock("@workspace/core/components/terminal/terminal-pane", () => ({
  TerminalPane: ({
    id,
    isActiveWorkspace,
  }: {
    id: string;
    isActiveWorkspace: boolean;
  }) => (
    <div data-active={String(isActiveWorkspace)} data-pane={id}>
      pane
    </div>
  ),
}));

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
let first: string;
let second: string;

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });
  const store = useWorkspaceStore.getState();
  first = store.createWorkspace("One", 2, "C:one").id;
  second = store.createWorkspace("Two", 2, "C:\two").id;
  useWorkspaceStore.getState().setActiveWorkspace(first);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<TerminalGrid />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const activeFlags = () =>
  Array.from(host.querySelectorAll<HTMLElement>("[data-pane]")).map(
    (el) => el.dataset.active
  );

it("only mounts terminals for the active workspace until another is visited", () => {
  expect(activeFlags()).toEqual(["true", "true"]);
});

it("mounts a workspace early when the sidebar signals hover intent, without activating it", async () => {
  await act(async () => prewarmWorkspace(second));
  expect(activeFlags().sort()).toEqual(["false", "false", "true", "true"]);
});

it("switches the active flag and keeps both workspaces mounted for a smooth return", async () => {
  await act(async () =>
    useWorkspaceStore.getState().setActiveWorkspace(second)
  );
  expect(activeFlags().sort()).toEqual(["false", "false", "true", "true"]);
  await act(async () => useWorkspaceStore.getState().setActiveWorkspace(first));
  expect(activeFlags().sort()).toEqual(["false", "false", "true", "true"]);
});

it("ignores a prewarm request for a workspace that does not exist", async () => {
  await act(async () => prewarmWorkspace("missing"));
  expect(activeFlags()).toEqual(["true", "true"]);
});
