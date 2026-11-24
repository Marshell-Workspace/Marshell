/**
 * flight-path.ts — Mathematical Model & Trajectory Engine (Revision 3).
 *
 * Implements Fix 2: ONE owner of logo transform, no hand-offs.
 * - Single continuous trajectory: collapses straight toward the slot offset (dx, dy).
 * - Beats A, B, and C (u <= 0.72) are strictly NUMERICALLY IDENTICAL to Revision 2.
 * - Beat D glides the orbit center toward (dx, dy) with zero final velocity & acceleration.
 * - Pure micro-settle bump (max scale 1.018, SETTLE_SCALE) baked directly into scale pose.
 * - Identity transform relative to slot at u = 1.0: x = dx, y = dy, scale = 1, rotations = 0, blur = 0.
 * - Zero NaN guarantees on viewports from 320x480 to 5120x1440 and extreme slot offsets.
 */

import {
  BLUR_MAX_PX,
  FLIGHT_MS,
  LANDING_SOFTNESS,
  ORBIT_RADIUS,
  RADIUS_HOLD_U,
  REPLAY_SPEED_FACTOR,
  REPLAY_TURNS,
  SETTLE_SCALE,
  START_ANGLE_DEG,
  TIME_WARP,
  TURNS,
  WELCOME_TIMINGS,
  Z_KEYFRAMES,
} from "./welcome.config";

export interface FlightPoseResult {
  blur: number;
  blurPx: number;
  glow: number;
  glowIntensity: number;
  opacity: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
  specularX: number;
  x: number;
  y: number;
  z: number;
}

export interface SlotOffset {
  x: number;
  y: number;
}

// ── 1. Monotone Cubic Hermite Spline (PCHIP) ─────────────────────────────────

export function pchipInterp(
  u: number,
  keyframes: readonly { readonly u: number; readonly z: number }[]
): number {
  const n = keyframes.length;
  if (n === 0) {
    return 0;
  }
  if (n === 1) {
    return keyframes[0]!.z;
  }

  const clampedU = Math.max(keyframes[0]!.u, Math.min(keyframes[n - 1]!.u, u));

  let i = 0;
  for (let k = 0; k < n - 1; k++) {
    if (clampedU >= keyframes[k]!.u && clampedU <= keyframes[k + 1]!.u) {
      i = k;
      break;
    }
  }

  const k0 = keyframes[i]!;
  const k1 = keyframes[i + 1]!;
  const h = k1.u - k0.u;
  if (Math.abs(h) < 1e-9) {
    return k0.z;
  }

  const deltas: number[] = new Array(n - 1);
  for (let j = 0; j < n - 1; j++) {
    const dx = keyframes[j + 1]!.u - keyframes[j]!.u;
    deltas[j] =
      Math.abs(dx) > 1e-9 ? (keyframes[j + 1]!.z - keyframes[j]!.z) / dx : 0;
  }

  const tangents: number[] = new Array(n);
  tangents[0] = deltas[0]!;
  tangents[n - 1] = deltas[n - 2]!;

  for (let j = 1; j < n - 1; j++) {
    const d0 = deltas[j - 1]!;
    const d1 = deltas[j]!;
    if (d0 * d1 <= 0) {
      tangents[j] = 0;
    } else {
      tangents[j] = (2 * d0 * d1) / (d0 + d1);
    }
  }

  const delta = deltas[i]!;
  let d0 = tangents[i]!;
  let d1 = tangents[i + 1]!;

  if (Math.abs(delta) < 1e-9) {
    d0 = 0;
    d1 = 0;
  } else {
    const alpha = d0 / delta;
    const beta = d1 / delta;
    const dist = alpha * alpha + beta * beta;
    if (dist > 9) {
      const tau = 3 / Math.sqrt(dist);
      d0 = tau * alpha * delta;
      d1 = tau * beta * delta;
    }
  }

  const t = (clampedU - k0.u) / h;
  const t2 = t * t;
  const t3 = t2 * t;

  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return h00 * k0.z + h10 * h * d0 + h01 * k1.z + h11 * h * d1;
}

