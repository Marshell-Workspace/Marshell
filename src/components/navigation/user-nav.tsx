"use client";

import { useClerk, useUser } from "@clerk/clerk-react";
import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { LogoutDialog } from "@/components/auth/logout-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/sidebar";
import { navigationData } from "@/config/navigation";
import { useTranslations } from "@/i18n";
import { useAuthStore } from "@/stores/auth-store";
import { useNotificationStore } from "@/stores/notification-store";
import { usePanelStore } from "@/stores/panel-store";

interface UserNavUser {
  avatar: string;
  email: string;
  name: string;
}

interface UserNavProps {
  user: UserNavUser;
}

const hasClerkPublishableKey = !!(
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()
);

function checkIsNativeApp(): boolean {
  if (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_IS_NATIVE === "true"
  ) {
    return true;
  }
  if (
    typeof window !== "undefined" &&
    ("__TAURI__" in window ||
      "__TAURI_INTERNALS__" in window ||
      "__TAURI_POST_MESSAGE__" in window)
  ) {
    return true;
  }
  return false;
}

function UserNavBase({
  displayUser,
  onLogout,
}: {
  displayUser: UserNavUser;
  onLogout: () => void | Promise<void>;
}) {
  const t = useTranslations("Navigation");
  const openPanel = usePanelStore((s) => s.openPanel);
  const openNotificationCenter = useNotificationStore((s) => s.setOpen);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSelect = (translationKey: string) => {
    switch (translationKey) {
      case "upgradeToPro":
        openPanel("upgrade");
        break;
      case "account":
        openPanel("account");
        break;
      case "billing":
        openPanel("billing");
        break;
      case "notifications":
        setTimeout(() => {
          openNotificationCenter(true);
        }, 150);
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
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild={true}>
              <SidebarMenuButton
                className="data-[state=open]:bg-white/15 data-[state=open]:border-white/25 border border-transparent hover:border-white/15 hover:bg-white/[0.08] transition-all duration-200 backdrop-blur-md group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg"
                size="lg"
              >
                <Avatar className="size-8 shrink-0 rounded-full border border-white/25 shadow-xs">
                  <AvatarImage
                    alt={displayUser.name}
                    src={displayUser.avatar}
                  />
                  <AvatarFallback className="rounded-full bg-white/15 text-white font-medium text-xs">
                    {displayUser.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm min-w-0 whitespace-nowrap group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold text-white text-xs drop-shadow-xs">
                    {displayUser.name}
                  </span>
                  <span className="truncate text-[11px] text-white/60">
                    {displayUser.email}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 shrink-0 text-white/60 group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-[22px] bg-black/70 backdrop-blur-2xl border border-white/20 p-2 text-white shadow-[0_20px_60px_rgba(0,0,0,0.7),inset_0_1.5px_2px_rgba(255,255,255,0.3)] z-50 transition-all"
              side={"right"}
              sideOffset={8}
              style={{
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
              }}
            >
              <DropdownMenuLabel className="p-1.5 font-normal">
                <div className="flex items-center gap-3 px-2 py-2 text-left rounded-xl bg-white/[0.04] border border-white/10">
                  <Avatar className="size-9 rounded-full border border-white/25 shadow-xs">
                    <AvatarImage
                      alt={displayUser.name}
                      src={displayUser.avatar}
                    />
                    <AvatarFallback className="rounded-full bg-white/15 text-white font-semibold text-xs">
                      {displayUser.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm min-w-0">
                    <span className="truncate font-semibold text-white text-xs drop-shadow-xs">
                      {displayUser.name}
                    </span>
                    <span className="truncate text-[11px] text-white/60 font-mono">
                      {displayUser.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1.5 bg-white/15" />
              {navigationData.navProfile.map((group, index) => (
                <div className="contents" key={group.id}>
                  <DropdownMenuGroup className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <DropdownMenuItem
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-white/85 hover:text-white hover:bg-white/15 border border-transparent hover:border-white/20 transition-all cursor-pointer focus:bg-white/15 focus:text-white"
                          key={item.translationKey}
                          onSelect={() => handleSelect(item.translationKey)}
                        >
                          <Icon
                            className="size-4 text-white/80"
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
                    <DropdownMenuSeparator className="my-1.5 bg-white/15" />
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

function ClerkUserNav({ defaultUser }: { defaultUser: UserNavUser }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const displayUser =
    isLoaded && user
      ? {
          name: user.fullName || user.username || "User",
          email: user.primaryEmailAddress?.emailAddress || "",
          avatar: user.imageUrl,
        }
      : defaultUser;

  return <UserNavBase displayUser={displayUser} onLogout={() => signOut()} />;
}

function NativeUserNav({ defaultUser }: { defaultUser: UserNavUser }) {
  const { session, logout } = useAuthStore();

  const displayUser = session
    ? {
        name: session.name || session.email.split("@")[0] || "User",
        email: session.email,
        avatar: session.avatar || defaultUser.avatar,
      }
    : defaultUser;

  return <UserNavBase displayUser={displayUser} onLogout={() => logout()} />;
}

export function UserNav({ user: defaultUser }: UserNavProps) {
  if (!checkIsNativeApp() && hasClerkPublishableKey) {
    return <ClerkUserNav defaultUser={defaultUser} />;
  }
  return <NativeUserNav defaultUser={defaultUser} />;
}
