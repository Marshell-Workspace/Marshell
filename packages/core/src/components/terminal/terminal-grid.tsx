"use client";

import { TerminalGridSkeleton } from "@workspace/core/components/common/skeleton-composites";
import { WorkspaceEmptyState } from "@workspace/core/components/common/workspace-empty-state";
import { TerminalPane } from "@workspace/core/components/terminal/terminal-pane";
import { useMounted } from "@workspace/core/hooks/use-mounted";
import {
  type GridBreakpoint,
  getGridBreakpoint,
  getResponsiveGridConfig,
} from "@workspace/core/lib/grid-layout";
import { terminalLayoutManager } from "@workspace/core/lib/terminal-layout-manager";
import { onPrewarmWorkspace } from "@workspace/core/lib/workspace-prewarm";
import {
  MAX_TERMINALS_PER_WORKSPACE,
  useWorkspaceStore,
} from "@workspace/core/stores/workspace-store";
import { cn } from "@workspace/ui/lib/utils";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Workspace switch. Only opacity + translate are animated (never scale): the
 * terminals are canvases, and scaling re-rasterises them every frame, which is
 * what made switching feel heavy. The direction follows the sidebar order: going
 * to a workspace lower in the list slides in from below, higher from above.
 */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

interface WorkspaceMotion {
  dir: number;
  /** Re-entering a workspace that is still fading out: continue, don't restart. */
  resume: boolean;
}

const workspaceVariants: Variants = {
  active: ({ dir, resume }: WorkspaceMotion) =>
    resume
      ? {
          opacity: 1,
          y: 0,
          transition: { duration: 0.2, ease: EASE_OUT },
        }
      : {
          opacity: [0, 1],
          y: [12 * dir, 0],
          transition: {
            duration: 0.3,
            ease: EASE_OUT,
            opacity: { duration: 0.22, ease: "easeOut" },
          },
        },
  exiting: ({ dir }: WorkspaceMotion) => ({
    opacity: 0,
    y: -8 * dir,
    transition: { duration: 0.18, ease: "easeIn" },
  }),
  inactive: {
    opacity: 0,
    transition: { duration: 0 },
  },
};

/** Panes settle in one after another for a calm, layered arrival. */
const paneVariants: Variants = {
  active: (index: number) => ({
    y: [8, 0],
    transition: {
      duration: 0.34,
      ease: EASE_OUT,
      delay: Math.min(index, 7) * 0.03,
    },
  }),
  exiting: { y: 0, transition: { duration: 0 } },
  inactive: { y: 0, transition: { duration: 0 } },
};

const reducedMotionVariants: Variants = {
  active: { opacity: 1, y: 0, transition: { duration: 0.05 } },
  exiting: { opacity: 0, y: 0, transition: { duration: 0.05 } },
  inactive: { opacity: 0, y: 0, transition: { duration: 0 } },
};

const reducedPaneVariants: Variants = {
  active: { y: 0, transition: { duration: 0 } },
  exiting: { y: 0, transition: { duration: 0 } },
  inactive: { y: 0, transition: { duration: 0 } },
};

