"use client";

/**
 * Mission Control HUD Motion Presets & Tokens.
 *
 * Durations:
 * - fast (120ms): micro-interactions, reticle tick lock, status changes
 * - normal (220ms): step transitions, drawer & HUD panel reveal
 * - slow (420ms): boot sequence, modal reveal, signal line draw
 *
 * Gated by reducedMotion and eco tier for zero-jank high-performance animation.
 */

export const HUD_DURATIONS = {
  fast: 0.12,
  normal: 0.22,
  slow: 0.42,
} as const;

export const HUD_EASINGS = {
  decel: [0.16, 1, 0.3, 1] as const, // signature fast out, soft settle
  linear: "linear" as const,
};

export const HUD_SPRINGS = {
  tactical: { type: "spring", stiffness: 380, damping: 28, mass: 0.8 } as const,
  gentle: { type: "spring", stiffness: 280, damping: 26, mass: 1 } as const,
};

/** Reusable Named Motion Preset: Lock-On (Reticle snap to target coordinates) */
export const lockOnVariants = {
  initial: { scale: 1.15, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: HUD_DURATIONS.normal,
      ease: HUD_EASINGS.decel,
    },
  },
  exit: {
    scale: 0.95,
    opacity: 0,
    transition: { duration: HUD_DURATIONS.fast },
  },
};

/** Reusable Named Motion Preset: Boot (Staggered telemetry power-up) */
export const bootContainerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

export const bootItemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: HUD_DURATIONS.normal,
      ease: HUD_EASINGS.decel,
    },
  },
};

/** Reusable Named Motion Preset: Pulse-Wave (Concentric telemetry radar pulse) */
export const pulseWaveVariants = {
  initial: { scale: 0.85, opacity: 0.9 },
  animate: {
    scale: [0.85, 1.5],
    opacity: [0.9, 0],
    transition: {
      duration: 1.6,
      repeat: Number.POSITIVE_INFINITY,
      ease: "easeOut",
    },
  },
};
