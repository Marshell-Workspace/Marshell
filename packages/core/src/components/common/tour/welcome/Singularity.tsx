/**
 * Singularity.tsx — Central Point of Light, Crosshairs & Anamorphic Flare (Revision 3).
 *
 * Implements:
 * 1. VOID (0.00s -> 0.70s):
 *    - 4px white dot with soft radial halo at exact center C.
 *    - 4 faint crosshair hairlines starting 0.05*H away, extending 0.27*H, at 25% white,
 *      fading at both ends. Disappears by 0.70s.
 * 2. RESONANCE (0.70s -> 1.60s):
 *    - White-hot radial flare (radius ~0.06*H) with horizontal anamorphic streak (blue left, near-white right).
 * 3. UNFOLD (1.60s -> 2.70s):
 *    - 1.50 to 1.60 INHALE: compresses to scale 0.75, brightens 20%.
 *    - 1.60 RELEASE: short radial white-blue flash (opacity, 0.12s duration).
 *    - Streak stays through RESONANCE and UNFOLD.
 * 4. ALIGN (2.70s onwards):
 *    - Fades out smoothly as logo blooms at center.
 * Zero React state updates per frame — driven directly via registerFrameCallback.
 */

"use client";

import { useEffect, useRef } from "react";
import type { FrameCallback } from "./useWelcomeTimeline";
import { DESIGN_TOKENS, WELCOME_CONFIG } from "./welcome.config";

export interface SingularityProps {
  contentHeight?: number;
  originX?: number;
  originY?: number;
  reducedMotion: boolean;
  registerFrameCallback: (cb: FrameCallback) => () => void;
  tier: "performance" | "balanced" | "eco";
}

