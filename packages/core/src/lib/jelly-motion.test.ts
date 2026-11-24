import {
  jellyDisplacementMatrix,
  stepJelly,
} from "@workspace/ui/lib/jelly-motion";
import { describe, expect, it } from "vitest";

describe("jelly spring", () => {
  it.each([30, 60, 120])("lags, overshoots and settles at %s fps", (fps) => {
    let position = 0;
    let velocity = 0;
    let peak = 0;
    for (let frame = 0; frame < fps * 2; frame++) {
      ({ position, velocity } = stepJelly(position, velocity, 100, 1 / fps));
      if (frame === 0) {
        expect(position).toBeLessThan(15);
      }
      peak = Math.max(peak, position);
    }
    expect(peak).toBeGreaterThan(105);
    expect(peak).toBeLessThan(120);
    expect(position).toBeCloseTo(100, 2);
    expect(Math.abs(velocity)).toBeLessThan(0.01);
  });

  it("remains finite when a suspended frame resumes", () => {
    const next = stepJelly(0, 500, -100, 2);
    expect(Number.isFinite(next.position)).toBe(true);
    expect(Math.abs(next.position)).toBeLessThan(100);
  });
});

describe("single-pass jelly displacement", () => {
  it.each([
    [70, -55],
    [-40, 30],
    [0, 0],
  ])("pins the grab point and preserves both axes (%s, %s)", (x, y) => {
    const matrix = jellyDisplacementMatrix(x, y).split(" ").map(Number);
    expect(matrix).toHaveLength(20);
    const displace = (red: number, row: number) =>
      ((matrix[row] ?? 0) * red + (matrix[row + 4] ?? 0) - 0.5) * 140;
    expect(displace(128 / 255, 0)).toBeCloseTo(0);
    expect(displace(128 / 255, 5)).toBeCloseTo(0);
    expect(displace(1, 0)).toBeCloseTo(x);
    expect(displace(1, 5)).toBeCloseTo(y);
  });
});
