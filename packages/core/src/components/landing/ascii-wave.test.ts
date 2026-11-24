import { describe, expect, it } from "vitest";
import {
  SCENE_SECONDS,
  sceneFrameTimes,
  TRANSITION_SECONDS,
} from "./ascii-timeline";
import { waveIllumination, waveReveal } from "./ascii-wave";
import { rotorTip } from "./helicopter-scene";

describe("wide white formation wave", () => {
  it("starts and ends on the exact live scenes without residual wave light", () => {
    for (const x of [0, 0.25, 0.5, 0.75, 1]) {
      for (const y of [0, 0.5, 1]) {
        expect(waveReveal(0, x, y)).toBe(0);
        expect(waveReveal(1, x, y)).toBe(1);
      }
    }
    expect(waveIllumination(0, 0.9)).toBe(0);
    expect(waveIllumination(1, 0.9)).toBe(0);
  });

  it("forms the new picture from left to right through a broad gradual front", () => {
    expect(waveReveal(0.5, 0.05, 0.5)).toBeGreaterThan(0.95);
    expect(waveReveal(0.5, 0.95, 0.5)).toBeLessThan(0.05);
    let mixedColumns = 0;
    for (let column = 0; column <= 100; column++) {
      const x = column / 100;
      const value = waveReveal(0.5, x, 0.5);
      if (value > 0.01 && value < 0.99) {
        mixedColumns++;
      }
      let previous = 0;
      for (let step = 0; step <= 100; step++) {
        const next = waveReveal(step / 100, x, 0.5);
        expect(next).toBeGreaterThanOrEqual(previous);
        expect(next - previous).toBeLessThan(0.05);
        previous = next;
      }
    }
    expect(mixedColumns).toBeGreaterThan(85);
  });

  it("carries dark, medium and light white letters together", () => {
    expect(waveIllumination(0.5, 0.1)).toBeCloseTo(0.18);
    expect(waveIllumination(0.5, 0.5)).toBeCloseTo(0.46);
    expect(waveIllumination(0.5, 0.9)).toBeCloseTo(0.94);
  });

  it("keeps incoming and outgoing rotor phases advancing throughout the transition", () => {
    for (
      let local = SCENE_SECONDS - TRANSITION_SECONDS + 0.1;
      local < SCENE_SECONDS - 0.1;
      local += 0.1
    ) {
      const current = sceneFrameTimes(local, "helicopter");
      const next = sceneFrameTimes(local + 1 / 60, "helicopter");
      for (const clock of ["source", "target"] as const) {
        expect(next[clock] - current[clock]).toBeCloseTo(1 / 60, 10);
        const a = rotorTip(current[clock], 0);
        const b = rotorTip(next[clock], 0);
        expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeGreaterThan(10);
      }
    }
    expect(sceneFrameTimes(SCENE_SECONDS, "helicopter").target).toBeCloseTo(
      sceneFrameTimes(0, "people").source,
      10
    );
  });

  it("never sends a second wave through the continuous workstation action", () => {
    for (let frame = 0; frame <= SCENE_SECONDS * 60; frame++) {
      const clocks = sceneFrameTimes(frame / 60, "coder");
      expect(clocks.progress).toBe(0);
      expect(waveIllumination(waveReveal(clocks.progress, 0.5, 0.5), 0.9)).toBe(
        0
      );
    }
    for (const phase of [
      "people",
      "marshell",
      "growth",
      "helicopter",
    ] as const) {
      expect(sceneFrameTimes(8.4, phase).progress).toBeGreaterThan(0);
    }
  });
});
