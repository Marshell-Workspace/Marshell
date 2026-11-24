"use client";

import { motion } from "motion/react";
import { HUD_DURATIONS, HUD_EASINGS } from "./motion-presets";

interface ScanLineProps {
  className?: string;
  onComplete?: () => void;
  reducedMotion?: boolean;
  tier?: "performance" | "balanced" | "eco";
}

/**
 * ScanLine — One-shot tactical sweep across a HUD panel.
 * Strictly disabled in eco tier or when reduced motion is preferred.
 */
export function ScanLine({
  tier = "performance",
  reducedMotion = false,
  className = "",
  onComplete,
}: ScanLineProps) {
  // Performance gate: Eco tier and reduced motion never render animated scanlines
  if (tier === "eco" || reducedMotion) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 inset-y-0 overflow-hidden z-20 ${className}`}
    >
      <motion.div
        animate={{
          y: ["-100%", "250%"],
          opacity: [0, 1, 1, 0],
        }}
        className="h-10 w-full"
        initial={{ y: "-100%", opacity: 0 }}
        onAnimationComplete={onComplete}
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, var(--tour-scan) 50%, transparent 100%)",
          borderBottom:
            "1px solid color-mix(in oklab, var(--tour-accent) 55%, transparent)",
        }}
        transition={{
          duration: HUD_DURATIONS.slow,
          ease: HUD_EASINGS.decel,
        }}
      />
    </div>
  );
}
