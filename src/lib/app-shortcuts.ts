import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useLayoutStore } from "@/stores/layout-store";
import { useTerminalFocusStore } from "@/stores/terminal-focus-store";

/**
 * Checks if a given KeyboardEvent matches an application-level global shortcut.
 * Used by both the window capture-phase listener and xterm's attachCustomKeyEventHandler
 * to prevent the terminal from consuming application shortcuts.
 */
export function isApplicationShortcut(event: KeyboardEvent): boolean {
  const isMod =
    (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;

  if (isMod) {
    // 1. Toggle Sidebar: Ctrl+B / Cmd+B
    if (event.key === "b" || event.key === "B" || event.code === "KeyB") {
      return true;
    }
    // 2. Command Palette: Ctrl+K / Cmd+K
    if (event.key === "k" || event.key === "K" || event.code === "KeyK") {
      return true;
    }
    // 3. Terminal switching: Ctrl+1..8 / Cmd+1..8
    if (
      (event.key >= "1" && event.key <= "8") ||
      (event.code >= "Digit1" && event.code <= "Digit8") ||
      (event.code >= "Numpad1" && event.code <= "Numpad8")
    ) {
      return true;
    }
  }

  // Fullscreen: F11
  if (event.key === "F11" || event.code === "F11") {
    return true;
  }

  return false;
}

/**
 * Handles an application-level shortcut during the capture phase.
 * Prevents event bubbling and terminal interception.
 * Returns true if the event was handled as an application shortcut.
 */
export function handleApplicationShortcut(event: KeyboardEvent): boolean {
  if (!isApplicationShortcut(event)) {
    return false;
  }

  // Prevent repeated toggles on held keys
  if (event.repeat) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return true;
  }

  const isMod =
    (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;

  // 1. Toggle Sidebar: Ctrl+B / Cmd+B
  if (
    isMod &&
    (event.key === "b" || event.key === "B" || event.code === "KeyB")
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    useLayoutStore.getState().toggleSidebar();
    return true;
  }

  // 2. Command Palette: Ctrl+K / Cmd+K
  if (
    isMod &&
    (event.key === "k" || event.key === "K" || event.code === "KeyK")
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    useCommandPaletteStore.getState().toggle();
    return true;
  }

  // 3. Terminal switching: Ctrl+1..8 / Cmd+1..8
  if (isMod) {
    let num = -1;
    if (event.key >= "1" && event.key <= "8") {
      num = Number.parseInt(event.key, 10);
    } else if (event.code >= "Digit1" && event.code <= "Digit8") {
      num = Number.parseInt(event.code.replace("Digit", ""), 10);
    } else if (event.code >= "Numpad1" && event.code <= "Numpad8") {
      num = Number.parseInt(event.code.replace("Numpad", ""), 10);
    }

    if (num >= 1 && num <= 8) {
      const handled = useTerminalFocusStore
        .getState()
        .focusTerminalByIndex(num - 1);
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return true;
      }
    }
  }

  return false;
}
