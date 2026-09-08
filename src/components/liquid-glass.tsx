"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const liquidGlassVariants = cva(
  "relative overflow-hidden transition-all duration-200 isolate",
  {
    variants: {
      elevation: {
        surface:
          "bg-[var(--glass-surface)]/75 border border-[var(--glass-border)] shadow-[var(--glass-shadow)]",
        elevated:
          "bg-[var(--glass-surface-elevated)]/85 border border-[var(--glass-border)] shadow-[var(--glass-shadow-elevated)]",
        floating:
          "bg-[var(--glass-surface-floating)]/90 border border-[var(--glass-border-strong)] shadow-[var(--glass-shadow-floating)]",
      },
      refraction: {
        none: "",
        subtle: "liquid-glass-refract-subtle",
        standard: "liquid-glass-refract",
        elevated: "liquid-glass-refract-elevated",
        button: "liquid-glass-refract-button",
      },
      specular: {
        true: "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--glass-highlight)] before:z-10",
        subtle:
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--glass-highlight-subtle)] before:z-10",
        false: "",
      },
      edgeLighting: {
        true: "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.12),inset_0_-1px_1px_0_rgba(0,0,0,0.4)] after:z-10",
        strong:
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_1.5px_2px_0_rgba(255,255,255,0.2),inset_0_-1.5px_2px_0_rgba(0,0,0,0.6)] after:z-10",
        none: "",
      },
    },
    defaultVariants: {
      elevation: "surface",
      refraction: "standard",
      specular: true,
      edgeLighting: true,
    },
  }
);

export interface LiquidGlassProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof liquidGlassVariants> {
  asChild?: boolean;
}

export function LiquidGlass({
  className,
  elevation,
  refraction,
  specular,
  edgeLighting,
  children,
  ...props
}: LiquidGlassProps) {
  return (
    <div
      className={cn(
        liquidGlassVariants({
          elevation,
          refraction,
          specular,
          edgeLighting,
          className,
        })
      )}
      {...props}
    >
      {/* Background optical refraction layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] overflow-hidden backdrop-blur-[var(--glass-blur)]"
        style={{
          backdropFilter:
            refraction === "elevated"
              ? 'url("#hyperion-liquid-glass-elevated")'
              : refraction === "subtle"
                ? 'url("#hyperion-liquid-glass-subtle")'
                : refraction === "button"
                  ? 'url("#hyperion-liquid-glass-button")'
                  : refraction === "none"
                    ? "none"
                    : 'url("#hyperion-liquid-glass")',
          WebkitBackdropFilter:
            refraction === "elevated"
              ? 'url("#hyperion-liquid-glass-elevated")'
              : refraction === "subtle"
                ? 'url("#hyperion-liquid-glass-subtle")'
                : refraction === "button"
                  ? 'url("#hyperion-liquid-glass-button")'
                  : refraction === "none"
                    ? "none"
                    : 'url("#hyperion-liquid-glass")',
        }}
      />

      {/* Content slot */}
      <div className="relative z-10 size-full">{children}</div>
    </div>
  );
}

export const LiquidGlassPanel = LiquidGlass;
// biome-ignore lint/performance/noBarrelFile: convenient re-export for LiquidGlassCard
export { LiquidGlassCard } from "./liquid-glass-card";
