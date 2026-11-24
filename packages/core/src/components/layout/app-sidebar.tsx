"use client";

import { NewWorkspaceDialog } from "@workspace/core/components/common/new-workspace-dialog";
import { SidebarFooterSkeleton } from "@workspace/core/components/common/skeleton-composites";
import { UserAvatar } from "@workspace/core/components/common/user-avatar";
import {
  ActiveRail,
  WorkspaceNav,
} from "@workspace/core/components/navigation/workspace-nav";
import { siteConfig } from "@workspace/core/config/site";
import { useMounted } from "@workspace/core/hooks/use-mounted";
import { useAuthStore } from "@workspace/core/stores/auth-store";
import { useLayoutStore } from "@workspace/core/stores/layout-store";
import { usePanelStore } from "@workspace/core/stores/panel-store";
import { useTutorialStore } from "@workspace/core/stores/tutorial-store";
import {
  MAX_TERMINALS_PER_WORKSPACE,
  useWorkspaceStore,
} from "@workspace/core/stores/workspace-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { recordGenieTrigger } from "@workspace/ui/lib/genie-motion";
import { cn } from "@workspace/ui/lib/utils";
import {
  Copy,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Terminal,
  Trash2,
} from "lucide-react";
import type * as React from "react";
import { type ComponentType, memo, useEffect, useRef, useState } from "react";

export type CollapsedLogoVisualState = "marshell" | "expand" | "branding";

export function getCollapsedLogoVisualState({
  sidebarOpen,
  logoHovered,
}: {
  sidebarOpen: boolean;
  logoHovered: boolean;
}): CollapsedLogoVisualState {
  if (sidebarOpen) {
    return "branding";
  }

  return logoHovered ? "expand" : "marshell";
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  LinkComponent?:
    | ComponentType<{
        href: string;
        children: React.ReactNode;
        onClick?: () => void;
        className?: string;
      }>
    | "a";
  navigate: (path: string) => void;
  pathname: string;
}

