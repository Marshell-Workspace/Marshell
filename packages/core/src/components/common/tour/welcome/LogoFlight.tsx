/**
 * LogoFlight.tsx — Imperative High-DPI Logo Tile with Power-On Reveal (Revision 5).
 *
 * Implements:
 * 1. Logo Power-On:
 *    - Dim copy with static filter: brightness(0.35).
 *    - Lit copy fades in on top over 500ms (opacity only).
 *    - ONE soft accent glow pulse centered on ">_" glyph (opacity only).
 *    - No outline ring, no rim light.
 * 2. High-DPI rendering at RASTER_SCALE (3x = 336px desktop / 288px mobile).
 * 3. Handoff-ready: container ref allows smooth travel to sidebar target on Start.
 * 4. Zero React re-renders per frame during engine animation.
 */

"use client";

import Image from "next/image";
import { type RefObject, useEffect, useRef } from "react";
import {
  DESKTOP_LOGO_RADIUS,
  DESKTOP_LOGO_SIZE,
  DESKTOP_RASTER_TILE_PX,
  MOBILE_LOGO_RADIUS,
  MOBILE_LOGO_SIZE,
  MOBILE_RASTER_TILE_PX,
  RASTER_SCALE,
  SPRINGS,
  WELCOME_STRINGS,
} from "./welcome.config";

export interface LogoFlightProps {
  dimTileRef?: RefObject<HTMLDivElement | null>;
  glyphGlowRef?: RefObject<HTMLDivElement | null>;
  isReady: boolean;
  litTileRef?: RefObject<HTMLDivElement | null>;
  logoContainerRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
  sharpTileRef?: RefObject<HTMLDivElement | null>;
  slotOffset: { x: number; y: number };
  tier: "performance" | "balanced" | "eco";
  viewport: { width: number; height: number };
}

