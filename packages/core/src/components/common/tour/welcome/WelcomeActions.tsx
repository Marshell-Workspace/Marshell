/**
 * WelcomeActions.tsx — Primary Amber CTA, Skip Link & Unwrapped Footer.
 *
 * Implements:
 * 1. Primary Button ("Start the tour"):
 *    - Width ~2.3 L at most (240 to 280px at 1080p, minimum 200px), height 54px (about 0.26 L), fully rounded.
 *    - Surface: near-white #F4F6FA, 1px inner top highlight (rgba(255,255,255,0.35)),
 *      1px darker inner bottom edge (inset 0 -1px 0 rgba(0,0,0,0.20)).
 *    - Text: app sans font, 16px, weight 600, color #10131A.
 *    - Crisp inline SVG arrow (16px, stroke 2) after label with 8px gap.
 *    - Shadow: 0 8px 24px rgba(235,240,250,0.25) + 0 2px 6px rgba(0,0,0,0.40).
 *    - States: hover translateY(-1px), brightness 1.04, arrow +3px (160ms); press scale 0.985 (80ms);
 *      focus-visible 2px ring in #EEF1F7 with 3px offset.
 *    - Touch of delight: single soft diagonal sheen sweep once (700ms) right after entrance.
 * 2. Secondary Link ("Skip for now"):
 *    - 14px, weight 500, rgba(255,255,255,0.70), no underline at rest; hover 0.95 white + 1px underline with 3px offset (120ms).
 *    - Minimum hit area 40px tall. Focus-visible ring white at 60%.
 * 3. Explanatory Footer:
 *    - 12.5px, weight 400, rgba(255,255,255,0.52), line-height 1.4, strictly one line on desktop.
 *    - Contrast >= 4.5:1.
 * 4. Staggered Entrance (5.60s -> 6.23s):
 *    - Button (5.60 -> 6.05s), Skip (5.69 -> 6.14s), Footer (5.78 -> 6.23s).
 *    - 450ms, cubic-bezier(0.2, 0.8, 0.2, 1), translateY 12px -> 0px, opacity 0 -> 1.
 */

"use client";

import { useEffect, useRef } from "react";
import type { FrameCallback } from "./useWelcomeTimeline";
import { WELCOME_CONFIG, WELCOME_STRINGS } from "./welcome.config";

export interface WelcomeActionsProps {
  contentHeight?: number;
  logoSize?: number;
  onSkip?: () => void;
  onStart?: () => void;
  part?: "button" | "skip" | "footer" | "all";
  reducedMotion: boolean;
  registerFrameCallback: (cb: FrameCallback) => () => void;
  tier: "performance" | "balanced" | "eco";
}

// Exact cubic-bezier(0.2, 0.8, 0.2, 1) evaluator
function cubicBezier0208(p: number): number {
  const t = Math.max(0, Math.min(1, p));
  let u = t;
  for (let i = 0; i < 4; i++) {
    const x =
      3 * (1 - u) * (1 - u) * u * 0.2 + 3 * (1 - u) * u * u * 0.2 + u * u * u;
    const dx =
      3 * (1 - u) * (1 - u) * 0.2 + 6 * (1 - u) * u * 0.0 + 3 * u * u * 0.8;
    const diff = x - t;
    if (Math.abs(diff) < 1e-4) {
      break;
    }
    u -= diff / (dx || 1);
  }
  u = Math.max(0, Math.min(1, u));
  return (
    3 * (1 - u) * (1 - u) * u * 0.8 + 3 * (1 - u) * u * u * 1.0 + u * u * u
  );
}

