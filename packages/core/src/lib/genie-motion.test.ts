import {
  computeGenieStation,
  getGenieAnchor,
  getGenieClipPath,
  getGenieEdge,
  resolveGenieOriginRect,
  runGenieAnimation,
} from "@workspace/ui/lib/genie-motion";
import { afterEach, describe, expect, it, vi } from "vitest";

const origin = { left: 16, top: 180, width: 200, height: 36 };
const bounds = {
  left: 24,
  top: 24,
  width: 1200,
  height: 800,
  centerX: 624,
  centerY: 424,
};

afterEach(() => vi.unstubAllGlobals());

describe("workspace Genie deformation", () => {
  it.each([
    ["left", 216],
    ["right", 16],
    ["top", 216],
    ["bottom", 180],
  ] as const)("uses the facing button boundary for %s", (edge, anchor) => {
    expect(getGenieAnchor(origin, edge)).toBe(anchor);
    const lastStation = edge === "right" || edge === "bottom" ? 0 : 1;
    expect(
      computeGenieStation(0, lastStation, origin, bounds, edge).axis
    ).toBeCloseTo(anchor);
  });

  it.each([
    "left",
    "right",
    "top",
    "bottom",
  ] as const)("settles into the exact panel rectangle from %s", (edge) => {
    const vertical = edge === "top" || edge === "bottom";
    for (const station of [0, 0.2, 0.5, 0.8, 1]) {
      const point = computeGenieStation(1, station, origin, bounds, edge);
      expect(point.axis).toBeCloseTo(
        (vertical ? bounds.top : bounds.left) +
          (vertical ? bounds.height : bounds.width) * station
      );
      expect(point.start).toBe(vertical ? bounds.left : bounds.top);
      expect(point.end).toBe(
        vertical ? bounds.left + bounds.width : bounds.top + bounds.height
      );
    }
  });

  it("chooses the edge facing the trigger", () => {
    expect(getGenieEdge(origin, bounds)).toBe("left");
    expect(
      getGenieEdge({ left: 1210, top: 400, width: 32, height: 32 }, bounds)
    ).toBe("right");
    expect(
      getGenieEdge({ left: 600, top: 0, width: 32, height: 32 }, bounds)
    ).toBe("top");
    expect(
      getGenieEdge({ left: 600, top: 840, width: 32, height: 32 }, bounds)
    ).toBe("bottom");
  });

  it("consumes the sheet at its origin instead of scaling it into a rectangle", () => {
    const anchor = origin.left + origin.width;
    const near = computeGenieStation(0.5, 0, origin, bounds);
    const far = computeGenieStation(0.5, 1, origin, bounds);
    expect(near.axis).toBeLessThan(anchor);
    expect(far.axis).toBeGreaterThan(anchor);
    expect(near.end - near.start).toBe(origin.height);
    expect(far.end - far.start).toBeGreaterThan(origin.height * 5);
    for (const station of [0, 0.5, 1]) {
      expect(
        computeGenieStation(0, station, origin, bounds).axis
      ).toBeLessThanOrEqual(anchor);
    }
    expect(getGenieClipPath(0.5, origin, bounds, "left")).toBe(
      `inset(0 0 0 ${anchor}px)`
    );
  });

  it("keeps the material ordered and finite throughout all four directions", () => {
    const origins = [
      origin,
      { left: 1210, top: 400, width: 32, height: 32 },
      { left: 600, top: 0, width: 32, height: 32 },
      { left: 600, top: 840, width: 32, height: 32 },
    ];
    for (const trigger of origins) {
      for (let frame = 0; frame <= 100; frame++) {
        let previous = Number.NEGATIVE_INFINITY;
        for (let index = 0; index <= 48; index++) {
          const point = computeGenieStation(
            frame / 100,
            index / 48,
            trigger,
            bounds
          );
          expect(point.axis).toBeGreaterThan(previous);
          expect(point.end).toBeGreaterThan(point.start);
          expect(Number.isFinite(point.start)).toBe(true);
          previous = point.axis;
        }
      }
    }
  });

  it("retains the opening origin for the closing session", () => {
    expect(resolveGenieOriginRect(null, undefined, origin)).toBe(origin);
  });

  it.each([
    "finish",
    "cancel",
  ])("preserves Radix's pointer enablement when animations %s", (ending) => {
    let frame: FrameRequestCallback = () => undefined;
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const surface = {
      style: { opacity: "", pointerEvents: "" },
    } as HTMLElement;
    const cancel = runGenieAnimation({
      surfaceEl: surface,
      originRect: origin,
      restingBounds: bounds,
      mode: "open",
    });
    // Radix disables body hit-testing, then enables the modal after mount.
    // The animation must not restore the earlier empty inline value.
    surface.style.pointerEvents = "auto";
    frame(0);
    if (ending === "finish") {
      frame(120);
    } else {
      cancel();
    }
    expect(surface.style.pointerEvents).toBe("auto");
    expect(surface.style.opacity).toBe("");
  });

  it("pinches toward the origin before the far edge leaves its resting position", () => {
    const near = computeGenieStation(0.85, 0, origin, bounds);
    const far = computeGenieStation(0.85, 1, origin, bounds);
    expect(far.axis).toBe(bounds.left + bounds.width);
    expect(far.start).toBe(bounds.top);
    expect(far.end).toBe(bounds.top + bounds.height);
    expect(near.end - near.start).toBeLessThan(bounds.height);
    expect(near.start).toBeGreaterThan(bounds.top);
  });

  it("fades out in reduced motion and reverses from the interrupted frame", () => {
    let frame: FrameRequestCallback = () => undefined;
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const surface = {
      style: { opacity: "", pointerEvents: "" },
    } as HTMLElement;
    const overlay = { style: { opacity: "" } } as HTMLElement;
    const finish = vi.fn();
    const options = {
      surfaceEl: surface,
      overlayEl: overlay,
      originRect: origin,
      restingBounds: bounds,
    };
    const cancel = runGenieAnimation({ ...options, mode: "open" });
    frame(0);
    frame(60);
    expect(Number(surface.style.opacity)).toBeCloseTo(0.5);
    cancel();
    runGenieAnimation({ ...options, mode: "close", onComplete: finish });
    expect(Number(surface.style.opacity)).toBeCloseTo(0.5);
    frame(60);
    frame(180);
    expect(surface.style.opacity).toBe("0");
    expect(overlay.style.opacity).toBe("0");
    expect(finish).toHaveBeenCalledOnce();
  });
});
