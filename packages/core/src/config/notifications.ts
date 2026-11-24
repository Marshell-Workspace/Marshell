import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ClipboardX,
  CreditCard,
  Download,
  FileText,
  type LucideIcon,
  MessageSquare,
  Sparkles,
  Tag,
  UserCheck,
} from "lucide-react";

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "system";

export type NotificationPriority =
  | "info"
  | "success"
  | "warning"
  | "action_required"
  | "error";

export interface NotificationItem {
  avatar?: string;
  category?: string;
  description: string;
  iconName?: string;
  id: string;
  priority?: NotificationPriority;
  requiresUserAction?: boolean;
  targetSessionId?: string;
  targetWorkspaceId?: string;
  time: string;
  timestamp: number;
  title: string;
  type?: NotificationType;
  unread: boolean;
}

export function resolveNotificationCategory(
  item: NotificationItem
): "tasks" | "system" | "reviews" {
  const cat = (item.category || "").toLowerCase();
  if (cat === "tasks" || cat === "task") {
    return "tasks";
  }
  if (
    cat === "system" ||
    cat === "sys" ||
    cat === "payment" ||
    cat === "billing" ||
    cat === "auth"
  ) {
    return "system";
  }
  if (
    cat === "reviews" ||
    cat === "review" ||
    cat === "audit" ||
    cat === "report"
  ) {
    return "reviews";
  }

  const titleLower = item.title.toLowerCase();
  const descLower = item.description.toLowerCase();

  // 1. System / Payment / Auth / Export / Version / Settings
  if (
    titleLower.includes("payment") ||
    descLower.includes("payment") ||
    titleLower.includes("billing") ||
    descLower.includes("billing") ||
    titleLower.includes("credit") ||
    descLower.includes("credit") ||
    titleLower.includes("invoice") ||
    descLower.includes("invoice") ||
    titleLower.includes("subscription") ||
    descLower.includes("subscription") ||
    titleLower.includes("login") ||
    descLower.includes("signed in") ||
    titleLower.includes("auth") ||
    titleLower.includes("export") ||
    descLower.includes("csv") ||
    titleLower.includes("version") ||
    titleLower.includes("runtime") ||
    titleLower.includes("system") ||
    titleLower.includes("sync")
  ) {
    return "system";
  }

  // 2. Reviews / Audits / Reports / PRs
  if (
    titleLower.includes("review") ||
    descLower.includes("review") ||
    titleLower.includes("report") ||
    descLower.includes("report") ||
    titleLower.includes("audit") ||
    descLower.includes("audit") ||
    titleLower.includes("pull request") ||
    titleLower.includes("pr #") ||
    titleLower.includes("approved") ||
    descLower.includes("approved") ||
    titleLower.includes("vulnerability")
  ) {
    return "reviews";
  }

  // 3. Tasks (Default for tasks, agent turns, issues, completions, mentions)
  return "tasks";
}

export function getNotificationIcon(
  iconName?: string,
  type?: NotificationType
): LucideIcon {
  if (iconName === "ClipboardX" || iconName === "TaskIssue") {
    return ClipboardX;
  }
  if (
    iconName === "ClipboardCheck" ||
    iconName === "TaskCompleted" ||
    iconName === "CheckCircle2"
  ) {
    return CheckCircle2;
  }
  if (iconName === "ClipboardList") {
    return ClipboardList;
  }
  if (iconName === "MessageSquare" || iconName === "MessageCircle") {
    return MessageSquare;
  }
  if (iconName === "CreditCard") {
    return CreditCard;
  }
  if (iconName === "UserCheck") {
    return UserCheck;
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
    return ClipboardX;
  }
  if (type === "system") {
    return Sparkles;
  }
  return ClipboardList;
}
