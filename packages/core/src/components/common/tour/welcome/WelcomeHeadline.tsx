/**
 * WelcomeHeadline.tsx — Script "Welcome" Write-On & Staggered "MARSHELL" Wordmark.
 *
 * Implements:
 * 1. "Welcome" Script Write-On (4.40s -> 5.80s):
 *    - Strictly "Welcome" — no name, no comma, no extra words.
 *    - Self-hosted OFL Great Vibes (with Sacramento fallback).
 *    - Generous viewBox padding (>0.15em on all sides, swash and tail unclipped).
 *    - Slanted feathered write-on mask driven by ease-in-out curve.
 *    - Near-white glowing pen nib riding reveal front.
 *    - 90px near-white comet tail trailing behind nib, fading out 0.3s after write completes.
 * 2. "MARSHELL" Display Letters (5.30s -> 5.80s):
 *    - Width ~2.35 L, cap height ~0.13 L, tracking 0.7em, semibold, 92% white.
 *    - 8 individual letters, rising +8px -> 0px with 40ms stagger.
 * 3. Accessibility:
 *    - Semantic <h1> "Welcome to Marshell" for screen readers.
 * Zero React state updates per frame — driven directly via registerFrameCallback.
 */

"use client";

import { useEffect, useId, useRef } from "react";
import type { FrameCallback } from "./useWelcomeTimeline";
import {
  DESIGN_TOKENS,
  FINAL_LAYOUT,
  WELCOME_CONFIG,
  WELCOME_STRINGS,
} from "./welcome.config";

export interface WelcomeHeadlineProps {
  greetingText?: string;
  logoSize?: number;
  part?: "welcome" | "marshell" | "all";
  reducedMotion: boolean;
  registerFrameCallback: (cb: FrameCallback) => () => void;
  tier: "performance" | "balanced" | "eco";
}

const LETTERS = WELCOME_STRINGS.appName.split(""); // ['M','A','R','S','H','E','L','L']

