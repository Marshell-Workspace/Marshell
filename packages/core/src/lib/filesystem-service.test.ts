import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  listWindowsDrives,
  searchDirectoryFolders,
} from "./filesystem-service";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

beforeEach(() => {
  vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
  });
  invoke.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

it("surfaces macOS folder access denial instead of presenting an empty search", async () => {
  invoke.mockRejectedValue(
    "macOS blocked access to this folder. Check Files and Folders."
  );
  await expect(
    searchDirectoryFolders("/Users/dev/Documents", "project")
  ).rejects.toThrow("macOS blocked access");
  expect(invoke).toHaveBeenCalledOnce();
});

it("does not invent Linux or Windows locations when the native Mac drive query fails", async () => {
  invoke.mockRejectedValue(new Error("Native filesystem is unavailable"));
  await expect(listWindowsDrives()).rejects.toThrow(
    "Native filesystem is unavailable"
  );
});

it("keeps the selected Mac folder as the search scope and preserves POSIX paths", async () => {
  invoke.mockResolvedValue([
    {
      name: "demo",
      fullPath: "/Users/dev/Projects/demo",
      isDir: true,
      itemType: "directory",
      hidden: false,
      size: 0,
    },
  ]);
  const results = await searchDirectoryFolders(
    "/Users/dev/Projects",
    " demo ",
    { maxDepth: 3 }
  );
  expect(invoke).toHaveBeenCalledWith("search_directory_folders", {
    path: "/Users/dev/Projects",
    query: "demo",
    maxDepth: 3,
    maxResults: 200,
    showHidden: false,
  });
  expect(results[0]?.fullPath).toBe("/Users/dev/Projects/demo");
});
