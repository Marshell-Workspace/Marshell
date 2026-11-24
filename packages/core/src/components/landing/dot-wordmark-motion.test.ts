import { describe, expect, it } from "vitest";
import {
  DOT_WORDMARK_SECONDS,
  wordmarkIllumination,
} from "./dot-wordmark-motion";

const COLUMNS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];

describe("dot wordmark illumination", () => {
  it("reveals existing columns in strict left-to-right order", () => {
    expect(wordmarkIllumination(2.6, 0.1).level).toBe(1);
    expect(wordmarkIllumination(2.6, 0.5).level).toBeCloseTo(0.5);
    expect(wordmarkIllumination(2.6, 0.9).level).toBe(0);
    expect(wordmarkIllumination(3.3, 0.5).level).toBe(1);
    expect(wordmarkIllumination(3.3, 0.9).level).toBeGreaterThan(0);
    expect(wordmarkIllumination(3.3, 0.9).level).toBeLessThan(1);
  });

  it("keeps revealed columns lit until the dimming wave reaches them", () => {
    for (const column of COLUMNS) {
      let previous = 0;
      for (let time = 1; time <= 4.2; time += 0.05) {
        const { level } = wordmarkIllumination(time, column);
        expect(level).toBeGreaterThanOrEqual(previous);
        previous = level;
      }
      expect(wordmarkIllumination(4.5, column).level).toBe(1);
      expect(wordmarkIllumination(7.3, column).level).toBe(1);
    }
  });

  it("dims from left to right rather than reversing the reveal", () => {
    expect(wordmarkIllumination(9.0, 0.1).level).toBe(0);
    expect(wordmarkIllumination(9.0, 0.5).level).toBeCloseTo(0.5);
    expect(wordmarkIllumination(9.0, 0.9).level).toBe(1);
    for (const column of COLUMNS) {
      let previous = 1;
      for (let time = 7.4; time <= 10.6; time += 0.05) {
        const { level } = wordmarkIllumination(time, column);
        expect(level).toBeLessThanOrEqual(previous);
        previous = level;
      }
    }
  });

  it("keeps a feathered light front within brightness bounds", () => {
    const center = wordmarkIllumination(2.6, 0.5).wave;
    expect(center).toBeGreaterThan(wordmarkIllumination(2.6, 0.3).wave);
    expect(center).toBeGreaterThan(wordmarkIllumination(2.6, 0.7).wave);
    expect(wordmarkIllumination(2.6, 0.25).wave).toBeGreaterThan(0.4);
    expect(wordmarkIllumination(2.6, 0.75).wave).toBeGreaterThan(0.4);
    for (const column of COLUMNS) {
      for (let time = 0; time <= DOT_WORDMARK_SECONDS; time += 0.05) {
        const { level, wave } = wordmarkIllumination(time, column);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(1);
        expect(wave).toBeGreaterThanOrEqual(0);
        expect(wave).toBeLessThanOrEqual(1);
      }
    }
  });

  it("returns to the identical invisible field across the loop boundary", () => {
    for (const column of COLUMNS) {
      expect(wordmarkIllumination(0, column)).toEqual({ level: 0, wave: 0 });
      expect(wordmarkIllumination(DOT_WORDMARK_SECONDS, column)).toEqual({
        level: 0,
        wave: 0,
      });
      expect(wordmarkIllumination(DOT_WORDMARK_SECONDS + 2, column)).toEqual(
        wordmarkIllumination(2, column)
      );
    }
  });
});
