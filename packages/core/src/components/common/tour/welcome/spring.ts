/**
 * spring.ts — Analytical Closed-Form Spring Physics for Marshell Cinematic Intro.
 *
 * Implements deterministic, zero-allocation, O(1) seekable spring physics.
 * Since every evaluation is a pure function of time t, the animation can be
 * scrubbed, paused, reversed, and sampled at any frame rate with 100% precision.
 */

export interface SpringConfig {
  /** Damping coefficient (c) */
  damping: number;
  /** Initial value at t = 0 (default: 0) */
  initial?: number;
  /** Mass of the object (default: 1.0) */
  mass?: number;
  /** Stiffness / spring constant (k) */
  stiffness: number;
  /** Target value at t -> infinity (default: 1) */
  target?: number;
}

export interface SpringResult {
  /** Squash and stretch scaleY (volume preservation) */
  scaleY: number;
  /** Normalized value (typically 0 -> 1 with overshoot) */
  value: number;
  /** Instantaneous velocity at time t */
  velocity: number;
}

/**
 * Evaluates an underdamped spring at time t (seconds).
 *
 * Governing equation:
 *   m x'' + c x' + k (x - target) = 0
 *   omega_n = sqrt(k / m)
 *   zeta = c / (2 * sqrt(k * m))
 *   omega_d = omega_n * sqrt(1 - zeta^2)
 */
export function evaluateSpring(
  tSec: number,
  config: SpringConfig,
  stretchIntensity = 0.08
): SpringResult {
  if (tSec <= 0) {
    const initial = config.initial ?? 0;
    return { value: initial, velocity: 0, scaleY: 1.0 };
  }

  const m = config.mass ?? 1.0;
  const k = Math.max(1, config.stiffness);
  const c = Math.max(0.1, config.damping);
  const initial = config.initial ?? 0;
  const target = config.target ?? 1;
  const delta = target - initial;

  const omegaN = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));

  if (zeta < 1.0) {
    // Underdamped oscillation with overshoot
    const omegaD = omegaN * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * omegaN * tSec);
    const cosTerm = Math.cos(omegaD * tSec);
    const sinTerm = Math.sin(omegaD * tSec);

    // Position normalized from initial to target
    const posNorm =
      1 - decay * (cosTerm + ((zeta * omegaN) / omegaD) * sinTerm);
    const value = initial + delta * posNorm;

    // Derivative (velocity)
    const velNorm = (omegaN / Math.sqrt(1 - zeta * zeta)) * decay * sinTerm;
    const velocity = delta * velNorm;

    // Squash & stretch: compress perpendicular axis while speed is high
    const speed = Math.abs(velocity);
    const compression = Math.max(
      -0.08,
      Math.min(0.08, (velocity > 0 ? -1 : 0.8) * speed * stretchIntensity)
    );
    const scaleY = Math.max(0.9, Math.min(1.08, 1 + compression));

    return { value, velocity, scaleY };
  }

  // Critically damped or overdamped fallback (no overshoot)
  const decay = Math.exp(-omegaN * tSec);
  const posNorm = 1 - (1 + omegaN * tSec) * decay;
  const value = initial + delta * posNorm;
  const velocity = delta * omegaN * omegaN * tSec * decay;
  return { value, velocity, scaleY: 1.0 };
}

/**
 * Creates an evaluation helper for a specific spring preset.
 */
export function createSpringEvaluator(config: SpringConfig) {
  return (tSec: number, stretchIntensity = 0.08) =>
    evaluateSpring(tSec, config, stretchIntensity);
}
