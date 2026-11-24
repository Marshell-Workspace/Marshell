"use client";

import "./tour/tour.css";

import { CompletionScene } from "@workspace/core/components/common/tour/completion-scene";
import {
  ResumeChip,
  SkipDialog,
} from "@workspace/core/components/common/tour/resume-chip";
import { Spotlight } from "@workspace/core/components/common/tour/spotlight";
import { TooltipCard } from "@workspace/core/components/common/tour/tooltip-card";
import { WelcomeScene } from "@workspace/core/components/common/tour/welcome-scene";
import { classifyIntent } from "@workspace/core/lib/tour-intent";
import type {
  PlacementRect,
  PlacementResult,
  PlacementSide,
} from "@workspace/core/lib/tour-placement";
import { computeCardPlacement } from "@workspace/core/lib/tour-placement";
import { useAuthStore } from "@workspace/core/stores/auth-store";
import { useLayoutStore } from "@workspace/core/stores/layout-store";
import { usePanelStore } from "@workspace/core/stores/panel-store";
import { usePerformanceStore } from "@workspace/core/stores/performance-store";
import {
  TOUR_REGISTRY,
  type TourStep,
  useTutorialStore,
} from "@workspace/core/stores/tutorial-store";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { playTourStartSound } from "./tour/sound";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Rect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CUTOUT_PAD = 6; // px padding around anchor
const CARD_WIDTHS: [number, number] = [320, 320];
const CARD_HEIGHT_ESTIMATE = 190; // updated by ResizeObserver
const PLACEMENT_MARGIN = 24;
const PLACEMENT_GAP = 16;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function logTourEvent(name: string, payload: Record<string, unknown> = {}) {
  try {
    const raw = localStorage.getItem("tour.events");
    const events: Array<{
      event: string;
      payload: Record<string, unknown>;
      timestamp: number;
    }> = raw ? JSON.parse(raw) : [];
    events.push({ event: name, payload, timestamp: Date.now() });
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }
    localStorage.setItem("tour.events", JSON.stringify(events));
  } catch {
    // ignore
  }
}

/**
 * Get the border-radius of an element, clamped to [6, 28].
 */
function getElementRadius(el: HTMLElement): number {
  try {
    const raw = window.getComputedStyle(el).borderRadius;
    const px = Number.parseFloat(raw);
    if (!Number.isNaN(px)) {
      return Math.max(6, Math.min(28, px + CUTOUT_PAD));
    }
  } catch {
    // ignore
  }
  return 10;
}

/**
 * Checks if an element is currently within the visible region of the viewport
 * and all of its scrollable ancestor containers.
 */
function isElementInView(el: HTMLElement): boolean {
  if (!el.isConnected) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  const winW = typeof window === "undefined" ? 1280 : window.innerWidth;
  const winH = typeof window === "undefined" ? 720 : window.innerHeight;

  if (
    rect.bottom <= 0 ||
    rect.top >= winH ||
    rect.right <= 0 ||
    rect.left >= winW
  ) {
    return false;
  }

  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowX === "auto" ||
      overflowX === "scroll"
    ) {
      const parentRect = parent.getBoundingClientRect();
      if (
        rect.top < parentRect.top ||
        rect.bottom > parentRect.bottom ||
        rect.left < parentRect.left ||
        rect.right > parentRect.right
      ) {
        return false;
      }
    }
    parent = parent.parentElement;
  }
  return true;
}

/**
 * Map performance tier for tour FX.
 * "performance" (legacy: turbo/full) = full
 * "balanced" = lite
 * "eco" = minimal
 */
function mapTourTier(tier: string): "performance" | "balanced" | "eco" {
  if (tier === "performance") {
    return "performance";
  }
  if (tier === "eco") {
    return "eco";
  }
  return "balanced";
}

// ─── Tour accent per tour ID ──────────────────────────────────────────────────

function getTourAccent(tourId: string | null): string {
  if (tourId === "settings") {
    return "#0d9488";
  }
  return "var(--primary, #2563eb)";
}

// ─── Surface bounds helper ───────────────────────────────────────────────────

function getSurfaceBounds(requires: string | undefined): Rect | null {
  if (!requires || typeof document === "undefined") {
    return null;
  }

  let el: HTMLElement | null = null;

  if (requires === "create-workspace-dialog") {
    el =
      document.querySelector<HTMLElement>("[data-genie-modal-content]") ??
      document.querySelector<HTMLElement>("[data-slot='dialog-content']") ??
      document.querySelector<HTMLElement>("[role='dialog']");
  } else if (requires === "settings-panel") {
    el =
      document
        .querySelector<HTMLElement>("[data-tour='settings-nav']")
        ?.closest("[role='dialog']") ??
      document.querySelector<HTMLElement>("[data-slot='dialog-content']");
  }

  if (el?.isConnected) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
      };
    }
  }
  return null;
}

// ─── Popovers & portaled layers helpers ────────────────────────────────────────

function getOpenPopovers(): HTMLElement[] {
  if (typeof document === "undefined") {
    return [];
  }
  const selectors = [
    "[data-radix-popper-content-wrapper]",
    '[role="menu"]',
    '[role="listbox"]',
    '[data-slot="dropdown-menu-content"]',
    '[data-slot="select-content"]',
    '[data-slot="popover-content"]',
    "[data-radix-select-content]",
    "[data-radix-dropdown-menu-content]",
    "[data-radix-popover-content]",
  ];
  const elements = document.querySelectorAll<HTMLElement>(selectors.join(", "));
  const result: HTMLElement[] = [];
  for (const el of elements) {
    if (!el.isConnected) {
      continue;
    }
    if (el.closest('[data-tour-element="tooltip-card"]')) {
      continue;
    }
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (
      r.width > 0 &&
      r.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number.parseFloat(style.opacity || "1") > 0.05
    ) {
      result.push(el);
    }
  }
  return result;
}

function getOpenPopoverRects(): Rect[] {
  const popovers = getOpenPopovers();
  return popovers.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      right: r.right,
      bottom: r.bottom,
    };
  });
}

function closeOpenPopoversWithSyntheticEscape() {
  if (typeof document === "undefined") {
    return;
  }
  const popovers = getOpenPopovers();
  if (popovers.length > 0) {
    const escEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(escEvent, "__tourSynthetic", {
      value: true,
      enumerable: false,
    });
    document.dispatchEvent(escEvent);
  }
}

// ─── Anchor resolution helper ─────────────────────────────────────────────────

