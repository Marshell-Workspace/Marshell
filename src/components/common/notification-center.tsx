"use client";

import { Bell, CheckCheck, Sparkles, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";
import { Button } from "@/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/popover";
import { ScrollArea } from "@/components/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/tabs";
import { LiquidGlassCard } from "@/components/ui/liquid-glass-card";
import {
  getNotificationIcon,
  type NotificationItem,
} from "@/config/notifications";
import { useTranslations } from "@/i18n";
import { useNotificationStore } from "@/stores/notification-store";

const KNOWN_NOTIFICATION_I18N_KEYS = new Set([
  "emptyTitle",
  "emptyDescription",
  "title",
  "markAllRead",
  "all",
  "unread",
  "seeAll",
  "loginTitle",
  "loginDescription",
  "loginTime",
  "mentionTitle",
  "mentionDescription",
  "mentionTime",
  "reportTitle",
  "reportDescription",
  "reportTime",
  "exportTitle",
  "exportDescription",
  "exportTime",
  "versionTitle",
  "versionDescription",
  "versionTime",
]);

export function NotificationCenter() {
  const t = useTranslations("NotificationCenter");
  const {
    isOpen,
    setOpen,
    items,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  } = useNotificationStore();

  const unreadItems = items.filter((item) => item.unread);
  const unreadCount = unreadItems.length;
  const hasUnread = unreadCount > 0;

  return (
    <Popover onOpenChange={setOpen} open={isOpen}>
      <PopoverTrigger asChild={true}>
        <div className="relative inline-flex">
          <Button
            aria-label="Notifications"
            className="relative size-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 hover:border-white/40 transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_1.5px_rgba(255,255,255,0.4)] backdrop-blur-xl hover:scale-[1.03] active:scale-[0.97]"
            size="icon"
            type="button"
            variant="ghost"
          >
            <Bell className="size-4 text-white drop-shadow transition-colors" />
          </Button>
          {hasUnread && (
            <span className="pointer-events-none absolute top-0.5 right-0.5 z-20 flex size-2.5 items-center justify-center">
              <span className="absolute size-full animate-ping rounded-full bg-white opacity-85" />
              <span className="relative size-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,1)] border border-black/40" />
            </span>
          )}
        </div>
      </PopoverTrigger>

      {/* Real Liquid Glass Popover Container */}
      <PopoverContent
        align="end"
        className="relative flex flex-col w-88 p-0 gap-0 shadow-[0_20px_60px_rgba(0,0,0,0.7),inset_0_1.5px_2px_rgba(255,255,255,0.3)] sm:w-[420px] rounded-[26px] bg-black/80 backdrop-blur-2xl border border-white/20 overflow-hidden z-50 transition-all text-white max-h-[85vh] sm:max-h-[560px]"
        style={{
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        {/* Header Bar */}
        <div className="shrink-0 relative flex items-center justify-between border-b border-white/15 px-4 sm:px-5 py-3.5 bg-white/[0.04] backdrop-blur-2xl gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex size-7 items-center justify-center rounded-full bg-white/10 border border-white/20 shadow-xs">
              <Sparkles className="size-3.5 text-white/90 drop-shadow" />
            </div>
            <span className="font-bold text-base tracking-tight text-white drop-shadow-sm">
              {t("title")}
            </span>
            {hasUnread && (
              <span className="rounded-full bg-white/10 border border-white/20 px-2 py-0.5 font-mono text-[10.5px] text-white/90 font-medium shadow-xs backdrop-blur-md">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {hasUnread && (
              <Button
                className="h-7 px-2.5 sm:px-3 text-xs font-medium text-white/90 hover:text-white hover:bg-white/15 border border-white/20 hover:border-white/30 rounded-full transition-all backdrop-blur-md"
                onClick={() => markAllAsRead()}
                size="sm"
                variant="ghost"
              >
                <CheckCheck className="size-3.5 mr-1 text-white/90" />
                {t("markAllRead")}
              </Button>
            )}
            <Button
              aria-label="Close notifications"
              className="size-7 rounded-full p-0 text-white hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all shadow-xs shrink-0"
              onClick={() => setOpen(false)}
              size="icon"
              variant="ghost"
            >
              <X className="size-4 text-white drop-shadow" />
            </Button>
          </div>
        </div>

        {/* Tabs Header */}
        <Tabs
          className="flex flex-col flex-1 min-h-0 gap-0 overflow-hidden"
          defaultValue="all"
        >
          <div className="shrink-0 px-3.5 py-2.5 border-b border-white/15 bg-white/[0.02]">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-white/[0.04] border border-white/15 p-1 backdrop-blur-xl shadow-inner">
              <TabsTrigger
                className="text-xs font-medium rounded-xl transition-all duration-200 data-[state=active]:bg-white/15 data-[state=active]:text-white data-[state=active]:shadow-[0_2px_12px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)] data-[state=active]:border data-[state=active]:border-white/25"
                value="all"
              >
                {t("all")} ({items.length})
              </TabsTrigger>
              <TabsTrigger
                className="text-xs font-medium rounded-xl transition-all duration-200 data-[state=active]:bg-white/15 data-[state=active]:text-white data-[state=active]:shadow-[0_2px_12px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)] data-[state=active]:border data-[state=active]:border-white/25"
                value="unread"
              >
                {t("unread")} ({unreadCount})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            className="flex-1 min-h-0 m-0 overflow-hidden flex flex-col data-[state=inactive]:hidden"
            value="all"
          >
            <ScrollArea className="h-[340px] max-h-[50vh] w-full">
              <div className="p-3">
                <NotificationList
                  items={items}
                  onMarkRead={markAsRead}
                  onRemove={removeNotification}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent
            className="flex-1 min-h-0 m-0 overflow-hidden flex flex-col data-[state=inactive]:hidden"
            value="unread"
          >
            <ScrollArea className="h-[340px] max-h-[50vh] w-full">
              <div className="p-3">
                <NotificationList
                  items={unreadItems}
                  onMarkRead={markAsRead}
                  onRemove={removeNotification}
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer Bar */}
        {items.length > 0 && (
          <div className="shrink-0 relative flex items-center justify-between border-t border-white/15 bg-white/[0.04] backdrop-blur-2xl px-4 py-2.5">
            <Button
              className="h-7 rounded-full text-xs font-medium text-white/75 hover:text-white hover:bg-white/15 border border-transparent transition-all cursor-pointer"
              onClick={() => clearAll()}
              size="sm"
              variant="ghost"
            >
              Clear all
            </Button>
            <Button
              className="h-7 rounded-full text-xs font-semibold text-white bg-white/15 border border-white/25 hover:bg-white/25 hover:border-white/40 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] cursor-pointer"
              onClick={() => setOpen(false)}
              size="sm"
              variant="ghost"
            >
              Close
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface NotificationListProps {
  items: NotificationItem[];
  onMarkRead: (id: string) => void;
  onRemove: (id: string) => void;
}

function NotificationList({
  items,
  onMarkRead,
  onRemove,
}: NotificationListProps) {
  const t = useTranslations("NotificationCenter");

  if (!items.length) {
    return (
      <Empty className="rounded-2xl border border-dashed border-white/20 bg-white/[0.03] backdrop-blur-xl py-7 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Bell className="size-5.5 text-white/90 drop-shadow" />
          </EmptyMedia>
          <EmptyTitle className="text-sm font-semibold text-white drop-shadow-sm">
            {t("emptyTitle")}
          </EmptyTitle>
          <EmptyDescription className="text-xs text-white/70">
            {t("emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  // Pure translation helper: checks known i18n keys first to prevent missing message console warnings
  const renderText = (textKeyOrRaw: string) => {
    if (KNOWN_NOTIFICATION_I18N_KEYS.has(textKeyOrRaw)) {
      return t(textKeyOrRaw as never);
    }
    return textKeyOrRaw;
  };

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => {
        const IconComponent = getNotificationIcon(item.iconName, item.type);

        return (
          <LiquidGlassCard
            blurIntensity="xl"
            borderRadius="18px"
            className={`group flex w-full flex-col gap-2.5 border p-3.5 text-left transition-all duration-200 overflow-hidden ${
              item.unread
                ? "border-white/20 bg-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.3)] hover:border-white/35 hover:bg-white/10"
                : "border-white/15 bg-white/[0.03] opacity-85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] hover:bg-white/[0.08] hover:border-white/25 hover:opacity-100"
            }`}
            draggable={false}
            glowIntensity="sm"
            hoverScale={false}
            key={item.id}
            shadowIntensity="sm"
          >
            {/* Header row inside card */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="size-6.5 shrink-0 border border-white/25 bg-white/10 backdrop-blur-xl shadow-xs">
                  {item.avatar && (
                    <AvatarImage alt={item.title} src={item.avatar} />
                  )}
                  <AvatarFallback className="bg-transparent">
                    <IconComponent className="size-3.5 text-white drop-shadow" />
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-xs font-semibold text-white drop-shadow-sm">
                  {renderText(item.title)}
                </span>
                <span className="shrink-0 font-medium text-[10px] text-white/65">
                  • {renderText(item.time)}
                </span>
              </div>

              {/* Status pill & remove action */}
              <div className="flex shrink-0 items-center gap-1.5">
                {item.unread ? (
                  <span className="rounded-full border border-white/25 bg-white/15 px-2 py-0.5 font-mono text-[9px] font-bold text-white shadow-xs backdrop-blur-md">
                    Unread
                  </span>
                ) : (
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[9px] font-medium text-white/60 backdrop-blur-xs">
                    Read
                  </span>
                )}
                <button
                  className="opacity-0 transition-all duration-150 group-hover:opacity-100 p-1 text-white/60 hover:text-white rounded-full hover:bg-white/20 border border-transparent hover:border-white/25"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  title="Remove notification"
                  type="button"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Notification description text */}
            <button
              className="text-left w-full cursor-pointer"
              onClick={() => onMarkRead(item.id)}
              type="button"
            >
              <p className="line-clamp-2 text-white/85 text-[11.5px] leading-relaxed drop-shadow-xs">
                {renderText(item.description)}
              </p>
            </button>

            {/* Glass Action Pills at bottom of card */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                className="rounded-full border border-white/25 bg-white/10 hover:bg-white/20 px-3 py-1 text-[10.5px] font-semibold text-white backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] transition-all active:scale-[0.96]"
                onClick={() => onMarkRead(item.id)}
                type="button"
              >
                View
              </button>
              <button
                className="rounded-full border border-white/15 bg-white/5 hover:bg-white/15 px-3 py-1 text-[10.5px] font-medium text-white/80 hover:text-white backdrop-blur-sm shadow-xs transition-all active:scale-[0.96]"
                onClick={() => onRemove(item.id)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </LiquidGlassCard>
        );
      })}
    </div>
  );
}
