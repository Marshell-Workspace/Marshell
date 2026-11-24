/**
 * HandwrittenGreeting.tsx — Cursive "Welcome" Ink Reveal with Real Script Fonts (Revision 4).
 *
 * Implements Greeting v3 Method 1 (Imperative & Zero React Re-Renders):
 * - Real script font rendered as SVG <text> (Sacramento build-time self-hosted via next/font).
 * - SVG <mask id="greeting-ink-mask"> uncovers glyphs progressively in handwritten order (W -> e -> l -> c -> o -> m -> e).
 * - 32px round-capped coverage strokes fully cover font stems.
 * - 200ms safety full-rect fade at end of sequence guarantees 100% pixel reveal.
 * - Static pre-blurred accent glow layer behind (zero filter repaints during stroke animation).
 * - Zero-allocation precomputed pen-light tracker updated via direct DOM attribute manipulation (no React setState in rAF).
 * - Shift+G dev coverage overlay draws strokes over font glyphs.
 */

"use client";

import { type RefObject, useId } from "react";
import {
  GREETING_VIEWBOX,
  type LetterStroke,
  SACRAMENTO_COVERAGE_STROKES,
  SCRIPT_FONT_DEFINITIONS,
} from "./greeting-paths";
import {
  ACTIVE_SCRIPT_FONT,
  GREETING_WEIGHT_BOOST,
  type ScriptFontKey,
} from "./welcome.config";

export interface HandwrittenGreetingProps {
  fontClassName?: string;
  inkMaskRef?: RefObject<SVGGElement | null>;
  isReady: boolean;
  isReplay?: boolean;
  maskRectRef?: RefObject<SVGRectElement | null>;
  penDotGRef?: RefObject<SVGGElement | null>;
  penDotInnerRef?: RefObject<SVGCircleElement | null>;
  penDotOuterRef?: RefObject<SVGCircleElement | null>;
  reducedMotion: boolean;
  scriptFont?: ScriptFontKey;
  showCoverageOverlay?: boolean;
  staticGlowRef?: RefObject<SVGTextElement | null>;
  strokes?: readonly LetterStroke[];
  strokesRef?: (el: SVGPathElement | null, idx: number) => void;
  text?: string;
  tier: "performance" | "balanced" | "eco";
}

export function HandwrittenGreeting({
  isReady,
  reducedMotion,
  scriptFont = ACTIVE_SCRIPT_FONT,
  fontClassName,
  text = "Welcome",
  strokes = SACRAMENTO_COVERAGE_STROKES,
  showCoverageOverlay = false,
  inkMaskRef,
  maskRectRef,
  staticGlowRef,
  strokesRef,
  penDotGRef,
  penDotOuterRef,
  penDotInnerRef,
}: HandwrittenGreetingProps) {
  const maskId = useId();

  const fontDef = (SCRIPT_FONT_DEFINITIONS[scriptFont] ??
    SCRIPT_FONT_DEFINITIONS.sacramento)!;

  // Reduced motion / isReady: static text
  if (reducedMotion || isReady) {
    return (
      <div className="relative flex items-center justify-center w-full max-w-[340px] sm:max-w-[400px] md:max-w-[440px]">
        <svg
          aria-hidden="true"
          className="w-full h-auto overflow-visible select-none pointer-events-none"
          viewBox={GREETING_VIEWBOX}
        >
          {/* Static Soft Accent Glow */}
          <text
            className={fontClassName ?? fontDef.className}
            fontSize={fontDef.fontSize}
            opacity={0.35}
            style={{
              fontFamily: fontDef.fontFamily,
              fill: "var(--tour-accent)",
              filter: "blur(8px)",
            }}
            textAnchor={fontDef.textAnchor}
            x={fontDef.x}
            y={fontDef.y}
          >
            {text}
          </text>

          {/* Crisp Script Text */}
          <text
            className={fontClassName ?? fontDef.className}
            fontSize={fontDef.fontSize}
            stroke="rgba(255, 255, 255, 0.96)"
            strokeLinejoin="round"
            strokeWidth={GREETING_WEIGHT_BOOST}
            style={{
              fontFamily: fontDef.fontFamily,
              fill: "rgba(255, 255, 255, 0.96)",
            }}
            textAnchor={fontDef.textAnchor}
            x={fontDef.x}
            y={fontDef.y}
          >
            {text}
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center w-full max-w-[340px] sm:max-w-[400px] md:max-w-[440px]">
      <svg
        aria-hidden="true"
        className="w-full h-auto overflow-visible select-none pointer-events-none"
        viewBox={GREETING_VIEWBOX}
      >
        <defs>
          {/* ── Method 1: SVG Mask with Centerline Coverage Strokes ────────── */}
          <mask id={`greeting-mask-${maskId}`}>
            <rect fill="black" height="160" width="600" x="0" y="0" />

            <g
              fill="none"
              ref={inkMaskRef}
              stroke="white"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={34}
              style={{
                opacity: 0,
              }}
            >
              {strokes.map((stroke, index) => (
                <path
                  d={stroke.d}
                  key={stroke.id}
                  ref={(el) => strokesRef?.(el, index)}
                  style={{
                    strokeDasharray: stroke.estimatedLength,
                    strokeDashoffset: stroke.estimatedLength,
                  }}
                />
              ))}
            </g>

            {/* Safety Full-Rect Fade over 200ms at end of reveal */}
            <rect
              fill="white"
              height="160"
              ref={maskRectRef}
              style={{ opacity: 0 }}
              width="600"
              x="0"
              y="0"
            />
          </mask>
        </defs>

        {/* ── 1. Static Pre-Blurred Accent Glow Layer ──────────────────────── */}
        <text
          className={fontClassName ?? fontDef.className}
          fontSize={fontDef.fontSize}
          ref={staticGlowRef}
          style={{
            fontFamily: fontDef.fontFamily,
            fill: "var(--tour-accent)",
            filter: "blur(8px)",
            opacity: 0,
          }}
          textAnchor={fontDef.textAnchor}
          x={fontDef.x}
          y={fontDef.y}
        >
          {text}
        </text>

        {/* ── 2. Script Text Revealed via Mask ────────────────────────────── */}
        <g mask={`url(#greeting-mask-${maskId})`}>
          <text
            className={fontClassName ?? fontDef.className}
            fontSize={fontDef.fontSize}
            stroke="rgba(255, 255, 255, 0.96)"
            strokeLinejoin="round"
            strokeWidth={GREETING_WEIGHT_BOOST}
            style={{
              fontFamily: fontDef.fontFamily,
              fill: "rgba(255, 255, 255, 0.96)",
            }}
            textAnchor={fontDef.textAnchor}
            x={fontDef.x}
            y={fontDef.y}
          >
            {text}
          </text>
        </g>

        {/* ── 3. Imperative Pen-Light Dot ─────────────────────────────────── */}
        <g ref={penDotGRef} style={{ display: "none" }}>
          <circle
            cx={0}
            cy={0}
            fill="var(--tour-accent)"
            opacity={0.65}
            r={9}
            ref={penDotOuterRef}
          />
          <circle
            cx={0}
            cy={0}
            fill="#ffffff"
            opacity={0.95}
            r={3}
            ref={penDotInnerRef}
          />
        </g>

        {/* ── 4. Dev Coverage Overlay (Shift+G) ───────────────────────────── */}
        {showCoverageOverlay && (
          <g
            fill="none"
            opacity={0.45}
            stroke="#06b6d4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={34}
          >
            {strokes.map((stroke) => (
              <path d={stroke.d} key={`debug-${stroke.id}`} />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
