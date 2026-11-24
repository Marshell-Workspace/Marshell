import { useCommandPaletteStore } from "@workspace/core/stores/command-palette-store";
import { useHotkeysDialogStore } from "@workspace/core/stores/hotkeys-store";
import { usePanelStore } from "@workspace/core/stores/panel-store";
import { useTerminalFocusStore } from "@workspace/core/stores/terminal-focus-store";

const overlayDismissers = new Map<symbol, () => void>();
const OPEN_OVERLAY_SELECTOR = [
  "[role='dialog'][data-state='open']",
  "[role='alertdialog'][data-state='open']",
  "[role='menu'][data-state='open']",
  "[data-slot='sheet-content'][data-state='open']",
  "[data-slot='drawer-content'][data-state='open']",
  "[data-slot='popover-content'][data-state='open']",
].join(",");

function hasManagedOverlay(): boolean {
  return (
    useCommandPaletteStore.getState().isOpen ||
    useHotkeysDialogStore.getState().isOpen ||
    usePanelStore.getState().isSettingsOpen ||
    (typeof document !== "undefined" &&
      document.querySelector(OPEN_OVERLAY_SELECTOR) !== null)
  );
}

export function hasActiveKeyboardOverlay(): boolean {
  return hasManagedOverlay() || overlayDismissers.size > 0;
}

/** Register non-Radix overlays with the same priority as dialogs. */
export function registerKeyboardOverlay(onEscape: () => void): () => void {
  const token = Symbol("keyboard-overlay");
  overlayDismissers.set(token, onEscape);
  return () => {
    overlayDismissers.delete(token);
  };
}

/** Radix owns its dismissal; custom overlays dismiss only the top layer. */
export function dismissKeyboardOverlay(event: KeyboardEvent): boolean {
  if (hasManagedOverlay() || event.key !== "Escape") {
    return false;
  }
  const dismiss = [...overlayDismissers.values()].at(-1);
  if (!dismiss) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  if (!event.repeat) {
    dismiss();
  }
  return true;
}

export function getKeyboardOwner(
  event?: KeyboardEvent
): "overlay" | "terminal" | "application" {
  if (hasActiveKeyboardOverlay()) {
    return "overlay";
  }
  if (typeof document !== "undefined") {
    const target = event?.target ?? document.activeElement;
    return target instanceof Element && target.closest(".xterm")
      ? "terminal"
      : "application";
  }
  return useTerminalFocusStore.getState().focusedTerminalId
    ? "terminal"
    : "application";
}

export function isReleaseTerminalFocusShortcut(event: KeyboardEvent): boolean {
  return (
    event.key === "Escape" &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    getKeyboardOwner(event) === "terminal"
  );
}