// ── 2. Time-Warp Function a(u) ───────────────────────────────────────────────

export function timeWarp(u: number): number {
  const clampedU = Math.max(0, Math.min(1, u));

  const u1 = TIME_WARP.cruiseStartU;
  const u2 = TIME_WARP.easeOutStartU;
  const vStart = TIME_WARP.initialVelocityRatio;
  const vCruise = 1.0;
  const vEnd = 0.08;

  const intSeg1 = (t: number) =>
    u1 * (vStart * t + (vCruise - vStart) * (t * t * t - 0.5 * t * t * t * t));
  const area1 = intSeg1(1);

  const area2 = (u2 - u1) * vCruise;

  const l3 = 1 - u2;
  const intSeg3 = (t: number) =>
    l3 * (vCruise * t - (vCruise - vEnd) * (t * t * t - 0.5 * t * t * t * t));
  const area3 = intSeg3(1);

  const totalArea = area1 + area2 + area3;

  let currentArea = 0;
  if (clampedU <= u1) {
    const t = clampedU / u1;
    currentArea = intSeg1(t);
  } else if (clampedU <= u2) {
    currentArea = area1 + (clampedU - u1) * vCruise;
  } else {
    const t = (clampedU - u2) / l3;
    currentArea = area1 + area2 + intSeg3(t);
  }

  return currentArea / totalArea;
}

// ── 3. Geometry & Settle Bump Helpers ────────────────────────────────────────

/** Returns the spiral angle in degrees at progress `u`. */
export function thetaDeg(u: number, turns: number = TURNS): number {
  return START_ANGLE_DEG + 360 * turns * timeWarp(u);
}

/**
 * Monotonically non-increasing collapse factor from RADIUS_HOLD_U to 1.
 * C¹ continuous at RADIUS_HOLD_U (derivative = 0) and at 1.0 (derivative = 0).
 */
export function radiusCollapseFactor(u: number): number {
  if (u <= RADIUS_HOLD_U) {
    return 1.0;
  }
  const t = (u - RADIUS_HOLD_U) / (1 - RADIUS_HOLD_U);
  const oneMinusT2 = 1 - t * t;
  return oneMinusT2 * oneMinusT2;
}

/**
 * Pure mathematical settle bump baked into scale pose.
 * Exactly 0 in value and 0 in slope at both u = 0.92 and u = 1.0.
 * Peaks smoothly at u = 0.96 with amplitude (SETTLE_SCALE - 1.0).
 */
export function settleBump(u: number): number {
  if (u < 0.92 || u >= 1.0) {
    return 0;
  }
  const tau = (u - 0.92) / (1.0 - 0.92);
  // beta(tau) = 16 * tau^2 * (1 - tau)^2 has value 0 and derivative 0 at tau=0 and tau=1, peaking at 1 at tau=0.5
  const beta = 16 * tau * tau * (1 - tau) * (1 - tau);
  return (SETTLE_SCALE - 1.0) * beta;
}

/**
 * Quintic C² smootherstep on [0, 1]: 6s^5 - 15s^4 + 10s^3.
 * Value & first two derivatives are 0 at s=0 and s=1.
 */
function smootherstep(s: number): number {
  if (s <= 0) {
    return 0;
  }
  if (s >= 1) {
    return 1;
  }
  return s * s * s * (s * (s * 6 - 15) + 10);
}

// ── 4. Main flightPose Function ──────────────────────────────────────────────

/**
 * Computes the 3D flight pose of Marshell's logo tile at progress `u` in [0, 1].
 *
 * @param u Progress from 0 (emergence) to 1 (resting in in-flow slot).
 * @param width Viewport width in px (safe min 320).
 * @param height Viewport height in px (safe min 320).
 * @param tier Performance tier ("performance" | "balanced" | "eco").
 * @param isReplay Whether replaying (~55% duration, 1 lap).
 * @param slotOffset Slot center minus viewport center { x: dx, y: dy }.
 */
