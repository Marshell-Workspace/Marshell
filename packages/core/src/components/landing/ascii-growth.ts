import { GROWTH_TIMING, growthState, smoothProgress } from "./ascii-timeline";

const DIGITS: Readonly<Record<string, readonly string[]>> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "%": ["11001", "11010", "00100", "01011", "10011"],
  " ": ["000", "000", "000", "000", "000"],
};

function encodeDigits(percent: number): readonly (readonly string[])[] {
  return [
    ...`${Math.max(0, Math.min(99, Math.round(percent)))}`.padStart(2, " "),
    "%",
  ].map((character) => DIGITS[character] ?? DIGITS[" "] ?? []);
}

const COUNTERS = Array.from({ length: 100 }, (_, percent) =>
  encodeDigits(percent)
);

export function growthDigits(percent: number): readonly (readonly string[])[] {
  return COUNTERS[Math.max(0, Math.min(99, Math.round(percent)))] ?? [];
}

export interface AsciiGrowthLayout {
  width: number;
  x: number;
  y: number;
}

export function growthMaskLayout(
  transform: { a: number; d: number; e: number; f: number },
  left: number,
  right: number,
  top: number
): AsciiGrowthLayout {
  return {
    x: Math.round(transform.a * left + transform.e),
    y: Math.round(transform.d * top + transform.f),
    width: Math.max(12, Math.round(transform.a * (right - left))),
  };
}

/** Literal ASCII strokes keep the counter legible within the illustration's own grid. */
export function growthGlyph(
  layout: AsciiGrowthLayout,
  percent: number,
  column: number,
  row: number
): string | undefined {
  const x = column - layout.x;
  const y = row - layout.y;
  if (x >= 0 && x < layout.width && y >= 0 && y < 5) {
    const edge = x === 0 || x === layout.width - 1;
    if (y === 0 || y === 4) {
      return edge ? "+" : "-";
    }
    if (edge) {
      return "|";
    }
    return x - 1 < ((layout.width - 2) * percent) / 100 ? "=" : undefined;
  }
  const counterX = x - layout.width - 3;
  if (counterX < -1 || counterX > 13 || y < -1 || y > 5) {
    return;
  }
  if (counterX < 0 || y < 0 || y > 4) {
    return;
  }
  const digit = Math.min(2, Math.floor(counterX / 4));
  const bit = counterX - digit * 4;
  if (growthDigits(percent)[digit]?.[y]?.[bit] !== "1") {
    return;
  }
  if (digit < 2) {
    return `${percent}`.padStart(2, " ")[digit];
  }
  return (y < 2 && bit < 2) || (y >= 3 && bit >= 3) ? "o" : "/";
}

/** Both borders and numerals occupy whole ASCII cells in the scene mask. */
export function paintAsciiGrowth(
  ctx: CanvasRenderingContext2D,
  time: number,
  left: number,
  right: number,
  top: number
) {
  const reveal = smoothProgress(
    (time - GROWTH_TIMING.entryEnd) / GROWTH_TIMING.revealSeconds
  );
  if (!reveal) {
    return;
  }
  const state = growthState(time);
  const transform = ctx.getTransform();
  const { x, y, width } = growthMaskLayout(transform, left, right, top);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= reveal;
  ctx.fillStyle = "#a4b2cc";
  ctx.fillRect(x, y, width, 5);
  ctx.fillStyle = "#172236";
  ctx.fillRect(x + 1, y + 1, width - 2, 3);
  ctx.fillStyle = "#68b3fe";
  ctx.fillRect(x + 1, y + 1, (width - 2) * state.fraction, 3);
  const digits = growthDigits(state.percent);
  ctx.fillStyle = "#e0e6f2";
  for (let digit = 0; digit < digits.length; digit++) {
    const bitmap = digits[digit] ?? [];
    for (let row = 0; row < bitmap.length; row++) {
      for (let column = 0; column < (bitmap[row]?.length ?? 0); column++) {
        if (bitmap[row]?.[column] === "1") {
          ctx.fillRect(x + width + 3 + digit * 4 + column, y + row, 1, 1);
        }
      }
    }
  }
  ctx.restore();
}
