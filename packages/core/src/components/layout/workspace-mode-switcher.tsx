"use client";

import {
  BoardModeIcon,
  ChangesModeIcon,
  PreviewModeIcon,
  ProcessesModeIcon,
  TerminalModeIcon,
} from "@workspace/core/components/icons/mode-icons";
import { useProcessUiStore } from "@workspace/core/stores/process-ui-store";
import {
  useWorkspaceStore,
  type WorkspaceViewMode,
} from "@workspace/core/stores/workspace-store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ComponentType, memo, useCallback, useEffect } from "react";

export type NavViewId = WorkspaceViewMode | "processes";

export interface WorkspaceModeConfig {
  description: string;
  icon: ComponentType<{ className?: string }>;
  id: NavViewId;
  label: string;
  shortcut: string;
}

export const DEFAULT_WORKSPACE_MODE: WorkspaceModeConfig = {
  id: "terminals",
  label: "Terminals",
  description: "Shell sessions",
  shortcut: "1",
  icon: TerminalModeIcon,
};

export const WORKSPACE_MODES: WorkspaceModeConfig[] = [
  DEFAULT_WORKSPACE_MODE,
  {
    id: "preview",
    label: "Preview",
    description: "Running application",
    shortcut: "2",
    icon: PreviewModeIcon,
  },
  {
    id: "board",
    label: "Board",
    description: "Tasks & workflow",
    shortcut: "3",
    icon: BoardModeIcon,
  },
  {
    id: "changes",
    label: "Changes",
    description: "Git changes",
    shortcut: "4",
    icon: ChangesModeIcon,
  },
  {
    id: "processes",
    label: "Processes",
    description: "Running processes",
    shortcut: "5",
    icon: ProcessesModeIcon,
  },
];

// Underdamped on purpose: the highlight overshoots a little and settles, which
// reads as a soft, jelly-like slide between modes.
const JELLY_SPRING = {
  type: "spring",
  stiffness: 340,
  damping: 19,
  mass: 0.9,
} as const;
// The rest of the row only needs to get out of the way, so it is calmer.
const FOLLOW_SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 34,
} as const;
const INSTANT = { duration: 0 } as const;

interface WorkspaceModeSwitcherProps {
  className?: string;
  /**
   * Optional recent modes support for future extensibility.
   */
  recentModeIds?: NavViewId[];
}

export const WorkspaceModeSwitcher = memo(function WorkspaceModeSwitcher({
  className,
}: WorkspaceModeSwitcherProps) {
  const activeView = useWorkspaceStore((s) => s.activeView);
  const setActiveView = useWorkspaceStore((s) => s.setActiveView);
  const isProcessOpen = useProcessUiStore((s) => s.open);
  const setProcessOpen = useProcessUiStore((s) => s.setOpen);
  const reducedMotion = useReducedMotion();

  const currentModeId: NavViewId = isProcessOpen ? "processes" : activeView;

  const handleSelectMode = useCallback(
    (id: NavViewId) => {
      if (id === "processes") {
        setProcessOpen(!isProcessOpen);
      } else {
        setProcessOpen(false);
        setActiveView(id);
      }
    },
    [isProcessOpen, setActiveView, setProcessOpen]
  );

  // Global numeric shortcuts 1..5 when not typing in form inputs or terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.closest(".monaco-editor") ||
          target.closest(".xterm"))
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.key >= "1" && e.key <= "5") {
        const index = Number.parseInt(e.key, 10) - 1;
        const targetMode = WORKSPACE_MODES[index];
        if (targetMode) {
          e.preventDefault();
          handleSelectMode(targetMode.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSelectMode]);

  return (
    <div
      aria-label="Workspace modes"
      className={cn(
        "flex h-8.5 items-center gap-1 rounded-lg border border-border/50 bg-muted/40 p-0.5 shadow-2xs backdrop-blur-md transform-gpu",
        className
      )}
      role="tablist"
    >
      {WORKSPACE_MODES.map((mode) => {
        const isSelected = mode.id === currentModeId;
        const Icon = mode.icon;

        return (
          <Tooltip key={mode.id}>
            <TooltipTrigger asChild={true}>
              <motion.button
                aria-label={`${mode.label} (Press ${mode.shortcut})`}
                aria-selected={isSelected}
                className={cn(
                  "group/mode-btn relative flex h-7.5 items-center rounded-md text-xs font-medium cursor-pointer select-none outline-none transition-colors motion-fast focus-visible:ring-1 focus-visible:ring-primary/40",
                  isSelected
                    ? "px-2 sm:px-3 text-foreground font-semibold"
                    : "size-7.5 justify-center text-muted-foreground/75 hover:bg-muted hover:text-foreground"
                )}
                data-mode-id={mode.id}
                layout="position"
                onClick={() => handleSelectMode(mode.id)}
                role="tab"
                transition={reducedMotion ? INSTANT : FOLLOW_SPRING}
                type="button"
                whileHover={isSelected ? undefined : { scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
              >
                {isSelected && (
                  <motion.div
                    className="absolute inset-0 rounded-md border border-border/60 bg-card shadow-xs will-change-transform dark:border-0 dark:bg-white/[0.12] dark:shadow-[0_0_12px_rgba(255,255,255,0.08)]"
                    layoutId="workspaceModeActiveHighlight"
                    transition={reducedMotion ? INSTANT : JELLY_SPRING}
                  />
                )}

                <Icon
                  className={cn(
                    "relative z-10 size-4 shrink-0 transition-ui motion-fast",
                    isSelected
                      ? "text-foreground"
                      : "text-muted-foreground/75 group-hover/mode-btn:scale-110 group-hover/mode-btn:text-foreground"
                  )}
                />

                <AnimatePresence initial={false} mode="popLayout">
                  {isSelected && (
                    <motion.span
                      animate={{ opacity: 1 }}
                      className="relative z-10 pl-1.5 font-sans font-medium text-foreground text-xs tracking-tight whitespace-nowrap hidden sm:inline-block"
                      exit={{ opacity: 0 }}
                      initial={{ opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {mode.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent
              align="center"
              className="flex items-center justify-center px-2.5 py-1 text-xs"
              side="bottom"
              sideOffset={6}
            >
              <span className="font-medium text-foreground">{mode.label}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
});
