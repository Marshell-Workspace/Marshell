import { AccountIcon } from "@workspace/core/components/common/custom-icons";
import { LogOut, type LucideIcon, Settings } from "lucide-react";
import type * as React from "react";

export interface UserNavItem {
  avatar: string;
  email: string;
  name: string;
}

export interface ProfileNavItem {
  icon:
    | LucideIcon
    | React.ComponentType<{
        className?: string;
        strokeWidth?: number | string;
      }>;
  title: string;
  translationKey: string;
  url: string;
}

export interface ProfileNavGroup {
  id: string;
  items: ProfileNavItem[];
}

export interface SecondaryNavItem {
  external?: boolean;
  icon: LucideIcon;
  title: string;
  translationKey: string;
  url: string;
}

export interface NavigationData {
  navProfile: ProfileNavGroup[];
  navSecondary: SecondaryNavItem[];
  user: UserNavItem;
}

export const navigationData: NavigationData = {
  user: {
    name: "User",
    email: "user@example.com",
    avatar: "",
  },
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
      translationKey: "settings",
    },
  ],
  navProfile: [
    {
      id: "group-1",
      items: [
        {
          title: "Account",
          url: "#account",
          icon: AccountIcon,
          translationKey: "account",
        },
        {
          title: "Settings",
          url: "/settings",
          icon: Settings,
          translationKey: "settings",
        },
      ],
    },
    {
      id: "group-2",
      items: [
        {
          title: "Log Out",
          url: "#logout",
          icon: LogOut,
          translationKey: "logOut",
        },
      ],
    },
  ],
};
