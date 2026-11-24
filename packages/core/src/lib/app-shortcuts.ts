import {
  dismissKeyboardOverlay,
  getKeyboardOwner,
  isReleaseTerminalFocusShortcut,
} from "@workspace/core/lib/keyboard-ownership";
import { isMacPlatform } from "@workspace/core/lib/terminal-mac-keys";
import { useCommandPaletteStore } from "@workspace/core/stores/command-palette-store";
import { useLayoutStore } from "@workspace/core/stores/layout-store";
import { usePanelStore } from "@workspace/core/stores/panel-store";
import { useTerminalFocusStore } from "@workspace/core/stores/terminal-focus-store";
import { useTutorialStore } from "@workspace/core/stores/tutorial-store";

/**
 * Track key sequence for "G" followed by "S" (Go to Settings)
 */
let lastGKeyPressTime = 0;
const G_KEY_SEQUENCE_WINDOW_MS = 800;

function isOverlayToggleShortcut(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) {
    return false;
  }
  const key = event.key.toLowerCase();
  return (
    (key === "k" && useCommandPaletteStore.getState().isOpen) ||
    (key === "," && usePanelStore.getState().isSettingsOpen)
  );
}

/**
 * Checks if a given KeyboardEvent matches an application-level global shortcut.
 * Used by both the window capture-phase listener and xterm's attachCustomKeyEventHandler
 * to prevent the terminal from consuming application shortcuts.
 */
