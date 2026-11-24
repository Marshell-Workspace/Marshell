"use client";

import {
  type PopupControllerState,
  useGeniePopupAnimation,
  usePopupController,
} from "@workspace/ui/lib/popup-motion";
import type { Ref } from "react";
import { useCallback, useRef, useState } from "react";

export function useControlledPopup(
  open: boolean | undefined,
  defaultOpen: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined
) {
  const [localOpen, setLocalOpen] = useState(defaultOpen ?? false);
  const controller = usePopupController(open ?? localOpen);
  const change = useCallback(
    (next: boolean) => {
      if (open === undefined) {
        setLocalOpen(next);
      }
      onOpenChange?.(next);
    },
    [open, onOpenChange]
  );
  return { controller, change };
}

/** Shared content wiring for selectors, tooltips, drawers and nested menus. */
export function usePopupSurface(
  controller: PopupControllerState | null,
  externalRef?: Ref<HTMLDivElement>,
  kind: "popover" | "sheet" = "popover"
) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const fallback = useRef(null);
  const complete = useCallback(() => undefined, []);
  useGeniePopupAnimation({
    contentRef,
    overlayRef,
    open: controller?.open ?? true,
    isRendered: controller?.isRendered ?? true,
    isClosing: controller?.isClosing ?? false,
    triggerSnapshotRef: controller?.triggerSnapshotRef ?? fallback,
    registeredTriggerRef: controller?.triggerElementRef,
    completeClose: controller?.completeClose ?? complete,
    kind,
  });
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof externalRef === "function") {
        externalRef(node);
      } else if (externalRef) {
        externalRef.current = node;
      }
    },
    [externalRef]
  );
  return {
    ref,
    overlayRef,
    rendered: controller?.isRendered ?? true,
    closing: controller?.isClosing ?? false,
  };
}
