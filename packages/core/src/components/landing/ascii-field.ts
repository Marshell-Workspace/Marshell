import { smoothProgress } from "./ascii-timeline";

export const ASCII_LAYOUT = {
  cellWidth: 8,
  cellHeight: 11.5,
  fontSize: 10.5,
  spriteWidth: 14,
  spriteHeight: 17,
} as const;

export const ASCII_FONT_FAMILY =
  'Consolas, "SFMono-Regular", "Liberation Mono", monospace';
export const ASCII_FONT = `500 ${ASCII_LAYOUT.fontSize}px ${ASCII_FONT_FAMILY}`;
export const ASCII_BACKGROUND = "#000000";

/** Reconstruct the image locally through tone; letters never leave their cells. */
export function reconstructionProgress(
  progress: number,
  phase: number
): number {
  const delay = Math.max(0, Math.min(1, phase)) * 0.18;
  return smoothProgress((progress - delay) / (1 - delay));
}

export function fieldPalette(tone: number): string {
  const t = (tone % 32) / 31;
  if (tone >= 32) {
    // Accent flame: dim navy rising to the app's sky accent (#68b3fe).
    return `rgb(${Math.round(28 + 76 * t)},${Math.round(48 + 131 * t)},${Math.round(84 + 170 * t)})`;
  }
  // Neutral grey-to-white ink on pure black.
  const level = Math.round(38 + 217 * t);
  return `rgb(${level},${level},${level})`;
}
