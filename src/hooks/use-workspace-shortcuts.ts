import { useEffect } from "react";
import { handleApplicationShortcut } from "@/lib/app-shortcuts";

/**
 * Registers global application keyboard shortcuts in the capture phase:
 * - Ctrl+` / Cmd+`: Toggle Main Agent
 * - Ctrl+B / Cmd+B: Toggle Sidebar
 * - Ctrl+K / Cmd+K: Toggle Command Palette
 * - Ctrl+1..8 / Cmd+1..8: Switch focus between terminal panes
 *
 * Uses capture-phase listener to guarantee that global application shortcuts
 * are intercepted before xterm or any focused element can consume or encode them.
 */
export function useWorkspaceShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleApplicationShortcut(e);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);
}