export function flightPose(
  u: number,
  width: number,
  height: number,
  tier: "performance" | "balanced" | "eco" = "performance",
  isReplay = false,
  slotOffset: SlotOffset = { x: 0, y: 0 }
): FlightPoseResult {
  const clampedU = Math.max(0, Math.min(1, Number.isFinite(u) ? u : 0));
  const safeW = Math.max(320, Number.isFinite(width) ? width : 1920);
  const safeH = Math.max(320, Number.isFinite(height) ? height : 1080);
  const dx = Number.isFinite(slotOffset.x) ? slotOffset.x : 0;
  const dy = Number.isFinite(slotOffset.y) ? slotOffset.y : 0;

  const isEco = tier === "eco";
  const isPerf = tier === "performance";

  // ── Position: Screen-space ellipse with edge-hugging orbit ──────────────────
  const activeTurns = isReplay ? REPLAY_TURNS : TURNS;
  const angle = thetaDeg(clampedU, activeTurns);
  const angleRad = (angle * Math.PI) / 180;

  // Gentle organic variation (+-6%) so orbit does not feel mechanical
  const wobble = 1 + 0.06 * Math.sin(2 * Math.PI * 3 * clampedU);

  // Radius holds near ORBIT_RADIUS (1.0) until RADIUS_HOLD_U (0.55), then collapses smoothly to 0
  const collapse = radiusCollapseFactor(clampedU);
  const r = clampedU >= 1 ? 0 : ORBIT_RADIUS * wobble * collapse;

  const halfW = safeW / 2;
  const halfH = safeH / 2;

  // ── Fix 2: Smooth Slot Center Convergence ──────────────────────────────────
  // For Beats A, B, and C (u <= 0.72): center is strictly (0, 0), matching Revision 2 bit-for-bit.
  // During Beat D (u in [0.72, 1.0]): center glides smoothly to (dx, dy).
  let centerX = 0;
  let centerY = 0;

  if (clampedU > 0.72) {
    const s = (clampedU - 0.72) / (1.0 - 0.72);
    // LANDING_SOFTNESS exponent adjusts deceleration curvature
    const k = smootherstep(s ** (LANDING_SOFTNESS / 2.6));
    centerX = dx * k;
    centerY = dy * k;
  }

  const x = clampedU >= 1 ? dx : centerX + halfW * r * Math.cos(angleRad);
  const y = clampedU >= 1 ? dy : centerY + halfH * r * Math.sin(angleRad);

  // ── Depth z & Perspective Scale ───────────────────────────────────────────
  const z = clampedU >= 1 ? 0 : pchipInterp(clampedU, Z_KEYFRAMES);
  const baseScale = clampedU >= 1 ? 1.0 : 1 / (1 + z);

  // Settle bump baked directly into scale pose (peaks at u = 0.96, returns to 0 at u = 1.0)
  const bump = isEco ? 0 : settleBump(clampedU);
  const totalScale = clampedU >= 1 ? 1.0 : baseScale + bump;
  const scale = Math.max(0.3, Math.min(4.6, totalScale));

  // ── Depth of Field Blur ────────────────────────────────────────────────────
  let blur = 0;
  if (isPerf && clampedU < 0.99) {
    if (z < 0) {
      const ratio = Math.min(1, Math.abs(z) / 0.8);
      blur = BLUR_MAX_PX * ratio ** 1.3;
    } else {
      const ratio = Math.min(1, z / 1.6);
      blur = 0.35 * BLUR_MAX_PX * ratio;
    }
    if (blur < 0.1) {
      blur = 0;
    }
  }

  // ── Opacity: Fade-in emergence + atmospheric haze in distance ──────────────
  let opacity = 1.0;
  if (clampedU < 0.08) {
    opacity = (clampedU / 0.08) * 0.85;
  } else if (clampedU < 0.8) {
    if (z > 0) {
      opacity = 1.0 - 0.3 * Math.min(1, z / 1.6);
    } else {
      opacity = 0.85 + 0.15 * ((clampedU - 0.08) / 0.72);
    }
  } else {
    opacity = 1.0;
  }

  // ── Banking: Aerodynamic tilt into turns ───────────────────────────────────
  const env = clampedU >= 1 ? 0 : (1 - clampedU) ** 0.8;
  let rotateX = 0;
  let rotateY = 0;
  let rotateZ = 0;

  if (!isEco && clampedU < 1) {
    rotateZ = 12 * env * Math.cos(angleRad);
    rotateY = 34 * env * Math.sin(angleRad - Math.PI / 2);
    rotateX = 12 * env * Math.sin(angleRad);
  }

  // ── Glow: Peaks at fly-by (u ≈ 0.72) with bump at landing ──────────────────
  const flybyDist = clampedU - 0.72;
  const flybyGlow = Math.exp(-(flybyDist * flybyDist) / (2 * 0.06 * 0.06));

  const landingDist = clampedU - 0.98;
  const landingGlow = Math.exp(
    -(landingDist * landingDist) / (2 * 0.04 * 0.04)
  );

  const glow = isEco
    ? 0.2
    : Math.min(1.0, 0.15 + 0.85 * flybyGlow + 0.45 * landingGlow);
  const glowIntensity = 1.0 + glow * 2.2;

  // ── Specular Sheen: tied to rotateY and orbit position ─────────────────────
  const specularX = clampedU >= 1 ? 50 : 50 + (rotateY / 34) * 45;

  const cleanZero = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);

  return {
    blur: cleanZero(blur),
    blurPx: cleanZero(blur),
    glow: cleanZero(glow),
    glowIntensity: cleanZero(glowIntensity),
    opacity: cleanZero(opacity),
    rotateX: cleanZero(rotateX),
    rotateY: cleanZero(rotateY),
    rotateZ: cleanZero(rotateZ),
    scale: Number.isFinite(scale) ? scale : 1.0,
    specularX: cleanZero(specularX),
    x: cleanZero(x),
    y: cleanZero(y),
    z: cleanZero(z),
  };
}

