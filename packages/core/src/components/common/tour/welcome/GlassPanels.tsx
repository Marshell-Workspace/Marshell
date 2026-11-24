/**
 * GlassPanels.tsx — Bow-Tie Fan Blades (UNFOLD) & Compact Hugging 3D Panels (ALIGN).
 *
 * Storyboard Source of Truth:
 * 1. UNFOLD (1.60s -> 2.70s):
 *    - Unmistakable BOW-TIE fan of 4 glass blades per side meeting at singularity.
 *    - Inner edge collapses onto singularity (inner height 4.5% of outer height).
 *    - Outer edge distances from center: 0.93, 0.80, 0.68, 0.56 of half-width.
 *    - Outer edge heights: 0.72, 0.62, 0.54, 0.46 of content height H.
 *    - Rubbery underdamped spring stretch (10-15% overshoot, follow-through edge lag, squash/stretch).
 *    - Front blades carry perspective-converging skeleton code bars.
 *    - 1px glowing gradient borders + diagonal specular sheen.
 * 2. ALIGN (2.70s -> 4.00s):
 *    - Front panels relax into COMPACT glass panels (1.5 L x 1.5 L) hugging the logo (0.2 L gap).
 *    - 2 rear glass layers peek out behind each front panel (5-9% fill, thin border).
 *    - Tilted in perspective (~20 deg mirrored, inner edge farther away) so text slopes down toward logo.
 *    - Crisp monospace terminal text typed one line at a time (~110ms stagger, first '>' brighter).
 *    - Legible, well-padded (>= 0.2 L), never covered by logo.
 *    - NO "Welcome" text during ALIGN.
 * 3. WELCOME (4.00s -> 4.70s):
 *    - Terminal text fades out 4.0 -> 4.3s.
 *    - Panels retract into logo like rubber and fade 4.1 -> 4.7s.
 * Zero React state updates per frame — driven directly via registerFrameCallback.
 */

"use client";

import { useEffect, useRef } from "react";
import { evaluateSpring } from "./spring";
import type { FrameCallback } from "./useWelcomeTimeline";
import {
  DESIGN_TOKENS,
  PANEL_CONFIG,
  TERMINAL_LINES,
  WELCOME_CONFIG,
} from "./welcome.config";

export interface GlassPanelsProps {
  contentHeight?: number;
  contentWidth?: number;
  logoSize?: number;
  originX?: number;
  originY?: number;
  reducedMotion: boolean;
  registerFrameCallback: (cb: FrameCallback) => () => void;
  tier: "performance" | "balanced" | "eco";
}

