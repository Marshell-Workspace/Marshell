"use client";

import { InspectIcon } from "@workspace/core/components/icons/mode-icons";
import {
  PreviewHealth,
  type SweepState,
} from "@workspace/core/components/preview/preview-health";
import type { HealthItem } from "@workspace/core/lib/preview-qa";
import {
  CUSTOM_DEVICE_ID,
  canZoomIn,
  canZoomOut,
  DEVICE_REGISTRY,
  type Device,
  formatZoom,
  GENERIC_SUBCATEGORY,
  type Orientation,
  parseDimensionInput,
  type ZoomLevel,
} from "@workspace/core/lib/preview-viewports";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import {
  Bug,
  Check,
  ChevronDown,
  Columns2,
  Laptop,
  Maximize2,
  Minimize2,
  Minus,
  Monitor,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  Ruler,
  Smartphone,
  Tablet,
  Tv,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60";
const BTN = cn(
  "flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-35",
  FOCUS
);
// Flat groups: no box, the current option is marked by a soft wash.
const GROUP = "flex items-center gap-0.5";
const SEGMENT = cn(
  "flex h-6 cursor-pointer items-center justify-center rounded px-2 text-xs transition-colors disabled:pointer-events-none disabled:opacity-35",
  FOCUS
);
const SEGMENT_ON = "bg-accent font-medium text-foreground";
const SEGMENT_OFF =
  "text-muted-foreground hover:bg-accent/60 hover:text-foreground";

function IconTip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export interface PreviewControlsProps {
  /** Scale currently applied to the viewport (Fit resolved to a number). */
  activeScale: number;
  customHeight: number;
  customWidth: number;
  deviceId: string;
  deviceName: string;
  devtoolsOn: boolean;
  fluid: boolean;
  foldState: "folded" | "unfolded";
  health: HealthItem[];
  inspectOn: boolean;
  isFoldable: boolean;
  isFullscreen?: boolean;
  onCustomSize: (width: number, height: number) => void;
  onDevice: (id: string) => void;
  onDevtools: () => void;
  onFoldState: (state: "folded" | "unfolded") => void;
  onFullscreen?: () => void;
  onInspect: () => void;
  onRotate: () => void;
  onZoom: (z: ZoomLevel) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  orientation: Orientation;
  sweep: SweepState;
  /** The simulated CSS viewport (never changes with zoom). */
  viewportH: number;
  viewportW: number;
  zoom: ZoomLevel;
}

interface MenuSection {
  groups: Array<{ devices: Device[]; label: string }>;
  icon: ReactNode;
  label: string;
}

function buildSections(): MenuSection[] {
  const byCategory = (category: Device["category"]) =>
    DEVICE_REGISTRY.filter((d) => d.category === category);
  const split = (devices: Device[]) => {
    const generic = devices.filter(
      (d) => d.subcategory === GENERIC_SUBCATEGORY
    );
    const named = devices.filter((d) => d.subcategory !== GENERIC_SUBCATEGORY);
    return { generic, named };
  };
  const bySub = (devices: Device[]) => {
    const map = new Map<string, Device[]>();
    for (const d of devices) {
      const key = d.subcategory ?? "Other";
      map.set(key, [...(map.get(key) ?? []), d]);
    }
    return [...map.entries()].map(([label, list]) => ({
      devices: list,
      label,
    }));
  };

  const phones = split(byCategory("phone"));
  const tablets = split(byCategory("tablet"));
  const desktops = split(byCategory("desktop"));

  return [
    {
      groups: [
        {
          devices: [...phones.generic, ...tablets.generic, ...desktops.generic],
          label: "Viewport classes",
        },
      ],
      icon: <Ruler className="size-3.5 opacity-70" />,
      label: "Generic sizes",
    },
    {
      groups: bySub(phones.named),
      icon: <Smartphone className="size-3.5 opacity-70" />,
      label: "Phones",
    },
    {
      groups: [{ devices: byCategory("foldable"), label: "Foldables" }],
      icon: <Columns2 className="size-3.5 opacity-70" />,
      label: "Foldables",
    },
    {
      groups: [{ devices: tablets.named, label: "Tablets" }],
      icon: <Tablet className="size-3.5 opacity-70" />,
      label: "Tablets",
    },
    {
      groups: [{ devices: desktops.named, label: "Desktops & laptops" }],
      icon: <Laptop className="size-3.5 opacity-70" />,
      label: "Desktops & laptops",
    },
    {
      groups: [
        { devices: byCategory("smart-display"), label: "Smart displays" },
      ],
      icon: <Tv className="size-3.5 opacity-70" />,
      label: "Smart displays",
    },
  ].filter((section) => section.groups.some((g) => g.devices.length > 0));
}

function deviceSizeLabel(d: Device): string {
  return d.isFoldable
    ? `${d.foldedWidth}×${d.foldedHeight}`
    : `${d.width}×${d.height}`;
}

function DeviceItem({
  active,
  device,
  onSelect,
}: {
  active: boolean;
  device: Device;
  onSelect: (id: string) => void;
}) {
  return (
    <DropdownMenuItem
      className={cn(
        "flex cursor-pointer items-center justify-between gap-2 py-1.5 text-xs",
        active && "font-semibold text-foreground"
      )}
      onClick={() => onSelect(device.id)}
    >
      <span className="truncate">{device.name}</span>
      <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
        {deviceSizeLabel(device)}
      </span>
      {active && <Check className="size-3.5 shrink-0 text-foreground/80" />}
    </DropdownMenuItem>
  );
}

function DimensionField({
  axis,
  label,
  onCommit,
  value,
}: {
  axis: "width" | "height";
  label: string;
  onCommit: (n: number) => void;
  value: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const parsed = parseDimensionInput(draft, axis);
  const invalid = parsed.value === null;

  // Follow external changes (drag-resize, rotate) unless the field is being edited.
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    if (parsed.value === null) {
      setDraft(String(value));
      return;
    }
    if (parsed.value !== value) {
      onCommit(parsed.value);
    }
  };

  return (
    <input
      aria-invalid={invalid}
      aria-label={label}
      className={cn(
        "h-7 w-14 rounded-md border bg-secondary px-1.5 text-center font-mono text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50",
        invalid ? "border-destructive" : "border-border"
      )}
      inputMode="numeric"
      maxLength={5}
      onBlur={commit}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
        } else if (e.key === "Escape") {
          setDraft(String(value));
        }
      }}
      title={parsed.error ? `${label}: ${parsed.error}` : label}
      value={draft}
    />
  );
}

