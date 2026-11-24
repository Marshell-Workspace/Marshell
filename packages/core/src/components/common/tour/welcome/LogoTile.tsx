/**
 * LogoTile.tsx — Marshell High-DPI Logo Tile with Dual Rim & Center-to-Upper Glide (Revision 3).
 *
 * Implements:
 * 1. Sizing:
 *    - In final state: L = clamp(150px, 0.20*H, 240px).
 *    - During ALIGN: logo scale is La = 1.2*L.
 * 2. ALIGN (2.70s -> 4.00s):
 *    - Blooms out of center singularity: scale 0 -> 1.06 -> 1.0 on spring (zeta 0.55, 2.70 to 3.15s).
 *    - Dual-color rim: faint blue on left edge, near-white on right edge.
 *    - Thin top specular highlight & soft inner shadow.
 * 3. WELCOME (4.00s -> 4.90s):
 *    - Smooth decelerating cubic glide from center C up to 0.26*H with no bounce.
 *    - Smoothly transitions scale from La (1.2 L) down to L (1.0 L).
 * 4. AMBIENT IDLE (6.10s onwards):
 *    - Floating breathe motion (~3px, 6s period) applied EXCLUSIVELY to an inner wrapper.
 *    - Outer container element remains in clean resting bounds so the existing sidebar
 *      handoff flight measures the exact, stable rect!
 * Zero React state updates per frame — driven directly via registerFrameCallback.
 */

"use client";

import Image from "next/image";
import { type RefObject, useEffect, useRef } from "react";
import type { FrameCallback } from "./useWelcomeTimeline";
import {
  getLayerVisibility,
  RASTER_SCALE,
  WELCOME_CONFIG,
  WELCOME_STRINGS,
} from "./welcome.config";

export interface LogoTileProps {
  logoContainerRef: RefObject<HTMLDivElement | null>;
  logoSize?: number;
  reducedMotion: boolean;
  registerFrameCallback: (cb: FrameCallback) => () => void;
  slotOffset: { x: number; y: number };
  tier: "performance" | "balanced" | "eco";
  viewport: { width: number; height: number };
}

