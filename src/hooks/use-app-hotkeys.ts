"use client";

import { useHotkeys } from "react-hotkeys-hook";
import { hotkeys } from "@/config/hotkeys";
import { useHotkeysDialogStore } from "@/stores/hotkeys-store";

interface UseAppHotkeysOptions {
  navigate: (path: string) => void;
}

export function useAppHotkeys({ navigate }: UseAppHotkeysOptions) {
  const toggleHotkeysDialog = useHotkeysDialogStore((s) => s.toggle);

  const getKeys = (id: string) => hotkeys.find((h) => h.id === id)?.keys || "";

  // Go to Settings
  useHotkeys(
    getKeys("go-settings"),
    (e: KeyboardEvent) => {
      e.preventDefault();
      navigate("/settings");
    },
    { enableOnFormTags: false }
  );

  // Show Keyboard Shortcuts
  useHotkeys(
    getKeys("show-hotkeys"),
    (e: KeyboardEvent) => {
      e.preventDefault();
      toggleHotkeysDialog();
    },
    { enableOnFormTags: false, useKey: true }
  );
}
