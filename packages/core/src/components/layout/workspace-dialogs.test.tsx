// @vitest-environment jsdom

import { usePanelStore } from "@workspace/core/stores/panel-store";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { WorkspaceDialogs } from "./workspace-dialogs";

const loaded = vi.hoisted(() => ({ settings: 0 }));
vi.mock("@workspace/core/components/settings/settings-dialog", () => {
  loaded.settings++;
  return { SettingsDialog: () => <div data-testid="settings">Settings</div> };
});
it("defers settings until first open and preserves its mount while closing", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(<WorkspaceDialogs navigate={() => {}} />);
    });
    expect(loaded.settings).toBe(0);
    expect(host.textContent).toBe("");
    await act(async () => {
      usePanelStore.getState().openSettings("general");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(host.querySelector('[data-testid="settings"]')).not.toBeNull();
    await act(async () => {
      usePanelStore.getState().closeSettings();
    });
    expect(host.querySelector('[data-testid="settings"]')).not.toBeNull();
  } finally {
    await act(async () => {
      root.unmount();
    });
    usePanelStore.getState().closeSettings();
    vi.unstubAllGlobals();
  }
});
