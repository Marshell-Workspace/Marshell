"use client";

import { hotkeys } from "@workspace/core/config/hotkeys";
import { getKeyboardOwner } from "@workspace/core/lib/keyboard-ownership";
import { useHotkeysDialogStore } from "@workspace/core/stores/hotkeys-store";
import { usePanelStore } from "@workspace/core/stores/panel-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";

interface UseAppHotkeysOptions {
  navigate: (path: string) => void;
}

const DIGIT_KEY_REGEX = /^Digit([1-9])$/;
const MAC_REGEX = /Mac|iPod|iPhone|iPad/i;

export function useAppHotkeys({ navigate }: UseAppHotkeysOptions) {
  const toggleHotkeysDialog = useHotkeysDialogStore((s) => s.toggle);

  const getKeys = (id: string) => hotkeys.find((h) => h.id === id)?.keys || "";

  // Go to Settings (g>s and mod+, / Ctrl+,)
  useHotkeys(
    [getKeys("go-settings"), "mod+,"],
    (e: KeyboardEvent) => {
      if (getKeyboardOwner(e) !== "application") {
        return;
      }
      e.preventDefault();
      usePanelStore.getState().openSettings("account");
    },
    { enableOnFormTags: false }
  );

  // Show Keyboard Shortcuts
  useHotkeys(
    getKeys("show-hotkeys"),
    (e: KeyboardEvent) => {
      if (getKeyboardOwner(e) !== "application") {
        return;
      }
      e.preventDefault();
      toggleHotkeysDialog();
    },
    { enableOnFormTags: false, useKey: true }
  );

  // Workspace switching: Ctrl+Shift+1..9 (Win/Linux) or Cmd+Shift+1..9 (Mac)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (getKeyboardOwner(e) !== "application" || e.defaultPrevented) {
        return;
      }
      const isMac =
        typeof navigator !== "undefined" &&
        MAC_REGEX.test(navigator.platform || navigator.userAgent);
      const isModifier = isMac
        ? e.metaKey && !e.ctrlKey
        : e.ctrlKey && !e.metaKey;

      if (!(isModifier && e.shiftKey) || e.altKey) {
        return;
      }

      const match = e.code.match(DIGIT_KEY_REGEX);
      if (!match?.[1]) {
        return;
      }

      // Input / editor / terminal focus guard: do not interfere with typing
      const target =
        typeof Element !== "undefined" && e.target instanceof Element
          ? (e.target as HTMLElement)
          : null;
      if (target) {
        const tagName = target.tagName;
        if (
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          tagName === "SELECT" ||
          target.isContentEditable ||
          target.closest?.(".monaco-editor") ||
          target.closest?.(".xterm")
        ) {
          return;
        }
      }

      const digit = Number.parseInt(match[1], 10);
      const targetIndex = digit - 1;

      const { workspaces, setActiveWorkspace } = useWorkspaceStore.getState();
      if (targetIndex >= 0 && targetIndex < workspaces.length) {
        const targetWs = workspaces[targetIndex];
        if (targetWs) {
          e.preventDefault();
          e.stopPropagation();
          setActiveWorkspace(targetWs.id);
          navigate("/workspace");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);
}
