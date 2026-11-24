import { describe, expect, it } from "vitest";
import {
  computeCardPlacement,
  type PlacementInput,
  type PlacementRect,
} from "./tour-placement";

function rectsOverlap(a: PlacementRect, b: PlacementRect): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

describe("tour-placement V2 rules", () => {
  const vp = { width: 1440, height: 900 };
  const cardWidths: [number, number] = [320, 300];
  const cardHeight = 170;
  const gap = 16;
  const margin = 24;

  it("case 1: right side available places on right", () => {
    // Target in center-left with plenty of room on right
    const anchor: PlacementRect = {
      left: 400,
      top: 300,
      width: 200,
      height: 60,
    };
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: null,
      anchor,
      cardWidths,
      cardHeight,
      margin,
      gap,
      preferred: "right",
      hard: [],
      soft: [],
    };
    const res = computeCardPlacement(input);
    expect(res.side).toBe("right");
    expect(res.x).toBeGreaterThanOrEqual(anchor.left + anchor.width + 12);
    expect(res.x).toBeLessThanOrEqual(anchor.left + anchor.width + 24);
  });

  it("case 2: right blocked so places on left", () => {
    // Target near right edge (x=1300), so right side has only 40px (< 300px)
    const anchor: PlacementRect = {
      left: 1100,
      top: 300,
      width: 200,
      height: 60,
    };
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: null,
      anchor,
      cardWidths,
      cardHeight,
      margin,
      gap,
      preferred: "right",
      hard: [],
      soft: [],
    };
    const res = computeCardPlacement(input);
    expect(res.side).toBe("left");
    expect(res.x + res.width).toBeLessThanOrEqual(anchor.left - 12);
  });

  it("case 3: both right and left blocked so places below", () => {
    // Wide target spanning x=20 to x=1420, so neither left nor right has room
    const anchor: PlacementRect = {
      left: 20,
      top: 100,
      width: 1400,
      height: 60,
    };
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: null,
      anchor,
      cardWidths,
      cardHeight,
      margin,
      gap,
      preferred: "right",
      hard: [],
      soft: [],
    };
    const res = computeCardPlacement(input);
    expect(res.side).toBe("bottom");
    expect(res.y).toBeGreaterThanOrEqual(anchor.top + anchor.height + 12);
  });

  it("case 4: target at the top-right edge places below inside margin", () => {
    // Target at top-right (e.g. top-right button at x=1350, y=10)
    const anchor: PlacementRect = {
      left: 1350,
      top: 10,
      width: 44,
      height: 44,
    };
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: null,
      anchor,
      cardWidths,
      cardHeight,
      margin,
      gap,
      preferred: "bottom",
      hard: [],
      soft: [],
    };
    const res = computeCardPlacement(input);
    expect(res.side).toBe("bottom");
    expect(res.y).toBeGreaterThanOrEqual(anchor.top + anchor.height + 12);
    // Stays fully inside viewport right margin (<= 1440 - 16 = 1424)
    expect(res.x + res.width).toBeLessThanOrEqual(vp.width - 16);
    expect(res.x).toBeGreaterThanOrEqual(16);
  });

  it("case 5: target at the bottom-left places right or above inside margin", () => {
    // Target at bottom-left (e.g. settings gear at x=10, y=840)
    const anchor: PlacementRect = { left: 10, top: 840, width: 50, height: 50 };
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: null,
      anchor,
      cardWidths,
      cardHeight,
      margin,
      gap,
      preferred: "right",
      hard: [],
      soft: [],
    };
    const res = computeCardPlacement(input);
    expect(["right", "top"]).toContain(res.side);
    expect(res.x).toBeGreaterThanOrEqual(16);
    expect(res.y + res.height).toBeLessThanOrEqual(vp.height - 16);
  });

  it("case 6: side lock keeps the side within the same surface", () => {
    // Target where both left and right are valid
    const anchor: PlacementRect = {
      left: 600,
      top: 300,
      width: 200,
      height: 60,
    };
    const inputWithLeftLock: PlacementInput = {
      viewport: vp,
      surfaceBounds: null,
      anchor,
      cardWidths,
      cardHeight,
      margin,
      gap,
      preferred: "right", // preferred says right, but previous step was locked on left
      previousSide: "left",
      previousSurface: "sidebar",
      currentSurface: "sidebar",
      hard: [],
      soft: [],
    };
    const res = computeCardPlacement(inputWithLeftLock);
    expect(res.side).toBe("left");
  });

  it("case 7: H3 next-target avoidance prevents covering next step target", () => {
    // Target at x=600, y=300.
    // Next target is immediately to the right at x=830, y=300 (which right candidate would cover).
    const anchor: PlacementRect = {
      left: 600,
      top: 300,
      width: 200,
      height: 60,
    };
    const nextTarget: PlacementRect = {
      left: 820,
      top: 280,
      width: 200,
      height: 100,
    };

    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: null,
      anchor,
      cardWidths,
      cardHeight,
      margin,
      gap,
      preferred: "right",
      nextTargetRect: nextTarget,
      hard: [],
      soft: [],
    };
    const res = computeCardPlacement(input);
    // Right would cover next target, so placement engine avoids right and selects another valid side (e.g. left or bottom)
    const card: PlacementRect = {
      left: res.x,
      top: res.y,
      width: res.width,
      height: res.height,
    };
    expect(rectsOverlap(card, nextTarget)).toBe(false);
  });

  it("case 8: no overlap with inflated cutout (H1)", () => {
    const anchor: PlacementRect = {
      left: 500,
      top: 300,
      width: 250,
      height: 80,
    };
    const inflatedCutout: PlacementRect = {
      left: anchor.left - 12,
      top: anchor.top - 12,
      width: anchor.width + 24,
      height: anchor.height + 24,
    };
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: null,
      anchor,
      cardWidths,
      cardHeight,
      margin,
      gap,
      preferred: "right",
      hard: [],
      soft: [],
    };
    const res = computeCardPlacement(input);
    const card: PlacementRect = {
      left: res.x,
      top: res.y,
      width: res.width,
      height: res.height,
    };
    expect(rectsOverlap(card, inflatedCutout)).toBe(false);
  });
});
