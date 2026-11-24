// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MacNativePathPicker } from "./mac-native-path-picker";

const open = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));
const onSelect = vi.fn();
const onError = vi.fn();
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const render = async (directory = true, disabled = false) => {
  await act(async () =>
    root.render(
      <MacNativePathPicker
        defaultPath="/Users/dev/Projects"
        directory={directory}
        disabled={disabled}
        onError={onError}
        onSelect={onSelect}
        title="Select workspace"
      />
    )
  );
};
const click = async () => {
  await act(async () => container.querySelector("button")?.click());
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
  });
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  vi.unstubAllGlobals();
});

it("shows an explicit native-Mac action without opening the OS panel on mount", async () => {
  await render();
  expect(container.textContent).toContain("Choose in Finder");
  expect(open).not.toHaveBeenCalled();
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  await render();
  expect(container.querySelector("button")).toBeNull();
  expect(open).not.toHaveBeenCalled();
});

it("does not offer a Finder panel in native Windows builds", async () => {
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  });
  await render();
  expect(container.querySelector("button")).toBeNull();
  expect(open).not.toHaveBeenCalled();
});

it("coalesces repeated clicks and returns one selected folder", async () => {
  let resolve!: (value: string) => void;
  open.mockReturnValue(
    new Promise<string>((r) => {
      resolve = r;
    })
  );
  await render();
  await click();
  await click();
  expect(open).toHaveBeenCalledOnce();
  expect(open).toHaveBeenCalledWith({
    title: "Select workspace",
    directory: true,
    recursive: true,
    multiple: false,
    defaultPath: "/Users/dev/Projects",
  });
  await act(async () => resolve("/Users/dev/Documents/project"));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(
    "/Users/dev/Documents/project"
  );
});

it("keeps the current picker and selection unchanged when the OS panel is cancelled", async () => {
  open.mockResolvedValue(null);
  await render();
  await click();
  expect(onSelect).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
  expect(container.querySelector("button")?.disabled).toBe(false);
});

it("supports file selection without enabling directory recursion", async () => {
  open.mockResolvedValue("/Users/dev/Documents/prd.txt");
  await render(false);
  await click();
  expect(open).toHaveBeenCalledWith(
    expect.objectContaining({
      directory: false,
      recursive: false,
      multiple: false,
    })
  );
  expect(onSelect).toHaveBeenCalledWith("/Users/dev/Documents/prd.txt");
});

it("discards late selections after the parent picker closes", async () => {
  let resolve!: (value: string) => void;
  open.mockReturnValue(
    new Promise<string>((r) => {
      resolve = r;
    })
  );
  await render();
  await click();
  await render(true, true);
  await act(async () => resolve("/Users/dev/Documents/project"));
  expect(onSelect).not.toHaveBeenCalled();
});

it("reports native errors and permits an explicit retry", async () => {
  open
    .mockRejectedValueOnce(new Error("The native dialog could not open"))
    .mockResolvedValueOnce(null);
  await render();
  await click();
  expect(onError).toHaveBeenCalledWith("The native dialog could not open");
  await click();
  expect(open).toHaveBeenCalledTimes(2);
});
