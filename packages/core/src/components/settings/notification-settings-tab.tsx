"use client";

import {
  checkIsNativeApp,
  getDesktopPlatform,
  isNativeNotificationsEnabled,
  requestNativeNotificationPermission,
  sendNativeNotification,
  setNativeNotificationsEnabled,
  triggerNotification,
} from "@workspace/core/lib/notification-service";
import { useGeneralSettingsStore } from "@workspace/core/stores/general-settings-store";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SettingRow } from "./setting-row";

const DESKTOP_DESCRIPTION = {
  windows:
    "Show Windows notifications when Marshell is in the background. Windows must allow notifications for Marshell.",
  mac: "Show macOS notifications when Marshell is in the background. macOS asks for permission the first time you turn this on.",
  linux:
    "Show desktop notifications when Marshell is in the background. Needs a notification service, which most Linux desktops include.",
  other:
    "Show system alerts when Marshell is in the background. Your operating system must allow notifications.",
} as const;

export function NotificationSettingsTab() {
  const settings = useGeneralSettingsStore();
  const [native, setNative] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setNative(checkIsNativeApp());
  }, []);

  const testNotifications = async () => {
    setTesting(true);
    const notification = {
      category: "system",
      title: "Notification preview",
      description: "This is a test notification from Marshell.",
      type: "info" as const,
    };
    try {
      triggerNotification({
        ...notification,
        forceToast: true,
        skipNative: true,
        dedupeKey: `settings-preview-${Date.now()}`,
      });
      if (native && settings.nativeBanners) {
        const sent =
          (await requestNativeNotificationPermission()) &&
          (await sendNativeNotification(notification));
        if (!sent) {
          toast.error(
            "Desktop notification could not be sent. Check your system notification permissions."
          );
        }
      }
    } catch {
      toast.error("Desktop notification permission could not be checked.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="w-full space-y-8 text-foreground">
      <div className="space-y-2">
        <h2 className="font-semibold text-xl tracking-tight">Notifications</h2>
        <p className="text-muted-foreground text-sm">
          Configure agent task updates, workspace alerts, desktop banners, and
          sound cues.
        </p>
      </div>

      <section>
        <SettingRow
          description="Notify when an agent finishes, encounters a problem, or needs your answer."
          id="notifications-tasks"
          label="Agent task updates"
        >
          <Switch
            aria-describedby="notifications-tasks-description"
            checked={settings.responseCompletions}
            id="notifications-tasks"
            onCheckedChange={settings.setResponseCompletions}
            size="sm"
          />
        </SettingRow>

        <SettingRow
          description="Notify about file opening, workspace setup, command failures, and pull request updates."
          id="notifications-workspace-alerts"
          label="Workspace alerts"
        >
          <Switch
            aria-describedby="notifications-workspace-alerts-description"
            checked={settings.codeNotifications}
            id="notifications-workspace-alerts"
            onCheckedChange={settings.setCodeNotifications}
            size="sm"
          />
        </SettingRow>

        <SettingRow
          description="Notify about scheduled tasks, cron runs, and background sub-agents."
          id="notifications-scheduled"
          label="Scheduled and background tasks"
        >
          <Switch
            aria-describedby="notifications-scheduled-description"
            checked={settings.scheduledTasks}
            id="notifications-scheduled"
            onCheckedChange={settings.setScheduledTasks}
            size="sm"
          />
        </SettingRow>

        <SettingRow
          description="Notify when an agent needs your approval. Turning off alerts does not approve requests automatically."
          id="notifications-approvals"
          label="Approval alerts"
        >
          <Switch
            aria-describedby="notifications-approvals-description"
            checked={settings.permissionRequests}
            id="notifications-approvals"
            onCheckedChange={settings.setPermissionRequests}
            size="sm"
          />
        </SettingRow>

        <SettingRow
          description={
            native
              ? DESKTOP_DESCRIPTION[getDesktopPlatform()]
              : "System notification banners are available in the desktop app."
          }
          id="notifications-desktop"
          label="Desktop notifications"
        >
          <Switch
            aria-describedby="notifications-desktop-description"
            checked={isNativeNotificationsEnabled()}
            disabled={!native}
            id="notifications-desktop"
            onCheckedChange={async (enabled) => {
              if (!enabled) {
                setNativeNotificationsEnabled(false);
                return;
              }
              try {
                if (await requestNativeNotificationPermission()) {
                  setNativeNotificationsEnabled(true);
                } else {
                  toast.error(
                    "Allow desktop notifications in system settings to enable banners."
                  );
                }
              } catch {
                toast.error(
                  "Desktop notification permission could not be checked."
                );
              }
            }}
            size="sm"
          />
        </SettingRow>

        <SettingRow
          description="Play a short chime for enabled notification categories."
          id="notifications-sounds"
          label="Notification sounds"
        >
          <Switch
            aria-describedby="notifications-sounds-description"
            checked={settings.soundCues}
            id="notifications-sounds"
            onCheckedChange={settings.setSoundCues}
            size="sm"
          />
        </SettingRow>

        <SettingRow
          description="Preview an in-app alert, your sound preference, and enabled desktop banners."
          id="notifications-preview"
          label="Test notifications"
        >
          <Button
            aria-describedby="notifications-preview-description"
            disabled={testing}
            id="notifications-preview"
            onClick={testNotifications}
            size="sm"
            variant="outline"
          >
            {testing && <Loader2 className="size-3.5 animate-spin" />} Send test
          </Button>
        </SettingRow>
      </section>
    </div>
  );
}