export function WelcomeHeadline({
  reducedMotion,
  registerFrameCallback,
  tier: _tier,
  logoSize = 150,
  greetingText: _greetingText,
  part = "all",
}: WelcomeHeadlineProps) {
  const maskId = useId();
  const maskRectRef = useRef<SVGRectElement>(null);
  const penNibRef = useRef<SVGGElement>(null);
  const penTailRef = useRef<SVGPathElement>(null);
  const motionPathRef = useRef<SVGPathElement>(null);
  const welcomeContainerRef = useRef<HTMLDivElement>(null);
  const welcomeGlowTextRef = useRef<SVGTextElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Precomputed maximum X progression table along motion path
  const pathLengthRef = useRef(0);
  const samplesRef = useRef<
    { s: number; x: number; y: number; maxX: number }[]
  >([]);

  useEffect(() => {
    if (part === "marshell") {
      return;
    }

    const path = motionPathRef.current;
    if (!path) {
      return;
    }

    try {
      const len = path.getTotalLength();
      pathLengthRef.current = len;

      const sampleCount = 200;
      const samples: { s: number; x: number; y: number; maxX: number }[] = [];
      let runningMaxX = 0;

      for (let i = 0; i <= sampleCount; i++) {
        const s = i / sampleCount;
        const pt = path.getPointAtLength(s * len);
        runningMaxX = Math.max(runningMaxX, pt.x);
        samples.push({ s, x: pt.x, y: pt.y, maxX: runningMaxX });
      }
      samplesRef.current = samples;
    } catch {
      pathLengthRef.current = 500;
    }
  }, [part]);

  useEffect(() => {
    if (reducedMotion) {
      if (maskRectRef.current) {
        maskRectRef.current.setAttribute("width", "640");
      }
      if (penNibRef.current) {
        penNibRef.current.style.display = "none";
      }
      for (const el of letterRefs.current) {
        if (el) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0px)";
        }
      }
      return;
    }

    const { welcome } = WELCOME_CONFIG;

    const onFrame = (t: number) => {
      // ── 1. Cursive "Welcome" Write-On (4.40s -> 5.80s) ──
      if (part !== "marshell") {
        const maskRect = maskRectRef.current;
        const penNib = penNibRef.current;
        const penTail = penTailRef.current;

        if (welcomeContainerRef.current) {
          welcomeContainerRef.current.style.opacity =
            t < welcome.scriptWriteStart ? "0" : "1";
        }
        if (welcomeGlowTextRef.current) {
          welcomeGlowTextRef.current.style.opacity =
            t < welcome.scriptWriteStart ? "0" : "0.32";
        }

        if (t < welcome.scriptWriteStart) {
          if (maskRect) {
            maskRect.setAttribute("width", "0");
          }
          if (penNib) {
            penNib.style.opacity = "0";
          }
        } else if (t < welcome.scriptWriteEnd) {
          const rawProgress =
            (t - welcome.scriptWriteStart) /
            (welcome.scriptWriteEnd - welcome.scriptWriteStart);
          // Smooth ease-in-out flow curve
          const p =
            rawProgress < 0.5
              ? 2 * rawProgress * rawProgress
              : 1 - (-2 * rawProgress + 2) ** 2 / 2;

          const samples = samplesRef.current;
          let nibX = 100 + p * 400;
          let nibY = 95;
          let revealX = nibX;

          if (samples.length > 0) {
            const sampleIdx = Math.min(
              samples.length - 1,
              Math.max(0, Math.floor(p * (samples.length - 1)))
            );
            const s = samples[sampleIdx]!;
            nibX = s.x;
            nibY = s.y;
            revealX = s.maxX + 12; // reveal slightly ahead of nib
          }

          if (maskRect) {
            maskRect.setAttribute("width", String(Math.max(0, revealX)));
          }

          if (penNib) {
            penNib.style.opacity = "1";
            penNib.setAttribute(
              "transform",
              `translate(${nibX.toFixed(1)}, ${nibY.toFixed(1)})`
            );
          }

          // 90px amber comet tail trailing behind nib
          if (penTail) {
            const tailLen = WELCOME_CONFIG.welcome.cometTailLength;
            penTail.setAttribute(
              "d",
              `M ${nibX} ${nibY} Q ${nibX - tailLen * 0.45} ${nibY + 4} ${nibX - tailLen} ${nibY} Q ${nibX - tailLen * 0.45} ${nibY - 4} ${nibX} ${nibY} Z`
            );
            penTail.style.opacity = "0.75";
          }
        } else {
          // Complete reveal
          if (maskRect) {
            maskRect.setAttribute("width", "640");
          }

          // Pen nib fades out 0.3s after write completes (5.8s -> 6.1s)
          const postTime = t - welcome.scriptWriteEnd;
          const penAlpha = Math.max(0, 1.0 - postTime / 0.3);
          if (penNib) {
            penNib.style.opacity = String(penAlpha);
          }
          if (penTail) {
            penTail.style.opacity = String(penAlpha * 0.75);
          }
        }
      }

      // ── 2. "MARSHELL" Letters Staggered Rise (5.30s -> 5.80s) ──
      if (part !== "welcome") {
        for (let i = 0; i < LETTERS.length; i++) {
          const el = letterRefs.current[i];
          if (!el) {
            continue;
          }

          const letterStartTime =
            welcome.wordmarkStart + i * welcome.wordmarkLetterStagger;

          if (t < letterStartTime) {
            el.style.opacity = "0";
            el.style.transform = "translateY(8px)";
          } else {
            const letterTime = t - letterStartTime;
            const letterProgress = Math.min(1.0, letterTime / 0.26);
            // Decelerating ease-out
            const ease = 1 - (1 - letterProgress) ** 3;
            el.style.opacity = String(ease);
            el.style.transform = `translateY(${(1 - ease) * 8}px)`;
          }
        }
      }
    };

    return registerFrameCallback(onFrame);
  }, [reducedMotion, registerFrameCallback, part]);

  const L = logoSize;
  const scriptWidth = Math.max(
    Math.round(L * 1.7),
    Math.round(L * FINAL_LAYOUT.welcomeWidthRatio)
  );
  const scriptHeight = Math.round(L * FINAL_LAYOUT.welcomeCapHeightRatio * 1.6);
  const marshellWidth = Math.round(L * FINAL_LAYOUT.marshellWidthRatio);
  const marshellFontSize = Math.max(
    14,
    Math.round(L * FINAL_LAYOUT.marshellCapHeightRatio * 1.35)
  );

  const showWelcome = part === "all" || part === "welcome";
  const showMarshell = part === "all" || part === "marshell";

  return (
    <div className="relative flex flex-col items-center justify-center select-none w-full">
      {/* Screen Reader Semantic Accessible Heading */}
      {showWelcome && (
        <h1 className="sr-only">
          {WELCOME_STRINGS.headline} to {WELCOME_STRINGS.appName}
        </h1>
      )}

      {/* Script "Welcome" SVG (Width ~2.05 L, Cap height ~0.5 L) */}
      {showWelcome && (
        <div
          aria-hidden="true"
          className="flex items-center justify-center overflow-visible"
          ref={welcomeContainerRef}
          style={{
            width: scriptWidth,
            height: scriptHeight,
            maxWidth: "92vw",
            opacity: reducedMotion ? 1 : 0,
          }}
        >
          <svg
            className="w-full h-full overflow-visible pointer-events-none"
            viewBox="0 0 600 160"
          >
            <defs>
              <mask id={maskId}>
                <rect fill="#000000" height="160" width="600" x="0" y="0" />
                <rect
                  fill="#FFFFFF"
                  height="160"
                  ref={maskRectRef}
                  width={reducedMotion ? "640" : "0"}
                  x="0"
                  y="0"
                />
              </mask>

              <linearGradient id="comet-tail-grad" x1="1" x2="0" y1="0" y2="0">
                <stop offset="0%" stopColor="#F4F6FA" stopOpacity="0.85" />
                <stop offset="35%" stopColor="#EEF1F7" stopOpacity="0.65" />
                <stop offset="80%" stopColor="#DDE3EE" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#5C6475" stopOpacity="0" />
              </linearGradient>

              <filter
                height="200%"
                id="pen-glow"
                width="200%"
                x="-50%"
                y="-50%"
              >
                <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" />
              </filter>
            </defs>

            <path
              d="M 120 95 C 135 45, 155 40, 168 70 C 180 110, 195 115, 210 60 C 220 105, 240 110, 260 90 C 275 75, 295 75, 310 95 C 325 110, 340 45, 355 40 C 370 45, 370 110, 390 95 C 405 75, 425 85, 440 95 C 455 105, 470 75, 490 85 C 500 95, 510 105, 520 92"
              fill="none"
              ref={motionPathRef}
              stroke="transparent"
            />

            <text
              className="font-script-great-vibes"
              fontSize="108"
              opacity={reducedMotion ? "0.32" : "0"}
              ref={welcomeGlowTextRef}
              style={{
                fontFamily:
                  "'Great Vibes', var(--font-script-loaded, 'Sacramento'), cursive",
                fill: DESIGN_TOKENS.amber.core2,
                filter: "blur(10px)",
              }}
              textAnchor="middle"
              x="300"
              y="112"
            >
              {WELCOME_STRINGS.headline}
            </text>

            <text
              className="font-script-great-vibes"
              fontSize="108"
              mask={`url(#${maskId})`}
              style={{
                fontFamily:
                  "'Great Vibes', var(--font-script-loaded, 'Sacramento'), cursive",
                fill: "rgba(255, 255, 255, 0.95)",
              }}
              textAnchor="middle"
              x="300"
              y="112"
            >
              {WELCOME_STRINGS.headline}
            </text>

            <path fill="url(#comet-tail-grad)" opacity="0" ref={penTailRef} />

            <g opacity="0" ref={penNibRef}>
              <circle
                cx="0"
                cy="0"
                fill={DESIGN_TOKENS.amber.highlight}
                filter="url(#pen-glow)"
                r="15"
              />
              <circle cx="0" cy="0" fill="#FFFFFF" r="3.5" />
            </g>
          </svg>
        </div>
      )}

      {/* "M A R S H E L L" Display Letters (Width ~2.3 L, Tracking 0.75em, Weight 400-500, White 90%) */}
      {showMarshell && (
        <div
          aria-hidden="true"
          className="flex items-center justify-center font-display select-none"
          style={{
            width: marshellWidth,
            maxWidth: "92vw",
            fontSize: marshellFontSize,
            fontWeight: 500,
            letterSpacing: FINAL_LAYOUT.marshellTracking,
            paddingLeft: FINAL_LAYOUT.marshellTracking,
            color: "rgba(255, 255, 255, 0.82)",
          }}
        >
          {LETTERS.map((char, idx) => (
            <span
              className="inline-block"
              key={`${char}-${idx}`}
              ref={(el) => {
                letterRefs.current[idx] = el;
              }}
              style={{
                opacity: reducedMotion ? 1 : 0,
                transform: reducedMotion
                  ? "translateY(0px)"
                  : "translateY(8px)",
                willChange: "transform, opacity",
              }}
            >
              {char}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
