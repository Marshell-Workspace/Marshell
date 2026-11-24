/**
 * greeting-paths.ts — Cursive Centerline Coverage Strokes & Font Configurations (Revision 3).
 *
 * Implements Greeting v3 Method 1:
 * - Real script font rendered as SVG <text> in a fixed viewBox (deterministic font metrics).
 * - SVG <mask> contains one thick round-capped coverage stroke per letter in writing order:
 *   W -> e -> l -> c -> o -> m -> e.
 * - Stroke width is 32px (1.8x - 2.2x stem width), designed to 100% cover the font glyphs.
 * - Stroke-dashoffset animation paces the pen naturally.
 * - Safety full-rect fades in over 200ms at the end of reveal to ensure >= 99.5% pixel coverage.
 * - Precomputed pen-light points sampled at build time (zero getPointAtLength calls during 60fps rAF).
 */

import type { ScriptFontKey } from "./welcome.config";

export interface ScriptFontDefinition {
  className: string;
  fontFamily: string;
  fontSize: number;
  id: ScriptFontKey;
  name: string;
  textAnchor: "start" | "middle" | "end";
  x: number;
  y: number;
}

export const SCRIPT_FONT_DEFINITIONS: Record<
  ScriptFontKey,
  ScriptFontDefinition
> = {
  sacramento: {
    id: "sacramento",
    name: "Sacramento",
    className: "font-script-sacramento",
    fontFamily: '"Sacramento", cursive, sans-serif',
    fontSize: 92,
    x: 300,
    y: 104,
    textAnchor: "middle",
  },
  yellowtail: {
    id: "yellowtail",
    name: "Yellowtail",
    className: "font-script-yellowtail",
    fontFamily: '"Yellowtail", cursive, sans-serif',
    fontSize: 78,
    x: 300,
    y: 100,
    textAnchor: "middle",
  },
  damion: {
    id: "damion",
    name: "Damion",
    className: "font-script-damion",
    fontFamily: '"Damion", cursive, sans-serif',
    fontSize: 80,
    x: 300,
    y: 100,
    textAnchor: "middle",
  },
};

export const GREETING_VIEWBOX = "0 24 600 96" as const;

export interface LetterStroke {
  /** SVG path d string */
  d: string;
  /** Estimated stroke length for dasharray */
  estimatedLength: number;
  /** Normalized fraction of the 1900ms duration [startU, endU] */
  fraction: [number, number];
  id: string;
  letter: string;
}

/**
 * Centerline coverage strokes for "Welcome" in Sacramento script.
 * Authored in viewBox 0 0 600 160.
 * Round caps and joins with stroke-width 32px guarantee 100% glyph coverage.
 */
export const SACRAMENTO_COVERAGE_STROKES: readonly LetterStroke[] = [
  {
    id: "stroke-W",
    letter: "W",
    estimatedLength: 280,
    fraction: [0.0, 0.24],
    d: "M 116 68 C 122 52, 138 48, 146 62 C 150 76, 146 95, 148 114 C 152 120, 162 118, 168 88 C 174 62, 180 58, 186 60 C 190 64, 190 85, 191 114 C 194 120, 204 116, 214 84 C 218 70, 224 66, 230 70",
  },
  {
    id: "stroke-e1",
    letter: "e",
    estimatedLength: 120,
    fraction: [0.22, 0.35],
    d: "M 224 88 C 232 90, 248 85, 248 74 C 248 62, 234 62, 226 76 C 218 90, 222 110, 238 114 C 248 116, 258 106, 264 94",
  },
  {
    id: "stroke-l",
    letter: "l",
    estimatedLength: 210,
    fraction: [0.33, 0.49],
    d: "M 256 100 C 266 88, 276 56, 282 36 C 286 24, 292 24, 292 36 C 290 60, 282 88, 280 110 C 278 116, 286 118, 296 106 C 302 98, 308 92, 314 90",
  },
  {
    id: "stroke-c",
    letter: "c",
    estimatedLength: 110,
    fraction: [0.47, 0.59],
    d: "M 326 74 C 314 70, 303 76, 300 88 C 296 104, 306 114, 320 112 C 328 110, 336 102, 342 90",
  },
  {
    id: "stroke-o",
    letter: "o",
    estimatedLength: 130,
    fraction: [0.57, 0.7],
    d: "M 346 80 C 338 84, 334 94, 336 104 C 340 114, 355 114, 362 104 C 368 94, 364 80, 352 78 C 346 76, 358 74, 372 80",
  },
  {
    id: "stroke-m",
    letter: "m",
    estimatedLength: 230,
    fraction: [0.68, 0.86],
    d: "M 372 86 C 374 96, 374 106, 375 114 M 374 88 C 382 76, 396 76, 399 88 C 401 98, 401 106, 403 114 M 399 86 C 407 76, 420 76, 424 88 C 426 98, 427 106, 430 114 C 434 116, 440 108, 446 96",
  },
  {
    id: "stroke-e2",
    letter: "e",
    estimatedLength: 140,
    fraction: [0.84, 1.0],
    d: "M 442 90 C 450 90, 466 85, 466 74 C 466 62, 452 62, 444 76 C 438 90, 442 110, 458 114 C 468 116, 482 106, 498 90",
  },
];