export function isApplicationShortcut(event: KeyboardEvent): boolean {
  const owner = getKeyboardOwner(event);
  if (owner === "overlay" && !isOverlayToggleShortcut(event)) {
    return false;
  }
  if (isReleaseTerminalFocusShortcut(event)) {
    return true;
  }
  // Input / editor focus guard: do not intercept normal typing inside form fields
  const target =
    typeof Element !== "undefined" && event.target instanceof Element
      ? (event.target as HTMLElement)
      : null;
  if (target) {
    const tagName = target.tagName;
    if (
      (tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target.isContentEditable ||
        target.closest?.(".monaco-editor")) &&
      event.key !== "F11" &&
      event.key !== "Escape" &&
      !(event.ctrlKey || event.metaKey)
    ) {
      return false;
    }
  }

  // On macOS, Ctrl belongs to the shell (Ctrl+B/K/N/I/1-8 are tmux, readline and
  // vim keys). Inside a terminal only Cmd triggers application shortcuts.
  const ownsCtrl = isMacPlatform() && Boolean(target?.closest?.(".xterm"));
  const isMod =
    (event.metaKey || (event.ctrlKey && !ownsCtrl)) &&
    !event.altKey &&
    !event.shiftKey;

  if (isMod) {
    // 1. Toggle Sidebar: Ctrl+B / Cmd+B
    if (event.key === "b" || event.key === "B" || event.code === "KeyB") {
      return true;
    }
    // 2. Command Palette: Ctrl+K / Cmd+K
    if (event.key === "k" || event.key === "K" || event.code === "KeyK") {
      return true;
    }
    // 3. Open Settings: Ctrl+, / Cmd+,
    if (event.key === "," || event.code === "Comma") {
      return true;
    }
    // 4. New Workspace: Ctrl+N / Cmd+N
    if (event.key === "n" || event.key === "N" || event.code === "KeyN") {
      return true;
    }
    // 5. Terminal switching: Ctrl+1..8 / Cmd+1..8
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

  // Plain Escape belongs to xterm when it owns keyboard focus.
  if (event.key === "Escape" || event.code === "Escape") {
    const focusState = useTerminalFocusStore.getState();
    if (
      owner === "application" &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      (focusState.isAppFullscreen || focusState.fullscreenTerminalId !== null)
    ) {
      return true;
    }
  }

  return false;
}

export function shouldTerminalHandleKeyboardEvent(
  event: KeyboardEvent
): boolean {
  return getKeyboardOwner(event) !== "overlay" && !isApplicationShortcut(event);
}

/**
 * Handles an application-level shortcut during the capture phase.
 * Prevents event bubbling and terminal interception.
 * Returns true if the event was handled as an application shortcut.
 */
export function handleApplicationShortcut(
  event: KeyboardEvent,
  options?: { navigate?: (path: string) => void }
): boolean {
  if (event.defaultPrevented) {
    return false;
  }
  if (
    getKeyboardOwner(event) === "overlay" &&
    !isOverlayToggleShortcut(event)
  ) {
    return dismissKeyboardOverlay(event);
  }
  if (!isApplicationShortcut(event)) {
    // Handle GS sequence in global context (when no input/textarea/monaco/xterm is focused)
    const target =
      typeof Element !== "undefined" && event.target instanceof Element
        ? (event.target as HTMLElement)
        : null;
    const isFormOrTerminal =
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        target.closest?.(".monaco-editor") ||
        target.closest?.(".xterm"));

    if (
      !isFormOrTerminal &&
      useTerminalFocusStore.getState().focusedTerminalId === null &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const now = Date.now();
      if (event.key === "g" || event.key === "G" || event.code === "KeyG") {
        lastGKeyPressTime = now;
      } else if (
        (event.key === "s" || event.key === "S" || event.code === "KeyS") &&
        now - lastGKeyPressTime <= G_KEY_SEQUENCE_WINDOW_MS
      ) {
        lastGKeyPressTime = 0;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        options?.navigate?.("/settings");
        return true;
      }
    }

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

  // 3. Open Settings: Ctrl+, / Cmd+,
  if (isMod && (event.key === "," || event.code === "Comma")) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const panelStore = usePanelStore.getState();
    if (panelStore.isSettingsOpen) {
      panelStore.closeSettings();
    } else {
      panelStore.openSettings("account");
    }
    return true;
  }

  // 6. New Workspace: Ctrl+N / Cmd+N
  if (
    isMod &&
    (event.key === "n" || event.key === "N" || event.code === "KeyN")
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (!useTutorialStore.getState().isCreateWorkspaceDialogOpen) {
      useTutorialStore.getState().setCreateWorkspaceDialogOpen(true);
    }
    return true;
  }

  // 7. Terminal switching: Ctrl+1..8 / Cmd+1..8
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

  // Shift+Escape releases keyboard focus without sending a byte to the PTY.
  if (isReleaseTerminalFocusShortcut(event)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    useTerminalFocusStore.getState().releaseTerminalFocus();
    return true;
  }

  // Plain Escape outside a terminal retains the existing fullscreen behavior.
  if (event.key === "Escape" || event.code === "Escape") {
    const focusStore = useTerminalFocusStore.getState();
    if (getKeyboardOwner(event) === "application") {
      // Priority 2: Single-pane terminal fullscreen active?
      if (focusStore.fullscreenTerminalId !== null) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        focusStore.setFullscreenTerminalId(null);
        return true;
      }

      // Priority 3: Application fullscreen active?
      if (focusStore.isAppFullscreen) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        focusStore.toggleAppFullscreen().catch(() => {
          // Handled inside manager
        });
        return true;
      }
    }
  }

  // 6. Context-Sensitive Fullscreen: F11
  // IF a terminal is focused -> F11 toggles terminal pane fullscreen
  // ELSE -> F11 toggles application fullscreen
  if (event.key === "F11" || event.code === "F11") {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const focusStore = useTerminalFocusStore.getState();
    if (focusStore.focusedTerminalId === null) {
      // No terminal focused: toggle application fullscreen
      if (focusStore.fullscreenTerminalId !== null) {
        focusStore.setFullscreenTerminalId(null);
      }
      focusStore.toggleAppFullscreen().catch(() => {
        // Handled inside manager
      });
    } else {
      // Terminal focused: toggle terminal pane fullscreen
      focusStore.toggleTerminalFullscreen(focusStore.focusedTerminalId);
    }
    return true;
  }

  return false;
}