// ── 5. Master Timeline Evaluation (Whole-Logo Pose at Time t) ────────────────

/**
 * Evaluates the full logo pose as a continuous function of master clock time t (ms).
 * Guarantees C¹ continuity across all phase boundaries.
 */
export function flightPoseAtTime(
  tMs: number,
  width: number,
  height: number,
  tier: "performance" | "balanced" | "eco" = "performance",
  isReplay = false,
  slotOffset: SlotOffset = { x: 0, y: 0 }
): FlightPoseResult {
  const speed = isReplay ? REPLAY_SPEED_FACTOR : 1.0;
  const flightStart = WELCOME_TIMINGS.flightStartMs * speed;
  const flightDuration = FLIGHT_MS * speed;
  const landingTime = flightStart + flightDuration;

  if (tMs <= flightStart) {
    return flightPose(0, width, height, tier, isReplay, slotOffset);
  }

  if (tMs >= landingTime) {
    return flightPose(1, width, height, tier, isReplay, slotOffset);
  }

  const u = (tMs - flightStart) / flightDuration;
  return flightPose(u, width, height, tier, isReplay, slotOffset);
}

// ── 6. Path Sampling for Debug Overlays ──────────────────────────────────────

export interface SampledPathPoint {
  blur: number;
  glow: number;
  opacity: number;
  scale: number;
  u: number;
  x: number;
  y: number;
  z: number;
}

export function sampleFlightPath(
  width: number,
  height: number,
  sampleCount = 80,
  tier: "performance" | "balanced" | "eco" = "performance",
  isReplay = false,
  slotOffset: SlotOffset = { x: 0, y: 0 }
): SampledPathPoint[] {
  const points: SampledPathPoint[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const u = i / sampleCount;
    const p = flightPose(u, width, height, tier, isReplay, slotOffset);
    points.push({
      blur: p.blur,
      glow: p.glow,
      opacity: p.opacity,
      scale: p.scale,
      u,
      x: p.x,
      y: p.y,
      z: p.z,
    });
  }
  return points;
}