export function TerminalGrid() {
  const mounted = useMounted();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const addTerminal = useWorkspaceStore((s) => s.addTerminal);
  const prefersReducedMotion = useReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const [breakpoint, setBreakpoint] = useState<GridBreakpoint>("lg");

  // Track previous and exiting workspaces for coordinated cross-workspace transitions
  const [exitingWorkspaceId, setExitingWorkspaceId] = useState<string | null>(
    null
  );
  const prevActiveIdRef = useRef<string | null>(activeWorkspaceId);
  const [nav, setNav] = useState<{ active: string | null; dir: number }>({
    active: activeWorkspaceId,
    dir: 1,
  });
  if (nav.active !== activeWorkspaceId) {
    const order = workspaces.map((w) => w.id);
    const from = nav.active ? order.indexOf(nav.active) : -1;
    const to = activeWorkspaceId ? order.indexOf(activeWorkspaceId) : -1;
    setNav({ active: activeWorkspaceId, dir: to >= from ? 1 : -1 });
  }
  const direction = nav.dir;
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track visited workspaces so we only mount terminals for workspaces that the user has navigated to.
  // Unvisited workspaces will not eagerly spawn PTY processes or initialize xterm canvases.
  const [visitedWorkspaceIds, setVisitedWorkspaceIds] = useState<Set<string>>(
    () => new Set(activeWorkspaceId ? [activeWorkspaceId] : [])
  );

  useEffect(() => {
    if (activeWorkspaceId) {
      setVisitedWorkspaceIds((prev) => {
        if (prev.has(activeWorkspaceId)) {
          return prev;
        }
        const next = new Set(prev);
        next.add(activeWorkspaceId);
        return next;
      });
    }
  }, [activeWorkspaceId]);

  // Hovering a workspace in the sidebar mounts its terminals ahead of the
  // click, so xterm init and shell start never happen mid-animation.
  useEffect(
    () =>
      onPrewarmWorkspace((id) => {
        setVisitedWorkspaceIds((prev) => {
          if (prev.has(id) || !workspaces.some((w) => w.id === id)) {
            return prev;
          }
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }),
    [workspaces]
  );

  useEffect(() => {
    if (prevActiveIdRef.current !== activeWorkspaceId) {
      const previousId = prevActiveIdRef.current;
      prevActiveIdRef.current = activeWorkspaceId;

      if (previousId && previousId !== activeWorkspaceId) {
        setExitingWorkspaceId(previousId);

        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
        }

        exitTimerRef.current = setTimeout(() => {
          setExitingWorkspaceId(null);
          exitTimerRef.current = null;
        }, 240);
      }
    }

    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [activeWorkspaceId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    setBreakpoint(getGridBreakpoint(el.clientWidth));

    let bpDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    const updateBp = (width: number) => {
      const nextBp = getGridBreakpoint(width);
      setBreakpoint((prev) => (prev === nextBp ? prev : nextBp));
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        if (terminalLayoutManager.isTransitioning()) {
          return; // Suppress breakpoint changes during active layout animations
        }
        if (bpDebounceTimer) {
          clearTimeout(bpDebounceTimer);
        }
        // Debounce breakpoint changes during layout transitions to prevent layout jumps
        bpDebounceTimer = setTimeout(() => {
          if (!terminalLayoutManager.isTransitioning()) {
            updateBp(entry.contentRect.width);
          }
        }, 80);
      }
    });

    observer.observe(el);

    const onLayoutEnd = (event?: Event) => {
      if (event && event.type === "transitionend") {
        const e = event as TransitionEvent;
        const target = e.target as HTMLElement | null;
        const slot = target?.getAttribute?.("data-slot");
        if (
          slot !== "sidebar-gap" &&
          slot !== "sidebar-container" &&
          slot !== "agent-sidebar"
        ) {
          return;
        }
        if (e.propertyName !== "width" && e.propertyName !== "transform") {
          return;
        }
      }
      if (bpDebounceTimer) {
        clearTimeout(bpDebounceTimer);
      }
      if (el) {
        updateBp(el.clientWidth);
      }
    };

    const handleRecalculate = () => {
      if (bpDebounceTimer) {
        clearTimeout(bpDebounceTimer);
        bpDebounceTimer = null;
      }
      if (el) {
        updateBp(el.clientWidth);
      }
      terminalLayoutManager.notifyFullscreenTransition();
    };

    const handleVisibility = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        handleRecalculate();
      }
    };

    window.addEventListener("layout-animation-end", onLayoutEnd);
    window.addEventListener("transitionend", onLayoutEnd);
    window.addEventListener("resize", handleRecalculate);
    window.addEventListener("restore", handleRecalculate);
    window.addEventListener("maximize", handleRecalculate);
    window.addEventListener("unmaximize", handleRecalculate);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (bpDebounceTimer) {
        clearTimeout(bpDebounceTimer);
      }
      window.removeEventListener("layout-animation-end", onLayoutEnd);
      window.removeEventListener("transitionend", onLayoutEnd);
      window.removeEventListener("resize", handleRecalculate);
      window.removeEventListener("restore", handleRecalculate);
      window.removeEventListener("maximize", handleRecalculate);
      window.removeEventListener("unmaximize", handleRecalculate);
      document.removeEventListener("visibilitychange", handleVisibility);
      observer.disconnect();
    };
  }, []);

  if (!mounted) {
    return (
      <div className="relative flex flex-1 h-full flex-col overflow-hidden">
        <TerminalGridSkeleton paneCount={1} />
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <p className="font-mono text-muted-foreground/60 text-xs tracking-tight">
          No workspaces yet — create one to begin.
        </p>
      </div>
    );
  }

  const activeVariants = prefersReducedMotion
    ? reducedMotionVariants
    : workspaceVariants;
  const paneMotion = prefersReducedMotion ? reducedPaneVariants : paneVariants;

  return (
    <div
      className="relative flex flex-1 h-full flex-col overflow-hidden rounded-none border-0 bg-transparent"
      ref={containerRef}
    >
      {workspaces
        .filter(
          (ws) => ws.id === activeWorkspaceId || visitedWorkspaceIds.has(ws.id)
        )
        .map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const isExiting = ws.id === exitingWorkspaceId;
          const isVisible = isActive || isExiting;
          const config = getResponsiveGridConfig(ws.panes.length, breakpoint);

          const currentStatus = isActive
            ? "active"
            : isExiting
              ? "exiting"
              : "inactive";

          return (
            <motion.div
              animate={currentStatus}
              aria-hidden={!isActive}
              className={cn(
                "absolute inset-0 grid gap-1.5 sm:gap-2",
                config.gridClass,
                config.isScrollable
                  ? "overflow-y-auto overflow-x-hidden p-0 pb-2.5 pr-1 sm:pb-3 sm:pr-1.5"
                  : "overflow-hidden p-0"
              )}
              custom={
                { dir: direction, resume: isExiting } satisfies WorkspaceMotion
              }
              initial={false}
              key={ws.id}
              style={{
                // Promote a layer only while it is on screen.
                willChange: isVisible ? "transform, opacity" : "auto",
                visibility: isVisible ? "visible" : "hidden",
                pointerEvents: isActive ? "auto" : "none",
                zIndex: isActive ? 10 : isExiting ? 5 : 0,
              }}
              variants={activeVariants}
            >
              {ws.panes.length === 0 ? (
                <div className="col-span-12 row-span-1 h-full w-full min-h-0 min-w-0">
                  <WorkspaceEmptyState
                    maxTerminalsReached={
                      ws.panes.length >= MAX_TERMINALS_PER_WORKSPACE
                    }
                    mode="no-terminals"
                    onAddTerminal={() => {
                      if (ws.panes.length >= MAX_TERMINALS_PER_WORKSPACE) {
                        toast.error("Maximum of 8 terminals per workspace.");
                        return;
                      }
                      const pane = addTerminal(ws.id);
                      if (!pane) {
                        toast.error("Maximum of 8 terminals per workspace.");
                      }
                    }}
                  />
                </div>
              ) : (
                ws.panes.map((pane, index) => (
                  <motion.div
                    className={cn(
                      "h-full w-full min-h-0 min-w-0",
                      config.isScrollable ? "min-h-[200px]" : "min-h-0",
                      config.getPaneClass(index)
                    )}
                    custom={index}
                    key={pane.id}
                    variants={paneMotion}
                  >
                    <TerminalPane
                      autoCommand={pane.autoCommand ?? ws.autoCommand}
                      color={pane.color}
                      cwd={ws.directory}
                      directory={ws.directory}
                      id={pane.id}
                      index={index}
                      isActiveWorkspace={isActive}
                      name={pane.name}
                      title={`Terminal ${index + 1}`}
                      workspaceId={ws.id}
                    />
                  </motion.div>
                ))
              )}
            </motion.div>
          );
        })}
    </div>
  );
}
