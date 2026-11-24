import { smoothProgress } from "./ascii-timeline";

/** A broad, curved formation front; normalized coordinates keep every viewport consistent. */
export function waveReveal(progress: number, x: number, y: number): number {
  if (progress <= 0) {
    return 0;
  }
  if (progress >= 1) {
    return 1;
  }
  const halfWidth = 0.55;
  const center = -halfWidth + progress * (1 + 2 * halfWidth);
  const bend =
    Math.sin(progress * Math.PI) *
    Math.sin(y * 6 + progress * Math.PI * 2) *
    0.024;
  return smoothProgress((center - x + halfWidth + bend) / (2 * halfWidth));
}

/** Three levels of white travel together inside the wave, with no thin bright edge. */
export function waveIllumination(reveal: number, seed: number): number {
  if (reveal <= 0 || reveal >= 1) {
    return 0;
  }
  const shade = seed < 0.34 ? 0.18 : seed < 0.78 ? 0.46 : 0.94;
  return Math.sin(Math.PI * reveal) ** 1.25 * shade;
}
