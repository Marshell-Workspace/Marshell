// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type EngineElements,
  getActiveEngineCount,
  resetActiveEngineCount,
  WelcomeEngine,
} from "./engine";
import { flightPose } from "./flight-path";
import {
  DESKTOP_LOGO_SIZE,
  DESKTOP_RASTER_TILE_PX,
  FLYBY_PEAK_Z,
  WELCOME_TIMINGS,
  Z_KEYFRAMES,
} from "./welcome.config";

function createMockElements(): {
  elements: EngineElements;
  domNodes: Record<string, HTMLElement | SVGElement>;
} {
  const logoContainer = document.createElement("div");
  const logoSharpTile = document.createElement("div");
  const logoMidBlurTile = document.createElement("div");
  const logoHeavyBlurTile = document.createElement("div");
  const shockwaveRing = document.createElement("div");
  const backdropDolly = document.createElement("div");
  const godRays = document.createElement("div");
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;

  const greetingInkMask = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g"
  );
  const greetingMaskRect = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect"
  );
  const greetingTextStaticGlow = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text"
  );
  const penDotG = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const penDotOuter = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  const penDotInner = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );

  const greetingStrokes: SVGPathElement[] = [];
  for (let i = 0; i < 12; i++) {
    greetingStrokes.push(
      document.createElementNS("http://www.w3.org/2000/svg", "path")
    );
  }

  const wordmarkBlurLayer = document.createElement("span");
  const wordmarkLetters: HTMLElement[] = [];
  for (let i = 0; i < 8; i++) {
    wordmarkLetters.push(document.createElement("span"));
  }

  const subtitle = document.createElement("p");
  const ctaContainer = document.createElement("div");
  const footerContainer = document.createElement("div");

  const elements: EngineElements = {
    backdropDolly,
    canvas,
    ctaContainer,
    footerContainer,
    godRays,
    greetingInkMask,
    greetingMaskRect,
    greetingStrokes,
    greetingTextSharp: null,
    greetingTextStaticGlow,
    logoContainer,
    logoHeavyBlurTile,
    logoMidBlurTile,
    logoSharpTile,
    penDotG,
    penDotInner,
    penDotOuter,
    shockwaveRing,
    subtitle,
    wordmarkBlurLayer,
    wordmarkLetters,
  };

  return {
    elements,
    domNodes: {
      logoContainer,
      logoSharpTile,
      logoMidBlurTile,
      logoHeavyBlurTile,
      shockwaveRing,
      backdropDolly,
      godRays,
      canvas,
      greetingInkMask,
      greetingMaskRect,
      greetingTextStaticGlow,
      penDotG,
      penDotOuter,
      penDotInner,
      wordmarkBlurLayer,
      subtitle,
      ctaContainer,
      footerContainer,
    },
  };
}

