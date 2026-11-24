import { LogoutDialog } from "@workspace/core/components/auth/logout-dialog";
import { navigationData } from "@workspace/core/config/navigation";
import { safeJsonParse } from "@workspace/core/lib/safe-json";
import { useAuthStore } from "@workspace/core/stores/auth-store";
import { useNotificationStore } from "@workspace/core/stores/notification-store";
import { usePanelStore } from "@workspace/core/stores/panel-store";
import { useTranslations } from "@workspace/i18n";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar";
import { recordTriggerElement } from "@workspace/ui/lib/popup-motion";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronsUpDown } from "lucide-react";
import { useRef, useState } from "react";

interface UserNavUser {
  avatar: string;
  email: string;
  name: string;
}

interface UserNavProps {
  navigate?: (path: string) => void;
  user: UserNavUser;
}

export function getDisplayInitials(
  name?: string | null,
  email?: string | null
): string {
  const cleanName = name?.trim();
  if (cleanName && cleanName.toLowerCase() !== "user") {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    const p0 = parts[0];
    const p1 = parts[1];
    if (parts.length >= 2 && p0 && p1) {
      return `${p0.charAt(0)}${p1.charAt(0)}`.toUpperCase();
    }
    const cleanChars = cleanName.replace(/[^a-zA-Z0-9]/g, "");
    if (cleanChars.length >= 2) {
      return cleanChars.slice(0, 2).toUpperCase();
    }
    if (cleanChars.length === 1) {
      return cleanChars.toUpperCase();
    }
  }

  const cleanEmail = email?.trim();
  if (cleanEmail) {
    const prefix = cleanEmail.split("@")[0] || "";
    const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, "");
    if (cleanPrefix.length >= 2) {
      return cleanPrefix.slice(0, 2).toUpperCase();
    }
    if (cleanPrefix.length === 1) {
      return cleanPrefix.toUpperCase();
    }
  }

  if (cleanName) {
    return cleanName.slice(0, 2).toUpperCase();
  }

  return "U";
}

export function useResolvedUser(defaultUser: UserNavUser): UserNavUser {
  const { session } = useAuthStore();

  let resolvedName = session?.name || defaultUser.name;
  let resolvedEmail = session?.email || defaultUser.email;
  let resolvedAvatar = session?.avatar || defaultUser.avatar || "";

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("marshell_account_profile");
      const parsed = safeJsonParse<{
        displayName?: string;
        email?: string;
        avatarUrl?: string;
      }>(raw);
      if (parsed?.displayName) {
        resolvedName = parsed.displayName;
      }
      if (parsed?.email) {
        resolvedEmail = parsed.email;
      }
      if (parsed?.avatarUrl !== undefined) {
        resolvedAvatar = parsed.avatarUrl || "";
      }
    } catch {
      // Ignore parse error
    }
  }

  return {
    name: resolvedName,
    email: resolvedEmail,
    avatar: resolvedAvatar,
  };
}

