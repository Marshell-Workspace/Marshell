/**
 * UnifiedCanvas.tsx — Unified Canvas 2D Glass & Silk Engine with Warped DOM Content.
 *
 * Implements:
 * 1. Single unified Canvas 2D rendering rear horns (S4..S2), silk ribbons (B1..B5), and front panel (S1).
 * 2. Exact Z-order: Background -> Rear Horns -> Silk Ribbons -> Front Panels (S1) -> DOM Content -> Flare -> Logo.
 * 3. 2D Projective Homography: DOM skeleton bars (UNFOLD) & monospace terminal text (ALIGN) warped via matrix3d.
 * 4. Zero React state updates per frame — driven via registerFrameCallback.
 */

"use client";

import { useEffect, useRef } from "react";
import { quadToMatrix3d } from "./homography";
import { type FrontQuadCorners, renderSheetsAndRibbons } from "./sheetMath";
import type { FrameCallback } from "./useWelcomeTimeline";
import {
  calculateAlignLogoSize,
  DESIGN_TOKENS,
  getLayerVisibility,
  TERMINAL_LINES,
  WELCOME_CONFIG,
} from "./welcome.config";

export interface UnifiedCanvasProps {
  reducedMotion: boolean;
  registerFrameCallback: (cb: FrameCallback) => () => void;
  tier: "performance" | "balanced" | "eco";
  webglQuadsRef?: React.RefObject<{
    leftFrontQuad: FrontQuadCorners | null;
    rightFrontQuad: FrontQuadCorners | null;
  } | null>;
}

