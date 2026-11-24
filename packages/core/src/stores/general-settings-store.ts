"use client";

import {
  DEFAULT_ACCENT_ID,
  ensureDarkContrast,
  isValidAccentId,
  parseHexColor,
} from "@workspace/core/lib/accent-colors";
import { safeStorage } from "@workspace/core/lib/safe-json";
import {
  type AccentOption,
  applyAccent,
  applyContrast,
  applyTheme,
  type ContrastMode,
  isContrastMode,
  type ThemeMode,
} from "@workspace/core/lib/theme";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type {
  AccentOption,
  ContrastMode,
  ThemeMode,
} from "@workspace/core/lib/theme";

export type ShellOption =
  | "default"
  | "powershell"
  | "bash"
  | "cmd"
  | "zsh"
  | "gitbash";

export type TerminalCursorStyle = "block" | "bar" | "underline";

export const TERMINAL_FONT_SIZE_RANGE = { min: 10, max: 24 } as const;
export const TERMINAL_SCROLLBACK_OPTIONS = [
  1000, 5000, 10_000, 50_000,
] as const;
export const DEFAULT_TERMINAL_FONT_SIZE = 13;
export const DEFAULT_TERMINAL_SCROLLBACK = 5000;

const TERMINAL_CURSOR_STYLES: readonly TerminalCursorStyle[] = [
  "block",
  "bar",
  "underline",
];

export function clampTerminalFontSize(size: number): number {
  if (!Number.isFinite(size)) {
    return DEFAULT_TERMINAL_FONT_SIZE;
  }
  return Math.min(
    TERMINAL_FONT_SIZE_RANGE.max,
    Math.max(TERMINAL_FONT_SIZE_RANGE.min, Math.round(size))
  );
}

export function normalizeTerminalScrollback(lines: number): number {
  return (TERMINAL_SCROLLBACK_OPTIONS as readonly number[]).includes(lines)
    ? lines
    : DEFAULT_TERMINAL_SCROLLBACK;
}

export interface GeneralSettingsState {
  accent: AccentOption;
  addRecentCustomAccent: (hex: string) => void;
  // Privacy & Security
  anonymousDiagnostics: boolean;
  autoSaveSession: boolean;
  codeNotifications: boolean;
  contrast: ContrastMode;
  customAccentHex: string;
  // Workspace & Terminal
  defaultShell: ShellOption;
  // App-level consent only. Tauri's desktop permission API cannot report macOS authorization.
  macNativeNotificationConsent: boolean;
  nativeBanners: boolean;
  permissionRequests: boolean;
  recentCustomAccents: string[];
  resetToDefaults: () => void;

  // Notifications
  responseCompletions: boolean;
  restoreTabsOnStartup: boolean;
  scheduledTasks: boolean;
  secureStorage: boolean;
  setAccent: (accent: AccentOption) => void;
  setAnonymousDiagnostics: (enabled: boolean) => void;
  setAutoSaveSession: (enabled: boolean) => void;
  setCodeNotifications: (enabled: boolean) => void;
  setContrast: (contrast: ContrastMode) => void;
  setCustomAccent: (hex: string) => void;

  // Actions
  setDefaultShell: (shell: ShellOption) => void;
  setMacNativeNotificationConsent: (enabled: boolean) => void;
  setNativeBanners: (enabled: boolean) => void;
  setPermissionRequests: (enabled: boolean) => void;
  setResponseCompletions: (enabled: boolean) => void;
  setRestoreTabsOnStartup: (enabled: boolean) => void;
  setScheduledTasks: (enabled: boolean) => void;
  setSecureStorage: (enabled: boolean) => void;
  setSoundCues: (enabled: boolean) => void;
  setTerminalCursorBlink: (enabled: boolean) => void;
  setTerminalCursorStyle: (style: TerminalCursorStyle) => void;
  setTerminalFontSize: (size: number) => void;
  setTerminalScrollback: (lines: number) => void;
  setTheme: (theme: ThemeMode) => void;
  soundCues: boolean;
  // Terminal appearance
  terminalCursorBlink: boolean;
  terminalCursorStyle: TerminalCursorStyle;
  terminalFontSize: number;
  terminalScrollback: number;
  // Appearance
  theme: ThemeMode;
}

export const DEFAULT_GENERAL_SETTINGS: Omit<
  GeneralSettingsState,
  | "setTheme"
  | "setContrast"
  | "setAccent"
  | "setCustomAccent"
  | "addRecentCustomAccent"
  | "setDefaultShell"
  | "setAutoSaveSession"
  | "setRestoreTabsOnStartup"
  | "setResponseCompletions"
  | "setScheduledTasks"
  | "setCodeNotifications"
  | "setPermissionRequests"
  | "setNativeBanners"
  | "setMacNativeNotificationConsent"
  | "setSoundCues"
  | "setTerminalCursorBlink"
  | "setTerminalCursorStyle"
  | "setTerminalFontSize"
  | "setTerminalScrollback"
  | "setAnonymousDiagnostics"
  | "setSecureStorage"
  | "resetToDefaults"
> = {
  theme: "system",
  contrast: "default",
  accent: "mint",
  customAccentHex: "#38bdf8",
  recentCustomAccents: [],
  defaultShell: "default",
  autoSaveSession: true,
  restoreTabsOnStartup: true,
  responseCompletions: true,
  scheduledTasks: true,
  codeNotifications: true,
  permissionRequests: true,
  nativeBanners: true,
  macNativeNotificationConsent: false,
  soundCues: true,
  terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE,
  terminalCursorStyle: "block",
  terminalCursorBlink: true,
  terminalScrollback: DEFAULT_TERMINAL_SCROLLBACK,
  anonymousDiagnostics: true,
  secureStorage: true,
};

