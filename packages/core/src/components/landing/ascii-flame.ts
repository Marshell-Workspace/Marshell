import {
  computeFlameOffsets,
  type FlameOffsets,
} from "./avatar-flame-geometry";

/** Broad flame waves take roughly 5–7 seconds per cycle. */
export function asciiFlameClock(time: number): number {
  return time * 0.27;
}

export function asciiFlameOffsets(time: number): FlameOffsets {
  return computeFlameOffsets(asciiFlameClock(time), "balanced", "working");
}
