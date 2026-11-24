"use client";

import {
  type PerformanceTier,
  usePerformanceStore,
} from "@workspace/core/stores/performance-store";
import { useTranslations } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { cn } from "@workspace/ui/lib/utils";
import { Check, RotateCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { SettingRow, SettingsSectionHeading } from "./setting-row";

const PROFILES = [
  { id: "performance", key: "turbo" },
  { id: "balanced", key: "balanced" },
  { id: "eco", key: "eco" },
] as const satisfies readonly { id: PerformanceTier; key: string }[];

/** The same springy spring the sidebar highlight uses. */
const SELECT_SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 21.2,
  mass: 0.9,
} as const;

export function PerformanceSettingsCard() {
  const t = useTranslations("Performance");
  const reduceMotion = useReducedMotion();
  const userTier = usePerformanceStore((state) => state.userTier);
  const tier = usePerformanceStore((state) => state.tier);
  const autoDetected = usePerformanceStore((state) => state.autoDetected);
  const batterySupported = usePerformanceStore(
    (state) => state.battery.supported
  );
  const setTier = usePerformanceStore((state) => state.setTier);
  const initTier = usePerformanceStore((state) => state.initTier);
  const autoEco = usePerformanceStore((state) => state.autoEcoOnLowBattery);
  const setAutoEco = usePerformanceStore(
    (state) => state.setAutoEcoOnLowBattery
  );
  const activeProfile =
    PROFILES.find((profile) => profile.id === tier) ?? PROFILES[1];

  let source = t("batteryLabel");
  if (tier === userTier) {
    source = autoDetected ? t("autoSelected") : t("yourSelection");
  }

  return (
    <div className="w-full max-w-3xl space-y-10 text-foreground">
      <div className="space-y-2">
        <h2 className="font-semibold text-xl tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("description")}
        </p>
      </div>

      <section className="space-y-2">
        <SettingsSectionHeading>{t("modeLabel")}</SettingsSectionHeading>
        <fieldset className="m-0 divide-y divide-border border-border border-y p-0">
          <legend className="sr-only">{t("modeLabel")}</legend>
          {PROFILES.map((profile) => {
            const selected = userTier === profile.id;
            return (
              <label
                className="group relative isolate flex cursor-pointer items-start justify-between gap-5 py-4 pr-3 pl-5"
                key={profile.id}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  name="performance-profile"
                  onChange={() => setTier(profile.id)}
                  type="radio"
                  value={profile.id}
                />
                {selected && (
                  <>
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 bg-accent/50"
                      layoutId="performance-wash"
                      transition={
                        reduceMotion ? { duration: 0 } : SELECT_SPRING
                      }
                    />
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary"
                      layoutId="performance-rail"
                      transition={
                        reduceMotion ? { duration: 0 } : SELECT_SPRING
                      }
                    />
                  </>
                )}
                <span className="min-w-0 space-y-1">
                  <span
                    className={cn(
                      "flex items-center gap-3 font-medium text-sm transition-colors",
                      selected
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {t(`${profile.key}Label`)}
                    {profile.id === "balanced" && (
                      <span className="font-normal text-subtle text-xs">
                        {t("recommended")}
                      </span>
                    )}
                  </span>
                  <span className="block text-muted-foreground text-xs leading-relaxed">
                    {t(`${profile.key}Description`)}
                  </span>
                </span>
                <Check
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 size-4 shrink-0 text-[var(--accent-ink)] transition-opacity",
                    selected ? "opacity-100" : "opacity-0"
                  )}
                />
              </label>
            );
          })}
        </fieldset>
      </section>

      <section>
        <SettingRow
          description={
            batterySupported ? t("batteryDescription") : t("batteryUnsupported")
          }
          id="performance-battery-saver"
          label={t("batteryLabel")}
        >
          <Switch
            checked={autoEco && batterySupported}
            disabled={!batterySupported}
            id="performance-battery-saver"
            onCheckedChange={setAutoEco}
          />
        </SettingRow>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <p className="text-muted-foreground text-xs" role="status">
            {t("activeMode")}{" "}
            <span className="font-medium text-foreground">
              {t(`${activeProfile.key}Label`)}
            </span>
            <span className="text-subtle"> · {source}</span>
          </p>
          <Button
            className="-mr-2 h-8 cursor-pointer gap-1.5 px-2 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
            onClick={() => {
              usePerformanceStore.setState({ autoDetected: true });
              initTier();
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <RotateCw className="size-3.5" />
            {t("autoDetect")}
          </Button>
        </div>
      </section>
    </div>
  );
}