function UserNavBase({
  displayUser,
  onLogout,
  navigate,
}: {
  displayUser: UserNavUser;
  onLogout: () => void | Promise<void>;
  navigate?: (path: string) => void;
}) {
  const t = useTranslations("Navigation");
  const openPanel = usePanelStore((s) => s.openPanel);
  const openNotificationCenter = useNotificationStore((s) => s.setOpen);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const userTriggerRef = useRef<HTMLButtonElement | null>(null);

  const initials = getDisplayInitials(displayUser.name, displayUser.email);

  const handleSelect = (translationKey: string) => {
    recordTriggerElement(userTriggerRef.current);
    switch (translationKey) {
      case "account":
        openPanel("account");
        break;
      case "notifications":
        setTimeout(() => {
          openNotificationCenter(true);
        }, 150);
        break;
      case "settings":
        if (navigate) {
          navigate("/settings");
        } else if (typeof window !== "undefined") {
          window.location.href = "/settings";
        }
        break;
      case "logOut":
        setLogoutDialogOpen(true);
        break;
      default:
        break;
    }
  };

  const handleConfirmLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    try {
      setIsLoggingOut(true);
      await onLogout();
    } finally {
      setIsLoggingOut(false);
      setLogoutDialogOpen(false);
    }
  };

  return (
    <>
      <SidebarMenu className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:overflow-hidden">
        <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:overflow-hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild={true}>
              <SidebarMenuButton
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground border border-transparent hover:border-border/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-ui motion-normal group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg cursor-pointer shrink-0"
                ref={userTriggerRef}
                size="lg"
                tooltip={displayUser.name}
              >
                <Avatar className="size-8 shrink-0 rounded-full shadow-xs">
                  {displayUser.avatar ? (
                    <AvatarImage
                      alt={displayUser.name}
                      src={displayUser.avatar}
                    />
                  ) : null}
                  <AvatarFallback className="rounded-full bg-[var(--user-avatar-bg)] text-[var(--user-avatar-fg)] font-medium text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col justify-center text-left text-sm min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold text-foreground text-xs font-sans">
                    {displayUser.name}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground font-sans">
                    {displayUser.email}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 min-w-60 rounded-xl bg-popover/95 backdrop-blur-xl border border-border p-1.5 text-popover-foreground shadow-2xl z-50 font-sans"
              side="right"
              sideOffset={12}
            >
              <DropdownMenuLabel className="p-0.5 font-normal">
                <button
                  className={cn(
                    "flex w-full items-center gap-3 px-2.5 py-2 text-left rounded-lg transition-ui cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border-0",
                    usePanelStore.getState().activePanel === "account"
                      ? "bg-accent text-accent-foreground shadow-xs"
                      : "bg-muted/40 hover:bg-muted"
                  )}
                  onClick={() => {
                    recordTriggerElement(userTriggerRef.current);
                    openPanel("account");
                  }}
                  type="button"
                >
                  <Avatar className="size-9 rounded-full shadow-xs shrink-0">
                    {displayUser.avatar ? (
                      <AvatarImage
                        alt={displayUser.name}
                        src={displayUser.avatar}
                      />
                    ) : null}
                    <AvatarFallback className="rounded-full bg-[var(--user-avatar-bg)] text-[var(--user-avatar-fg)] font-semibold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col justify-center text-left text-sm min-w-0 leading-tight">
                    <span className="truncate font-semibold text-foreground text-xs font-sans">
                      {displayUser.name}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground font-sans">
                      {displayUser.email}
                    </span>
                  </div>
                </button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1.5 bg-border" />
              {navigationData.navProfile.map((group, index) => (
                <div className="contents" key={group.id}>
                  <DropdownMenuGroup className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isLogout = item.translationKey === "logOut";

                      return (
                        <DropdownMenuItem
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium border border-transparent transition-ui cursor-pointer font-sans select-none",
                            isLogout
                              ? "text-foreground/85 hover:text-red-500 hover:bg-red-500/10 focus:text-red-500 focus:bg-red-500/10"
                              : "text-foreground/85 hover:text-foreground hover:bg-accent focus:bg-accent focus:text-foreground"
                          )}
                          key={item.translationKey}
                          onSelect={() => handleSelect(item.translationKey)}
                        >
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              isLogout
                                ? "text-red-500/90"
                                : "text-muted-foreground"
                            )}
                            strokeWidth={2}
                          />
                          <span>
                            {t(item.translationKey as Parameters<typeof t>[0])}
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuGroup>
                  {index < navigationData.navProfile.length - 1 && (
                    <DropdownMenuSeparator className="my-1.5 bg-border" />
                  )}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <LogoutDialog
        isLoading={isLoggingOut}
        onConfirm={handleConfirmLogout}
        onOpenChange={setLogoutDialogOpen}
        open={logoutDialogOpen}
      />
    </>
  );
}

export function UserNav({ user: defaultUser, navigate }: UserNavProps) {
  const { logout } = useAuthStore();
  const displayUser = useResolvedUser(defaultUser);

  return (
    <UserNavBase
      displayUser={displayUser}
      navigate={navigate}
      onLogout={() => logout()}
    />
  );
}
