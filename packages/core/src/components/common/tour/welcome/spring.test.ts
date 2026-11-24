import { describe, expect, it } from "vitest";
import { evaluateSpring } from "./spring";

describe("evaluateSpring analytical underdamped spring", () => {
  it("returns initial conditions at t <= 0", () => {
    const res = evaluateSpring(0, {
      stiffness: 150,
      damping: 14,
      initial: 0,
      target: 1,
    });
    expect(res.value).toBe(0);
    expect(res.velocity).toBe(0);
    expect(res.scaleY).toBe(1.0);
  });

  it("converges to target value as t becomes large", () => {
    const res = evaluateSpring(2.5, {
      stiffness: 150,
      damping: 14,
      initial: 0,
      target: 1,
    });
    expect(res.value).toBeCloseTo(1.0, 3);
    expect(Math.abs(res.velocity)).toBeLessThan(0.01);
    expect(res.scaleY).toBeCloseTo(1.0, 3);
  });

  it("produces visible underdamped overshoot and oscillation", () => {
    let maxOvershoot = 0;
    for (let i = 1; i <= 100; i++) {
      const t = i * 0.01;
      const res = evaluateSpring(t, {
        stiffness: 150,
        damping: 14,
        initial: 0,
        target: 1,
      });
      if (res.value > maxOvershoot) {
        maxOvershoot = res.value;
      }
    }
    // Should overshoot 1.0 by ~10% to 18%
    expect(maxOvershoot).toBeGreaterThan(1.08);
    expect(maxOvershoot).toBeLessThan(1.25);
  });

  it("compresses scaleY during peak velocity (volume-preserving squash & stretch)", () => {
    let minScaleY = 1.0;
    for (let i = 1; i <= 50; i++) {
      const t = i * 0.01;
      const res = evaluateSpring(
        t,
        { stiffness: 150, damping: 14, initial: 0, target: 1 },
        0.08
      );
      if (res.scaleY < minScaleY) {
        minScaleY = res.scaleY;
      }
    }
    expect(minScaleY).toBeLessThan(0.98);
    expect(minScaleY).toBeGreaterThan(0.9);
  });

  it("analytical velocity matches finite difference numerical derivative within tolerance", () => {
    const eps = 1e-5;
    for (const t of [0.05, 0.15, 0.3, 0.6]) {
      const p1 = evaluateSpring(t, {
        stiffness: 160,
        damping: 15,
        initial: 0,
        target: 1,
      });
      const p2 = evaluateSpring(t + eps, {
        stiffness: 160,
        damping: 15,
        initial: 0,
        target: 1,
      });
      const numericalVel = (p2.value - p1.value) / eps;
      expect(p1.velocity).toBeCloseTo(numericalVel, 2);
    }
  });
});
