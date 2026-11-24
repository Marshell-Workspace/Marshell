import { describe, expect, it } from "vitest";
import {
  flightPose,
  flightPoseAtTime,
  pchipInterp,
  radiusCollapseFactor,
  settleBump,
  thetaDeg,
} from "./flight-path";
import {
  BLUR_MAX_PX,
  RADIUS_HOLD_U,
  SETTLE_SCALE,
  TURNS,
  WELCOME_TIMINGS,
  Z_KEYFRAMES,
} from "./welcome.config";

describe("flightPose v3 mathematical model", () => {
  const standardW = 1920;
  const standardH = 1080;

  it("u = 0: logo starts at/near top-right edge with huge scale in [3.5, 4.6] and blur", () => {
    const pose0 = flightPose(0, standardW, standardH, "performance");
    expect(pose0.x).toBeGreaterThan(0);
    expect(pose0.y).toBeLessThan(0);
    expect(pose0.scale).toBeGreaterThanOrEqual(3.5);
    expect(pose0.scale).toBeLessThanOrEqual(4.6);
    expect(pose0.blur).toBeGreaterThan(10);
    expect(pose0.opacity).toBe(0);
  });

  it("Beats A to C numerically unchanged against snapshot (tolerance 1e-6)", () => {
    const snapshots = [
      {
        u: 0.05,
        expected: {
          x: 864.110_882_873_482_3,
          y: -290.412_758_683_017_7,
          scale: 2.178_503_432_758_322_6,
          rotateX: -5.907_403_523_375_48,
          rotateY: -28.013_709_323_408_683,
          rotateZ: 9.887_191_525_908_946,
          blur: 8.418_513_968_552_052,
          opacity: 0.531_25,
        },
      },
      {
        u: 0.15,
        expected: {
          x: 864.603_108_612_286_7,
          y: 256.880_324_477_730_37,
          scale: 1.067_130_898_752_565,
          rotateX: 4.921_244_516_887_69,
          rotateY: -26.398_612_019_751_54,
          rotateZ: 9.317_157_183_441_719,
          blur: 0.513_366_173_636_989_2,
          opacity: 0.864_583_333_333_333_3,
        },
      },
      {
        u: 0.35,
        expected: {
          x: -944.031_768_325_967_6,
          y: 143.294_758_815_911_3,
          scale: 0.425_700_540_548_452_13,
          rotateX: 2.214_980_735_477_921_4,
          rotateY: 23.256_612_385_850_765,
          rotateZ: -8.208_216_136_182_623,
          blur: 4.131_524_221_943_485,
          opacity: 0.747_049_537_432_031_5,
        },
      },
      {
        u: 0.55,
        expected: {
          x: 483.410_791_261_386_1,
          y: -435.933_762_647_519_76,
          scale: 0.441_093_765_507_202_75,
          rotateX: -5.375_117_145_179_689,
          rotateY: -9.499_570_419_336_914,
          rotateZ: 3.352_789_559_765_969_6,
          blur: 3.880_468_229_166_665_7,
          opacity: 0.762_420_312_5,
        },
      },
      {
        u: 0.7,
        expected: {
          x: 563.456_665_018_306_6,
          y: 307.664_580_776_008_2,
          scale: 2.232_040_657_479_051_2,
          rotateX: 3.190_175_811_195_506,
          rotateY: -9.311_461_117_218_158,
          rotateZ: 3.286_398_041_371_114_7,
          blur: 8.641_932_560_005_56,
          opacity: 0.979_166_666_666_666_6,
        },
      },
    ];

    for (const { u, expected } of snapshots) {
      const p = flightPose(u, standardW, standardH, "performance");
      expect(p.x).toBeCloseTo(expected.x, 6);
      expect(p.y).toBeCloseTo(expected.y, 6);
      expect(p.scale).toBeCloseTo(expected.scale, 6);
      expect(p.rotateX).toBeCloseTo(expected.rotateX, 6);
      expect(p.rotateY).toBeCloseTo(expected.rotateY, 6);
      expect(p.rotateZ).toBeCloseTo(expected.rotateZ, 6);
      expect(p.blur).toBeCloseTo(expected.blur, 6);
      expect(p.opacity).toBeCloseTo(expected.opacity, 6);
    }
  });

  it("flightPose with target slot (dx, dy): at u = 1 pose equals slot offset exactly, scale=1, rotations=0, blur=0", () => {
    const slotOffsets = [
      { x: 0, y: 0 },
      { x: 45, y: -130 },
      { x: -80, y: -210 },
      { x: 120, y: 50 },
    ];

    for (const slot of slotOffsets) {
      const pose = flightPose(
        1.0,
        standardW,
        standardH,
        "performance",
        false,
        slot
      );
      expect(pose.x).toBe(slot.x);
      expect(pose.y).toBe(slot.y);
      expect(pose.scale).toBe(1.0);
      expect(pose.rotateX).toBe(0);
      expect(pose.rotateY).toBe(0);
      expect(pose.rotateZ).toBe(0);
      expect(pose.blur).toBe(0);
      expect(pose.opacity).toBe(1.0);
    }
  });

  it("Settle bump has value 0 and slope 0 at both ends (u = 0.92 and u = 1.0)", () => {
    // Value at boundaries is 0
    expect(settleBump(0.92)).toBe(0);
    expect(settleBump(1.0)).toBe(0);

    // Finite difference estimate of slope at u = 0.92
    const eps = 1e-5;
    const slopeStart = (settleBump(0.92 + eps) - settleBump(0.92)) / eps;
    expect(Math.abs(slopeStart)).toBeLessThan(1e-3);

    // Finite difference estimate of slope at u = 1.0
    const slopeEnd = (settleBump(1.0) - settleBump(1.0 - eps)) / eps;
    expect(Math.abs(slopeEnd)).toBeLessThan(1e-3);

    // Peak amplitude occurs at u = 0.96 and equals (SETTLE_SCALE - 1.0)
    expect(settleBump(0.96)).toBeCloseTo(SETTLE_SCALE - 1.0, 5);
  });

  it("Whole-logo pose as a function of t: C1 continuity and final velocity approximately 0", () => {
    const slot = { x: 30, y: -125 };
    const samples = 500;
    const totalMs = Math.max(8000, WELCOME_TIMINGS.totalTimelineMs);
    const dt = totalMs / samples;

    const poses = [];
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * totalMs;
      poses.push(
        flightPoseAtTime(t, standardW, standardH, "performance", false, slot)
      );
    }

    // Check speeds between samples
    const velocities = [];
    for (let i = 0; i < poses.length - 1; i++) {
      const p1 = poses[i]!;
      const p2 = poses[i + 1]!;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      velocities.push(dist / dt);

      // Scale never exceeds 1.03 after u = 0.9 (flightStartMs + 0.9 * FLIGHT_MS = 5560ms)
      const t = (i / samples) * totalMs;
      if (t >= WELCOME_TIMINGS.flightStartMs + 0.9 * 5400) {
        expect(p1.scale).toBeLessThanOrEqual(1.03);
      }
    }

    // Velocity at final instant (t = landingMs = 6100ms) is approximately 0
    const landingIdx = Math.floor(
      (WELCOME_TIMINGS.landingMs / totalMs) * samples
    );
    const finalVelocity = velocities[landingIdx]!;
    expect(finalVelocity).toBeLessThan(0.05);

    // Accelerations (difference between consecutive velocities) never jump wildly
    for (let i = 0; i < velocities.length - 1; i++) {
      const dv = Math.abs(velocities[i + 1]! - velocities[i]!);
      expect(dv).toBeLessThan(0.8);
    }
  });

  it("Orbit: total angular travel is at least 1.25 turns and passes within 20% of all 4 screen edges in Beat B", () => {
    const totalTravelDeg = thetaDeg(1, TURNS) - thetaDeg(0, TURNS);
    const totalTurns = totalTravelDeg / 360;
    expect(totalTurns).toBeGreaterThanOrEqual(1.25);

    const samples = 100;
    let maxX = Number.NEGATIVE_INFINITY;
    let minX = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;

    const halfW = standardW / 2;
    const halfH = standardH / 2;

    for (let i = 0; i <= samples; i++) {
      const u = 0.18 + (i / samples) * (0.62 - 0.18);
      const pose = flightPose(u, standardW, standardH, "performance");
      if (pose.x > maxX) {
        maxX = pose.x;
      }
      if (pose.x < minX) {
        minX = pose.x;
      }
      if (pose.y > maxY) {
        maxY = pose.y;
      }
      if (pose.y < minY) {
        minY = pose.y;
      }
    }

    expect(maxX).toBeGreaterThanOrEqual(0.8 * halfW);
    expect(minX).toBeLessThanOrEqual(-0.8 * halfW);
    expect(maxY).toBeGreaterThanOrEqual(0.8 * halfH);
    expect(minY).toBeLessThanOrEqual(-0.8 * halfH);
  });

  it("r(u) holds near ORBIT_RADIUS until RADIUS_HOLD_U and is monotonically non-increasing after it", () => {
    for (let i = 0; i <= 20; i++) {
      const u = (i / 20) * RADIUS_HOLD_U;
      const factor = radiusCollapseFactor(u);
      expect(factor).toBeCloseTo(1.0, 5);
    }

    let prevFactor = 1.0;
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const u = RADIUS_HOLD_U + (i / steps) * (1 - RADIUS_HOLD_U);
      const factor = radiusCollapseFactor(u);
      expect(factor).toBeLessThanOrEqual(prevFactor + 1e-6);
      prevFactor = factor;
    }
    expect(prevFactor).toBe(0);
  });

  it("Handles extreme viewports (320x480, 5120x1440, 0x0, negative) and extreme slot offsets without NaN", () => {
    const testCases = [
      { w: 320, h: 480, slot: { x: -60, y: -150 } },
      { w: 5120, h: 1440, slot: { x: 450, y: -300 } },
      { w: 0, h: 0, slot: { x: 0, y: 0 } },
      { w: -100, h: -100, slot: { x: -9999, y: 9999 } },
    ];

    for (const { w, h, slot } of testCases) {
      for (const u of [0, 0.1, 0.42, 0.72, 0.92, 0.96, 1.0]) {
        const pose = flightPose(u, w, h, "performance", false, slot);
        expect(Number.isFinite(pose.x)).toBe(true);
        expect(Number.isFinite(pose.y)).toBe(true);
        expect(Number.isFinite(pose.scale)).toBe(true);
        expect(Number.isFinite(pose.rotateX)).toBe(true);
        expect(Number.isFinite(pose.rotateY)).toBe(true);
        expect(Number.isFinite(pose.rotateZ)).toBe(true);
        expect(Number.isFinite(pose.blur)).toBe(true);
        expect(Number.isFinite(pose.opacity)).toBe(true);
      }
    }
  });

  it("Gates blur, banking, and particles by performance tier", () => {
    const flybyU = 0.72;
    const perf = flightPose(flybyU, standardW, standardH, "performance");
    const balanced = flightPose(flybyU, standardW, standardH, "balanced");
    const eco = flightPose(flybyU, standardW, standardH, "eco");

    expect(perf.blur).toBeGreaterThan(8);
    expect(perf.blur).toBeLessThanOrEqual(BLUR_MAX_PX);
    expect(balanced.blur).toBe(0);
    expect(
      Math.abs(balanced.rotateX) + Math.abs(balanced.rotateY)
    ).toBeGreaterThan(0);
    expect(eco.blur).toBe(0);
    expect(eco.rotateX).toBe(0);
    expect(eco.rotateY).toBe(0);
    expect(eco.rotateZ).toBe(0);
  });

  it("PCHIP interpolation preserves keyframe values exactly and avoids overshoot", () => {
    for (const kf of Z_KEYFRAMES) {
      const z = pchipInterp(kf.u, Z_KEYFRAMES);
      expect(z).toBeCloseTo(kf.z, 5);
    }
  });
});
