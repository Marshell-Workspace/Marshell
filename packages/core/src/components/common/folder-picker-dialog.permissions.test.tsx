// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FolderPickerDialog } from "./folder-picker-dialog";

const calls = vi.hoisted(() => ({
  drives: vi.fn(),
  contents: vi.fn(),
  validate: vi.fn(),
  search: vi.fn(),
}));
vi.mock("@workspace/core/lib/folder-picker-client", () => ({
  fetchSystemLocations: calls.drives,
  fetchFolderContents: calls.contents,
  validateFolderPath: calls.validate,
  searchFolders: calls.search,
  normalizePathDisplay: (value: string) => value,
  getBreadcrumbSegments: () => [],
}));
vi.mock("@workspace/ui/lib/popup-motion", () => ({
  usePopupController: () => ({
    isRendered: false,
    isClosing: false,
    triggerSnapshotRef: { current: null },
    completeClose: vi.fn(),
  }),
  useGeniePopupAnimation: vi.fn(),
}));
let root: ReturnType<typeof createRoot>;
const render = async (open: boolean, initialPath?: string) => {
  await act(async () =>
    root.render(
      <FolderPickerDialog
        initialPath={initialPath}
        onOpenChange={vi.fn()}
        onSelectFolder={vi.fn()}
        open={open}
      />
    )
  );
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  calls.drives.mockResolvedValue([
    { driveType: "fixed", name: "Home (/Users/dev)", path: "/Users/dev" },
    { driveType: "fixed", name: "Root (/)", path: "/" },
  ]);
  calls.contents.mockResolvedValue({
    path: "THIS_PC",
    parent: null,
    items: [],
  });
  calls.validate.mockResolvedValue(true);
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it("does not enumerate drives or inspect folders merely because a closed picker is mounted", async () => {
  await render(false);
  expect(calls.drives).not.toHaveBeenCalled();
  expect(calls.contents).not.toHaveBeenCalled();
  expect(calls.validate).not.toHaveBeenCalled();
  expect(calls.search).not.toHaveBeenCalled();
  await render(true);
  expect(calls.drives).toHaveBeenCalledOnce();
  expect(calls.contents).toHaveBeenCalledWith("THIS_PC");
});

it("does not inspect a protected initial folder after the user has closed the picker", async () => {
  let resolve!: (valid: boolean) => void;
  calls.validate.mockReturnValue(
    new Promise<boolean>((r) => {
      resolve = r;
    })
  );
  await render(true, "/Users/dev/Documents");
  await render(false, "/Users/dev/Documents");
  await act(async () => resolve(true));
  expect(calls.contents).not.toHaveBeenCalled();
});
