// @vitest-environment jsdom
import { messages, NextIntlClientProvider } from "@workspace/i18n";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCommandPaletteStore } from "../../stores/command-palette-store";
import { CommandPalette } from "./command-palette";

const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 480;

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

function mount() {
  return act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={messages.en}>
        <CommandPalette navigate={() => undefined} />
      </NextIntlClientProvider>
    );
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        /* noop */
      }
      unobserve() {
        /* noop */
      }
      disconnect() {
        /* noop */
      }
    }
  );
  Element.prototype.scrollIntoView = () => undefined;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  useCommandPaletteStore.setState({ isOpen: false });
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CommandPalette history", () => {
  it("does not add a history entry for the desktop dialog", async () => {
    window.innerWidth = DESKTOP_WIDTH;
    const push = vi.spyOn(window.history, "pushState");
    useCommandPaletteStore.setState({ isOpen: true });
    await mount();
    expect(push).not.toHaveBeenCalled();
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
  });

  it("keeps the Back-gesture history entry for the mobile drawer", async () => {
    window.innerWidth = MOBILE_WIDTH;
    const push = vi.spyOn(window.history, "pushState");
    useCommandPaletteStore.setState({ isOpen: true });
    await mount();
    expect(push).toHaveBeenCalled();
  });
});
