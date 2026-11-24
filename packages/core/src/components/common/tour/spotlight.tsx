"use client";

import { useResolvedTheme } from "@workspace/core/hooks/use-resolved-theme";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef } from "react";

interface SpotlightRect {
  height: number;
  left: number;
  radius: number;
  top: number;
  width: number;
}

interface SpotlightProps {
  /** Whether this is an action step */
  isActionStep: boolean;
  /** Whether to show the highlight ring (has anchor) */
  isVisible: boolean;
  /** Callback when user clicks outside the cutout */
  onOutsideClick?: () => void;
  /** Whether to dim the panel for panel-type tours */
  panelCutout?: {
    height: number;
    left: number;
    top: number;
    width: number;
  } | null;
  /** Whether reduced motion is active */
  reducedMotion?: boolean;
  /** Whether to pulse (kept for interface compatibility) */
  shouldPulse?: boolean;
  /** Target rect for the spotlight cutout (final, padded 6px) */
  targetRect: SpotlightRect | null;
  /** Tier for performance-gated effects */
  tier: "performance" | "balanced" | "eco";
  /** Tour accent CSS variable value e.g. "var(--primary)" */
  tourAccent?: string;
  /** Viewport dimensions */
  viewport: { height: number; width: number };
}

/**
 * Apple-style Spotlight:
 * - Rounded cutout matching target border radius
 * - Inside cutout not dimmed
 * - Morphs to new target in 280ms with cubic-bezier(0.22, 1, 0.36, 1), no overshoot/bounce
 * - Thin bright ring (~1.5px, white at ~85% opacity) and soft outer glow
 * - No HUD brackets, no scanline, no pulsing
 * - Zero flash/0,0 frames on initial target resolution
 */
