// @vitest-environment jsdom
import { hotkeys } from "@workspace/core/config/hotkeys";
import { useHotkeysDialogStore } from "@workspace/core/stores/hotkeys-store";
import { messages, NextIntlClientProvider } from "@workspace/i18n";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HotkeysDialog } from "./hotkeys-dialog";

vi.mock("@workspace/ui/components/dialog", () => {
  const Container = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <div>{children}</div> : null,
    DialogContent: Container,
    DialogHeader: Container,
    DialogTitle: Container,
    DialogDescription: Container,
  };
});

vi.mock("@workspace/ui/components/drawer", () => {
  const Container = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Drawer: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <div>{children}</div> : null,
    DrawerContent: Container,
    DrawerHeader: Container,
    DrawerTitle: Container,
    DrawerDescription: Container,
  };
});

describe("HotkeysDialog and locale coverage", () => {
  let root: ReturnType<typeof createRoot>;
  let host: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    useHotkeysDialogStore.setState({ isOpen: true });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    useHotkeysDialogStore.setState({ isOpen: false });
  });

  it("has a matching translation entry in all 10 locales for every hotkey definition", () => {
    for (const [locale, localeMessages] of Object.entries(messages)) {
      const hotkeysDialogMessages = (
        localeMessages as unknown as Record<string, Record<string, string>>
      ).HotkeysDialog;
      expect(
        hotkeysDialogMessages,
        `HotkeysDialog namespace missing in ${locale}`
      ).toBeDefined();

      if (hotkeysDialogMessages) {
        for (const hotkey of hotkeys) {
          expect(
            hotkeysDialogMessages[hotkey.translationKey],
            `Missing key "${hotkey.translationKey}" in locale "${locale}"`
          ).toBeDefined();
          expect(typeof hotkeysDialogMessages[hotkey.translationKey]).toBe(
            "string"
          );
        }

        // Explicit check for switchWorkspaceNum
        expect(
          hotkeysDialogMessages.switchWorkspaceNum,
          `switchWorkspaceNum missing in ${locale}`
        ).toContain("{number}");
      }
    }
  });

  it("renders HotkeysDialog in English with no MISSING_MESSAGE console errors", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages.en}>
          <HotkeysDialog />
        </NextIntlClientProvider>
      );
    });

    const missingErrors = consoleErrorSpy.mock.calls.filter((call) =>
      call.some(
        (arg) => typeof arg === "string" && arg.includes("MISSING_MESSAGE")
      )
    );
    expect(missingErrors).toHaveLength(0);

    // Verify switchWorkspaceNum label interpolated with "1-9"
    expect(host.textContent).toContain("Switch to workspace 1-9");
    expect(host.textContent).toContain("New Workspace");

    consoleErrorSpy.mockRestore();
  });
});