function AppSidebarInner({
  navigate,
  setDialogOpen,
  pathname,
}: {
  navigate: (path: string) => void;
  setDialogOpen: (open: boolean) => void;
  pathname?: string;
}) {
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const setSidebarOpen = useLayoutStore((s) => s.setSidebarOpen);
  const { open } = useSidebar();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const authSession = useAuthStore((s) => s.session);
  const displayName =
    authSession?.name ||
    authSession?.username ||
    authSession?.email?.split("@")[0] ||
    "Developer";
  const displayEmail = authSession?.email || "developer@marshell.dev";
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const collapsedTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const trigger = collapsedTriggerRef.current;

    if (!open && trigger && trigger.matches(":hover")) {
      setIsLogoHovered(true);
      return;
    }

    if (!open) {
      setIsLogoHovered(false);
    }
  }, [open]);

  const logoVisualState = getCollapsedLogoVisualState({
    sidebarOpen: open,
    logoHovered: isLogoHovered,
  });

  const showCollapsedExpandIcon = !open && isLogoHovered;
  const isSettingsOpen = usePanelStore((s) => s.isSettingsOpen);
  const isSettingsActive = isSettingsOpen || pathname?.includes("/settings");
  const isWorkspaceSurface =
    pathname === "/workspace" ||
    pathname?.startsWith("/workspace") ||
    !(
      pathname?.includes("/settings") ||
      pathname?.includes("/dashboard") ||
      pathname?.includes("/kanban") ||
      pathname?.includes("/home")
    );

  const handleEmptyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!open) {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.("button, a, input, select, textarea, [role='button']")
      ) {
        return;
      }
      setSidebarOpen(true);
    }
  };

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden bg-sidebar border-r border-sidebar-border",
        !open && "cursor-pointer"
      )}
      data-tour="sidebar"
      onClick={handleEmptyClick}
    >
      <div className="relative z-10 flex h-full w-full flex-col">
        <SidebarHeader className="flex h-10.5 flex-row items-center justify-between px-3 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
          {open ? (
            <>
              {/* When sidebar is open: Logo + Site name as branding (non-closing), user clicks sidebar trigger to close */}
              <div className="flex flex-1 items-center gap-2.5 min-w-0 px-1.5 py-1 text-left group-data-[collapsible=icon]:hidden">
                <span
                  className="size-5 shrink-0 inline-flex items-center justify-center"
                  data-tour-logo-target
                >
                  <img
                    alt="Marshell"
                    className="size-5 shrink-0 object-contain drop-shadow-xs marshell-logo-dark"
                    src="/main_logo.png"
                  />
                  <img
                    alt="Marshell"
                    className="size-5 shrink-0 object-contain drop-shadow-xs marshell-logo-light"
                    src="/main_logo_light.png"
                  />
                </span>
                <span className="select-none font-semibold font-sans text-foreground text-[15px] tracking-tight whitespace-nowrap">
                  {siteConfig.name}
                </span>
              </div>
              {/* Custom close sidebar icon */}
              <button
                aria-label="Close Sidebar"
                className="size-8 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground transition-colors motion-fast hover:bg-muted hover:text-foreground group-data-[collapsible=icon]:hidden cursor-pointer"
                onClick={toggleSidebar}
                type="button"
              >
                <svg
                  className="size-4"
                  color="currentColor"
                  fill="none"
                  height="24"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                  width="24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M13 3H11C7.22876 3 5.34315 3 4.17157 4.17157C3 5.34315 3 7.22876 3 11V13C3 16.7712 3 18.6569 4.17157 19.8284C5.34315 21 7.22876 21 11 21H13C16.7712 21 18.6569 21 19.8284 19.8284C21 18.6569 21 16.7712 21 13V11C21 7.22876 21 5.34315 19.8284 4.17157C18.6569 3 16.7712 3 13 3Z" />
                  <path d="M9 3V21" />
                </svg>
              </button>
            </>
          ) : (
            /* When sidebar is closed: only the centered logo button renders; on hover it smoothly crossfades to the sidebar icon; on click it opens */
            <button
              aria-label="Open Sidebar"
              className="group/logo-btn relative flex size-9 cursor-pointer items-center justify-center rounded-lg transition-colors motion-fast hover:bg-accent/40 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-visual-state={logoVisualState}
              onClick={toggleSidebar}
              onPointerEnter={() => setIsLogoHovered(true)}
              onPointerLeave={() => setIsLogoHovered(false)}
              ref={collapsedTriggerRef}
              type="button"
            >
              <div
                className={cn(
                  "flex items-center justify-center transition-[opacity,transform] motion-fast ease-standard",
                  showCollapsedExpandIcon
                    ? "scale-75 opacity-0 pointer-events-none"
                    : "scale-100 opacity-100 pointer-events-auto"
                )}
              >
                <img
                  alt="Marshell"
                  className="size-4.5 shrink-0 object-contain drop-shadow-xs marshell-logo-dark"
                  src="/main_logo.png"
                />
                <img
                  alt="Marshell"
                  className="size-4.5 shrink-0 object-contain drop-shadow-xs marshell-logo-light"
                  src="/main_logo_light.png"
                />
              </div>

              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-[opacity,transform] motion-fast ease-standard",
                  showCollapsedExpandIcon
                    ? "scale-100 opacity-100 pointer-events-auto"
                    : "scale-75 opacity-0 pointer-events-none"
                )}
              >
                <svg
                  className="size-4 text-foreground"
                  color="currentColor"
                  fill="none"
                  height="24"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                  width="24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124Z"
                    strokeLinejoin="round"
                  />
                  <path d="M15 2.5L15 21.5" />
                </svg>
              </div>
            </button>
          )}
        </SidebarHeader>
        <SidebarContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-1 group-data-[collapsible=icon]:overflow-hidden">
          {open ? (
            <WorkspaceNav
              navigate={navigate}
              onNewWorkspace={() => setDialogOpen(true)}
              pathname={pathname}
            />
          ) : (
            <div className="flex h-full min-h-0 w-(--sidebar-width-icon) shrink-0 flex-1 flex-col items-center gap-3 px-0 py-3 overflow-hidden">
              <Tooltip>
                <TooltipTrigger asChild={true}>
                  <button
                    aria-label="New Workspace"
                    className="group/new-ws-collapsed flex size-9 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar text-muted-foreground transition-ui motion-fast hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    data-tour="create-workspace-btn"
                    data-workspace-trigger="new-workspace-collapsed"
                    onClick={(e) => {
                      recordGenieTrigger(e.currentTarget);
                      setDialogOpen(true);
                    }}
                    type="button"
                  >
                    <svg
                      className="size-4 text-muted-foreground transition-transform motion-normal ease-out group-hover/new-ws-collapsed:rotate-90 group-hover/new-ws-collapsed:scale-125 group-hover/new-ws-collapsed:text-sidebar-foreground"
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
                  </button>
                </TooltipTrigger>
                <TooltipContent align="center" side="right">
                  New Workspace
                </TooltipContent>
              </Tooltip>

              <div className="subtle-scrollbar flex min-h-0 flex-1 w-full flex-col items-center gap-2.5 overflow-x-hidden overflow-y-auto py-1 pb-2">
                {workspaces.map((ws) => {
                  const isActive =
                    isWorkspaceSurface && ws.id === activeWorkspaceId;

                  return (
                    <ContextMenu key={ws.id}>
                      <ContextMenuTrigger asChild={true}>
                        <Tooltip>
                          <TooltipTrigger asChild={true}>
                            <button
                              aria-label={ws.name}
                              className={cn(
                                "relative flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors motion-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                                isActive
                                  ? "border-transparent bg-transparent text-foreground"
                                  : "border-transparent bg-transparent text-muted-foreground hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground"
                              )}
                              onClick={() => {
                                setActiveWorkspace(ws.id);
                                useWorkspaceStore
                                  .getState()
                                  .setActiveView("terminals");
                                navigate("/workspace");
                              }}
                              type="button"
                            >
                              <Terminal className="size-4 shrink-0" />
                              {isActive && (
                                <ActiveRail className="inset-y-2 left-0" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent align="center" side="right">
                            {ws.name}
                          </TooltipContent>
                        </Tooltip>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-52 border-border/60 bg-popover backdrop-blur-xl">
                        <ContextMenuItem
                          onClick={() => {
                            useWorkspaceStore
                              .getState()
                              .togglePinWorkspace(ws.id);
                          }}
                        >
                          {ws.isPinned ? (
                            <>
                              <PinOff className="mr-2 size-3.5 text-muted-foreground" />
                              <span>Unpin Workspace</span>
                            </>
                          ) : (
                            <>
                              <Pin className="mr-2 size-3.5" />
                              <span>Pin Workspace</span>
                            </>
                          )}
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            setSidebarOpen(true);
                            setActiveWorkspace(ws.id);
                          }}
                        >
                          <Pencil className="mr-2 size-3.5" />
                          <span>Rename</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          disabled={
                            ws.panes.length >= MAX_TERMINALS_PER_WORKSPACE
                          }
                          onClick={() => {
                            useWorkspaceStore.getState().addTerminal(ws.id);
                          }}
                        >
                          <Plus className="mr-2 size-3.5 text-muted-foreground" />
                          <span>Add Terminal</span>
                          <span className="ml-auto mr-1 font-mono text-[10px] text-muted-foreground/60">
                            {ws.panes.length}/{MAX_TERMINALS_PER_WORKSPACE}
                          </span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            useWorkspaceStore
                              .getState()
                              .duplicateWorkspace(ws.id);
                          }}
                        >
                          <Copy className="mr-2 size-3.5" />
                          <span>Duplicate</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="bg-border/40" />
                        <ContextMenuItem
                          className="text-[#ff3b5c] focus:bg-[#e50914]/15 focus:text-[#ff3b5c]"
                          onClick={() => {
                            useWorkspaceStore.getState().deleteWorkspace(ws.id);
                          }}
                        >
                          <Trash2 className="mr-2 size-3.5 text-[#ff3b5c]" />
                          <span>Delete</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            </div>
          )}
        </SidebarContent>
        <SidebarFooter className="shrink-0 px-2 pb-2 pt-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-2 group-data-[collapsible=icon]:pb-3 group-data-[collapsible=icon]:overflow-hidden">
          {open ? (
            <div className="flex w-full flex-col gap-1.5">
              <button
                aria-label="Settings"
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors motion-fast hover:bg-muted/60 active:scale-[0.99] cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isSettingsActive &&
                    "bg-muted/60 border border-[var(--sidebar-active-border)]"
                )}
                data-settings-trigger="sidebar-settings"
                data-tour="sidebar-settings-btn"
                onClick={(e) => {
                  recordGenieTrigger(e.currentTarget);
                  usePanelStore.getState().openSettings("account");
                }}
                type="button"
              >
                <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                  <UserAvatar className="size-7" />
                </div>
                <div className="flex flex-1 flex-col text-left leading-tight min-w-0">
                  <span className="truncate font-semibold text-foreground text-xs font-sans">
                    {displayName}
                  </span>
                  <span className="truncate text-[10.5px] text-muted-foreground font-sans">
                    {displayEmail}
                  </span>
                </div>
              </button>
            </div>
          ) : (
            <div className="flex w-full flex-col items-center justify-center gap-2 pb-1 overflow-x-hidden">
              <Tooltip>
                <TooltipTrigger asChild={true}>
                  <button
                    aria-label="Settings"
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full border transition-ui motion-fast cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      isSettingsActive
                        ? "border-[var(--sidebar-active-border)] bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-icon)]"
                        : "border-transparent text-foreground/80 hover:border-border/60 hover:bg-accent/40 hover:text-foreground active:scale-95"
                    )}
                    data-settings-trigger="sidebar-settings"
                    data-tour="sidebar-settings-btn"
                    onClick={(e) => {
                      recordGenieTrigger(e.currentTarget);
                      usePanelStore.getState().openSettings("account");
                    }}
                    type="button"
                  >
                    <UserAvatar className="size-9 [&_[data-slot=avatar-fallback]]:text-[13px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent align="center" side="right">
                  Settings (
                  {typeof navigator !== "undefined" &&
                  /Mac|iPod|iPhone|iPad/i.test(
                    navigator.platform || navigator.userAgent
                  )
                    ? "⌘,"
                    : "Ctrl+,"}
                  )
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </SidebarFooter>
      </div>
    </div>
  );
}