export function WelcomeActions({
  reducedMotion,
  registerFrameCallback,
  tier: _tier,
  onStart,
  onSkip,
  logoSize = 180,
  contentHeight: _contentHeight,
  part = "all",
}: WelcomeActionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonWrapperRef = useRef<HTMLDivElement>(null);
  const skipWrapperRef = useRef<HTMLDivElement>(null);
  const footerWrapperRef = useRef<HTMLParagraphElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) {
      if (containerRef.current) {
        containerRef.current.style.pointerEvents = "auto";
      }
      for (const el of [
        buttonWrapperRef.current,
        skipWrapperRef.current,
        footerWrapperRef.current,
      ]) {
        if (el) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0px)";
        }
      }
      if (sheenRef.current) {
        sheenRef.current.style.opacity = "0";
      }
      return;
    }

    const { welcome } = WELCOME_CONFIG;
    const animDuration = 0.45; // 450ms
    const stagger = 0.09; // 90ms apart

    const onFrame = (t: number) => {
      const container = containerRef.current;
      const btn = buttonWrapperRef.current;
      const skip = skipWrapperRef.current;
      const foot = footerWrapperRef.current;
      const sheen = sheenRef.current;

      const btnStart = welcome.actionsStart; // 5.60s
      const skipStart = btnStart + stagger; // 5.69s
      const footStart = btnStart + stagger * 2; // 5.78s
      const btnEnd = btnStart + animDuration; // 6.05s

      // Interactivity gate: buttons stay non-clickable until they appear
      if (container) {
        container.style.pointerEvents = t >= btnEnd ? "auto" : "none";
      }

      // Element 1: Primary CTA Button (5.60s -> 6.05s)
      if (btn && (part === "all" || part === "button")) {
        if (t < btnStart) {
          btn.style.opacity = "0";
          btn.style.transform = "translateY(12px)";
        } else {
          const pBtn = Math.min(1.0, (t - btnStart) / animDuration);
          const ease = cubicBezier0208(pBtn);
          btn.style.opacity = String(ease);
          btn.style.transform = `translateY(${(1 - ease) * 12}px)`;
        }
      }

      // Element 2: Secondary Skip Link (5.69s -> 6.14s)
      if (skip && (part === "all" || part === "skip")) {
        if (t < skipStart) {
          skip.style.opacity = "0";
          skip.style.transform = "translateY(12px)";
        } else {
          const pSkip = Math.min(1.0, (t - skipStart) / animDuration);
          const ease = cubicBezier0208(pSkip);
          skip.style.opacity = String(ease);
          skip.style.transform = `translateY(${(1 - ease) * 12}px)`;
        }
      }

      // Element 3: Footer Text (5.78s -> 6.23s)
      if (foot && (part === "all" || part === "footer")) {
        if (t < footStart) {
          foot.style.opacity = "0";
          foot.style.transform = "translateY(12px)";
        } else {
          const pFoot = Math.min(1.0, (t - footStart) / animDuration);
          const ease = cubicBezier0208(pFoot);
          foot.style.opacity = String(ease);
          foot.style.transform = `translateY(${(1 - ease) * 12}px)`;
        }
      }

      // Touch of delight: single soft diagonal sheen across button once (700ms: 6.05s -> 6.75s)
      if (sheen) {
        const sheenStart = btnEnd; // 6.05s
        const sheenDuration = 0.7; // 700ms
        if (t >= sheenStart && t < sheenStart + sheenDuration) {
          const pSheen = (t - sheenStart) / sheenDuration;
          const sheenX = -120 + pSheen * 320; // percent
          const sheenAlpha = Math.sin(pSheen * Math.PI) * 0.28;
          sheen.style.transform = `translateX(${sheenX}%) skewX(-20deg)`;
          sheen.style.opacity = String(sheenAlpha);
        } else {
          sheen.style.opacity = "0";
        }
      }
    };

    return registerFrameCallback(onFrame);
  }, [reducedMotion, registerFrameCallback, part]);

  const L = logoSize;
  // Button width: 240 to 280px at 1080p, minimum 200px, maximum 280px
  const btnWidth = Math.min(280, Math.max(200, Math.round(L * 1.25)));
  const btnHeight = 54; // 52 to 56px (about 0.26 L)

  const showButton = part === "all" || part === "button";
  const showSkip = part === "all" || part === "skip";
  const showFooter = part === "all" || part === "footer";

  const buttonLabel = WELCOME_STRINGS.ctaStart.replace("→", "").trim();

  return (
    <div
      className="flex flex-col items-center justify-center select-none"
      ref={containerRef}
      style={{
        pointerEvents: reducedMotion ? "auto" : "none",
      }}
    >
      {/* Primary CTA Button ("Start the tour" + inline SVG arrow) */}
      {showButton && (
        <div
          className="relative flex justify-center"
          ref={buttonWrapperRef}
          style={{
            width: btnWidth,
            height: btnHeight,
            opacity: reducedMotion ? 1 : 0,
            transform: reducedMotion ? "translateY(0px)" : "translateY(12px)",
          }}
        >
          <button
            aria-label={WELCOME_STRINGS.ctaStart}
            className="group relative size-full rounded-full flex items-center justify-center gap-2 font-sans font-semibold text-[16px] text-[#10131A] cursor-pointer select-none overflow-hidden transition-[transform,filter] motion-fast ease-out hover:-translate-y-[1px] hover:brightness-[1.04] active:translate-y-0 active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EEF1F7] focus-visible:ring-offset-[3px] focus-visible:ring-offset-[#05070D]"
            data-tour-action="welcome-start"
            onClick={(e) => {
              e.stopPropagation();
              onStart?.();
            }}
            style={{
              background: "#F4F6FA",
              boxShadow:
                "inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 -1px 0 rgba(0, 0, 0, 0.20), 0 8px 24px rgba(235, 240, 250, 0.25), 0 2px 6px rgba(0, 0, 0, 0.40)",
            }}
            type="button"
          >
            <span>{buttonLabel}</span>
            <svg
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform motion-fast ease-out group-hover:translate-x-[3px]"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 16 16"
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>

            {/* Single soft diagonal sheen sweep (once, right after entrance) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full overflow-hidden"
            >
              <div
                className="absolute -inset-y-2 w-1/2 bg-gradient-to-r from-transparent via-white/28 to-transparent pointer-events-none"
                ref={sheenRef}
                style={{
                  transform: "translateX(-150%) skewX(-20deg)",
                  opacity: 0,
                }}
              />
            </div>
          </button>
        </div>
      )}

      {/* Secondary CTA Link ("Skip for now") */}
      {showSkip && (
        <div
          className={part === "all" ? "mt-3.5 sm:mt-4" : ""}
          ref={skipWrapperRef}
          style={{
            opacity: reducedMotion ? 1 : 0,
            transform: reducedMotion ? "translateY(0px)" : "translateY(12px)",
          }}
        >
          <button
            className="font-sans text-[14px] font-medium text-white/70 hover:text-white/95 hover:underline underline-offset-[3px] min-h-[40px] px-4 py-2 flex items-center justify-center cursor-pointer transition-[color,opacity] motion-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-[3px] focus-visible:ring-offset-[#05070D] rounded-sm"
            onClick={(e) => {
              e.stopPropagation();
              onSkip?.();
            }}
            type="button"
          >
            {WELCOME_STRINGS.ctaSkip}
          </button>
        </div>
      )}

      {/* Explanatory Footer Line (Strictly One Line on Desktop, Contrast >= 4.5:1) */}
      {showFooter && (
        <p
          className={`${part === "all" ? "mt-4 sm:mt-5 " : ""}font-sans text-[12.5px] font-normal leading-[1.4] text-white/[0.52] text-center whitespace-normal sm:whitespace-nowrap px-4 select-none`}
          ref={footerWrapperRef}
          style={{
            opacity: reducedMotion ? 1 : 0,
            transform: reducedMotion ? "translateY(0px)" : "translateY(12px)",
          }}
        >
          {WELCOME_STRINGS.footer}
        </p>
      )}
    </div>
  );
}
