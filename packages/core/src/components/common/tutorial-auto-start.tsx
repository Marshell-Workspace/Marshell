"use client";

import { useMounted } from "@workspace/core/hooks/use-mounted";
import { useAuthStore } from "@workspace/core/stores/auth-store";
import { usePanelStore } from "@workspace/core/stores/panel-store";
import { useTutorialStore } from "@workspace/core/stores/tutorial-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { useEffect, useRef } from "react";

/**
 * Headless controller for triggering first-run tours:
 * 1. Waits until auth has resolved (authStore.isLoaded === true) to prevent flashes.
 * 2. Onboarding auto-starts once per account if status is "pending".
 * 3. Settings tour auto-starts on first Settings open if "pending" and onboarding is not active.
 */
export function TutorialAutoStart() {
  const mounted = useMounted();
  const session = useAuthStore((s) => s.session);
  const isAuthLoaded = useAuthStore((s) => s.isLoaded);

  const activeTour = useTutorialStore((s) => s.activeTour);
  const machineState = useTutorialStore((s) => s.machineState);
  const startTour = useTutorialStore((s) => s.startTour);
  const getTourRecord = useTutorialStore((s) => s.getTourRecord);

  const isSettingsOpen = usePanelStore((s) => s.isSettingsOpen);

  const onboardingCheckedRef = useRef(false);
  const settingsCheckedRef = useRef(false);
  const startedToursInSessionRef = useRef<Set<string>>(new Set());

  const userId = session?.user_id || session?.email;

  // 1. Initial Onboarding Walkthrough (Auto-start once per account if pending)
  useEffect(() => {
    if (!(mounted && isAuthLoaded && userId)) {
      return;
    }
    if (activeTour || machineState === "active") {
      return;
    }
    if (onboardingCheckedRef.current) {
      return;
    }

    onboardingCheckedRef.current = true;
    const record = getTourRecord(userId);

    // If already shown/started/completed/skipped, do not auto-start
    if (record.onboarding !== "pending" || record.onboardingShownAt) {
      return;
    }

    // Existing accounts check: if workspaces exist, this is an existing user.
    // Mark tours as completed and persist so they never suddenly get the tour.
    const workspaces = useWorkspaceStore.getState().workspaces;
    if (workspaces.length > 0) {
      const currentStates = useTutorialStore.getState().userTourStates;
      const updated = {
        ...currentStates,
        [userId]: {
          onboarding: "completed" as const,
          settings: "completed" as const,
          onboardingShownAt: Date.now(),
          settingsShownAt: Date.now(),
          version: 1,
        },
      };
      try {
        localStorage.setItem("marshell_tour_state_v4", JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      useTutorialStore.setState({ userTourStates: updated });
      return;
    }

    // Brand new user: auto-start onboarding once
    if (record.onboarding === "pending") {
      let r1 = 0;
      let r2 = 0;
      r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => {
          const currentActive = useTutorialStore.getState().activeTour;
          if (!currentActive) {
            startTour("onboarding", { userId });
          }
        });
      });
      return () => {
        if (r1) {
          cancelAnimationFrame(r1);
        }
        if (r2) {
          cancelAnimationFrame(r2);
        }
      };
    }
  }, [
    mounted,
    isAuthLoaded,
    activeTour,
    machineState,
    getTourRecord,
    userId,
    startTour,
  ]);

  // 2. Settings Dialog Specific Tour (Starts on first open if pending and onboarding not running)
  useEffect(() => {
    if (!(mounted && isAuthLoaded && userId)) {
      return;
    }
    if (!isSettingsOpen) {
      settingsCheckedRef.current = false;
      return;
    }
    // Never auto-start settings tour if onboarding is active, interrupted, or paused
    if (
      activeTour ||
      machineState === "active" ||
      machineState === "interrupted" ||
      machineState === "paused"
    ) {
      return;
    }
    if (settingsCheckedRef.current) {
      return;
    }

    settingsCheckedRef.current = true;
    const record = getTourRecord(userId);

    if (
      record.settings === "pending" &&
      !record.settingsShownAt &&
      !startedToursInSessionRef.current.has("settings")
    ) {
      startedToursInSessionRef.current.add("settings");
      let rafId = 0;
      const startTime = performance.now();
      const checkAndStart = () => {
        const store = useTutorialStore.getState();
        if (
          store.activeTour ||
          store.machineState === "interrupted" ||
          store.machineState === "paused" ||
          !usePanelStore.getState().isSettingsOpen ||
          usePanelStore.getState().settingsTab === "tutorials"
        ) {
          return;
        }
        const el = document.querySelector<HTMLElement>(
          '[data-tour="settings-nav"], [data-slot="dialog-content"]'
        );
        if (el?.isConnected) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            startTour("settings", { userId });
            return;
          }
        }
        if (performance.now() - startTime < 3000) {
          rafId = requestAnimationFrame(checkAndStart);
        }
      };
      rafId = requestAnimationFrame(checkAndStart);
      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
      };
    }
  }, [
    mounted,
    isAuthLoaded,
    isSettingsOpen,
    activeTour,
    machineState,
    getTourRecord,
    userId,
    startTour,
  ]);

  // 3. Outside listener for FirstTaskGuide modal dismissal when onboarding was interrupted
  useEffect(() => {
    if (!mounted || typeof document === "undefined") {
      return;
    }

    const checkModalDismissal = () => {
      const store = useTutorialStore.getState();
      if (
        store.activeTour === "onboarding" &&
        store.machineState === "interrupted" &&
        store.interruptedReason === "firstTaskModal"
      ) {
        let isDismissedInStorage = false;
        try {
          if (
            localStorage.getItem("marshell-first-task-guide-dismissed") ===
            "dismissed"
          ) {
            isDismissedInStorage = true;
          } else {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (
                (k === "marshell-first-task-guide-dismissed" ||
                  k?.startsWith("marshell.first-task-guide.")) &&
                localStorage.getItem(k) === "dismissed"
              ) {
                isDismissedInStorage = true;
                break;
              }
            }
          }
        } catch {
          // ignore
        }

        const isModalInDom = Boolean(
          document.querySelector('[data-tour-element="first-task-guide"]') ||
            document.querySelector('[data-first-task-guide="true"]')
        );
        if (isDismissedInStorage || !isModalInDom) {
          store.resumeFromInterrupt();
        }
      }
    };

    checkModalDismissal();
    const observer = new MutationObserver(checkModalDismissal);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("storage", checkModalDismissal);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", checkModalDismissal);
    };
  }, [mounted]);

  return null;
}