export function LogoFlight({
  logoContainerRef,
  sharpTileRef,
  litTileRef,
  dimTileRef,
  glyphGlowRef,
  isReady,
  reducedMotion,
  tier,
  viewport,
  slotOffset,
}: LogoFlightProps) {
  const isEco = tier === "eco";
  const isPerf = tier === "performance";
  const isMobile = viewport.width < 640;

  const slotSize = isMobile ? MOBILE_LOGO_SIZE : DESKTOP_LOGO_SIZE;
  const slotRadius = isMobile ? MOBILE_LOGO_RADIUS : DESKTOP_LOGO_RADIUS;

  // 3x raster size
  const rasterSize = isMobile ? MOBILE_RASTER_TILE_PX : DESKTOP_RASTER_TILE_PX;
  const rasterRadius = slotRadius * RASTER_SCALE;
  const rasterImgSize = Math.round(rasterSize * 0.82);
  const baseScale = slotSize / rasterSize; // 1 / 3

  const tiltWrapperRef = useRef<HTMLDivElement>(null);

  // ── Post-Ready Pointer Tilt (Lightweight rAF, Only Runs While Moving) ──────
  useEffect(() => {
    if (!isReady || reducedMotion || isEco || typeof window === "undefined") {
      return;
    }

    const wrapper = tiltWrapperRef.current;
    if (!wrapper) {
      return;
    }

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let tiltRamp = 0;
    let rafId = 0;
    let isMoving = false;
    const startRampTime = performance.now();

    const onMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetX = Math.max(-1, Math.min(1, (e.clientX - cx) / cx));
      targetY = Math.max(-1, Math.min(1, (e.clientY - cy) / cy));
      if (!isMoving) {
        isMoving = true;
        tick();
      }
    };

    const tick = () => {
      const now = performance.now();
      const elapsed = (now - startRampTime) / SPRINGS.tiltRampDurationMs;
      tiltRamp = Math.min(1, elapsed);

      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      const rotX = currentY * -SPRINGS.maxPointerTiltDeg * tiltRamp;
      const rotY = currentX * SPRINGS.maxPointerTiltDeg * tiltRamp;

      wrapper.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;

      const dx = Math.abs(targetX - currentX);
      const dy = Math.abs(targetY - currentY);

      if (dx > 0.005 || dy > 0.005 || tiltRamp < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        isMoving = false;
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [isReady, reducedMotion, isEco]);

  // Reduced motion: instant in-flow render
  if (reducedMotion) {
    return (
      <div
        className="relative flex items-center justify-center select-none"
        style={{ width: slotSize, height: slotSize }}
      >
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{
            width: slotSize,
            height: slotSize,
            borderRadius: slotRadius,
            background: "var(--tour-surface-raised)",
            boxShadow:
              "0 0 0 1px var(--tour-border), 0 0 28px var(--tour-accent-glow), 0 16px 36px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
          }}
        >
          <Image
            alt={WELCOME_STRINGS.appName}
            className="select-none object-contain pointer-events-none"
            height={Math.round(slotSize * 0.82)}
            priority
            src="/main_logo.png"
            style={{
              width: Math.round(slotSize * 0.82),
              height: Math.round(slotSize * 0.82),
            }}
            width={Math.round(slotSize * 0.82)}
          />
        </div>
      </div>
    );
  }

  // Common tile structure generator
  const renderTileContent = (filterCss: string) => (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{
        borderRadius: rasterRadius,
        background: "var(--tour-surface-raised)",
        border: "3px solid var(--tour-border)",
        boxShadow: [
          "0 0 0 1px rgba(255,255,255,0.08)",
          "0 0 45px var(--tour-accent-glow)",
          "0 24px 50px rgba(0,0,0,0.55)",
          "inset 0 2px 0 rgba(255,255,255,0.18)",
        ].join(", "),
        filter: filterCss,
      }}
    >
      {/* Specular sheen */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay"
        style={{
          background:
            "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.85) 50%, transparent 65%)",
        }}
      />
      {/* 1024px logo graphic */}
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
  );

  const activeLitRef = litTileRef ?? sharpTileRef;

  return (
    <div
      aria-hidden="true"
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center z-30"
      ref={logoContainerRef}
      style={{
        width: rasterSize,
        height: rasterSize,
        transform: `translate3d(${slotOffset.x}px, ${slotOffset.y}px, 0px) scale(${baseScale})`,
        opacity: 0,
        willChange: "transform, opacity",
      }}
    >
      {/* Ambient Corona Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: -70,
          background:
            "radial-gradient(circle, var(--tour-accent-glow) 0%, color-mix(in oklab, var(--tour-accent) 12%, transparent) 48%, transparent 70%)",
        }}
      />

      {/* Middle Wrapper: Post-ready tilt & idle breathe */}
      <div
        className={`relative size-full flex items-center justify-center ${
          isReady && isPerf ? "animate-tour-idle-breathe" : ""
        }`}
        ref={tiltWrapperRef}
        style={{ willChange: "transform" }}
      >
        {/* Layer 1: Dim copy (static filter: brightness(0.35)) */}
        <div
          className="absolute inset-0 size-full"
          ref={dimTileRef}
          style={{ opacity: 1, willChange: "opacity" }}
        >
          {renderTileContent("brightness(0.35)")}
        </div>

        {/* Layer 2: Lit copy (sharp, normal brightness) fades in over 500ms */}
        <div
          className="absolute inset-0 size-full"
          ref={activeLitRef}
          style={{ opacity: 0, willChange: "opacity" }}
        >
          {renderTileContent("none")}
        </div>

        {/* Layer 3: Soft accent glow pulse centered on '>_' glyph (opacity only) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full z-10"
          ref={glyphGlowRef}
          style={{
            width: Math.round(rasterSize * 0.45),
            height: Math.round(rasterSize * 0.45),
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, var(--tour-accent) 0%, var(--tour-accent-glow) 45%, transparent 75%)",
            opacity: 0,
            willChange: "opacity",
          }}
        />
      </div>
    </div>
  );
}
