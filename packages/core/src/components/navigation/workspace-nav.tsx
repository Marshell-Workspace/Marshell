"use client";

import { SidebarWorkspacesSkeleton } from "@workspace/core/components/common/skeleton-composites";
import {
  DuplicateIcon,
  PinIcon,
  RenameIcon,
} from "@workspace/core/components/icons/mode-icons";
import { useMounted } from "@workspace/core/hooks/use-mounted";
import { formatHotkeyDisplay } from "@workspace/core/lib/utils";
import { prewarmWorkspace } from "@workspace/core/lib/workspace-prewarm";
import {
  MAX_TERMINALS_PER_WORKSPACE,
  useWorkspaceStore,
  type Workspace,
} from "@workspace/core/stores/workspace-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import { recordGenieTrigger } from "@workspace/ui/lib/genie-motion";
import { cn } from "@workspace/ui/lib/utils";
import {
  Folder,
  MoreHorizontal,
  PinOff,
  Plus,
  Terminal,
  Trash2,
} from "lucide-react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

interface WorkspaceNavProps {
  navigate: (path: string) => void;
  onNewWorkspace: () => void;
  pathname?: string;
}

interface WorkspaceItemProps {
  index: number;
  isActive: boolean;
  isMobile: boolean;
  onAddTerminal: (id: string, autoCommand?: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  ws: Workspace;
}

// When the active row changes, the old rail unmounts and a new one mounts in
// the same commit. Remembering the unmount tells the newcomer it is travelling
// (stretch) rather than appearing fresh (grow), e.g. after the sidebar toggles.
const railUnmountedAt = new Map<string, number>();
const RAIL_HANDOFF_MS = 120;

/** One spring for the whole active highlight (bar + background). */
const ACTIVE_HIGHLIGHT_SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 21.2,
  mass: 0.9,
} as const;

/**
 * The accent bar beside the active workspace: one shared layout element, so it
 * glides to the newly active row on a soft underdamped spring, stretching while
 * it moves. The same element also travels between the open sidebar's row and the
 * collapsed sidebar's icon. The collapsed icon column has a fixed width (see
 * AppSidebar), so its final position is already correct while the sidebar's own
 * width is still animating. A bar with no predecessor grows in place.
 */
export function ActiveRail({
  className,
  layoutId = "activeWorkspaceRail",
}: {
  className?: string;
  layoutId?: string;
}) {
  const reducedMotion = useReducedMotion();
  const controls = useAnimationControls();

  useLayoutEffect(() => {
    const travelling =
      performance.now() -
        (railUnmountedAt.get(layoutId) ?? Number.NEGATIVE_INFINITY) <
      RAIL_HANDOFF_MS;
    if (!reducedMotion) {
      if (travelling) {
        controls.start({
          scaleY: [1.4355, 0.9505, 1],
          transition: { duration: 0.55, ease: "easeOut" },
        });
      } else {
        controls.set({ scaleY: 0 });
        controls.start({
          scaleY: [0, 1.1385, 0.9505, 1],
          transition: { duration: 0.6, ease: "easeOut" },
        });
      }
    }
    return () => {
      railUnmountedAt.set(layoutId, performance.now());
    };
  }, [controls, layoutId, reducedMotion]);

  return (
    <motion.span
      aria-hidden="true"
      className={cn("pointer-events-none absolute z-[5] w-[3px]", className)}
      layoutId={layoutId}
      transition={reducedMotion ? { duration: 0 } : ACTIVE_HIGHLIGHT_SPRING}
    >
      <motion.span
        animate={controls}
        className="block size-full origin-center rounded-r-[3px] bg-primary"
      />
    </motion.span>
  );
}

