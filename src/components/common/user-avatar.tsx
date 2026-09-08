"use client";

import { useUser } from "@clerk/clerk-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";
import { navigationData } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const hasClerkPublishableKey = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
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

function ClerkUserAvatar({ className }: { className?: string }) {
  const { user, isLoaded } = useUser();
  const authSession = useAuthStore((s) => s.session);

  const name =
    (isLoaded && (user?.fullName || user?.username)) ||
    authSession?.name ||
    navigationData.user.name ||
    "User";
  const avatar =
    (isLoaded && user?.imageUrl) ||
    authSession?.avatar ||
    navigationData.user.avatar;
  const initials = (
    (isLoaded && user ? user.firstName?.[0] || name[0] : name.slice(0, 2)) ||
    "U"
  ).toUpperCase();

  return (
    <Avatar
      className={cn(
        "size-6 shrink-0 overflow-hidden rounded-full ring-1 ring-border/40",
        className
      )}
    >
      {avatar && (
        <AvatarImage
          alt={name}
          className="size-full rounded-full object-cover"
          src={avatar}
        />
      )}
      <AvatarFallback className="rounded-full bg-primary/20 font-semibold text-[10px] text-primary">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function NativeUserAvatar({ className }: { className?: string }) {
  const authSession = useAuthStore((s) => s.session);

  const name =
    authSession?.name ||
    authSession?.email?.split("@")[0] ||
    navigationData.user.name ||
    "User";
  const avatar = authSession?.avatar || navigationData.user.avatar;
  const initials = name.slice(0, 2).toUpperCase() || "U";

  return (
    <Avatar
      className={cn(
        "size-6 shrink-0 overflow-hidden rounded-full ring-1 ring-border/40",
        className
      )}
    >
      {avatar && (
        <AvatarImage
          alt={name}
          className="size-full rounded-full object-cover"
          src={avatar}
        />
      )}
      <AvatarFallback className="rounded-full bg-primary/20 font-semibold text-[10px] text-primary">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserAvatar({ className }: { className?: string }) {
  if (!checkIsNativeApp() && hasClerkPublishableKey) {
    return <ClerkUserAvatar className={className} />;
  }
  return <NativeUserAvatar className={className} />;
}
