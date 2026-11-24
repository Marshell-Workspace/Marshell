/**
 * WelcomeScene.tsx — First-Run Cinematic Welcome Screen Orchestrator (Revision 3).
 *
 * Implements the 6-stage storyboard experience:
 * 1. VOID (0.00s -> 0.70s): Deep space, center white dot, 4 faint crosshairs.
 * 2. RESONANCE (0.70s -> 1.60s): Two flowing silk scarves (blue left, amber right).
 * 3. UNFOLD (1.60s -> 2.70s): Bow-tie fan of 4 thick, luminous glass blades with rubber stretch.
 * 4. ALIGN (2.70s -> 4.00s): Marshell logo blooms at center (1.2 L), front panel hugs logo,
 *                              S2..S4 flare into big silk horns, monospace terminal text types cleanly.
 * 5. WELCOME (4.00s -> 6.10s): Logo glides to 0.26 H, panels retract into logo, horns relax into
 *                              two soft wings beside logo, cursive "Welcome" writes on with glowing nib
 *                              & comet tail, "MARSHELL" letters rise, CTA button, skip, and unwrapped footer appear.
 *                              Exact fractional centers: 0.26, 0.47, 0.59, 0.73, 0.85, 0.94 H.
 * 6. ENTER (Ambient & Handoff): Ambient idle floating, smooth 700ms flight to sidebar on Start.
 *
 * Performance & Architecture:
 * - Single requestAnimationFrame master clock; every animated value is a pure function of time T.
 * - Zero React state updates per frame (updates written directly to element refs).
 * - Immediate jump-to-end on click, tap, or keypress during intro.
 * - Full prefers-reduced-motion support (instant static resting layout).
 * - StrictMode double-mounting safe.
 */

"use client";

import { useAuthStore } from "@workspace/core/stores/auth-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playTourSound } from "../sound";
import { logTourEvent } from "./analytics";
import { DevScrubber } from "./DevScrubber";
import { LogoTile } from "./LogoTile";
import { Singularity } from "./Singularity";
import type { FrontQuadCorners } from "./sheetMath";
import { UnifiedCanvas } from "./UnifiedCanvas";
import { useWelcomeTimeline } from "./useWelcomeTimeline";
import { WelcomeActions } from "./WelcomeActions";
import { WelcomeHeadline } from "./WelcomeHeadline";
import { WelcomeWebGLStage } from "./webgl/WelcomeWebGLStage";
import {
  calculateLogoSize,
  DESIGN_TOKENS,
  DESKTOP_RASTER_TILE_PX,
  EXIT_ON_START_DELAY_MS,
  FINAL_LAYOUT,
  HANDOFF_DURATION_MS,
  HANDOFF_ON_START_DELAY_MS,
  MOBILE_RASTER_TILE_PX,
  RASTER_SCALE,
  sanitizeFirstName,
  WELCOME_CONFIG,
  WELCOME_STRINGS,
} from "./welcome.config";

export interface WelcomeSceneProps {
  isReplay?: boolean;
  onOpenSkipDialog?: () => void;
  onSkip: () => void;
  onStart: () => void;
  reducedMotion: boolean;
  tier: "performance" | "balanced" | "eco";
}

function createCubicBezier(x1: number, y1: number, x2: number, y2: number) {
  return (s: number): number => {
    if (s <= 0) {
      return 0;
    }
    if (s >= 1) {
      return 1;
    }
    let t = s;
    for (let i = 0; i < 6; i++) {
      const currentX =
        3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
      const currentSlope =
        3 * (1 - t) * (1 - t) * x1 +
        6 * (1 - t) * t * (x2 - x1) +
        3 * t * t * (1 - x2);
      if (Math.abs(currentSlope) < 1e-6) {
        break;
      }
      t -= (currentX - s) / currentSlope;
    }
    return (
      3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t
    );
  };
}

