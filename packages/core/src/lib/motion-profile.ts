import type { PerformanceTier } from "@workspace/core/stores/performance-store";
import type { Transition } from "motion/react";
import { useReducedMotion } from "motion/react";

/**
 * The JS half of Marshell's motion system.
 *
 * CSS-only motion is driven by the `--motion-*` custom properties in
 * globals.css. Animation that runs through `motion/react` cannot read those,
 * so the same four numbers live here. Keep the two in step: globals.css is the
 * source of truth for the values, this file mirrors them.
 *
 *   intensity  — how far things travel (entrances, panel movement)
 *   micro      — hover / press / focus feedback
 *   transition — how expressive a transition is allowed to be
 *   decorative — always-on flourishes that communicate nothing
 */
export interface MotionScale {
  decorative: number;
  intensity: number;
  micro: number;
  transition: number;
}

const SHARED_MOTION_SCALE: MotionScale = {
  decorative: 0.35,
  intensity: 0.55,
  micro: 0.55,
  transition: 0.6,
};

export const MOTION_SCALES: Record<PerformanceTier, MotionScale> = {
  eco: SHARED_MOTION_SCALE,
  balanced: SHARED_MOTION_SCALE,
  performance: SHARED_MOTION_SCALE,
};

/** Motion fully stilled — what `prefers-reduced-motion` collapses every profile to. */
export const STILL_SCALE: MotionScale = {
  decorative: 0,
  intensity: 0,
  micro: 0,
  transition: 0,
};

/** Short compositor transitions stay consistent across resource profiles. */
const SHARED_TRANSITION: Transition = { duration: 0.16, ease: "easeOut" };
export const MOTION_TRANSITIONS: Record<PerformanceTier, Transition> = {
  eco: SHARED_TRANSITION,
  balanced: SHARED_TRANSITION,
  performance: SHARED_TRANSITION,
};

/**
 * The active motion scale, already collapsed to {@link STILL_SCALE} when the
 * viewer asks for reduced motion — that always wins, Turbo included.
 */
export function useMotionScale(): MotionScale {
  const shouldReduce = useReducedMotion();
  if (shouldReduce) {
    return STILL_SCALE;
  }
  return SHARED_MOTION_SCALE;
}

/**
 * Scales a distance (px) by the profile's motion intensity, for JS-driven
 * entrances that would otherwise hard-code how far an element travels.
 */
export function travel(px: number, scale: MotionScale): number {
  return Math.round(px * scale.intensity * 100) / 100;
}