export function LogoTile({
  reducedMotion,
  registerFrameCallback,
  tier: _tier,
  logoContainerRef,
  slotOffset,
  viewport: _viewport,
  logoSize = 180,
}: LogoTileProps) {
  const innerFloatRef = useRef<HTMLDivElement>(null);

  const L = logoSize;
  const _La = 1.2 * L;
  const rasterSize = L * RASTER_SCALE;
  const rasterRadius = Math.round(L * 0.24 * RASTER_SCALE);
  const rasterImgSize = Math.round(rasterSize * 0.82);

  const restingScale = 1 / RASTER_SCALE; // so rendered size is exactly L
  const alignScale = restingScale * 1.2; // La = 1.2*L

  useEffect(() => {
    if (reducedMotion) {
      if (logoContainerRef.current) {
        logoContainerRef.current.style.opacity = "1";
        logoContainerRef.current.style.transform = `translate3d(${slotOffset.x}px, ${slotOffset.y}px, 0px) scale(${restingScale})`;
      }
      return;
    }

    const { align, welcome, ambient } = WELCOME_CONFIG;

    const onFrame = (t: number) => {
      const container = logoContainerRef.current;
      const innerFloat = innerFloatRef.current;
      if (!container) {
        return;
      }

      container.style.visibility = getLayerVisibility("logo") ? "" : "hidden";

      if (t < align.logoBloomStart) {
        container.style.opacity = "0";
        container.style.transform = "translate3d(0px, 0px, 0px) scale(0)";
        return;
      }

      // ── 1. Bloom at Center (2.70s -> 4.00s, scale 0 -> 1.06 -> 1.0 * La) ──
      if (t < welcome.logoGlideStart) {
        const tau = t - align.logoBloomStart;
        // Underdamped spring: omega0 = 14, zeta = 0.55 (peaks at ~1.06, settles by 3.15s)
        const omega0 = 14.0;
        const zeta = 0.55;
        const wd = omega0 * Math.sqrt(1 - zeta * zeta);
        const expFactor = Math.exp(-zeta * omega0 * tau);
        const sprVal =
          1 -
          expFactor *
            (Math.cos(wd * tau) + ((zeta * omega0) / wd) * Math.sin(wd * tau));

        const currScale = alignScale * Math.max(0, sprVal);
        const alpha = Math.min(1.0, tau / 0.16);

        container.style.opacity = String(alpha);
        container.style.transform = `translate3d(0px, 0px, 0px) scale(${currScale.toFixed(4)})`;
        return;
      }

      // ── 2. Center-to-Upper Glide (4.00s -> 4.90s, La -> L) ──
      if (t < welcome.logoGlideEnd) {
        const glideProgress =
          (t - welcome.logoGlideStart) /
          (welcome.logoGlideEnd - welcome.logoGlideStart);
        // Smooth decelerating cubic ease (no bounce)
        const ease = 1 - (1 - glideProgress) ** 3;

        const currX = slotOffset.x * ease;
        const currY = slotOffset.y * ease;
        const currScale = alignScale + (restingScale - alignScale) * ease;

        container.style.opacity = "1";
        container.style.transform = `translate3d(${currX.toFixed(2)}px, ${currY.toFixed(2)}px, 0px) scale(${currScale.toFixed(4)})`;
        return;
      }

      // ── 3. Resting State & Ambient Idle (4.90s onwards) ──
      container.style.opacity = "1";
      container.style.transform = `translate3d(${slotOffset.x}px, ${slotOffset.y}px, 0px) scale(${restingScale.toFixed(4)})`;

      // Gentle float applied exclusively to inner wrapper
      if (innerFloat && t >= welcome.totalDuration) {
        const ambientTime = t - welcome.totalDuration;
        const floatY =
          Math.sin((ambientTime * Math.PI * 2) / ambient.logoFloatPeriod) *
          ambient.logoFloatAmplitude;
        innerFloat.style.transform = `translateY(${floatY.toFixed(2)}px)`;
      }
    };

    return registerFrameCallback(onFrame);
  }, [
    reducedMotion,
    registerFrameCallback,
    slotOffset,
    restingScale,
    alignScale,
    logoContainerRef,
  ]);

  return (
    <div
      aria-hidden="true"
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center z-30"
      ref={logoContainerRef}
      style={{
        width: rasterSize,
        height: rasterSize,
        transformOrigin: "center center",
        transform: reducedMotion
          ? `translate3d(${slotOffset.x}px, ${slotOffset.y}px, 0px) scale(${restingScale})`
          : "translate3d(0px, 0px, 0px) scale(0)",
        opacity: reducedMotion ? 1 : 0,
        contain: "layout paint",
      }}
    >
      {/* ── Inner Float Wrapper (Preserves outer node resting rect for handoff flight) ── */}
      <div
        className="relative size-full flex items-center justify-center"
        ref={innerFloatRef}
      >
        {/* ── Rounded Logo Tile Surface with Dual Rim & Specular Highlight ── */}
        <div
          className="relative size-full flex items-center justify-center overflow-hidden"
          style={{
            borderRadius: rasterRadius,
            background:
              "linear-gradient(135deg, rgba(28, 30, 38, 0.95) 0%, rgba(10, 12, 16, 0.98) 100%)",
            border: "3px solid rgba(255, 255, 255, 0.14)",
            boxShadow: [
              "0 0 0 1px rgba(255, 255, 255, 0.18)",
              "inset 0 2px 0 rgba(255, 255, 255, 0.25)",
              "inset 0 -2px 0 rgba(0, 0, 0, 0.65)",
            ].join(", "),
          }}
        >
          {/* Dual-Color Rim: Faint Blue on Left, Faint Near-White on Right */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, rgba(59, 130, 246, 0.45) 0%, transparent 25%, transparent 75%, rgba(238, 241, 247, 0.45) 100%)",
            }}
          />

          {/* Top-Edge Specular Sheen */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay"
            style={{
              background:
                "linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.85) 50%, transparent 65%)",
            }}
          />

          {/* Official Marshell Logo Artwork */}
          <Image
            alt={WELCOME_STRINGS.appName}
            className="select-none object-contain pointer-events-none"
            height={rasterImgSize}
            priority
            src="/main_logo.png"
            style={{ width: rasterImgSize, height: rasterImgSize }}
            width={rasterImgSize}
          />
        </div>
      </div>
    </div>
  );
}