const WorkspaceItem = memo(function WorkspaceItem({
  ws,
  isActive,
  index,
  isMobile,
  onAddTerminal,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onTogglePin,
}: WorkspaceItemProps) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(ws.name);
  const [menuOpen, setMenuOpen] = useState(false);

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

  const handleSaveRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== ws.name) {
      onRename(ws.id, trimmed);
    }
    setRenaming(false);
  };

  const itemRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isActive]);

  return (
    <ContextMenu key={ws.id}>
      <ContextMenuTrigger asChild={true}>
        <SidebarMenuItem
          className="group/item relative px-1.5 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          data-slot="context-menu-trigger"
          data-workspace-item="true"
          key={ws.id}
          onFocusCapture={() => prewarmWorkspace(ws.id)}
          onPointerEnter={() => prewarmWorkspace(ws.id)}
          ref={itemRef}
        >
          {isActive ? null : (
            <div
              className={cn(
                "absolute inset-x-1.5 inset-y-0 z-0 rounded-md transition-colors motion-fast pointer-events-none",
                "group-data-[collapsible=icon]:inset-0 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:rounded-md",
                menuOpen
                  ? "bg-muted/60"
                  : "opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100 bg-muted/50"
              )}
            />
          )}

          {isActive && (
            <ActiveRail className="inset-y-1.5 left-1.5 group-data-[collapsible=icon]:hidden" />
          )}

          {renaming ? (
            <div className="relative z-10 flex h-8.5 w-full items-center gap-2 px-2.5">
              <input
                autoFocus
                className="flex-1 rounded-md border border-border bg-secondary px-2 py-1 font-sans text-foreground text-xs outline-none transition-ui motion-fast focus:ring-1 focus:ring-white/40"
                onBlur={handleSaveRename}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveRename();
                  } else if (e.key === "Escape") {
                    setRenameValue(ws.name);
                    setRenaming(false);
                  }
                }}
                value={renameValue}
              />
            </div>
          ) : (
            <div className="relative z-10 flex h-8.5 w-full items-center px-1 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
              {/* Main workspace selection click target */}
              <button
                className={cn(
                  "flex h-full min-w-0 flex-1 items-center gap-2 rounded-md pl-2 pr-1 text-left text-xs font-medium transition-ui motion-fast outline-none select-none focus-visible:ring-1 focus-visible:ring-ring",
                  "group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0",
                  isActive
                    ? "text-[var(--sidebar-active-fg)] font-semibold cursor-default"
                    : "text-muted-foreground group-hover/item:text-foreground active:scale-[0.99]"
                )}
                data-workspace-item="true"
                onClick={() => onSelect(ws.id)}
                type="button"
              >
                <Terminal
                  className={cn(
                    "size-4 shrink-0 transition-transform motion-fast",
                    isActive
                      ? "text-[var(--sidebar-active-fg)]"
                      : "text-muted-foreground group-hover/item:text-foreground group-hover/item:scale-105"
                  )}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-xs whitespace-nowrap group-data-[collapsible=icon]:hidden",
                    isActive
                      ? "text-[var(--sidebar-active-fg)] font-semibold"
                      : "text-muted-foreground group-hover/item:text-foreground"
                  )}
                >
                  {ws.name}
                </span>
              </button>

              {/* Single right-side action slot: terminal count badge by default, swapped with ... menu button on hover/focus/menu-open */}
              <div className="relative shrink-0 flex size-6 items-center justify-center group-data-[collapsible=icon]:hidden">
                {/* Terminal count badge */}
                <span
                  className={cn(
                    "count-badge flex h-4.5 min-w-[20px] items-center justify-center rounded-sm px-1.5 font-mono text-[10.5px] tabular-nums transition-opacity motion-fast pointer-events-none select-none",
                    isActive
                      ? "bg-[var(--count-badge-active-bg)] border border-[var(--count-badge-active-border)] text-[var(--count-badge-active-fg)]"
                      : "bg-[var(--count-badge-bg)] border border-[var(--count-badge-border)] text-[var(--count-badge-fg)] group-hover/item:opacity-0 group-focus-within/item:opacity-0",
                    menuOpen
                      ? "opacity-0"
                      : "group-hover/item:opacity-0 group-focus-within/item:opacity-0"
                  )}
                  data-active={isActive ? "true" : undefined}
                  data-slot="count-badge"
                  title={`${ws.terminalCount} terminals`}
                >
                  {ws.terminalCount}
                </span>

                {/* Dedicated overflow action button occupying exact same slot */}
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center transition-ui motion-fast transform-gpu",
                    menuOpen
                      ? "opacity-100 scale-100 pointer-events-auto"
                      : "opacity-0 scale-75 pointer-events-none group-hover/item:opacity-100 group-hover/item:scale-100 group-hover/item:pointer-events-auto group-focus-within/item:opacity-100 group-focus-within/item:scale-100 group-focus-within/item:pointer-events-auto"
                  )}
                >
                  <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
                    <DropdownMenuTrigger asChild={true}>
                      <button
                        aria-label={`${ws.name} options`}
                        className={cn(
                          "flex size-6 items-center justify-center rounded-md transition-ui motion-fast outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
                          isActive
                            ? "text-[var(--sidebar-active-fg)]/70 hover:text-[var(--sidebar-active-fg)] hover:bg-[var(--sidebar-active-fg)]/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
                          menuOpen &&
                            (isActive
                              ? "bg-[var(--sidebar-active-fg)]/15 text-[var(--sidebar-active-fg)] opacity-100 scale-100"
                              : "bg-muted text-foreground opacity-100 scale-100")
                        )}
                        onClick={(e) => e.stopPropagation()}
                        type="button"
                      >
                        <MoreHorizontal className="size-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align={isMobile ? "end" : "start"}
                      className="w-52 border-border/60 bg-popover backdrop-blur-xl"
                      side={isMobile ? "bottom" : "right"}
                    >
                      {index < 9 && (
                        <div className="flex items-center justify-between px-2 py-1 text-[11px] text-muted-foreground border-b border-border/40 mb-1">
                          <span>Shortcut</span>
                          <kbd className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                            {isMac
                              ? `⌘⇧${index + 1}`
                              : `Ctrl+Shift+${index + 1}`}
                          </kbd>
                        </div>
                      )}
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(ws.id);
                        }}
                      >
                        {ws.isPinned ? (
                          <>
                            <PinOff className="mr-2 size-3.5 text-muted-foreground" />
                            <span>Unpin Workspace</span>
                          </>
                        ) : (
                          <>
                            <PinIcon className="mr-2 size-3.5" />
                            <span>Pin Workspace</span>
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenaming(true);
                        }}
                      >
                        <RenameIcon className="mr-2 size-3.5" />
                        <span>Rename</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={
                          ws.panes.length >= MAX_TERMINALS_PER_WORKSPACE
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddTerminal(ws.id);
                        }}
                      >
                        <Plus className="mr-2 size-3.5 text-muted-foreground" />
                        <span>Add Terminal</span>
                        <span className="ml-auto mr-1 font-mono text-[10px] text-muted-foreground">
                          {ws.panes.length}/{MAX_TERMINALS_PER_WORKSPACE}
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate(ws.id);
                        }}
                      >
                        <DuplicateIcon className="mr-2 size-3.5" />
                        <span>Duplicate</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/40" />
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/15 focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(ws.id);
                        }}
                      >
                        <Trash2 className="mr-2 size-3.5 text-destructive" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )}
        </SidebarMenuItem>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52 border-border/60 bg-popover backdrop-blur-xl">
        {index < 9 && (
          <div className="flex items-center justify-between px-2 py-1 text-[11px] text-muted-foreground border-b border-border/40 mb-1">
            <span>Shortcut</span>
            <kbd className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
              {isMac ? `⌘⇧${index + 1}` : `Ctrl+Shift+${index + 1}`}
            </kbd>
          </div>
        )}
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(ws.id);
          }}
        >
          {ws.isPinned ? (
            <>
              <PinOff className="mr-2 size-3.5 text-muted-foreground" />
              <span>Unpin Workspace</span>
            </>
          ) : (
            <>
              <PinIcon className="mr-2 size-3.5" />
              <span>Pin Workspace</span>
            </>
          )}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            setRenaming(true);
          }}
        >
          <RenameIcon className="mr-2 size-3.5" />
          <span>Rename</span>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={ws.panes.length >= MAX_TERMINALS_PER_WORKSPACE}
          onClick={(e) => {
            e.stopPropagation();
            onAddTerminal(ws.id);
          }}
        >
          <Plus className="mr-2 size-3.5 text-muted-foreground" />
          <span>Add Terminal</span>
          <span className="ml-auto mr-1 font-mono text-[10px] text-muted-foreground">
            {ws.panes.length}/{MAX_TERMINALS_PER_WORKSPACE}
          </span>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(ws.id);
          }}
        >
          <DuplicateIcon className="mr-2 size-3.5" />
          <span>Duplicate</span>
        </ContextMenuItem>
        <ContextMenuSeparator className="bg-border/40" />
        <ContextMenuItem
          className="text-destructive focus:bg-destructive/15 focus:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(ws.id);
          }}
        >
          <Trash2 className="mr-2 size-3.5 text-destructive" />
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