export function GlassPanels({
  reducedMotion,
  registerFrameCallback,
  tier: _tier,
  originX,
  originY,
  contentWidth,
  contentHeight,
  logoSize = 150,
}: GlassPanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // SVG blade refs (UNFOLD)
  const unfoldSvgRef = useRef<SVGSVGElement>(null);
  const leftBladeRefs = useRef<(SVGPolygonElement | null)[]>([]);
  const rightBladeRefs = useRef<(SVGPolygonElement | null)[]>([]);
  const leftSkeletonRef = useRef<SVGGElement>(null);
  const rightSkeletonRef = useRef<SVGGElement>(null);
  const leftSheenRef = useRef<SVGPolygonElement>(null);
  const rightSheenRef = useRef<SVGPolygonElement>(null);

  // HTML 3D compact panel refs (ALIGN)
  const alignContainerRef = useRef<HTMLDivElement>(null);
  const leftAlignGroupRef = useRef<HTMLDivElement>(null);
  const rightAlignGroupRef = useRef<HTMLDivElement>(null);
  const termLeftRef = useRef<HTMLDivElement>(null);
  const termRightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) {
      if (containerRef.current) {
        containerRef.current.style.display = "none";
      }
      return;
    }

    const { unfold, align, welcome } = WELCOME_CONFIG;
    const cfg = PANEL_CONFIG.unfold;

    const onFrame = (t: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      // Panels only active from UNFOLD start until retraction end
      if (t < unfold.start || t >= welcome.panelsRetractEnd) {
        container.style.display = "none";
        return;
      }
      container.style.display = "block";

      const w =
        contentWidth ||
        (typeof window === "undefined" ? 1280 : window.innerWidth);
      const h =
        contentHeight ||
        (typeof window === "undefined" ? 800 : window.innerHeight);
      const halfW = w / 2;
      const cx = originX ?? halfW;
      const cy = originY ?? h / 2;

      // ─────────────────────────────────────────────────────────────────────────
      // 1. UNFOLD BOW-TIE FAN BLADES (1.60s -> 3.00s, fades out during 2.7 -> 3.0)
      // ─────────────────────────────────────────────────────────────────────────
      const unfoldSvg = unfoldSvgRef.current;
      if (unfoldSvg) {
        if (t >= align.start + 0.3) {
          unfoldSvg.style.display = "none";
        } else {
          unfoldSvg.style.display = "block";

          let unfoldFade = 1.0;
          if (t >= align.start) {
            unfoldFade = Math.max(0, 1.0 - (t - align.start) / 0.3);
          }
          unfoldSvg.style.opacity = String(unfoldFade);

          for (let i = 0; i < cfg.bladeCount; i++) {
            const staggerMs = cfg.staggersMs[i] ?? 0;
            const staggerSec = staggerMs / 1000;
            const bladeStart = unfold.start + staggerSec;

            const leftPoly = leftBladeRefs.current[i];
            const rightPoly = rightBladeRefs.current[i];

            if (t < bladeStart) {
              if (leftPoly) {
                leftPoly.style.opacity = "0";
              }
              if (rightPoly) {
                rightPoly.style.opacity = "0";
              }
              continue;
            }

            const tSpring = t - bladeStart;
            const stiffness = cfg.stiffness[i] ?? 140;
            const damping = cfg.damping[i] ?? 13.5;
            const spring = evaluateSpring(
              tSpring,
              {
                stiffness,
                damping,
                initial: 0.02,
                target: 1.0,
              },
              0.05
            );

            // Extension distance
            const outerDistRatio = cfg.outerDistances[i] ?? 0.6;
            const targetDist = outerDistRatio * halfW;
            const currentDist = targetDist * Math.max(0.01, spring.value);

            // Heights with squash/stretch
            const outerHeightRatio = cfg.outerHeights[i] ?? 0.5;
            const targetOuterH = outerHeightRatio * h;
            const currentOuterH = targetOuterH * spring.scaleY;
            const innerH = currentOuterH * cfg.innerEdgeHeightRatio;

            // Follow-through vertical edge lag
            const lagY = spring.velocity * 4.5;

            // Opacity: front blade is brightest, back blades dimmer
            const depthAlpha = 0.45 + i * 0.18; // back to front
            const emergenceAlpha = Math.min(1.0, tSpring / 0.25);
            const bladeAlpha = depthAlpha * emergenceAlpha;

            // Left blade polygon points (mirrored)
            if (leftPoly) {
              const xInner = cx;
              const yInnerTop = cy - innerH / 2;
              const yInnerBot = cy + innerH / 2;
              const xOuter = cx - currentDist;
              const yOuterTop = cy - currentOuterH / 2 + lagY;
              const yOuterBot = cy + currentOuterH / 2 + lagY;

              leftPoly.setAttribute(
                "points",
                `${xInner},${yInnerTop} ${xOuter},${yOuterTop} ${xOuter},${yOuterBot} ${xInner},${yInnerBot}`
              );
              leftPoly.style.opacity = String(bladeAlpha);
            }

            // Right blade polygon points
            if (rightPoly) {
              const xInner = cx;
              const yInnerTop = cy - innerH / 2;
              const yInnerBot = cy + innerH / 2;
              const xOuter = cx + currentDist;
              const yOuterTop = cy - currentOuterH / 2 - lagY;
              const yOuterBot = cy + currentOuterH / 2 - lagY;

              rightPoly.setAttribute(
                "points",
                `${xInner},${yInnerTop} ${xOuter},${yOuterTop} ${xOuter},${yOuterBot} ${xInner},${yInnerBot}`
              );
              rightPoly.style.opacity = String(bladeAlpha);
            }

            // Front blade skeleton code bars (i === 3)
            if (i === 3) {
              const skelAlpha = Math.min(0.4, tSpring / 0.35);
              if (leftSkeletonRef.current) {
                leftSkeletonRef.current.style.opacity = String(skelAlpha);
                leftSkeletonRef.current.setAttribute(
                  "transform",
                  `translate(${cx - currentDist * 0.72}, ${cy - currentOuterH * 0.28}) scale(${Math.max(0.01, spring.value * 0.7)}, ${spring.scaleY})`
                );
              }
              if (rightSkeletonRef.current) {
                rightSkeletonRef.current.style.opacity = String(skelAlpha);
                rightSkeletonRef.current.setAttribute(
                  "transform",
                  `translate(${cx + currentDist * 0.25}, ${cy - currentOuterH * 0.28}) scale(${Math.max(0.01, spring.value * 0.7)}, ${spring.scaleY})`
                );
              }

              // Specular sheen on front blades
              const sheenP = Math.min(
                1.0,
                Math.max(0, (tSpring - 0.15) / unfold.sheenDuration)
              );
              const sheenAlpha = Math.sin(sheenP * Math.PI) * 0.55;
              if (leftSheenRef.current) {
                leftSheenRef.current.style.opacity = String(sheenAlpha);
              }
              if (rightSheenRef.current) {
                rightSheenRef.current.style.opacity = String(sheenAlpha);
              }
            }
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // 2. ALIGN COMPACT HUGGING PANELS (2.70s -> 4.70s)
      // ─────────────────────────────────────────────────────────────────────────
      const alignContainer = alignContainerRef.current;
      const leftGroup = leftAlignGroupRef.current;
      const rightGroup = rightAlignGroupRef.current;

      if (alignContainer && leftGroup && rightGroup) {
        if (t < align.start) {
          alignContainer.style.display = "none";
        } else {
          alignContainer.style.display = "block";

          const L = logoSize;
          const panelW = L * PANEL_CONFIG.align.widthRatio;
          // Inner edge is 0.2 L from logo outer edge (logo half-width is 0.55 L)
          const panelGapFromCenter =
            L * (0.55 + PANEL_CONFIG.align.innerGapRatio);

          let alignAlpha = 1.0;
          let alignScaleX = 1.0;

          // Fade & Bloom in at ALIGN start (2.7 -> 3.0s)
          if (t < align.start + 0.3) {
            const p = (t - align.start) / 0.3;
            alignAlpha = p;
            alignScaleX = 0.85 + 0.15 * p;
          }

          // Rubber retract during WELCOME (4.10s -> 4.70s)
          if (t >= welcome.panelsRetractStart) {
            const rElapsed = t - welcome.panelsRetractStart;
            const rDur = welcome.panelsRetractEnd - welcome.panelsRetractStart;
            const rp = Math.min(1.0, rElapsed / rDur);
            // Elastic rubber snap toward logo edge
            const snapEase = rp ** 2.2;
            alignScaleX = Math.max(0.01, 1.0 - snapEase);
            alignAlpha = Math.max(0, 1.0 - rp * 1.4);
          }

          // Left panel group
          leftGroup.style.opacity = String(alignAlpha);
          leftGroup.style.transform = `translateX(-${panelGapFromCenter + panelW}px) translateY(-50%) perspective(1100px) rotateY(${PANEL_CONFIG.align.tiltDeg}deg) scaleX(${alignScaleX.toFixed(3)})`;

          // Right panel group
          rightGroup.style.opacity = String(alignAlpha);
          rightGroup.style.transform = `translateX(${panelGapFromCenter}px) translateY(-50%) perspective(1100px) rotateY(-${PANEL_CONFIG.align.tiltDeg}deg) scaleX(${alignScaleX.toFixed(3)})`;

          // Terminal code lines typing
          const termLeft = termLeftRef.current;
          const termRight = termRightRef.current;
          if (termLeft && termRight) {
            if (t < align.terminalStart) {
              termLeft.style.opacity = "0";
              termRight.style.opacity = "0";
            } else if (t < welcome.start) {
              // Typing in progress
              termLeft.style.opacity = "1";
              termRight.style.opacity = "1";

              const elapsed = t - align.terminalStart;
              const activeLineIdx = Math.floor(
                elapsed / align.terminalLineStagger
              );

              // Left lines typing
              const leftChildren = termLeft.children;
              for (let j = 0; j < leftChildren.length; j++) {
                const lineEl = leftChildren[j] as HTMLElement;
                if (lineEl) {
                  lineEl.style.opacity = j <= activeLineIdx ? "1" : "0";
                }
              }

              // Right lines typing (starts after first 2 left lines)
              const rightOffsetIdx = activeLineIdx - 1;
              const rightChildren = termRight.children;
              for (let k = 0; k < rightChildren.length; k++) {
                const lineEl = rightChildren[k] as HTMLElement;
                if (lineEl) {
                  lineEl.style.opacity = k <= rightOffsetIdx ? "1" : "0";
                }
              }
            } else {
              // Fade out over 4.0s -> 4.3s
              const fadeElapsed = t - welcome.start;
              const textAlpha = Math.max(0, 1.0 - fadeElapsed / 0.3);
              termLeft.style.opacity = String(textAlpha);
              termRight.style.opacity = String(textAlpha);
            }
          }
        }
      }
    };

    return registerFrameCallback(onFrame);
  }, [
    reducedMotion,
    registerFrameCallback,
    contentWidth,
    contentHeight,
    originX,
    originY,
    logoSize,
  ]);

  const L = logoSize;
  const panelW = Math.round(L * PANEL_CONFIG.align.widthRatio);
  const panelH = Math.round(L * PANEL_CONFIG.align.heightRatio);
  const cornerR = Math.round(L * PANEL_CONFIG.cornerRadiusRatio);
  const textPadding = Math.round(L * PANEL_CONFIG.align.textPaddingRatio);
  const textFontSize = Math.max(
    11,
    Math.round(L * PANEL_CONFIG.align.textFontSizeRatio)
  );

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none z-15 select-none overflow-hidden"
      ref={containerRef}
    >
      {/* ── 1. UNFOLD Stage: Bow-Tie SVG Fan Blades (Stacked in Depth) ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        ref={unfoldSvgRef}
        style={{ display: "none" }}
      >
        <defs>
          {/* Blue Diagonal Gradient Fill */}
          <linearGradient id="unfold-blue-grad" x1="1" x2="0" y1="0.5" y2="0">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.22)" />
            <stop offset="60%" stopColor="rgba(30, 58, 138, 0.12)" />
            <stop offset="100%" stopColor="rgba(30, 58, 138, 0.03)" />
          </linearGradient>

          {/* Amber/Near-White Diagonal Gradient Fill */}
          <linearGradient id="unfold-amber-grad" x1="0" x2="1" y1="0.5" y2="0">
            <stop offset="0%" stopColor="rgba(221, 227, 238, 0.20)" />
            <stop offset="60%" stopColor="rgba(92, 100, 117, 0.10)" />
            <stop offset="100%" stopColor="rgba(92, 100, 117, 0.02)" />
          </linearGradient>

          {/* Diagonal Sheen Gradient */}
          <linearGradient id="unfold-sheen-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="20%" stopColor="transparent" />
            <stop offset="50%" stopColor="rgba(255, 255, 255, 0.45)" />
            <stop offset="80%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* 4 Blue Blades on Left (Back to Front) */}
        {[0, 1, 2, 3].map((idx) => (
          <polygon
            fill="url(#unfold-blue-grad)"
            key={`left-blade-${idx}`}
            opacity="0"
            ref={(el) => {
              leftBladeRefs.current[idx] = el;
            }}
            stroke={DESIGN_TOKENS.blue.panelBorderLit}
            strokeOpacity={idx === 3 ? 0.75 : 0.25 + idx * 0.12}
            strokeWidth="1.2"
          />
        ))}

        {/* 4 Amber Blades on Right (Back to Front) */}
        {[0, 1, 2, 3].map((idx) => (
          <polygon
            fill="url(#unfold-amber-grad)"
            key={`right-blade-${idx}`}
            opacity="0"
            ref={(el) => {
              rightBladeRefs.current[idx] = el;
            }}
            stroke={DESIGN_TOKENS.amber.panelBorderLit}
            strokeOpacity={idx === 3 ? 0.7 : 0.25 + idx * 0.12}
            strokeWidth="1.2"
          />
        ))}

        {/* Skeleton Code Bars on Front Left Blade (Converging toward center) */}
        <g opacity="0" ref={leftSkeletonRef}>
          <rect
            fill={DESIGN_TOKENS.blue.light}
            height="6"
            opacity="0.4"
            rx="3"
            width="110"
            x="0"
            y="0"
          />
          <rect
            fill={DESIGN_TOKENS.blue.core}
            height="6"
            opacity="0.35"
            rx="3"
            width="75"
            x="0"
            y="14"
          />
          <rect
            fill={DESIGN_TOKENS.blue.light}
            height="6"
            opacity="0.3"
            rx="3"
            width="130"
            x="0"
            y="28"
          />
          <rect
            fill={DESIGN_TOKENS.blue.deep}
            height="6"
            opacity="0.25"
            rx="3"
            width="55"
            x="0"
            y="42"
          />
        </g>

        {/* Skeleton Code Bars on Front Right Blade (Converging toward center) */}
        <g opacity="0" ref={rightSkeletonRef}>
          <rect
            fill={DESIGN_TOKENS.amber.light}
            height="6"
            opacity="0.4"
            rx="3"
            width="110"
            x="0"
            y="0"
          />
          <rect
            fill={DESIGN_TOKENS.amber.core}
            height="6"
            opacity="0.35"
            rx="3"
            width="75"
            x="0"
            y="14"
          />
          <rect
            fill={DESIGN_TOKENS.amber.light}
            height="6"
            opacity="0.3"
            rx="3"
            width="130"
            x="0"
            y="28"
          />
          <rect
            fill={DESIGN_TOKENS.amber.deep}
            height="6"
            opacity="0.25"
            rx="3"
            width="55"
            x="0"
            y="42"
          />
        </g>
      </svg>

      {/* ── 2. ALIGN Stage: Compact Hugging 3D Glass Panels with Terminal Code ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        ref={alignContainerRef}
        style={{ display: "none" }}
      >
        {/* Left Compact Group (Blue) */}
        <div
          className="absolute left-1/2 top-1/2 pointer-events-none"
          ref={leftAlignGroupRef}
          style={{
            width: panelW,
            height: panelH,
            transformOrigin: "right center",
          }}
        >
          {/* Rear Glass Layer 2 (Furthest back, faint offset) */}
          <div
            className="absolute inset-0 pointer-events-none rounded-[16px]"
            style={{
              transform: "translateX(-20px) translateY(8px) scale(1.08)",
              background: "rgba(30, 58, 138, 0.05)",
              border: "1px solid rgba(125, 180, 255, 0.12)",
              opacity: 0.6,
            }}
          />

          {/* Rear Glass Layer 1 (Mid back) */}
          <div
            className="absolute inset-0 pointer-events-none rounded-[16px]"
            style={{
              transform: "translateX(-10px) translateY(4px) scale(1.04)",
              background: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(125, 180, 255, 0.22)",
              opacity: 0.8,
            }}
          />

          {/* Front Panel (Main glass with lit border & terminal text) */}
          <div
            className="relative size-full flex flex-col justify-center overflow-hidden"
            style={{
              borderRadius: cornerR,
              background:
                "linear-gradient(135deg, rgba(59, 130, 246, 0.16) 0%, rgba(30, 58, 138, 0.06) 100%)",
              border: `1px solid ${DESIGN_TOKENS.blue.panelBorderLit}`,
              boxShadow:
                "0 16px 40px -10px rgba(30, 58, 138, 0.4), inset 0 1px 0 rgba(214, 230, 255, 0.35)",
              padding: textPadding,
            }}
          >
            {/* Top specular highlight */}
            <div
              className="absolute inset-x-0 top-0 h-[1px] pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(214, 230, 255, 0.7) 30%, transparent 100%)",
              }}
            />

            {/* Monospace Terminal Code Lines (Left) */}
            <div
              className="flex flex-col justify-center font-mono leading-[1.7] select-none"
              ref={termLeftRef}
              style={{
                fontSize: textFontSize,
                color: "#8FB8FF",
                textShadow: "0 0 10px rgba(59, 130, 246, 0.5)",
                opacity: 0,
              }}
            >
              {TERMINAL_LINES.left.map((line) => (
                <div
                  className="flex items-center gap-1.5 transition-opacity"
                  key={line}
                  style={{ opacity: 0 }}
                >
                  <span className="font-bold text-[#FFFFFF]">
                    {line.slice(0, 1)}
                  </span>
                  <span>{line.slice(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Compact Group (Amber) */}
        <div
          className="absolute left-1/2 top-1/2 pointer-events-none"
          ref={rightAlignGroupRef}
          style={{
            width: panelW,
            height: panelH,
            transformOrigin: "left center",
          }}
        >
          {/* Rear Glass Layer 2 */}
          <div
            className="absolute inset-0 pointer-events-none rounded-[16px]"
            style={{
              transform: "translateX(20px) translateY(8px) scale(1.08)",
              background: "rgba(92, 100, 117, 0.05)",
              border: "1px solid rgba(238, 241, 247, 0.12)",
              opacity: 0.6,
            }}
          />

          {/* Rear Glass Layer 1 */}
          <div
            className="absolute inset-0 pointer-events-none rounded-[16px]"
            style={{
              transform: "translateX(10px) translateY(4px) scale(1.04)",
              background: "rgba(221, 227, 238, 0.08)",
              border: "1px solid rgba(238, 241, 247, 0.22)",
              opacity: 0.8,
            }}
          />

          {/* Front Panel (Main glass with lit border & terminal text) */}
          <div
            className="relative size-full flex flex-col justify-center overflow-hidden"
            style={{
              borderRadius: cornerR,
              background:
                "linear-gradient(135deg, rgba(221, 227, 238, 0.14) 0%, rgba(92, 100, 117, 0.05) 100%)",
              border: `1px solid ${DESIGN_TOKENS.amber.panelBorderLit}`,
              boxShadow:
                "0 16px 40px -10px rgba(92, 100, 117, 0.4), inset 0 1px 0 rgba(244, 246, 250, 0.35)",
              padding: textPadding,
            }}
          >
            {/* Top specular highlight */}
            <div
              className="absolute inset-x-0 top-0 h-[1px] pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(244, 246, 250, 0.7) 70%, transparent 100%)",
              }}
            />

            {/* Monospace Terminal Code Lines (Right) */}
            <div
              className="flex flex-col justify-center font-mono leading-[1.7] select-none"
              ref={termRightRef}
              style={{
                fontSize: textFontSize,
                color: "#EEF1F7",
                textShadow: "0 0 10px rgba(238, 241, 247, 0.5)",
                opacity: 0,
              }}
            >
              {TERMINAL_LINES.right.map((line) => (
                <div
                  className="flex items-center gap-1.5 transition-opacity"
                  key={line}
                  style={{ opacity: 0 }}
                >
                  <span className="font-bold text-[#F4F6FA]">
                    {line.slice(0, 1)}
                  </span>
                  <span>{line.slice(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
