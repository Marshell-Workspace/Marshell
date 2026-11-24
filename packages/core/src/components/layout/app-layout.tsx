"use client";

import { TutorialAutoStart } from "@workspace/core/components/common/tutorial-auto-start";
import { TutorialOverlay } from "@workspace/core/components/common/tutorial-overlay";
import { AppHeader } from "@workspace/core/components/layout/app-header";
import { AppSidebar } from "@workspace/core/components/layout/app-sidebar";
import { WorkspaceDialogs } from "@workspace/core/components/layout/workspace-dialogs";
import { PanelManager } from "@workspace/core/components/panels/panel-manager";
import { useAppHotkeys } from "@workspace/core/hooks/use-app-hotkeys";
import { useWorkspaceShortcuts } from "@workspace/core/hooks/use-workspace-shortcuts";
import { batteryManager } from "@workspace/core/lib/hardware/battery-manager";
import { visibilityCoordinator } from "@workspace/core/lib/hardware/visibility-manager";
import { MOTION_TRANSITIONS } from "@workspace/core/lib/motion-profile";
import {
  applyAccent,
  applyContrast,
  applyTheme,
} from "@workspace/core/lib/theme";
import { useGeneralSettingsStore } from "@workspace/core/stores/general-settings-store";
import { useKanbanStore } from "@workspace/core/stores/kanban-store";
import { useLayoutStore } from "@workspace/core/stores/layout-store";
import { usePerformanceStore } from "@workspace/core/stores/performance-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar";
import { Toaster } from "@workspace/ui/components/sonner";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { MotionConfig } from "motion/react";
import { type ComponentType, type ReactNode, useEffect } from "react";
import { toast } from "sonner";

interface AppLayoutProps {
  children: ReactNode;
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

function HotkeysRegistrar({ navigate }: { navigate: (path: string) => void }) {
  useAppHotkeys({ navigate });
  useWorkspaceShortcuts({ navigate });
  return null;
}

/**
 * System Resource Integrator:
 * Synchronizes hardware battery status and page visibility with the Zustand performance store.
 * Automatically downshifts to Eco on low battery (<20%) to preserve device runtime, and
 * restores user's preferred tier when plugged back in.
 */
function SystemResourceIntegrator() {
  const initTier = usePerformanceStore((s) => s.initTier);
  const onBatteryChange = usePerformanceStore((s) => s.onBatteryChange);
  const onVisibilityChange = usePerformanceStore((s) => s.onVisibilityChange);

  useEffect(() => {
    initTier();
  }, [initTier]);

  useEffect(() => {
    const unsubBattery = batteryManager.subscribe((status) => {
      onBatteryChange(status);
    });
    const unsubVisibility = visibilityCoordinator.subscribe((status) => {
      onVisibilityChange(status);
    });

    if (typeof window !== "undefined") {
      (window as unknown as { toast?: typeof toast }).toast = toast;
    }

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.(
          '[data-workspace-item], [data-slot="context-menu-trigger"], [data-context-menu-trigger], [data-radix-menu-content]'
        )
      ) {
        return;
      }
      e.preventDefault();
    };

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e?.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason?.message || String(reason || "");
      if (
        message.includes("resource id") ||
        message.includes("invalid") ||
        message.includes("The resource id") ||
        message.includes("ResourceNotFound") ||
        message.includes("Request cancelled")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation?.();
        e.stopPropagation?.();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("contextmenu", handleContextMenu, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      unsubBattery();
      unsubVisibility();
      window.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("contextmenu", handleContextMenu, true);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
    };
  }, [onBatteryChange, onVisibilityChange]);

  return null;
}

function KanbanWorkspaceSync() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  useEffect(() => {
    if (activeWorkspaceId) {
      useKanbanStore.getState().setActiveWorkspaceId(activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  return null;
}

/** All resource profiles share motion; reduced motion follows the OS preference. */
function PerformanceMotionConfig({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={MOTION_TRANSITIONS.balanced}>
      {children}
    </MotionConfig>
  );
}

function ThemeSynchronizer() {
  const theme = useGeneralSettingsStore((s) => s.theme);
  const accent = useGeneralSettingsStore((s) => s.accent);
  const contrast = useGeneralSettingsStore((s) => s.contrast);
  const customAccentHex = useGeneralSettingsStore((s) => s.customAccentHex);

  useEffect(() => {
    applyAccent(accent || "violet", customAccentHex);
  }, [accent, customAccentHex]);

  useEffect(() => {
    applyContrast(contrast);
  }, [contrast]);

  useEffect(() => {
    applyTheme(theme);

    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const currentTheme = useGeneralSettingsStore.getState().theme;
      if (currentTheme === "system") {
        applyTheme("system");
      }
    };

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [theme]);

  return null;
}

function ConnectedSidebarProvider({ children }: { children: ReactNode }) {
  const isSidebarOpen = useLayoutStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useLayoutStore((s) => s.setSidebarOpen);

  return (
    <SidebarProvider
      className="h-screen bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] relative overflow-hidden"
      onOpenChange={setSidebarOpen}
      open={isSidebarOpen}
    >
      <div className="relative z-10 flex h-full w-full min-w-0">{children}</div>
    </SidebarProvider>
  );
}

export function AppLayout({
  children,
  pathname,
  navigate,
  LinkComponent,
}: AppLayoutProps) {
  return (
    <TooltipProvider>
      <PerformanceMotionConfig>
        <ThemeSynchronizer />
        <SystemResourceIntegrator />
        <KanbanWorkspaceSync />
        <ConnectedSidebarProvider>
          <HotkeysRegistrar navigate={navigate} />
          <AppSidebar
            LinkComponent={LinkComponent}
            navigate={navigate}
            pathname={pathname}
          />
          <SidebarInset className="flex min-w-0 flex-col bg-transparent">
            <AppHeader
              LinkComponent={LinkComponent}
              navigate={navigate}
              pathname={pathname}
            />
            <div className="flex flex-1 flex-col overflow-hidden">
              {children}
            </div>
          </SidebarInset>
        </ConnectedSidebarProvider>
        <WorkspaceDialogs navigate={navigate} />
        <PanelManager />
        <Toaster />
        {/* Tutorial system — auto-starts for new users, overlay renders on top of everything */}
        <TutorialAutoStart />
        <TutorialOverlay />
      </PerformanceMotionConfig>
    </TooltipProvider>
  );
}
