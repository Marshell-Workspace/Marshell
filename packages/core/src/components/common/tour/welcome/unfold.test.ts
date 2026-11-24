import { describe, expect, it } from "vitest";
import { UNFOLD_BLADE_CORNERS } from "./welcome.config";

describe("Storyboard Frame 3 (UNFOLD) Geometry & Criteria Verification", () => {
  it("has exactly 4 blades on each side with valid depth ordering", () => {
    expect(UNFOLD_BLADE_CORNERS.left).toHaveLength(4);
    expect(UNFOLD_BLADE_CORNERS.right).toHaveLength(4);

    const leftDepths = UNFOLD_BLADE_CORNERS.left.map((b) => b.depthOrder);
    const rightDepths = UNFOLD_BLADE_CORNERS.right.map((b) => b.depthOrder);

    expect(leftDepths).toEqual([1, 2, 3, 4]);
    expect(rightDepths).toEqual([1, 2, 3, 4]);
  });

  it("verifies corners are within 0.05 Wh (x) and 0.04 H (y) of Reference A trace", () => {
    // Reference A Traced Corners
    const tracedLeft = [
      { top: { x: 0.709, y: -0.238 }, bot: { x: 0.705, y: 0.229 } },
      { top: { x: 0.859, y: -0.37 }, bot: { x: 0.829, y: 0.372 } },
      { top: { x: 0.963, y: -0.229 }, bot: { x: 0.817, y: 0.372 } },
      { top: { x: 0.748, y: -0.175 }, bot: { x: 0.74, y: 0.41 } },
    ];

    const tracedRight = [
      { top: { x: 0.736, y: -0.178 }, bot: { x: 0.705, y: 0.192 } },
      { top: { x: 0.859, y: -0.341 }, bot: { x: 0.859, y: 0.289 } },
      { top: { x: 0.99, y: -0.238 }, bot: { x: 0.99, y: 0.321 } },
      { top: { x: 0.817, y: -0.201 }, bot: { x: 0.748, y: 0.335 } },
    ];

    UNFOLD_BLADE_CORNERS.left.forEach((blade, i) => {
      const trace = tracedLeft[i]!;
      expect(Math.abs(blade.top.x - trace.top.x)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(blade.top.y - trace.top.y)).toBeLessThanOrEqual(0.04);
      expect(Math.abs(blade.bottom.x - trace.bot.x)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(blade.bottom.y - trace.bot.y)).toBeLessThanOrEqual(0.04);
    });

    UNFOLD_BLADE_CORNERS.right.forEach((blade, i) => {
      const trace = tracedRight[i]!;
      expect(Math.abs(blade.top.x - trace.top.x)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(blade.top.y - trace.top.y)).toBeLessThanOrEqual(0.04);
      expect(Math.abs(blade.bottom.x - trace.bot.x)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(blade.bottom.y - trace.bot.y)).toBeLessThanOrEqual(0.04);
    });
  });

  it("verifies the tallest blade is second from outside (L2 and R2) and front is shortest", () => {
    const leftHeights = UNFOLD_BLADE_CORNERS.left.map(
      (b) => b.bottom.y - b.top.y
    );
    const rightHeights = UNFOLD_BLADE_CORNERS.right.map(
      (b) => b.bottom.y - b.top.y
    );

    // Left: L1 (front) should be shortest, L2 (index 1) should be tallest
    const maxLeftIdx = leftHeights.indexOf(Math.max(...leftHeights));
    const minLeftIdx = leftHeights.indexOf(Math.min(...leftHeights));
    expect(maxLeftIdx).toBe(1); // L2
    expect(minLeftIdx).toBe(0); // L1

    // Right: R1 (front) should be shortest, R2 (index 1) should be tallest
    const maxRightIdx = rightHeights.indexOf(Math.max(...rightHeights));
    const minRightIdx = rightHeights.indexOf(Math.min(...rightHeights));
    expect(maxRightIdx).toBe(1); // R2
    expect(minRightIdx).toBe(0); // R1
  });

  it("verifies outer edges lean >= 3 degrees for at least 3 of 4 blades per side and none is vertical", () => {
    // Assuming standard 16:9 1080p viewport (Wh = 960, H = 1080, Wh/H = 0.888)
    const whToH = 960 / 1080;

    const calcLeanDeg = (blade: {
      top: { x: number; y: number };
      bottom: { x: number; y: number };
    }) => {
      const dxPx = Math.abs(blade.top.x - blade.bottom.x) * whToH;
      const dyPx = Math.abs(blade.bottom.y - blade.top.y);
      return (Math.atan(dxPx / dyPx) * 180) / Math.PI;
    };

    const leftLeans = UNFOLD_BLADE_CORNERS.left.map(calcLeanDeg);
    const rightLeans = UNFOLD_BLADE_CORNERS.right.map(calcLeanDeg);

    // None is exactly vertical (dx > 0)
    UNFOLD_BLADE_CORNERS.left.forEach((b) => {
      expect(Math.abs(b.top.x - b.bottom.x)).toBeGreaterThan(0.001);
    });
    UNFOLD_BLADE_CORNERS.right.forEach((b) => {
      expect(Math.abs(b.top.x - b.bottom.x)).toBeGreaterThan(0.001);
    });

    // At least 3 of 4 lean >= 3 degrees
    const leftOver3 = leftLeans.filter((deg) => deg >= 3.0);
    const rightOver3 = rightLeans.filter((deg) => deg >= 3.0);

    expect(leftOver3.length).toBeGreaterThanOrEqual(3);
    expect(rightOver3.length).toBeGreaterThanOrEqual(3);
  });

  it("verifies code windows and skeleton bars counts and configurations", () => {
    const l1 = UNFOLD_BLADE_CORNERS.left[0]!;
    expect(l1.hasWindow).toBe(true);
    expect(l1.windowSpec?.barsCount).toBe(7);
    expect(l1.windowSpec?.barWidthRatios).toHaveLength(7);
    expect(l1.windowSpec?.keystoneInnerRatio).toBe(0.8);

    const r2 = UNFOLD_BLADE_CORNERS.right[1]!;
    expect(r2.hasWindow).toBe(true);
    expect(r2.windowSpec?.barsCount).toBe(5);
    expect(r2.windowSpec?.barWidthRatios).toHaveLength(5);
    expect(r2.windowSpec?.keystoneInnerRatio).toBe(0.8);
  });
});
