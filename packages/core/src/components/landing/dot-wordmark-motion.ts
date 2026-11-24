import { smoothProgress } from "./ascii-timeline";

export const DOT_WORDMARK_SECONDS = 12;

const WAVE_EDGE = 0.5;
const WAVE_DURATION = 3.2;

/** Light travels through fixed columns; no dot changes its position or size. */
export function wordmarkIllumination(
  time: number,
  column: number
): { level: number; wave: number } {
  const phase =
    ((time % DOT_WORDMARK_SECONDS) + DOT_WORDMARK_SECONDS) %
    DOT_WORDMARK_SECONDS;
  if (phase < 1) {
    return { level: 0, wave: 0 };
  }
  if (phase >= 4.2 && phase < 7.4) {
    return { level: 1, wave: 0 };
  }
  if (phase >= 10.6) {
    return { level: 0, wave: 0 };
  }
  const dimming = phase >= 7.4;
  const progress = (phase - (dimming ? 7.4 : 1)) / WAVE_DURATION;
  const front = -WAVE_EDGE + progress * (1 + 2 * WAVE_EDGE);
  const position = Math.max(0, Math.min(1, column));
  const revealed = smoothProgress((front - position) / WAVE_EDGE + 0.5);
  const wave = 1 - smoothProgress(Math.abs(front - position) / WAVE_EDGE);
  return { level: dimming ? 1 - revealed : revealed, wave };
}