/**
 * Precomputed sample points along the writing path for the pen-light dot.
 * Stored statically so runtime needs zero getPointAtLength calls.
 */
export const PEN_LIGHT_SAMPLE_POINTS: readonly {
  readonly u: number;
  readonly x: number;
  readonly y: number;
}[] = [
  { u: 0.0, x: 116, y: 68 },
  { u: 0.04, x: 130, y: 55 },
  { u: 0.08, x: 147, y: 88 },
  { u: 0.12, x: 156, y: 112 },
  { u: 0.16, x: 176, y: 68 },
  { u: 0.2, x: 191, y: 112 },
  { u: 0.24, x: 226, y: 72 },
  { u: 0.28, x: 242, y: 74 },
  { u: 0.32, x: 232, y: 110 },
  { u: 0.36, x: 262, y: 88 },
  { u: 0.4, x: 278, y: 44 },
  { u: 0.44, x: 290, y: 32 },
  { u: 0.48, x: 280, y: 110 },
  { u: 0.52, x: 308, y: 78 },
  { u: 0.56, x: 318, y: 112 },
  { u: 0.6, x: 340, y: 84 },
  { u: 0.64, x: 348, y: 112 },
  { u: 0.68, x: 366, y: 88 },
  { u: 0.72, x: 374, y: 112 },
  { u: 0.76, x: 396, y: 84 },
  { u: 0.8, x: 402, y: 112 },
  { u: 0.84, x: 422, y: 84 },
  { u: 0.88, x: 430, y: 112 },
  { u: 0.92, x: 454, y: 74 },
  { u: 0.96, x: 450, y: 112 },
  { u: 1.0, x: 496, y: 92 },
];

/** Lookup pen light point at progress u in [0, 1] */
export function getPenLightPoint(u: number): { x: number; y: number } {
  const clampedU = Math.max(0, Math.min(1, u));
  const samples = PEN_LIGHT_SAMPLE_POINTS;
  const n = samples.length;

  for (let i = 0; i < n - 1; i++) {
    const p0 = samples[i]!;
    const p1 = samples[i + 1]!;
    if (clampedU >= p0.u && clampedU <= p1.u) {
      const segSpan = p1.u - p0.u;
      const t = segSpan > 0 ? (clampedU - p0.u) / segSpan : 0;
      return {
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t,
      };
    }
  }

  const last = samples[n - 1]!;
  return { x: last.x, y: last.y };
}

// ── Backwards Compatibility ──────────────────────────────────────────────────
export const WELCOME_CENTERLINE_PATHS = [
  {
    id: "welcome-full-stroke",
    d: SACRAMENTO_COVERAGE_STROKES.map((s) => s.d).join(" "),
  },
];