export const useGeneralSettingsStore = create<GeneralSettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_GENERAL_SETTINGS,

      setTheme: (theme: ThemeMode) => {
        set({ theme });
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("marshell-theme", theme);
          } catch {}
          applyTheme(theme);
        }
      },
      setContrast: (contrast: ContrastMode) => {
        const safe: ContrastMode = isContrastMode(contrast)
          ? contrast
          : "default";
        set({ contrast: safe });
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("marshell-contrast", safe);
          } catch {}
          applyContrast(safe);
        }
      },
      setAccent: (accent: AccentOption) => {
        const safeAccent: AccentOption = isValidAccentId(accent)
          ? accent
          : DEFAULT_ACCENT_ID;
        set({ accent: safeAccent });
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("marshell-accent", safeAccent);
          } catch {}
          const customHex = get().customAccentHex;
          applyAccent(safeAccent, customHex);
        }
      },
      setCustomAccent: (hex: string) => {
        const normalized = parseHexColor(hex);
        if (!normalized) {
          return;
        }
        const { hex: safeHex } = ensureDarkContrast(normalized);
        const currentRecents = get().recentCustomAccents || [];
        const updatedRecents = [
          safeHex,
          ...currentRecents.filter(
            (c) => c.toLowerCase() !== safeHex.toLowerCase()
          ),
        ].slice(0, 8);

        set({
          accent: "custom",
          customAccentHex: safeHex,
          recentCustomAccents: updatedRecents,
        });

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("marshell-accent", "custom");
            localStorage.setItem("marshell-custom-accent", safeHex);
            localStorage.setItem(
              "marshell-recent-accents",
              JSON.stringify(updatedRecents)
            );
          } catch {}
          applyAccent("custom", safeHex);
        }
      },
      addRecentCustomAccent: (hex: string) => {
        const normalized = parseHexColor(hex);
        if (!normalized) {
          return;
        }
        const { hex: safeHex } = ensureDarkContrast(normalized);
        const currentRecents = get().recentCustomAccents || [];
        const updatedRecents = [
          safeHex,
          ...currentRecents.filter(
            (c) => c.toLowerCase() !== safeHex.toLowerCase()
          ),
        ].slice(0, 8);

        set({ recentCustomAccents: updatedRecents });
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              "marshell-recent-accents",
              JSON.stringify(updatedRecents)
            );
          } catch {}
        }
      },
      setDefaultShell: (defaultShell: ShellOption) => set({ defaultShell }),
      setAutoSaveSession: (autoSaveSession: boolean) =>
        set({ autoSaveSession }),
      setRestoreTabsOnStartup: (restoreTabsOnStartup: boolean) =>
        set({ restoreTabsOnStartup }),

      setResponseCompletions: (responseCompletions: boolean) =>
        set({ responseCompletions }),
      setScheduledTasks: (scheduledTasks: boolean) => set({ scheduledTasks }),
      setCodeNotifications: (codeNotifications: boolean) =>
        set({ codeNotifications }),
      setPermissionRequests: (permissionRequests: boolean) =>
        set({ permissionRequests }),
      setNativeBanners: (nativeBanners: boolean) => set({ nativeBanners }),
      setMacNativeNotificationConsent: (
        macNativeNotificationConsent: boolean
      ) => set({ macNativeNotificationConsent }),
      setSoundCues: (soundCues: boolean) => set({ soundCues }),
      setTerminalFontSize: (size: number) =>
        set({ terminalFontSize: clampTerminalFontSize(size) }),
      setTerminalCursorStyle: (style: TerminalCursorStyle) =>
        set({
          terminalCursorStyle: TERMINAL_CURSOR_STYLES.includes(style)
            ? style
            : "block",
        }),
      setTerminalCursorBlink: (terminalCursorBlink: boolean) =>
        set({ terminalCursorBlink }),
      setTerminalScrollback: (lines: number) =>
        set({ terminalScrollback: normalizeTerminalScrollback(lines) }),

      setAnonymousDiagnostics: (anonymousDiagnostics: boolean) =>
        set({ anonymousDiagnostics }),
      setSecureStorage: (secureStorage: boolean) => set({ secureStorage }),

      resetToDefaults: () => {
        set(DEFAULT_GENERAL_SETTINGS);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("marshell-theme", "system");
            localStorage.setItem("marshell-contrast", "default");
            localStorage.setItem("marshell-accent", "mint");
            localStorage.removeItem("marshell-custom-accent");
          } catch {}
          applyTheme("system");
          applyContrast("default");
          applyAccent("mint");
        }
      },
    }),
    {
      name: "marshell-general-settings",
      storage: createJSONStorage(() => safeStorage),
      onRehydrateStorage: () => (state) => {
        if (typeof window !== "undefined") {
          if (state?.theme) {
            applyTheme(state.theme);
          }
          applyContrast(
            isContrastMode(state?.contrast) ? state.contrast : "default"
          );
          const accent = state?.accent;
          const customHex = state?.customAccentHex;
          if (accent && isValidAccentId(accent)) {
            applyAccent(accent, customHex);
          } else {
            // Presets retired in the curated 10-accent set fall back to mint.
            applyAccent("mint");
            if (accent) {
              queueMicrotask(() =>
                useGeneralSettingsStore.setState({ accent: "mint" })
              );
            }
          }
        }
      },
    }
  )
);
