"use client";

import {
  Copy,
  Edit2,
  LayoutGrid,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Terminal,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/sidebar";
import { useMounted } from "@/hooks/use-mounted";
import { cn, formatHotkeyDisplay } from "@/lib/utils";
import { useWorkspaceStore, type Workspace } from "@/stores/workspace-store";

interface WorkspaceNavProps {
  navigate: (path: string) => void;
  onNewWorkspace: () => void;
}

export function WorkspaceNav({ navigate, onNewWorkspace }: WorkspaceNavProps) {
  const mounted = useMounted();
  const { isMobile, setOpenMobile } = useSidebar();
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    deleteWorkspace,
    duplicateWorkspace,
    renameWorkspace,
    togglePinWorkspace,
  } = useWorkspaceStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleSelect = useCallback(
    (id: string) => {
      setActiveWorkspace(id);
      if (isMobile) {
        setOpenMobile(false);
      }
      navigate("/workspace");
    },
    [isMobile, setOpenMobile, navigate, setActiveWorkspace]
  );

  const handleRenameSave = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameWorkspace(id, trimmed);
    }
    setRenamingId(null);
  };

  if (!mounted) {
    return null;
  }

  const pinnedWorkspaces = workspaces.filter((w) => w.isPinned);
  const regularWorkspaces = workspaces.filter((w) => !w.isPinned);

  const renderWorkspaceItem = (ws: Workspace) => {
    const isActive = ws.id === activeWorkspaceId;
    const isMenuOpen = menuOpenId === ws.id;

    return (
      <SidebarMenuItem
        className="group/item relative px-1.5 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        key={ws.id}
      >
        {isActive && (
          <motion.div
            className="absolute inset-x-1.5 inset-y-0 z-0 rounded-lg border border-white/25 bg-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_1.5px_rgba(255,255,255,0.4)] backdrop-blur-xl group-data-[collapsible=icon]:inset-0 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:rounded-lg"
            layoutId="activeWorkspacePill"
            transition={{
              type: "spring",
              stiffness: 450,
              damping: 35,
            }}
          />
        )}

        {isActive && (
          <motion.div
            className="absolute top-1.5 bottom-1.5 left-0 z-20 w-[3px] rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8),0_0_20px_rgba(255,255,255,0.5)] group-data-[collapsible=icon]:-left-1 group-data-[collapsible=icon]:top-2 group-data-[collapsible=icon]:bottom-2"
            layoutId="activeWorkspaceIndicator"
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
          />
        )}

        {renamingId === ws.id ? (
          <div className="relative z-10 flex h-8.5 w-full items-center gap-2 px-3">
            <input
              autoFocus
              className="flex-1 rounded-md border border-white/30 bg-white/10 backdrop-blur-md px-2 py-1 font-sans text-white text-xs outline-none transition-all duration-200 focus:ring-2 focus:ring-white/30"
              onBlur={() => handleRenameSave(ws.id)}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameSave(ws.id);
                } else if (e.key === "Escape") {
                  setRenamingId(null);
                }
              }}
              value={renameValue}
            />
          </div>
        ) : (
          <>
            <button
              className={cn(
                "relative z-10 flex h-8.5 w-full items-center justify-start gap-2 rounded-lg px-2.5 pr-8 font-medium text-xs transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:rounded-lg",
                isActive
                  ? "cursor-default text-white font-semibold"
                  : "text-white/70 hover:bg-white/[0.08] hover:text-white hover:border hover:border-white/15 backdrop-blur-sm active:scale-[0.99]"
              )}
              onClick={() => handleSelect(ws.id)}
              title={ws.name}
              type="button"
            >
              <Terminal
                className={cn(
                  "size-4 shrink-0 transition-colors duration-150",
                  isActive
                    ? "text-white"
                    : "text-white/60 group-hover/item:text-white"
                )}
              />
              <span
                className={cn(
                  "min-w-0 shrink truncate text-xs whitespace-nowrap group-data-[collapsible=icon]:hidden",
                  isActive
                    ? "text-white font-semibold drop-shadow-xs"
                    : "text-white/70 group-hover/item:text-white"
                )}
              >
                {ws.name}
              </span>

              {/* Terminal count pill */}
              <span
                className={cn(
                  "ml-auto flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full px-1.5 font-bold font-mono text-[10px] backdrop-blur-md border transition-all duration-150 group-data-[collapsible=icon]:hidden",
                  isActive
                    ? "bg-white/20 border-white/30 text-white shadow-xs"
                    : "bg-white/5 border-white/15 text-white/70 group-hover/item:bg-white/10 group-hover/item:border-white/25 group-hover/item:text-white"
                )}
              >
                {ws.terminalCount}
              </span>
            </button>

            <DropdownMenu
              onOpenChange={(open) => setMenuOpenId(open ? ws.id : null)}
              open={isMenuOpen}
            >
              <DropdownMenuTrigger asChild={true}>
                <button
                  aria-label="Workspace options"
                  className={cn(
                    "absolute right-2.5 top-1/2 -translate-y-1/2 z-20 flex size-5.5 items-center justify-center rounded-md transition-all duration-150 group-data-[collapsible=icon]:hidden",
                    isActive
                      ? "text-primary-foreground/75 hover:bg-black/15 hover:text-primary-foreground aria-expanded:bg-black/15 aria-expanded:text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
                    isMenuOpen
                      ? "opacity-100"
                      : "opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100 hover:opacity-100 focus-visible:opacity-100"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  type="button"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align={isMobile ? "end" : "start"}
                className="w-48 border-border/60 bg-popover backdrop-blur-xl"
                side={isMobile ? "bottom" : "right"}
              >
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinWorkspace(ws.id);
                    toast.success(
                      ws.isPinned ? "Workspace unpinned" : "Workspace pinned"
                    );
                  }}
                >
                  {ws.isPinned ? (
                    <>
                      <PinOff className="mr-2 size-3.5 text-muted-foreground" />
                      <span>Unpin Workspace</span>
                    </>
                  ) : (
                    <>
                      <Pin className="mr-2 size-3.5 text-muted-foreground" />
                      <span>Pin Workspace</span>
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(ws.id);
                    setRenameValue(ws.name);
                  }}
                >
                  <Edit2 className="mr-2 size-3.5 text-muted-foreground" />
                  <span>Rename</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateWorkspace(ws.id);
                    toast.success("Workspace duplicated successfully");
                  }}
                >
                  <Copy className="mr-2 size-3.5 text-muted-foreground" />
                  <span>Duplicate</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/40" />
                <DropdownMenuItem
                  className="text-[#ff3b5c] focus:bg-[#e50914]/15 focus:text-[#ff3b5c]"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteWorkspace(ws.id);
                    toast.success("Workspace deleted");
                  }}
                >
                  <Trash2 className="mr-2 size-3.5 text-[#ff3b5c]" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <SidebarGroup className="px-2 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-0">
      <div className="flex items-center justify-between px-2 py-1.5 group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="font-semibold text-micro-uppercase text-muted-foreground/60 tracking-wider whitespace-nowrap">
          Workspaces
        </SidebarGroupLabel>
        <button
          className="flex size-5 items-center justify-center rounded text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95"
          onClick={onNewWorkspace}
          title={`New Workspace (${formatHotkeyDisplay("mod+n").join("+")})`}
          type="button"
        >
          <Plus className="size-3.5 transition-transform duration-150 hover:rotate-90" />
        </button>
      </div>

      <SidebarMenu className="mt-1 gap-1.5 group-data-[collapsible=icon]:gap-1.5 group-data-[collapsible=icon]:items-center">
        <SidebarMenuItem className="px-1.5 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <SidebarMenuButton
            className={cn(
              "group/new-ws relative h-8.5 w-full justify-start gap-2 rounded-md border border-dashed border-border/70 bg-background/40 px-2.5 font-medium text-muted-foreground text-xs transition-colors duration-150 ease-out",
              "group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:border-border/60",
              "hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-[0.98]"
            )}
            onClick={onNewWorkspace}
            tooltip={`New Workspace (${formatHotkeyDisplay("mod+n").join("+")})`}
          >
            <Plus className="size-4 shrink-0 transition-transform duration-200 ease-out group-hover/new-ws:rotate-90 group-hover/new-ws:text-primary" />
            <span className="min-w-0 flex-1 truncate text-left whitespace-nowrap group-data-[collapsible=icon]:hidden">
              New Workspace
            </span>
            <kbd className="ml-auto hidden rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/70 group-hover/new-ws:text-primary/70 md:inline-block group-data-[collapsible=icon]:hidden">
              {formatHotkeyDisplay("mod+n").join("+")}
            </kbd>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {workspaces.length === 0 ? (
          <div className="mt-2 flex flex-col items-center justify-center rounded-lg border border-border/20 border-dashed bg-muted/5 px-4 py-10 text-center group-data-[collapsible=icon]:hidden">
            <LayoutGrid className="mb-2 size-6 animate-pulse text-muted-foreground/30" />
            <p className="max-w-[150px] text-[11px] text-muted-foreground/50 leading-normal">
              No workspaces yet. Create one to begin.
            </p>
          </div>
        ) : (
          <div className="mt-2.5 space-y-4 group-data-[collapsible=icon]:mt-1.5 group-data-[collapsible=icon]:space-y-2">
            {pinnedWorkspaces.length > 0 && (
              <div className="space-y-1 group-data-[collapsible=icon]:space-y-1.5">
                <div className="select-none px-3 font-semibold text-micro-uppercase text-muted-foreground/60 tracking-widest whitespace-nowrap group-data-[collapsible=icon]:hidden">
                  Pinned
                </div>
                {pinnedWorkspaces.map(renderWorkspaceItem)}
              </div>
            )}

            {regularWorkspaces.length > 0 && (
              <div className="space-y-1 group-data-[collapsible=icon]:space-y-1.5">
                <div className="select-none px-3 font-semibold text-micro-uppercase text-muted-foreground/60 tracking-widest whitespace-nowrap group-data-[collapsible=icon]:hidden">
                  Active
                </div>
                {regularWorkspaces.map(renderWorkspaceItem)}
              </div>
            )}
          </div>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
