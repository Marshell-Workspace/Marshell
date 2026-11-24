"use client";

import { useResolvedTheme } from "@workspace/core/hooks/use-resolved-theme";
import { CONTRAST_MODES } from "@workspace/core/lib/theme";
import {
  type ContrastMode,
  type ThemeMode,
  useGeneralSettingsStore,
} from "@workspace/core/stores/general-settings-store";
import { cn } from "@workspace/ui/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import type { ComponentType } from "react";
import { AccentColorSection } from "./accent-color-section";
import { SettingRow } from "./setting-row";

const THEME_OPTIONS: readonly {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  value: ThemeMode;
}[] = [
  { value: "system", label: "System default", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

function ThemeControl() {
  const theme = useGeneralSettingsStore((s) => s.theme);
  const setTheme = useGeneralSettingsStore((s) => s.setTheme);

  return (
    <fieldset
      aria-describedby="appearance-theme-description"
      className="inline-flex rounded-lg border border-border p-0.5"
      id="appearance-theme"
    >
      <legend className="sr-only">Theme</legend>
      {THEME_OPTIONS.map(({ value, label, Icon }) => {
        const selected = theme === value;
        return (
          <label
            className={cn(
              "flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/50",
              selected
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            key={value}
            title={label}
          >
            <input
              checked={selected}
              className="sr-only"
              name="appearance-theme"
              onChange={() => setTheme(value)}
              type="radio"
              value={value}
            />
            <Icon className="size-4" />
            <span className="sr-only">{label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

const CONTRAST_LABELS: Record<ContrastMode, string> = {
  low: "Low",
  default: "Standard",
  high: "High",
};

const CONTRAST_HINTS: Record<"light" | "dark", Record<ContrastMode, string>> = {
  dark: {
    low: "Softer greys and lighter text on a lifted dark canvas. Easier on the eyes at night.",
    default: "The balanced dark palette.",
    high: "Near-black canvas, brighter text and stronger borders for clearer separation.",
  },
  light: {
    low: "Gentler ink and faint borders on warm paper. Lowest glare.",
    default: "The balanced light palette.",
    high: "Deeper ink and darker borders on the same paper tone. Never pure white.",
  },
};

function ContrastControl() {
  const contrast = useGeneralSettingsStore((s) => s.contrast);
  const setContrast = useGeneralSettingsStore((s) => s.setContrast);

  return (
    <fieldset
      aria-describedby="appearance-contrast-description"
      className="inline-flex rounded-lg border border-border p-0.5"
      id="appearance-contrast"
    >
      <legend className="sr-only">Contrast</legend>
      {CONTRAST_MODES.map((mode) => {
        const selected = contrast === mode;
        return (
          <label
            className={cn(
              "flex h-8 min-w-16 cursor-pointer items-center justify-center rounded-md px-3 font-medium text-xs transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/50",
              selected
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            key={mode}
          >
            <input
              checked={selected}
              className="sr-only"
              name="appearance-contrast"
              onChange={() => setContrast(mode)}
              type="radio"
              value={mode}
            />
            {CONTRAST_LABELS[mode]}
          </label>
        );
      })}
    </fieldset>
  );
}

export function AppearanceSettingsTab() {
  const resolvedTheme = useResolvedTheme();
  const contrast = useGeneralSettingsStore((s) => s.contrast);

  return (
    <div className="w-full space-y-8 text-foreground">
      <div className="space-y-2">
        <h2 className="font-semibold text-xl tracking-tight">Appearance</h2>
        <p className="text-muted-foreground text-sm">
          Customize themes, dark and light mode, and color accents.
        </p>
      </div>

      <section>
        <SettingRow
          description="Choose between light, dark, or follow your operating system appearance."
          id="appearance-theme"
          label="Theme"
        >
          <ThemeControl />
        </SettingRow>

        <SettingRow
          description={`${resolvedTheme === "dark" ? "Dark" : "Light"} appearance · ${CONTRAST_HINTS[resolvedTheme][contrast]}`}
          id="appearance-contrast"
          label="Contrast"
        >
          <ContrastControl />
        </SettingRow>

        <AccentColorSection />
      </section>
    </div>
  );
}
