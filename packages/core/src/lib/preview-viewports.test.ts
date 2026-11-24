import {
  CUSTOM_LIMITS,
  canZoomIn,
  canZoomOut,
  clampDimension,
  clampZoom,
  computeFitScale,
  DEVICE_MAP,
  DEVICE_REGISTRY,
  formatZoom,
  frameLayout,
  getViewportDimensions,
  MAX_ZOOM,
  MIN_ZOOM,
  naturalOrientationFor,
  orientationOf,
  parseDimensionInput,
  resolveViewport,
  VIEWPORTS,
  ZOOM_STEPS,
  zoomInFrom,
  zoomOutFrom,
} from "@workspace/core/lib/preview-viewports";
import { describe, expect, it } from "vitest";

const CUSTOM = { height: 768, width: 1024 };

describe("Device Registry", () => {
  it("contains all required devices", () => {
    const requiredDeviceIds = [
      "iphone-se",
      "iphone-xr",
      "iphone-12-pro",
      "iphone-14",
      "iphone-14-plus",
      "iphone-14-pro",
      "iphone-14-pro-max",
      "iphone-15",
      "iphone-15-plus",
      "iphone-15-pro",
      "iphone-15-pro-max",
      "iphone-16e",
      "iphone-16",
      "iphone-16-plus",
      "iphone-16-pro",
      "iphone-16-pro-max",
      "pixel-7",
      "pixel-8",
      "pixel-8-pro",
      "pixel-8a",
      "pixel-9",
      "pixel-9-pro",
      "pixel-9-pro-xl",
      "pixel-10",
      "galaxy-s8-plus",
      "galaxy-s20-ultra",
      "galaxy-a55",
      "galaxy-a51-a71",
      "moto-g4",
      "moto-g-power",
      "jiophone-2",
      "facebook-android",
      "surface-duo",
      "pixel-9-pro-fold",
      "galaxy-z-fold-5",
      "galaxy-z-fold-6",
      "asus-zenbook-fold",
      "ipad-mini",
      "ipad-pro-13",
      "galaxy-tab-s4",
      "surface-pro-7",
      "surface-pro-10",
      "desktop-1080p",
      "nest-hub-max",
    ];

    for (const id of requiredDeviceIds) {
      expect(DEVICE_MAP.has(id), `Missing required device: ${id}`).toBe(true);
    }
  });

  it("places Galaxy Tab S4 under tablets, not phones", () => {
    expect(DEVICE_MAP.get("galaxy-tab-s4")?.category).toBe("tablet");
  });

  it("places Nest Hub Max under smart-display", () => {
    expect(DEVICE_MAP.get("nest-hub-max")?.category).toBe("smart-display");
  });

  it("has no fixed-width preset that would render a zero-height viewport", () => {
    for (const d of DEVICE_REGISTRY) {
      if (d.category !== "responsive") {
        expect(d.width, d.id).toBeGreaterThan(0);
        expect(d.height, d.id).toBeGreaterThan(0);
      }
    }
  });

  it("provides the generic viewport classes as exact CSS sizes", () => {
    const expected = [
      [320, 568],
      [360, 800],
      [375, 812],
      [390, 844],
      [393, 852],
      [414, 896],
      [430, 932],
      [768, 1024],
      [810, 1080],
      [834, 1194],
      [1024, 1366],
      [1280, 720],
      [1536, 864],
      [1600, 900],
    ] as const;
    for (const [w, h] of expected) {
      const d = DEVICE_MAP.get(`generic-${w}x${h}`);
      expect(d, `${w}x${h}`).toBeDefined();
      if (d) {
        const natural = w > h ? "landscape" : "portrait";
        expect(getViewportDimensions(d, natural)).toEqual({
          height: h,
          width: w,
        });
      }
    }
  });

  it("has unique device ids", () => {
    const ids = DEVICE_REGISTRY.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("CSS Viewport Dimensions Accuracy", () => {
  it("gives iPhone 15 exact 393 × 852 px in portrait and 852 × 393 px in landscape", () => {
    const iphone15 = DEVICE_MAP.get("iphone-15");
    expect(iphone15).toBeDefined();
    if (!iphone15) {
      return;
    }
    expect(getViewportDimensions(iphone15, "portrait")).toEqual({
      height: 852,
      width: 393,
    });
    expect(getViewportDimensions(iphone15, "landscape")).toEqual({
      height: 393,
      width: 852,
    });
  });

  it("gives Desktop 1080p exact 1920 × 1080 px in landscape", () => {
    const pc = DEVICE_MAP.get("desktop-1080p");
    expect(pc).toBeDefined();
    if (!pc) {
      return;
    }
    expect(getViewportDimensions(pc, "landscape")).toEqual({
      height: 1080,
      width: 1920,
    });
    expect(getViewportDimensions(pc, "portrait")).toEqual({
      height: 1920,
      width: 1080,
    });
  });

  it("gives Nest Hub Max 1280 × 800 px in landscape", () => {
    const nest = DEVICE_MAP.get("nest-hub-max");
    expect(nest).toBeDefined();
    if (nest) {
      expect(getViewportDimensions(nest, "landscape")).toEqual({
        height: 800,
        width: 1280,
      });
    }
  });

  it("swaps width and height on rotation without changing the area", () => {
    for (const d of DEVICE_REGISTRY) {
      if (d.category === "responsive" || d.isFoldable) {
        continue;
      }
      const a = getViewportDimensions(d, "portrait");
      const b = getViewportDimensions(d, "landscape");
      expect(a.width, d.id).toBe(b.height);
      expect(a.height, d.id).toBe(b.width);
    }
  });
});

describe("Foldable Devices", () => {
  it("supports folded and unfolded dimensions for Galaxy Z Fold 5", () => {
    const fold5 = DEVICE_MAP.get("galaxy-z-fold-5");
    expect(fold5?.isFoldable).toBe(true);
    if (!fold5) {
      return;
    }
    expect(getViewportDimensions(fold5, "portrait", "folded")).toEqual({
      height: 902,
      width: 344,
    });
    expect(getViewportDimensions(fold5, "portrait", "unfolded")).toEqual({
      height: 906,
      width: 862,
    });
  });

  it("supports Surface Duo dual-screen configuration with 28px hinge", () => {
    const duo = DEVICE_MAP.get("surface-duo");
    expect(duo?.hinge?.width).toBe(28);
    if (!duo) {
      return;
    }
    expect(getViewportDimensions(duo, "portrait", "folded")).toEqual({
      height: 720,
      width: 540,
    });
    expect(getViewportDimensions(duo, "portrait", "unfolded")).toEqual({
      height: 720,
      width: 1114,
    });
  });
});

describe("zoom", () => {
  it("steps up and down through clean values and stops at the limits", () => {
    expect(zoomInFrom(1)).toBe(1.1);
    expect(zoomOutFrom(1)).toBe(0.9);
    expect(zoomInFrom(MAX_ZOOM)).toBe(MAX_ZOOM);
    expect(zoomOutFrom(MIN_ZOOM)).toBe(MIN_ZOOM);
    expect(ZOOM_STEPS[0]).toBe(MIN_ZOOM);
    expect(ZOOM_STEPS.at(-1)).toBe(MAX_ZOOM);
  });

  it("includes 100% as a step so Reset lands on a real value", () => {
    expect(ZOOM_STEPS).toContain(1);
  });

  it("steps from the resolved Fit scale, not from 100%", () => {
    expect(zoomInFrom(0.68)).toBe(0.75);
    expect(zoomOutFrom(0.68)).toBe(0.6);
  });

  it("disables in/out exactly at the limits", () => {
    expect(canZoomIn(MAX_ZOOM)).toBe(false);
    expect(canZoomOut(MIN_ZOOM)).toBe(false);
    expect(canZoomIn(1)).toBe(true);
    expect(canZoomOut(1)).toBe(true);
    expect(canZoomOut(0.15)).toBe(false);
  });

  it("clamps absurd values and never returns zero or negative scale", () => {
    expect(clampZoom(0)).toBe(1);
    expect(clampZoom(-2)).toBe(1);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(50)).toBe(MAX_ZOOM);
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
  });

  it("labels Fit as Fit and manual zoom as a percentage", () => {
    expect(formatZoom("fit")).toBe("Fit");
    expect(formatZoom(1)).toBe("100%");
    expect(formatZoom(1.25)).toBe("125%");
  });
});

describe("custom viewport", () => {
  it("accepts plain integers inside the limits", () => {
    expect(parseDimensionInput("1024", "width")).toEqual({ value: 1024 });
    expect(parseDimensionInput(" 768 ", "height")).toEqual({ value: 768 });
  });

  it.each([
    "",
    "  ",
    "abc",
    "-400",
    "12.5",
    "1e3",
    "+500",
    "0x40",
    "12 34",
  ])("rejects malformed input %j", (raw) => {
    expect(parseDimensionInput(raw, "width").value).toBeNull();
  });

  it("rejects out-of-range values", () => {
    expect(parseDimensionInput("10", "width").value).toBeNull();
    expect(
      parseDimensionInput(String(CUSTOM_LIMITS.maxWidth + 1), "width").value
    ).toBeNull();
    expect(parseDimensionInput("50", "height").value).toBeNull();
    expect(parseDimensionInput("99999", "height").value).toBeNull();
  });

  it("clamps programmatic sizes and falls back on non-finite input", () => {
    expect(clampDimension(5, "width", 1024)).toBe(CUSTOM_LIMITS.minWidth);
    expect(clampDimension(1e9, "height", 768)).toBe(CUSTOM_LIMITS.maxHeight);
    expect(clampDimension(Number.NaN, "width", 1024)).toBe(1024);
    expect(clampDimension(400.6, "width", 1024)).toBe(401);
  });
});

describe("resolveViewport", () => {
  it("returns the exact device size and swaps it with orientation", () => {
    expect(
      resolveViewport("generic-390x844", "portrait", "unfolded", CUSTOM)
        .viewport
    ).toEqual({ height: 844, width: 390 });
    expect(
      resolveViewport("generic-390x844", "landscape", "unfolded", CUSTOM)
        .viewport
    ).toEqual({ height: 390, width: 844 });
  });

  it("uses the custom size exactly", () => {
    const r = resolveViewport("custom", "portrait", "unfolded", CUSTOM);
    expect(r.viewport).toEqual(CUSTOM);
    expect(r.fluid).toBe(false);
  });

  it("clamps an out-of-range persisted custom size instead of breaking", () => {
    const r = resolveViewport("custom", "portrait", "unfolded", {
      height: -5,
      width: Number.NaN,
    });
    expect(r.viewport.width).toBeGreaterThan(0);
    expect(r.viewport.height).toBeGreaterThan(0);
  });

  it("treats the responsive device as fluid with no fixed size", () => {
    const r = resolveViewport("responsive", "portrait", "unfolded", CUSTOM);
    expect(r.fluid).toBe(true);
    expect(r.viewport).toEqual({ height: 0, width: 0 });
  });

  it("falls back to fluid for an unknown or stale persisted device id", () => {
    expect(
      resolveViewport("responsive-phone", "portrait", "unfolded", CUSTOM).fluid
    ).toBe(true);
  });

  it("reports orientation from the viewport shape", () => {
    expect(orientationOf({ height: 844, width: 390 })).toBe("portrait");
    expect(orientationOf({ height: 390, width: 844 })).toBe("landscape");
  });
});

describe("computeFitScale", () => {
  it("fits the whole viewport inside the canvas with a margin on every side", () => {
    const scale = computeFitScale(1440, 900, 1000, 700);
    expect(scale).toBeCloseTo(Math.min(968 / 1440, 668 / 900), 5);
    expect(1440 * scale).toBeLessThanOrEqual(1000 - 32 + 1e-6);
    expect(900 * scale).toBeLessThanOrEqual(700 - 32 + 1e-6);
  });

  it("is limited by the tighter axis and preserves aspect ratio", () => {
    const scale = computeFitScale(393, 852, 1200, 700);
    expect(scale).toBeCloseTo((700 - 32) / 852, 5);
  });

  it("shows a viewport that already fits at true size, not upscaled", () => {
    expect(computeFitScale(375, 667, 1400, 900)).toBe(1);
  });

  it("is below 100% when the viewport is larger than the canvas", () => {
    expect(computeFitScale(1920, 1080, 900, 600)).toBeLessThan(1);
  });

  it("stays positive for tiny canvases and degenerate input", () => {
    expect(computeFitScale(1920, 1080, 20, 20)).toBeGreaterThan(0);
    expect(computeFitScale(0, 100, 500, 500)).toBe(1);
    expect(computeFitScale(100, 100, 0, 500)).toBe(1);
  });

  it("grows when the canvas grows (fullscreen) and shrinks when it shrinks", () => {
    const normal = computeFitScale(1440, 900, 900, 600);
    const fullscreen = computeFitScale(1440, 900, 1800, 1000);
    expect(fullscreen).toBeGreaterThan(normal);
    expect(computeFitScale(1440, 900, 600, 400)).toBeLessThan(normal);
  });
});

describe("Backward Compatibility", () => {
  it("naturalOrientationFor returns landscape for wider desktop", () => {
    const pcPreset = VIEWPORTS.find((v) => v.id === "desktop-1080p");
    expect(pcPreset).toBeDefined();
    if (pcPreset) {
      expect(naturalOrientationFor(pcPreset)).toBe("landscape");
    }
  });

  it("frameLayout returns exact pixel strings for outer dimensions", () => {
    const pcPreset = VIEWPORTS.find((v) => v.id === "desktop-1080p");
    expect(pcPreset).toBeDefined();
    if (pcPreset) {
      const layout = frameLayout(pcPreset, "landscape", 1);
      expect(layout.outerWidth).toBe("1920px");
      expect(layout.outerHeight).toBe("1080px");
    }
  });
});