export const AppSidebar = memo(function AppSidebar({
  pathname,
  navigate,
  LinkComponent = "a",
  ...props
}: AppSidebarProps) {
  const mounted = useMounted();
  const isCreateWorkspaceDialogOpen = useTutorialStore(
    (s) => s.isCreateWorkspaceDialogOpen
  );
  const setCreateWorkspaceDialogOpen = useTutorialStore(
    (s) => s.setCreateWorkspaceDialogOpen
  );

  if (!mounted) {
    return (
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader className="flex h-10.5 flex-row items-center justify-between px-3 py-0">
          <div className="flex flex-1 items-center gap-2.5 min-w-0 px-1.5 py-1">
            <SidebarFooterSkeleton />
          </div>
        </SidebarHeader>
      </Sidebar>
    );
  }

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <AppSidebarInner
          navigate={navigate}
          pathname={pathname}
          setDialogOpen={setCreateWorkspaceDialogOpen}
        />
      </Sidebar>
      <NewWorkspaceDialog
        navigate={navigate}
        onCreated={() => {
          useWorkspaceStore.getState().setActiveView("terminals");
          navigate("/workspace");
        }}
        onOpenChange={setCreateWorkspaceDialogOpen}
        open={isCreateWorkspaceDialogOpen}
      />
    </>
  );
});
