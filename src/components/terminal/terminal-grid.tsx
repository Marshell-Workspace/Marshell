"use client";

import { Plus, Terminal as TerminalIcon } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import { TerminalPane } from "@/components/terminal/terminal-pane";
import { useMounted } from "@/hooks/use-mounted";
import {
  type GridBreakpoint,
  getGridBreakpoint,
  getResponsiveGridConfig,
} from "@/lib/grid-layout";
import { terminalLayoutManager } from "@/lib/terminal-layout-manager";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";

const workspaceVariants: Variants = {
  active: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1], // Calm ease-out expo
    },
  },
  exiting: {
    opacity: 0,
    scale: 0.994,
    y: -3,
    transition: {
      duration: 0.18,
      ease: "easeOut",
    },
  },
  inactive: {
    opacity: 0,
    scale: 0.994,
    y: 3,
    transition: {
      duration: 0,
    },
  },
};

const reducedMotionVariants: Variants = {
  active: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.05 } },
  exiting: { opacity: 0, scale: 1, y: 0, transition: { duration: 0.05 } },
  inactive: { opacity: 0, scale: 1, y: 0, transition: { duration: 0 } },
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
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        }, 220);
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

    const onLayoutEnd = () => {
      if (bpDebounceTimer) {
        clearTimeout(bpDebounceTimer);
      }
      if (el) {
        updateBp(el.clientWidth);
      }
    };

    window.addEventListener("layout-animation-end", onLayoutEnd);
    window.addEventListener("transitionend", onLayoutEnd);

    return () => {
      if (bpDebounceTimer) {
        clearTimeout(bpDebounceTimer);
      }
      window.removeEventListener("layout-animation-end", onLayoutEnd);
      window.removeEventListener("transitionend", onLayoutEnd);
      observer.disconnect();
    };
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading terminals...</p>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background/50">
        <p className="text-muted-foreground text-sm">
          No workspaces yet. Create one to begin.
        </p>
      </div>
    );
  }

  const activeVariants = prefersReducedMotion
    ? reducedMotionVariants
    : workspaceVariants;

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-none border-0 bg-transparent"
      ref={containerRef}
    >
      {workspaces.map((ws) => {
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
              "absolute inset-0 grid gap-1.5 p-1.5 will-change-transform",
              config.gridClass,
              config.isScrollable
                ? "overflow-y-auto overflow-x-hidden"
                : "overflow-hidden"
            )}
            initial={false}
            key={ws.id}
            style={{
              visibility: isVisible ? "visible" : "hidden",
              pointerEvents: isActive ? "auto" : "none",
              zIndex: isActive ? 10 : isExiting ? 5 : 0,
            }}
            variants={activeVariants}
          >
            {ws.panes.length === 0 ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-border/20 border-dashed bg-muted/5 p-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-border/30 bg-muted/40 text-muted-foreground/60 shadow-sm">
                  <TerminalIcon className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground text-sm">
                    No active terminals
                  </p>
                  <p className="max-w-xs text-muted-foreground text-xs leading-relaxed">
                    All terminal sessions in this workspace have been closed.
                  </p>
                </div>
                <Button
                  className="mt-1 gap-1.5 shadow-sm"
                  onClick={() => addTerminal(ws.id)}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="size-3.5" />
                  Add Terminal
                </Button>
              </div>
            ) : (
              ws.panes.map((pane, index) => (
                <div
                  className={cn(
                    "h-full w-full min-w-0",
                    config.isScrollable ? "min-h-[200px]" : "min-h-0",
                    config.getPaneClass(index)
                  )}
                  key={pane.id}
                >
                  <TerminalPane
                    autoCommand={ws.autoCommand}
                    cwd={ws.directory}
                    directory={ws.directory}
                    id={pane.id}
                    index={index}
                    isActiveWorkspace={isActive}
                    name={pane.name}
                    title={`Terminal ${index + 1}`}
                    workspaceId={ws.id}
                  />
                </div>
              ))
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
