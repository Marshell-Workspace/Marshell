"use client";

import {
  CodeReviewIcon,
  NewVersionIcon,
  NotificationBellIcon,
  ResponseNeededIcon,
  ReviewApprovedIcon,
  ReviewGeneratedIcon,
  RuntimeEngineIcon,
  SecurityAuditClearedIcon,
  TaskCompletedIcon,
  TaskIssueIcon,
  TaskUpdatedIcon,
} from "@workspace/core/components/icons/mode-icons";
import {
  getNotificationIcon,
  type NotificationItem,
  resolveNotificationCategory,
} from "@workspace/core/config/notifications";
import { useNotificationStore } from "@workspace/core/stores/notification-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { useTranslations } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import {
  ClipboardList,
  CreditCard,
  Download,
  MessageSquare,
  MoreVertical,
  UserCheck,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NotificationEmptyState } from "./notification-empty-state";

type NotificationTab = "all" | "system" | "reviews";

interface DateGroup {
  items: NotificationItem[];
  key: string;
  subTitle?: string;
  title: string;
}

const I18N_FALLBACKS: Record<string, string> = {
  loginTitle: "Login Successful",
  loginDescription: "You have securely signed in as user@example.com.",
  loginTime: "Just now",
  mentionTitle: "New Mention",
  mentionDescription: "You have been mentioned in a new comment.",
  mentionTime: "21 minutes ago",
  reportTitle: "Report Generated",
  reportDescription:
    "The analytics report for the previous week has been generated.",
  reportTime: "3 hours ago",
  exportTitle: "Export Completed",
  exportDescription:
    "The data you requested has been downloaded in CSV format.",
  exportTime: "Yesterday",
  versionTitle: "New Version Released",
  versionDescription:
    "Check the latest version for new features and improvements.",
  versionTime: "2 days ago",
};

function formatCardTime(timestamp: number): string {
  if (!timestamp || Number.isNaN(timestamp)) {
    return "";
  }
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupNotificationsByDate(items: NotificationItem[]): DateGroup[] {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const yesterdayStart = todayStart - 86_400_000;

  const groupsMap = new Map<string, DateGroup>();

  for (const item of items) {
    const itemDate = new Date(item.timestamp);
    const itemTime = itemDate.getTime();

    let key: string;
    let title: string;
    let subTitle: string | undefined;

    const formattedDate = itemDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (itemTime >= todayStart) {
      key = "today";
      title = "Today";
      subTitle = formattedDate;
    } else if (itemTime >= yesterdayStart && itemTime < todayStart) {
      key = "yesterday";
      title = "Yesterday";
      subTitle = formattedDate;
    } else {
      key = formattedDate;
      title = formattedDate;
      subTitle = undefined;
    }

    const existing = groupsMap.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groupsMap.set(key, {
        key,
        title,
        subTitle,
        items: [item],
      });
    }
  }

  return Array.from(groupsMap.values());
}

const TAB_ITEMS: Array<{ id: NotificationTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "system", label: "System" },
  { id: "reviews", label: "Reviews" },
];

const TAB_INDEX_MAP: Record<NotificationTab, number> = {
  all: 0,
  system: 1,
  reviews: 2,
};

const TAB_SHAPES: Record<NotificationTab, string> = {
  all: "M0 0H70Q88 0 92 16L100 48H0Z",
  system: "M0 48L8 16Q12 0 30 0H70Q88 0 92 16L100 48Z",
  reviews: "M0 48L8 16Q12 0 30 0H100V48Z",
};

