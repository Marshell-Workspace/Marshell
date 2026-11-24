import { describe, expect, it } from "vitest";
import { growthDigits, growthGlyph } from "./ascii-growth";
import {
  ambientShiftX,
  ambientShiftY,
  ambientTone,
  helicopterInk,
  materialGrain,
} from "./ascii-texture";

describe("living ASCII texture", () => {
  it("clarifies fine helicopter ink without filling the background or changing other scenes", () => {
    expect(helicopterInk(0, 1)).toBe(0);
    expect(helicopterInk(0.2, 1)).toBeGreaterThan(0.3);
    expect(helicopterInk(0.6, 0)).toBe(0.6);
    expect(helicopterInk(1, 1)).toBe(1);
  });
  it("mixes dim and bright white material without extinguishing the silhouette", () => {
    const values = Array.from({ length: 200 }, (_, i) =>
      materialGrain(i / 199, i % 30, Math.floor(i / 30), 2)
    );
    expect(Math.min(...values)).toBeGreaterThan(0.45);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.5);
  });

  it("drifts the background inside each cell while keeping the ambient ink subdued", () => {
    const positions = new Set<number>();
    const tones = new Set<number>();
    for (let frame = 0; frame < 600; frame++) {
      const time = frame / 60;
      positions.add(ambientShiftX(10, time));
      tones.add(ambientTone(0.5, 20, 10, time));
      expect(Math.abs(ambientShiftX(10, time))).toBeLessThanOrEqual(0.75);
      expect(Math.abs(ambientShiftY(10, time))).toBeLessThanOrEqual(0.25);
      expect(ambientTone(0.99, 20, 10, time)).toBeLessThanOrEqual(5);
    }
    expect(positions.size).toBeGreaterThan(4);
    expect(tones.size).toBe(3);
  });

  it("encodes only numeric ASCII artwork and keeps all counters aligned", () => {
    const first = growthDigits(0);
    expect(first[0]).toEqual(["000", "000", "000", "000", "000"]);
    expect(growthDigits(50)).toHaveLength(3);
    expect(growthDigits(99)[0]).toEqual(growthDigits(99)[1]);
    expect(growthDigits(100)).toEqual(growthDigits(99));
    for (const value of [0, 1, 9, 10, 50, 99]) {
      for (const digit of growthDigits(value)) {
        expect(digit).toHaveLength(5);
        for (const row of digit) {
          expect(row).toMatch(/^(?:[01]{3}|[01]{5})$/);
        }
      }
    }
  });

  it("lights only ASCII strokes and leaves the ambient field in all counter gaps", () => {
    const layout = { x: 10, y: 10, width: 22 };
    expect(growthGlyph(layout, 50, 10, 10)).toBe("+");
    expect(growthGlyph(layout, 50, 11, 10)).toBe("-");
    expect(growthGlyph(layout, 50, 10, 11)).toBe("|");
    expect(growthGlyph(layout, 50, 11, 11)).toBe("=");
    expect(growthGlyph(layout, 50, 28, 11)).toBeUndefined();
    expect(growthGlyph(layout, 50, 35, 10)).toBe("5");
    expect(growthGlyph(layout, 50, 36, 11)).toBeUndefined();
    expect(growthGlyph(layout, 50, 1, 1)).toBeUndefined();
    for (let row = 9; row <= 15; row++) {
      for (let column = 34; column < 50; column++) {
        const glyph = growthGlyph(layout, 99, column, row);
        expect(glyph).not.toBe(" ");
        expect(glyph).not.toBe("#");
        if (glyph) {
          expect(glyph.charCodeAt(0)).toBeLessThan(128);
        }
      }
    }
  });
});
