// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteTerminalDialog } from "./delete-terminal-dialog";

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("DeleteTerminalDialog", () => {
  it("renders with theme-adaptive popover background and no hardcoded black UI", async () => {
    await act(async () => {
      root.render(
        <DeleteTerminalDialog
          name="Juno"
          onConfirm={vi.fn()}
          onOpenChange={vi.fn()}
          open={true}
          title="Terminal 1"
        />
      );
    });

    const dialogContent = document.querySelector(
      '[data-slot="dialog-content"]'
    );
    expect(dialogContent).not.toBeNull();
    const className = dialogContent?.getAttribute("class") ?? "";

    // Must use theme tokens (bg-popover, text-popover-foreground, border-border)
    expect(className).toContain("bg-popover");
    expect(className).toContain("text-popover-foreground");
    expect(className).toContain("border-border");

    // Must NOT have hardcoded dark background or white border
    expect(className).not.toContain("bg-[#0d0e11]");
    expect(className).not.toContain("border-white");

    // Check warning text and buttons exist
    expect(document.body.textContent).toContain("Delete Terminal?");
    expect(document.body.textContent).toContain("Juno (Terminal 1)");
    expect(document.body.textContent).toContain(
      "Any running processes or unsaved commands in this terminal will be terminated."
    );
  });
});
