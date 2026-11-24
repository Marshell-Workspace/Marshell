import { describe, expect, it } from "vitest";
import { asciiFlameClock, asciiFlameOffsets } from "./ascii-flame";
import {
  GROWTH_TIMING,
  growthState,
  SCENE_NAMES,
  SCENE_SECONDS,
  TRANSITION_SECONDS,
  workstationTime,
} from "./ascii-timeline";
import { computeFlameWavePoint } from "./avatar-flame-geometry";

describe("ASCII scene choreography", () => {
  it("keeps the workstation continuation and adds the helicopter before looping", () => {
    expect(SCENE_NAMES).toEqual([
      "people",
      "marshell",
      "coder",
      "growth",
      "helicopter",
    ]);
  });

  it("starts growth only after the mascot finishes entering the display", () => {
    expect(growthState(0).entry).toBe(0);
    expect(growthState(GROWTH_TIMING.entryEnd).entry).toBe(1);
    expect(GROWTH_TIMING.start).toBeGreaterThan(GROWTH_TIMING.entryEnd);
    expect(growthState(GROWTH_TIMING.start).percent).toBe(0);
    expect(growthState(4.5).percent).toBe(50);
    expect(SCENE_SECONDS * SCENE_NAMES.length).toBe(50);
    expect(TRANSITION_SECONDS).toBe(3.2);
  });

  it("increases monotonically to 99 and holds without ever showing 100", () => {
    let previous = 0;
    for (let frame = 0; frame <= 900; frame++) {
      const { percent } = growthState(frame / 60);
      expect(percent).toBeGreaterThanOrEqual(previous);
      expect(percent).toBeLessThanOrEqual(99);
      previous = percent;
    }
    expect(growthState(GROWTH_TIMING.end).percent).toBe(99);
    expect(growthState(SCENE_SECONDS - TRANSITION_SECONDS).percent).toBe(99);
  });

  it("continues the same workstation clock at the exact scene boundary", () => {
    expect(workstationTime("coder", SCENE_SECONDS + TRANSITION_SECONDS)).toBe(
      workstationTime("growth", TRANSITION_SECONDS)
    );
  });

  it("keeps broad flame motion independent and slow between frames", () => {
    const offsets = asciiFlameOffsets(2);
    expect(offsets.c_tip_x).not.toBe(offsets.l_tip_x);
    expect(offsets.l_tip_x).not.toBe(offsets.r_tip_x);
    for (let frame = 0; frame < 600; frame++) {
      const current = asciiFlameOffsets(frame / 60);
      const next = asciiFlameOffsets((frame + 1) / 60);
      for (const key of Object.keys(current) as (keyof typeof current)[]) {
        expect(Math.abs(current[key])).toBeLessThanOrEqual(48);
        expect(Math.abs(next[key] - current[key])).toBeLessThan(1);
      }
    }
  });

  it("moves the middle of all three flames while anchoring the lower body", () => {
    const zones = [
      { zone: "central", x: 242, y: 150, minimumSpan: 20 },
      { zone: "left", x: 102, y: 198, minimumSpan: 14 },
      { zone: "right", x: 374, y: 170, minimumSpan: 18 },
    ] as const;
    for (const { zone, x, y, minimumSpan } of zones) {
      const positions = Array.from(
        { length: 240 },
        (_, frame) =>
          computeFlameWavePoint(
            x,
            y,
            zone,
            asciiFlameClock(frame / 24),
            1.25,
            1,
            "balanced"
          )[0]
      );
      expect(Math.max(...positions) - Math.min(...positions)).toBeGreaterThan(
        minimumSpan
      );
      expect(
        computeFlameWavePoint(
          240,
          300,
          zone,
          asciiFlameClock(3),
          1.25,
          1,
          "balanced"
        )
      ).toEqual([240, 300]);
    }
  });
});
