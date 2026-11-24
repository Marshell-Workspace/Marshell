"use client";

import { cn } from "@workspace/ui/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export interface MicroLabelProps extends HTMLAttributes<HTMLSpanElement> {
  badge?: boolean;
  children: ReactNode;
  dot?: boolean;
  size?: "xs" | "sm";
  variant?: "default" | "accent" | "success" | "warning" | "muted";
}

/**
 * MicroLabel — Monospace telemetric label for mission control counters,
 * step indicators, and section eyebrows.
 *
 * NOTE: Used strictly for telemetry microcopy, never for narrative body copy.
 */
export function MicroLabel({
  children,
  variant = "muted",
  size = "xs",
  badge = false,
  dot = false,
  className,
  ...props
}: MicroLabelProps) {
  const colorStyles = {
    default: "text-[var(--tour-text)]",
    muted: "text-[var(--tour-text-muted)]",
    accent: "text-[var(--tour-accent)]",
    success: "text-[var(--tour-success)]",
    warning: "text-[var(--tour-warning)]",
  };

  const dotColors = {
    default: "bg-[var(--tour-text)]",
    muted: "bg-[var(--tour-text-muted)]",
    accent: "bg-[var(--tour-accent)]",
    success: "bg-[var(--tour-success)]",
    warning: "bg-[var(--tour-warning)]",
  };

  const sizeStyles = {
    xs: "text-[10px] leading-tight",
    sm: "text-[11px] leading-tight",
  };

  return (
    <span
      className={cn(
        "font-mono uppercase tracking-[0.12em] font-semibold select-none inline-flex items-center gap-1.5",
        sizeStyles[size],
        colorStyles[variant],
        badge &&
          "px-2 py-0.5 rounded-[4px] border border-[var(--tour-border)] bg-[var(--tour-surface-raised)]/70 backdrop-blur-xs",
        className
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-full shrink-0 shadow-[0_0_6px_currentColor]",
            dotColors[variant]
          )}
        />
      )}
      {children}
    </span>
  );
}
