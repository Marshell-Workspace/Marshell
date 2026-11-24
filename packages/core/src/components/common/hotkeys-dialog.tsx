"use client";

import { type HotkeyDefinition, hotkeys } from "@workspace/core/config/hotkeys";
import { formatHotkeyDisplay } from "@workspace/core/lib/utils";
import { useHotkeysDialogStore } from "@workspace/core/stores/hotkeys-store";
import { useTranslations } from "@workspace/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { Compass, Sparkles } from "lucide-react";
import React from "react";

function HotkeyRow({ hotkey }: { hotkey: HotkeyDefinition }) {
  const t = useTranslations("HotkeysDialog");
  const keys = formatHotkeyDisplay(hotkey.keys);
  const isSequence = hotkey.keys.includes(">");

  return (
    <div className="group flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors motion-fast hover:bg-accent/60">
      <span className="text-foreground/85 text-sm transition-colors motion-fast group-hover:text-foreground">
        {t(hotkey.translationKey, hotkey.values ?? { number: "1-9" })}
      </span>
      <KbdGroup className="gap-0.5">
        {keys.map((key, i) => (
          <React.Fragment key={key}>
            <Kbd className="border-border/70 bg-muted/50 shadow-2xs transition-colors motion-fast group-hover:border-border group-hover:bg-muted/80">
              {key}
            </Kbd>
            {isSequence && i < keys.length - 1 && (
              <span className="mx-1.5 font-mono text-[10px] text-muted-foreground opacity-70">
                {t("then")}
              </span>
            )}
          </React.Fragment>
        ))}
      </KbdGroup>
    </div>
  );
}

function HotkeySection({
  icon: Icon,
  label,
  items,
}: {
  icon: React.ElementType;
  items: HotkeyDefinition[];
  label: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 px-2.5 font-sans font-semibold text-[10.5px] text-muted-foreground/80 uppercase tracking-wider">
        <Icon className="size-3 text-muted-foreground/60" />
        {label}
      </div>
      <div className="space-y-0.5 rounded-xl border border-border/40 bg-muted/10 p-1">
        {items.map((hotkey) => (
          <HotkeyRow hotkey={hotkey} key={hotkey.id} />
        ))}
      </div>
    </div>
  );
}

function HotkeysList() {
  const t = useTranslations("HotkeysDialog");

  const generalHotkeys = hotkeys.filter((h) => h.category === "general");
  const navigationHotkeys = hotkeys.filter((h) => h.category === "navigation");

  return (
    <div className="space-y-5">
      <HotkeySection
        icon={Sparkles}
        items={generalHotkeys}
        label={t("general")}
      />
      <HotkeySection
        icon={Compass}
        items={navigationHotkeys}
        label={t("navigation")}
      />
    </div>
  );
}

export function HotkeysDialog() {
  const { isOpen, close } = useHotkeysDialogStore();
  const t = useTranslations("HotkeysDialog");
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer onOpenChange={(open) => !open && close()} open={isOpen}>
        <DrawerContent className="p-4">
          <DrawerHeader>
            <DrawerTitle>{t("title")}</DrawerTitle>
            <DrawerDescription>{t("description")}</DrawerDescription>
          </DrawerHeader>
          <div className="no-scrollbar mx-auto w-full max-w-sm overflow-y-auto">
            <HotkeysList />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog onOpenChange={(open) => !open && close()} open={isOpen}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="no-scrollbar -mx-6 flex-1 overflow-y-auto px-6">
          <HotkeysList />
        </div>
      </DialogContent>
    </Dialog>
  );
}
