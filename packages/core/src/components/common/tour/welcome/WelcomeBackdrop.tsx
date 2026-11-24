"use client";

import type { RefObject } from "react";
import { ATMOSPHERE, GOD_RAYS } from "./welcome.config";

export interface WelcomeBackdropProps {
  backdropDollyRef?: RefObject<HTMLDivElement | null>;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  godRaysRef?: RefObject<HTMLDivElement | null>;
  reducedMotion?: boolean;
  tier?: "performance" | "balanced" | "eco";
}

/**
 * WelcomeBackdrop — Cinematic dark environment v3 for Marshell (Revision 4).
 *
 * Implements 7 layered atmospheric elements:
 * 1. Base deep blue-black gradient (#03050a -> #070b14)
 * 2. Drifting volumetric fog blobs (oklab accent mix, 40-70s loops)
 * 3. Pre-blurred god rays layer (rotated & faded purely via engine.ts DOM refs)
 * 4. Single canvas for dust, drifting embers, bokeh discs, and orbit ribbon (drawn by engine.ts)
 * 5. Static SVG feTurbulence film grain (3.5% overlay)
 * 6. Edge-weighted radial vignette
 * 7. Slow camera push-in dolly (scale updated by engine.ts)
 *
 * Zero internal rAF loops, zero Framer Motion subscriptions, zero per-frame React re-renders.
 */
export function WelcomeBackdrop({
  reducedMotion = false,
  tier = "performance",
  backdropDollyRef,
  godRaysRef,
  canvasRef,
}: WelcomeBackdropProps) {
  const isEco = tier === "eco";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden select-none"
      ref={backdropDollyRef}
      style={{
        transform: "scale(1)",
        backgroundColor: ATMOSPHERE.bgTopColor,
        willChange: "transform",
      }}
    >
      {/* ── 1. Base Gradient (#03050a -> #070b14) ───────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${ATMOSPHERE.bgTopColor} 0%, ${ATMOSPHERE.bgBottomColor} 100%)`,
        }}
      />

      {/* ── 2. Volumetric Drifting Fog Blobs ─────────────────────────────────── */}
      <div
        className="absolute -top-[15%] -left-[10%] w-[850px] h-[850px] rounded-full blur-[140px] opacity-10"
        style={{
          background:
            "radial-gradient(circle, var(--tour-accent) 0%, transparent 70%)",
          animation:
            reducedMotion || isEco
              ? "none"
              : "tour-orbit-cw 55s linear infinite",
        }}
      />
      <div
        className="absolute -bottom-[20%] -right-[15%] w-[950px] h-[950px] rounded-full blur-[160px] opacity-12"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--tour-accent) 80%, white) 0%, transparent 70%)",
          animation:
            reducedMotion || isEco
              ? "none"
              : "tour-orbit-ccw 65s linear infinite",
        }}
      />
      <div
        className="absolute top-[30%] left-[25%] w-[650px] h-[650px] rounded-full blur-[120px] opacity-08"
        style={{
          background:
            "radial-gradient(circle, var(--tour-accent) 0%, transparent 65%)",
        }}
      />

      {/* ── 3. Rotating God Rays (Conic Gradient, Driven via engine.ts) ──────── */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1400px] h-[1400px] pointer-events-none"
        ref={godRaysRef}
        style={{
          opacity: GOD_RAYS.baseOpacity,
          mixBlendMode: "screen",
          maskImage:
            "radial-gradient(circle at center, black 0%, transparent 68%)",
          WebkitMaskImage:
            "radial-gradient(circle at center, black 0%, transparent 68%)",
          filter: "blur(24px)",
          background: `conic-gradient(
            from 0deg,
            transparent 0deg,
            color-mix(in oklab, var(--tour-accent) 60%, white) 12deg,
            transparent 24deg,
            transparent 60deg,
            color-mix(in oklab, var(--tour-accent) 60%, white) 75deg,
            transparent 90deg,
            transparent 135deg,
            color-mix(in oklab, var(--tour-accent) 60%, white) 150deg,
            transparent 165deg,
            transparent 210deg,
            color-mix(in oklab, var(--tour-accent) 60%, white) 225deg,
            transparent 240deg,
            transparent 285deg,
            color-mix(in oklab, var(--tour-accent) 60%, white) 300deg,
            transparent 315deg,
            transparent 360deg
          )`,
          willChange: "transform, opacity",
        }}
      />

      {/* ── 4. Particle Canvas (Dust, Embers, Bokeh, Orbit Ribbon) ──────────── */}
      <canvas
        className="absolute inset-0 pointer-events-none"
        ref={canvasRef}
      />

      {/* ── 5. Static Film Grain (SVG feTurbulence data-URI) ─────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: ATMOSPHERE.grainOpacity,
          mixBlendMode: "overlay",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── 6. Cinematic Corner Vignette ────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 40%, rgba(3, 5, 10, 0.85) 100%)",
        }}
      />
    </div>
  );
}