export function Spotlight({
  targetRect,
  viewport,
  isVisible,
  isActionStep: _isActionStep,
  reducedMotion = false,
  panelCutout,
  onOutsideClick,
}: SpotlightProps) {
  const { width: vw, height: vh } = viewport;
  const prevTargetRef = useRef<string | null>(null);
  const resolvedTheme = useResolvedTheme();
  const isLight = resolvedTheme === "light";

  // ── Motion values for the cutout ────────────────────────────────────────
  const mLeft = useMotionValue(targetRect?.left ?? 0);
  const mTop = useMotionValue(targetRect?.top ?? 0);
  const mWidth = useMotionValue(targetRect?.width ?? 0);
  const mHeight = useMotionValue(targetRect?.height ?? 0);
  const mRadius = useMotionValue(targetRect?.radius ?? 10);

  const currentTargetKey = targetRect
    ? `${targetRect.left}:${targetRect.top}:${targetRect.width}:${targetRect.height}`
    : null;

  // Morph cutout and ring synchronously in 280ms with cubic-bezier(0.22, 1, 0.36, 1)
  useEffect(() => {
    if (!targetRect) {
      return;
    }

    if (prevTargetRef.current === null) {
      // First target: snap immediately without animation from wrong place or 0,0
      prevTargetRef.current = currentTargetKey;
      mLeft.set(targetRect.left);
      mTop.set(targetRect.top);
      mWidth.set(targetRect.width);
      mHeight.set(targetRect.height);
      mRadius.set(targetRect.radius);
      return;
    }

    if (currentTargetKey && currentTargetKey !== prevTargetRef.current) {
      prevTargetRef.current = currentTargetKey;

      if (reducedMotion) {
        mLeft.set(targetRect.left);
        mTop.set(targetRect.top);
        mWidth.set(targetRect.width);
        mHeight.set(targetRect.height);
        mRadius.set(targetRect.radius);
      } else {
        const transition = {
          duration: 0.28,
          ease: [0.22, 1, 0.36, 1] as const,
        };
        animate(mLeft, targetRect.left, transition);
        animate(mTop, targetRect.top, transition);
        animate(mWidth, targetRect.width, transition);
        animate(mHeight, targetRect.height, transition);
        animate(mRadius, targetRect.radius, transition);
      }
    }
  }, [
    targetRect,
    currentTargetKey,
    reducedMotion,
    mLeft,
    mTop,
    mWidth,
    mHeight,
    mRadius,
  ]);

  // ── SVG path derived from motion values (always in sync) ──────────────────
  const svgPath = useTransform(
    [mLeft, mTop, mWidth, mHeight, mRadius],
    ([l, t, w, h, r]: number[]) => {
      const L = l ?? 0,
        T = t ?? 0,
        W = w ?? 0,
        H = h ?? 0,
        R = Math.max(2, r ?? 8);
      const outer = `M 0 0 H ${vw} V ${vh} H 0 Z`;
      if (!isVisible) {
        return outer;
      }
      // Counter-clockwise rounded rect = hole with evenodd fill
      const hole =
        `M ${L + R} ${T} ` +
        `H ${L + W - R} Q ${L + W} ${T} ${L + W} ${T + R} ` +
        `V ${T + H - R} Q ${L + W} ${T + H} ${L + W - R} ${T + H} ` +
        `H ${L + R} Q ${L} ${T + H} ${L} ${T + H - R} ` +
        `V ${T + R} Q ${L} ${T} ${L + R} ${T} Z`;
      return `${outer} ${hole}`;
    }
  );

  // ── Ring path matching the target border radius ───────────────────────────
  const ringPath = useTransform(
    [mLeft, mTop, mWidth, mHeight, mRadius],
    ([l, t, w, h, r]: number[]) => {
      const L = l ?? 0,
        T = t ?? 0,
        W = w ?? 0,
        H = h ?? 0,
        R = Math.max(2, r ?? 8);
      return (
        `M ${L + R} ${T} ` +
        `H ${L + W - R} Q ${L + W} ${T} ${L + W} ${T + R} ` +
        `V ${T + H - R} Q ${L + W} ${T + H} ${L + W - R} ${T + H} ` +
        `H ${L + R} Q ${L} ${T + H} ${L} ${T + H - R} ` +
        `V ${T + R} Q ${L} ${T} ${L + R} ${T} Z`
      );
    }
  );

  // ── Click-catcher hole: derived from motion values so it morphs synchronously ──
  // The hole is applied on ALL steps (action and info) so the highlighted target
  // is fully usable, hoverable, focusable, and clickable at all times.
  const clipPathValue = useTransform(
    [mLeft, mTop, mWidth, mHeight],
    ([l, t, w, h]: number[]) => {
      const L = l ?? 0;
      const T = t ?? 0;
      const W = w ?? 0;
      const H = h ?? 0;
      if (!isVisible || W <= 0 || H <= 0) {
        return;
      }
      return `polygon(0% 0%, 0% 100%, ${L}px 100%, ${L}px ${T}px, ${L + W}px ${T}px, ${L + W}px ${T + H}px, ${L}px ${T + H}px, ${L}px 100%, 100% 100%, 100% 0%)`;
    }
  );

  // KEEP 2: When there is no targetRect, do not render dim mask or click-catcher
  if (!targetRect) {
    return null;
  }

  return (
    <>
      {/* ── Dim overlay (SVG evenodd cutout, no blur) ───────────────────── */}
      <motion.svg
        className="fixed inset-0 size-full pointer-events-none"
        data-tour-element="spotlight"
        height={vh}
        style={{ zIndex: 9990 }}
        width={vw}
      >
        {/* Main dim with optional panel secondary cutout */}
        <motion.path d={svgPath} fill="var(--tour-dim)" fillRule="evenodd" />
        {/* Optional panel un-dim cutout */}
        {panelCutout && (
          <rect
            fill="transparent"
            height={panelCutout.height}
            width={panelCutout.width}
            x={panelCutout.left}
            y={panelCutout.top}
          />
        )}
      </motion.svg>

      {/* ── Click-catcher: blocks clicks through dim area with cutout hole on ALL steps ── */}
      <motion.div
        className="fixed inset-0 size-full pointer-events-auto"
        data-tour-element="click-catcher"
        onClick={onOutsideClick}
        style={{ zIndex: 9991, clipPath: clipPathValue }}
      />

      {/* ── Highlight ring: thin bright ring (1.5px, ~85% white) + soft outer glow on dark; crisp near-black ring + dark soft shadow on light ── */}
      {isVisible && targetRect && (
        <motion.svg
          className="fixed inset-0 size-full pointer-events-none"
          data-tour-element="highlight-ring"
          height={vh}
          style={{ zIndex: 9992 }}
          width={vw}
        >
          <defs>
            <filter
              height="140%"
              id="tour-hero-soft-glow"
              width="140%"
              x="-20%"
              y="-20%"
            >
              <feGaussianBlur
                in="SourceGraphic"
                result="blur"
                stdDeviation="3.5"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter
              height="200%"
              id="tour-hero-light-shadow"
              width="200%"
              x="-50%"
              y="-50%"
            >
              <feDropShadow
                dx="0"
                dy="8"
                floodColor="rgba(15, 23, 42, 0.22)"
                stdDeviation="14"
              />
            </filter>
          </defs>
          {isLight ? (
            <>
              {/* Outer soft shadow (0 8px 28px rgba(15,23,42,0.22)) */}
              <motion.path
                d={ringPath}
                fill="none"
                stroke="rgba(15, 23, 42, 0.75)"
                strokeWidth={1.5}
                style={{ filter: "url(#tour-hero-light-shadow)" }}
              />
              {/* 4px spread halo (0 0 0 4px rgba(15,23,42,0.08)) */}
              <motion.path
                d={ringPath}
                fill="none"
                stroke="rgba(15, 23, 42, 0.08)"
                strokeWidth={9.5}
              />
              {/* Crisp ring in near-black (rgba(15,23,42,0.75), 1.5px) */}
              <motion.path
                d={ringPath}
                fill="none"
                stroke="rgba(15, 23, 42, 0.75)"
                strokeWidth={1.5}
              />
            </>
          ) : (
            <>
              {/* Soft outer glow */}
              <motion.path
                d={ringPath}
                fill="none"
                stroke="rgba(255, 255, 255, 0.40)"
                strokeWidth={3.5}
                style={{ filter: "url(#tour-hero-soft-glow)" }}
              />
              {/* Thin bright ring (1.5px, white at ~85% opacity) */}
              <motion.path
                d={ringPath}
                fill="none"
                stroke="rgba(255, 255, 255, 0.85)"
                strokeWidth={1.5}
              />
            </>
          )}
        </motion.svg>
      )}
    </>
  );
}
