"use client";

import { cn } from "@workspace/ui/lib/utils";
import { motion } from "motion/react";
import { HUD_DURATIONS, HUD_EASINGS } from "./motion-presets";

export interface SignalLineProps {
  accent?: string;
  animated?: boolean;
  className?: string;
  dashed?: boolean;
  from: { x: number; y: number };
  nodeEnd?: boolean;
  nodeStart?: boolean;
  reducedMotion?: boolean;
  routed?: boolean;
  tier?: "performance" | "balanced" | "eco";
  to: { x: number; y: number };
}

/**
 * SignalLine — Mission control HUD telemetry connector.
 * Renders an animated SVG trace connecting two coordinates.
 */
export function SignalLine({
  from,
  to,
  accent = "var(--tour-accent)",
  animated = true,
  reducedMotion = false,
  tier = "performance",
  dashed = false,
  nodeStart = true,
  nodeEnd = true,
  routed = false,
  className,
}: SignalLineProps) {
  const isEco = tier === "eco" || reducedMotion;
  const shouldAnimate = animated && !isEco;

  // Path coordinate geometry: either 90-degree tactical route or direct vector
  const pathD = routed
    ? `M ${from.x} ${from.y} L ${to.x} ${from.y} L ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

  return (
    <svg
      className={cn(
        "fixed inset-0 size-full pointer-events-none overflow-visible z-[9993]",
        className
      )}
    >
      {/* Animated trace */}
      {shouldAnimate ? (
        <motion.path
          animate={{ pathLength: 1, opacity: 0.75 }}
          d={pathD}
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          stroke={accent}
          strokeDasharray={dashed ? "4 4" : undefined}
          strokeLinecap="round"
          strokeWidth={1}
          transition={{
            duration: HUD_DURATIONS.normal,
            ease: HUD_EASINGS.decel,
          }}
        />
      ) : (
        <path
          d={pathD}
          fill="none"
          opacity={0.75}
          stroke={accent}
          strokeDasharray={dashed ? "4 4" : undefined}
          strokeLinecap="round"
          strokeWidth={1}
        />
      )}

      {/* Origin Node */}
      {nodeStart && <circle cx={from.x} cy={from.y} fill={accent} r={2.5} />}

      {/* Target Node with animated pulse ring */}
      {nodeEnd && (
        <g>
          {shouldAnimate && (
            <motion.circle
              animate={{ r: [3, 7.5], opacity: [0.75, 0] }}
              cx={to.x}
              cy={to.y}
              fill="none"
              stroke={accent}
              strokeWidth={1}
              transition={{
                duration: 1.5,
                ease: "easeOut",
                repeat: Number.POSITIVE_INFINITY,
              }}
            />
          )}
          <circle cx={to.x} cy={to.y} fill={accent} r={3} />
        </g>
      )}
    </svg>
  );
}
