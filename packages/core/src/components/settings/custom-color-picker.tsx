"use client";

import {
  computePopoverPlacement,
  ensureDarkContrast,
  getAutoForeground,
  hexToRgb,
  hsvToRgb,
  type PopoverPlacement,
  parseHexColor,
  rgbToHex,
  rgbToHsv,
} from "@workspace/core/lib/accent-colors";
import type { AccentOption } from "@workspace/core/lib/theme";
import { applyAccent } from "@workspace/core/lib/theme";
import { useGeneralSettingsStore } from "@workspace/core/stores/general-settings-store";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import {
  CircleDot,
  Info,
  Palette,
  Pipette,
  RotateCcw,
  Sliders,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const POPOVER_WIDTH = 360;

interface EyeDropperInstance {
  open: () => Promise<{ sRGBHex: string }>;
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperInstance;
  }
}

export interface CustomColorPickerProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  customTileRef?: React.RefObject<HTMLButtonElement | null>;
  initialAccent?: AccentOption;
  onClose: () => void;
  onColorChange?: (hex: string) => void;
  open: boolean;
}

function CustomColorPickerComponent({
  anchorRef,
  customTileRef,
  initialAccent,
  onClose,
  onColorChange,
  open,
}: CustomColorPickerProps) {
  const settings = useGeneralSettingsStore();
  const customHex = settings.customAccentHex || "#38bdf8";

  // Initial state snapshots to restore on Cancel / Esc / outside click
  const initialAccentRef = useRef<AccentOption>(
    initialAccent || settings.accent
  );
  const initialCustomHexRef = useRef(customHex);

  // Picker mode: "wheel" (color wheel style) vs "sliders" (SV square + hue slider)
  const [pickerMode, setPickerMode] = useState<"wheel" | "sliders">("wheel");

  // Color state in HSV & HEX
  const [hue, setHue] = useState(199);
  const [saturation, setSaturation] = useState(0.85);
  const [brightness, setBrightness] = useState(0.95);
  const [hexInput, setHexInput] = useState(customHex);
  const [rgb, setRgb] = useState<[number, number, number]>([56, 189, 248]);

  // DOM refs
  const popoverRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const brightnessSliderRef = useRef<HTMLDivElement>(null);
  const satSquareRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

  // Gesture tracking: clicks or drags starting inside popover should never close it
  const pointerStartedInsideRef = useRef(false);

  // Modal container resolution
  const [containerEl, setContainerEl] = useState<Element | null>(null);

  useLayoutEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }
    const found =
      anchorRef.current?.closest('[data-slot="genie-modal-surface"]') ||
      anchorRef.current?.closest('[role="dialog"]') ||
      document.body;
    setContainerEl(found);
  }, [anchorRef, open]);

  // Placement state
  const [placement, setPlacement] = useState<PopoverPlacement>({
    top: 100,
    left: 100,
    maxHeight: 500,
    placement: "right-start",
  });
  const [containerOffset, setContainerOffset] = useState<{
    left: number;
    top: number;
  }>({
    left: 0,
    top: 0,
  });

  // Calculate and update popover position
  const updatePosition = useCallback(() => {
    if (!anchorRef.current || typeof window === "undefined") {
      return;
    }
    const anchorRect = anchorRef.current.getBoundingClientRect();
    const container =
      anchorRef.current?.closest('[data-slot="genie-modal-surface"]') ||
      anchorRef.current?.closest('[role="dialog"]') ||
      document.body;

    const isBody = !container || container === document.body;
    const containerRect = isBody
      ? {
          left: 0,
          top: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
          width: window.innerWidth,
          height: window.innerHeight,
        }
      : container.getBoundingClientRect();

    const measuredHeight = popoverRef.current?.offsetHeight || 360;

    const nextPlacement = computePopoverPlacement(
      anchorRect,
      POPOVER_WIDTH,
      containerRect,
      measuredHeight,
      12,
      16
    );

    setPlacement(nextPlacement);
    setContainerOffset({
      left: isBody ? 0 : containerRect.left,
      top: isBody ? 0 : containerRect.top,
    });
  }, [anchorRef]);

  // Sync snapshot and position when opened
  useEffect(() => {
    if (!open) {
      return;
    }

    initialAccentRef.current = initialAccent || settings.accent;
    initialCustomHexRef.current = settings.customAccentHex || "#38bdf8";

    const activeHex =
      settings.accent === "custom"
        ? settings.customAccentHex || "#38bdf8"
        : "#38bdf8";
    const normalized = parseHexColor(activeHex) || "#38bdf8";
    const [r, g, b] = hexToRgb(normalized);
    const [h, s, v] = rgbToHsv(r, g, b);

    setHue(Math.round(h * 360));
    setSaturation(s);
    setBrightness(v);
    setHexInput(normalized);
    setRgb([r, g, b]);

    updatePosition();
  }, [open, settings.accent, settings.customAccentHex, updatePosition]);

  // Position listeners: window resize, capture-phase scroll, resize observer
  useEffect(() => {
    if (!open) {
      return;
    }

    const onScrollOrResize = () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        updatePosition();
      });
    };

    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, {
      capture: true,
      passive: true,
    });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && popoverRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updatePosition();
      });
      resizeObserver.observe(popoverRef.current);
    }

    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, {
        capture: true,
      });
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [open, updatePosition]);

  // Live CSS variable updater (fast, bypasses React & Zustand stores during drag)
  const applyLiveColor = useCallback((hex: string) => {
    if (typeof document === "undefined") {
      return;
    }
    const { hex: safeHex } = ensureDarkContrast(hex);
    const [r, g, b] = hexToRgb(safeHex);
    const on = getAutoForeground(safeHex);

    const root = document.documentElement;
    root.setAttribute("data-accent", "custom");
    root.style.setProperty("--accent-fill", safeHex);
    root.style.setProperty("--accent-ink", safeHex);
    root.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
    root.style.setProperty("--accent-on", on);
  }, []);

  const updateFromColor = useCallback(
    (newHex: string, newH?: number, newS?: number, newV?: number) => {
      const normalized = parseHexColor(newHex);
      if (!normalized) {
        return;
      }
      const [r, g, b] = hexToRgb(normalized);
      setHexInput(normalized);
      setRgb([r, g, b]);

      if (newH !== undefined) {
        setHue(newH);
      }
      if (newS !== undefined) {
        setSaturation(newS);
      }
      if (newV !== undefined) {
        setBrightness(newV);
      }

      const { hex: safeHex } = ensureDarkContrast(normalized);
      onColorChange?.(safeHex);

      // Throttled direct CSS variable update
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        applyLiveColor(normalized);
      });
    },
    [applyLiveColor, onColorChange]
  );

  // ── Color Wheel Interaction (Polar Angle -> Hue, Distance -> Saturation) ────
  const handleWheelPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!wheelRef.current) {
        return;
      }
      const rect = wheelRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = clientX - centerX;
      const deltaY = clientY - centerY;
      const distance = Math.hypot(deltaX, deltaY);
      const radius = rect.width / 2;

      // Saturation from center (0) to rim (1)
      const newS = Math.max(0, Math.min(1, distance / radius));

      // Angle from 3 o'clock (0° to 360°)
      let deg = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
      if (deg < 0) {
        deg += 360;
      }
      const newH = Math.round(deg) % 360;

      // Ensure visible brightness (boost if too dark so colors pop on click)
      const effectiveV = brightness < 0.35 ? 0.95 : brightness;
      const [r, g, b] = hsvToRgb(newH / 360, newS, effectiveV);
      const newHex = rgbToHex(r, g, b);
      updateFromColor(newHex, newH, newS, effectiveV);
    },
    [brightness, updateFromColor]
  );

  const onWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleWheelPointer(e.clientX, e.clientY);

    const onPointerMove = (moveEvent: PointerEvent) => {
      handleWheelPointer(moveEvent.clientX, moveEvent.clientY);
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // ── Brightness Slider Interaction (Wheel Mode) ──────────────────────────────
  const handleBrightnessPointer = useCallback(
    (clientX: number) => {
      if (!brightnessSliderRef.current) {
        return;
      }
      const rect = brightnessSliderRef.current.getBoundingClientRect();
      const clampedX = Math.max(rect.left, Math.min(rect.right, clientX));
      const newV = Math.max(
        0,
        Math.min(1, (clampedX - rect.left) / rect.width)
      );

      const [r, g, b] = hsvToRgb(hue / 360, saturation, newV);
      const newHex = rgbToHex(r, g, b);
      updateFromColor(newHex, undefined, undefined, newV);
    },
    [hue, saturation, updateFromColor]
  );

  const onBrightnessPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleBrightnessPointer(e.clientX);

    const onPointerMove = (moveEvent: PointerEvent) => {
      handleBrightnessPointer(moveEvent.clientX);
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // ── Saturation / Brightness Square Interaction (Sliders Mode) ───────────────
  const handleSatSquarePointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!satSquareRef.current) {
        return;
      }
      const rect = satSquareRef.current.getBoundingClientRect();
      const clampedX = Math.max(rect.left, Math.min(rect.right, clientX));
      const clampedY = Math.max(rect.top, Math.min(rect.bottom, clientY));

      const newS = Math.max(
        0,
        Math.min(1, (clampedX - rect.left) / rect.width)
      );
      const newV = Math.max(
        0,
        Math.min(1, 1 - (clampedY - rect.top) / rect.height)
      );

      const [r, g, b] = hsvToRgb(hue / 360, newS, newV);
      const newHex = rgbToHex(r, g, b);
      updateFromColor(newHex, undefined, newS, newV);
    },
    [hue, updateFromColor]
  );

  const onSatSquarePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleSatSquarePointer(e.clientX, e.clientY);

    const onPointerMove = (moveEvent: PointerEvent) => {
      handleSatSquarePointer(moveEvent.clientX, moveEvent.clientY);
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // ── Hue Slider Interaction (Sliders Mode) ───────────────────────────────────
  const handleHuePointer = useCallback(
    (clientX: number) => {
      if (!hueSliderRef.current) {
        return;
      }
      const rect = hueSliderRef.current.getBoundingClientRect();
      const clampedX = Math.max(rect.left, Math.min(rect.right, clientX));
      const newHue = Math.round(
        Math.max(0, Math.min(360, ((clampedX - rect.left) / rect.width) * 360))
      );

      // If saturation or brightness were near zero, boost so new hue is immediately visible
      const effectiveSat = saturation === 0 ? 0.85 : saturation;
      const effectiveBright = brightness === 0 ? 0.95 : brightness;

      const [r, g, b] = hsvToRgb(newHue / 360, effectiveSat, effectiveBright);
      const newHex = rgbToHex(r, g, b);
      updateFromColor(newHex, newHue, effectiveSat, effectiveBright);
    },
    [brightness, saturation, updateFromColor]
  );

  const onHuePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleHuePointer(e.clientX);

    const onPointerMove = (moveEvent: PointerEvent) => {
      handleHuePointer(moveEvent.clientX);
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Eyedropper API
  const hasEyeDropper =
    typeof window !== "undefined" && Boolean(window.EyeDropper);
  const handleEyeDropper = async () => {
    if (!window.EyeDropper) {
      return;
    }
    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      if (result?.sRGBHex) {
        const normalized = parseHexColor(result.sRGBHex);
        if (normalized) {
          const [r, g, b] = hexToRgb(normalized);
          const [h, s, v] = rgbToHsv(r, g, b);
          updateFromColor(normalized, Math.round(h * 360), s, v);
        }
      }
    } catch {
      // User cancelled
    }
  };

  // Keyboard handlers for sliders
  const onWheelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let newH = hue;
    let newS = saturation;
    const hStep = e.shiftKey ? 15 : 5;
    const sStep = e.shiftKey ? 0.1 : 0.02;

    if (e.key === "ArrowLeft") {
      newH = (hue - hStep + 360) % 360;
    } else if (e.key === "ArrowRight") {
      newH = (hue + hStep) % 360;
    } else if (e.key === "ArrowUp") {
      newS = Math.min(1, saturation + sStep);
    } else if (e.key === "ArrowDown") {
      newS = Math.max(0, saturation - sStep);
    } else {
      return;
    }

    e.preventDefault();
    const [r, g, b] = hsvToRgb(newH / 360, newS, brightness);
    const newHex = rgbToHex(r, g, b);
    updateFromColor(newHex, newH, newS, undefined);
  };

  const onBrightnessKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    let newV = brightness;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      newV = Math.max(0, brightness - step);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      newV = Math.min(1, brightness + step);
    } else {
      return;
    }

    e.preventDefault();
    const [r, g, b] = hsvToRgb(hue / 360, saturation, newV);
    const newHex = rgbToHex(r, g, b);
    updateFromColor(newHex, undefined, undefined, newV);
  };

  const onSatSquareKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    let newS = saturation;
    let newV = brightness;
    if (e.key === "ArrowLeft") {
      newS = Math.max(0, saturation - step);
    } else if (e.key === "ArrowRight") {
      newS = Math.min(1, saturation + step);
    } else if (e.key === "ArrowDown") {
      newV = Math.max(0, brightness - step);
    } else if (e.key === "ArrowUp") {
      newV = Math.min(1, brightness + step);
    } else {
      return;
    }

    e.preventDefault();
    const [r, g, b] = hsvToRgb(hue / 360, newS, newV);
    const newHex = rgbToHex(r, g, b);
    updateFromColor(newHex, undefined, newS, newV);
  };

  const onHueKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    let newH = hue;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      newH = (hue - step + 360) % 360;
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      newH = (hue + step) % 360;
    } else {
      return;
    }

    e.preventDefault();
    const [r, g, b] = hsvToRgb(newH / 360, saturation, brightness);
    const newHex = rgbToHex(r, g, b);
    updateFromColor(newHex, newH, undefined, undefined);
  };

  // Safe contrast check
  const currentHex = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;
  const { hex: safeHex, isAdjusted } = ensureDarkContrast(currentHex);
  const onAccentColor = getAutoForeground(safeHex);

  const handleApply = useCallback(() => {
    settings.setCustomAccent(safeHex);
    onClose();
    customTileRef?.current?.focus();
  }, [customTileRef, onClose, safeHex, settings]);

  const handleCancel = useCallback(() => {
    if (initialAccentRef.current === "custom") {
      settings.setCustomAccent(initialCustomHexRef.current);
    } else {
      settings.setAccent(initialAccentRef.current);
    }
    applyAccent(initialAccentRef.current, initialCustomHexRef.current);
    onClose();
    customTileRef?.current?.focus();
  }, [customTileRef, onClose, settings]);

  const handleResetToDefault = () => {
    settings.setAccent("mint");
    onClose();
    customTileRef?.current?.focus();
  };

  // Keyboard navigation inside popover: Esc cancels, Enter applies, Tab traps focus
  const handlePopoverKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      const target = e.target as HTMLElement;
      if (target.tagName !== "BUTTON" || target.id === "apply-btn") {
        e.preventDefault();
        handleApply();
      }
      return;
    }

    // Focus trap
    if (e.key === "Tab" && popoverRef.current) {
      const focusables = Array.from(
        popoverRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables.at(-1);

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  // Robust Outside-Click handling via capture-phase document pointerdown
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDownCapture = (e: PointerEvent) => {
      const path = typeof e.composedPath === "function" ? e.composedPath() : [];
      const target = e.target as Node | null;

      const isInsidePopover = Boolean(
        popoverRef.current &&
          (path.includes(popoverRef.current) ||
            (target && popoverRef.current.contains(target)))
      );

      const isInsideCustomTile = Boolean(
        customTileRef?.current &&
          (path.includes(customTileRef.current) ||
            (target && customTileRef.current.contains(target)))
      );

      const isInsideAnchor = Boolean(
        anchorRef.current &&
          (path.includes(anchorRef.current) ||
            (target && anchorRef.current.contains(target)))
      );

      if (isInsidePopover || isInsideCustomTile || isInsideAnchor) {
        pointerStartedInsideRef.current = true;
        return;
      }

      pointerStartedInsideRef.current = false;
      // Click truly outside: restore previous accent and close
      handleCancel();
    };

    const onWindowPointerUp = () => {
      pointerStartedInsideRef.current = false;
    };

    document.addEventListener("pointerdown", onPointerDownCapture, {
      capture: true,
    });
    window.addEventListener("pointerup", onWindowPointerUp, {
      capture: true,
    });
    window.addEventListener("pointercancel", onWindowPointerUp, {
      capture: true,
    });

    return () => {
      document.removeEventListener("pointerdown", onPointerDownCapture, {
        capture: true,
      });
      window.removeEventListener("pointerup", onWindowPointerUp, {
        capture: true,
      });
      window.removeEventListener("pointercancel", onWindowPointerUp, {
        capture: true,
      });
    };
  }, [open, anchorRef, customTileRef, handleCancel]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  // Calculate Wheel thumb coordinates (center 50%, 50%)
  const wheelRad = (hue * Math.PI) / 180;
  const wheelThumbX = 50 + 50 * saturation * Math.cos(wheelRad);
  const wheelThumbY = 50 + 50 * saturation * Math.sin(wheelRad);

  // Full-brightness color for brightness slider gradient
  const fullBrightHex = rgbToHex(...hsvToRgb(hue / 360, saturation, 1));

  const targetContainer = containerEl || document.body;
  const isBodyContainer = !containerEl || containerEl === document.body;

  // Relative coordinates inside container
  const relativeLeft = placement.left - containerOffset.left;
  const relativeTop = placement.top - containerOffset.top;

  // Open animation slide from anchor side (120ms motion-fast)
  const slideAnim =
    placement.placement === "right-start"
      ? "slide-in-from-left-1"
      : placement.placement === "left-start"
        ? "slide-in-from-right-1"
        : placement.placement === "below"
          ? "slide-in-from-top-1"
          : "zoom-in-95";

  return createPortal(
    <div
      aria-labelledby="custom-picker-title"
      aria-modal="true"
      className={cn(
        isBodyContainer ? "fixed z-[9999]" : "absolute z-[100]",
        "flex flex-col rounded-xl border border-border bg-card text-foreground shadow-2xl outline-hidden",
        "animate-in fade-in motion-fast motion-reduce:animate-none motion-reduce:transform-none",
        slideAnim
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handlePopoverKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      ref={popoverRef}
      role="dialog"
      style={{
        left: `${relativeLeft}px`,
        top: `${relativeTop}px`,
        width: `${POPOVER_WIDTH}px`,
        maxHeight: `${placement.maxHeight}px`,
      }}
    >
      {/* ── Fixed Header ────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-3.5 py-2">
        <div className="flex items-center gap-1.5">
          <Palette className="size-3.5 text-muted-foreground" />
          <span
            className="font-semibold text-xs tracking-tight"
            id="custom-picker-title"
          >
            Custom color
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode Switcher: Wheel vs Sliders */}
          <div className="flex items-center rounded-md border border-border/80 bg-muted/40 p-0.5 text-[10px]">
            <button
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors",
                pickerMode === "wheel"
                  ? "bg-background text-foreground font-medium shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setPickerMode("wheel")}
              title="Color Wheel"
              type="button"
            >
              <CircleDot className="size-3" />
              <span>Wheel</span>
            </button>
            <button
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors",
                pickerMode === "sliders"
                  ? "bg-background text-foreground font-medium shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setPickerMode("sliders")}
              title="Square & Sliders"
              type="button"
            >
              <Sliders className="size-3" />
              <span>Square</span>
            </button>
          </div>

          {hasEyeDropper && (
            <Button
              aria-label="Pick color from screen"
              className="size-6 p-0 cursor-pointer"
              onClick={handleEyeDropper}
              size="sm"
              title="Pick color from screen"
              variant="ghost"
            >
              <Pipette className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Scrollable Body ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto subtle-scrollbar space-y-3 p-3.5 pr-2.5">
        {pickerMode === "wheel" ? (
          /* ── Wheel Mode: Multi-Color Wheel & Brightness Slider ────────────── */
          <div className="space-y-3">
            <div
              aria-label="Color wheel (Hue and Saturation)"
              aria-valuemax={360}
              aria-valuemin={0}
              aria-valuenow={Math.round(hue)}
              aria-valuetext={`Hue ${Math.round(hue)}°, Saturation ${Math.round(saturation * 100)}%`}
              className="relative size-[clamp(110px,22vh,150px)] mx-auto rounded-full cursor-crosshair overflow-hidden shadow-inner border border-border/70 select-none touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => handleWheelPointer(e.clientX, e.clientY)}
              onKeyDown={onWheelKeyDown}
              onPointerDown={onWheelPointerDown}
              ref={wheelRef}
              role="slider"
              style={{
                background:
                  "conic-gradient(from 90deg, #ff0000 0deg, #ffff00 60deg, #00ff00 120deg, #00ffff 180deg, #0000ff 240deg, #ff00ff 300deg, #ff0000 360deg)",
              }}
              tabIndex={0}
            >
              {/* Radial gradient from center white to transparent edge */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle closest-side, #ffffff 0%, transparent 100%)",
                }}
              />
              {/* Dimming overlay driven by brightness */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full bg-black transition-opacity"
                style={{ opacity: 1 - brightness }}
              />
              {/* Wheel Thumb Indicator */}
              <div
                className="pointer-events-none absolute size-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/40"
                style={{
                  left: `${wheelThumbX}%`,
                  top: `${wheelThumbY}%`,
                  backgroundColor: currentHex,
                }}
              />
            </div>

            {/* Brightness Slider below Wheel */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground uppercase">
                <span>Brightness</span>
                <span>{Math.round(brightness * 100)}%</span>
              </div>
              <div
                aria-label="Brightness"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(brightness * 100)}
                className="relative h-3.5 w-full shrink-0 cursor-pointer rounded-full select-none border border-border/60 touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => handleBrightnessPointer(e.clientX)}
                onKeyDown={onBrightnessKeyDown}
                onPointerDown={onBrightnessPointerDown}
                ref={brightnessSliderRef}
                role="slider"
                style={{
                  background: `linear-gradient(to right, #000000 0%, ${fullBrightHex} 100%)`,
                }}
                tabIndex={0}
              >
                <div
                  className="pointer-events-none absolute top-1/2 size-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/40"
                  style={{
                    left: `${brightness * 100}%`,
                    backgroundColor: currentHex,
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* ── Sliders Mode: Saturation/Brightness Square + Hue Slider ──────── */
          <div className="space-y-3">
            <div
              aria-label="Saturation and brightness"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(saturation * 100)}
              aria-valuetext={`Saturation ${Math.round(saturation * 100)}%, Brightness ${Math.round(brightness * 100)}%`}
              className="relative h-[clamp(90px,18vh,120px)] w-full shrink-0 cursor-crosshair rounded-lg overflow-hidden border border-border/80 select-none touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => handleSatSquarePointer(e.clientX, e.clientY)}
              onKeyDown={onSatSquareKeyDown}
              onPointerDown={onSatSquarePointerDown}
              ref={satSquareRef}
              role="slider"
              style={{
                backgroundColor: `hsl(${hue}, 100%, 50%)`,
              }}
              tabIndex={0}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black to-transparent" />
              <div
                className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/40"
                style={{
                  left: `${saturation * 100}%`,
                  top: `${(1 - brightness) * 100}%`,
                  backgroundColor: currentHex,
                }}
              />
            </div>

            {/* Hue Slider */}
            <div
              aria-label="Hue"
              aria-valuemax={360}
              aria-valuemin={0}
              aria-valuenow={Math.round(hue)}
              className="relative h-3.5 w-full shrink-0 cursor-pointer rounded-full select-none border border-border/60 touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => handleHuePointer(e.clientX)}
              onKeyDown={onHueKeyDown}
              onPointerDown={onHuePointerDown}
              ref={hueSliderRef}
              role="slider"
              style={{
                background:
                  "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
              }}
              tabIndex={0}
            >
              <div
                className="pointer-events-none absolute top-1/2 size-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/40"
                style={{
                  left: `${(hue / 360) * 100}%`,
                  backgroundColor: `hsl(${hue}, 100%, 50%)`,
                }}
              />
            </div>
          </div>
        )}

        {/* HEX and RGB Inputs (Fixed 4-column layout: minmax(0, 1fr) repeat(3, 56px)) */}
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,56px)] gap-1.5 text-xs">
          <div className="min-w-0 space-y-1">
            <label
              className="block text-[10px] font-medium text-muted-foreground uppercase"
              htmlFor="custom-hex-input"
            >
              HEX
            </label>
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-2 font-mono text-[11px] text-muted-foreground">
                #
              </span>
              <input
                className="box-border h-7 w-full min-w-0 rounded-md border border-input bg-background/60 pl-5 pr-1.5 font-mono text-xs uppercase focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                id="custom-hex-input"
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9a-fA-F]/g, "");
                  setHexInput(`#${val}`);
                  const normalized = parseHexColor(val);
                  if (normalized) {
                    const [nr, ng, nb] = hexToRgb(normalized);
                    const [nh, ns, nv] = rgbToHsv(nr, ng, nb);
                    updateFromColor(normalized, Math.round(nh * 360), ns, nv);
                  }
                }}
                onFocus={(e) => e.currentTarget.select()}
                value={hexInput.replace("#", "")}
              />
            </div>
          </div>

          <div className="min-w-0 space-y-1">
            <label
              className="block text-[10px] font-medium text-muted-foreground uppercase"
              htmlFor="custom-r-input"
            >
              R
            </label>
            <input
              className="box-border h-7 w-full min-w-0 rounded-md border border-input bg-background/60 px-1 text-center font-mono text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              id="custom-r-input"
              max={255}
              min={0}
              onChange={(e) => {
                const val = Math.max(
                  0,
                  Math.min(255, Number.parseInt(e.target.value, 10) || 0)
                );
                const nextRgb: [number, number, number] = [val, rgb[1], rgb[2]];
                const nextHex = rgbToHex(...nextRgb);
                const [nh, ns, nv] = rgbToHsv(...nextRgb);
                updateFromColor(nextHex, Math.round(nh * 360), ns, nv);
              }}
              onFocus={(e) => e.currentTarget.select()}
              type="number"
              value={rgb[0]}
            />
          </div>

          <div className="min-w-0 space-y-1">
            <label
              className="block text-[10px] font-medium text-muted-foreground uppercase"
              htmlFor="custom-g-input"
            >
              G
            </label>
            <input
              className="box-border h-7 w-full min-w-0 rounded-md border border-input bg-background/60 px-1 text-center font-mono text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              id="custom-g-input"
              max={255}
              min={0}
              onChange={(e) => {
                const val = Math.max(
                  0,
                  Math.min(255, Number.parseInt(e.target.value, 10) || 0)
                );
                const nextRgb: [number, number, number] = [rgb[0], val, rgb[2]];
                const nextHex = rgbToHex(...nextRgb);
                const [nh, ns, nv] = rgbToHsv(...nextRgb);
                updateFromColor(nextHex, Math.round(nh * 360), ns, nv);
              }}
              onFocus={(e) => e.currentTarget.select()}
              type="number"
              value={rgb[1]}
            />
          </div>

          <div className="min-w-0 space-y-1">
            <label
              className="block text-[10px] font-medium text-muted-foreground uppercase"
              htmlFor="custom-b-input"
            >
              B
            </label>
            <input
              className="box-border h-7 w-full min-w-0 rounded-md border border-input bg-background/60 px-1 text-center font-mono text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              id="custom-b-input"
              max={255}
              min={0}
              onChange={(e) => {
                const val = Math.max(
                  0,
                  Math.min(255, Number.parseInt(e.target.value, 10) || 0)
                );
                const nextRgb: [number, number, number] = [rgb[0], rgb[1], val];
                const nextHex = rgbToHex(...nextRgb);
                const [nh, ns, nv] = rgbToHsv(...nextRgb);
                updateFromColor(nextHex, Math.round(nh * 360), ns, nv);
              }}
              onFocus={(e) => e.currentTarget.select()}
              type="number"
              value={rgb[2]}
            />
          </div>
        </div>

        {/* Dark Safety Notice if adjusted */}
        {isAdjusted && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-500">
            <Info className="size-3 shrink-0" />
            <span className="leading-tight">
              Adjusted for visibility (min 3:1 contrast against dark background)
            </span>
          </div>
        )}

        {/* Recent custom colors */}
        {settings.recentCustomAccents &&
          settings.recentCustomAccents.length > 0 && (
            <div className="space-y-1.5 pt-0.5">
              <span className="block text-[10px] font-medium text-muted-foreground uppercase">
                Recent colors
              </span>
              <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                {settings.recentCustomAccents.slice(0, 8).map((color) => (
                  <button
                    aria-label={`Recent color ${color}`}
                    className="size-5 rounded-full border border-border/80 transition-transform hover:scale-110 cursor-pointer shrink-0"
                    key={color}
                    onClick={() => {
                      const [nr, ng, nb] = hexToRgb(color);
                      const [nh, ns, nv] = rgbToHsv(nr, ng, nb);
                      updateFromColor(color, Math.round(nh * 360), ns, nv);
                    }}
                    style={{ backgroundColor: color }}
                    type="button"
                  />
                ))}
              </div>
            </div>
          )}
      </div>

      {/* ── Pinned Footer (ALWAYS visible and clickable) ────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-t border-border/70 bg-card/95 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className="flex size-7 shrink-0 rounded-md overflow-hidden border border-border/80 shadow-2xs"
            title="Previous vs Selected"
          >
            <div
              className="w-1/2 h-full"
              style={{ backgroundColor: initialCustomHexRef.current }}
            />
            <div
              className="w-1/2 h-full"
              style={{ backgroundColor: safeHex }}
            />
          </div>
          <Button
            className="h-7 px-2 text-[11px] cursor-pointer"
            onClick={handleResetToDefault}
            size="sm"
            title="Reset to default (Mint)"
            variant="ghost"
          >
            <RotateCcw className="size-3 mr-1" />
            Reset
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            className="h-7 px-2.5 text-xs cursor-pointer"
            onClick={handleCancel}
            size="sm"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="h-7 px-3 text-xs font-medium cursor-pointer"
            id="apply-btn"
            onClick={handleApply}
            size="sm"
            style={{
              backgroundColor: safeHex,
              color: onAccentColor,
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>,
    targetContainer
  );
}

export const CustomColorPicker = React.memo(CustomColorPickerComponent);