describe("WelcomeEngine Architecture & Invariants (Revision 4)", () => {
  beforeEach(() => {
    resetActiveEngineCount();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    resetActiveEngineCount();
    vi.restoreAllMocks();
  });

  it("Start-once guarantee: mounting twice (StrictMode style) leaves exactly 1 active engine", () => {
    expect(getActiveEngineCount()).toBe(0);

    const { elements: el1 } = createMockElements();
    const onReady1 = vi.fn();
    const _engine1 = new WelcomeEngine({
      elements: el1,
      viewport: { width: 1920, height: 1080 },
      slotOffset: { x: 0, y: -130 },
      tier: "performance",
      quality: "auto",
      onReady: onReady1,
    });

    expect(getActiveEngineCount()).toBe(1);

    // Simulate React StrictMode double-mount without explicit cleanup
    const { elements: el2 } = createMockElements();
    const onReady2 = vi.fn();
    const engine2 = new WelcomeEngine({
      elements: el2,
      viewport: { width: 1920, height: 1080 },
      slotOffset: { x: 0, y: -130 },
      tier: "performance",
      quality: "auto",
      onReady: onReady2,
    });

    // Active engine count remains strictly 1 because engine1 was forced-destroyed
    expect(getActiveEngineCount()).toBe(1);

    engine2.destroy();
    expect(getActiveEngineCount()).toBe(0);
  });

  it("render(t) is deterministic and pure: scrubbing forward and backward produces identical outputs", () => {
    const { elements } = createMockElements();
    const engine = new WelcomeEngine({
      elements,
      viewport: { width: 1920, height: 1080 },
      slotOffset: { x: 25, y: -120 },
      tier: "performance",
      quality: "auto",
      onReady: vi.fn(),
    });

    const testTimes = [500, 1200, 2200, 3100, 3900];
    const forwardSnapshots: Array<{
      time: number;
      logoTransform: string;
      logoOpacity: string;
      sharpOpacity: string;
      godRaysTransform: string;
      godRaysOpacity: string;
      wordmarkOpacity: string;
      wordmarkTransform: string;
    }> = [];

    // Forward pass
    for (const t of testTimes) {
      engine.render(t);
      forwardSnapshots.push({
        time: t,
        logoTransform: elements.logoContainer?.style.transform ?? "",
        logoOpacity: elements.logoContainer?.style.opacity ?? "",
        sharpOpacity: elements.logoSharpTile?.style.opacity ?? "",
        godRaysTransform: elements.godRays?.style.transform ?? "",
        godRaysOpacity: elements.godRays?.style.opacity ?? "",
        wordmarkOpacity: elements.wordmarkLetters[0]?.style.opacity ?? "",
        wordmarkTransform: elements.wordmarkLetters[0]?.style.transform ?? "",
      });
    }

    // Scrub somewhere else
    engine.render(4100);
    engine.render(300);

    // Backward pass
    for (let i = testTimes.length - 1; i >= 0; i--) {
      const t = testTimes[i]!;
      engine.render(t);
      const snapshot = forwardSnapshots[i]!;

      expect(elements.logoContainer?.style.transform).toBe(
        snapshot.logoTransform
      );
      expect(elements.logoContainer?.style.opacity).toBe(snapshot.logoOpacity);
      expect(elements.logoSharpTile?.style.opacity).toBe(snapshot.sharpOpacity);
      expect(elements.godRays?.style.transform).toBe(snapshot.godRaysTransform);
      expect(elements.godRays?.style.opacity).toBe(snapshot.godRaysOpacity);
      expect(elements.wordmarkLetters[0]?.style.opacity).toBe(
        snapshot.wordmarkOpacity
      );
      expect(elements.wordmarkLetters[0]?.style.transform).toBe(
        snapshot.wordmarkTransform
      );
    }

    engine.destroy();
  });

  it("Rev-2 Z Keyframes restored and fly-by peak scale is ~3.33", () => {
    // Spec: z keyframes 0:-0.78, 0.20:+0.20, 0.42:+1.60, 0.62:+0.90, 0.72:-0.70
    expect(FLYBY_PEAK_Z).toBe(-0.7);

    const kf0 = Z_KEYFRAMES.find((k) => k.u === 0);
    const kf1 = Z_KEYFRAMES.find((k) => k.u === 0.2);
    const kf2 = Z_KEYFRAMES.find((k) => k.u === 0.42);
    const kf3 = Z_KEYFRAMES.find((k) => k.u === 0.62);
    const kf4 = Z_KEYFRAMES.find((k) => k.u === 0.72);

    expect(kf0?.z).toBeCloseTo(-0.78, 6);
    expect(kf1?.z).toBeCloseTo(0.2, 6);
    expect(kf2?.z).toBeCloseTo(1.6, 6);
    expect(kf3?.z).toBeCloseTo(0.9, 6);
    expect(kf4?.z).toBeCloseTo(-0.7, 6);

    // Peak fly-by scale = 1 / (1 + z) = 1 / (1 - 0.70) = 3.333333
    const pFlyby = flightPose(0.72, 1920, 1080, "performance");
    expect(pFlyby.scale).toBeCloseTo(1 / (1 - 0.7), 4);
    expect(pFlyby.scale).toBeGreaterThanOrEqual(3.3);
  });

  it("At t >= END: loop stops and writes exact identity resting state", () => {
    const { elements } = createMockElements();
    const onReady = vi.fn();
    const slotOffset = { x: 35, y: -115 };
    const engine = new WelcomeEngine({
      elements,
      viewport: { width: 1920, height: 1080 },
      slotOffset,
      tier: "performance",
      quality: "auto",
      onReady,
    });

    engine.setTime(WELCOME_TIMINGS.totalTimelineMs);

    const baseScale = DESKTOP_LOGO_SIZE / DESKTOP_RASTER_TILE_PX; // 112 / 336 = 1/3
    const expectedTransform = `translate3d(${slotOffset.x}px, ${slotOffset.y}px, 0px) scale(${baseScale}) rotateX(0deg) rotateY(0deg) rotateZ(0deg)`;

    expect(elements.logoContainer?.style.transform).toBe(expectedTransform);
    expect(elements.logoContainer?.style.opacity).toBe("1");

    // All strokes fully revealed
    for (const strokeEl of elements.greetingStrokes ?? []) {
      if (strokeEl) {
        expect(
          strokeEl.style.strokeDashoffset ||
            strokeEl.getAttribute("stroke-dashoffset")
        ).toBe("0");
      }
    }

    // Safety mask rect full opacity
    expect(elements.greetingMaskRect?.style.opacity).toBe("1");
    // Pen dot hidden
    expect(elements.penDotG?.style.display).toBe("none");

    // Wordmark fully resting
    for (const letterEl of elements.wordmarkLetters) {
      expect(letterEl.style.opacity).toBe("1");
      expect(letterEl.style.transform).toBe("translateY(0%) scale(1)");
    }
    expect(elements.wordmarkBlurLayer?.style.opacity).toBe("0");

    // Subtitle, CTA, Footer
    expect(elements.subtitle?.style.opacity).toBe("1");
    expect(elements.subtitle?.style.transform).toBe("translateY(0px)");
    expect(elements.ctaContainer?.style.opacity).toBe("1");
    expect(elements.ctaContainer?.style.transform).toBe(
      "translateY(0px) scale(1)"
    );
    expect(elements.footerContainer?.style.opacity).toBe("0.8");

    engine.destroy();
  });
});
