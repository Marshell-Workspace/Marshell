export interface PresetAccent {
  readonly checkColor: string;
  readonly contrastOnDark: number;
  readonly contrastOnLight: number;
  readonly hex: string;
  readonly id: string;
  /** Fill used on the light theme (buttons, swatch). */
  readonly lightHex: string;
  /** Deeper, readable shade for text/icons on the light theme. */
  readonly lightInk: string;
  readonly name: string;
  readonly onDark: string;
  /** Foreground used on top of `lightHex`. */
  readonly onLight: string;
}

export const DARK_PANEL_BG = "#0a0a0a";
export const LIGHT_PANEL_BG = "#f4f2ec";
export const DARK_ON_TEXT = "#0b130e";
export const LIGHT_ON_TEXT = "#ffffff";

// ── Color Utilities ──────────────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace("#", "").trim();
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((c) => c + c)
          .join("")
      : cleanHex;
  const num = Number.parseInt(fullHex, 16);
  if (Number.isNaN(num)) {
    return [61, 220, 151]; // fallback mint
  }
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function srgbToLinear(c: number): number {
  const norm = c / 255;
  return norm <= 0.040_45 ? norm / 12.92 : ((norm + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

export function contrastRatio(hex1: string, hex2: string): number {
  const lum1 = relativeLuminance(hex1);
  const lum2 = relativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Chooses either dark text (#0b130e) or light text (#ffffff) to maximize contrast
 * on top of the given accent background.
 */
export function getAutoForeground(bgHex: string): string {
  const darkRatio = contrastRatio(bgHex, DARK_ON_TEXT);
  const lightRatio = contrastRatio(bgHex, LIGHT_ON_TEXT);
  return darkRatio >= lightRatio ? DARK_ON_TEXT : LIGHT_ON_TEXT;
}

export function rgbToHsv(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const normR = r / 255;
  const normG = g / 255;
  const normB = b / 255;
  const max = Math.max(normR, normG, normB);
  const min = Math.min(normR, normG, normB);
  let h = 0;
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case normR:
        h = (normG - normB) / d + (normG < normB ? 6 : 0);
        break;
      case normG:
        h = (normB - normR) / d + 2;
        break;
      case normB:
        h = (normR - normG) / d + 4;
        break;
      default:
        break;
    }
    h /= 6;
  }
  return [h, s, v];
}

export function hsvToRgb(
  h: number,
  s: number,
  v: number
): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0;
  let g = 0;
  let b = 0;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
    default:
      break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function getLightModeInk(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  let factor = 1.0;
  let darkenedHex = hex;
  while (factor > 0) {
    const dr = Math.round(r * factor);
    const dg = Math.round(g * factor);
    const db = Math.round(b * factor);
    darkenedHex = rgbToHex(dr, dg, db);
    if (contrastRatio(darkenedHex, LIGHT_PANEL_BG) >= 4.5) {
      break;
    }
    factor -= 0.02;
  }
  return darkenedHex;
}

export function ensureDarkContrast(hex: string): {
  hex: string;
  isAdjusted: boolean;
} {
  const normalized = parseHexColor(hex);
  const targetHex = normalized ?? "#3ddc97";
  if (contrastRatio(targetHex, DARK_PANEL_BG) >= 3.0) {
    return { hex: targetHex, isAdjusted: false };
  }

  const [r, g, b] = hexToRgb(targetHex);
  let [h, s, v] = rgbToHsv(r, g, b);
  while (v <= 1.0) {
    v += 0.02;
    const [nr, ng, nb] = hsvToRgb(h, s, Math.min(1.0, v));
    const nHex = rgbToHex(nr, ng, nb);
    if (contrastRatio(nHex, DARK_PANEL_BG) >= 3.0) {
      return { hex: nHex, isAdjusted: true };
    }
  }

  let curHex = targetHex;
  while (contrastRatio(curHex, DARK_PANEL_BG) < 3.0) {
    const [cr, cg, cb] = hexToRgb(curHex);
    curHex = rgbToHex(
      Math.min(255, cr + 10),
      Math.min(255, cg + 10),
      Math.min(255, cb + 10)
    );
  }
  return { hex: curHex, isAdjusted: true };
}

export function parseHexColor(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }
  const trimmed = input.trim();
  const clean = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(clean)) {
    return null;
  }
  if (clean.length === 3) {
    const expanded = clean
      .split("")
      .map((c) => c + c)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }
  return `#${clean.toLowerCase()}`;
}

// ── Presets: 10 curated accents, each tuned per theme ────────────────────────

interface RawPresetDef {
  dark: { fill: string; on: string };
  id: string;
  light: { fill: string; ink: string; on: string };
  name: string;
}

const RAW_PRESETS: readonly RawPresetDef[] = [
  {
    id: "mint",
    name: "Mint",
    dark: { fill: "#53e2a6", on: "#0b130e" },
    light: { fill: "#15ba81", ink: "#00764f", on: "#0b130e" },
  },
  {
    id: "cyan",
    name: "Cyan",
    dark: { fill: "#50d9ef", on: "#0b130e" },
    light: { fill: "#0dabc0", ink: "#02707e", on: "#0b130e" },
  },
  {
    id: "sky",
    name: "Sky",
    dark: { fill: "#68b3fe", on: "#0b130e" },
    light: { fill: "#1f86de", ink: "#0060a6", on: "#0b130e" },
  },
  {
    id: "indigo",
    name: "Indigo",
    dark: { fill: "#8d9bff", on: "#0b130e" },
    light: { fill: "#5053d8", ink: "#3d3bb8", on: "#ffffff" },
  },
  {
    id: "violet",
    name: "Violet",
    dark: { fill: "#c28efb", on: "#0b130e" },
    light: { fill: "#8f43d1", ink: "#7530ae", on: "#ffffff" },
  },
  {
    id: "rose",
    name: "Rose",
    dark: { fill: "#fa7fb3", on: "#0b130e" },
    light: { fill: "#cd3380", ink: "#ae1a69", on: "#ffffff" },
  },
  {
    id: "crimson",
    name: "Crimson",
    dark: { fill: "#ff7871", on: "#0b130e" },
    light: { fill: "#d72630", ink: "#b71824", on: "#ffffff" },
  },
  {
    id: "orange",
    name: "Orange",
    dark: { fill: "#ffa064", on: "#0b130e" },
    light: { fill: "#e47001", ink: "#9a4901", on: "#0b130e" },
  },
  {
    id: "amber",
    name: "Amber",
    dark: { fill: "#fac547", on: "#0b130e" },
    light: { fill: "#dea700", ink: "#7d5e07", on: "#0b130e" },
  },
  {
    id: "graphite",
    name: "Graphite",
    dark: { fill: "#d4d0cb", on: "#0b130e" },
    light: { fill: "#504c48", ink: "#403d39", on: "#ffffff" },
  },
];

/**
 * Precomputed once at module load time so rendering tiles requires zero contrast math.
 */
export const PRESET_ACCENTS: readonly PresetAccent[] = Object.freeze(
  RAW_PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    hex: p.dark.fill,
    onDark: p.dark.on,
    checkColor: p.dark.on,
    lightHex: p.light.fill,
    lightInk: p.light.ink,
    onLight: p.light.on,
    contrastOnDark: contrastRatio(p.dark.fill, DARK_PANEL_BG),
    contrastOnLight: contrastRatio(p.light.ink, LIGHT_PANEL_BG),
  }))
);

