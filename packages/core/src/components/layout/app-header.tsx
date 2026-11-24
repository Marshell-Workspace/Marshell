"use client";

import { NotificationCenter } from "@workspace/core/components/common/notification-center";
import { StaticIcon } from "@workspace/core/components/common/static-icon";
import { WorkspaceModeSwitcher } from "@workspace/core/components/layout/workspace-mode-switcher";
import { formatHotkeyDisplay } from "@workspace/core/lib/utils";
import { useCommandPaletteStore } from "@workspace/core/stores/command-palette-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@workspace/ui/components/breadcrumb";
import { Button } from "@workspace/ui/components/button";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ComponentType, memo } from "react";

interface AppHeaderProps {
  LinkComponent?:
    | ComponentType<{
        href: string;
        children: React.ReactNode;
        onClick?: () => void;
        className?: string;
      }>
    | "a";
  navigate?: (path: string) => void;
  pathname: string;
}

export const AppHeader = memo(function AppHeader({
  pathname,
  LinkComponent = "a",
}: AppHeaderProps) {
  const toggleCommandPalette = useCommandPaletteStore((s) => s.toggle);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const isSettings = pathname === "/settings";
  const isKanban = pathname === "/kanban";
  const showModeSwitcher =
    !(isSettings || isKanban) && Boolean(activeWorkspace);
  const hotkeyDisplay = formatHotkeyDisplay("mod+k").join("+");

  return (
    <header className="relative flex h-10.5 shrink-0 items-center justify-between gap-2 bg-[var(--topbar-bg)] border-b border-[var(--topbar-border)] px-2.5 sm:px-3 md:px-4">
      {/* Left section: mobile sidebar trigger + breadcrumbs */}
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 sm:gap-2.5",
          showModeSwitcher ? "flex-1 basis-0" : "flex-1"
        )}
      >
        <SidebarTrigger className="size-8 shrink-0 md:hidden" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex items-center gap-1.5 text-xs flex-nowrap leading-none">
            <BreadcrumbItem className="shrink-0 hidden sm:inline-flex items-center leading-none">
              {isSettings || isKanban ? (
                <LinkComponent
                  className="font-medium text-xs text-muted-foreground transition-colors motion-fast hover:text-foreground whitespace-nowrap leading-none"
                  href="/workspace"
                >
                  Workspaces
                </LinkComponent>
              ) : (
                <span className="font-medium text-xs text-muted-foreground whitespace-nowrap leading-none">
                  Workspaces
                </span>
              )}
            </BreadcrumbItem>

            {isSettings && (
              <>
                <ChevronRight className="size-3 text-subtle shrink-0 hidden sm:block" />
                <BreadcrumbItem className="min-w-0 inline-flex items-center leading-none">
                  <BreadcrumbPage className="font-semibold text-foreground text-xs tracking-tight truncate leading-none">
                    Settings
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}

            {isKanban && (
              <>
                <ChevronRight className="size-3 text-subtle shrink-0 hidden sm:block" />
                <BreadcrumbItem className="min-w-0 inline-flex items-center leading-none">
                  <BreadcrumbPage className="font-semibold text-foreground text-xs tracking-tight truncate leading-none">
                    Task Board
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}

            {showModeSwitcher && activeWorkspace && (
              <>
                <ChevronRight className="size-3 text-subtle shrink-0 hidden sm:block" />
                <BreadcrumbItem className="min-w-0 inline-flex items-center truncate leading-normal">
                  <BreadcrumbPage className="font-semibold text-foreground text-xs tracking-tight truncate inline-flex items-center leading-normal py-0.5">
                    <AnimatePresence initial={false} mode="wait">
                      <motion.span
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center truncate max-w-[100px] sm:max-w-[160px] md:max-w-[220px] lg:max-w-none leading-normal py-0.5"
                        exit={{ opacity: 0, y: -2 }}
                        initial={{ opacity: 0, y: 2 }}
                        key={activeWorkspace.id}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                      >
                        {activeWorkspace.name}
                      </motion.span>
                    </AnimatePresence>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Middle section: compact Workspace Mode Switcher (in normal flow, cannot overlap left or right) */}
      {showModeSwitcher && (
        <div
          className="flex shrink-0 items-center justify-center"
          data-tour="mode-switcher"
        >
          <WorkspaceModeSwitcher />
        </div>
      )}

      {/* Right section: tools, settings, alerts */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-end gap-1",
          showModeSwitcher && "flex-1 basis-0"
        )}
      >
        <Button
          className="flex rounded-lg border-0 text-muted-foreground transition-ui motion-fast hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
          onClick={toggleCommandPalette}
          size="icon"
          title={`Search or Command Palette (${hotkeyDisplay})`}
          variant="ghost"
        >
          <StaticIcon
            alt="Search"
            className="size-4.5 object-contain icon-ink"
            src="/wired-outline-19-magnifier-static.png"
          />
        </Button>
        <div data-tour="notifications-btn">
          <NotificationCenter />
        </div>
      </div>
    </header>
  );
});