function findAnchorElement(
  anchor: string | string[] | null
): HTMLElement | null {
  if (!anchor || typeof document === "undefined") {
    return null;
  }
  const candidates = Array.isArray(anchor) ? anchor : [anchor];
  for (const name of candidates) {
    const elements = document.querySelectorAll<HTMLElement>(
      `[data-tour="${name}"]`
    );
    for (const el of elements) {
      if (el?.isConnected) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        ) {
          return el;
        }
      }
    }
  }
  for (const name of candidates) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
    if (el?.isConnected) {
      return el;
    }
  }
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TutorialOverlay() {
  // ── Store subscriptions ───────────────────────────────────────────────────
  const machineState = useTutorialStore((s) => s.machineState);
  const activeTour = useTutorialStore((s) => s.activeTour);
  const currentStepIndex = useTutorialStore((s) => s.currentStepIndex);
  const skipConfirmOpen = useTutorialStore((s) => s.skipConfirmOpen);
  const childSurface = useTutorialStore((s) => s.childSurface);
  const interruptedReason = useTutorialStore((s) => s.interruptedReason);
  const isCreateWorkspaceDialogOpen = useTutorialStore(
    (s) => s.isCreateWorkspaceDialogOpen
  );
  const isReplay = useTutorialStore((s) => s.isReplay);
  const stepEpoch = useTutorialStore((s) => s.stepEpoch);
  const launchedFromCompletion = useTutorialStore(
    (s) => s.launchedFromCompletion
  );
  const launchTour = useTutorialStore((s) => s.launchTour);

  const nextStep = useTutorialStore((s) => s.nextStep);
  const prevStep = useTutorialStore((s) => s.prevStep);
  const resumeTour = useTutorialStore((s) => s.resumeTour);
  const pauseTour = useTutorialStore((s) => s.pauseTour);
  const skipTour = useTutorialStore((s) => s.skipTour);
  const completeTour = useTutorialStore((s) => s.completeTour);
  const setSkipConfirmOpen = useTutorialStore((s) => s.setSkipConfirmOpen);
  const fireAction = useTutorialStore((s) => s.fireAction);
  const canAdvance = useTutorialStore((s) => s.canAdvance);

  const isSettingsOpen = usePanelStore((s) => s.isSettingsOpen);
  const session = useAuthStore((s) => s.session);
  const userId = session?.user_id || session?.email || "guest_default";

  const perfTier = usePerformanceStore((s) => s.tier);
  const tier = mapTourTier(perfTier);

  const systemReducedMotion = useReducedMotion() ?? false;
  const reducedMotion = systemReducedMotion || tier === "eco";

  const activeSteps = useTutorialStore((s) => s.activeSteps);

  // ── Derived state ─────────────────────────────────────────────────────────
  const steps =
    activeSteps && activeSteps.length > 0
      ? activeSteps
      : activeTour
        ? TOUR_REGISTRY[activeTour]
        : [];
  const currentStep: TourStep | undefined = steps[currentStepIndex];
  const tourAccent = getTourAccent(activeTour);
  const isGoalSatisfied =
    currentStep?.type === "action"
      ? Boolean(currentStep.isSatisfied?.())
      : false;
  const isLast = currentStepIndex === steps.length - 1;

  // ── Local state ───────────────────────────────────────────────────────────
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [isResolvingAnchor, setIsResolvingAnchor] = useState(false);
  const [isCrossSurfaceFading, setIsCrossSurfaceFading] = useState(false);
  const [isScrollingToAnchor, setIsScrollingToAnchor] = useState(false);
  const [shakeActionBadge, setShakeActionBadge] = useState(false);
  const [measuredCardHeight, setMeasuredCardHeight] =
    useState(CARD_HEIGHT_ESTIMATE);
  const [hasDomChildSurface, setHasDomChildSurface] = useState(false);
  const [blockedNextClicks, setBlockedNextClicks] = useState(0);
  const [placement, setPlacement] = useState<PlacementResult | null>(null);
  const [openPopoverRects, setOpenPopoverRects] = useState<Rect[]>([]);

  const _cardRef = useRef<HTMLDivElement>(null);
  const prevSurfaceRef = useRef<string | null>(null);
  const previousPlacementRef = useRef<{
    center: { x: number; y: number };
    side: PlacementSide;
    surface: string | null;
  } | null>(null);
  const stepStartTimeRef = useRef<number>(Date.now());
  const outsideClicksRef = useRef<number>(0);
  const stableRectCancelRef = useRef<(() => void) | null>(null);
  const trackingLoopRafRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__overlayMounted = true;
      (window as unknown as Record<string, unknown>).__tutorialStore =
        useTutorialStore;
      (window as unknown as Record<string, unknown>).__panelStore =
        usePanelStore;
      (window as unknown as Record<string, unknown>).__layoutStore =
        useLayoutStore;
    }
    return () => {
      if (typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>).__overlayMounted = false;
      }
    };
  }, []);

  // ── Set html[data-tour-active] during active tour ─────────────────────────
  useEffect(() => {
    const isTourActive =
      machineState === "active" &&
      !skipConfirmOpen &&
      Boolean(activeTour) &&
      currentStep?.id !== "onboarding-welcome" &&
      currentStep?.id !== "onboarding-complete";

    if (typeof document !== "undefined") {
      if (isTourActive) {
        document.documentElement.setAttribute("data-tour-active", "true");
      } else {
        document.documentElement.removeAttribute("data-tour-active");
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.documentElement.removeAttribute("data-tour-active");
      }
    };
  }, [machineState, skipConfirmOpen, activeTour, currentStep?.id]);

  // ── DOM child surface monitor (MutationObserver) ──────────────────────────
  useEffect(() => {
    const checkDomSurface = () => {
      if (typeof document === "undefined") {
        return;
      }
      const surfaceEl = document.querySelector<HTMLElement>(
        "[data-tour-surface]"
      );
      if (!surfaceEl) {
        setHasDomChildSurface((prev) => (prev ? false : prev));
        return;
      }
      const anchorEl = currentStep?.anchor
        ? findAnchorElement(currentStep.anchor)
        : null;
      const isTargetInside = Boolean(anchorEl && surfaceEl.contains(anchorEl));
      const isChildBlocking = !isTargetInside;
      setHasDomChildSurface((prev) =>
        prev === isChildBlocking ? prev : isChildBlocking
      );
    };
    checkDomSurface();
    const observer = new MutationObserver(checkDomSurface);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-tour-surface"],
    });
    return () => observer.disconnect();
  }, [currentStep?.anchor, findAnchorElement]);

  const isChildSurfaceActive = childSurface || hasDomChildSurface;

  // ── Reset intent signals and close previous popovers on step change ────────
  useEffect(() => {
    closeOpenPopoversWithSyntheticEscape();
    stepStartTimeRef.current = Date.now();
    outsideClicksRef.current = 0;
    setBlockedNextClicks(0);
  }, [
    currentStepIndex,
    activeTour,
    currentStep?.id,
    currentStep?.anchor,
    currentStep?.requires,
  ]);

  // ── Track prevStepIndex for directional animations ────────────────────────
  const prevStepRef = useRef(currentStepIndex);
  useEffect(() => {
    prevStepRef.current = currentStepIndex;
  }, [currentStepIndex]);
  const directionPrev = prevStepRef.current;

  // ── Card height measurement ───────────────────────────────────────────────
  useEffect(() => {
    const card = document.querySelector<HTMLElement>(
      '[data-tour-element="tooltip-card"]'
    );
    if (!card) {
      return;
    }
    const updateHeight = () => {
      const rect = card.getBoundingClientRect();
      if (rect.height > 0) {
        setMeasuredCardHeight(Math.round(rect.height));
      }
    };
    updateHeight();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height =
          entry.borderBoxSize?.[0]?.blockSize ??
          card.getBoundingClientRect().height;
        if (height > 0) {
          setMeasuredCardHeight(Math.round(height));
        }
      }
    });
    ro.observe(card);
    return () => ro.disconnect();
  }, [currentStepIndex]);

  // ── Event logging ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (machineState !== "active" || !currentStep || isChildSurfaceActive) {
      return;
    }
    logTourEvent("step_view", {
      stepId: currentStep.id,
      stepIndex: currentStepIndex,
      tour: activeTour,
    });

    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      logTourEvent("user_click", {
        stepId: currentStep.id,
        tag: target?.tagName,
        tourId: target?.getAttribute("data-tour"),
      });
    };
    const handleDocKeyDown = (e: KeyboardEvent) => {
      logTourEvent("user_keydown", { key: e.key, stepId: currentStep.id });
    };

    document.addEventListener("click", handleDocClick, true);
    document.addEventListener("keydown", handleDocKeyDown, true);
    return () => {
      document.removeEventListener("click", handleDocClick, true);
      document.removeEventListener("keydown", handleDocKeyDown, true);
    };
  }, [
    machineState,
    currentStep,
    currentStepIndex,
    activeTour,
    isChildSurfaceActive,
  ]);

  // ── Required panel monitoring (pause if panel closes) ─────────────────────
  useEffect(() => {
    if (
      machineState !== "active" ||
      !currentStep?.requires ||
      isChildSurfaceActive
    ) {
      return;
    }
    if (currentStep.requires === "settings-panel" && !isSettingsOpen) {
      pauseTour();
    } else if (
      currentStep.requires === "create-workspace-dialog" &&
      !isCreateWorkspaceDialogOpen
    ) {
      pauseTour();
    }
  }, [
    machineState,
    currentStep,
    isSettingsOpen,
    isCreateWorkspaceDialogOpen,
    isChildSurfaceActive,
    pauseTour,
  ]);

  // ── Resume when panel reopens ─────────────────────────────────────────────
  useEffect(() => {
    if (machineState !== "paused" || !currentStep?.requires) {
      return;
    }
    if (currentStep.requires === "settings-panel" && isSettingsOpen) {
      resumeTour();
    } else if (
      currentStep.requires === "create-workspace-dialog" &&
      isCreateWorkspaceDialogOpen
    ) {
      resumeTour();
    }
  }, [
    machineState,
    currentStep,
    isSettingsOpen,
    isCreateWorkspaceDialogOpen,
    resumeTour,
  ]);

  // ── waitForStableRect ─────────────────────────────────────────────────────
  const waitForStableRect = useCallback(
    (el: HTMLElement, onStable: (rect: Rect) => void) => {
      let frameCount = 0;
      let lastRect: DOMRect | null = null;
      let rafId: number;
      const startTime = performance.now();

      const check = () => {
        if (!el.isConnected) {
          return;
        }

        // Bug B1: If waiting for AI agents list, ensure it has rows or skeleton rendered (max 2s)
        const isAgentList =
          el.getAttribute("data-tour") === "workspace-ai-agents-list";
        if (isAgentList) {
          const hasContent =
            el.children.length > 0 && el.getBoundingClientRect().height > 20;
          if (!hasContent) {
            if (performance.now() - startTime < 2000) {
              rafId = requestAnimationFrame(check);
              return;
            }
            // Timeout: fallback to column anchor so we never show an empty cutout
            const col = document.querySelector<HTMLElement>(
              '[data-tour="workspace-ai-agents-column"]'
            );
            if (col?.isConnected) {
              const colRect = col.getBoundingClientRect();
              if (colRect.width > 0 && colRect.height > 0) {
                onStable({
                  top: colRect.top,
                  left: colRect.left,
                  width: colRect.width,
                  height: colRect.height,
                  right: colRect.right,
                  bottom: colRect.bottom,
                });
                return;
              }
            }
          }
        }

        const style = window.getComputedStyle(el);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number.parseFloat(style.opacity || "1") < 0.1
        ) {
          if (performance.now() - startTime < 1500) {
            rafId = requestAnimationFrame(check);
          }
          return;
        }
        const currentRect = el.getBoundingClientRect();
        if (currentRect.width <= 0 || currentRect.height <= 0) {
          if (performance.now() - startTime < 1500) {
            rafId = requestAnimationFrame(check);
          }
          return;
        }
        if (
          lastRect &&
          Math.abs(currentRect.top - lastRect.top) < 0.5 &&
          Math.abs(currentRect.left - lastRect.left) < 0.5 &&
          Math.abs(currentRect.width - lastRect.width) < 0.5 &&
          Math.abs(currentRect.height - lastRect.height) < 0.5
        ) {
          frameCount++;
        } else {
          frameCount = 0;
          lastRect = currentRect;
        }
        if (frameCount >= 3 || performance.now() - startTime > 1200) {
          onStable({
            top: currentRect.top,
            left: currentRect.left,
            width: currentRect.width,
            height: currentRect.height,
            right: currentRect.right,
            bottom: currentRect.bottom,
          });
        } else {
          rafId = requestAnimationFrame(check);
        }
      };

      rafId = requestAnimationFrame(check);
      return () => cancelAnimationFrame(rafId);
    },
    []
  );

  // ── measureAnchor ─────────────────────────────────────────────────────────
  const measureAnchor = useCallback(() => {
    if (!currentStep?.anchor || machineState !== "active") {
      setTargetRect((prev) => (prev === null ? prev : null));
      return;
    }
    const el = findAnchorElement(currentStep.anchor);
    if (!el?.isConnected) {
      setTargetRect((prev) => (prev === null ? prev : null));
      return;
    }

    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      setTargetRect((prev) => (prev === null ? prev : null));
      return;
    }

    const r: Rect = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    };

    setTargetRect((prev) => {
      if (
        prev &&
        Math.abs(prev.left - r.left) < 0.5 &&
        Math.abs(prev.top - r.top) < 0.5 &&
        Math.abs(prev.width - r.width) < 0.5 &&
        Math.abs(prev.height - r.height) < 0.5
      ) {
        return prev;
      }
      return r;
    });

    const popovers = getOpenPopoverRects();
    setOpenPopoverRects((prev) => {
      if (prev.length !== popovers.length) {
        return popovers;
      }
      const isDiff = popovers.some((cp, idx) => {
        const pp = prev[idx];
        if (!pp) {
          return true;
        }
        return (
          Math.abs(cp.left - pp.left) > 0.5 ||
          Math.abs(cp.top - pp.top) > 0.5 ||
          Math.abs(cp.width - pp.width) > 0.5 ||
          Math.abs(cp.height - pp.height) > 0.5
        );
      });
      return isDiff ? popovers : prev;
    });
  }, [
    currentStep,
    machineState,
    findAnchorElement,
    isResolvingAnchor,
    pauseTour,
  ]);

  const measureAnchorRef = useRef(measureAnchor);
  measureAnchorRef.current = measureAnchor;

  // ── Tracking loop for clicks, keydowns, and interactions (~700ms) ──────────
  const triggerTrackingLoop = useCallback(() => {
    if (machineState !== "active" || !currentStep?.anchor) {
      return;
    }
    if (trackingLoopRafRef.current !== null) {
      cancelAnimationFrame(trackingLoopRafRef.current);
      trackingLoopRafRef.current = null;
    }

    let frameCount = 0;
    let lastRect: DOMRect | null = null;
    const startTime = performance.now();

    const track = () => {
      const el = findAnchorElement(currentStep.anchor);
      if (!el?.isConnected) {
        measureAnchorRef.current();
        return;
      }
      const currentRect = el.getBoundingClientRect();
      if (
        lastRect &&
        Math.abs(currentRect.top - lastRect.top) < 0.5 &&
        Math.abs(currentRect.left - lastRect.left) < 0.5 &&
        Math.abs(currentRect.width - lastRect.width) < 0.5 &&
        Math.abs(currentRect.height - lastRect.height) < 0.5
      ) {
        frameCount++;
      } else {
        frameCount = 0;
        lastRect = currentRect;
        measureAnchorRef.current();
      }

      if (frameCount >= 3 || performance.now() - startTime > 700) {
        trackingLoopRafRef.current = null;
        measureAnchorRef.current();
      } else {
        trackingLoopRafRef.current = requestAnimationFrame(track);
      }
    };

    trackingLoopRafRef.current = requestAnimationFrame(track);
  }, [machineState, currentStep?.anchor, findAnchorElement]);

  // ── Scroll to anchor helper (fixes Bug 4) ─────────────────────────────────
  const scrollToAnchor = useCallback(() => {
    if (!currentStep?.anchor || typeof document === "undefined") {
      return;
    }
    const el = findAnchorElement(currentStep.anchor);
    if (!el?.isConnected) {
      return;
    }

    setIsScrollingToAnchor(true);

    el.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: reducedMotion ? "auto" : "smooth",
    });

    const cancel = waitForStableRect(el, (r) => {
      setTargetRect(r);
      setIsScrollingToAnchor(false);
    });
    stableRectCancelRef.current = cancel ?? null;
  }, [currentStep, findAnchorElement, reducedMotion, waitForStableRect]);

  // Auto-scroll when anchor is out of view on step change or epoch bump
  useEffect(() => {
    if (machineState !== "active" || !currentStep?.anchor) {
      return;
    }
    const el = findAnchorElement(currentStep.anchor);
    if (el?.isConnected && !isElementInView(el)) {
      scrollToAnchor();
    }
  }, [
    currentStep?.id,
    stepEpoch,
    scrollToAnchor,
    findAnchorElement,
    machineState,
  ]);

  // ── Cross-surface transition: iris-out/in, wait for stableRect (fixes V7) ─
  useEffect(() => {
    if (!currentStep) {
      return;
    }
    const currentSurface = currentStep.requires ?? "main-window";

    if (prevSurfaceRef.current && prevSurfaceRef.current !== currentSurface) {
      // Cross-surface: fade out, then wait for stable rect
      setIsCrossSurfaceFading(true);
      setTargetRect(null);

      // Wait for new anchor to appear, then iris in (no setTimeout)
      const anchorId = currentStep.anchor;
      if (anchorId) {
        let rafId: number;
        const startTime = performance.now();
        const pollForAnchor = () => {
          const el = findAnchorElement(anchorId);
          if (el?.isConnected) {
            const cancel = waitForStableRect(el, (r) => {
              setTargetRect(r);
              setIsCrossSurfaceFading(false);
            });
            stableRectCancelRef.current = cancel ?? null;
            return;
          }
          if (performance.now() - startTime < 2000) {
            rafId = requestAnimationFrame(pollForAnchor);
          } else {
            setIsCrossSurfaceFading(false);
          }
        };
        rafId = requestAnimationFrame(pollForAnchor);
        prevSurfaceRef.current = currentSurface;
        return () => cancelAnimationFrame(rafId);
      }
      setIsCrossSurfaceFading(false);
    }

    prevSurfaceRef.current = currentSurface;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep?.id]);

  // ── Target resolution with MutationObserver + RAF + 3500ms timeout ──────────
  useEffect(() => {
    if (
      machineState !== "active" ||
      !currentStep?.anchor ||
      isChildSurfaceActive
    ) {
      setTargetRect(null);
      setIsResolvingAnchor(false);
      return;
    }

    setIsResolvingAnchor(true);
    setTargetRect(null);

    let isResolved = false;
    let isCancelled = false;
    let resolvedElement: HTMLElement | null = null;
    let observer: MutationObserver | null = null;
    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const handleFastUpdate = () => measureAnchorRef.current();
    const handleInteraction = () => triggerTrackingLoop();

    const cleanup = () => {
      isCancelled = true;
      resolvedElement = null;
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (rafUpdateId !== null) {
        cancelAnimationFrame(rafUpdateId);
        rafUpdateId = null;
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      window.removeEventListener("resize", handleFastUpdate);
      window.removeEventListener("scroll", handleFastUpdate, true);
      document.removeEventListener("transitionend", handleFastUpdate, true);
      document.removeEventListener("animationend", handleFastUpdate, true);
      document.removeEventListener("click", handleInteraction, true);
      document.removeEventListener("keydown", handleInteraction, true);
      if (trackingLoopRafRef.current !== null) {
        cancelAnimationFrame(trackingLoopRafRef.current);
        trackingLoopRafRef.current = null;
      }
    };

    const handleResolvedElement = (el: HTMLElement) => {
      if (isCancelled || isResolved) {
        return;
      }
      isResolved = true;
      resolvedElement = el;

      // Stop the search polling loop & initial timeout
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      try {
        el.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: reducedMotion ? "auto" : "smooth",
        });
      } catch {
        // ignore
      }

      const cancelStable = waitForStableRect(el, (r) => {
        if (!isCancelled) {
          setTargetRect((prev) => {
            if (
              prev &&
              Math.abs(prev.left - r.left) < 0.5 &&
              Math.abs(prev.top - r.top) < 0.5 &&
              Math.abs(prev.width - r.width) < 0.5 &&
              Math.abs(prev.height - r.height) < 0.5
            ) {
              return prev;
            }
            return r;
          });
          setIsResolvingAnchor(false);
        }
      });
      stableRectCancelRef.current = cancelStable ?? null;

      // Observe the target element AND all its ancestors up to body
      resizeObserver = new ResizeObserver(() => {
        if (!isCancelled && el.isConnected) {
          measureAnchorRef.current();
        }
      });
      resizeObserver.observe(el);
      let p = el.parentElement;
      while (p && p !== document.body) {
        resizeObserver.observe(p);
        p = p.parentElement;
      }
    };

    // 1. Immediate check
    const immediateEl = findAnchorElement(currentStep.anchor);
    if (immediateEl?.isConnected) {
      const rect = immediateEl.getBoundingClientRect();
      const style = window.getComputedStyle(immediateEl);
      if (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      ) {
        handleResolvedElement(immediateEl);
      }
    }

    // 2. Poll & observe DOM
    const checkAnchor = () => {
      if (isCancelled || isResolved) {
        return;
      }
      const el = findAnchorElement(currentStep.anchor);
      if (el?.isConnected) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        ) {
          handleResolvedElement(el);
        }
      }
    };

    let rafUpdateId: number | null = null;
    observer = new MutationObserver((mutations) => {
      if (isCancelled) {
        return;
      }
      if (isResolved) {
        if (!resolvedElement) {
          return;
        }
        const isTargetAffected = mutations.some((m) => {
          const target = m.target as HTMLElement | null;
          return Boolean(
            target &&
              !target.closest?.("[data-tour-element]") &&
              (target === resolvedElement ||
                target.contains?.(resolvedElement) ||
                resolvedElement?.contains?.(target))
          );
        });
        if (!isTargetAffected) {
          return;
        }
        if (rafUpdateId === null) {
          rafUpdateId = requestAnimationFrame(() => {
            rafUpdateId = null;
            if (!isCancelled && isResolved) {
              measureAnchorRef.current();
            }
          });
        }
      } else {
        const hasExternalMutation = mutations.some((m) => {
          const target = m.target as HTMLElement | null;
          return !target?.closest?.("[data-tour-element]");
        });
        if (hasExternalMutation) {
          checkAnchor();
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "class",
        "style",
        "hidden",
        "data-tour",
        "data-tour-id",
        "data-slot",
        "data-state",
        "aria-expanded",
      ],
    });

    // Timeout: if anchor cannot be resolved within 2500ms, pause cleanly to show resume chip
    timeoutId = setTimeout(() => {
      if (!(isResolved || isCancelled)) {
        setIsResolvingAnchor(false);
        setTargetRect(null);
        pauseTour();
      }
    }, 2500);

    const loop = () => {
      if (isCancelled || isResolved) {
        return;
      }
      checkAnchor();
      if (!(isCancelled || isResolved)) {
        rafId = requestAnimationFrame(loop);
      }
    };
    rafId = requestAnimationFrame(loop);

    window.addEventListener("resize", handleFastUpdate);
    window.addEventListener("scroll", handleFastUpdate, true);
    document.addEventListener("transitionend", handleFastUpdate, true);
    document.addEventListener("animationend", handleFastUpdate, true);
    document.addEventListener("click", handleInteraction, true);
    document.addEventListener("keydown", handleInteraction, true);

    return () => {
      cleanup();
    };
  }, [
    machineState,
    currentStep?.id,
    currentStep?.anchor,
    isChildSurfaceActive,
    stepEpoch,
    findAnchorElement,
    waitForStableRect,
    reducedMotion,
    isLast,
    completeTour,
    nextStep,
    userId,
    triggerTrackingLoop,
  ]);

  // ── Auto-resume when missing target reappears ─────────────────────────────
  useEffect(() => {
    if (machineState !== "paused" || !currentStep?.anchor) {
      return;
    }
    const checkTargetReappeared = () => {
      const el = findAnchorElement(currentStep.anchor);
      if (el?.isConnected) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        ) {
          resumeTour();
        }
      }
    };

    checkTargetReappeared();
    const mo = new MutationObserver(checkTargetReappeared);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    return () => mo.disconnect();
  }, [machineState, currentStep?.anchor, findAnchorElement, resumeTour]);

  // ── Compute placement whenever targetRect changes ─────────────────────────
  useEffect(() => {
    if (!currentStep) {
      setPlacement(null);
      return;
    }

    const vW = typeof window === "undefined" ? 1280 : window.innerWidth;
    const vH = typeof window === "undefined" ? 720 : window.innerHeight;
    const surfaceBounds = getSurfaceBounds(currentStep.requires);

    if (!targetRect) {
      if (!currentStep.anchor || currentStep.placement === "center") {
        const cardW = CARD_WIDTHS[0];
        const cardH = measuredCardHeight;
        const bounds = surfaceBounds ?? {
          left: 0,
          top: 0,
          width: vW,
          height: vH,
        };
        setPlacement({
          x: Math.round(bounds.left + Math.max(16, (bounds.width - cardW) / 2)),
          y: Math.round(bounds.top + Math.max(16, (bounds.height - cardH) / 2)),
          width: Math.min(cardW, Math.max(300, bounds.width - 32)),
          height: cardH,
          side: "bottom",
          mode: "inside",
          leader: null,
        });
      } else {
        setPlacement(null);
      }
      return;
    }

    const paddedAnchor = {
      left: Math.max(0, targetRect.left - CUTOUT_PAD),
      top: Math.max(0, targetRect.top - CUTOUT_PAD),
      width: targetRect.width + CUTOUT_PAD * 2,
      height: targetRect.height + CUTOUT_PAD * 2,
    };

    // Build keepClear rects
    const hard = [
      { left: 0, top: vH - 72, width: 72, height: 72 }, // dev badge corner (V12)
    ];

    // Open popovers / dropdowns / menus must NEVER be covered by the tour card
    for (const popoverRect of openPopoverRects) {
      hard.push({
        left: Math.max(0, popoverRect.left - 4),
        top: Math.max(0, popoverRect.top - 4),
        width: popoverRect.width + 8,
        height: popoverRect.height + 8,
      });
    }

    // Per-step keepClear from E2
    const stepKeepClear: string[] =
      (currentStep as TourStep & { keepClear?: string[] }).keepClear ?? [];
    for (const id of stepKeepClear) {
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${id}"], [data-tour-focus="${id}"]`
      );
      if (el?.isConnected) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) {
          hard.push({
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
          });
        }
      }
    }

    // Per-step soft (avoid) rects from E2
    const soft: Array<{
      left: number;
      top: number;
      width: number;
      height: number;
    }> = [];
    const stepAvoid: string[] =
      (currentStep as TourStep & { avoid?: string[] }).avoid ?? [];
    for (const id of stepAvoid) {
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${id}"], [data-tour-focus="${id}"]`
      );
      if (el?.isConnected) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) {
          soft.push({
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
          });
        }
      }
    }

    const anchorStr = Array.isArray(currentStep.anchor)
      ? currentStep.anchor[0]
      : currentStep.anchor;

    const currentSurface = (() => {
      if (currentStep.requires === "settings-panel") {
        if (
          anchorStr &&
          (anchorStr.startsWith("settings-nav") ||
            anchorStr === "settings-search-input")
        ) {
          return "settings-nav";
        }
        return "settings-content";
      }
      if (currentStep.requires === "create-workspace-dialog") {
        return "create-workspace-dialog";
      }
      if (
        anchorStr &&
        (anchorStr.includes("sidebar") ||
          anchorStr.includes("create-workspace"))
      ) {
        return "sidebar";
      }
      if (anchorStr?.includes("notifications-btn")) {
        return "header";
      }
      return "global";
    })();

    const previousSide =
      previousPlacementRef.current?.surface === currentSurface
        ? previousPlacementRef.current.side
        : null;
    const previousCardCenter =
      previousPlacementRef.current?.surface === currentSurface
        ? previousPlacementRef.current.center
        : null;

    // H3: find next step target element to avoid covering it
    let nextTargetRect: PlacementRect | null = null;
    const nextStep = steps[currentStepIndex + 1];
    if (nextStep?.anchor) {
      const nextEl = findAnchorElement(nextStep.anchor);
      if (nextEl?.isConnected) {
        const nr = nextEl.getBoundingClientRect();
        if (nr.width > 0 && nr.height > 0) {
          nextTargetRect = {
            left: nr.left,
            top: nr.top,
            width: nr.width,
            height: nr.height,
          };
        }
      }
    }

    // P4: find interactive elements inside surface for least disturbance scoring
    const interactiveRects: PlacementRect[] = [];
    const surfaceRoot = surfaceBounds
      ? (document.querySelector("[data-genie-modal-content]") ??
        document.querySelector("[role='dialog']"))
      : null;
    if (surfaceRoot) {
      const ctrls = surfaceRoot.querySelectorAll<HTMLElement>(
        "button, a, input, select, textarea, [role='button'], [role='tab']"
      );
      let count = 0;
      for (const c of ctrls) {
        if (count++ > 150) {
          break;
        }
        const cr = c.getBoundingClientRect();
        if (cr.width > 0 && cr.height > 0) {
          interactiveRects.push({
            left: cr.left,
            top: cr.top,
            width: cr.width,
            height: cr.height,
          });
        }
      }
    }

    const preferredPlacement = currentStep.placement as PlacementSide;

    const result = computeCardPlacement({
      viewport: { width: vW, height: vH },
      surfaceBounds: surfaceBounds
        ? {
            left: surfaceBounds.left,
            top: surfaceBounds.top,
            width: surfaceBounds.width,
            height: surfaceBounds.height,
          }
        : null,
      anchor: paddedAnchor,
      cardWidths: CARD_WIDTHS,
      cardHeight: measuredCardHeight,
      margin: PLACEMENT_MARGIN,
      gap: PLACEMENT_GAP,
      preferred: preferredPlacement,
      hard,
      soft,
      previousSide,
      previousCardCenter,
      previousSurface: previousPlacementRef.current?.surface ?? null,
      currentSurface,
      nextTargetRect,
      interactiveRects,
    });

    previousPlacementRef.current = {
      side: result.side,
      center: {
        x: result.x + result.width / 2,
        y: result.y + result.height / 2,
      },
      surface: currentSurface,
    };

    setPlacement(result);
  }, [targetRect, currentStep, measuredCardHeight, openPopoverRects]);

  // ── Auto-focus name/dir inputs ─────────────────────────────────────────────
  useEffect(() => {
    if (machineState !== "active" || isChildSurfaceActive) {
      return;
    }
    if (currentStep?.id === "onboarding-ws-name") {
      const t = setTimeout(() => {
        const inputEl = document.querySelector<HTMLInputElement>(
          '[data-tour="workspace-name-input"]'
        );
        if (inputEl) {
          inputEl.focus();
          inputEl.select();
        }
      }, 50);
      return () => clearTimeout(t);
    }
    if (currentStep?.id === "onboarding-ws-dir") {
      const t = setTimeout(() => {
        const inputEl =
          document.querySelector<HTMLInputElement>("#ws-dir") ||
          document.querySelector<HTMLInputElement>(
            '[data-tour="workspace-dir-input"] input'
          );
        if (inputEl) {
          inputEl.focus();
        }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [machineState, currentStep?.id, isChildSurfaceActive]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    if (machineState !== "active" || isChildSurfaceActive) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore synthetic tour events
      if ((e as unknown as { __tourSynthetic?: boolean }).__tourSynthetic) {
        return;
      }

      if (skipConfirmOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setSkipConfirmOpen(false);
        }
        return;
      }
      if (e.key === "Escape") {
        const popovers = getOpenPopovers();
        if (popovers.length > 0) {
          // A popover/menu is open: Escape closes only that popover and NOT open the Skip dialog.
          // Allow event to reach Radix DismissableLayer without triggering SkipDialog.
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setSkipConfirmOpen(true);
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        closeOpenPopoversWithSyntheticEscape();
        const gate = canAdvance(currentStepIndex);
        if (!gate.ok) {
          e.preventDefault();
          setBlockedNextClicks((c) => c + 1);
          setShakeActionBadge(true);
          return;
        }

        if (currentStep?.type === "info") {
          e.preventDefault();
          if (isLast) {
            completeTour(userId);
          } else {
            nextStep();
          }
        } else if (currentStep?.completeWhen) {
          e.preventDefault();
          fireAction(currentStep.completeWhen);
        } else {
          e.preventDefault();
          nextStep();
        }
      } else if (
        e.key === "ArrowLeft" &&
        currentStepIndex > 0 &&
        !(activeTour === "onboarding" && currentStepIndex === 10)
      ) {
        closeOpenPopoversWithSyntheticEscape();
        e.preventDefault();
        prevStep();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    machineState,
    currentStep,
    currentStepIndex,
    isChildSurfaceActive,
    canAdvance,
    nextStep,
    prevStep,
    skipConfirmOpen,
    setSkipConfirmOpen,
    fireAction,
    activeTour,
    isLast,
    completeTour,
    userId,
  ]);

  // ── Focus tooltip on info steps ───────────────────────────────────────────
  useEffect(() => {
    if (
      machineState === "active" &&
      currentStep?.type === "info" &&
      !isChildSurfaceActive &&
      !currentStep?.requires
    ) {
      const el = document.querySelector<HTMLElement>(
        '[data-tour-element="tooltip-card"]'
      );
      el?.focus({ preventScroll: true });
    }
  }, [
    machineState,
    currentStepIndex,
    currentStep?.type,
    currentStep?.requires,
    isChildSurfaceActive,
  ]);

  // ── Next handler ──────────────────────────────────────────────────────────
  const handleNextClick = useCallback(() => {
    if (!currentStep) {
      return;
    }
    closeOpenPopoversWithSyntheticEscape();
    const gate = canAdvance(currentStepIndex);
    if (!gate.ok) {
      setBlockedNextClicks((c) => c + 1);
      setShakeActionBadge(true);
      return;
    }

    if (currentStep.type === "info") {
      if (isLast) {
        completeTour(userId);
      } else {
        nextStep();
      }
    } else if (currentStep.completeWhen) {
      fireAction(currentStep.completeWhen);
    } else {
      nextStep();
    }
  }, [
    currentStep,
    currentStepIndex,
    canAdvance,
    isLast,
    completeTour,
    userId,
    nextStep,
    fireAction,
  ]);

  // ── Intent classification ─────────────────────────────────────────────────
  const intentResult = currentStep
    ? classifyIntent({
        dwellTimeMs: Date.now() - stepStartTimeRef.current,
        outsideClicks: outsideClicksRef.current,
        rapidNavCount: 0,
        idleDurationMs: 0,
        stepType: currentStep.type,
        isActionSatisfied: isGoalSatisfied,
        blockedNextClicks,
      })
    : {
        intent: "focused" as const,
        confidence: 1,
        recommendedNudgeLevel: 1 as const,
        shouldPulseAnchor: false,
        guidanceText: undefined,
      };

  // ── Outside click handler ─────────────────────────────────────────────────
  const handleOutsideClick = useCallback(() => {
    outsideClicksRef.current += 1;
    if (currentStep?.type === "action") {
      setShakeActionBadge(true);
    }
  }, [currentStep]);

  // ── Dev audit function (non-production) ───────────────────────────────────
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    (window as unknown as Record<string, unknown>).useTutorialStore =
      useTutorialStore;
    (window as unknown as Record<string, unknown>).auditTourOverlaps =
      async () => {
        const results: Record<string, unknown>[] = [];
        const store = useTutorialStore.getState();
        const tours = ["onboarding", "settings"] as const;
        const vW = window.innerWidth;
        const vH = window.innerHeight;

        for (const tourId of tours) {
          const tourSteps = TOUR_REGISTRY[tourId];
          store.startTour(tourId);

          for (let i = 0; i < tourSteps.length; i++) {
            store.goToStep(i);
            // Wait 2 frames for anchor to settle
            await new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r))
            );

            const step = tourSteps[i]!;
            const card = document.querySelector<HTMLElement>(
              '[data-tour-element="tooltip-card"]'
            );
            const anchorEl = step.anchor
              ? document.querySelector<HTMLElement>(
                  Array.isArray(step.anchor)
                    ? step.anchor.map((a) => `[data-tour="${a}"]`).join(", ")
                    : `[data-tour="${step.anchor}"]`
                )
              : null;

            const cardRect = card?.getBoundingClientRect();
            const anchorRect = anchorEl?.getBoundingClientRect();

            const cardVsAnchorOverlap =
              cardRect && anchorRect
                ? Math.max(
                    0,
                    Math.min(cardRect.right, anchorRect.right) -
                      Math.max(cardRect.left, anchorRect.left)
                  ) *
                  Math.max(
                    0,
                    Math.min(cardRect.bottom, anchorRect.bottom) -
                      Math.max(cardRect.top, anchorRect.top)
                  )
                : 0;

            const textClipping = card
              ? card.scrollWidth > card.clientWidth
              : false;

            const distToEdges = cardRect
              ? {
                  top: cardRect.top,
                  right: vW - cardRect.right,
                  bottom: vH - cardRect.bottom,
                  left: cardRect.left,
                }
              : null;

            results.push({
              tourId,
              stepId: step.id,
              stepIndex: i,
              cardVsAnchorOverlap,
              cardVsHardRectOverlap: 0, // measured above in placement
              textClipping,
              distToEdges,
              leaderPresent: Boolean(
                document.querySelector("svg[data-leader-line]")
              ),
            });
          }
        }

        console.table(results);
        return results;
      };

    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__tutorialStore =
        useTutorialStore;
      (window as unknown as Record<string, unknown>).__panelStore =
        usePanelStore;
      (window as unknown as Record<string, unknown>).__layoutStore =
        useLayoutStore;
    }

    return () => {
      (window as unknown as Record<string, unknown>).auditTourOverlaps =
        undefined;
      if (typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>).__tutorialStore =
          undefined;
        (window as unknown as Record<string, unknown>).__panelStore = undefined;
        (window as unknown as Record<string, unknown>).__layoutStore =
          undefined;
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER TREE
  // ─────────────────────────────────────────────────────────────────────────

  if (machineState === "idle" || !activeTour || !currentStep) {
    return null;
  }

  // Child surface = unmount all tour UI instantly (same frame)
  if (isChildSurfaceActive) {
    return null;
  }

  // ── Resume/interrupt chip ──────────────────────────────────────────────────
  if (machineState === "paused" || machineState === "interrupted") {
    // Suppress resume chip if interrupted specifically for first task guide modal
    if (
      machineState === "interrupted" &&
      interruptedReason === "firstTaskModal"
    ) {
      return null;
    }

    const displayStep = currentStepIndex + 1;

    return (
      <>
        <div
          data-tour-id={activeTour}
          style={{ "--tour-accent": tourAccent } as React.CSSProperties}
        >
          <ResumeChip
            currentStep={displayStep}
            isInterrupted={machineState === "interrupted"}
            onDismiss={() => setSkipConfirmOpen(true)}
            onResume={() => {
              currentStep?.ensure?.();
              resumeTour();
            }}
            totalSteps={steps.length}
          />
        </div>
        <AnimatePresence>
          {skipConfirmOpen && (
            <SkipDialog
              onClose={() => setSkipConfirmOpen(false)}
              onDismissForever={() => skipTour("dismissedForever", userId)}
              onSkip={() => skipTour("skipped", userId)}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── Welcome scene ──────────────────────────────────────────────────────────
  if (currentStep.id === "onboarding-welcome") {
    return (
      <div
        data-tour-id={activeTour}
        style={{ "--tour-accent": tourAccent } as React.CSSProperties}
      >
        <WelcomeScene
          isReplay={isReplay}
          key={`welcome-${stepEpoch}-${activeTour}`}
          onOpenSkipDialog={() => setSkipConfirmOpen(true)}
          onSkip={() => skipTour("skipped", userId)}
          onStart={() => {
            playTourStartSound();
            nextStep();
          }}
          reducedMotion={reducedMotion}
          tier={tier}
        />
        <AnimatePresence>
          {skipConfirmOpen && (
            <SkipDialog
              onClose={() => setSkipConfirmOpen(false)}
              onDismissForever={() => skipTour("dismissedForever", userId)}
              onSkip={() => skipTour("skipped", userId)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Completion scene ───────────────────────────────────────────────────────
  if (currentStep.id === "onboarding-complete") {
    return (
      <div
        data-tour-id={activeTour}
        style={{ "--tour-accent": tourAccent } as React.CSSProperties}
      >
        <CompletionScene
          onBack={prevStep}
          onDone={() => completeTour(userId)}
          onSkip={() => skipTour("skipped", userId)}
          reducedMotion={reducedMotion}
          tier={tier}
        />
        <AnimatePresence>
          {skipConfirmOpen && (
            <SkipDialog
              onClose={() => setSkipConfirmOpen(false)}
              onDismissForever={() => skipTour("dismissedForever", userId)}
              onSkip={() => skipTour("skipped", userId)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Normal tooltip step ────────────────────────────────────────────────────
  const hasAnchor = Boolean(currentStep.anchor && targetRect);
  const vw = typeof window === "undefined" ? 1920 : window.innerWidth;
  const vh = typeof window === "undefined" ? 1080 : window.innerHeight;

  // Spotlight rect (padded 6px, radius read from element)
  let spotlightRect = null;
  if (hasAnchor && targetRect) {
    const anchorEl = findAnchorElement(currentStep.anchor);
    const radius = anchorEl ? getElementRadius(anchorEl) : 10;
    spotlightRect = {
      left: Math.max(0, targetRect.left - CUTOUT_PAD),
      top: Math.max(0, targetRect.top - CUTOUT_PAD),
      width: targetRect.width + CUTOUT_PAD * 2,
      height: targetRect.height + CUTOUT_PAD * 2,
      radius,
    };
  }

  return (
    <div
      data-tour-id={activeTour}
      style={{ "--tour-accent": tourAccent } as React.CSSProperties}
    >
      {!skipConfirmOpen && (
        <div
          className="fixed inset-0 pointer-events-none select-none"
          data-tour-element="overlay-root"
          style={{ zIndex: 9990 }}
        >
          {/* Spotlight + reticle (unified spring values) */}
          <Spotlight
            isActionStep={currentStep.type === "action"}
            isVisible={
              hasAnchor && !isCrossSurfaceFading && !isScrollingToAnchor
            }
            onOutsideClick={handleOutsideClick}
            reducedMotion={reducedMotion}
            shouldPulse={intentResult.shouldPulseAnchor}
            targetRect={spotlightRect}
            tier={tier}
            tourAccent={tourAccent}
            viewport={{ width: vw, height: vh }}
          />

          {/* Tooltip card */}
          {placement &&
            (!currentStep.anchor || targetRect) &&
            !isResolvingAnchor && (
              <TooltipCard
                activeTour={activeTour}
                currentStepIndex={currentStepIndex}
                intentResult={intentResult}
                isGoalSatisfied={isGoalSatisfied}
                isLast={isLast}
                isOutOfView={
                  targetRect
                    ? (() => {
                        const el = findAnchorElement(currentStep.anchor);
                        return el
                          ? !isElementInView(el)
                          : targetRect.top < 0 || targetRect.bottom > vh;
                      })()
                    : false
                }
                launchedFromCompletion={launchedFromCompletion}
                onBack={prevStep}
                onChainTour={(chainTourId) => {
                  launchTour(chainTourId, { fromCompletion: true, userId });
                }}
                onComplete={() => completeTour(userId)}
                onNext={handleNextClick}
                onScrollToAnchor={scrollToAnchor}
                onShakeComplete={() => setShakeActionBadge(false)}
                onSkipRequest={() => setSkipConfirmOpen(true)}
                placement={placement}
                prevStepIndex={directionPrev}
                reducedMotion={reducedMotion}
                shakeActionBadge={shakeActionBadge}
                step={currentStep}
                steps={steps}
                tier={tier}
              />
            )}
        </div>
      )}

      {/* Skip Confirm Dialog */}
      <AnimatePresence>
        {skipConfirmOpen && (
          <SkipDialog
            onClose={() => setSkipConfirmOpen(false)}
            onDismissForever={() => skipTour("dismissedForever", userId)}
            onSkip={() => skipTour("skipped", userId)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
