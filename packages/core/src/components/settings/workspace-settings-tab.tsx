"use client";

import { checkIsNativeApp } from "@workspace/core/lib/notification-service";
import {
  clampTerminalFontSize,
  DEFAULT_TERMINAL_FONT_SIZE,
  type ShellOption,
  TERMINAL_SCROLLBACK_OPTIONS,
  type TerminalCursorStyle,
  useGeneralSettingsStore,
} from "@workspace/core/stores/general-settings-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import { useEffect, useState } from "react";
import { KeychainAccessCard } from "./keychain-access-card";
import { SettingRow, SettingsSectionHeading } from "./setting-row";

/** `installed` is the backend's list of shells that can really be started. */
export function getShellOptions(
  windows: boolean,
  installed?: readonly string[]
): { value: ShellOption; label: string }[] {
  const options: { value: ShellOption; label: string }[] = [
    { value: "default", label: "System default" },
    {
      value: "powershell",
      label: windows ? "Windows PowerShell" : "PowerShell (pwsh)",
    },
    { value: "bash", label: "Bash" },
  ];
  if (windows) {
    options.push(
      { value: "cmd", label: "Command Prompt" },
      { value: "gitbash", label: "Git Bash" }
    );
  } else {
    options.push({ value: "zsh", label: "Zsh" });
  }
  if (!installed) {
    return options;
  }
  return options.filter(
    (option) => option.value === "default" || installed.includes(option.value)
  );
}

const SHELL_LABELS: Record<ShellOption, string> = {
  default: "System default",
  powershell: "PowerShell",
  bash: "Bash",
  cmd: "Command Prompt",
  zsh: "Zsh",
  gitbash: "Git Bash",
};

const FONT_SIZES = [11, 12, 13, 14, 15, 16, 18, 20, 24] as const;

const CURSOR_STYLES: { value: TerminalCursorStyle; label: string }[] = [
  { value: "block", label: "Block" },
  { value: "bar", label: "Bar" },
  { value: "underline", label: "Underline" },
];

