"use client";

import {
  isNativeNotificationsEnabled,
  requestNativeNotificationPermission,
  setNativeNotificationsEnabled,
} from "@workspace/core/lib/notification-service";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/utils";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function SystemNotificationSettingsCard() {
  const [nativeEnabled, setNativeEnabled] = useState(true);

  useEffect(() => {
    setNativeEnabled(isNativeNotificationsEnabled());
  }, []);

  const handleToggleNative = async (enabled: boolean) => {
    if (enabled) {
      try {
        if (!(await requestNativeNotificationPermission())) {
          toast.error(
            "Allow desktop notifications in system settings to enable banners."
          );
          return;
        }
      } catch {
        toast.error("Desktop notification permission could not be checked.");
        return;
      }
    }
    setNativeEnabled(enabled);
    setNativeNotificationsEnabled(enabled);
    if (enabled) {
    } else {
    }
  };

  return (
    <Card className="w-full overflow-hidden rounded-xl border border-border bg-card p-0 shadow-xs transition-colors motion-fast">
      <CardHeader className="border-b border-border/40 p-5 pb-4 md:p-6 md:pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl border border-border bg-muted text-foreground shadow-xs">
            <Bell className="size-4.5" />
          </div>
          <div>
            <CardTitle className="font-display text-lg tracking-tight text-foreground">
              Desktop Notifications
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Configure native desktop banners for agent tasks, approvals, and
              system events.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-4 md:p-6 md:pt-4">
        <div className="inline-flex w-fit max-w-full items-center justify-between gap-4 sm:gap-6 rounded-xl border border-border bg-muted/20 p-4 transition-colors motion-fast">
          <div className="space-y-0.5 min-w-0">
            <div className="font-sans font-semibold text-xs text-foreground">
              System notifications
            </div>
            <div className="text-[11px] text-muted-foreground leading-normal">
              Deliver real-time task completions, approval requests, and failure
              alerts to your desktop.
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              className={cn(
                "h-7.5 gap-1.5 px-3 text-xs rounded-lg cursor-pointer transition-colors motion-fast font-medium",
                nativeEnabled
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border border-border text-muted-foreground hover:text-foreground"
              )}
              onClick={() => handleToggleNative(!nativeEnabled)}
              variant={nativeEnabled ? "default" : "outline"}
            >
              {nativeEnabled ? (
                <>
                  <Bell className="size-3.5" />
                  <span>Enabled</span>
                </>
              ) : (
                <>
                  <BellOff className="size-3.5" />
                  <span>Disabled</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
