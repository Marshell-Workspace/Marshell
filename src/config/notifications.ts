import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Info,
  type LucideIcon,
  MessageCircle,
  Sparkles,
  Tag,
} from "lucide-react";

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "system";

export interface NotificationItem {
  avatar?: string;
  category?: string;
  description: string;
  iconName?: string;
  id: string;
  time: string;
  timestamp: number;
  title: string;
  type?: NotificationType;
  unread: boolean;
}

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n-1",
    title: "loginTitle",
    description: "loginDescription",
    time: "loginTime",
    timestamp: Date.now() - 1000 * 60 * 5,
    unread: true,
    avatar: "/avatar.svg",
    type: "info",
  },
  {
    id: "n-2",
    title: "mentionTitle",
    description: "mentionDescription",
    time: "mentionTime",
    timestamp: Date.now() - 1000 * 60 * 21,
    unread: true,
    iconName: "MessageCircle",
    type: "info",
  },
  {
    id: "n-3",
    title: "reportTitle",
    description: "reportDescription",
    time: "reportTime",
    timestamp: Date.now() - 1000 * 60 * 60 * 3,
    unread: true,
    iconName: "FileText",
    type: "success",
  },
  {
    id: "n-4",
    title: "exportTitle",
    description: "exportDescription",
    time: "exportTime",
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
    unread: false,
    iconName: "Download",
    type: "success",
  },
  {
    id: "n-5",
    title: "versionTitle",
    description: "versionDescription",
    time: "versionTime",
    timestamp: Date.now() - 1000 * 60 * 60 * 48,
    unread: false,
    iconName: "Tag",
    type: "system",
  },
];

export function getNotificationIcon(
  iconName?: string,
  type?: NotificationType
): LucideIcon {
  if (iconName === "MessageCircle") {
    return MessageCircle;
  }
  if (iconName === "FileText") {
    return FileText;
  }
  if (iconName === "Download") {
    return Download;
  }
  if (iconName === "Tag") {
    return Tag;
  }
  if (type === "success") {
    return CheckCircle2;
  }
  if (type === "warning") {
    return AlertTriangle;
  }
  if (type === "error") {
    return AlertTriangle;
  }
  if (type === "system") {
    return Sparkles;
  }
  return Info;
}