export function WorkspaceSettingsTab() {
  const settings = useGeneralSettingsStore();
  const [native, setNative] = useState(false);
  const [windows, setWindows] = useState(false);
  const [installedShells, setInstalledShells] = useState<string[] | null>(null);

  useEffect(() => {
    setNative(checkIsNativeApp());
    setWindows(/Windows/i.test(navigator.userAgent));
  }, []);

  // Ask the desktop backend which shells exist instead of guessing from the OS.
  useEffect(() => {
    if (!native) {
      return;
    }
    let active = true;
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke<string[]>("list_available_shells"))
      .then((list) => {
        if (active) {
          setInstalledShells(list);
        }
      })
      .catch(() => {
        // Older backends: fall back to the per-OS list.
      });
    return () => {
      active = false;
    };
  }, [native]);

  const shells = getShellOptions(
    installedShells ? installedShells.includes("cmd") : windows,
    installedShells ?? undefined
  );
  // A saved shell that this platform lacks must still show up, not a blank select.
  const shellOptions = shells.some(
    (shell) => shell.value === settings.defaultShell
  )
    ? shells
    : [
        ...shells,
        {
          value: settings.defaultShell,
          label: `${SHELL_LABELS[settings.defaultShell]} (unavailable here)`,
        },
      ];
  const fontSizes = FONT_SIZES.some(
    (size) => size === settings.terminalFontSize
  )
    ? FONT_SIZES
    : [...FONT_SIZES, settings.terminalFontSize].sort((a, b) => a - b);

  return (
    <div className="w-full space-y-8 text-foreground">
      <div className="space-y-2">
        <h2 className="font-semibold text-xl tracking-tight">
          Workspaces &amp; Terminals
        </h2>
        <p className="text-muted-foreground text-sm">
          Preferences for shells, layout persistence, and startup behavior.
        </p>
      </div>

      <section>
        <SettingsSectionHeading>Shell &amp; startup</SettingsSectionHeading>
        <SettingRow
          description={
            native
              ? "Used for new terminals. The selected shell must be installed; existing terminals keep their shell."
              : "Local command shells are available in the desktop app."
          }
          id="workspace-shell"
          label="Default shell"
        >
          <Select
            disabled={!native}
            onValueChange={(value) => {
              const shell = shellOptions.find(
                (option) => option.value === value
              );
              if (shell) {
                settings.setDefaultShell(shell.value);
              }
            }}
            value={settings.defaultShell}
          >
            <SelectTrigger
              aria-describedby="workspace-shell-description"
              className="h-9 w-44 text-xs"
              id="workspace-shell"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {shellOptions.map((shell) => (
                <SelectItem key={shell.value} value={shell.value}>
                  {shell.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          description="Save workspace tabs, editor views, and panel layout locally. Turning this off keeps your last saved layout."
          id="workspace-auto-save"
          label="Save workspace layout"
        >
          <Switch
            aria-describedby="workspace-auto-save-description"
            checked={settings.autoSaveSession}
            id="workspace-auto-save"
            onCheckedChange={settings.setAutoSaveSession}
            size="sm"
          />
        </SettingRow>

        <SettingRow
          description="Select your last active workspace when Marshell starts. This does not resume running commands."
          id="workspace-restore"
          label="Open last workspace on startup"
        >
          <Switch
            aria-describedby="workspace-restore-description"
            checked={settings.restoreTabsOnStartup}
            id="workspace-restore"
            onCheckedChange={settings.setRestoreTabsOnStartup}
            size="sm"
          />
        </SettingRow>
      </section>

      <section>
        <SettingsSectionHeading>Terminal appearance</SettingsSectionHeading>
        <SettingRow
          description="Text size in every terminal. Changes apply to open terminals right away."
          id="terminal-font-size"
          label="Font size"
        >
          <Select
            onValueChange={(value) =>
              settings.setTerminalFontSize(clampTerminalFontSize(Number(value)))
            }
            value={String(settings.terminalFontSize)}
          >
            <SelectTrigger
              aria-describedby="terminal-font-size-description"
              className="h-9 w-44 text-xs"
              id="terminal-font-size"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fontSizes.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size === DEFAULT_TERMINAL_FONT_SIZE
                    ? `${size} px (default)`
                    : `${size} px`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          description="The shape of the text cursor."
          id="terminal-cursor-style"
          label="Cursor style"
        >
          <Select
            onValueChange={(value) =>
              settings.setTerminalCursorStyle(value as TerminalCursorStyle)
            }
            value={settings.terminalCursorStyle}
          >
            <SelectTrigger
              aria-describedby="terminal-cursor-style-description"
              className="h-9 w-44 text-xs"
              id="terminal-cursor-style"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURSOR_STYLES.map((style) => (
                <SelectItem key={style.value} value={style.value}>
                  {style.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          description="Blink the cursor while a terminal is focused."
          id="terminal-cursor-blink"
          label="Blinking cursor"
        >
          <Switch
            aria-describedby="terminal-cursor-blink-description"
            checked={settings.terminalCursorBlink}
            id="terminal-cursor-blink"
            onCheckedChange={settings.setTerminalCursorBlink}
            size="sm"
          />
        </SettingRow>

        <SettingRow
          description="How many lines of output each terminal keeps for scrolling back. Larger values use more memory."
          id="terminal-scrollback"
          label="Scrollback"
        >
          <Select
            onValueChange={(value) =>
              settings.setTerminalScrollback(Number(value))
            }
            value={String(settings.terminalScrollback)}
          >
            <SelectTrigger
              aria-describedby="terminal-scrollback-description"
              className="h-9 w-44 text-xs"
              id="terminal-scrollback"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TERMINAL_SCROLLBACK_OPTIONS.map((lines) => (
                <SelectItem key={lines} value={String(lines)}>
                  {`${lines.toLocaleString("en-US")} lines`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </section>

      <KeychainAccessCard />
    </div>
  );
}
