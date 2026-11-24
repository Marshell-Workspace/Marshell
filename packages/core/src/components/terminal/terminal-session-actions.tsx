"use client";

import { useTranslations } from "@workspace/i18n";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@workspace/ui/components/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@workspace/ui/components/dropdown-menu";

export function TerminalSessionActions({
  kind,
  onReleaseFocus,
  onSendEscape,
  onSendInterrupt,
  onClear,
  onRestart,
  disabled,
}: {
  kind: "context" | "dropdown";
  onReleaseFocus: () => void;
  onSendEscape: () => void;
  onSendInterrupt: () => void;
  onClear: () => void;
  onRestart: () => void;
  disabled: boolean;
}) {
  const t = useTranslations("TerminalActions");
  const Item = kind === "context" ? ContextMenuItem : DropdownMenuItem;
  const Separator =
    kind === "context" ? ContextMenuSeparator : DropdownMenuSeparator;
  const Shortcut =
    kind === "context" ? ContextMenuShortcut : DropdownMenuShortcut;
  return (
    <>
      <Item onSelect={onReleaseFocus}>
        {t("releaseFocus")}
        <Shortcut>Shift+Esc</Shortcut>
      </Item>
      <Item disabled={disabled} onSelect={onSendEscape}>
        {t("sendEscape")}
      </Item>
      <Item disabled={disabled} onSelect={onSendInterrupt}>
        {t("sendInterrupt")}
      </Item>
      <Separator />
      <Item onSelect={onClear}>{t("clearTerminal")}</Item>
      <Item onSelect={onRestart}>{t("restartSession")}</Item>
    </>
  );
}
