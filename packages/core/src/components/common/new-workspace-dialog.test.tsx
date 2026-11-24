// @vitest-environment jsdom
import { messages, NextIntlClientProvider } from "@workspace/i18n";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewWorkspaceDialog } from "./new-workspace-dialog";

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.innerWidth = 800;
  window.innerHeight = 600;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("NewWorkspaceDialog responsive behavior", () => {
  it("renders with header, body and buttons, and updates bounds when window is maximized", async () => {
    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages.en}>
          <NewWorkspaceDialog onOpenChange={() => {}} open={true} />
        </NextIntlClientProvider>
      );
    });

    const surface = document.querySelector<HTMLElement>(
      '[data-slot="genie-modal-surface"]'
    );
    expect(surface).not.toBeNull();

    // Verify header and footer submit button are present
    expect(
      document.querySelector('[data-tour="submit-workspace-btn"]')
    ).not.toBeNull();

    // Verify AI agent list is present
    expect(
      document.querySelector('[data-tour="workspace-ai-agents-list"]')
    ).not.toBeNull();

    // Initial bounds at 800x600: width approx 800 * 0.97 = 776px
    const initialWidth = surface?.style.width;
    expect(initialWidth).toBe("776px");

    // Simulate window maximize to 1920x1080
    window.innerWidth = 1920;
    window.innerHeight = 1080;

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("maximize"));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    // In a maximized 1920x1080 window, maxWidth caps at 1400px
    expect(surface?.style.width).toBe("1400px");
    expect(surface?.style.height).toBe("960px");

    // Simulate window restore / unmaximize back to 800x600
    window.innerWidth = 800;
    window.innerHeight = 600;

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("unmaximize"));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(surface?.style.width).toBe("776px");
    expect(surface?.style.height).toBe("564px");
  }, 15_000);

  it("calls onOpenChange(false) when clicking outside the modal box", async () => {
    const handleOpenChange = vi.fn();
    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages.en}>
          <NewWorkspaceDialog onOpenChange={handleOpenChange} open={true} />
        </NextIntlClientProvider>
      );
    });

    const overlay = document.querySelector<HTMLElement>(
      '[data-slot="genie-modal-overlay"]'
    );
    expect(overlay).not.toBeNull();

    await act(async () => {
      const evt = new Event("pointerdown", { bubbles: true, cancelable: true });
      overlay?.dispatchEvent(evt);
    });

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  }, 15_000);
});
