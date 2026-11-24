import { describe, expect, it } from "vitest";
import { SCENE_SECONDS, TRANSITION_SECONDS } from "./ascii-timeline";
import {
  HELICOPTER_GEAR,
  helicopterPose,
  MAIN_ROTOR,
  rotorTip,
} from "./helicopter-scene";

describe("four-blade helicopter rotor", () => {
  it("flies rightward below the center with proportionate small tires", () => {
    let previous = helicopterPose(0).x;
    for (
      let frame = 1;
      frame <= (SCENE_SECONDS + TRANSITION_SECONDS) * 60;
      frame++
    ) {
      const pose = helicopterPose(frame / 60);
      expect(pose.x).toBeGreaterThan(previous);
      expect(pose.y).toBeGreaterThan(45);
      expect(pose.pitch).toBeGreaterThan(0.07);
      expect(pose.pitch).toBeLessThan(0.1);
      expect(pose.x + MAIN_ROTOR.radius + 12).toBeLessThan(400);
      expect(pose.x - 345).toBeGreaterThan(-400);
      previous = pose.x;
    }
    expect(HELICOPTER_GEAR.mainRadius).toBeLessThan(10);
    expect(HELICOPTER_GEAR.tailRadius).toBeLessThan(HELICOPTER_GEAR.mainRadius);
  });
  it("holds all four blades at rigid radii and equally spaced angular offsets", () => {
    expect(MAIN_ROTOR.blades).toBe(4);
    for (let frame = 0; frame < 180; frame++) {
      const time = frame / 60;
      const tips = Array.from({ length: 4 }, (_, index) =>
        rotorTip(time, index)
      );
      for (let index = 0; index < 4; index++) {
        const tip = tips[index];
        const next = tips[(index + 1) % 4];
        const opposite = tips[(index + 2) % 4];
        if (!(tip && next && opposite)) {
          throw new Error("Missing rotor blade");
        }
        expect(Math.hypot(tip[0], tip[1] / MAIN_ROTOR.projection)).toBeCloseTo(
          MAIN_ROTOR.radius,
          10
        );
        expect(
          tip[0] * next[0] + (tip[1] * next[1]) / MAIN_ROTOR.projection ** 2
        ).toBeCloseTo(0, 7);
        expect(tip[0] + opposite[0]).toBeCloseTo(0, 10);
        expect(tip[1] + opposite[1]).toBeCloseTo(0, 10);
      }
    }
  });
});
