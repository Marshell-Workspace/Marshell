import { describe, expect, it } from "vitest";
import {
  ASCII_BACKGROUND,
  ASCII_LAYOUT,
  fieldPalette,
  reconstructionProgress,
} from "./ascii-field";

describe("reference ASCII field", () => {
  it("leaves horizontal and vertical breathing room around the monospace glyphs", () => {
    expect(ASCII_LAYOUT.cellWidth).toBeGreaterThan(
      ASCII_LAYOUT.fontSize * 0.6 + 1
    );
    expect(ASCII_LAYOUT.cellHeight).toBeGreaterThan(ASCII_LAYOUT.fontSize);
  });

  it("starts at the old image and completes the new image for every local phase", () => {
    for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
      expect(reconstructionProgress(0, phase)).toBe(0);
      expect(reconstructionProgress(1, phase)).toBe(1);
    }
  });

  it("changes image tone continuously without a directional front", () => {
    for (const phase of [0, 0.5, 1]) {
      let previous = 0;
      for (let step = 0; step <= 100; step++) {
        const value = reconstructionProgress(step / 100, phase);
        expect(value).toBeGreaterThanOrEqual(previous);
        expect(value - previous).toBeLessThan(0.03);
        previous = value;
      }
    }
  });

  it("uses neutral grey-white ink on a pure black field", () => {
    expect(ASCII_BACKGROUND).toBe("#000000");
    expect(fieldPalette(0)).toBe("rgb(38,38,38)");
    expect(fieldPalette(31)).toBe("rgb(255,255,255)");
  });
});
