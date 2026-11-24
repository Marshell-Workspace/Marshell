"use client";

import { AccountPanel } from "@workspace/core/components/panels/account-panel";
import { AppearanceSettingsTab } from "@workspace/core/components/settings/appearance-settings-tab";
import { NotificationSettingsTab } from "@workspace/core/components/settings/notification-settings-tab";
import { PerformanceSettingsCard } from "@workspace/core/components/settings/performance-settings-card";
import { SystemHealthCard } from "@workspace/core/components/settings/system-health-card";
import { TutorialsSettingsTab } from "@workspace/core/components/settings/tutorials-settings-tab";
import { WorkspaceSettingsTab } from "@workspace/core/components/settings/workspace-settings-tab";
import {
  type SettingsTab,
  usePanelStore,
} from "@workspace/core/stores/panel-store";
import { useTutorialStore } from "@workspace/core/stores/tutorial-store";
import { DialogPrimitive } from "@workspace/ui/components/dialog";
import {
  GenieModal,
  GenieModalContent,
  useGenieModal,
} from "@workspace/ui/components/genie-modal";
import { cn } from "@workspace/ui/lib/utils";
import {
  Bell,
  CircleUser,
  GraduationCap,
  Monitor,
  Palette,
  Search,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

interface NavItemDef {
  icon: React.ComponentType<{ className?: string }>;
  id: SettingsTab;
  keywords: string[];
  label: string;
}

interface NavGroupDef {
  id: string;
  items: NavItemDef[];
  label: string;
}

const FLAT_NAV_GROUPS: NavGroupDef[] = [
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        id: "account",
        label: "Account",
        icon: CircleUser,
        keywords: [
          "profile",
          "email",
          "avatar",
          "authentication",
          "security",
          "devices",
          "sessions",
          "logout",
        ],
      },
      {
        id: "appearance",
        label: "Appearance",
        icon: Palette,
        keywords: [
          "theme",
          "appearance",
          "light",
          "dark",
          "system",
          "accent",
          "color",
          "custom color",
          "oklch",
        ],
      },
      {
        id: "workspace",
        label: "Workspaces",
        icon: Terminal,
        keywords: [
          "workspace",
          "terminal",
          "shell",
          "powershell",
          "bash",
          "layout",
          "startup",
          "keychain",
          "terminals",
          "font",
          "cursor",
          "scrollback",
          "restore",
        ],
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        keywords: [
          "notifications",
          "sound",
          "desktop notifications",
          "alerts",
          "banners",
          "tasks",
        ],
      },
      {
        id: "tutorials",
        label: "Tutorials",
        icon: GraduationCap,
        keywords: [
          "tutorial",
          "tour",
          "walkthrough",
          "onboarding",
          "guide",
          "help",
          "learn",
        ],
      },
      {
        id: "performance",
        label: "Performance",
        icon: Zap,
        keywords: [
          "eco",
          "battery",
          "hardware",
          "gpu",
          "fps",
          "memory",
          "profiles",
          "rendering",
        ],
      },
    ],
  },
  {
    id: "this-computer",
    label: "This computer",
    items: [
      {
        id: "system",
        label: "System Health",
        icon: Monitor,
        keywords: [
          "diagnostics",
          "system",
          "health",
          "memory",
          "tauri",
          "webview2",
          "cpu",
          "os",
          "pty",
        ],
      },
    ],
  },
];

/** Related pages sit together; a hairline separates each group. */
const NAV_SECTIONS: readonly (readonly SettingsTab[])[] = [
  ["account"],
  ["appearance", "notifications", "workspace", "performance", "tutorials"],
  ["system"],
];

const SETTINGS_NAV_GROUPS: NavGroupDef[] = (() => {
  const allItems = FLAT_NAV_GROUPS.flatMap((group) => group.items);
  const placed = new Set<SettingsTab>(NAV_SECTIONS.flat());
  const groups = NAV_SECTIONS.map((ids, index) => ({
    id: `section-${index}`,
    label: index === 0 ? "Settings" : "",
    items: ids
      .map((id) => allItems.find((item) => item.id === id))
      .filter((item): item is NavItemDef => Boolean(item)),
  }));
  const leftover = allItems.filter((item) => !placed.has(item.id));
  const last = groups.at(-1);
  if (last) {
    last.items.push(...leftover);
  }
  return groups;
})();