export function UnifiedCanvas({
  reducedMotion,
  registerFrameCallback,
  tier: initialTier,
  webglQuadsRef,
}: UnifiedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftWarpRef = useRef<HTMLDivElement>(null);
  const rightWarpRef = useRef<HTMLDivElement>(null);
  const leftRear1Ref = useRef<HTMLDivElement>(null);
  const leftRear2Ref = useRef<HTMLDivElement>(null);
  const rightRear1Ref = useRef<HTMLDivElement>(null);
  const rightRear2Ref = useRef<HTMLDivElement>(null);

  // Content refs
  const leftSkelRef = useRef<HTMLDivElement>(null);
  const rightSkelRef = useRef<HTMLDivElement>(null);
  const leftTermRef = useRef<HTMLDivElement>(null);
  const rightTermRef = useRef<HTMLDivElement>(null);

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

    const updateTextStyles = (h: number) => {
      const La_h = calculateAlignLogoSize(h);
      const textCfg = WELCOME_CONFIG.align.panel.text;
      // Section 6.6: per-character width ~0.057 La, font size ~0.095 La
      const termFontSize = Math.round(textCfg.fontSizeRatioLa * La_h);
      const termLineHeight = Math.max(
        16,
        Math.round(textCfg.lineHeightRatioLa * La_h)
      );
      const leftInset = Math.round(textCfg.leftInsetFarLa * La_h);
      const rightInset = Math.round(textCfg.rightInsetNearLa * La_h);
      const maxTextWidth = Math.round((1.52 - 0.28) * La_h);

      if (leftTermRef.current) {
        leftTermRef.current.style.fontSize = `${termFontSize}px`;
        leftTermRef.current.style.lineHeight = `${termLineHeight}px`;
        leftTermRef.current.style.left = `${leftInset}px`;
        leftTermRef.current.style.width = `${maxTextWidth}px`;
      }
      if (rightTermRef.current) {
        rightTermRef.current.style.fontSize = `${termFontSize}px`;
        rightTermRef.current.style.lineHeight = `${termLineHeight}px`;
        rightTermRef.current.style.left = `${rightInset}px`;
        rightTermRef.current.style.width = `${maxTextWidth}px`;
      }
    };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.parentElement?.clientHeight || window.innerHeight;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      updateTextStyles(height);

      // Reduced motion: draw final state once immediately
      if (reducedMotion) {
        renderSheetsAndRibbons(
          ctx,
          width,
          height,
          WELCOME_CONFIG.welcome.totalDuration,
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

    if (!bloomCanvasRef.current && typeof document !== "undefined") {
      bloomCanvasRef.current = document.createElement("canvas");
    }

    const onFrame = (t: number) => {
      if (width <= 0 || height <= 0) {
        return;
      }

      // Ambient 30fps throttle after intro completes
      const isAmbient = t >= WELCOME_CONFIG.welcome.totalDuration;
      const now = performance.now();
      if (isAmbient) {
        const interval = 1000 / WELCOME_CONFIG.ambient.fpsLimit;
        if (now - lastDrawTimeRef.current < interval) {
          return;
        }
      }

      const frameStart = performance.now();

      const showFrame3 = getLayerVisibility("frame-3");
      canvas.style.visibility = showFrame3 ? "" : "hidden";

      ctx.clearRect(0, 0, width, height);

      const renderRes = renderSheetsAndRibbons(
        ctx,
        width,
        height,
        t,
        activeTierRef.current,
        bloomCanvasRef.current ?? undefined
      );

      // ── DOM Homography Warping for S1 Content ──
      const La = calculateAlignLogoSize(height);
      const isAlignOrLater = t >= 2.5;
      const panelRefW = Math.round((isAlignOrLater ? 1.52 : 1.4) * La);
      const panelRefH = Math.round((isAlignOrLater ? 1.75 : 1.85) * La);

      const { align, welcome } = WELCOME_CONFIG;

      const leftQuad =
        t >= 2.5
          ? (webglQuadsRef?.current?.leftFrontQuad ?? renderRes.leftFrontQuad)
          : renderRes.leftFrontQuad;
      const rightQuad =
        t >= 2.5
          ? (webglQuadsRef?.current?.rightFrontQuad ?? renderRes.rightFrontQuad)
          : renderRes.rightFrontQuad;

      // 1. Left Panel Warping
      if (leftWarpRef.current && leftQuad) {
        const q = leftQuad;
        // Map source (panelRefW x panelRefH):
        // p0 = pTopOuter (top-left)
        // p1 = pTopInner (top-right)
        // p2 = pBotInner (bottom-right)
        // p3 = pBotOuter (bottom-left)
        const matrix3d = quadToMatrix3d(
          panelRefW,
          panelRefH,
          q.pTopOuter,
          q.pTopInner,
          q.pBotInner,
          q.pBotOuter
        );
        leftWarpRef.current.style.transform = matrix3d;
        leftWarpRef.current.style.width = `${panelRefW}px`;
        leftWarpRef.current.style.height = `${panelRefH}px`;
        leftWarpRef.current.style.display =
          t < 2.55 || t >= welcome.panelsRetractEnd ? "none" : "block";
        leftWarpRef.current.style.visibility = getLayerVisibility("text")
          ? ""
          : "hidden";
      }

      // 2. Right Panel Warping
      if (rightWarpRef.current && rightQuad) {
        const q = rightQuad;
        // p0 = pTopInner (top-left)
        // p1 = pTopOuter (top-right)
        // p2 = pBotOuter (bottom-right)
        // p3 = pBotInner (bottom-left)
        const matrix3d = quadToMatrix3d(
          panelRefW,
          panelRefH,
          q.pTopInner,
          q.pTopOuter,
          q.pBotOuter,
          q.pBotInner
        );
        rightWarpRef.current.style.transform = matrix3d;
        rightWarpRef.current.style.width = `${panelRefW}px`;
        rightWarpRef.current.style.height = `${panelRefH}px`;
        rightWarpRef.current.style.display =
          t < 2.55 || t >= welcome.panelsRetractEnd ? "none" : "block";
        rightWarpRef.current.style.visibility = getLayerVisibility("text")
          ? ""
          : "hidden";
      }

      // ── Content 1: Skeleton Code Bars in UNFOLD (Rendered via Canvas2D) ──
      const leftSkel = leftSkelRef.current;
      const rightSkel = rightSkelRef.current;
      if (leftSkel && rightSkel) {
        leftSkel.style.display = "none";
        rightSkel.style.display = "none";
      }

      // ── Content 2: Monospace Terminal Typing in ALIGN (2.95 -> 4.30s) ──
      const leftTerm = leftTermRef.current;
      const rightTerm = rightTermRef.current;
      if (leftTerm && rightTerm) {
        if (t < align.terminalStart || t >= welcome.textFadeEnd) {
          leftTerm.style.opacity = "0";
          rightTerm.style.opacity = "0";
        } else if (t < welcome.start) {
          leftTerm.style.opacity = "1";
          rightTerm.style.opacity = "1";

          // Character typing: 90ms stagger between lines, 60ms per line left-to-right
          const lineDuration = 0.06;
          const leftChildren = leftTerm.children;
          for (let i = 0; i < leftChildren.length; i++) {
            const lineEl = leftChildren[i] as HTMLElement;
            if (lineEl) {
              const lineStart =
                align.terminalStart + i * align.terminalLineStagger;
              if (t < lineStart) {
                lineEl.style.opacity = "0";
                lineEl.style.clipPath = "inset(0 100% 0 0)";
              } else if (t >= lineStart + lineDuration) {
                lineEl.style.opacity = "1";
                lineEl.style.clipPath = "none";
              } else {
                const p = (t - lineStart) / lineDuration;
                lineEl.style.opacity = "1";
                lineEl.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(1)}% 0 0)`;
              }
            }
          }

          const rightChildren = rightTerm.children;
          for (let j = 0; j < rightChildren.length; j++) {
            const lineEl = rightChildren[j] as HTMLElement;
            if (lineEl) {
              const lineStart =
                align.terminalStart + j * align.terminalLineStagger;
              if (t < lineStart) {
                lineEl.style.opacity = "0";
                lineEl.style.clipPath = "inset(0 100% 0 0)";
              } else if (t >= lineStart + lineDuration) {
                lineEl.style.opacity = "1";
                lineEl.style.clipPath = "none";
              } else {
                const p = (t - lineStart) / lineDuration;
                lineEl.style.opacity = "1";
                lineEl.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(1)}% 0 0)`;
              }
            }
          }
        } else {
          // Fade out 4.0 -> 4.3s
          const fadeElapsed = t - welcome.start;
          const pFade = Math.max(
            0,
            1.0 - fadeElapsed / (welcome.textFadeEnd - welcome.start)
          );
          leftTerm.style.opacity = String(pFade);
          rightTerm.style.opacity = String(pFade);
        }
      }

      // Adaptive performance governor
      const frameDuration = performance.now() - frameStart;
      lastDrawTimeRef.current = now;

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
  }, [reducedMotion, registerFrameCallback]);

  // Terminal font calculations (Exact 0.057*La char width, 0.095*La font size, line height 0.20*La)
  const defaultH = typeof window === "undefined" ? 800 : window.innerHeight;
  const La = calculateAlignLogoSize(defaultH);
  const textCfg = WELCOME_CONFIG.align.panel.text;
  const termFontSize = Math.round(textCfg.fontSizeRatioLa * La);
  const termLineHeight = Math.max(
    16,
    Math.round(textCfg.lineHeightRatioLa * La)
  );
  const leftTextInsetPx = Math.round(textCfg.leftInsetFarLa * La);
  const rightTextInsetPx = Math.round(textCfg.rightInsetNearLa * La);
  const maxTextWidth = Math.round((1.52 - 0.28) * La);

  return (
    <div className="absolute inset-0 pointer-events-none z-15 select-none overflow-hidden">
      {/* ── High-DPI Canvas 2D Glass & Silk Ribbons ── */}
      <canvas
        className="absolute inset-0 pointer-events-none z-10"
        ref={canvasRef}
        style={{ display: "block", contain: "strict" }}
      />

      {/* ── Left S1 Warped Quad Overlay (DOM Content) ── */}
      <div
        className="absolute left-0 top-0 pointer-events-none z-20 origin-top-left overflow-visible"
        ref={leftWarpRef}
        style={{ display: "none" }}
      >
        {/* Rear Glass Layer 2 (Furthest Back) */}
        <div
          className="absolute inset-0 rounded-[14px] pointer-events-none"
          ref={leftRear2Ref}
          style={{
            display: "none",
            background: "rgba(30, 58, 138, 0.08)",
            border: "1px solid rgba(125, 180, 255, 0.15)",
            opacity: 0.28,
          }}
        />

        {/* Rear Glass Layer 1 (Mid Back) */}
        <div
          className="absolute inset-0 rounded-[14px] pointer-events-none"
          ref={leftRear1Ref}
          style={{
            display: "none",
            background: "rgba(59, 130, 246, 0.12)",
            border: "1px solid rgba(125, 180, 255, 0.3)",
            opacity: 0.45,
          }}
        />

        {/* Skeleton Code Bars in UNFOLD (1.6 -> 2.7s) */}
        <div
          className="absolute inset-0 flex flex-col justify-center gap-2.5 px-8 transition-opacity"
          ref={leftSkelRef}
          style={{ opacity: 0 }}
        >
          <div
            className="h-2 rounded-full bg-[#7DB4FF] opacity-80"
            style={{ width: "78%" }}
          />
          <div
            className="h-2 rounded-full bg-[#3B82F6] opacity-45"
            style={{ width: "52%" }}
          />
          <div
            className="h-2 rounded-full bg-[#7DB4FF] opacity-45"
            style={{ width: "66%" }}
          />
          <div
            className="h-2 rounded-full bg-[#1E3A8A] opacity-45"
            style={{ width: "38%" }}
          />
          <div
            className="h-2 rounded-full bg-[#7DB4FF] opacity-45"
            style={{ width: "72%" }}
          />
          <div
            className="h-2 rounded-full bg-[#3B82F6] opacity-45"
            style={{ width: "45%" }}
          />
          <div
            className="h-2 rounded-full bg-[#1E3A8A] opacity-45"
            style={{ width: "30%" }}
          />
        </div>

        {/* Monospace Terminal Code Lines in ALIGN (2.7 -> 4.0s) */}
        <div
          aria-hidden="true"
          className="absolute flex flex-col justify-center font-mono select-none"
          ref={leftTermRef}
          style={{
            left: leftTextInsetPx,
            top: "50%",
            transform: "translateY(-50%)",
            width: maxTextWidth,
            fontSize: termFontSize,
            lineHeight: `${termLineHeight}px`,
            color: DESIGN_TOKENS.blue.text,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            textShadow: "0 0 2px rgba(59, 130, 246, 0.25)",
            whiteSpace: "nowrap",
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

      {/* ── Right S1 Warped Quad Overlay (DOM Content) ── */}
      <div
        className="absolute left-0 top-0 pointer-events-none z-20 origin-top-left overflow-visible"
        ref={rightWarpRef}
        style={{ display: "none" }}
      >
        {/* Rear Glass Layer 2 */}
        <div
          className="absolute inset-0 rounded-[14px] pointer-events-none"
          ref={rightRear2Ref}
          style={{
            display: "none",
            background: "rgba(92, 100, 117, 0.08)",
            border: "1px solid rgba(238, 241, 247, 0.15)",
            opacity: 0.28,
          }}
        />

        {/* Rear Glass Layer 1 */}
        <div
          className="absolute inset-0 rounded-[14px] pointer-events-none"
          ref={rightRear1Ref}
          style={{
            display: "none",
            background: "rgba(221, 227, 238, 0.12)",
            border: "1px solid rgba(238, 241, 247, 0.3)",
            opacity: 0.45,
          }}
        />

        {/* Skeleton Code Bars in UNFOLD (1.6 -> 2.7s) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex flex-col justify-center gap-2.5 px-8 transition-opacity"
          ref={rightSkelRef}
          style={{ opacity: 0 }}
        >
          <div
            className="h-2 rounded-full bg-[#DDE3EE] opacity-35"
            style={{ width: "75%" }}
          />
          <div
            className="h-2 rounded-full bg-[#DDE3EE] opacity-35"
            style={{ width: "50%" }}
          />
          <div
            className="h-2 rounded-full bg-[#DDE3EE] opacity-35"
            style={{ width: "65%" }}
          />
          <div
            className="h-2 rounded-full bg-[#DDE3EE] opacity-35"
            style={{ width: "40%" }}
          />
          <div
            className="h-2 rounded-full bg-[#DDE3EE] opacity-35"
            style={{ width: "58%" }}
          />
        </div>

        {/* Monospace Terminal Code Lines in ALIGN (2.7 -> 4.0s) */}
        <div
          aria-hidden="true"
          className="absolute flex flex-col justify-center font-mono select-none"
          ref={rightTermRef}
          style={{
            left: rightTextInsetPx,
            top: "50%",
            transform: "translateY(-50%)",
            width: maxTextWidth,
            fontSize: termFontSize,
            lineHeight: `${termLineHeight}px`,
            color: DESIGN_TOKENS.amber.text,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            textShadow: "0 0 2px rgba(238, 241, 247, 0.25)",
            whiteSpace: "nowrap",
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
  );
}
