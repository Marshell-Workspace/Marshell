"use client";

import { registerKeyboardOverlay } from "@workspace/core/lib/keyboard-ownership";
import { useEffect, useEffectEvent } from "react";

export function useKeyboardOverlay(isOpen: boolean, onEscape: () => void) {
  const dismiss = useEffectEvent(onEscape);
  useEffect(() => {
    if (isOpen) {
      return registerKeyboardOverlay(() => dismiss());
    }
  }, [isOpen]);
}
