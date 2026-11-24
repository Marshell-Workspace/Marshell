import { handleApplicationShortcut } from "@workspace/core/lib/app-shortcuts";
import { useTerminalFocusStore } from "@workspace/core/stores/terminal-focus-store";
import { useEffect } from "react";

/**
 * Registers global application keyboard shortcuts in the capture phase:
 * - Ctrl+B / Cmd+B: Toggle Sidebar
 * - Ctrl+K / Cmd+K: Toggle Command Palette
 * - Ctrl+1..8 / Cmd+1..8: Switch focus between terminal panes
 *
 * Uses capture-phase listener to guarantee that global application shortcuts
 * are intercepted before xterm or any focused element can consume or encode them.
 */
export function useWorkspaceShortcuts(options?: {
  navigate?: (path: string) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleApplicationShortcut(e, options);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (
        (useTerminalFocusStore.getState().focusedTerminalId ||
          useTerminalFocusStore.getState().pendingTerminalId) &&
        event.target instanceof Element &&
        !event.target.closest(".xterm")
      ) {
        useTerminalFocusStore.getState().releaseTerminalFocus();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("pointerdown", handlePointerDown, {
      capture: true,
    });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("pointerdown", handlePointerDown, {
        capture: true,
      });
    };
  }, [options?.navigate]);
}