export const WorkspaceNav = memo(function WorkspaceNav({
  navigate,
  onNewWorkspace,
  pathname,
}: WorkspaceNavProps) {
  const mounted = useMounted();
  const { isMobile, setOpenMobile } = useSidebar();

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const storeActiveWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  // The sidebar highlight moves the instant you click. The workspace store
  // (and the heavy grid/agent re-render it triggers) commits one frame later,
  // so the pill glides on a free main thread instead of waiting on that work.
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(
    null
  );
  const activeWorkspaceId = pendingWorkspaceId ?? storeActiveWorkspaceId;
  useEffect(() => {
    if (!pendingWorkspaceId) {
      return;
    }
    if (pendingWorkspaceId === storeActiveWorkspaceId) {
      setPendingWorkspaceId(null);
      return;
    }
    // Safety net: never leave the highlight out of sync with the store.
    const timer = window.setTimeout(() => setPendingWorkspaceId(null), 900);
    return () => window.clearTimeout(timer);
  }, [pendingWorkspaceId, storeActiveWorkspaceId]);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const addTerminal = useWorkspaceStore((s) => s.addTerminal);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const duplicateWorkspace = useWorkspaceStore((s) => s.duplicateWorkspace);
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace);
  const togglePinWorkspace = useWorkspaceStore((s) => s.togglePinWorkspace);

  const handleAddTerminal = useCallback(
    (id: string, autoCommand?: string) => {
      const pane = addTerminal(id, autoCommand);
      if (pane) {
        useWorkspaceStore.getState().setActiveView("terminals");
        navigate("/workspace");
      } else {
        toast.error("Maximum of 8 terminals per workspace.");
      }
    },
    [addTerminal, navigate]
  );

  const handleSelect = useCallback(
    (id: string) => {
      const commit = () => {
        setActiveWorkspace(id);
        useWorkspaceStore.getState().setActiveView("terminals");
        if (isMobile) {
          setOpenMobile(false);
        }
        navigate("/workspace");
      };
      if (id === useWorkspaceStore.getState().activeWorkspaceId) {
        commit();
        return;
      }
      setPendingWorkspaceId(id);
      if (typeof requestAnimationFrame === "undefined") {
        commit();
        return;
      }
      requestAnimationFrame(commit);
    },
    [isMobile, setOpenMobile, navigate, setActiveWorkspace]
  );

  const handleRename = useCallback(
    (id: string, name: string) => {
      renameWorkspace(id, name);
    },
    [renameWorkspace]
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      duplicateWorkspace(id);
      useWorkspaceStore.getState().setActiveView("terminals");
      navigate("/workspace");
    },
    [duplicateWorkspace, navigate]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteWorkspace(id);
    },
    [deleteWorkspace]
  );

  const handleTogglePin = useCallback(
    (id: string) => {
      togglePinWorkspace(id);
    },
    [togglePinWorkspace]
  );

  if (!mounted) {
    return (
      <SidebarGroup className="flex h-full min-h-0 flex-col space-y-2 px-1 py-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
        <div className="flex shrink-0 items-center justify-between px-1.5 pb-1 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="font-medium text-[10px] text-muted-foreground tracking-[0.18em] uppercase whitespace-nowrap">
            Workspaces
          </SidebarGroupLabel>
        </div>
        <SidebarWorkspacesSkeleton count={3} />
      </SidebarGroup>
    );
  }

  const isWorkspaceSurface =
    pathname === "/workspace" ||
    pathname?.startsWith("/workspace") ||
    !(
      pathname?.includes("/settings") ||
      pathname?.includes("/dashboard") ||
      pathname?.includes("/kanban") ||
      pathname?.includes("/home")
    );
  const pinnedWorkspaces = workspaces.filter((w) => w.isPinned);
  const regularWorkspaces = workspaces.filter((w) => !w.isPinned);

  return (
    <SidebarGroup className="flex h-full min-h-0 flex-col space-y-3 group-data-[collapsible=icon]:space-y-2 px-1 py-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
      <div className="flex shrink-0 items-center justify-between px-1.5 pb-1.5 pt-1 group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="font-medium text-[10px] text-muted-foreground tracking-[0.18em] uppercase whitespace-nowrap">
          Workspaces
        </SidebarGroupLabel>
      </div>

      <SidebarMenu className="flex min-h-0 flex-1 flex-col space-y-3 group-data-[collapsible=icon]:gap-2.5 group-data-[collapsible=icon]:items-center">
        <SidebarMenuItem className="shrink-0 px-1 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <SidebarMenuButton
            className={cn(
              "group/new-ws relative h-9 w-full justify-start gap-2 rounded-md border border-dashed border-border bg-muted/30 px-2.5 font-medium text-foreground text-xs transition-ui motion-fast outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:border-border",
              "hover:border-border/80 hover:bg-muted/60 hover:text-foreground hover:translate-x-0.5 hover:shadow-xs active:scale-[0.98]"
            )}
            data-tour="create-workspace-btn"
            data-workspace-trigger="new-workspace"
            onClick={(e) => {
              recordGenieTrigger(e.currentTarget);
              onNewWorkspace();
            }}
          >
            <svg
              className="size-3.5 shrink-0 text-muted-foreground transition-transform motion-normal ease-out group-hover/new-ws:rotate-90 group-hover/new-ws:scale-110 group-hover/new-ws:text-foreground"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-left whitespace-nowrap text-foreground group-data-[collapsible=icon]:hidden">
              New Workspace
            </span>
            <kbd className="ml-auto hidden rounded border border-border/80 bg-muted/80 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground md:inline-block group-data-[collapsible=icon]:hidden">
              {formatHotkeyDisplay("mod+n").join("+")}
            </kbd>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {workspaces.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-1.5 px-4 text-center group-data-[collapsible=icon]:hidden">
            <Folder
              aria-hidden="true"
              className="mb-1 size-5 text-subtle stroke-[1.5]"
            />
            <p className="font-medium text-[13px] text-foreground tracking-tight">
              No workspaces yet
            </p>
            <p className="max-w-[170px] text-muted-foreground text-xs leading-relaxed">
              Use New Workspace above to get started.
            </p>
          </div>
        ) : (
          <div className="subtle-scrollbar mt-2 flex-1 min-h-0 overflow-y-auto space-y-5 group-data-[collapsible=icon]:mt-2 group-data-[collapsible=icon]:space-y-3 pr-0.5">
            {pinnedWorkspaces.length > 0 && (
              <div className="space-y-1.5 group-data-[collapsible=icon]:space-y-2.5">
                <div className="select-none px-2 pb-1 font-medium text-[10px] text-muted-foreground tracking-[0.16em] uppercase whitespace-nowrap group-data-[collapsible=icon]:hidden">
                  Pinned
                </div>
                {pinnedWorkspaces.map((ws) => (
                  <WorkspaceItem
                    index={workspaces.findIndex((w) => w.id === ws.id)}
                    isActive={isWorkspaceSurface && ws.id === activeWorkspaceId}
                    isMobile={isMobile}
                    key={ws.id}
                    onAddTerminal={handleAddTerminal}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onRename={handleRename}
                    onSelect={handleSelect}
                    onTogglePin={handleTogglePin}
                    ws={ws}
                  />
                ))}
              </div>
            )}

            {regularWorkspaces.length > 0 && (
              <div className="space-y-1.5 group-data-[collapsible=icon]:space-y-1.5">
                <div className="select-none px-2 pb-1 font-medium text-[10px] text-muted-foreground tracking-[0.16em] uppercase whitespace-nowrap group-data-[collapsible=icon]:hidden">
                  Active
                </div>
                {regularWorkspaces.map((ws) => (
                  <WorkspaceItem
                    index={workspaces.findIndex((w) => w.id === ws.id)}
                    isActive={isWorkspaceSurface && ws.id === activeWorkspaceId}
                    isMobile={isMobile}
                    key={ws.id}
                    onAddTerminal={handleAddTerminal}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onRename={handleRename}
                    onSelect={handleSelect}
                    onTogglePin={handleTogglePin}
                    ws={ws}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
});