function renderItemIcon(item: NotificationItem, resolvedTitle: string) {
  const titleLower = resolvedTitle.toLowerCase();
  const iconName = item.iconName;

  // 1. Runtime engine ready or anything engine related
  if (
    iconName === "RuntimeEngineIcon" ||
    titleLower.includes("runtime engine") ||
    titleLower.includes("engine ready") ||
    titleLower.includes("engine") ||
    titleLower.includes("runtime")
  ) {
    return <RuntimeEngineIcon className="size-4.5" />;
  }

  // 2. New versions
  if (
    iconName === "NewVersionIcon" ||
    titleLower.includes("new version") ||
    titleLower.includes("version released") ||
    (titleLower.includes("version") && !titleLower.includes("control"))
  ) {
    return <NewVersionIcon className="size-4.5" />;
  }

  // 3. Security audit cleared
  if (
    iconName === "SecurityAuditClearedIcon" ||
    titleLower.includes("security audit") ||
    titleLower.includes("audit cleared") ||
    titleLower.includes("vulnerability")
  ) {
    return <SecurityAuditClearedIcon className="size-4.5" />;
  }

  // 4. Review completed or approved
  if (
    iconName === "ReviewApprovedIcon" ||
    titleLower.includes("review approved") ||
    titleLower.includes("review completed") ||
    (titleLower.includes("review") && titleLower.includes("approved"))
  ) {
    return <ReviewApprovedIcon className="size-4.5" />;
  }

  // 5. Review generated / Report generated
  if (
    iconName === "ReviewGeneratedIcon" ||
    titleLower.includes("review generated") ||
    titleLower.includes("report generated") ||
    titleLower.includes("analytics report") ||
    (titleLower.includes("report") && !titleLower.includes("issue"))
  ) {
    return <ReviewGeneratedIcon className="size-4.5" />;
  }

  // 6. Code review
  if (
    iconName === "CodeReviewIcon" ||
    titleLower.includes("code review") ||
    titleLower.includes("pull request") ||
    titleLower.includes("pr #") ||
    titleLower.includes("review ready")
  ) {
    return <CodeReviewIcon className="size-4.5" />;
  }

  // 7. Task updated
  if (
    iconName === "TaskUpdatedIcon" ||
    iconName === "ClipboardCheck" ||
    titleLower.includes("task updated") ||
    titleLower.includes("updated")
  ) {
    return <TaskUpdatedIcon className="size-4.5" />;
  }

  // 8. Task completed
  if (
    iconName === "TaskCompletedIcon" ||
    iconName === "TaskCompleted" ||
    iconName === "CheckCircle2" ||
    titleLower.includes("task completed") ||
    titleLower.includes("completed")
  ) {
    return <TaskCompletedIcon className="size-4.5" />;
  }

  // 9. Task issue
  if (
    iconName === "TaskIssueIcon" ||
    iconName === "TaskIssue" ||
    iconName === "ClipboardX" ||
    titleLower.includes("task issue") ||
    titleLower.includes("issue") ||
    titleLower.includes("fail") ||
    titleLower.includes("error")
  ) {
    return <TaskIssueIcon className="size-4.5" />;
  }

  // 10. Response needed
  if (
    iconName === "ResponseNeededIcon" ||
    titleLower.includes("response needed") ||
    titleLower.includes("response")
  ) {
    return <ResponseNeededIcon className="size-4.5" />;
  }

  // Payment / billing / subscription
  if (
    iconName === "CreditCard" ||
    titleLower.includes("payment") ||
    titleLower.includes("billing") ||
    titleLower.includes("subscription")
  ) {
    return <CreditCard className="size-4.5" />;
  }

  // Login / auth
  if (
    iconName === "UserCheck" ||
    titleLower.includes("login") ||
    titleLower.includes("signed in") ||
    titleLower.includes("auth")
  ) {
    return <UserCheck className="size-4.5" />;
  }

  // Export / download
  if (iconName === "Download" || titleLower.includes("export")) {
    return <Download className="size-4.5" />;
  }

  // Task assigned / moved
  if (
    iconName === "ClipboardList" ||
    titleLower.includes("assigned") ||
    titleLower.includes("moved")
  ) {
    return <ClipboardList className="size-4.5" />;
  }

  // Task response / comment / mention
  if (
    iconName === "MessageSquare" ||
    iconName === "MessageCircle" ||
    titleLower.includes("comment") ||
    titleLower.includes("mention")
  ) {
    return <MessageSquare className="size-4.5" />;
  }

  const FallbackIcon = getNotificationIcon(item.iconName, item.type);
  return <FallbackIcon className="size-4.5" />;
}