export type PresetAccentId = (typeof PRESET_ACCENTS)[number]["id"];

export const PRESET_MAP: ReadonlyMap<string, PresetAccent> = new Map(
  PRESET_ACCENTS.map((item) => [item.id, item])
);

export const DEFAULT_ACCENT_ID: PresetAccentId = "mint";

export function isValidAccentId(id: string | null | undefined): boolean {
  if (!id) {
    return false;
  }
  return id === "custom" || PRESET_MAP.has(id);
}

// ── Placement & Positioning Calculation ──────────────────────────────────────

export type PopoverPlacementSide =
  | "right-start"
  | "left-start"
  | "below"
  | "center";

export interface PopoverPlacement {
  left: number;
  maxHeight: number;
  placement: PopoverPlacementSide;
  top: number;
}

export interface RectLike {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

/**
 * Computes placement anchored to the swatch grid card container.
 * Preferred placement is right-start: popup left = grid right + offset (16px),
 * popup top = grid top. Clamps vertically and shifts up if it would overflow bottom.
 * Fallbacks in order: right-start -> left-start -> below (clamped horizontally) -> center.
 */
export function computePopoverPlacement(
  anchorRect: RectLike,
  popoverWidth: number,
  boundary:
    | RectLike
    | { height: number; left?: number; top?: number; width: number },
  popoverHeight = 360,
  margin = 12,
  offset = 16
): PopoverPlacement {
  const boundaryRect: RectLike = {
    left: boundary.left ?? 0,
    top: boundary.top ?? 0,
    right: (boundary.left ?? 0) + boundary.width,
    bottom: (boundary.top ?? 0) + boundary.height,
    width: boundary.width,
    height: boundary.height,
  };

  const minX = boundaryRect.left + margin;
  const maxX = boundaryRect.right - margin;
  const minY = boundaryRect.top + margin;
  const maxY = boundaryRect.bottom - margin;
  const availableHeight = Math.max(0, maxY - minY);

  // Fallbacks in order: right-start -> left-start -> below -> center
  let placement: PopoverPlacementSide = "right-start";
  let left = 0;
  let top = 0;

  // 1. Candidate: right-start
  const rightStartLeft = anchorRect.right + offset;
  const canFitRight = rightStartLeft + popoverWidth <= maxX;

  // 2. Candidate: left-start
  const leftStartLeft = anchorRect.left - offset - popoverWidth;
  const canFitLeft = leftStartLeft >= minX;

  // 3. Candidate: below / above
  const belowTop = anchorRect.bottom + offset;
  const spaceBelow = maxY - anchorRect.bottom - offset;
  const spaceAbove = anchorRect.top - offset - minY;
  const canFitBelowOrAbove = spaceBelow >= 200 || spaceAbove >= 200;

  if (canFitRight) {
    placement = "right-start";
    left = rightStartLeft;
    top = anchorRect.top;
  } else if (canFitLeft) {
    placement = "left-start";
    left = leftStartLeft;
    top = anchorRect.top;
  } else if (canFitBelowOrAbove) {
    placement = "below";
    top = belowTop;
    left = Math.max(minX, Math.min(anchorRect.left, maxX - popoverWidth));
  } else {
    placement = "center";
    left = Math.max(
      minX,
      boundaryRect.left + (boundaryRect.width - popoverWidth) / 2
    );
    top = Math.max(
      minY,
      boundaryRect.top +
        (boundaryRect.height - Math.min(popoverHeight, availableHeight)) / 2
    );
  }

  // Vertical shift-up and clamping for side placements
  if (placement === "right-start" || placement === "left-start") {
    if (top + popoverHeight > maxY) {
      top = Math.max(minY, maxY - popoverHeight);
    }
    if (top < minY) {
      top = minY;
    }
  } else if (placement === "below" && top + popoverHeight > maxY) {
    const spaceAbove = anchorRect.top - offset - minY;
    const spaceBelow = maxY - anchorRect.bottom - offset;
    if (spaceAbove > spaceBelow && spaceAbove >= 240) {
      top = Math.max(
        minY,
        anchorRect.top - offset - Math.min(popoverHeight, spaceAbove)
      );
    } else {
      top = Math.max(minY, maxY - Math.min(popoverHeight, availableHeight));
    }
  }

  // Calculate available maxHeight
  let maxHeight: number;
  if (placement === "right-start" || placement === "left-start") {
    maxHeight = Math.max(200, Math.min(availableHeight, maxY - top));
  } else if (placement === "below") {
    maxHeight = Math.max(200, Math.min(availableHeight, maxY - top));
  } else {
    maxHeight = Math.max(200, availableHeight);
  }

  // Final horizontal clamp
  if (left + popoverWidth > maxX) {
    left = Math.max(minX, maxX - popoverWidth);
  }
  if (left < minX) {
    left = minX;
  }

  return {
    left: Math.round(left),
    maxHeight: Math.round(maxHeight),
    placement,
    top: Math.round(top),
  };
}
