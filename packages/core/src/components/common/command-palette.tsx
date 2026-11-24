"use client";

import { CreateWorkspaceIcon } from "@workspace/core/components/common/custom-icons";
import { hotkeys } from "@workspace/core/config/hotkeys";
import { useDrawerHistory } from "@workspace/core/hooks/use-drawer-history";
import { formatHotkeyDisplay } from "@workspace/core/lib/utils";
import { useCommandPaletteStore } from "@workspace/core/stores/command-palette-store";
import { useHotkeysDialogStore } from "@workspace/core/stores/hotkeys-store";
import { useLayoutStore } from "@workspace/core/stores/layout-store";
import { usePanelStore } from "@workspace/core/stores/panel-store";
import { useTutorialStore } from "@workspace/core/stores/tutorial-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { useTranslations } from "@workspace/i18n";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@workspace/ui/components/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import { Kbd } from "@workspace/ui/components/kbd";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { cn } from "@workspace/ui/lib/utils";
import {
  CornerDownLeftIcon,
  Keyboard,
  MoveDown,
  MoveUp,
  PanelLeft,
  Settings,
  Terminal,
} from "lucide-react";
import React, { useCallback } from "react";

function CommandMenuItem({
  children,
  className,
  ...props
}: React.ComponentProps<typeof CommandItem> & {
  "data-selected"?: string;
  "aria-selected"?: string;
}) {
  return (
    <CommandItem
      className={cn(
        "relative h-9 gap-3 rounded-md px-3! font-medium text-[13px] text-foreground transition-colors data-selected:bg-accent [&>[data-slot=command-item-check]]:hidden [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-muted-foreground data-selected:[&_svg]:text-foreground",
        "data-selected:before:absolute data-selected:before:inset-y-2 data-selected:before:left-0 data-selected:before:w-0.5 data-selected:before:rounded-full data-selected:before:bg-primary",
        className
      )}
      {...props}
    >
      {children}
    </CommandItem>
  );
}

