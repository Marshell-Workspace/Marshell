/**
 * engine.ts — Single-Clock Imperative Render Engine for Marshell Welcome Scene (Revision 4).
 *
 * Architecture Guarantees:
 * 1. ONE rAF loop owning ONE clock t (ms).
 * 2. Pure function render(t) writes directly to DOM refs and canvas (zero React per frame).
 * 3. Start-once guarantee: module-level counter activeEngineCount, immune to React StrictMode.
 * 4. Finite: when t reaches totalTimelineMs, loop stops and writes exact identity resting state.
 * 5. Logo DOF without animated blur: 3 stacked static tiles (sharp, mid-blur, heavy-blur) crossfading opacity.
 * 6. Wordmark blur-in without dynamic filters: static pre-blurred copy crossfades out as sharp letters rise.
 * 7. Quality governor: checks first 90 frames; if avg > 20ms, switches to LITE mode.
 */

import { playTourSound } from "../sound";
import { flightPose } from "./flight-path";
import {
  getPenLightPoint,
  SACRAMENTO_COVERAGE_STROKES,
} from "./greeting-paths";
import {
  ATMOSPHERE,
  DESKTOP_LOGO_SIZE,
  DESKTOP_RASTER_TILE_PX,
  FAST_FORWARD_DURATION_SEC,
  GOD_RAYS,
  MOBILE_LOGO_SIZE,
  MOBILE_RASTER_TILE_PX,
  ORBIT_TRAIL,
  PEN_LIGHT,
  type QualityTier,
  REPLAY_SPEED_FACTOR,
  WELCOME_TIMINGS,
} from "./welcome.config";

export interface EngineElements {
  backdropDolly?: HTMLDivElement | null;
  canvas: HTMLCanvasElement | null;
  ctaContainer: HTMLDivElement | null;
  dimTileRef?: HTMLDivElement | null;
  footerContainer: HTMLDivElement | null;
  glyphGlowRef?: HTMLDivElement | null;
  godRays: HTMLDivElement | null;
  greetingInkMask: SVGElement | null;
  greetingMaskRect: SVGElement | null;
  greetingStrokes?: (SVGPathElement | null)[];
  greetingTextSharp?: SVGElement | null;
  greetingTextStaticGlow: SVGElement | null;
  logoContainer: HTMLDivElement | null;
  logoHeavyBlurTile?: HTMLDivElement | null;
  logoMidBlurTile?: HTMLDivElement | null;
  logoSharpTile: HTMLDivElement | null;
  penDotG?: SVGGElement | null;
  penDotInner?: SVGCircleElement | null;
  penDotOuter?: SVGCircleElement | null;
  shockwaveRing?: HTMLDivElement | null;
  subtitle: HTMLElement | null;
  wordmarkBlurLayer: HTMLElement | null;
  wordmarkLetters: HTMLElement[];
}

export interface EngineConfig {
  elements: EngineElements;
  isReplay?: boolean;
  onFpsReport?: (report: FpsReport) => void;
  onLanded?: () => void;
  onReady: () => void;
  quality?: QualityTier;
  reducedMotion?: boolean;
  slotOffset: { x: number; y: number };
  tier: "performance" | "balanced" | "eco";
  viewport: { width: number; height: number };
}

export interface FpsReport {
  activeEngineCount: number;
  avgFrameTimeMs: number;
  framesOver20ms: number;
  framesOver33ms: number;
  maxFrameTimeMs: number;
  p95FrameTimeMs: number;
  phaseMetrics: Record<
    string,
    { avg: number; count: number; max: number; p95: number }
  >;
  totalFrames: number;
}

// Module-level active engine counter for dev assertion
let activeEngineCount = 0;
let activeInstance: WelcomeEngine | null = null;

export function getActiveEngineCount(): number {
  return activeEngineCount;
}

export function resetActiveEngineCount(): void {
  activeEngineCount = 0;
  activeInstance = null;
}

interface Particle {
  alpha: number;
  baseAlpha: number;
  baseSize: number;
  depth: number;
  initialTwinklePhase: number;
  initialX: number;
  initialY: number;
  isBokeh?: boolean;
  speedX: number;
  speedY: number;
  twinklePhase: number;
  twinkleSpeed: number;
  x: number;
  y: number;
}

