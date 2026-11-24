"use client";

import { useResolvedTheme } from "@workspace/core/hooks/use-resolved-theme";
import {
  getAutoForeground,
  PRESET_ACCENTS,
  PRESET_MAP,
  type PresetAccent,
} from "@workspace/core/lib/accent-colors";
import {
  type AccentOption,
  useGeneralSettingsStore,
} from "@workspace/core/stores/general-settings-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { Check, Palette } from "lucide-react";
import React, { useCallback, useId, useMemo, useRef, useState } from "react";
import { CustomColorPicker } from "./custom-color-picker";

const CONIC_RAINBOW_GRADIENT =
  "conic-gradient(from 180deg at 50% 50%, #ff0000 0deg, #ffa500 51deg, #ffff00 102deg, #008000 153deg, #0000ff 204deg, #4b0082 255deg, #ee82ee 306deg, #ff0000 360deg)";

/** Presets are laid out in one row: 10 curated accents + Custom. */
const GRID_COLUMNS = 11;

interface PresetTileProps {
  buttonRef: (el: HTMLButtonElement | null) => void;
  isLight: boolean;
  isSelected: boolean;
  onSelect: (id: AccentOption) => void;
  option: PresetAccent;
}

const PresetTile = React.memo(function PresetTile({
  buttonRef,
  isLight,
  isSelected,
  onSelect,
  option,
}: PresetTileProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>
        {/* biome-ignore lint/a11y/useSemanticElements: Accessible WAI-ARIA Radio Group pattern for color swatches */}
        <button
          aria-checked={isSelected}
          aria-label={option.name}
          className={cn(
            "relative size-8 min-w-[26px] min-h-[26px] aspect-square rounded-full transition-transform motion-fast ease-out motion-reduce:transition-none cursor-pointer flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card [@media(hover:hover)]:hover:scale-[1.08]",
            isSelected
              ? "ring-2 ring-foreground ring-offset-3 ring-offset-card"
              : "opacity-90 hover:opacity-100"
          )}
          onClick={() => onSelect(option.id as AccentOption)}
          ref={buttonRef}
          role="radio"
          style={{ backgroundColor: isLight ? option.lightHex : option.hex }}
          tabIndex={isSelected ? 0 : -1}
          type="button"
        >
          {isSelected && (
            <Check
              className="size-3.5 stroke-[2.5]"
              style={{ color: isLight ? option.onLight : option.checkColor }}
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs font-medium">
          {option.name} (
          {(isLight ? option.lightHex : option.hex).toUpperCase()})
        </p>
      </TooltipContent>
    </Tooltip>
  );
});

interface CustomTileProps {
  buttonRef: (el: HTMLButtonElement | null) => void;
  customHex: string;
  isSelected: boolean;
  onClick: () => void;
}

const CustomTile = React.memo(function CustomTile({
  buttonRef,
  customHex,
  isSelected,
  onClick,
}: CustomTileProps) {
  const checkColor = useMemo(() => getAutoForeground(customHex), [customHex]);

  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>
        {/* biome-ignore lint/a11y/useSemanticElements: Accessible WAI-ARIA Radio Group pattern for color swatches */}
        <button
          aria-checked={isSelected}
          aria-label="Custom"
          className={cn(
            "relative size-8 min-w-[26px] min-h-[26px] aspect-square rounded-full transition-transform motion-fast ease-out motion-reduce:transition-none cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card [@media(hover:hover)]:hover:scale-[1.08]",
            isSelected
              ? "ring-2 ring-foreground ring-offset-3 ring-offset-card p-[2px]"
              : "opacity-90 hover:opacity-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]"
          )}
          onClick={onClick}
          ref={buttonRef}
          role="radio"
          style={{ background: CONIC_RAINBOW_GRADIENT }}
          tabIndex={isSelected ? 0 : -1}
          type="button"
        >
          {isSelected ? (
            <span
              className="size-full rounded-full flex items-center justify-center shadow-2xs"
              style={{ backgroundColor: customHex }}
            >
              <Check
                className="size-3.5 stroke-[2.5]"
                style={{ color: checkColor }}
              />
            </span>
          ) : (
            <Palette className="size-3.5 text-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs font-medium">
          Custom... ({customHex.toUpperCase()})
        </p>
      </TooltipContent>
    </Tooltip>
  );
});

export function AccentColorSection() {
  const settings = useGeneralSettingsStore();
  const isLight = useResolvedTheme() === "light";
  const labelId = useId();
  const descId = useId();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [liveCustomHex, setLiveCustomHex] = useState<string | null>(null);
  const [previousAccent, setPreviousAccent] = useState<AccentOption>(
    settings.accent
  );

  // Swatch references for roving keyboard focus and anchoring
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const customButtonRef = useRef<HTMLButtonElement | null>(null);
  const gridCardRef = useRef<HTMLDivElement | null>(null);

  const customHex = settings.customAccentHex || "#38bdf8";
  const activeCustomHex = liveCustomHex || customHex;

  // Compute readout text
  const currentReadout = useMemo(() => {
    if (settings.accent === "custom") {
      return {
        name: "Custom",
        hex: activeCustomHex.toUpperCase(),
      };
    }
    const preset = PRESET_MAP.get(settings.accent) ?? PRESET_MAP.get("mint");
    return {
      name: preset?.name ?? "Mint",
      hex: (isLight
        ? (preset?.lightHex ?? "#15ba81")
        : (preset?.hex ?? "#53e2a6")
      ).toUpperCase(),
    };
  }, [settings.accent, activeCustomHex, isLight]);

  // Total items: 10 presets + 1 custom = 11 (one row)
  const totalItems = PRESET_ACCENTS.length + 1;

  // Selected index (0 to 9 for presets, 10 for custom)
  const selectedIndex = useMemo(() => {
    if (settings.accent === "custom") {
      return PRESET_ACCENTS.length;
    }
    const idx = PRESET_ACCENTS.findIndex((p) => p.id === settings.accent);
    return idx >= 0 ? idx : 0;
  }, [settings.accent]);

  // Handle preset click
  const handlePresetSelect = useCallback(
    (id: AccentOption) => {
      settings.setAccent(id);
      setIsPickerOpen(false);
      setLiveCustomHex(null);
    },
    [settings]
  );

  // Handle custom tile click
  const handleCustomClick = useCallback(() => {
    if (isPickerOpen) {
      // Keep it open and move focus inside (no close-and-reopen flicker)
      const pickerEl = document.querySelector<HTMLElement>(
        '[role="dialog"][aria-labelledby="custom-picker-title"]'
      );
      const focusable = pickerEl?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
      return;
    }
    setPreviousAccent(settings.accent);
    settings.setAccent("custom");
    setIsPickerOpen(true);
  }, [isPickerOpen, settings.accent, settings.setAccent]);

  // Arrow key navigation across the single-row grid (Left/Right moves 1)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let nextIndex: number | null = null;
    const isRtl = document.dir === "rtl";

    if (e.key === "ArrowRight") {
      nextIndex = isRtl
        ? (selectedIndex - 1 + totalItems) % totalItems
        : (selectedIndex + 1) % totalItems;
    } else if (e.key === "ArrowLeft") {
      nextIndex = isRtl
        ? (selectedIndex + 1) % totalItems
        : (selectedIndex - 1 + totalItems) % totalItems;
    } else if (e.key === "ArrowDown") {
      // Down moves down one row (a full row ahead)
      nextIndex = (selectedIndex + GRID_COLUMNS) % totalItems;
    } else if (e.key === "ArrowUp") {
      // Up moves up one row (a full row behind)
      nextIndex = (selectedIndex - GRID_COLUMNS + totalItems) % totalItems;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = totalItems - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      if (nextIndex < PRESET_ACCENTS.length) {
        const target = PRESET_ACCENTS[nextIndex];
        if (target) {
          settings.setAccent(target.id as AccentOption);
        }
      } else {
        settings.setAccent("custom");
      }
      itemRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="border-b border-border py-4 last:border-b-0 space-y-3.5">
      {/* ── Title, description, and selection readout ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <span className="font-medium text-sm text-foreground" id={labelId}>
            Accent color
          </span>
          <p
            className="text-muted-foreground text-xs leading-relaxed"
            id={descId}
          >
            Select an accent color for active indicators, focus halos, and
            highlights.
          </p>
        </div>

        {/* 28px Clean Readout Pill */}
        <div className="flex h-7 items-center gap-1.5 self-start sm:self-center rounded-full border border-border/80 bg-muted/40 px-2.5 text-xs font-medium text-foreground/90 shrink-0">
          <span
            className="size-2 rounded-full ring-1 ring-border shadow-2xs"
            style={{ backgroundColor: currentReadout.hex }}
          />
          <span>{currentReadout.name}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {currentReadout.hex}
          </span>
        </div>
      </div>

      {/* ── Contained Swatch Surface: 9-column grid, 3 rows of 9 ─────────────── */}
      <div
        className="rounded-xl border border-border bg-card/40 p-3.5 sm:p-4 max-w-[420px]"
        ref={gridCardRef}
      >
        <TooltipProvider delayDuration={100}>
          <div
            aria-describedby={descId}
            aria-labelledby={labelId}
            className="grid grid-cols-6 sm:grid-cols-[repeat(11,minmax(0,1fr))] gap-3 place-items-center"
            onKeyDown={handleKeyDown}
            role="radiogroup"
          >
            {PRESET_ACCENTS.map((option, index) => (
              <PresetTile
                buttonRef={(el) => {
                  itemRefs.current[index] = el;
                }}
                isLight={isLight}
                isSelected={settings.accent === option.id}
                key={option.id}
                onSelect={handlePresetSelect}
                option={option}
              />
            ))}

            {/* Custom Color Tile as the last item */}
            <CustomTile
              buttonRef={(el) => {
                itemRefs.current[PRESET_ACCENTS.length] = el;
                customButtonRef.current = el;
              }}
              customHex={activeCustomHex}
              isSelected={settings.accent === "custom" || isPickerOpen}
              onClick={handleCustomClick}
            />
          </div>
        </TooltipProvider>
      </div>

      {/* ── Lazy-mounted CustomColorPicker Popover ──────────────────────────── */}
      {isPickerOpen && (
        <CustomColorPicker
          anchorRef={gridCardRef}
          customTileRef={customButtonRef}
          initialAccent={previousAccent}
          onClose={() => {
            setIsPickerOpen(false);
            setLiveCustomHex(null);
          }}
          onColorChange={(hex) => setLiveCustomHex(hex)}
          open={isPickerOpen}
        />
      )}
    </div>
  );
}
