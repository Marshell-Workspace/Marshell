"use client";

import { cn } from "@workspace/ui/lib/utils";
import { motion } from "motion/react";

export interface StatusLedProps {
  className?: string;
  pulse?: boolean;
  reducedMotion?: boolean;
  size?: "sm" | "md" | "lg";
  status?: "active" | "ready" | "standby" | "alert";
  tier?: "performance" | "balanced" | "eco";
}

/**
 * StatusLed — Tactical mission status indicator dot.
 * Continuous pulsing is gated by performance tier and prefers-reduced-motion.
 */
export function StatusLed({
  status = "active",
  size = "md",
  pulse = true,
  reducedMotion = false,
  tier = "performance",
  className,
}: StatusLedProps) {
  const isEco = tier === "eco" || reducedMotion;
  const shouldAnimate = pulse && !isEco;

  const sizePixels = {
    sm: 6,
    md: 8,
    lg: 10,
  }[size];

  const statusColors = {
    active: "var(--tour-accent)",
    ready: "var(--tour-success)",
    standby: "var(--tour-text-muted)",
    alert: "var(--tour-warning)",
  }[status];

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center shrink-0",
        className
      )}
      style={{ width: sizePixels, height: sizePixels }}
    >
      {/* Outer ambient pulse wave (disabled on eco/reducedMotion) */}
      {shouldAnimate && (
        <motion.span
          animate={{
            scale: [1, 2.2],
            opacity: [0.75, 0],
          }}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            backgroundColor: statusColors,
          }}
          transition={{
            duration: 1.8,
            ease: "easeOut",
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
      )}

      {/* Core solid status dot */}
      <span
        className="relative rounded-full size-full"
        style={{
          backgroundColor: statusColors,
          boxShadow: isEco ? "none" : `0 0 6px ${statusColors}`,
        }}
      />
    </span>
  );
}