export class WelcomeEngine {
  private rafId = 0;
  private startTime = 0;
  private pausedTime = 0;
  private isPaused = false;
  private isDestroyed = false;
  private isFastForwarding = false;
  private ffStartTime = 0;
  private ffStartT = 0;

  private t = 0;
  private hasReportedLanded = false;
  private hasReportedReady = false;
  private hasPlayedIgniteSound = false;

  private readonly config: EngineConfig;
  private activeQuality: "full" | "lite";
  private particles: Particle[] = [];
  private spriteSharp: HTMLCanvasElement | null = null;
  private spriteBokeh: HTMLCanvasElement | null = null;

  // Frame profiling
  private readonly frameTimes: number[] = [];
  private readonly phaseFrameTimes: Record<string, number[]> = {
    emergence: [],
    orbit: [],
    flyby: [],
    descent: [],
    greeting: [],
    wordmark: [],
    settle: [],
  };

  constructor(config: EngineConfig) {
    this.config = config;
    if (activeInstance && !activeInstance.isDestroyed) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          `[WelcomeEngine] Another engine was already active (${activeEngineCount}). Forcing destruction of previous instance.`
        );
      }
      activeInstance.destroy();
    }
    activeInstance = this;
    activeEngineCount++;

    const isEco = config.tier === "eco" || config.reducedMotion;
    this.activeQuality = config.quality === "lite" || isEco ? "lite" : "full";

    this.initCanvasSprites();
    this.initParticles();
    this.bindVisibility();
  }

  private bindVisibility() {
    if (typeof document === "undefined") {
      return;
    }
    const handleVisibility = () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
  }

  private initCanvasSprites() {
    if (typeof document === "undefined") {
      return;
    }
    try {
      const sCanvas = document.createElement("canvas");
      sCanvas.width = 16;
      sCanvas.height = 16;
      const sCtx = sCanvas.getContext?.("2d");
      if (sCtx) {
        sCtx.fillStyle = "#ffffff";
        sCtx.beginPath();
        sCtx.arc(8, 8, 7, 0, Math.PI * 2);
        sCtx.fill();
        this.spriteSharp = sCanvas;
      }
    } catch {
      // Headless / jsdom fallback
    }

    if (this.activeQuality === "full") {
      try {
        const bCanvas = document.createElement("canvas");
        bCanvas.width = 64;
        bCanvas.height = 64;
        const bCtx = bCanvas.getContext?.("2d");
        if (bCtx) {
          const grad = bCtx.createRadialGradient(32, 32, 0, 32, 32, 30);
          grad.addColorStop(0, "rgba(147, 197, 253, 0.4)");
          grad.addColorStop(0.5, "rgba(59, 130, 246, 0.15)");
          grad.addColorStop(1, "rgba(37, 99, 235, 0)");
          bCtx.fillStyle = grad;
          bCtx.beginPath();
          bCtx.arc(32, 32, 30, 0, Math.PI * 2);
          bCtx.fill();
          this.spriteBokeh = bCanvas;
        }
      } catch {
        // Headless / jsdom fallback
      }
    }
  }

  private initParticles() {
    const { viewport, tier } = this.config;
    const count =
      this.activeQuality === "lite"
        ? 40
        : ATMOSPHERE.dustParticleCount[tier] || 120;
    this.particles = [];

    for (let i = 0; i < count; i++) {
      const depth = (i % 3) + 1;
      const baseAlpha = 0.15 + Math.random() * 0.45;
      const initialX = Math.random() * viewport.width;
      const initialY = Math.random() * viewport.height;
      const twinklePhase = Math.random() * Math.PI * 2;
      this.particles.push({
        x: initialX,
        y: initialY,
        initialX,
        initialY,
        depth,
        baseSize:
          depth === 3 ? 1.8 + Math.random() * 1.2 : 0.8 + Math.random() * 0.8,
        baseAlpha,
        alpha: baseAlpha,
        speedX: (Math.random() - 0.48) * 0.18 * depth,
        speedY: -(0.08 + Math.random() * 0.18) * depth,
        initialTwinklePhase: twinklePhase,
        twinklePhase,
        twinkleSpeed: 0.02 + Math.random() * 0.04,
      });
    }

    if (this.activeQuality === "full") {
      for (let i = 0; i < ATMOSPHERE.bokehCount; i++) {
        const initialX = Math.random() * viewport.width;
        const initialY = Math.random() * viewport.height;
        const twinklePhase = Math.random() * Math.PI * 2;
        this.particles.push({
          x: initialX,
          y: initialY,
          initialX,
          initialY,
          depth: 4,
          isBokeh: true,
          baseSize: 18 + Math.random() * 26,
          baseAlpha: 0.04 + Math.random() * 0.06,
          alpha: 0.05,
          speedX: (Math.random() - 0.5) * 0.25,
          speedY: -(0.15 + Math.random() * 0.3),
          initialTwinklePhase: twinklePhase,
          twinklePhase,
          twinkleSpeed: 0.015,
        });
      }
    }
  }

  start() {
    if (this.isDestroyed) {
      return;
    }
    this.startTime = performance.now();
    this.loop(this.startTime);
  }

  pause() {
    if (this.isPaused) {
      return;
    }
    this.isPaused = true;
    this.pausedTime = performance.now();
    cancelAnimationFrame(this.rafId);
  }

  resume() {
    if (!this.isPaused || this.isDestroyed) {
      return;
    }
    this.isPaused = false;
    const pauseDuration = performance.now() - this.pausedTime;
    this.startTime += pauseDuration;
    this.loop(performance.now());
  }

  fastForward() {
    if (this.isFastForwarding || this.hasReportedReady) {
      return;
    }
    this.isFastForwarding = true;
    this.ffStartTime = performance.now();
    this.ffStartT = this.t;
  }

  setTime(tMs: number) {
    const totalMs = this.getTotalTimelineMs();
    this.t = Math.max(0, Math.min(totalMs, tMs));
    if (this.t >= totalMs) {
      this.finish();
    } else {
      this.render(this.t);
    }
  }

  getTime(): number {
    return this.t;
  }

  restart() {
    this.t = 0;
    this.startTime = performance.now();
    this.hasReportedLanded = false;
    this.hasReportedReady = false;
    this.hasPlayedIgniteSound = false;
    this.isFastForwarding = false;
    this.isPaused = false;
    cancelAnimationFrame(this.rafId);
    this.loop(this.startTime);
  }

  isComplete(): boolean {
    return this.hasReportedReady;
  }

  updateSlotOffset(offset: { x: number; y: number }) {
    this.config.slotOffset = offset;
  }

  updateViewport(vp: { width: number; height: number }) {
    this.config.viewport = vp;
  }

  private getTotalTimelineMs(): number {
    const speed = this.config.isReplay ? REPLAY_SPEED_FACTOR : 1.0;
    return WELCOME_TIMINGS.totalTimelineMs * speed;
  }

  private readonly loop = (now: number) => {
    if (this.isDestroyed || this.isPaused) {
      return;
    }

    const totalMs = this.getTotalTimelineMs();
    let currentT = 0;

    if (this.isFastForwarding) {
      const elapsed = (now - this.ffStartTime) / 1000;
      const duration = FAST_FORWARD_DURATION_SEC;
      const progress = Math.min(1, elapsed / duration);
      // Critically damped ease-out: 1 - (1 + 2*p) * exp(-2*p)
      const ease = 1 - Math.exp(-3.5 * progress);
      currentT = this.ffStartT + (totalMs - this.ffStartT) * ease;
      if (progress >= 1) {
        currentT = totalMs;
      }
    } else {
      currentT = now - this.startTime;
    }

    this.t = Math.min(totalMs, currentT);

    // Profile frame
    if (process.env.NODE_ENV !== "production") {
      this.profileFrame(now);
    }

    // Adaptive Quality Governor (over first 90 frames)
    if (this.config.quality === "auto" && this.frameTimes.length === 90) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / 90;
      if (avg > 20) {
        this.activeQuality = "lite";
      }
    }

    this.render(this.t);

    const landedMs =
      (WELCOME_TIMINGS.logoRiseStartMs + WELCOME_TIMINGS.logoRiseDurationMs) *
      (this.config.isReplay ? REPLAY_SPEED_FACTOR : 1.0);
    if (this.t >= landedMs && !this.hasReportedLanded) {
      this.hasReportedLanded = true;
      this.config.onLanded?.();
    }

    if (this.t >= totalMs) {
      this.finish();
      return;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private profileFrame(now: number) {
    if (this.frameTimes.length > 0) {
      const dt = now - (this.frameTimes.at(-1) ?? now);
      if (dt > 0 && dt < 200) {
        this.frameTimes.push(dt);
        const phase = this.getPhaseName(this.t);
        this.phaseFrameTimes[phase]?.push(dt);
      }
    } else {
      this.frameTimes.push(16.6);
    }
  }

  private getPhaseName(t: number): string {
    const speed = this.config.isReplay ? REPLAY_SPEED_FACTOR : 1.0;
    if (t < WELCOME_TIMINGS.logoRiseStartMs * speed) {
      return "emergence";
    }
    if (t < WELCOME_TIMINGS.powerOnStartMs * speed) {
      return "rise";
    }
    if (t < WELCOME_TIMINGS.glyphGlowStartMs * speed) {
      return "power-on";
    }
    if (t < WELCOME_TIMINGS.greetingStartMs * speed) {
      return "glow-pulse";
    }
    if (t < WELCOME_TIMINGS.wordmarkStartMs * speed) {
      return "greeting";
    }
    if (t < WELCOME_TIMINGS.subtitleStartMs * speed) {
      return "wordmark";
    }
    if (t < WELCOME_TIMINGS.ctaStartMs * speed) {
      return "subtitle";
    }
    return "settle";
  }

  /**
   * PURE IMPERATIVE RENDER: Writes directly to DOM refs and canvas.
   * Zero React state, zero Framer Motion values, zero dynamic CSS filters.
   */
  render(t: number) {
    const { elements, viewport, tier, isReplay, slotOffset } = this.config;
    const isMobile = viewport.width < 640;
    const speed = isReplay ? REPLAY_SPEED_FACTOR : 1.0;

    const slotSize = isMobile ? MOBILE_LOGO_SIZE : DESKTOP_LOGO_SIZE;
    const peakTileSize = isMobile
      ? MOBILE_RASTER_TILE_PX
      : DESKTOP_RASTER_TILE_PX;
    const baseScale = slotSize / peakTileSize; // e.g. 112 / 336 = 1/3

    const totalMs = WELCOME_TIMINGS.totalTimelineMs * speed;
    const u = totalMs > 0 ? Math.min(1, Math.max(0, t / totalMs)) : 1;

    const riseStart = WELCOME_TIMINGS.logoRiseStartMs * speed;
    const riseDuration = WELCOME_TIMINGS.logoRiseDurationMs * speed;
    const powerStart = WELCOME_TIMINGS.powerOnStartMs * speed;
    const powerDuration = WELCOME_TIMINGS.powerOnDurationMs * speed;
    const glowStart = WELCOME_TIMINGS.glyphGlowStartMs * speed;
    const glowDuration = WELCOME_TIMINGS.glyphGlowDurationMs * speed;

    // ── 1. Logo Slot Rise & Transform (Transform & Opacity Only) ──────────────
    if (elements.logoContainer) {
      if (t < riseStart) {
        elements.logoContainer.style.transform = `translate3d(${slotOffset.x}px, ${slotOffset.y + 36}px, 0px) scale(${baseScale})`;
        elements.logoContainer.style.opacity = "0";
      } else if (t < riseStart + riseDuration) {
        const rp = (t - riseStart) / riseDuration;
        const ease = 1 - (1 - rp) ** 3;
        const currY = slotOffset.y + (1 - ease) * 36;
        elements.logoContainer.style.transform = `translate3d(${slotOffset.x}px, ${currY.toFixed(2)}px, 0px) scale(${baseScale})`;
        elements.logoContainer.style.opacity = String(Math.min(1, ease * 1.5));
      } else {
        elements.logoContainer.style.transform = `translate3d(${slotOffset.x}px, ${slotOffset.y}px, 0px) scale(${baseScale})`;
        elements.logoContainer.style.opacity = "1";
      }

      // ── Power-On: Lit copy fades in on top over 500ms (~400ms after rise begins) ──
      const litTile = elements.logoSharpTile;
      if (litTile) {
        if (t < powerStart) {
          litTile.style.opacity = "0";
        } else if (t < powerStart + powerDuration) {
          if (!this.hasPlayedIgniteSound) {
            this.hasPlayedIgniteSound = true;
            playTourSound("ignite");
          }
          const lp = (t - powerStart) / powerDuration;
          litTile.style.opacity = String(lp);
        } else {
          if (!this.hasPlayedIgniteSound) {
            this.hasPlayedIgniteSound = true;
            playTourSound("ignite");
          }
          litTile.style.opacity = "1";
        }
      }

      // ── One Soft Accent Glow Pulse centered on '>_' glyph (opacity only) ──
      const glyphGlow = elements.glyphGlowRef;
      if (glyphGlow) {
        if (t >= glowStart && t <= glowStart + glowDuration) {
          const gp = (t - glowStart) / glowDuration;
          const pulse = Math.sin(gp * Math.PI) * 0.75;
          glyphGlow.style.opacity = String(pulse);
        } else {
          glyphGlow.style.opacity = "0";
        }
      }
    }

    // ── 2. Rotating God Rays (Static Pre-Blurred Layer) ──────────────────────
    if (elements.godRays) {
      const rot = (t / 1000) * (360 / 120);
      const rayOpacity =
        GOD_RAYS.baseOpacity +
        (GOD_RAYS.peakOpacity - GOD_RAYS.baseOpacity) * 0.5;
      elements.godRays.style.transform = `rotate(${rot}deg)`;
      elements.godRays.style.opacity = String(rayOpacity);
    }

    // ── 3b. Backdrop Dolly Scale ─────────────────────────────────────────────
    if (elements.backdropDolly) {
      const dollyScale =
        this.config.reducedMotion || tier === "eco"
          ? 1.0
          : ATMOSPHERE.dollyStartScale +
            (ATMOSPHERE.dollyEndScale - ATMOSPHERE.dollyStartScale) * u;
      elements.backdropDolly.style.transform = `scale(${dollyScale})`;
    }

    // ── 4. Backdrop Canvas Render ───────────────────────────────────────────
    this.renderCanvas(u, t);

    // ── 5. Cursive "Welcome" Reveal (Method 1 Masked Ink) ────────────────────
    const greetingStart = WELCOME_TIMINGS.greetingStartMs * speed;
    const greetingDuration = WELCOME_TIMINGS.greetingDurationMs * speed;
    if (elements.greetingInkMask) {
      if (t < greetingStart) {
        elements.greetingInkMask.style.opacity = "0";
      } else {
        const gProgress = Math.min(1, (t - greetingStart) / greetingDuration);
        elements.greetingInkMask.style.opacity = "1";

        // Update stroke dash offsets
        if (elements.greetingStrokes) {
          for (let i = 0; i < SACRAMENTO_COVERAGE_STROKES.length; i++) {
            const stroke = SACRAMENTO_COVERAGE_STROKES[i];
            const strokeEl = elements.greetingStrokes[i];
            if (stroke && strokeEl) {
              const sStart =
                greetingStart + stroke.fraction[0] * greetingDuration;
              const sEnd =
                greetingStart + stroke.fraction[1] * greetingDuration;
              if (t <= sStart) {
                const lenStr = String(stroke.estimatedLength);
                strokeEl.style.strokeDashoffset = lenStr;
                strokeEl.style.setProperty("stroke-dashoffset", lenStr);
                strokeEl.setAttribute("stroke-dashoffset", lenStr);
              } else if (t >= sEnd) {
                strokeEl.style.strokeDashoffset = "0";
                strokeEl.style.setProperty("stroke-dashoffset", "0");
                strokeEl.setAttribute("stroke-dashoffset", "0");
              } else {
                const p = (t - sStart) / (sEnd - sStart);
                const ease = p * p * (3 - 2 * p);
                const valStr = String(stroke.estimatedLength * (1 - ease));
                strokeEl.style.strokeDashoffset = valStr;
                strokeEl.style.setProperty("stroke-dashoffset", valStr);
                strokeEl.setAttribute("stroke-dashoffset", valStr);
              }
            }
          }
        }

        // Pen light tracker
        if (elements.penDotG && elements.penDotOuter && elements.penDotInner) {
          if (
            !PEN_LIGHT ||
            tier === "eco" ||
            this.config.reducedMotion ||
            gProgress <= 0 ||
            gProgress >= 1
          ) {
            elements.penDotG.style.display = "none";
          } else {
            elements.penDotG.style.display = "inline";
            const pt = getPenLightPoint(gProgress);
            elements.penDotOuter.setAttribute("cx", String(pt.x));
            elements.penDotOuter.setAttribute("cy", String(pt.y));
            elements.penDotInner.setAttribute("cx", String(pt.x));
            elements.penDotInner.setAttribute("cy", String(pt.y));
          }
        }

        // Update mask rect fade at end of sequence
        if (elements.greetingMaskRect) {
          const safetyFade =
            gProgress >= 0.95 ? Math.min(1, (gProgress - 0.95) / 0.05) : 0;
          elements.greetingMaskRect.style.opacity = String(safetyFade);
        }
        if (elements.greetingTextStaticGlow) {
          elements.greetingTextStaticGlow.style.opacity = String(
            Math.min(0.38, gProgress * 0.38)
          );
        }
      }
    }

    // ── 6. Wordmark Per-Letter Mask Rise ────────────────────────────────────
    const wmStart = WELCOME_TIMINGS.wordmarkStartMs * speed;
    const wmStagger = WELCOME_TIMINGS.wordmarkLetterStaggerMs * speed;
    const wmDuration = WELCOME_TIMINGS.wordmarkLetterDurationMs * speed;

    if (elements.wordmarkLetters.length > 0) {
      for (let i = 0; i < elements.wordmarkLetters.length; i++) {
        const letterEl = elements.wordmarkLetters[i];
        if (!letterEl) {
          continue;
        }
        const letterStart = wmStart + i * wmStagger;
        if (t < letterStart) {
          letterEl.style.transform = "translateY(105%) scale(0.96)";
          letterEl.style.opacity = "0";
        } else {
          const lp = Math.min(1, (t - letterStart) / wmDuration);
          // Quintic ease-out: 1 - (1 - lp)^4
          const ease = 1 - (1 - lp) ** 4;
          letterEl.style.transform = `translateY(${(1 - ease) * 105}%) scale(${0.96 + 0.04 * ease})`;
          letterEl.style.opacity = String(ease);
        }
      }

      // Pre-blurred wordmark crossfade
      if (elements.wordmarkBlurLayer) {
        if (t < wmStart) {
          elements.wordmarkBlurLayer.style.opacity = "0";
        } else {
          const wp = Math.min(1, (t - wmStart) / (wmDuration * 0.8));
          elements.wordmarkBlurLayer.style.opacity = String(0.35 * (1 - wp));
        }
      }
    }

    // ── 7. Subtitle Fade-Up ─────────────────────────────────────────────────
    const subStart = WELCOME_TIMINGS.subtitleStartMs * speed;
    const subDuration = WELCOME_TIMINGS.subtitleDurationMs * speed;
    if (elements.subtitle) {
      if (t < subStart) {
        elements.subtitle.style.opacity = "0";
        elements.subtitle.style.transform = "translateY(8px)";
      } else {
        const sp = Math.min(1, (t - subStart) / subDuration);
        const ease = 1 - (1 - sp) ** 3;
        elements.subtitle.style.opacity = String(ease);
        elements.subtitle.style.transform = `translateY(${(1 - ease) * 8}px)`;
      }
    }

    // ── 8. CTA Materialize ──────────────────────────────────────────────────
    const ctaStart = WELCOME_TIMINGS.ctaStartMs * speed;
    const ctaDuration = WELCOME_TIMINGS.ctaDurationMs * speed;
    if (elements.ctaContainer) {
      if (t < ctaStart) {
        elements.ctaContainer.style.opacity = "0";
        elements.ctaContainer.style.transform = "translateY(10px) scale(0.96)";
      } else {
        const cp = Math.min(1, (t - ctaStart) / ctaDuration);
        const ease = 1 - (1 - cp) ** 3;
        elements.ctaContainer.style.opacity = String(ease);
        elements.ctaContainer.style.transform = `translateY(${(1 - ease) * 10}px) scale(${0.96 + 0.04 * ease})`;
      }
    }

    // ── 9. Skip Link & Footer ───────────────────────────────────────────────
    const footStart = WELCOME_TIMINGS.skipFooterStartMs * speed;
    if (elements.footerContainer) {
      if (t < footStart) {
        elements.footerContainer.style.opacity = "0";
      } else {
        const fp = Math.min(1, (t - footStart) / (250 * speed));
        elements.footerContainer.style.opacity = String(fp * 0.8);
      }
    }
  }

  private renderCanvas(u: number, t: number) {
    const { canvas } = this.config.elements;
    if (!canvas) {
      return;
    }

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext?.("2d", { alpha: true }) ?? null;
    } catch {
      return;
    }
    if (!ctx) {
      return;
    }

    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const { viewport, tier, slotOffset } = this.config;
    const p = flightPose(
      u,
      viewport.width,
      viewport.height,
      tier,
      false,
      slotOffset
    );

    // ── Draw Orbit Ribbon (Full Quality Only) ────────────────────────────────
    const ribbonFade = u < 0.9 ? 1.0 : Math.max(0, 1.0 - (u - 0.9) / 0.1);
    if (this.activeQuality === "full" && u > 0.02 && ribbonFade > 0.005) {
      const trailLen = ORBIT_TRAIL.trailLength;
      const samples = ORBIT_TRAIL.sampleCount;
      const trailPoints: Array<{ x: number; y: number; alpha: number }> = [];

      for (let s = samples; s >= 0; s--) {
        const sampleU = Math.max(0, u - (s / samples) * trailLen);
        const sp = flightPose(
          sampleU,
          viewport.width,
          viewport.height,
          tier,
          false,
          slotOffset
        );
        trailPoints.push({
          x: viewport.width / 2 + sp.x,
          y: viewport.height / 2 + sp.y,
          alpha: (1 - s / samples) * (0.45 + p.glow * 0.4) * ribbonFade,
        });
      }

      if (trailPoints.length > 1) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.moveTo(trailPoints[0]!.x, trailPoints[0]!.y);
        for (let i = 1; i < trailPoints.length; i++) {
          ctx.lineTo(trailPoints[i]!.x, trailPoints[i]!.y);
        }
        const last = trailPoints.at(-1)!;
        const first = trailPoints[0]!;
        const grad = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
        grad.addColorStop(0, "rgba(37, 99, 235, 0)");
        grad.addColorStop(0.7, "rgba(59, 130, 246, 0.4)");
        grad.addColorStop(1, "rgba(147, 197, 253, 0.85)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.2 + p.glow * 1.5;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Draw Particles & Embers via Pre-Rendered Sprites (No shadowBlur, Deterministic) ─────
    if (this.spriteSharp) {
      const frameIndex = t / 16.667;
      for (const pt of this.particles) {
        const rawX = pt.initialX + pt.speedX * frameIndex;
        const rawY = pt.initialY + pt.speedY * frameIndex;
        const totalW = viewport.width + 40;
        const totalH = viewport.height + 40;
        const posX = (((rawX % totalW) + totalW) % totalW) - 20;
        const posY = (((rawY % totalH) + totalH) % totalH) - 20;

        const twinkle =
          Math.sin(pt.initialTwinklePhase + pt.twinkleSpeed * frameIndex) *
            0.35 +
          0.65;
        const alpha = pt.baseAlpha * twinkle;

        if (pt.isBokeh && this.spriteBokeh) {
          ctx.globalAlpha = alpha;
          const rad = pt.baseSize * 1.5;
          ctx.drawImage(
            this.spriteBokeh,
            posX - rad,
            posY - rad,
            rad * 2,
            rad * 2
          );
        } else {
          ctx.globalAlpha = alpha;
          const sz = pt.baseSize;
          ctx.drawImage(this.spriteSharp, posX - sz, posY - sz, sz * 2, sz * 2);
        }
      }
    }

    ctx.restore();
  }

  private finish() {
    const totalMs = this.getTotalTimelineMs();
    this.t = totalMs;
    this.render(this.t);
    cancelAnimationFrame(this.rafId);

    const { elements, slotOffset, viewport } = this.config;
    const isMobile = viewport.width < 640;
    const slotSize = isMobile ? MOBILE_LOGO_SIZE : DESKTOP_LOGO_SIZE;
    const peakTileSize = isMobile
      ? MOBILE_RASTER_TILE_PX
      : DESKTOP_RASTER_TILE_PX;
    const baseScale = slotSize / peakTileSize;

    if (elements.logoContainer) {
      elements.logoContainer.style.transform = `translate3d(${slotOffset.x}px, ${slotOffset.y}px, 0px) scale(${baseScale}) rotateX(0deg) rotateY(0deg) rotateZ(0deg)`;
      elements.logoContainer.style.opacity = "1";
    }
    if (elements.logoSharpTile) {
      elements.logoSharpTile.style.opacity = "1";
    }
    if (elements.glyphGlowRef) {
      elements.glyphGlowRef.style.opacity = "0";
    }

    if (elements.greetingStrokes) {
      for (const strokeEl of elements.greetingStrokes) {
        if (strokeEl) {
          strokeEl.style.strokeDashoffset = "0";
          strokeEl.style.setProperty("stroke-dashoffset", "0");
          strokeEl.setAttribute("stroke-dashoffset", "0");
        }
      }
    }
    if (elements.penDotG) {
      elements.penDotG.style.display = "none";
    }
    if (elements.greetingMaskRect) {
      elements.greetingMaskRect.style.opacity = "1";
    }
    if (elements.wordmarkLetters) {
      for (const letterEl of elements.wordmarkLetters) {
        if (letterEl) {
          letterEl.style.opacity = "1";
          letterEl.style.transform = "translateY(0%) scale(1)";
        }
      }
    }
    if (elements.wordmarkBlurLayer) {
      elements.wordmarkBlurLayer.style.opacity = "0";
    }
    if (elements.subtitle) {
      elements.subtitle.style.opacity = "1";
      elements.subtitle.style.transform = "translateY(0px)";
    }
    if (elements.ctaContainer) {
      elements.ctaContainer.style.opacity = "1";
      elements.ctaContainer.style.transform = "translateY(0px) scale(1)";
    }
    if (elements.footerContainer) {
      elements.footerContainer.style.opacity = "0.8";
    }

    if (!this.hasReportedReady) {
      this.hasReportedReady = true;
      this.config.onReady();
      this.reportFps();
    }
  }

  private reportFps() {
    if (process.env.NODE_ENV === "production" || this.frameTimes.length === 0) {
      return;
    }
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const avg =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 16.6;
    const max = sorted.at(-1) || 16.6;
    const over20 = this.frameTimes.filter((d) => d > 20).length;
    const over33 = this.frameTimes.filter((d) => d > 33).length;

    const phaseMetrics: Record<
      string,
      { avg: number; count: number; max: number; p95: number }
    > = {};
    for (const [phase, times] of Object.entries(this.phaseFrameTimes)) {
      if (times.length > 0) {
        const s = [...times].sort((a, b) => a - b);
        phaseMetrics[phase] = {
          count: times.length,
          avg:
            Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) /
            10,
          p95: Math.round((s[Math.floor(s.length * 0.95)] || 0) * 10) / 10,
          max: Math.round((s.at(-1) || 0) * 10) / 10,
        };
      }
    }

    const report: FpsReport = {
      activeEngineCount,
      totalFrames: this.frameTimes.length,
      avgFrameTimeMs: Math.round(avg * 10) / 10,
      p95FrameTimeMs: Math.round(p95 * 10) / 10,
      maxFrameTimeMs: Math.round(max * 10) / 10,
      framesOver20ms: over20,
      framesOver33ms: over33,
      phaseMetrics,
    };

    console.table({
      "Active Engine Count": activeEngineCount,
      "Total Frames": report.totalFrames,
      "Avg Frame Time (ms)": report.avgFrameTimeMs,
      "p95 Frame Time (ms)": report.p95FrameTimeMs,
      "Max Frame Time (ms)": report.maxFrameTimeMs,
      "Frames > 20ms": `${over20} (${((over20 / report.totalFrames) * 100).toFixed(1)}%)`,
      "Frames > 33ms": `${over33} (${((over33 / report.totalFrames) * 100).toFixed(1)}%)`,
    });
    console.table(phaseMetrics);

    this.config.onFpsReport?.(report);
  }

  destroy() {
    if (this.isDestroyed) {
      return;
    }
    this.isDestroyed = true;
    cancelAnimationFrame(this.rafId);
    if (activeInstance === this) {
      activeInstance = null;
    }
    activeEngineCount = Math.max(0, activeEngineCount - 1);
  }
}
