"use client";

import { Settings } from "lucide-react";
import type * as React from "react";
import type { ComponentType } from "react";
import { useState } from "react";
import { NewWorkspaceDialog } from "@/components/common/new-workspace-dialog";
import { Logo } from "@/components/landing/logo";
import { UserNav } from "@/components/navigation/user-nav";
import { WorkspaceNav } from "@/components/navigation/workspace-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/sidebar";
import { navigationData } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { useMounted } from "@/hooks/use-mounted";
import { useLayoutStore } from "@/stores/layout-store";

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

export function AppSidebar({
  pathname,
  navigate,
  LinkComponent = "a",
  ...props
}: AppSidebarProps) {
  const mounted = useMounted();
  const [dialogOpen, setDialogOpen] = useState(false);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);

  if (!mounted) {
    return null;
  }

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader className="flex flex-row items-center justify-between border-border/40 border-b px-3 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
          {/* Interactive [Logo] Hyperion toggle button */}
          <div className="flex flex-1 items-center min-w-0 group-data-[collapsible=icon]:flex-initial group-data-[collapsible=icon]:justify-center">
            <button
              aria-label="Toggle Sidebar"
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-all duration-150 hover:bg-accent/40 active:scale-98 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
              onClick={toggleSidebar}
              type="button"
            >
              <Logo
                className="!size-5.5 shrink-0 object-contain transition-transform duration-150 hover:scale-105"
                size={22}
              />
              <span className="select-none font-medium font-sans text-foreground text-sm tracking-normal whitespace-nowrap group-data-[collapsible=icon]:hidden">
                {siteConfig.name}
              </span>
            </button>
          </div>
          <SidebarTrigger className="size-8 shrink-0 group-data-[collapsible=icon]:hidden" />
        </SidebarHeader>
        <SidebarContent className="py-2 group-data-[collapsible=icon]:py-2">
          <WorkspaceNav
            navigate={navigate}
            onNewWorkspace={() => setDialogOpen(true)}
          />
        </SidebarContent>
        <SidebarFooter className="border-border/40 border-t p-2 group-data-[collapsible=icon]:p-1.5">
          <div className="flex w-full items-center justify-between gap-1.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1.5">
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <UserNav user={navigationData.user} />
            </div>
            <SidebarMenu className="w-auto shrink-0 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                <SidebarMenuButton
                  asChild={true}
                  className="flex size-9 items-center justify-center rounded-lg border border-border/40 bg-background/25 p-0 hover:bg-accent/40 group-data-[collapsible=icon]:size-9"
                  isActive={pathname === "/settings"}
                  size="sm"
                  tooltip="Settings"
                >
                  <LinkComponent
                    href="/settings"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings className="size-4 text-muted-foreground/80 group-hover/menu-button:text-foreground" />
                    <span className="sr-only">Settings</span>
                  </LinkComponent>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </SidebarFooter>
      </Sidebar>
      <NewWorkspaceDialog
        onCreated={() => navigate("/workspace")}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </>
  );
}