export function SettingsView({ onClose }: { onClose?: () => void }) {
  const activeTab = usePanelStore((s) => s.settingsTab);
  const setSettingsTab = usePanelStore((s) => s.setSettingsTab);
  const [searchQuery, setSearchQuery] = useState("");
  const { closeModal, open: isGenieOpen } = useGenieModal();

  const handleClose = () => {
    if (isGenieOpen) {
      closeModal();
    } else if (onClose) {
      onClose();
    }
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return SETTINGS_NAV_GROUPS;
    }
    const q = searchQuery.toLowerCase().trim();
    return SETTINGS_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.keywords.some((kw) => kw.toLowerCase().includes(q))
      ),
    })).filter((group) => group.items.length > 0);
  }, [searchQuery]);

  const renderActiveContent = () => {
    switch (activeTab) {
      case "account":
        return <AccountPanel />;
      case "appearance":
        return <AppearanceSettingsTab />;
      case "workspace":
        return <WorkspaceSettingsTab />;
      case "notifications":
        return <NotificationSettingsTab />;
      case "tutorials":
        return <TutorialsSettingsTab />;
      case "performance":
        return <PerformanceSettingsCard />;
      case "system":
        return <SystemHealthCard />;
      case "general":
        return <AppearanceSettingsTab />;
      default:
        return <AccountPanel />;
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden text-foreground">
      {/* Left Column: Sidebar Navigation */}
      <aside
        className="flex w-48 shrink-0 flex-col border-r border-border bg-sidebar p-3 select-none sm:w-52"
        data-tour="settings-nav"
      >
        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            aria-label="Search settings"
            className="h-9 w-full rounded-lg border border-[var(--search-border)] bg-[var(--search-bg)] pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-ring/50 focus:ring-2 focus:ring-ring/15"
            data-tour="settings-search-input"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            type="text"
            value={searchQuery}
          />
        </div>

        {/* Navigation List */}
        <div className="subtle-scrollbar flex-1 overflow-y-auto pr-0.5">
          {filteredGroups.map((group) => (
            <div
              className="space-y-1 border-border border-t py-3 first:border-t-0 first:pt-0"
              key={group.id}
            >
              {group.label && (
                <div className="px-3 py-1.5 font-medium text-muted-foreground text-xs">
                  {group.label}
                </div>
              )}
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const tourId = `settings-nav-${item.id}`;

                  return (
                    <button
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-xs"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      )}
                      data-settings-tab={item.id}
                      data-tour={tourId}
                      key={item.id}
                      onClick={() => setSettingsTab(item.id)}
                      type="button"
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          isActive
                            ? "text-foreground font-medium"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      {/* Right Column: Content Panel */}
      <main className="relative flex flex-1 flex-col min-w-0 bg-background">
        {onClose && (
          <div className="flex h-12 shrink-0 items-center justify-end px-4">
            <button
              aria-label="Close settings"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={handleClose}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <div
          className={cn(
            "subtle-scrollbar min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pb-8 sm:px-6",
            onClose ? "pt-3" : "pt-6"
          )}
          ref={scrollContainerRef}
        >
          {renderActiveContent()}
        </div>
      </main>
    </div>
  );
}

export function SettingsDialog() {
  const isSettingsOpen = usePanelStore((s) => s.isSettingsOpen);
  const closeSettings = usePanelStore((s) => s.closeSettings);

  const titleId = useId();
  const descId = useId();

  return (
    <GenieModal
      edge="left"
      maxHeight={880}
      maxWidth={1260}
      onOpenChange={(open: boolean) => !open && closeSettings()}
      open={isSettingsOpen}
      triggerSelector='[data-settings-trigger="sidebar-settings"]'
      vhRatio={0.92}
      vwRatio={0.95}
    >
      <GenieModalContent
        aria-describedby={descId}
        aria-labelledby={titleId}
        backdropClassName="bg-black/75 backdrop-blur-xs"
        className="flex overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl focus:outline-hidden"
        onInteractOutside={(e) => {
          const originalTarget = (e.detail as { originalEvent?: Event })
            ?.originalEvent?.target as HTMLElement | null;
          const isSettingsTour =
            useTutorialStore.getState().activeTour === "settings";
          if (
            isSettingsTour ||
            originalTarget?.closest?.(
              "[data-tour-element], [data-tour-id], [data-tour], [data-tour-surface]"
            )
          ) {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          const originalTarget = (e.detail as { originalEvent?: Event })
            ?.originalEvent?.target as HTMLElement | null;
          const isSettingsTour =
            useTutorialStore.getState().activeTour === "settings";
          if (
            isSettingsTour ||
            originalTarget?.closest?.(
              "[data-tour-element], [data-tour-id], [data-tour], [data-tour-surface]"
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <DialogPrimitive.Title className="sr-only" id={titleId}>
          Application Settings
        </DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only" id={descId}>
          Configure Marshell preferences, accounts, appearance, workspaces, and
          system capabilities.
        </DialogPrimitive.Description>

        <SettingsView onClose={closeSettings} />
      </GenieModalContent>
    </GenieModal>
  );
}
