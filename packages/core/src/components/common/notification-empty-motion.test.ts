import { expect, it } from "vitest";
import {
  type NotificationSceneGeometry,
  notificationSceneFrame,
  SCENE_DURATION_SECONDS,
} from "./notification-empty-motion";

const layouts: NotificationSceneGeometry[] = [320, 345, 360].map((height) => ({
  height,
  scale: 1,
  anchor: { x: 247.95, y: height * 0.43 + 12 },
  card: {
    x: 131.1,
    y: height * (height > 320 ? 0.37 : 0.43),
    width: 233.7,
    height: height * (height > 320 ? 0.58 : 0.52),
  },
}));

it("keeps the gripping palm attached to the selected card edge in every layout", () => {
  for (const layout of layouts) {
    for (let step = 290; step <= 610; step += 1) {
      const pose = notificationSceneFrame(step / 1000, layout);
      expect(pose.hand.x).toBeGreaterThan(layout.card.x + 60);
      expect(pose.hand.x).toBeLessThan(layout.card.x + 80);
      expect(pose.hand.y).toBeCloseTo(
        layout.card.y + layout.card.height - 3 + pose.cardY,
        8
      );
    }
  }
});

it("keeps the painted arm joints finite and continuous through release and rest", () => {
  for (const layout of layouts) {
    let previous = notificationSceneFrame(0, layout);
    for (let step = 1; step <= 2000; step += 1) {
      const pose = notificationSceneFrame(step / 2000, layout);
      expect(pose.reach).toBeGreaterThan(74);
      expect(pose.reach).toBeLessThan(78);
      expect(pose.elbowBend).toBeGreaterThanOrEqual(0);
      expect(pose.elbowBend).toBeLessThanOrEqual(18);
      expect(pose.upperArmTransform).not.toMatch(/NaN|Infinity/);
      expect(pose.forearmTransform).not.toMatch(/NaN|Infinity/);
      expect(pose.wristFlex).toBe(0);
      expect(
        Math.hypot(pose.hand.x - previous.hand.x, pose.hand.y - previous.hand.y)
      ).toBeLessThan(1);
      previous = pose;
    }
  }
});

it("catches the falling card without resetting its velocity", () => {
  const catchAt = 0.76;
  const epsilon = 0.000_001;
  for (const layout of layouts) {
    const atCatch = notificationSceneFrame(catchAt, layout).cardY;
    const before = notificationSceneFrame(catchAt - epsilon, layout).cardY;
    const after = notificationSceneFrame(catchAt + epsilon, layout).cardY;
    const incoming = (atCatch - before) / (epsilon * SCENE_DURATION_SECONDS);
    const outgoing = (after - atCatch) / (epsilon * SCENE_DURATION_SECONDS);
    expect(incoming).toBeGreaterThan(0);
    expect(Math.abs(incoming - outgoing)).toBeLessThan(1);
  }
});

it("shows the impact reaction only after the catch and leaves a quiet final pose", () => {
  for (const layout of layouts) {
    expect(notificationSceneFrame(0.75, layout).impactOpacity).toBe(0);
    expect(notificationSceneFrame(0.83, layout).impactOpacity).toBeGreaterThan(
      0
    );
    const final = notificationSceneFrame(1, layout);
    expect(final.impactOpacity).toBe(0);
    expect(final.bellAngle).toBe(0);
    expect(final.cardAngle).toBe(0);
    expect(final.cardY).toBe(0);
    expect(final.hand.x).toBeGreaterThan(layout.card.x + 60);
    expect(final.hand.x).toBeLessThan(layout.card.x + 80);
    expect(final.hand.y).toBeCloseTo(layout.card.y - 2, 8);
  }
});

it("uses one shoulder lift and pull without independent wrist bending", () => {
  for (const layout of layouts) {
    for (const [start, end] of [
      [0.1, 0.29],
      [0.36, 0.61],
      [0.61, 0.99],
    ]) {
      if (start === undefined || end === undefined) {
        continue;
      }
      const first = notificationSceneFrame(start, layout).shoulderAngle;
      const last = notificationSceneFrame(end, layout).shoulderAngle;
      const direction = Math.sign(last - first);
      let previous = first;
      for (let step = 1; step <= 100; step += 1) {
        const pose = notificationSceneFrame(
          start + ((end - start) * step) / 100,
          layout
        );
        expect(
          (pose.shoulderAngle - previous) * direction
        ).toBeGreaterThanOrEqual(-0.000_001);
        expect(pose.wristFlex).toBe(0);
        previous = pose.shoulderAngle;
      }
    }
  }
});

it("bends the elbow during the pull and relaxes it on the card", () => {
  for (const layout of layouts) {
    expect(notificationSceneFrame(0.1, layout).elbowBend).toBe(0);
    expect(notificationSceneFrame(0.2, layout).elbowBend).toBeGreaterThan(0);
    expect(notificationSceneFrame(0.29, layout).elbowBend).toBe(10);
    expect(notificationSceneFrame(0.56, layout).elbowBend).toBe(18);
    expect(notificationSceneFrame(0.8, layout).elbowBend).toBeGreaterThan(0);
    expect(notificationSceneFrame(1, layout).elbowBend).toBe(0);
  }
});
