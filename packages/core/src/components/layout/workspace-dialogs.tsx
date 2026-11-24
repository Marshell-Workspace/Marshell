"use client";
import { navigationData } from "@workspace/core/config/navigation";
import { useCommandPaletteStore } from "@workspace/core/stores/command-palette-store";
import { useHotkeysDialogStore } from "@workspace/core/stores/hotkeys-store";
import { usePanelStore } from "@workspace/core/stores/panel-store";
import { useProfileDrawerStore } from "@workspace/core/stores/profile-drawer-store";
import { lazy, Suspense, useEffect, useState } from "react";

const SettingsDialog = lazy(() =>
  import("@workspace/core/components/settings/settings-dialog").then(
    (module) => ({ default: module.SettingsDialog })
  )
);
const CommandPalette = lazy(() =>
  import("@workspace/core/components/common/command-palette").then(
    (module) => ({ default: module.CommandPalette })
  )
);
const HotkeysDialog = lazy(() =>
  import("@workspace/core/components/common/hotkeys-dialog").then((module) => ({
    default: module.HotkeysDialog,
  }))
);
const ProfileDrawer = lazy(() =>
  import("@workspace/core/components/common/profile-drawer").then((module) => ({
    default: module.ProfileDrawer,
  }))
);
function useHasOpened(open: boolean) {
  const [opened, setOpened] = useState(open);
  useEffect(() => {
    if (open) {
      setOpened(true);
    }
  }, [open]);
  return open || opened;
}
/** Closed dialogs do not download/parse their page trees during startup.
 * Keep them mounted after first use so close animations and local state survive. */
export function WorkspaceDialogs({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const settings = useHasOpened(usePanelStore((s) => s.isSettingsOpen));
  const command = useHasOpened(useCommandPaletteStore((s) => s.isOpen));
  const hotkeys = useHasOpened(useHotkeysDialogStore((s) => s.isOpen));
  const profile = useHasOpened(useProfileDrawerStore((s) => s.isOpen));
  return (
    <Suspense fallback={null}>
      {settings && <SettingsDialog />}
      {command && <CommandPalette navigate={navigate} />}
      {hotkeys && <HotkeysDialog />}
      {profile && <ProfileDrawer user={navigationData.user} />}
    </Suspense>
  );
}
