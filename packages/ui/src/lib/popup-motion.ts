"use client";

import { runGenieAnimation as animateGenie } from "@workspace/ui/lib/genie-motion";
import type * as React from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// Shared popup entrance/exit motion. Workspace Genie and jelly drag use dedicated modules.

export interface TriggerRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface TriggerSnapshot {
  element: HTMLElement | null;
  rect: TriggerRect;
  timestamp: number;
}

export interface DragOffset {
  x: number;
  y: number;
}

const TRIGGER_SELECTOR = [
  "button",
  '[role="button"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="tab"]',
  "a[href]",
  "summary",
  "[data-slot*='trigger']",
  "[data-popup-trigger]",
].join(", ");

const IGNORED_TRIGGER_SELECTOR = [
  "[data-slot='dialog-overlay']",
  "[data-slot='dialog-overlay-large']",
  "[data-slot='sheet-overlay']",
].join(", ");

let latestTriggerSnapshot: TriggerSnapshot | null = null;
let globalListenerAttached = false;

function isReasonableTriggerRect(rect: DOMRect | TriggerRect): boolean {
  if (typeof window === "undefined") {
    return rect.width > 0 && rect.height > 0;
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return (
    rect.width > 2 &&
    rect.height > 2 &&
    rect.width < vw * 0.95 &&
    rect.height < vh * 0.95
  );
}

function extractTriggerRect(el: HTMLElement | null): TriggerRect | null {
  if (!el || typeof window === "undefined") {
    return null;
  }
  const rect = el.getBoundingClientRect();
  if (!isReasonableTriggerRect(rect)) {
    return null;
  }
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function createTriggerSnapshot(el: HTMLElement | null): TriggerSnapshot | null {
  const rect = extractTriggerRect(el);
  if (!rect) {
    return null;
  }
  return {
    element: el,
    rect,
    timestamp: Date.now(),
  };
}

export function recordTriggerElement(el: HTMLElement | null): void {
  const snap = createTriggerSnapshot(el);
  if (snap) {
    latestTriggerSnapshot = snap;
  }
}

/** Context menus originate at the right-click/long-press location. */
export function recordPopupPoint(x: number, y: number): void {
  latestTriggerSnapshot = {
    element: null,
    rect: { left: x - 2, top: y - 2, width: 4, height: 4 },
    timestamp: Date.now(),
  };
}

function handleGlobalPointerOrClick(event: Event): void {
  const rawTarget = event.target;
  if (!(rawTarget instanceof Element)) {
    return;
  }
  if (rawTarget.closest(IGNORED_TRIGGER_SELECTOR)) {
    return;
  }

  const matched =
    rawTarget.closest<HTMLElement>(TRIGGER_SELECTOR) ??
    rawTarget.closest<HTMLElement>("[tabindex]");
  if (!matched) {
    return;
  }
  if (matched.closest(IGNORED_TRIGGER_SELECTOR)) {
    return;
  }

  recordTriggerElement(matched);
}

export function ensureGlobalTriggerListener(): void {
  if (typeof window === "undefined" || globalListenerAttached) {
    return;
  }
  globalListenerAttached = true;
  window.addEventListener("pointerdown", handleGlobalPointerOrClick, {
    capture: true,
    passive: true,
  });
  window.addEventListener("click", handleGlobalPointerOrClick, {
    capture: true,
    passive: true,
  });
}

if (typeof window !== "undefined") {
  ensureGlobalTriggerListener();
}

export function getLatestTriggerSnapshot(): TriggerSnapshot | null {
  ensureGlobalTriggerListener();
  if (latestTriggerSnapshot) {
    return latestTriggerSnapshot;
  }

  if (
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== document.body
  ) {
    const activeSnap = createTriggerSnapshot(document.activeElement);
    if (activeSnap) {
      return activeSnap;
    }
  }

  return null;
}

export function resolveTriggerRect(
  snapshot: TriggerSnapshot | null,
  explicitTrigger?: HTMLElement | null,
  registeredTrigger?: HTMLElement | null,
  lockedOriginRect?: TriggerRect | null
): TriggerRect {
  // 1. Explicit trigger element passed as prop
  if (explicitTrigger?.isConnected) {
    const liveExplicit = extractTriggerRect(explicitTrigger);
    if (liveExplicit) {
      return liveExplicit;
    }
  }

  // 2. Trigger registered via context
  if (registeredTrigger?.isConnected) {
    const liveRegistered = extractTriggerRect(registeredTrigger);
    if (liveRegistered) {
      return liveRegistered;
    }
  }

  // 3. Locked origin from open session (for symmetrical close)
  if (lockedOriginRect && isReasonableTriggerRect(lockedOriginRect)) {
    return lockedOriginRect;
  }

  // 4. Trigger captured from pointerdown/click snapshot
  if (snapshot?.element?.isConnected) {
    const liveRect = extractTriggerRect(snapshot.element);
    if (liveRect) {
      return liveRect;
    }
  }

  if (snapshot?.rect && isReasonableTriggerRect(snapshot.rect)) {
    return snapshot.rect;
  }

  if (latestTriggerSnapshot?.element?.isConnected) {
    const liveLatest = extractTriggerRect(latestTriggerSnapshot.element);
    if (liveLatest) {
      return liveLatest;
    }
  }

  if (
    latestTriggerSnapshot?.rect &&
    isReasonableTriggerRect(latestTriggerSnapshot.rect)
  ) {
    return latestTriggerSnapshot.rect;
  }

  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;

  return {
    left: vw * 0.5 - 24,
    top: vh * 0.88,
    width: 48,
    height: 32,
  };
}

export interface PopupControllerState {
  completeClose: () => void;
  isClosing: boolean;
  isRendered: boolean;
  open: boolean;
  recordTrigger: (el: HTMLElement | null) => void;
  registerTriggerElement: (el: HTMLElement | null) => void;
  triggerElementRef: React.RefObject<HTMLElement | null>;
  triggerSnapshotRef: React.RefObject<TriggerSnapshot | null>;
}

export function usePopupController(open: boolean): PopupControllerState {
  const [prevOpen, setPrevOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  const triggerSnapshotRef = useRef<TriggerSnapshot | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const wasOpenForTriggerRef = useRef(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    setClosing(!open);
  }

  if (open && !wasOpenForTriggerRef.current) {
    wasOpenForTriggerRef.current = true;
    const latest = getLatestTriggerSnapshot();
    if (latest) {
      triggerSnapshotRef.current = latest;
    } else if (triggerElementRef.current) {
      const fallbackSnap = createTriggerSnapshot(triggerElementRef.current);
      if (fallbackSnap) {
        triggerSnapshotRef.current = fallbackSnap;
      }
    }
  } else if (!open && wasOpenForTriggerRef.current) {
    wasOpenForTriggerRef.current = false;
  }

  useEffect(() => {
    ensureGlobalTriggerListener();
  }, []);

  const recordTrigger = useCallback((el: HTMLElement | null) => {
    if (el) {
      triggerElementRef.current = el;
    }
    recordTriggerElement(el);
    const snap = createTriggerSnapshot(el);
    if (snap) {
      triggerSnapshotRef.current = snap;
    }
  }, []);

  const registerTriggerElement = useCallback((el: HTMLElement | null) => {
    if (el) {
      triggerElementRef.current = el;
    }
  }, []);

  const completeClose = useCallback(() => {
    setClosing(false);
  }, []);

  useEffect(() => {
    if (closing) {
      // Safety guarantee: ensure closing state and modal lock always resolve even if animations are interrupted
      const timer = setTimeout(() => {
        setClosing(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [closing]);

  const isClosing = !open && closing;
  const isRendered = open || isClosing;

  return {
    open,
    isRendered,
    isClosing,
    triggerSnapshotRef,
    triggerElementRef,
    recordTrigger,
    registerTriggerElement,
    completeClose,
  };
}

export interface UseGeniePopupAnimationOptions {
  completeClose: () => void;
  contentRef: React.RefObject<HTMLElement | null>;
  dragOffsetRef?: React.RefObject<DragOffset>;
  explicitTriggerRef?: React.RefObject<HTMLElement | null>;
  isClosing: boolean;
  isRendered: boolean;
  kind?: "dialog" | "popover" | "sheet";
  onAfterClose?: () => void;
  onBeforeClose?: () => void;
  open: boolean;
  overlayRef?: React.RefObject<HTMLElement | null>;
  registeredTriggerRef?: React.RefObject<HTMLElement | null>;
  triggerSnapshotRef: React.RefObject<TriggerSnapshot | null>;
}

export function useGeniePopupAnimation({
  open,
  isRendered,
  isClosing,
  contentRef,
  overlayRef,
  triggerSnapshotRef,
  registeredTriggerRef,
  explicitTriggerRef,
  kind = "dialog",
  completeClose,
  onBeforeClose,
  onAfterClose,
}: UseGeniePopupAnimationOptions): void {
  const origin = useRef<TriggerRect | null>(null);
  const callbacks = useRef({ completeClose, onBeforeClose, onAfterClose });
  callbacks.current = { completeClose, onBeforeClose, onAfterClose };
  useLayoutEffect(() => {
    if (!isRendered) {
      origin.current = null;
      return;
    }
    let frame = 0;
    let cancel: (() => void) | undefined;
    let attempts = 0;
    const start = () => {
      const surface = contentRef.current;
      if (!surface) {
        if (attempts++ < 20) {
          frame = requestAnimationFrame(start);
        }
        return;
      }
      const rect = surface.getBoundingClientRect();
      const positioner = surface.closest<HTMLElement>(
        "[data-radix-popper-content-wrapper]"
      );
      // Floating UI positions portalled menus after their first layout.
      if (
        (positioner?.style.transform.includes("-200%") ||
          rect.top < -1000 ||
          rect.width === 0 ||
          rect.height === 0) &&
        attempts++ < 20
      ) {
        frame = requestAnimationFrame(start);
        return;
      }
      if (isClosing) {
        callbacks.current.onBeforeClose?.();
      }
      origin.current = resolveTriggerRect(
        triggerSnapshotRef.current,
        explicitTriggerRef?.current,
        registeredTriggerRef?.current,
        origin.current
      );
      cancel = animateGenie({
        surfaceEl: surface,
        overlayEl: overlayRef?.current,
        mode: isClosing ? "close" : "open",
        originRect: origin.current,
        restingBounds: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
        },
        onComplete: () => {
          if (isClosing) {
            callbacks.current.completeClose();
            callbacks.current.onAfterClose?.();
          }
        },
      });
    };
    // Existing surfaces (especially on close) are ready immediately. Only wait
    // for a frame when a portal or its Floating UI position is not ready yet.
    start();
    return () => {
      cancelAnimationFrame(frame);
      cancel?.();
    };
  }, [
    open,
    isRendered,
    isClosing,
    contentRef,
    overlayRef,
    triggerSnapshotRef,
    registeredTriggerRef,
    explicitTriggerRef,
    kind,
  ]);
}