export function WelcomeScene({
  onStart,
  onSkip,
  onOpenSkipDialog,
  reducedMotion: propReducedMotion,
  tier = "performance",
  isReplay = false,
}: WelcomeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentStackRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const logoContainerRef = useRef<HTMLDivElement>(null);
  const webglQuadsRef = useRef<{
    leftFrontQuad: FrontQuadCorners | null;
    rightFrontQuad: FrontQuadCorners | null;
  }>({ leftFrontQuad: null, rightFrontQuad: null });

  const [viewport, setViewport] = useState({ width: 1920, height: 1080 });
  const [slotOffset, setSlotOffset] = useState({ x: 0, y: -260 });
  const [isExiting, setIsExiting] = useState(false);

  const isHandoffRunningRef = useRef(false);
  const mountTimeRef = useRef(0);
  const readyTimeRef = useRef(0);

  // ── 1. User Name & Personalized Greeting ──────────────────────────────────
  const authSession = useAuthStore((s) => s.session);
  const resolvedFirstName = useMemo(() => {
    let rawName = authSession?.name || "";
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("marshell_account_profile");
        const parsed = raw
          ? (JSON.parse(raw) as { displayName?: string; email?: string })
          : null;
        if (parsed?.displayName) {
          rawName = parsed.displayName;
        }
      } catch {
        // Ignore JSON errors
      }
    }
    return sanitizeFirstName(rawName);
  }, [authSession]);

  const greetingText = useMemo(() => {
    if (isReplay) {
      return resolvedFirstName
        ? `Welcome back, ${resolvedFirstName}`
        : "Welcome back";
    }
    return resolvedFirstName
      ? `Welcome, ${resolvedFirstName}`
      : WELCOME_STRINGS.headline;
  }, [isReplay, resolvedFirstName]);

  // ── 2. Master Clock Timeline Hook ─────────────────────────────────────────
  const {
    timeRef,
    isPlaying,
    registerFrameCallback,
    play,
    pause,
    seek,
    skipToEnd,
  } = useWelcomeTimeline({
    reducedMotion: propReducedMotion,
    onReady: () => {
      readyTimeRef.current = performance.now();
      const msToReady = Math.round(readyTimeRef.current - mountTimeRef.current);
      logTourEvent("welcome_ready", { msToReady });
    },
  });

  // Calculate dynamic logo size L = clamp(150px, 0.20*H, 240px)
  const logoSize = calculateLogoSize(viewport.height);

  // ── 3. Measure Resting Slot Offset (FLIP Geometry) ─────────────────────────
  const updateGeometry = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setViewport({ width: vw, height: vh });

    if (slotRef.current) {
      const rect = slotRef.current.getBoundingClientRect();
      const slotCenterX = rect.left + rect.width / 2;
      const slotCenterY = rect.top + rect.height / 2;
      const vpCenterX = vw / 2;
      const vpCenterY = vh / 2;

      const dx = slotCenterX - vpCenterX;
      const dy = slotCenterY - vpCenterY;

      if (Number.isFinite(dx) && Number.isFinite(dy)) {
        setSlotOffset({ x: dx, y: dy });
      }
    } else {
      const targetY = vh * FINAL_LAYOUT.logoCenter;
      setSlotOffset({ x: 0, y: targetY - vh / 2 });
    }
  }, []);

  useEffect(() => {
    updateGeometry();
    window.addEventListener("resize", updateGeometry);
    return () => window.removeEventListener("resize", updateGeometry);
  }, [updateGeometry]);

  useEffect(() => {
    if (!slotRef.current || typeof ResizeObserver === "undefined") {
      return;
    }
    const ro = new ResizeObserver(updateGeometry);
    ro.observe(slotRef.current);
    return () => ro.disconnect();
  }, [updateGeometry]);

  // ── 4. Initial Mount Analytics ────────────────────────────────────────────
  useEffect(() => {
    mountTimeRef.current = performance.now();
    logTourEvent("welcome_view", { replay: Boolean(isReplay) });
  }, [isReplay]);

  // ── 5. Instant Jump-To-End on Click or Keypress ───────────────────────────
  const handleSceneClickOrKey = useCallback(
    (e: React.MouseEvent | KeyboardEvent) => {
      if (timeRef.current >= WELCOME_CONFIG.welcome.actionsStart || isExiting) {
        return;
      }
      // Guard against bleed-through clicks right as scene mounts
      if (performance.now() - mountTimeRef.current < 250) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      const atMs = Math.round(timeRef.current * 1000);
      logTourEvent("welcome_fastforward", { atMs });
      skipToEnd();
    },
    [isExiting, skipToEnd, timeRef]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e as unknown as { __tourSynthetic?: boolean }).__tourSynthetic ||
        e.key === "Escape" ||
        e.key === "Tab" ||
        e.key === "Shift"
      ) {
        return;
      }
      // Guard against synthetic/opening key bleed-through
      if (performance.now() - mountTimeRef.current < 250) {
        return;
      }
      if (timeRef.current < WELCOME_CONFIG.welcome.actionsStart) {
        handleSceneClickOrKey(e);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSceneClickOrKey, timeRef]);

  // ── 6. Handoff Flight into App Sidebar (ENTER Phase) ───────────────────────
  const handleStart = useCallback(() => {
    if (isExiting || isHandoffRunningRef.current) {
      return;
    }

    playTourSound("confirm");

    const msSinceReady =
      readyTimeRef.current > 0
        ? Math.round(performance.now() - readyTimeRef.current)
        : 0;
    logTourEvent("welcome_start", { msSinceReady });

    setIsExiting(true);
    pause(); // Freeze floating idle & canvas loop

    if (propReducedMotion) {
      onStart();
      return;
    }

    const targetEl = document.querySelector<HTMLElement>(
      "[data-tour-logo-target]"
    );
    const logoEl = logoContainerRef.current;
    const contentEl = contentStackRef.current;
    const containerEl = containerRef.current;

    const targetRect = targetEl?.getBoundingClientRect();
    const isTargetValid = Boolean(
      targetEl &&
        targetRect &&
        targetRect.width > 4 &&
        targetRect.height > 4 &&
        targetRect.right > 0 &&
        targetRect.bottom > 0
    );

    // Fallback: zoom-and-fade exit if sidebar target is missing/collapsed/mobile
    if (!(isTargetValid && logoEl && targetRect)) {
      setTimeout(() => {
        onStart();
      }, EXIT_ON_START_DELAY_MS);
      return;
    }

    // Target is valid: Execute exact Handoff Flight
    isHandoffRunningRef.current = true;

    const slotRect = logoEl.getBoundingClientRect();
    const startCenterX = slotRect.left + slotRect.width / 2;
    const startCenterY = slotRect.top + slotRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const dx = targetCenterX - startCenterX;
    const dy = targetCenterY - startCenterY;

    const isMobile = viewport.width < 640;
    const peakTileSize = isMobile
      ? MOBILE_RASTER_TILE_PX
      : DESKTOP_RASTER_TILE_PX;
    const startScale = 1 / RASTER_SCALE;
    const targetScale = targetRect.width / peakTileSize;

    // Hide real sidebar logo during flight
    document.documentElement.setAttribute("data-tour-logo-flying", "true");

    const duration = HANDOFF_DURATION_MS;
    const startTime = performance.now();
    let hasCalledOnStart = false;

    const ease = createCubicBezier(0.22, 1, 0.36, 1);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ep = ease(progress);

      const currX = slotOffset.x + dx * ep;
      const currY = slotOffset.y + dy * ep;
      const currScale = startScale + (targetScale - startScale) * ep;

      logoEl.style.transform = `translate3d(${currX.toFixed(2)}px, ${currY.toFixed(2)}px, 0px) scale(${currScale.toFixed(4)})`;

      if (contentEl) {
        contentEl.style.opacity = String(Math.max(0, 1 - progress * 2.2));
      }
      if (containerEl) {
        containerEl.style.opacity = String(Math.max(0, 1 - progress * 1.5));
      }

      // Call onStart() at 300ms so Step 1 spotlight mounts under flight
      if (!hasCalledOnStart && elapsed >= HANDOFF_ON_START_DELAY_MS) {
        hasCalledOnStart = true;
        onStart();
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        if (!hasCalledOnStart) {
          hasCalledOnStart = true;
          onStart();
        }

        // Restore real sidebar logo
        document.documentElement.removeAttribute("data-tour-logo-flying");

        if (containerEl) {
          containerEl.style.opacity = "0";
        }
      }
    };

    requestAnimationFrame(step);
  }, [isExiting, pause, propReducedMotion, onStart, viewport, slotOffset]);

  // ── 7. Skip Action ────────────────────────────────────────────────────────
  const handleSkip = useCallback(() => {
    if (isExiting || isHandoffRunningRef.current) {
      return;
    }

    const phase =
      timeRef.current < WELCOME_CONFIG.welcome.actionsStart ? "intro" : "ready";
    const atMs = Math.round(timeRef.current * 1000);
    logTourEvent("welcome_skip", { phase, atMs });

    if (onOpenSkipDialog) {
      onOpenSkipDialog();
      return;
    }

    setIsExiting(true);
    setTimeout(() => {
      onSkip();
    }, 160);
  }, [isExiting, onOpenSkipDialog, onSkip, timeRef]);

  return (
    <div
      aria-label={`${greetingText} to ${WELCOME_STRINGS.appName}`}
      aria-modal="true"
      className="fixed inset-0 select-none overflow-hidden flex flex-col items-center justify-center pointer-events-auto transition-opacity"
      onClick={handleSceneClickOrKey}
      ref={containerRef}
      role="dialog"
      style={{
        zIndex: 9995,
        backgroundColor: DESIGN_TOKENS.bg,
        contain: "layout paint",
        opacity: isExiting ? 0 : 1,
      }}
    >
      {/* ── Background: Deep Navy Base (#05070D) with Soft Radial Lift & Vignette ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, #0B101E 0%, ${DESIGN_TOKENS.bg} 72%)`,
          opacity: 0.95,
        }}
      />

      {/* ── Static Film Grain (1.5% static grain overlay) ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.015,
          mixBlendMode: "overlay",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Layer 2: Real WebGL 3D GPU Stage (Frames 2, 4, 5-top) ── */}
      <WelcomeWebGLStage
        onProjectedQuads={(quads) => {
          webglQuadsRef.current = quads;
        }}
        reducedMotion={propReducedMotion}
        registerFrameCallback={registerFrameCallback}
        tier={tier}
      />

      {/* ── Layer 3: Unified Canvas 2D Glass & Silk Engine with Warped DOM Content (Frame 3) ── */}
      <UnifiedCanvas
        reducedMotion={propReducedMotion}
        registerFrameCallback={registerFrameCallback}
        tier={tier}
        webglQuadsRef={webglQuadsRef}
      />

      {/* ── Layer 2: Singularity (Point of Light, Crosshairs & Anamorphic Flare) ── */}
      <Singularity
        contentHeight={viewport.height}
        originX={viewport.width / 2}
        originY={viewport.height / 2}
        reducedMotion={propReducedMotion}
        registerFrameCallback={registerFrameCallback}
        tier={tier}
      />

      {/* ── Layer 3: Marshell Logo Tile (Center Bloom -> Upper Glide) ── */}
      <LogoTile
        logoContainerRef={logoContainerRef}
        logoSize={logoSize}
        reducedMotion={propReducedMotion}
        registerFrameCallback={registerFrameCallback}
        slotOffset={slotOffset}
        tier={tier}
        viewport={viewport}
      />

      {/* ── Layer 4: Final Layout Centered Stack (Storyboard Frame 5: 26/47/59/73/85/94%) ── */}
      <div
        className="absolute inset-0 pointer-events-none z-20 select-none transition-opacity"
        ref={contentStackRef}
      >
        {/* Measured Logo Slot Anchor (Exact Center: 0.26 H) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
          ref={slotRef}
          style={{
            top: `${(FINAL_LAYOUT.logoCenter * 100).toFixed(1)}%`,
            width: logoSize,
            height: logoSize,
          }}
        />

        {/* Script "Welcome" SVG (Exact Center: 0.47 H) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none w-full"
          style={{
            top: `${(FINAL_LAYOUT.welcomeCenter * 100).toFixed(1)}%`,
          }}
        >
          <WelcomeHeadline
            logoSize={logoSize}
            part="welcome"
            reducedMotion={propReducedMotion}
            registerFrameCallback={registerFrameCallback}
            tier={tier}
          />
        </div>

        {/* "MARSHELL" Display Letters (Exact Center: 0.59 H) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none w-full"
          style={{
            top: `${(FINAL_LAYOUT.marshellCenter * 100).toFixed(1)}%`,
          }}
        >
          <WelcomeHeadline
            logoSize={logoSize}
            part="marshell"
            reducedMotion={propReducedMotion}
            registerFrameCallback={registerFrameCallback}
            tier={tier}
          />
        </div>

        {/* Primary CTA Button ("Start the tour ->", Exact Center: 0.73 H) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-auto w-full"
          style={{
            top: `${(FINAL_LAYOUT.buttonCenter * 100).toFixed(1)}%`,
          }}
        >
          <WelcomeActions
            contentHeight={viewport.height}
            logoSize={logoSize}
            onStart={handleStart}
            part="button"
            reducedMotion={propReducedMotion}
            registerFrameCallback={registerFrameCallback}
            tier={tier}
          />
        </div>

        {/* Secondary "Skip for now" Link (Exact Center: 0.85 H) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-auto w-full"
          style={{
            top: `${(FINAL_LAYOUT.skipCenter * 100).toFixed(1)}%`,
          }}
        >
          <WelcomeActions
            contentHeight={viewport.height}
            onSkip={handleSkip}
            part="skip"
            reducedMotion={propReducedMotion}
            registerFrameCallback={registerFrameCallback}
            tier={tier}
          />
        </div>

        {/* Explanatory Footer Line (Exact Center: 0.94 H, Strictly One Line) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none w-full"
          style={{
            top: `${(FINAL_LAYOUT.footerCenter * 100).toFixed(1)}%`,
          }}
        >
          <WelcomeActions
            contentHeight={viewport.height}
            logoSize={logoSize}
            part="footer"
            reducedMotion={propReducedMotion}
            registerFrameCallback={registerFrameCallback}
            tier={tier}
          />
        </div>
      </div>

      {/* ── Dev Tooling: Storyboard Scrubber (Ctrl+Shift+D or ?welcomeDebug=1) ── */}
      <DevScrubber
        isPlaying={isPlaying}
        onPause={pause}
        onPlay={play}
        onSeek={seek}
        timeRef={timeRef}
      />
    </div>
  );
}
