import { describe, expect, it } from "vitest";
import {
  progressGeometry,
  typingPose,
  WORKSTATION,
} from "./workstation-geometry";

describe("workstation interaction", () => {
  it("uses exactly the displayed percentage as the bar's filled fraction", () => {
    for (let frame = 0; frame <= 720; frame++) {
      const state = progressGeometry(frame / 60);
      const renderedFraction =
        (state.right - state.left) /
        (WORKSTATION.progressRight - WORKSTATION.progressLeft);
      expect(renderedFraction).toBeCloseTo(state.percent / 100, 12);
    }
    expect(progressGeometry(3).percent).toBe(0);
    expect(progressGeometry(4.5).percent).toBe(50);
    expect(progressGeometry(6).fraction).toBe(0.99);
  });

  it("keeps wrists on the keyboard while fingers type", () => {
    for (const near of [false, true]) {
      const initial = typingPose(0, near);
      for (const time of [0.5, 1.5, 4, 9]) {
        const pose = typingPose(time, near);
        expect(pose.wrist).toEqual(initial.wrist);
        const contactY = pose.wrist[1] + 4;
        expect(contactY).toBeGreaterThanOrEqual(WORKSTATION.keyboardTop);
        expect(contactY).toBeLessThanOrEqual(WORKSTATION.keyboardBottom);
        const upper = Math.hypot(
          pose.elbow[0] - pose.shoulder[0],
          pose.elbow[1] - pose.shoulder[1]
        );
        const lower = Math.hypot(
          pose.wrist[0] - pose.elbow[0],
          pose.wrist[1] - pose.elbow[1]
        );
        expect(lower / upper).toBeGreaterThan(0.8);
        expect(lower / upper).toBeLessThan(1.2);
      }
    }
  });

  it("keeps the laptop supported by the desktop and knees below its underside", () => {
    expect(WORKSTATION.laptopBottom).toBeLessThanOrEqual(WORKSTATION.tableTop);
    expect(WORKSTATION.tableTop - WORKSTATION.laptopBottom).toBeLessThan(4);
    expect(93).toBeGreaterThan(WORKSTATION.tableBottom);
  });
});
