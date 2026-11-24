"use client";

import { getDisplayInitials } from "@workspace/core/components/navigation/user-nav";
import { navigationData } from "@workspace/core/config/navigation";
import { useAuthStore } from "@workspace/core/stores/auth-store";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { cn } from "@workspace/ui/lib/utils";

export function UserAvatar({ className }: { className?: string }) {
  const authSession = useAuthStore((s) => s.session);

  const email = authSession?.email || navigationData.user.email || "";
  const name =
    authSession?.name ||
    authSession?.email?.split("@")[0] ||
    navigationData.user.name ||
    "User";
  const avatar = authSession?.avatar || "";
  const initials = getDisplayInitials(name, email);

  return (
    <Avatar
      className={cn(
        "size-6 shrink-0 overflow-hidden rounded-full ring-1 ring-border/40",
        className
      )}
    >
      {avatar ? (
        <AvatarImage
          alt={name}
          className="size-full rounded-full object-cover"
          src={avatar}
        />
      ) : null}
      <AvatarFallback className="rounded-full bg-[var(--user-avatar-bg)] font-semibold text-[10px] text-[var(--user-avatar-fg)]">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
