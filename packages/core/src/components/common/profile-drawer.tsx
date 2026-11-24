"use client";

import {
  navigationData,
  type UserNavItem,
} from "@workspace/core/config/navigation";
import { useDrawerHistory } from "@workspace/core/hooks/use-drawer-history";
import { useNotificationStore } from "@workspace/core/stores/notification-store";
import { usePanelStore } from "@workspace/core/stores/panel-store";
import { useProfileDrawerStore } from "@workspace/core/stores/profile-drawer-store";
import { useTranslations } from "@workspace/i18n";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/utils";

interface ProfileDrawerProps {
  user: UserNavItem;
}

export function ProfileDrawer({ user }: ProfileDrawerProps) {
  const { isOpen, setOpen } = useProfileDrawerStore();
  useDrawerHistory(isOpen, setOpen);
  const t = useTranslations("Navigation");
  const openPanel = usePanelStore((s) => s.openPanel);
  const openNotificationCenter = useNotificationStore((s) => s.setOpen);

  const handleSelect = (translationKey: string) => {
    setOpen(false);

    // Map translation keys to panel states
    switch (translationKey) {
      case "account":
        openPanel("account");
        break;
      case "settings":
        if (typeof window !== "undefined") {
          window.location.href = "/settings";
        }
        break;
      case "notifications":
        // Delay opening to prevent layout/focus collisions with closing mobile Drawer
        setTimeout(() => {
          openNotificationCenter(true);
        }, 150);
        break;
      default:
        break;
    }
  };

  return (
    <Drawer onOpenChange={setOpen} open={isOpen}>
      <DrawerContent className="p-2">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{t("account")}</DrawerTitle>
          <DrawerDescription>{user.name}</DrawerDescription>
        </DrawerHeader>
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 text-left">
          <Avatar className="size-10 rounded-full border border-border/60 shadow-xs">
            <AvatarImage alt={user.name} src={user.avatar} />
            <AvatarFallback className="rounded-full bg-muted font-semibold text-foreground">
              {user.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 min-w-0 text-left text-sm">
            <span className="truncate font-display font-semibold text-foreground">
              {user.name}
            </span>
            <span className="truncate text-muted-foreground text-xs">
              {user.email}
            </span>
          </div>
        </div>
        <Separator className="my-2 h-px bg-border/60" />
        <div className="flex flex-col gap-0.5">
          {navigationData.navProfile.map((group, index) => (
            <div className="contents" key={group.id}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isLogout = item.translationKey === "logOut";
                return (
                  <Button
                    className={cn(
                      "h-10 justify-start gap-3 rounded-lg font-medium transition-colors motion-fast active:scale-[0.99]",
                      isLogout
                        ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                        : "text-foreground/85 hover:bg-accent/70 hover:text-foreground"
                    )}
                    key={item.translationKey}
                    onClick={() => handleSelect(item.translationKey)}
                    variant="ghost"
                  >
                    <Icon
                      className={cn(
                        "size-4",
                        isLogout
                          ? "text-destructive/90"
                          : "text-muted-foreground"
                      )}
                      strokeWidth={2}
                    />
                    {t(item.translationKey as Parameters<typeof t>[0])}
                  </Button>
                );
              })}
              {index < navigationData.navProfile.length - 1 && (
                <Separator className="my-1 bg-border/40" />
              )}
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