export function CommandPalette({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const t = useTranslations("CommandPalette");
  const { isOpen, close } = useCommandPaletteStore();
  const isMobile = useIsMobile();
  // Only the mobile drawer needs a history entry for the Back gesture; the
  // desktop dialog must not touch history (its popstate echo closed it).
  useDrawerHistory(isOpen && isMobile, close);
  const toggleHotkeysDialog = useHotkeysDialogStore((s) => s.toggle);
  const [search, setSearch] = React.useState("");

  // Reset the query whenever the palette closes so it reopens clean.
  React.useEffect(() => {
    if (!isOpen) {
      setSearch("");
    }
  }, [isOpen]);

  // Workspaces access
  const { workspaces, activeWorkspaceId, setActiveWorkspace } =
    useWorkspaceStore();

  const runCommand = useCallback(
    (command: () => unknown) => {
      close();
      setTimeout(() => {
        command();
      }, 300);
    },
    [close]
  );

  const getKeysDisplay = (id: string) => {
    const hk = hotkeys.find((h) => h.id === id);
    if (!hk) {
      return null;
    }
    const keys = formatHotkeyDisplay(hk.keys);
    const isSequence = hk.keys.includes(">");
    return (
      <CommandShortcut className="ml-auto hidden items-center gap-1 md:flex">
        {keys.map((key, i) => (
          <React.Fragment key={key}>
            <Kbd>{key}</Kbd>
            {isSequence && i < keys.length - 1 && (
              <span className="mx-1.5 font-mono text-[10px] text-muted-foreground opacity-70">
                {t("then")}
              </span>
            )}
          </React.Fragment>
        ))}
      </CommandShortcut>
    );
  };

  const groupClasses = "p-0! **:[[cmdk-group-heading]]:scroll-mt-16";

  const paletteContent = (
    <>
      <Command
        className={cn(
          "min-h-0 flex-1 rounded-none border-0 bg-transparent p-0 shadow-none backdrop-blur-none",
          isMobile && "h-full"
        )}
      >
        <CommandInput
          autoFocus={true}
          onValueChange={setSearch}
          placeholder="Type a command or search workspaces..."
          value={search}
        />
        <CommandList
          className={cn(
            "no-scrollbar scroll-pt-1.5 scroll-pb-1 p-2",
            isMobile
              ? "max-h-none min-h-0 flex-1"
              : "max-h-[min(60vh,440px)] min-h-0"
          )}
        >
          {/* cmdk reports 0 matches until items register on mount, which
              flashed "No results" on open. Only render it once searching. */}
          {search.trim().length > 0 && (
            <CommandEmpty className="py-8 text-center text-muted-foreground text-sm">
              {t("noResults")}
            </CommandEmpty>
          )}

          <CommandGroup className={groupClasses} heading="Workspaces">
            <CommandMenuItem
              onSelect={() => {
                close();
                useTutorialStore.getState().setCreateWorkspaceDialogOpen(true);
              }}
            >
              <CreateWorkspaceIcon className="size-4" />
              <span>Create New Workspace</span>
              {getKeysDisplay("new-workspace")}
            </CommandMenuItem>

            {workspaces.map((ws) => (
              <CommandMenuItem
                key={ws.id}
                onSelect={() =>
                  runCommand(() => {
                    setActiveWorkspace(ws.id);
                    navigate("/workspace");
                  })
                }
              >
                <Terminal className="size-4" />
                <span className="truncate">{ws.name}</span>
                {ws.id === activeWorkspaceId && (
                  <span className="ml-auto shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-medium text-[10px] text-[var(--accent-ink)]">
                    Active
                  </span>
                )}
              </CommandMenuItem>
            ))}
          </CommandGroup>

          <CommandSeparator className="my-1.5" />

          <CommandGroup className={groupClasses} heading={t("general")}>
            {!isMobile && (
              <CommandMenuItem
                onSelect={() =>
                  runCommand(() => useLayoutStore.getState().toggleSidebar())
                }
              >
                <PanelLeft />
                <span>{t("toggleSidebar")}</span>
                {getKeysDisplay("toggle-sidebar")}
              </CommandMenuItem>
            )}

            {!isMobile && (
              <CommandMenuItem
                onSelect={() => runCommand(() => toggleHotkeysDialog())}
              >
                <Keyboard />
                <span>{t("showHotkeys")}</span>
                {getKeysDisplay("show-hotkeys")}
              </CommandMenuItem>
            )}

            <CommandMenuItem
              onSelect={() =>
                runCommand(() =>
                  usePanelStore.getState().openSettings("account")
                )
              }
            >
              <Settings />
              <span>Settings</span>
              {getKeysDisplay("go-settings")}
            </CommandMenuItem>
          </CommandGroup>
        </CommandList>
      </Command>

      <div className="hidden h-10 shrink-0 items-center justify-between border-border border-t px-4 font-medium text-[11px] text-subtle md:flex">
        <div className="flex items-center gap-2">
          <Kbd>
            <MoveUp />
          </Kbd>
          <Kbd>
            <MoveDown />
          </Kbd>
          <span>{t("navigate")}</span>
          <Kbd>
            <CornerDownLeftIcon />
          </Kbd>
          <span>{t("openOrSelect")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Kbd>Esc</Kbd>
          <span>{t("close")}</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {isMobile ? (
        <Drawer onOpenChange={(open) => !open && close()} open={isOpen}>
          <DrawerContent
            className="h-[96dvh] overflow-hidden"
            onOpenAutoFocus={(e: Event) => e.preventDefault()}
          >
            <DrawerHeader className="sr-only">
              <DrawerTitle>{t("commandPalette")}</DrawerTitle>
              <DrawerDescription>{t("search")}</DrawerDescription>
            </DrawerHeader>
            {paletteContent}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog onOpenChange={(open) => !open && close()} open={isOpen}>
          <DialogContent
            className="top-[14%] flex translate-y-0 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-popover p-0 shadow-xl backdrop-blur-none sm:max-w-xl"
            showCloseButton={false}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{t("commandPalette")}</DialogTitle>
              <DialogDescription>{t("search")}</DialogDescription>
            </DialogHeader>
            {paletteContent}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
