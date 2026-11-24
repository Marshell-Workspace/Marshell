"use client";

import { cn } from "@workspace/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";
import { ScanLine } from "./scan-line";

export interface HudPanelProps {
  chamferSize?: number;
  children: ReactNode;
  className?: string;
  cornerTicks?: boolean;
  raised?: boolean;
  reducedMotion?: boolean;
  role?: string;
  scanline?: boolean;
  style?: CSSProperties;
  tier?: "performance" | "balanced" | "eco";
}

/**
 * HudPanel — Signature Mission Control container with chamfered corners,
 * high-precision accent borders, and optional corner telemetry ticks.
 */
export function HudPanel({
  children,
  chamferSize = 12,
  raised = false,
  cornerTicks = false,
  scanline = false,
  reducedMotion = false,
  tier = "performance",
  className,
  style,
  role,
}: HudPanelProps) {
  const outerClip = `polygon(${chamferSize}px 0, calc(100% - ${chamferSize}px) 0, 100% ${chamferSize}px, 100% calc(100% - ${chamferSize}px), calc(100% - ${chamferSize}px) 100%, ${chamferSize}px 100%, 0 calc(100% - ${chamferSize}px), 0 ${chamferSize}px)`;
  const innerClip = `polygon(${Math.max(1, chamferSize - 1)}px 0, calc(100% - ${Math.max(1, chamferSize - 1)}px) 0, 100% ${Math.max(1, chamferSize - 1)}px, 100% calc(100% - ${Math.max(1, chamferSize - 1)}px), calc(100% - ${Math.max(1, chamferSize - 1)}px) 100%, ${Math.max(1, chamferSize - 1)}px 100%, 0 calc(100% - ${Math.max(1, chamferSize - 1)}px), 0 ${Math.max(1, chamferSize - 1)}px)`;

  return (
    <div
      className={cn("relative p-[1px] select-none", className)}
      role={role}
      style={{
        clipPath: outerClip,
        backgroundColor: "var(--tour-border)",
        boxShadow:
          "0 16px 40px rgba(0,0,0,0.45), 0 0 20px var(--tour-accent-glow)",
        ...style,
      }}
    >
      {/* Inner chamfered surface */}
      <div
        className="relative size-full overflow-hidden text-[var(--tour-text)]"
        style={{
          clipPath: innerClip,
          backgroundColor: raised
            ? "var(--tour-surface-raised)"
            : "var(--tour-surface)",
        }}
      >
        {/* Specular top light edge */}
        <div
          aria-hidden="true"
          className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[var(--tour-text)]/15 to-transparent pointer-events-none z-10"
        />

        {/* Optional scanline sweep on mount */}
        {scanline && <ScanLine reducedMotion={reducedMotion} tier={tier} />}

        {children}
      </div>

      {/* Optional corner targeting ticks */}
      {cornerTicks && (
        <>
          {/* Top-Left */}
          <span
            aria-hidden="true"
            className="absolute top-1 left-1 size-2 border-t border-l border-[var(--tour-accent)] opacity-85 pointer-events-none z-20"
          />
          {/* Top-Right */}
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 size-2 border-t border-r border-[var(--tour-accent)] opacity-85 pointer-events-none z-20"
          />
          {/* Bottom-Left */}
          <span
            aria-hidden="true"
            className="absolute bottom-1 left-1 size-2 border-b border-l border-[var(--tour-accent)] opacity-85 pointer-events-none z-20"
          />
          {/* Bottom-Right */}
          <span
            aria-hidden="true"
            className="absolute bottom-1 right-1 size-2 border-b border-r border-[var(--tour-accent)] opacity-85 pointer-events-none z-20"
          />
        </>
      )}
    </div>
  );
}
