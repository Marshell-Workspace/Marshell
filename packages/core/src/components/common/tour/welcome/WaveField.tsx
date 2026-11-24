/**
 * WaveField.tsx — Canvas 2D Silk Ribbon Renderer for Marshell Cinematic Intro.
 *
 * Implements:
 * - High-DPI canvas (capped at DPR 2) with ResizeObserver.
 * - Dynamic ribbon origin (x0, y0) that glides with the logo during WELCOME (4.0s -> 4.9s).
 * - Vertical clipping above headline in final state (never passes behind "Welcome").
 * - Ambient 30fps throttling after welcome sequence completes.
 * - Adaptive performance degradation if frame times exceed 20ms for 30 frames.
 * - Zero React state updates per frame — completely driven via registerFrameCallback.
 */

"use client";

import { useEffect, useRef } from "react";
import type { FrameCallback } from "./useWelcomeTimeline";
import { renderSilkRibbons } from "./waveMath";
import { WELCOME_CONFIG } from "./welcome.config";

export interface WaveFieldProps {
  logoSize?: number;
  originX?: number;
  originY?: number;
  reducedMotion: boolean;
  registerFrameCallback: (cb: FrameCallback) => () => void;
  targetOriginY?: number;
  tier: "performance" | "balanced" | "eco";
}

export function WaveField({
  reducedMotion,
  registerFrameCallback,
  tier: initialTier,
  originX,
  originY,
  targetOriginY,
  logoSize = 150,
}: WaveFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeTierRef = useRef(initialTier);
  activeTierRef.current = initialTier;

  const slowFrameCountRef = useRef(0);
  const lastDrawTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") {
      return;
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      return;
    }

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.parentElement?.clientHeight || window.innerHeight;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // In reduced motion, draw a single static frame immediately
      if (reducedMotion) {
        const ox = originX ?? width / 2;
        const oy = targetOriginY ?? height * 0.26;
        const cutoffY = oy + logoSize * 0.8;
        renderSilkRibbons(
          ctx,
          width,
          height,
          ox,
          oy,
          WELCOME_CONFIG.welcome.totalDuration,
          cutoffY,
          "eco"
        );
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) {
      ro.observe(canvas.parentElement);
    }
    window.addEventListener("resize", resize);

    if (reducedMotion) {
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", resize);
      };
    }

    const onFrame = (t: number) => {
      if (width <= 0 || height <= 0) {
        return;
      }

      // Ambient 30fps throttle after ready (T >= 6.1s)
      const isAmbient = t >= WELCOME_CONFIG.welcome.totalDuration;
      const now = performance.now();
      if (isAmbient) {
        const interval = 1000 / WELCOME_CONFIG.ambient.fpsLimit; // ~33ms
        if (now - lastDrawTimeRef.current < interval) {
          return;
        }
      }

      const frameStart = performance.now();

      // Dynamic wave origin: starts at screen center, glides to upper position at 4.0s -> 4.9s
      const ox = originX ?? width / 2;
      const startOy = originY ?? height / 2;
      const finalOy = targetOriginY ?? height * 0.26;

      let currentOy = startOy;
      if (t >= WELCOME_CONFIG.welcome.logoGlideStart) {
        const glideProgress = Math.min(
          1.0,
          (t - WELCOME_CONFIG.welcome.logoGlideStart) /
            (WELCOME_CONFIG.welcome.logoGlideEnd -
              WELCOME_CONFIG.welcome.logoGlideStart)
        );
        // Smooth decelerating cubic ease
        const ease = 1 - (1 - glideProgress) ** 3;
        currentOy = startOy + (finalOy - startOy) * ease;
      }

      // Vertical cutoff in final state: nothing drawn below logo bottom + 0.3 L
      let verticalCutoffY: number | null = null;
      if (t >= WELCOME_CONFIG.welcome.start) {
        verticalCutoffY = currentOy + logoSize * 0.8;
      }

      ctx.clearRect(0, 0, width, height);

      renderSilkRibbons(
        ctx,
        width,
        height,
        ox,
        currentOy,
        t,
        verticalCutoffY,
        activeTierRef.current
      );

      const frameDuration = performance.now() - frameStart;
      lastDrawTimeRef.current = now;

      // Adaptive performance governor
      if (frameDuration > 20) {
        slowFrameCountRef.current++;
        if (slowFrameCountRef.current >= 30) {
          if (activeTierRef.current === "performance") {
            activeTierRef.current = "balanced";
          } else if (activeTierRef.current === "balanced") {
            activeTierRef.current = "eco";
          }
          slowFrameCountRef.current = 0;
        }
      } else {
        slowFrameCountRef.current = Math.max(0, slowFrameCountRef.current - 1);
      }
    };

    const unbind = registerFrameCallback(onFrame);

    return () => {
      unbind();
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [
    reducedMotion,
    registerFrameCallback,
    originX,
    originY,
    targetOriginY,
    logoSize,
  ]);

  return (
    <canvas
      className="absolute inset-0 pointer-events-none z-10"
      ref={canvasRef}
      style={{
        display: "block",
        contain: "strict",
      }}
    />
  );
}