export function Singularity({
  reducedMotion,
  registerFrameCallback,
  tier: _tier,
  originX,
  originY,
  contentHeight,
}: SingularityProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreDotRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const releaseFlashRef = useRef<HTMLDivElement>(null);
  const flareStreakRef = useRef<HTMLDivElement>(null);
  const chTopRef = useRef<HTMLDivElement>(null);
  const chBottomRef = useRef<HTMLDivElement>(null);
  const chLeftRef = useRef<HTMLDivElement>(null);
  const chRightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) {
      if (containerRef.current) {
        containerRef.current.style.display = "none";
      }
      return;
    }

    const { void: voidCfg, resonance, unfold } = WELCOME_CONFIG;

    const onFrame = (t: number) => {
      // ── 1. Core Dot & Halo Fade-in (0.10s -> 0.45s) ──
      let dotAlpha = 0;
      let dotScale = 1.0;
      let haloAlpha = 0;

      if (t >= voidCfg.singularityFadeIn && t < voidCfg.singularityFadeEnd) {
        const p =
          (t - voidCfg.singularityFadeIn) /
          (voidCfg.singularityFadeEnd - voidCfg.singularityFadeIn);
        dotAlpha = p;
        haloAlpha = p * 0.7;
      } else if (t >= voidCfg.singularityFadeEnd && t < 0.5) {
        dotAlpha = 1.0;
        haloAlpha = 0.85;
      } else if (t >= 0.5 && t < 2.7) {
        // Frame 2 RESONANCE & Frame 3 UNFOLD: Singularity glow is exclusively rendered via WebGL/Canvas2D shaders (Section 7 & 10)
        dotAlpha = 0;
        haloAlpha = 0;
      } else if (t >= 2.7) {
        dotAlpha = 1.0;
        haloAlpha = 0.85;
      }

      // ── 2. Crosshair Draw, Retract & Fade (Retract toward point between 0.50s -> 0.90s) ──
      let chDraw = 0;
      let chAlpha = 0;
      if (t >= voidCfg.crosshairStart && t < voidCfg.crosshairPeak) {
        const p =
          (t - voidCfg.crosshairStart) /
          (voidCfg.crosshairPeak - voidCfg.crosshairStart);
        chDraw = p;
        chAlpha = p * voidCfg.alpha;
      } else if (t >= voidCfg.crosshairPeak && t < 0.5) {
        chDraw = 1.0;
        chAlpha = voidCfg.alpha;
      } else if (t >= 0.5 && t < 0.9) {
        const p = (t - 0.5) / 0.4;
        const pRetract = p * p * (3.0 - 2.0 * p);
        chDraw = 1.0 - pRetract;
        chAlpha = (1.0 - p) * voidCfg.alpha;
      } else {
        chDraw = 0;
        chAlpha = 0;
      }

      // ── 3. UNFOLD Inhale Compression (1.50s -> 1.60s) & Release Flash (1.60s -> 1.72s) ──
      let flashAlpha = 0;
      if (t < 1.5 || t >= 2.7) {
        if (t >= unfold.inhaleStart && t < unfold.inhaleEnd) {
          const p =
            (t - unfold.inhaleStart) / (unfold.inhaleEnd - unfold.inhaleStart);
          dotScale = 1.0 - (1.0 - unfold.inhaleScale) * Math.sin(p * Math.PI);
          dotAlpha = 1.2;
        } else if (
          t >= unfold.start &&
          t < unfold.start + unfold.releaseFlashDuration
        ) {
          const p = (t - unfold.start) / unfold.releaseFlashDuration;
          flashAlpha = Math.sin(p * Math.PI) * 0.95;
        }
      }

      // ── 4. Horizontal Anamorphic Streak (Resonance & Unfold) ──
      let flareAlpha = 0;
      let flareScaleX = 0;
      if (t >= resonance.start && t < resonance.end) {
        const p = (t - resonance.start) / (resonance.end - resonance.start);
        flareAlpha = Math.min(1.0, p * 1.5);
        flareScaleX = 0.2 + 0.8 * (1 - (1 - p) ** 2);
      } else if (t >= resonance.end && t < 1.5) {
        flareAlpha = 0.95;
        flareScaleX = 1.0;
      } else if (t >= 1.5 && t < 2.7) {
        // Owned by Canvas2D in Frame 3
        flareAlpha = 0;
        flareScaleX = 0;
      } else if (
        t >= unfold.end &&
        t < WELCOME_CONFIG.align.logoBloomStart + 0.3
      ) {
        const p = Math.min(1.0, (t - unfold.end) / 0.3);
        flareAlpha = Math.max(0, 0.95 * (1 - p));
        flareScaleX = 1.0 - p * 0.4;
      }

      // Fade core dot after ALIGN logo bloom
      if (t >= WELCOME_CONFIG.align.logoBloomStart) {
        const p = Math.min(
          1.0,
          (t - WELCOME_CONFIG.align.logoBloomStart) / 0.3
        );
        dotAlpha *= 1 - p;
        haloAlpha *= 1 - p;
      }

      // ── Element Styles ──
      if (coreDotRef.current) {
        coreDotRef.current.style.opacity = String(dotAlpha);
        coreDotRef.current.style.transform = `scale(${dotScale})`;
      }
      if (haloRef.current) {
        haloRef.current.style.opacity = String(haloAlpha);
      }
      if (releaseFlashRef.current) {
        releaseFlashRef.current.style.opacity = String(flashAlpha);
      }
      if (flareStreakRef.current) {
        flareStreakRef.current.style.opacity = String(flareAlpha);
        flareStreakRef.current.style.transform = `scaleX(${flareScaleX})`;
      }

      // Crosshairs
      const retractOffset = gap * (1.0 - chDraw);
      if (chTopRef.current) {
        chTopRef.current.style.opacity = String(chAlpha);
        chTopRef.current.style.transform = `scaleY(${chDraw}) translateY(${retractOffset}px)`;
      }
      if (chBottomRef.current) {
        chBottomRef.current.style.opacity = String(chAlpha);
        chBottomRef.current.style.transform = `scaleY(${chDraw}) translateY(${-retractOffset}px)`;
      }
      if (chLeftRef.current) {
        chLeftRef.current.style.opacity = String(chAlpha);
        chLeftRef.current.style.transform = `scaleX(${chDraw}) translateX(${retractOffset}px)`;
      }
      if (chRightRef.current) {
        chRightRef.current.style.opacity = String(chAlpha);
        chRightRef.current.style.transform = `scaleX(${chDraw}) translateX(${-retractOffset}px)`;
      }
    };

    return registerFrameCallback(onFrame);
  }, [reducedMotion, registerFrameCallback]);

  const h =
    contentHeight || (typeof window === "undefined" ? 800 : window.innerHeight);
  const chLen = Math.round(h * WELCOME_CONFIG.void.lengthRatio);
  const gap = Math.round(h * WELCOME_CONFIG.void.gapRatio);
  const flareRadius = Math.round(h * 0.06);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-25"
      ref={containerRef}
      style={{
        left: originX === undefined ? "50%" : originX,
        top: originY === undefined ? "50%" : originY,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* ── Soft Radial Halo (Radius ~0.06*H) ── */}
      <div
        className="absolute rounded-full pointer-events-none"
        ref={haloRef}
        style={{
          width: flareRadius * 2,
          height: flareRadius * 2,
          left: -flareRadius,
          top: -flareRadius,
          background:
            "radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(214, 230, 255, 0.5) 25%, rgba(59, 130, 246, 0.2) 55%, rgba(59, 130, 246, 0) 100%)",
          opacity: 0,
        }}
      />

      {/* ── Release White-Blue Flash (UNFOLD at 1.6s) ── */}
      <div
        className="absolute rounded-full pointer-events-none blur-sm"
        ref={releaseFlashRef}
        style={{
          width: 180,
          height: 180,
          left: -90,
          top: -90,
          background:
            "radial-gradient(circle, #FFFFFF 0%, rgba(214, 230, 255, 0.8) 35%, rgba(59, 130, 246, 0.3) 65%, rgba(59, 130, 246, 0) 100%)",
          opacity: 0,
        }}
      />

      {/* ── Core White Point (~4px) ── */}
      <div
        className="absolute rounded-full pointer-events-none shadow-[0_0_12px_#ffffff]"
        ref={coreDotRef}
        style={{
          width: 4,
          height: 4,
          left: -2,
          top: -2,
          backgroundColor: DESIGN_TOKENS.singularity.coreColor,
          opacity: 0,
        }}
      />

      {/* ── Anamorphic Horizontal Flare (Blue Left, Near-White Right) ── */}
      <div
        className="absolute pointer-events-none"
        ref={flareStreakRef}
        style={{
          width: 440,
          height: 2,
          left: -220,
          top: -1,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.75) 30%, #FFFFFF 50%, rgba(238,241,247,0.75) 70%, transparent 100%)",
          transformOrigin: "center center",
          opacity: 0,
        }}
      />

      {/* ── Crosshairs (Start 0.05*H away, extend 0.27*H, 25% white, fade both ends) ── */}
      <div
        className="absolute pointer-events-none"
        ref={chTopRef}
        style={{
          width: 1,
          height: chLen,
          left: 0,
          bottom: gap,
          background:
            "linear-gradient(to top, transparent 0%, rgba(255,255,255,0.25) 25%, rgba(255,255,255,0.25) 75%, transparent 100%)",
          transformOrigin: "bottom center",
          opacity: 0,
        }}
      />
      <div
        className="absolute pointer-events-none"
        ref={chBottomRef}
        style={{
          width: 1,
          height: chLen,
          left: 0,
          top: gap,
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.25) 25%, rgba(255,255,255,0.25) 75%, transparent 100%)",
          transformOrigin: "top center",
          opacity: 0,
        }}
      />
      <div
        className="absolute pointer-events-none"
        ref={chLeftRef}
        style={{
          width: chLen,
          height: 1,
          right: gap,
          top: 0,
          background:
            "linear-gradient(to left, transparent 0%, rgba(255,255,255,0.25) 25%, rgba(255,255,255,0.25) 75%, transparent 100%)",
          transformOrigin: "right center",
          opacity: 0,
        }}
      />
      <div
        className="absolute pointer-events-none"
        ref={chRightRef}
        style={{
          width: chLen,
          height: 1,
          left: gap,
          top: 0,
          background:
            "linear-gradient(to right, transparent 0%, rgba(255,255,255,0.25) 25%, rgba(255,255,255,0.25) 75%, transparent 100%)",
          transformOrigin: "left center",
          opacity: 0,
        }}
      />
    </div>
  );
}