export function PreviewControls(props: PreviewControlsProps) {
  const sections = useMemo(buildSections, []);
  const isCustom = props.deviceId === CUSTOM_DEVICE_ID;
  const isFit = props.zoom === "fit";
  const zoomDisabled = props.fluid;
  const rotateTo: Orientation =
    props.orientation === "portrait" ? "landscape" : "portrait";
  const RotateIcon =
    rotateTo === "landscape" ? RectangleHorizontal : RectangleVertical;

  return (
    <div className="flex min-h-[40px] flex-wrap items-center justify-between gap-x-3 gap-y-1 border-border border-b px-3 py-1.5">
      {/* Device, rotation, dimensions */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Change device (current: ${props.deviceName})`}
              className={cn(
                "flex h-7 w-[170px] cursor-pointer items-center justify-between rounded-md border border-border bg-secondary px-2.5 text-foreground text-xs transition-colors hover:bg-accent",
                FOCUS
              )}
              type="button"
            >
              <span className="truncate font-medium">{props.deviceName}</span>
              <ChevronDown className="ml-1 size-3.5 shrink-0 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 p-1">
            <DropdownMenuItem
              className={cn(
                "flex cursor-pointer items-center gap-2 py-1.5 text-xs",
                props.fluid && "font-semibold text-foreground"
              )}
              onClick={() => props.onDevice("responsive")}
            >
              <Monitor className="size-3.5 opacity-70" />
              <span>Responsive (fills the canvas)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(
                "flex cursor-pointer items-center gap-2 py-1.5 text-xs",
                isCustom && "font-semibold text-foreground"
              )}
              onClick={() => props.onDevice(CUSTOM_DEVICE_ID)}
            >
              <Ruler className="size-3.5 opacity-70" />
              <span>Custom size…</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {sections.map((section) => (
              <DropdownMenuSub key={section.label}>
                <DropdownMenuSubTrigger className="flex cursor-pointer items-center gap-2 py-1.5 text-xs">
                  {section.icon}
                  <span>{section.label}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className="max-h-80 w-72 overflow-y-auto p-1"
                  sideOffset={10}
                >
                  {section.groups.map((group) => (
                    <div key={group.label}>
                      {section.groups.length > 1 && (
                        <DropdownMenuLabel className="px-2 py-1 text-[11px] text-muted-foreground">
                          {group.label}
                        </DropdownMenuLabel>
                      )}
                      {group.devices.map((d) => (
                        <DeviceItem
                          active={props.deviceId === d.id}
                          device={d}
                          key={d.id}
                          onSelect={props.onDevice}
                        />
                      ))}
                    </div>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <IconTip label={`Rotate to ${rotateTo}`}>
          <button
            aria-label={`Rotate device to ${rotateTo}`}
            className={cn(BTN, "w-7 justify-center px-0")}
            disabled={props.fluid}
            onClick={props.onRotate}
            type="button"
          >
            <RotateIcon className="size-4" />
          </button>
        </IconTip>

        {props.isFoldable && (
          <fieldset
            aria-label="Fold state"
            className={cn(GROUP, "m-0 min-w-0")}
          >
            {(["folded", "unfolded"] as const).map((state) => (
              <button
                aria-pressed={props.foldState === state}
                className={cn(
                  SEGMENT,
                  props.foldState === state ? SEGMENT_ON : SEGMENT_OFF
                )}
                key={state}
                onClick={() => props.onFoldState(state)}
                type="button"
              >
                {state === "folded" ? "Folded" : "Unfolded"}
              </button>
            ))}
          </fieldset>
        )}

        {/* The simulated CSS viewport: never the scaled visual size. */}
        {isCustom ? (
          <div className="flex items-center gap-1 font-mono text-muted-foreground text-xs">
            <DimensionField
              axis="width"
              label="Viewport width in CSS pixels"
              onCommit={(w) => props.onCustomSize(w, props.customHeight)}
              value={props.customWidth}
            />
            <span aria-hidden="true">×</span>
            <DimensionField
              axis="height"
              label="Viewport height in CSS pixels"
              onCommit={(h) => props.onCustomSize(props.customWidth, h)}
              value={props.customHeight}
            />
            <span className="text-[10px]">px</span>
          </div>
        ) : (
          props.viewportW > 0 &&
          props.viewportH > 0 && (
            <output
              className="flex select-none items-center gap-1.5 px-1 font-mono text-muted-foreground text-xs tabular-nums"
              title="Simulated CSS viewport. Zoom never changes it."
            >
              <span className="font-semibold text-foreground">
                {props.viewportW}
              </span>
              <span aria-hidden="true" className="text-subtle">
                ×
              </span>
              <span className="font-semibold text-foreground">
                {props.viewportH}
              </span>
              <span className="text-[10px] text-subtle">px</span>
            </output>
          )
        )}
      </div>

      {/* Zoom */}
      <fieldset
        aria-label="Zoom"
        className="m-0 flex min-w-0 items-center gap-1 border-0 p-0"
      >
        <div className={GROUP}>
          <IconTip label="Zoom out (Ctrl/⌘ −)">
            <button
              aria-label="Zoom out"
              className={cn(SEGMENT, SEGMENT_OFF, "w-6 px-0")}
              disabled={zoomDisabled || !canZoomOut(props.activeScale)}
              onClick={props.onZoomOut}
              type="button"
            >
              <Minus className="size-3.5" />
            </button>
          </IconTip>
          <IconTip label="Fit the viewport inside the canvas (Ctrl/⌘ Shift 0)">
            <button
              aria-label="Fit preview"
              aria-pressed={isFit}
              className={cn(SEGMENT, isFit ? SEGMENT_ON : SEGMENT_OFF)}
              disabled={zoomDisabled}
              onClick={() => props.onZoom("fit")}
              type="button"
            >
              Fit
            </button>
          </IconTip>
          <IconTip label="True size, 1 CSS px per screen px (Ctrl/⌘ 0)">
            <button
              aria-label={
                isFit || props.zoom === 1
                  ? "Zoom to 100%"
                  : `Reset zoom to 100% (currently ${formatZoom(props.zoom)})`
              }
              aria-pressed={!isFit}
              className={cn(
                SEGMENT,
                "min-w-[3.25rem] tabular-nums",
                isFit ? SEGMENT_OFF : SEGMENT_ON
              )}
              disabled={zoomDisabled}
              onClick={() => props.onZoom(1)}
              type="button"
            >
              {isFit ? "100%" : formatZoom(props.zoom)}
            </button>
          </IconTip>
          <IconTip label="Zoom in (Ctrl/⌘ +)">
            <button
              aria-label="Zoom in"
              className={cn(SEGMENT, SEGMENT_OFF, "w-6 px-0")}
              disabled={zoomDisabled || !canZoomIn(props.activeScale)}
              onClick={props.onZoomIn}
              type="button"
            >
              <Plus className="size-3.5" />
            </button>
          </IconTip>
        </div>
      </fieldset>

      {/* Tools */}
      <div className="flex items-center gap-1">
        <PreviewHealth items={props.health} sweep={props.sweep} />
        <button
          aria-pressed={props.inspectOn}
          className={cn(
            BTN,
            "transition-ui",
            props.inspectOn
              ? "bg-accent font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={props.onInspect}
          title="Click an element to inspect its component"
          type="button"
        >
          <InspectIcon
            className={cn(
              "size-3.5",
              props.inspectOn && "text-[var(--accent-ink)]"
            )}
          />
          <span className="hidden lg:inline">Inspect</span>
        </button>
        <button
          aria-pressed={props.devtoolsOn}
          className={cn(
            BTN,
            "transition-ui",
            props.devtoolsOn
              ? "bg-accent font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={props.onDevtools}
          title="Console, elements and network panel"
          type="button"
        >
          <Bug
            className={cn(
              "size-3.5",
              props.devtoolsOn && "text-[var(--accent-ink)]"
            )}
          />
          <span className="hidden lg:inline">DevTools</span>
        </button>
        {props.onFullscreen && (
          <IconTip
            label={props.isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
          >
            <button
              aria-label={
                props.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
              }
              className={cn(
                BTN,
                "w-7 justify-center px-0",
                props.isFullscreen && "bg-accent text-foreground"
              )}
              onClick={props.onFullscreen}
              type="button"
            >
              {props.isFullscreen ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </button>
          </IconTip>
        )}
      </div>
    </div>
  );
}
