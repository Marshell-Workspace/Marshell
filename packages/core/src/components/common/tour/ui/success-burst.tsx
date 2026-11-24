"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

/** Single feature flag to easily toggle the first success burst */
export const ENABLE_FIRST_SUCCESS_BURST = true;

export interface SuccessBurstProps {
  onComplete?: () => void;
  origin: { x: number; y: number };
  reducedMotion?: boolean;
  tier?: "performance" | "balanced" | "eco";
}

// 8 radial particle trajectories (offsets in px)
const BURST_PARTICLES = [
  { dx: 0, dy: -55 },
  { dx: 38, dy: -38 },
  { dx: 55, dy: 0 },
  { dx: 38, dy: 38 },
  { dx: 0, dy: 55 },
  { dx: -38, dy: 38 },
  { dx: -55, dy: 0 },
  { dx: -38, dy: -38 },
];

/**
 * SuccessBurst — One-time tactical celebratory burst for Step 9 workspace creation.
 * Radiates shockwaves and spark particles from the submit button center.
 * Concludes in ~750ms (strictly under 1s).
 * Performance gated (disabled in eco or prefers-reduced-motion).
 */
export function SuccessBurst({
  origin,
  onComplete,
  reducedMotion = false,
  tier = "performance",
}: SuccessBurstProps) {
  const [active, setActive] = useState(true);
  const isEco = tier === "eco" || reducedMotion;

  useEffect(() => {
    // Under 1s lifecycle (750ms total animation)
    const timer = setTimeout(() => {
      setActive(false);
      onComplete?.();
    }, 750);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!ENABLE_FIRST_SUCCESS_BURST || isEco || !active) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none overflow-hidden z-[9999]"
    >
      {/* ── Pulse 1: Sharp expanding telemetry shockwave ───────────────── */}
      <motion.div
        animate={{
          scale: [0.25, 2.5],
          opacity: [0.95, 0],
        }}
        className="absolute rounded-full border-2 border-[var(--tour-success)]"
        initial={{ scale: 0.25, opacity: 0.95 }}
        style={{
          left: origin.x - 30,
          top: origin.y - 30,
          width: 60,
          height: 60,
          boxShadow: "0 0 24px var(--tour-success)",
        }}
        transition={{
          duration: 0.65,
          ease: [0.1, 0.9, 0.2, 1],
        }}
      />

      {/* ── Pulse 2: Secondary ambient color-wash wave ─────────────────── */}
      <motion.div
        animate={{
          scale: [0.4, 3.2],
          opacity: [0.65, 0],
        }}
        className="absolute rounded-full"
        initial={{ scale: 0.4, opacity: 0.65 }}
        style={{
          left: origin.x - 30,
          top: origin.y - 30,
          width: 60,
          height: 60,
          backgroundColor:
            "color-mix(in oklab, var(--tour-success) 24%, transparent)",
        }}
        transition={{
          duration: 0.72,
          ease: "easeOut",
        }}
      />

      {/* ── Particles: 8 directional spark telemetry nodes ─────────────── */}
      {BURST_PARTICLES.map((p, idx) => (
        <motion.span
          animate={{
            x: p.dx,
            y: p.dy,
            scale: [1, 1.4, 0],
            opacity: [1, 0.85, 0],
          }}
          className="absolute size-2 rounded-full bg-[var(--tour-success)]"
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          key={idx}
          style={{
            left: origin.x - 4,
            top: origin.y - 4,
            boxShadow: "0 0 8px var(--tour-success)",
          }}
          transition={{
            duration: 0.6,
            ease: [0.2, 0.8, 0.2, 1],
            delay: 0.04,
          }}
        />
      ))}
    </div>
  );
}