export function NotificationCenter() {
  const t = useTranslations("NotificationCenter");
  const {
    isOpen,
    setOpen,
    items,
    markAsRead,
    toggleRead,
    removeNotification,
    clearAll,
  } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<NotificationTab>("all");
  const [slideDirection, setSlideDirection] = useState<number>(0);
  const shouldReduceMotion = useReducedMotion();
  const bellTriggerRef = useRef<HTMLDivElement | null>(null);
  const emptyEntrancePlayed = useRef(false);
  const handleEmptyEntranceStarted = useCallback(() => {
    emptyEntrancePlayed.current = true;
  }, []);
  useEffect(() => {
    if (!isOpen) {
      emptyEntrancePlayed.current = false;
    }
  }, [isOpen]);

  const handleTabSelect = (tabKey: NotificationTab) => {
    if (tabKey === activeTab) {
      return;
    }
    const currentIdx = TAB_INDEX_MAP[activeTab];
    const nextIdx = TAB_INDEX_MAP[tabKey];
    setSlideDirection(nextIdx > currentIdx ? 1 : -1);
    setActiveTab(tabKey);
  };

  const hasUnread = items.some((item) => item.unread);

  const resolveText = (text: string) => {
    if (!text) {
      return "";
    }
    if (I18N_FALLBACKS[text]) {
      try {
        const translated = t(text);
        if (translated && translated !== text) {
          return translated;
        }
      } catch {
        // Use I18N_FALLBACKS
      }
      return I18N_FALLBACKS[text];
    }
    return text;
  };

  // All includes every event; the other tabs use the existing category resolver.
  const filteredItems = items.filter((item) => {
    if (activeTab === "all") {
      return true;
    }
    const title = resolveText(item.title);
    const description = resolveText(item.description);
    const category = resolveNotificationCategory({
      ...item,
      title,
      description,
    });
    return category === activeTab;
  });

  const dateGroups = groupNotificationsByDate(filteredItems);
  const isEmpty = filteredItems.length === 0;

  const handleViewNotification = (item: NotificationItem) => {
    markAsRead(item.id);
    if (item.targetWorkspaceId) {
      useWorkspaceStore.getState().setActiveWorkspace(item.targetWorkspaceId);
    }
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={isOpen}>
      <PopoverTrigger asChild={true}>
        <div className="relative inline-flex" ref={bellTriggerRef}>
          <Button
            aria-label="Notifications"
            className="relative size-8 rounded-lg border-0 bg-transparent text-foreground/80 shadow-none transition-colors hover:bg-muted hover:text-foreground"
            size="icon"
            type="button"
            variant="ghost"
          >
            <NotificationBellIcon className="size-4.5 text-foreground/90 transition-colors" />
          </Button>
          {hasUnread && (
            <span className="pointer-events-none absolute top-1 right-1 z-20 flex size-2 items-center justify-center">
              <span className="relative size-1.5 rounded-full bg-primary/80" />
            </span>
          )}
        </div>
      </PopoverTrigger>

      {/* Production-Ready Dark Mode Notification Center */}
      <PopoverContent
        align="end"
        aria-label={t("title")}
        className="relative z-50 flex w-[min(380px,calc(100vw-24px))] max-h-[min(560px,calc(100dvh-24px),var(--radix-popover-content-available-height))] flex-col gap-0 overflow-hidden rounded-2xl border border-border/80 bg-popover/95 p-0 text-foreground shadow-[0_20px_60px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(255_255_255/0.04)]"
        triggerRef={bellTriggerRef}
      >
        <div className="shrink-0 border-border/60 border-b bg-background/20">
          <div
            aria-label={t("title")}
            className="isolate flex h-12 w-full items-stretch"
            role="tablist"
          >
            {TAB_ITEMS.map(({ id: tabKey }) => {
              const isActive = activeTab === tabKey;

              return (
                <button
                  aria-controls="notification-tab-content"
                  aria-selected={isActive}
                  className={cn(
                    "relative flex flex-1 items-center justify-center font-sans text-xs transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  id={`notification-tab-${tabKey}`}
                  key={tabKey}
                  onClick={() => handleTabSelect(tabKey)}
                  onKeyDown={(event) => {
                    const index = TAB_INDEX_MAP[tabKey];
                    let next = index;
                    if (event.key === "ArrowRight") {
                      next = (index + 1) % TAB_ITEMS.length;
                    } else if (event.key === "ArrowLeft") {
                      next = (index + TAB_ITEMS.length - 1) % TAB_ITEMS.length;
                    } else if (event.key === "Home") {
                      next = 0;
                    } else if (event.key === "End") {
                      next = TAB_ITEMS.length - 1;
                    } else {
                      return;
                    }
                    event.preventDefault();
                    const tab = TAB_ITEMS[next];
                    if (tab) {
                      handleTabSelect(tab.id);
                      document
                        .getElementById(`notification-tab-${tab.id}`)
                        ?.focus();
                    }
                  }}
                  role="tab"
                  tabIndex={isActive ? 0 : -1}
                  type="button"
                >
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 -z-10"
                      layoutId="active-notification-tab-pill"
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : {
                              type: "spring",
                              stiffness: 420,
                              damping: 34,
                            }
                      }
                    >
                      <svg
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full fill-primary/5 stroke-primary/15"
                        preserveAspectRatio="none"
                        viewBox="0 0 100 48"
                      >
                        <path d={TAB_SHAPES[tabKey]} strokeWidth="0.5" />
                      </svg>
                      <span className="absolute bottom-1 left-[22%] right-[22%] h-0.5 rounded-full bg-primary shadow-xs" />
                    </motion.div>
                  )}
                  <span className="relative z-10">{t(tabKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Area with Slim Scrollbar */}
        <div
          aria-labelledby={`notification-tab-${activeTab}`}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-2 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30"
          id="notification-tab-content"
          role="tabpanel"
        >
          {isEmpty ? (
            <div data-part="empty-tab-panel">
              <NotificationEmptyState
                onEntranceStarted={handleEmptyEntranceStarted}
                playEntrance={!emptyEntrancePlayed.current}
              />
            </div>
          ) : (
            <AnimatePresence
              custom={shouldReduceMotion ? 0 : slideDirection}
              initial={false}
              mode="wait"
            >
              <motion.div
                animate="center"
                custom={shouldReduceMotion ? 0 : slideDirection}
                exit="exit"
                initial="enter"
                key={activeTab}
                transition={{
                  ease: [0.22, 1, 0.36, 1],
                  duration: 0.18,
                }}
                variants={{
                  enter: (dir: number) => ({
                    opacity: 0,
                    x: dir === 0 ? 0 : dir > 0 ? 14 : -14,
                  }),
                  center: {
                    opacity: 1,
                    x: 0,
                  },
                  exit: (dir: number) => ({
                    opacity: 0,
                    x: dir === 0 ? 0 : dir > 0 ? -14 : 14,
                  }),
                }}
              >
                <div className="flex flex-col pb-3 space-y-4">
                  {dateGroups.map((group) => (
                    <div className="flex flex-col" key={group.key}>
                      {/* Group Header */}
                      <div className="flex items-center justify-between pb-2 pt-1 px-0.5">
                        <span className="font-sans font-semibold text-[13px] text-foreground">
                          {group.title}
                        </span>
                        {group.subTitle && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {group.subTitle}
                          </span>
                        )}
                      </div>

                      {/* Notification Cards in Group */}
                      <div className="flex flex-col gap-2">
                        {group.items.map((item) => {
                          const title = resolveText(item.title);
                          const description = resolveText(item.description);

                          return (
                            <div
                              className="group relative flex items-center gap-3.5 rounded-xl p-3 text-left transition-colors motion-fast border border-[var(--raised-border,#E9EDF4)] bg-card hover:border-[var(--border-focus,#D5DDEA)] hover:bg-muted/40 shadow-2xs"
                              key={item.id}
                            >
                              <button
                                className="flex flex-1 min-w-0 items-center gap-3.5 bg-transparent border-0 p-0 text-left cursor-pointer"
                                onClick={() => handleViewNotification(item)}
                                type="button"
                              >
                                {/* Contextual Icon Box */}
                                <div className="flex size-9.5 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground group-hover:text-foreground group-hover:border-border shrink-0 transition-colors">
                                  {renderItemIcon(item, title)}
                                </div>

                                {/* Title & Description */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-sans font-medium text-[13px] text-foreground leading-tight">
                                      {title}
                                    </span>
                                    {item.unread && (
                                      <span className="size-1.5 rounded-full bg-primary/70 shrink-0" />
                                    )}
                                  </div>
                                  <div className="font-sans text-[11.5px] text-muted-foreground mt-1 truncate leading-tight">
                                    {description}
                                  </div>
                                </div>
                              </button>

                              {/* Timestamp & Overflow Menu */}
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                                  {formatCardTime(item.timestamp)}
                                </span>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild={true}>
                                    <button
                                      aria-label="Notification actions"
                                      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                      onClick={(e) => e.stopPropagation()}
                                      type="button"
                                    >
                                      <MoreVertical className="size-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-36 rounded-xl border border-border bg-popover backdrop-blur-xl p-1 text-foreground shadow-xl"
                                  >
                                    <DropdownMenuItem
                                      className="text-xs cursor-pointer rounded-lg px-2.5 py-1.5 focus:bg-muted"
                                      onClick={() => toggleRead(item.id)}
                                    >
                                      {item.unread
                                        ? "Mark as read"
                                        : "Mark as unread"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-xs cursor-pointer rounded-lg px-2.5 py-1.5 text-rose-400 focus:bg-rose-500/15 focus:text-rose-300"
                                      onClick={() =>
                                        removeNotification(item.id)
                                      }
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border/60 bg-popover/60 px-4 py-2.5">
          <button
            className="font-sans text-xs text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none p-0 cursor-pointer"
            onClick={() => clearAll()}
            type="button"
          >
            Clear all
          </button>
          <button
            className="rounded-xl px-5 py-1.5 bg-muted/40 hover:bg-accent border border-border text-xs font-medium text-foreground transition-colors cursor-pointer shadow-xs"
            onClick={() => setOpen(false)}
            type="button"
          >
            Close
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
