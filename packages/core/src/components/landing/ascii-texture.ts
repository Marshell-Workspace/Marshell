/** Mixed white ink with a slow, coherent light field rather than uniform brightness. */
export function materialGrain(
  seed: number,
  column: number,
  row: number,
  time: number
): number {
  const light =
    0.92 + Math.sin(column * 0.31 + row * 0.17 - time * 0.75) * 0.08;
  return (0.68 + seed * 0.32) * light * (seed > 0.92 ? 1.12 : 1);
}

export function ambientTone(
  seed: number,
  column: number,
  row: number,
  time: number
): number {
  const flow = 0.5 + Math.sin(column * 0.075 + row * 0.19 - time * 0.55) * 0.5;
  return Math.floor(flow * 3) + (seed > 0.985 ? 3 : 0);
}

export function ambientShiftX(row: number, time: number): number {
  return Math.round(Math.sin(time * 0.55 + row * 0.16) * 3) / 4;
}

export function ambientShiftY(column: number, time: number): number {
  return Math.round(Math.sin(time * 0.4 + column * 0.09)) / 4;
}

/** Preserve fine airframe contours when their projected width is smaller than a cell. */
export function helicopterInk(luminance: number, amount: number): number {
  const detail = Math.min(1, luminance ** 0.7 * 1.08);
  return luminance + (detail - luminance) * amount;
}
