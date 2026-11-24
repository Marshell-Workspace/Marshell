/**
 * sheetMath.ts — Unified Sheet Model & Silk Ribbon Engine (Revision 4).
 *
 * THE SHEET PRIMITIVE (one renderer for frames 2 to 5):
 * - Frame 2 (RESONANCE 0.7-1.6s): Soft silk scarves (R1, R2, Veil) drifting in water,
 *   meeting flat along the horizontal axis at a diffuse warm-white flare.
 * - Frame 3 (UNFOLD 1.6-2.7s): Angle-driven wedge geometry snapping open into a fan of
 *   luminous glass blades (S1-S4) with rubber stretch overshoot and needle-then-inflate.
 * - Frame 4 (ALIGN 2.7-4.0s): Logo blooms at center (La = 1.2*L), S1 morphs into a soft
 *   tilted glass panel (11 deg tilt, navy base >= 0.80) with 2 rear glass shadow layers,
 *   S2-S4 flare into big silk horns reaching screen edges, DOM terminal lines typed cleanly.
 * - Frame 5 (WELCOME 4.0-5.2s): Origin glides with logo (0.50H -> 0.26H), panels retract into logo
 *   completely by 4.75s (zero slivers), horns morph into shallow U-shaped wings cradling the logo.
 */

import type { Point2D } from "./homography";
import {
  calculateAlignLogoSize,
  calculateLogoSize,
  DESIGN_TOKENS,
  FINAL_LAYOUT,
  getLayerVisibility,
  UNFOLD_BLADE_CORNERS,
  WELCOME_CONFIG,
  WING_CENTERLINE_CONTROL_POINTS,
  WING_HALF_THICKNESS_CONTROL_POINTS,
} from "./welcome.config";

export interface FrontQuadCorners {
  pBotInner: Point2D;
  pBotOuter: Point2D;
  pTopInner: Point2D;
  pTopOuter: Point2D;
}

export interface RenderResult {
  leftFrontQuad: FrontQuadCorners | null;
  rightFrontQuad: FrontQuadCorners | null;
}

// ── Math Helpers ─────────────────────────────────────────────────────────────

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function calcSpring(
  tau: number,
  omega0: number,
  zeta: number
): { val: number; vel: number } {
  if (tau <= 0) {
    return { val: 0, vel: 0 };
  }
  const wd = omega0 * Math.sqrt(Math.max(0.001, 1 - zeta * zeta));
  const expFactor = Math.exp(-zeta * omega0 * tau);
  const cosTerm = Math.cos(wd * tau);
  const sinTerm = Math.sin(wd * tau);

  const val = 1 - expFactor * (cosTerm + ((zeta * omega0) / wd) * sinTerm);
  const vel = (omega0 / Math.sqrt(1 - zeta * zeta)) * expFactor * sinTerm;
  return { val, vel };
}

// ── Monotone Cubic Hermite Spline (PCHIP) for Frame 5 Wings ──────────────────

export function evalPchip(
  x: number,
  pts: readonly {
    readonly x: number;
    readonly y?: number;
    readonly hh?: number;
  }[],
  field: "y" | "hh"
): number {
  const n = pts.length;
  if (n === 0) {
    return 0;
  }
  const first = pts[0]!;
  const last = pts[n - 1]!;
  const getVal = (p: typeof first) =>
    field === "y" ? (p.y ?? 0) : (p.hh ?? 0);

  if (x <= first.x) {
    return getVal(first);
  }
  if (x >= last.x) {
    return getVal(last);
  }

  let i = 0;
  for (let k = 0; k < n - 1; k++) {
    if (x >= pts[k]!.x && x <= pts[k + 1]!.x) {
      i = k;
      break;
    }
  }

  const p0 = pts[i]!;
  const p1 = pts[i + 1]!;
  const h = p1.x - p0.x;
  if (Math.abs(h) < 1e-9) {
    return getVal(p0);
  }

  // Slopes
  const deltas: number[] = new Array(n - 1);
  for (let j = 0; j < n - 1; j++) {
    const dx = pts[j + 1]!.x - pts[j]!.x;
    deltas[j] =
      Math.abs(dx) > 1e-9 ? (getVal(pts[j + 1]!) - getVal(pts[j]!)) / dx : 0;
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
      const tauScale = 3 / Math.sqrt(dist);
      d0 = tauScale * alpha * delta;
      d1 = tauScale * beta * delta;
    }
  }

  const t = (x - p0.x) / h;
  const t2 = t * t;
  const t3 = t2 * t;

  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return h00 * getVal(p0) + h10 * h * d0 + h01 * getVal(p1) + h11 * h * d1;
}

// ── Rounded Polygon Helper with Bowed Top & Bottom Edges ────────────────────

export function drawRoundedPanel(
  ctx: CanvasRenderingContext2D,
  q: {
    pTopInner: Point2D;
    pTopOuter: Point2D;
    pBotOuter: Point2D;
    pBotInner: Point2D;
  },
  r: number,
  bow: number
) {
  // Points: p0=topInner, p1=topOuter, p2=botOuter, p3=botInner
  const { pTopInner: p0, pTopOuter: p1, pBotOuter: p2, pBotInner: p3 } = q;

  ctx.beginPath();
  // Start near top-inner after corner
  ctx.moveTo(p0.x, p0.y + r);

  // Top edge: with bow curve toward top-outer
  if (Math.abs(bow) > 0.1) {
    const midX = (p0.x + p1.x) * 0.5;
    const midY = (p0.y + p1.y) * 0.5 - bow;
    ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
    ctx.quadraticCurveTo(p1.x, p1.y, p1.x - Math.sign(p1.x - p0.x) * r, p1.y);
  } else {
    ctx.arcTo(p0.x, p0.y, p1.x, p1.y, r);
  }

  ctx.arcTo(p1.x, p1.y, p2.x, p2.y, r);

  // Bottom edge: with bow curve toward bot-inner
  if (Math.abs(bow) > 0.1) {
    const midX = (p1.x + p2.x) * 0.5;
    const midY = (p2.y + p3.y) * 0.5 + bow;
    ctx.arcTo(p2.x, p2.y, p3.x, p3.y, r);
    ctx.quadraticCurveTo(midX, midY, p3.x + Math.sign(p1.x - p0.x) * r, p3.y);
  } else {
    ctx.arcTo(p2.x, p2.y, p3.x, p3.y, r);
    ctx.arcTo(p3.x, p3.y, p0.x, p0.y, r);
  }

  ctx.arcTo(p3.x, p3.y, p0.x, p0.y, r);
  ctx.closePath();
}

// ── Master Render Function ───────────────────────────────────────────────────

export function renderSheetsAndRibbons(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  tier: "performance" | "balanced" | "eco",
  _bloomCanvas?: HTMLCanvasElement
): RenderResult {
  const result: RenderResult = {
    leftFrontQuad: null,
    rightFrontQuad: null,
  };

  if (t < WELCOME_CONFIG.void.start + 0.1 || width <= 0 || height <= 0) {
    return result;
  }

  const Wh = width / 2;
  const L = calculateLogoSize(height);
  const La = calculateAlignLogoSize(height);

  // Dynamic Center Origin: Glides from (Wh, height/2) to (Wh, 0.26*height) during WELCOME
  const startCy = height / 2;
  const finalCy = height * FINAL_LAYOUT.logoCenter;
  let Cy = startCy;

  if (t >= WELCOME_CONFIG.welcome.logoGlideStart) {
    const pGlide = Math.min(
      1.0,
      (t - WELCOME_CONFIG.welcome.logoGlideStart) /
        (WELCOME_CONFIG.welcome.logoGlideEnd -
          WELCOME_CONFIG.welcome.logoGlideStart)
    );
    const ease = 1 - (1 - pGlide) ** 3;
    Cy = startCy + (finalCy - startCy) * ease;
  }

  const Cx = Wh;
  const isWelcome = t >= WELCOME_CONFIG.welcome.start;

  // Frame 5 Hard Limit: nothing below logo center + 0.75*L per Section 9
  const verticalCutoffY = isWelcome
    ? Cy + WELCOME_CONFIG.welcome.wings.cutoffYFromCenterL * L
    : height + 200;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, verticalCutoffY);
  ctx.clip();

  // ───────────────────────────────────────────────────────────────────────────
  // FRAME 3: UNFOLD (1.46 -> 2.70s)
  // ───────────────────────────────────────────────────────────────────────────
  if (t >= 1.46 && t < 2.7) {
    let alphaHandoff = 1.0;
    if (t >= 2.45) {
      alphaHandoff = Math.max(0, 1.0 - (t - 2.45) / 0.25);
    }
    ctx.globalAlpha = alphaHandoff;

    // 1. Draw rear blades S4, S3, S2 (indices 3, 2, 1) back to front
    for (let sIdx = 3; sIdx >= 1; sIdx--) {
      drawSheetBlade(
        ctx,
        sIdx,
        "left",
        t,
        Cx,
        Cy,
        width,
        height,
        Wh,
        L,
        La,
        tier
      );
      drawSheetBlade(
        ctx,
        sIdx,
        "right",
        t,
        Cx,
        Cy,
        width,
        height,
        Wh,
        L,
        La,
        tier
      );
    }

    // 2. Fading silk from frame 2 (only active 1.50 -> 1.90s, strictly 0 at 1.95s+)
    drawUnfoldR1Between(ctx, t, Cx, Cy, width, height, Wh);

    // 3. Draw front blades S1 (index 0)
    result.leftFrontQuad = drawSheetBlade(
      ctx,
      0,
      "left",
      t,
      Cx,
      Cy,
      width,
      height,
      Wh,
      L,
      La,
      tier
    );
    result.rightFrontQuad = drawSheetBlade(
      ctx,
      0,
      "right",
      t,
      Cx,
      Cy,
      width,
      height,
      Wh,
      L,
      La,
      tier
    );

    // 4. Singularity Glow at center
    drawUnfoldSingularityGlow(ctx, t, Cx, Cy, height, alphaHandoff);
  }

  ctx.restore();
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOOM PASS HELPER
// ─────────────────────────────────────────────────────────────────────────────

function _applyBloomPass(
  ctx: CanvasRenderingContext2D,
  bloomCanvas: HTMLCanvasElement,
  width: number,
  height: number
) {
  const bCtx = bloomCanvas.getContext("2d");
  if (!bCtx) {
    return;
  }

  const bw = Math.max(1, Math.floor(width / 4));
  const bh = Math.max(1, Math.floor(height / 4));

  if (bloomCanvas.width !== bw || bloomCanvas.height !== bh) {
    bloomCanvas.width = bw;
    bloomCanvas.height = bh;
  }

  bCtx.clearRect(0, 0, bw, bh);
  bCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, bw, bh);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.22;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bloomCanvas, 0, 0, bw, bh, 0, 0, width, height);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME 2: RESONANCE (0.7 to 1.6s)
// ─────────────────────────────────────────────────────────────────────────────

// ── Unused Legacy Canvas2D Renderers (Retained per prompt policy) ─────────

export function drawResonanceRibbons(
  _ctx: CanvasRenderingContext2D,
  _t: number,
  _Cx: number,
  _Cy: number,
  _width: number,
  _height: number,
  _Wh: number,
  _tier: "performance" | "balanced" | "eco"
) {
  // WebGL stage (WelcomeWebGLStage.tsx) draws Frame 2 silk ribbons and center glow exclusively.
}

// Legacy Canvas 2D Frame 2 drawing functions are replaced by WebGL stage (WelcomeWebGLStage.tsx)

function _drawCenterFlare(
  _ctx: CanvasRenderingContext2D,
  _t: number,
  _Cx: number,
  _Cy: number,
  _height: number
) {
  // Center flare is drawn by WebGL stage (WelcomeWebGLStage.tsx)
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME 3: UNFOLD (1.50 to 2.70s) — REVISION 7 PURE QUAD & GLASS ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function drawRoundedPolygon(
  ctx: CanvasRenderingContext2D,
  points: Point2D[],
  radius: number
) {
  const len = points.length;
  if (len < 3) {
    return;
  }

  ctx.beginPath();
  const p0 = points[0]!;
  const p1 = points[1]!;
  ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
  for (let i = 1; i <= len; i++) {
    const pCurrent = points[i % len]!;
    const pNext = points[(i + 1) % len]!;
    ctx.arcTo(pCurrent.x, pCurrent.y, pNext.x, pNext.y, radius);
  }
  ctx.closePath();
}

function drawBladeWindow(
  ctx: CanvasRenderingContext2D,
  winSpec: {
    xStartWh: number;
    xEndWh: number;
    widthWh: number;
    yCenterH: number;
    heightH: number;
    keystoneInnerRatio: number;
    barsCount: number;
    barWidthRatios: readonly number[];
  },
  side: "left" | "right",
  t: number,
  Cx: number,
  Cy: number,
  Wh: number,
  height: number,
  alphaHandoff: number
) {
  if (t < 1.9 || t >= 2.8) {
    return;
  }
  let winAlpha = 1.0;
  if (t < 2.1) {
    winAlpha = (t - 1.9) / 0.2;
  } else if (t >= 2.5) {
    winAlpha = Math.max(0, 1.0 - (t - 2.5) / 0.3);
  }
  winAlpha *= alphaHandoff;
  if (winAlpha <= 0) {
    return;
  }

  const isRight = side === "right";
  const sigma = isRight ? 1 : -1;

  const xInner = Cx + sigma * winSpec.xStartWh * Wh;
  const xOuter = Cx + sigma * winSpec.xEndWh * Wh;
  const winW = Math.abs(xOuter - xInner);
  const winYCenter = Cy + winSpec.yCenterH * height;
  const hOuter = winSpec.heightH * height;
  const hInner = hOuter * winSpec.keystoneInnerRatio;

  const pTopInner: Point2D = { x: xInner, y: winYCenter - hInner / 2 };
  const pTopOuter: Point2D = { x: xOuter, y: winYCenter - hOuter / 2 };
  const pBotOuter: Point2D = { x: xOuter, y: winYCenter + hOuter / 2 };
  const pBotInner: Point2D = { x: xInner, y: winYCenter + hInner / 2 };

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  const radius = 0.012 * height;
  drawRoundedPolygon(
    ctx,
    isRight
      ? [pTopInner, pTopOuter, pBotOuter, pBotInner]
      : [pTopOuter, pTopInner, pBotInner, pBotOuter],
    radius
  );

  // Dark translucent fill
  ctx.fillStyle = isRight
    ? `rgba(20, 22, 28, ${(0.4 * winAlpha).toFixed(3)})`
    : `rgba(8, 16, 36, ${(0.4 * winAlpha).toFixed(3)})`;
  ctx.fill();

  // 1px Border at 0.30 alpha
  ctx.strokeStyle = isRight
    ? `rgba(238, 241, 247, ${(0.3 * winAlpha).toFixed(3)})`
    : `rgba(125, 180, 255, ${(0.3 * winAlpha).toFixed(3)})`;
  ctx.lineWidth = 1.0;
  ctx.stroke();

  // 1px Inner top highlight
  ctx.beginPath();
  ctx.moveTo(pTopInner.x + sigma * 2, pTopInner.y + 1);
  ctx.lineTo(pTopOuter.x - sigma * 2, pTopOuter.y + 1);
  ctx.strokeStyle = isRight
    ? `rgba(244, 246, 250, ${(0.35 * winAlpha).toFixed(3)})`
    : `rgba(200, 225, 255, ${(0.35 * winAlpha).toFixed(3)})`;
  ctx.lineWidth = 1.0;
  ctx.stroke();

  // Clip strictly to window for bars
  ctx.clip();

  // SKELETON BARS
  const barH = Math.max(2, 0.008 * height);
  const barGap = 0.026 * height;
  const totalBarsH = (winSpec.barsCount - 1) * barGap;
  const startY = winYCenter - totalBarsH / 2;

  const minX = Math.min(xInner, xOuter);
  const leftX = minX + 0.07 * winW;
  const maxBarW = winW * 0.86;

  ctx.lineCap = "round";
  ctx.lineWidth = barH;

  for (let i = 0; i < winSpec.barsCount; i++) {
    const tBarStart = 1.95 + i * 0.04;
    const pBarGrow = Math.min(1.0, Math.max(0, (t - tBarStart) / 0.12));
    if (pBarGrow <= 0) {
      continue;
    }

    const barY = startY + i * barGap;
    const dyFromCenter = barY - Cy;
    const tiltSlope = -0.04 * (dyFromCenter / (height * 0.25));

    const wRatio = winSpec.barWidthRatios[i] ?? 0.5;
    const currBarW = maxBarW * wRatio * pBarGrow;

    const barAlphaBase =
      i === 0 ? (isRight ? 0.8 : 0.85) : isRight ? 0.48 : 0.55;
    const currBarAlpha = barAlphaBase * winAlpha;

    ctx.strokeStyle = isRight
      ? `rgba(221, 227, 238, ${currBarAlpha.toFixed(3)})`
      : `rgba(125, 180, 255, ${currBarAlpha.toFixed(3)})`;

    const bX1 = leftX;
    const bY1 = barY;
    const bX2 = leftX + currBarW;
    const bY2 = barY + (bX2 - bX1) * tiltSlope;

    ctx.beginPath();
    ctx.moveTo(bX1, bY1);
    ctx.lineTo(bX2, bY2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawUnfoldSingularityGlow(
  ctx: CanvasRenderingContext2D,
  t: number,
  Cx: number,
  Cy: number,
  height: number,
  alphaHandoff: number
) {
  if (t < 1.46 || t >= 2.7) {
    return;
  }
  const showGlow = getLayerVisibility("glow");
  if (!showGlow) {
    return;
  }

  const { unfold } = WELCOME_CONFIG;

  let scale = 1.0;
  let bright = 1.0;
  if (t >= unfold.inhaleStart && t < unfold.inhaleEnd) {
    const p =
      (t - unfold.inhaleStart) / (unfold.inhaleEnd - unfold.inhaleStart);
    scale = 1.0 - (1.0 - unfold.inhaleScale) * Math.sin(p * Math.PI);
    bright = 1.0 + (unfold.inhaleBrightnessBoost - 1.0) * Math.sin(p * Math.PI);
  }

  let flashAlpha = 0;
  if (t >= unfold.start && t < unfold.start + unfold.releaseFlashDuration) {
    const p = (t - unfold.start) / unfold.releaseFlashDuration;
    flashAlpha = Math.sin(p * Math.PI) * 0.95;
  }

  // Cross-fade in from Frame 2 WebGL flare (1.46 -> 1.56s)
  let handoffIn = 1.0;
  if (t < 1.56) {
    handoffIn = Math.max(0, Math.min(1.0, (t - 1.46) / 0.1));
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const rx = 0.2 * height * scale;
  const ry = 0.14 * height * scale;
  const glowAlpha = Math.min(1.0, 0.96 * bright * alphaHandoff * handoffIn);

  // Left half (blue tint) with strictly monotonic smoothstep falloff
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, Cx, height);
  ctx.clip();
  ctx.translate(Cx, Cy);
  ctx.scale(1.0, ry / rx);

  const gradL = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  gradL.addColorStop(0.0, `rgba(255, 255, 253, ${glowAlpha.toFixed(3)})`);
  gradL.addColorStop(
    0.05,
    `rgba(240, 246, 255, ${(glowAlpha * 0.9).toFixed(3)})`
  );
  gradL.addColorStop(
    0.12,
    `rgba(205, 228, 255, ${(glowAlpha * 0.75).toFixed(3)})`
  );
  gradL.addColorStop(
    0.22,
    `rgba(150, 195, 255, ${(glowAlpha * 0.58).toFixed(3)})`
  );
  gradL.addColorStop(
    0.35,
    `rgba(95, 160, 255, ${(glowAlpha * 0.4).toFixed(3)})`
  );
  gradL.addColorStop(
    0.5,
    `rgba(60, 125, 235, ${(glowAlpha * 0.24).toFixed(3)})`
  );
  gradL.addColorStop(
    0.68,
    `rgba(35, 85, 200, ${(glowAlpha * 0.12).toFixed(3)})`
  );
  gradL.addColorStop(
    0.84,
    `rgba(20, 55, 160, ${(glowAlpha * 0.04).toFixed(3)})`
  );
  gradL.addColorStop(1.0, "rgba(10, 30, 120, 0)");

  ctx.fillStyle = gradL;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right half (near-white tint) with strictly monotonic smoothstep falloff
  ctx.save();
  ctx.beginPath();
  ctx.rect(Cx, 0, Cx * 2, height);
  ctx.clip();
  ctx.translate(Cx, Cy);
  ctx.scale(1.0, ry / rx);

  const gradR = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  gradR.addColorStop(0.0, `rgba(255, 255, 253, ${glowAlpha.toFixed(3)})`);
  gradR.addColorStop(
    0.05,
    `rgba(244, 246, 250, ${(glowAlpha * 0.9).toFixed(3)})`
  );
  gradR.addColorStop(
    0.12,
    `rgba(238, 241, 247, ${(glowAlpha * 0.75).toFixed(3)})`
  );
  gradR.addColorStop(
    0.22,
    `rgba(221, 227, 238, ${(glowAlpha * 0.58).toFixed(3)})`
  );
  gradR.addColorStop(
    0.35,
    `rgba(195, 205, 220, ${(glowAlpha * 0.4).toFixed(3)})`
  );
  gradR.addColorStop(
    0.5,
    `rgba(142, 151, 168, ${(glowAlpha * 0.24).toFixed(3)})`
  );
  gradR.addColorStop(
    0.68,
    `rgba(92, 100, 117, ${(glowAlpha * 0.12).toFixed(3)})`
  );
  gradR.addColorStop(
    0.84,
    `rgba(45, 52, 65, ${(glowAlpha * 0.04).toFixed(3)})`
  );
  gradR.addColorStop(1.0, "rgba(25, 30, 40, 0)");

  ctx.fillStyle = gradR;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Faint horizontal anamorphic streak (alpha <= 0.20, 0.3H each way, tapering)
  const streakLen = 0.3 * height * scale;
  const streakAlpha = 0.15 * bright * alphaHandoff;
  const gradStreakL = ctx.createLinearGradient(Cx, Cy, Cx - streakLen, Cy);
  gradStreakL.addColorStop(0, `rgba(255, 255, 255, ${streakAlpha.toFixed(3)})`);
  gradStreakL.addColorStop(
    0.5,
    `rgba(120, 180, 255, ${(streakAlpha * 0.5).toFixed(3)})`
  );
  gradStreakL.addColorStop(1, "rgba(59, 130, 246, 0)");
  ctx.fillStyle = gradStreakL;
  ctx.beginPath();
  ctx.moveTo(Cx, Cy - 1.25);
  ctx.lineTo(Cx - streakLen, Cy);
  ctx.lineTo(Cx, Cy + 1.25);
  ctx.closePath();
  ctx.fill();

  const gradStreakR = ctx.createLinearGradient(Cx, Cy, Cx + streakLen, Cy);
  gradStreakR.addColorStop(0, `rgba(255, 255, 255, ${streakAlpha.toFixed(3)})`);
  gradStreakR.addColorStop(
    0.5,
    `rgba(238, 241, 247, ${(streakAlpha * 0.5).toFixed(3)})`
  );
  gradStreakR.addColorStop(1, "rgba(221, 227, 238, 0)");
  ctx.fillStyle = gradStreakR;
  ctx.beginPath();
  ctx.moveTo(Cx, Cy - 1.25);
  ctx.lineTo(Cx + streakLen, Cy);
  ctx.lineTo(Cx, Cy + 1.25);
  ctx.closePath();
  ctx.fill();

  // Release white-blue flash (1.60s release)
  if (flashAlpha > 0.01) {
    const flashR = 0.09 * height;
    const gradFlash = ctx.createRadialGradient(Cx, Cy, 0, Cx, Cy, flashR);
    gradFlash.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha.toFixed(3)})`);
    gradFlash.addColorStop(
      0.5,
      `rgba(214, 230, 255, ${(flashAlpha * 0.5).toFixed(3)})`
    );
    gradFlash.addColorStop(1.0, "rgba(59, 130, 246, 0)");
    ctx.fillStyle = gradFlash;
    ctx.beginPath();
    ctx.arc(Cx, Cy, flashR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSheetBlade(
  ctx: CanvasRenderingContext2D,
  bladeIndex: number,
  side: "left" | "right",
  t: number,
  Cx: number,
  Cy: number,
  _width: number,
  height: number,
  Wh: number,
  _L: number,
  _La: number,
  tier: "performance" | "balanced" | "eco"
): FrontQuadCorners | null {
  const isRight = side === "right";
  const sigma = isRight ? 1 : -1;
  const cornersList = isRight
    ? UNFOLD_BLADE_CORNERS.right
    : UNFOLD_BLADE_CORNERS.left;
  const spec = cornersList[bladeIndex]!;

  const lagSec = isRight ? WELCOME_CONFIG.rightSideLagSec : 0;
  const jitters = [0.005, -0.01, 0.008, -0.005];
  const jitterSec = jitters[bladeIndex] ?? 0;
  const tLocal = Math.max(0, t - lagSec + jitterSec);

  const { unfold } = WELCOME_CONFIG;
  const bladeDelay = spec.launchDelaySec;
  const tauUnfold = Math.max(0, tLocal - (unfold.start + bladeDelay));

  if (tauUnfold <= 0) {
    return null;
  }

  // 1. Stretch spring on x
  const omega0 = spec.springOmega;
  const zeta = spec.springZeta;
  const sprX = calcSpring(tauUnfold, omega0, zeta);
  const _progX = 0.03 + 0.97 * Math.max(0, sprX.val);

  // 2. Needle-then-inflate lagged spring on height (delay 70ms)
  const tauH = Math.max(0, tauUnfold - unfold.needleInflate.delaySec);
  const sprH = calcSpring(
    tauH,
    unfold.needleInflate.omega0,
    unfold.needleInflate.zeta
  );
  const peakVel = omega0 * 0.6;
  const cv = 1.0 - 0.45 * Math.min(1.0, Math.abs(sprX.vel) / peakVel);
  const progH = (tauH > 0 ? Math.max(0.05, sprH.val) : 0.05) * cv;

  // 3. Hold & Alive breathing (2.30 -> 2.55s)
  let breathe = 1.0;
  let driftWh = 0;
  if (t >= 2.3) {
    breathe = 1.0 + 0.015 * Math.sin(2 * Math.PI * 0.6 * (t - 2.3));
    const driftPhase = bladeIndex * 0.7 + (isRight ? 1.2 : 0);
    driftWh =
      0.004 * Wh * Math.cos(2 * Math.PI * 0.25 * (t - 2.3) + driftPhase);
  }

  // 4. Whip oscillation
  const tauTop = Math.max(0, tauUnfold + (isRight ? -0.02 : 0.02));
  const tauBot = Math.max(0, tauUnfold + (isRight ? 0.02 : -0.02));
  const sprXTop = calcSpring(tauTop, omega0, zeta);
  const sprXBot = calcSpring(tauBot, omega0, zeta);
  const progXTop = 0.03 + 0.97 * Math.max(0, sprXTop.val);
  const progXBot = 0.03 + 0.97 * Math.max(0, sprXBot.val);

  const yawSign = bladeIndex % 2 === 0 ? 1 : -1;
  const leanOsc =
    0.04 *
    Wh *
    Math.exp(-tauUnfold / 0.4) *
    Math.cos(2 * Math.PI * 1.7 * tauUnfold) *
    yawSign;

  // 5. Target positions from traced corner tables
  const targetTopX = spec.top.x * Wh;
  const targetBotX = spec.bottom.x * Wh;
  const targetTopY = spec.top.y * height;
  const targetBotY = spec.bottom.y * height;

  const innerHalfH = 0.004 * height * progH;
  const pTopInner: Point2D = { x: Cx, y: Cy - innerHalfH };
  const pBotInner: Point2D = { x: Cx, y: Cy + innerHalfH };

  const curTopX =
    Cx +
    sigma * (targetTopX * progXTop * breathe + driftWh) +
    (tauUnfold < 0.7 ? leanOsc : 0);
  const curBotX =
    Cx +
    sigma * (targetBotX * progXBot * breathe + driftWh) -
    (tauUnfold < 0.7 ? leanOsc : 0);
  const curTopY = Cy + targetTopY * progH * breathe;
  const curBotY = Cy + targetBotY * progH * breathe;

  const pTopOuter: Point2D = { x: curTopX, y: curTopY };
  const pBotOuter: Point2D = { x: curBotX, y: curBotY };

  const showBlades = getLayerVisibility("blades");
  if (!showBlades) {
    return { pTopInner, pTopOuter, pBotOuter, pBotInner };
  }

  let alphaHandoff = 1.0;
  if (t >= 2.45) {
    alphaHandoff = Math.max(0, 1.0 - (t - 2.45) / 0.25);
  }
  const emergence = Math.min(1.0, tauUnfold / 0.15);
  const velGlow = Math.min(0.6, Math.abs(sprX.vel) / peakVel);
  const depthMultiplier = [1.0, 0.75, 0.55, 0.4][bladeIndex] ?? 0.5;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // DRAW BLADE QUAD
  ctx.beginPath();
  ctx.moveTo(pTopInner.x, pTopInner.y);
  ctx.lineTo(pTopOuter.x, pTopOuter.y);
  ctx.lineTo(pBotOuter.x, pBotOuter.y);
  ctx.lineTo(pBotInner.x, pBotInner.y);
  ctx.closePath();

  // Pure Additive Translucent Glass Gradient
  const grad = ctx.createLinearGradient(
    Cx,
    Cy,
    (pTopOuter.x + pBotOuter.x) / 2,
    (pTopOuter.y + pBotOuter.y) / 2
  );

  const fillRootA = (
    (isRight ? 0.32 : 0.36) *
    depthMultiplier *
    emergence *
    alphaHandoff *
    (1 + 0.2 * Math.exp(-tauUnfold / 0.2))
  ).toFixed(3);
  const fillMidA = (
    (isRight ? 0.165 : 0.22) *
    depthMultiplier *
    emergence *
    alphaHandoff
  ).toFixed(3);
  const fillTipA = (
    (isRight ? 0.075 : 0.1) *
    depthMultiplier *
    emergence *
    alphaHandoff
  ).toFixed(3);

  if (isRight) {
    grad.addColorStop(0, `rgba(244, 246, 250, ${fillRootA})`);
    grad.addColorStop(0.35, `rgba(221, 227, 238, ${fillMidA})`);
    grad.addColorStop(1, `rgba(142, 151, 168, ${fillTipA})`);
  } else {
    grad.addColorStop(0, `rgba(190, 215, 255, ${fillRootA})`);
    grad.addColorStop(0.35, `rgba(115, 185, 255, ${fillMidA})`);
    grad.addColorStop(1, `rgba(75, 140, 240, ${fillTipA})`);
  }

  ctx.fillStyle = grad;
  ctx.fill();

  // Sweeping Specular Sheen (1.90 -> 2.40s) strictly clipped inside quad
  if (tLocal >= unfold.sheenStart && tLocal <= unfold.sheenEnd) {
    ctx.save();
    ctx.clip();
    const pSheen = (tLocal - unfold.sheenStart) / unfold.sheenDuration;
    const sheenDist = (0.15 + 0.7 * pSheen) * Wh;
    const sheenCenterX = Cx + sigma * sheenDist;
    const sheenWidth = 0.12 * Wh;

    const sheenGrad = ctx.createLinearGradient(
      sheenCenterX - sheenWidth / 2,
      Cy - height * 0.3,
      sheenCenterX + sheenWidth / 2,
      Cy + height * 0.3
    );
    sheenGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
    sheenGrad.addColorStop(
      0.5,
      `rgba(255, 255, 255, ${(0.16 * alphaHandoff).toFixed(3)})`
    );
    sheenGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = sheenGrad;
    ctx.fillRect(
      sheenCenterX - sheenWidth,
      Cy - height,
      sheenWidth * 2,
      height * 2
    );
    ctx.restore();
  }

  // Lit Rims with smooth fade-in from singularity root (prevents sharp step at rim root)
  const baseRimAlpha = [0.85, 0.6, 0.45, 0.35][bladeIndex] ?? 0.5;
  const rimAlpha =
    baseRimAlpha * (1.0 + 0.6 * velGlow) * emergence * alphaHandoff;
  const rimColor = isRight ? "#EEF1F7" : "#9CC7FF";

  const rimGradTop = ctx.createLinearGradient(
    pTopInner.x,
    pTopInner.y,
    pTopOuter.x,
    pTopOuter.y
  );
  rimGradTop.addColorStop(0, "rgba(255, 255, 255, 0)");
  rimGradTop.addColorStop(0.04, rimColor);
  rimGradTop.addColorStop(1, rimColor);

  const rimGradBot = ctx.createLinearGradient(
    pBotInner.x,
    pBotInner.y,
    pBotOuter.x,
    pBotOuter.y
  );
  rimGradBot.addColorStop(0, "rgba(255, 255, 255, 0)");
  rimGradBot.addColorStop(0.04, rimColor);
  rimGradBot.addColorStop(1, rimColor);

  ctx.lineCap = "round";

  // Top Rim (1.25px bright + 6px soft glow stroke)
  ctx.strokeStyle = rimGradTop;
  ctx.lineWidth = 1.25;
  ctx.globalAlpha = Math.min(1.0, rimAlpha);
  ctx.beginPath();
  ctx.moveTo(pTopInner.x, pTopInner.y);
  ctx.lineTo(pTopOuter.x, pTopOuter.y);
  ctx.stroke();

  if (tier !== "eco") {
    ctx.lineWidth = 6.0;
    ctx.globalAlpha = rimAlpha * 0.1;
    ctx.stroke();
  }

  // Bottom Rim (45% of top edge brightness)
  ctx.strokeStyle = rimGradBot;
  ctx.lineWidth = 1.25;
  ctx.globalAlpha = rimAlpha * 0.45;
  ctx.beginPath();
  ctx.moveTo(pBotInner.x, pBotInner.y);
  ctx.lineTo(pBotOuter.x, pBotOuter.y);
  ctx.stroke();

  // Outer Edge (1px at 50% brightness)
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = 1.0;
  ctx.globalAlpha = rimAlpha * 0.5;
  ctx.beginPath();
  ctx.moveTo(pTopOuter.x, pTopOuter.y);
  ctx.lineTo(pBotOuter.x, pBotOuter.y);
  ctx.stroke();

  ctx.restore();

  // Code Windows and Skeleton Bars (L1 on left, R2 on right)
  const showWindows = getLayerVisibility("windows");
  if (showWindows && spec.hasWindow && spec.windowSpec) {
    drawBladeWindow(
      ctx,
      spec.windowSpec,
      side,
      t,
      Cx,
      Cy,
      Wh,
      height,
      alphaHandoff
    );
  }

  return { pTopInner, pTopOuter, pBotOuter, pBotInner };
}

function drawUnfoldR1Between(
  _ctx: CanvasRenderingContext2D,
  _t: number,
  _Cx: number,
  _Cy: number,
  _width: number,
  _height: number,
  _Wh: number
) {
  // WebGL stage owns Frame 2 silk ribbons through T=1.95s per Revision 8
  return;
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME 4: ALIGN (2.7 to 4.0s) & WELCOME RETRACT (4.0 to 4.75s)
// ─────────────────────────────────────────────────────────────────────────────

export function drawAlignFrontPanel(
  ctx: CanvasRenderingContext2D,
  side: "left" | "right",
  t: number,
  Cx: number,
  Cy: number,
  _width: number,
  _height: number,
  _Wh: number,
  L: number,
  La: number,
  tier: "performance" | "balanced" | "eco"
): FrontQuadCorners | null {
  const isRight = side === "right";
  const sigma = isRight ? 1 : -1;
  const brightness = isRight ? WELCOME_CONFIG.rightSideBrightness : 1.0;

  const { align, welcome } = WELCOME_CONFIG;
  const pCfg = align.panel;

  // Knot opening & morph into panel between 2.55 and 3.0s
  const sprPanel = calcSpring(t - align.knotOpenStart, 13.0, 0.5);
  const pMorph = Math.min(1.0, Math.max(0, sprPanel.val));

  // Frame 5 Retraction: 4.0 to 4.75s into logo
  let retractScale = 1.0;
  let rimAlphaMult = 1.0;
  let fillAlphaMult = 1.0;

  if (t >= welcome.start) {
    if (t >= welcome.panelsRetractEnd) {
      // Completely gone after 4.75s — zero slivers!
      return null;
    }
    const tRetract = t - welcome.start;
    const sprRetract = calcSpring(tRetract, 12.0, 0.5);
    const rEase = Math.min(1.0, sprRetract.val);

    retractScale = 1.0 - rEase; // slides toward logo flank

    // Rim fades 4.0 -> 4.3s
    rimAlphaMult = Math.max(
      0,
      1.0 - (t - welcome.start) / (welcome.rimFadeEnd - welcome.start)
    );
    // Fill fades 4.3 -> 4.6s
    fillAlphaMult = Math.max(
      0,
      1.0 - (t - welcome.start) / (welcome.fillFadeEnd - welcome.start)
    );
  }

  if (fillAlphaMult <= 0.001) {
    return null;
  }

  // Quad Corners in La
  // left side: inner-top (-0.85, -0.65), outer-top (-2.25, -0.925), outer-bottom (-2.25, +0.925), inner-bottom (-0.85, +0.65)
  // When morphing: interpolate from singularity (0, 0)
  const xIn =
    pCfg.xInnerLa *
    La *
    pMorph *
    (retractScale + (1 - retractScale) * ((0.5 * L) / (pCfg.xInnerLa * La)));
  const xOut =
    pCfg.xOuterLa *
    La *
    pMorph *
    (retractScale + (1 - retractScale) * ((0.5 * L) / (pCfg.xOuterLa * La)));
  const yIn =
    -pCfg.yInnerTopLa *
    La *
    pMorph *
    (retractScale +
      (1 - retractScale) * ((0.5 * L) / (-pCfg.yInnerTopLa * La)));
  const yOut =
    -pCfg.yOuterTopLa *
    La *
    pMorph *
    (retractScale +
      (1 - retractScale) * ((0.5 * L) / (-pCfg.yOuterTopLa * La)));

  const cornerR = pCfg.cornerRadiusLa * La * retractScale;
  const bow = pCfg.bowLa * La * retractScale;

  const mainQuad = {
    pTopInner: { x: Cx + sigma * xIn, y: Cy - yIn },
    pTopOuter: { x: Cx + sigma * xOut, y: Cy - yOut },
    pBotOuter: { x: Cx + sigma * xOut, y: Cy + yOut },
    pBotInner: { x: Cx + sigma * xIn, y: Cy + yIn },
  };

  ctx.save();

  // 1. Rear Layers: 2 copies behind each panel
  if (t < welcome.start && tier !== "eco") {
    const rearConfigs = [pCfg.rearLayer2, pCfg.rearLayer1]; // layer 2 furthest back
    for (const rear of rearConfigs) {
      const rxOut = xOut + rear.offsetOutLa * La;
      const ryOut = yOut + rear.heightAddLa * La * 0.5;
      const ryIn = yIn + rear.heightAddLa * La * 0.5;

      const rearQuad = {
        pTopInner: { x: Cx + sigma * xIn, y: Cy - ryIn },
        pTopOuter: { x: Cx + sigma * rxOut, y: Cy - ryOut },
        pBotOuter: { x: Cx + sigma * rxOut, y: Cy + ryOut },
        pBotInner: { x: Cx + sigma * xIn, y: Cy + ryIn },
      };

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawRoundedPanel(ctx, rearQuad, cornerR * 1.1, bow);
      ctx.fillStyle = isRight
        ? `rgba(92, 100, 117, ${(rear.fillAlpha * brightness).toFixed(3)})`
        : `rgba(30, 58, 138, ${(rear.fillAlpha * brightness).toFixed(3)})`;
      ctx.fill();

      ctx.strokeStyle = isRight
        ? DESIGN_TOKENS.amber.litRim
        : DESIGN_TOKENS.blue.litRim;
      ctx.lineWidth = 1.0;
      ctx.globalAlpha = rear.rimAlpha * brightness;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 2. Main Panel Body: Opaque Navy Base (alpha >= 0.80 under text area!)
  ctx.save();
  drawRoundedPanel(ctx, mainQuad, cornerR, bow);

  // Navy base hides everything behind it
  ctx.fillStyle = pCfg.baseNavy;
  ctx.globalAlpha = fillAlphaMult;
  ctx.fill();

  // Color wash from logo-facing edge to far edge
  ctx.globalCompositeOperation = "lighter";
  const washGrad = ctx.createLinearGradient(
    mainQuad.pTopInner.x,
    Cy,
    mainQuad.pTopOuter.x,
    Cy
  );
  if (isRight) {
    washGrad.addColorStop(
      0,
      `rgba(221, 227, 238, ${(0.28 * fillAlphaMult * brightness).toFixed(3)})`
    );
    washGrad.addColorStop(
      1,
      `rgba(92, 100, 117, ${(0.08 * fillAlphaMult * brightness).toFixed(3)})`
    );
  } else {
    washGrad.addColorStop(
      0,
      `rgba(76, 141, 255, ${(0.32 * fillAlphaMult * brightness).toFixed(3)})`
    );
    washGrad.addColorStop(
      1,
      `rgba(30, 58, 138, ${(0.1 * fillAlphaMult * brightness).toFixed(3)})`
    );
  }
  ctx.fillStyle = washGrad;
  ctx.fill();

  // Radial pool of light at logo-facing edge (radius 0.7*La, alpha 0.30)
  const poolGrad = ctx.createRadialGradient(
    mainQuad.pTopInner.x,
    Cy,
    0,
    mainQuad.pTopInner.x,
    Cy,
    0.7 * La
  );
  if (isRight) {
    poolGrad.addColorStop(
      0,
      `rgba(238, 241, 247, ${(0.3 * fillAlphaMult * brightness).toFixed(3)})`
    );
    poolGrad.addColorStop(1, "rgba(221, 227, 238, 0)");
  } else {
    poolGrad.addColorStop(
      0,
      `rgba(156, 199, 255, ${(0.3 * fillAlphaMult * brightness).toFixed(3)})`
    );
    poolGrad.addColorStop(1, "rgba(59, 130, 246, 0)");
  }
  ctx.fillStyle = poolGrad;
  ctx.fill();

  // 3. Rims: Soft 1px rim (logo-facing 0.55, top 0.45, far 0.12 — NOT neon!)
  const rimColor = isRight
    ? DESIGN_TOKENS.amber.litRim
    : DESIGN_TOKENS.blue.litRim;

  // Soft glow layer: 6px stroke at 0.06
  if (tier !== "eco" && rimAlphaMult > 0.05) {
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 6.0;
    ctx.globalAlpha = 0.06 * rimAlphaMult * brightness;
    ctx.stroke();
  }

  // 1px Inner Top Highlight at 0.18
  ctx.beginPath();
  ctx.moveTo(mainQuad.pTopInner.x, mainQuad.pTopInner.y + 1.5);
  ctx.lineTo(mainQuad.pTopOuter.x, mainQuad.pTopOuter.y + 1.5);
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1.0;
  ctx.globalAlpha = 0.18 * rimAlphaMult * brightness;
  ctx.stroke();

  // Primary 1px Rim Stroke
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = 1.0;
  ctx.globalAlpha = 0.45 * rimAlphaMult * brightness;
  drawRoundedPanel(ctx, mainQuad, cornerR, bow);
  ctx.stroke();

  ctx.restore();
  ctx.restore();

  return mainQuad;
}

export function drawSilkHorn(
  ctx: CanvasRenderingContext2D,
  sheetIndex: number, // 1 for S2, 2 for S3, 3 for S4
  side: "left" | "right",
  t: number,
  Cx: number,
  Cy: number,
  _width: number,
  height: number,
  Wh: number,
  _L: number,
  La: number,
  tier: "performance" | "balanced" | "eco"
) {
  const isRight = side === "right";
  const sigma = isRight ? 1 : -1;
  const brightness = isRight ? WELCOME_CONFIG.rightSideBrightness : 1.0;

  const { align } = WELCOME_CONFIG;
  const hCfg = align.horns;
  const idx = sheetIndex - 1; // 0, 1, 2

  const hornStagger = idx * hCfg.staggerSec;
  const tauHorn = Math.max(0, t - (hCfg.morphStart + hornStagger));
  const sprHorn = calcSpring(tauHorn, hCfg.omega0 - idx * 0.5, hCfg.zeta);
  const pMorph = Math.min(1.0, Math.max(0, sprHorn.val));

  // Breathing and slow S-ripple
  const breath = 1.0 + hCfg.breatheRatio * Math.sin(t * 1.6 + idx);
  const sRipple = hCfg.sRippleH * height * Math.sin(t * 1.4 + idx);

  // Geometry
  const xIn = hCfg.xInLa * La;
  const xOut = hCfg.xOutWh * Wh * pMorph;
  const hhRoot = hCfg.hhRootLa[idx]! * La * breath;
  const hhEdge = hCfg.hhEdgeH[idx]! * height * breath;

  const samples = 64;
  const sPts: { x: number; yc: number; hh: number }[] = [];

  for (let i = 0; i <= samples; i++) {
    const s = i / samples;
    const currX = Cx + sigma * (xIn + (xOut - xIn) * s);
    const yc = Cy + sRipple * Math.sin(Math.PI * s);

    // Bell flare: hh(s) = hhRoot + (hhEdge - hhRoot) * s^1.5
    const hh = hhRoot + (hhEdge - hhRoot) * s ** 1.5;
    sPts.push({ x: currX, yc, hh });
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // 1. Translucent FILL between yc-hh and yc+hh
  ctx.beginPath();
  ctx.moveTo(sPts[0]!.x, sPts[0]!.yc - sPts[0]!.hh);
  for (let i = 1; i <= samples; i++) {
    ctx.lineTo(sPts[i]!.x, sPts[i]!.yc - sPts[i]!.hh);
  }
  for (let i = samples; i >= 0; i--) {
    ctx.lineTo(sPts[i]!.x, sPts[i]!.yc + sPts[i]!.hh);
  }
  ctx.closePath();

  const fillRoot = hCfg.fillAlphaRoot[idx]! * brightness;
  const fillGrad = ctx.createLinearGradient(
    Cx + sigma * xIn,
    Cy,
    Cx + sigma * xOut,
    Cy
  );
  if (isRight) {
    fillGrad.addColorStop(
      0,
      `rgba(244, 246, 250, ${(fillRoot * 1.2).toFixed(3)})`
    );
    fillGrad.addColorStop(
      0.4,
      `rgba(221, 227, 238, ${(fillRoot * 0.7).toFixed(3)})`
    );
    fillGrad.addColorStop(0.88, "rgba(92, 100, 117, 0.03)");
    fillGrad.addColorStop(1, "rgba(92, 100, 117, 0)"); // outer 12% fades to 0
  } else {
    fillGrad.addColorStop(
      0,
      `rgba(191, 216, 255, ${(fillRoot * 1.2).toFixed(3)})`
    );
    fillGrad.addColorStop(
      0.4,
      `rgba(59, 130, 246, ${(fillRoot * 0.7).toFixed(3)})`
    );
    fillGrad.addColorStop(0.88, "rgba(30, 58, 138, 0.03)");
    fillGrad.addColorStop(1, "rgba(30, 58, 138, 0)");
  }
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // 2. K = 16 Fold Streaks (Pleated silk, alpha doubled near top rim)
  const K = tier === "eco" ? 8 : hCfg.K;
  const tw = hCfg.tw;
  const sidePhase = isRight ? WELCOME_CONFIG.rightSidePhaseOffset : 0;

  ctx.lineWidth = 1.0;
  for (let k = 0; k < K; k++) {
    const phi_k = (2 * Math.PI * k) / K;
    const isTopPleat = Math.sin(phi_k) < -0.3; // near top rim
    const pleatAlphaMult = isTopPleat ? 2.0 : 1.0;

    const streakGrad = ctx.createLinearGradient(
      Cx + sigma * xIn,
      Cy,
      Cx + sigma * xOut,
      Cy
    );
    const alphaS = fillRoot * 0.7 * pleatAlphaMult;
    if (isRight) {
      streakGrad.addColorStop(
        0,
        `rgba(238, 241, 247, ${(alphaS * 1.3).toFixed(3)})`
      );
      streakGrad.addColorStop(
        0.4,
        `rgba(221, 227, 238, ${(alphaS * 0.8).toFixed(3)})`
      );
      streakGrad.addColorStop(
        0.88,
        `rgba(92, 100, 117, ${(alphaS * 0.2).toFixed(3)})`
      );
      streakGrad.addColorStop(1, "rgba(92, 100, 117, 0)");
    } else {
      streakGrad.addColorStop(
        0,
        `rgba(156, 199, 255, ${(alphaS * 1.3).toFixed(3)})`
      );
      streakGrad.addColorStop(
        0.4,
        `rgba(59, 130, 246, ${(alphaS * 0.8).toFixed(3)})`
      );
      streakGrad.addColorStop(
        0.88,
        `rgba(30, 58, 138, ${(alphaS * 0.2).toFixed(3)})`
      );
      streakGrad.addColorStop(1, "rgba(30, 58, 138, 0)");
    }
    ctx.strokeStyle = streakGrad;

    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const s = i / samples;
      const pt = sPts[i]!;
      const tau = tw * Math.sin(2 * Math.PI * (0.8 * s - 0.15 * t) + sidePhase);
      const y_k = pt.yc + pt.hh * Math.sin(phi_k + tau);
      if (i === 0) {
        ctx.moveTo(pt.x, y_k);
      } else {
        ctx.lineTo(pt.x, y_k);
      }
    }
    ctx.stroke();
  }

  // 3. Top and Bottom Rims (1.25px)
  const rimAlpha = hCfg.rimAlpha[idx]! * brightness;
  const rimColor = isRight
    ? DESIGN_TOKENS.amber.litRim
    : DESIGN_TOKENS.blue.litRim;
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = 1.25;
  ctx.globalAlpha = rimAlpha;

  // Top Rim
  ctx.beginPath();
  ctx.moveTo(sPts[0]!.x, sPts[0]!.yc - sPts[0]!.hh);
  for (let i = 1; i <= samples; i++) {
    ctx.lineTo(sPts[i]!.x, sPts[i]!.yc - sPts[i]!.hh);
  }
  ctx.stroke();

  // Bottom Rim
  ctx.beginPath();
  ctx.moveTo(sPts[0]!.x, sPts[0]!.yc + sPts[0]!.hh);
  for (let i = 1; i <= samples; i++) {
    ctx.lineTo(sPts[i]!.x, sPts[i]!.yc + sPts[i]!.hh);
  }
  ctx.stroke();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME 5 (TOP): WELCOME WINGS (4.0 to 5.2s, then idle)
// ─────────────────────────────────────────────────────────────────────────────

export function drawWelcomeWings(
  ctx: CanvasRenderingContext2D,
  t: number,
  Cx: number,
  Cy: number,
  _width: number,
  height: number,
  Wh: number,
  L: number,
  verticalCutoffY: number,
  tier: "performance" | "balanced" | "eco"
) {
  const { welcome, align } = WELCOME_CONFIG;
  const wCfg = welcome.wings;

  // Morph from horns (4.0 -> 5.2s, spring omega0 7, zeta 0.7)
  const tauWing = Math.max(0, t - welcome.hornsRelaxStart);
  const sprWing = calcSpring(tauWing, 7.0, 0.7);
  const pMorph = Math.min(1.0, Math.max(0, sprWing.val));

  // Idle flutter (amplitude +-0.015*L, 30fps)
  const flutter = wCfg.flutterAmpL * L * Math.sin(t * 2.8);

  // Monotone cubic PCHIP evaluation for wing pose in units of L
  // Control points: x in [0.50, 4.40], y positive DOWN
  const xSpan = Math.min(Wh, 4.5 * L);
  const samples = 64;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const side of ["left", "right"] as const) {
    const isRight = side === "right";
    const sigma = isRight ? 1 : -1;
    const brightness = isRight ? WELCOME_CONFIG.rightSideBrightness : 1.0;
    const sidePhase = isRight ? WELCOME_CONFIG.rightSidePhaseOffset : 0;

    // 1. Broad Glass Layers (2 layers behind wings, thickness x1.7, offset up 0.08*L)
    if (tier !== "eco") {
      for (let gIdx = 0; gIdx < wCfg.rearGlassLayers; gIdx++) {
        const offsetUp = (0.08 + gIdx * 0.06) * L;
        ctx.beginPath();
        let started = false;

        for (let i = 0; i <= samples; i++) {
          const s = i / samples;
          const uL = 0.5 + s * 3.9; // 0.5 to 4.4 L
          const currX = Cx + sigma * uL * L;

          // Pure PCHIP evaluation
          const cyL = evalPchip(uL, WING_CENTERLINE_CONTROL_POINTS, "y");
          const hhL =
            evalPchip(uL, WING_HALF_THICKNESS_CONTROL_POINTS, "hh") *
            wCfg.rearGlassThickMult;

          // In canvas, y positive is down, so Cy + cyL*L:
          const yTop = Cy + cyL * L - hhL * L - offsetUp;
          if (yTop > verticalCutoffY) {
            continue;
          }

          if (started) {
            ctx.lineTo(currX, yTop);
          } else {
            ctx.moveTo(currX, yTop);
            started = true;
          }
        }

        for (let i = samples; i >= 0; i--) {
          const s = i / samples;
          const uL = 0.5 + s * 3.9;
          const currX = Cx + sigma * uL * L;
          const cyL = evalPchip(uL, WING_CENTERLINE_CONTROL_POINTS, "y");
          const hhL =
            evalPchip(uL, WING_HALF_THICKNESS_CONTROL_POINTS, "hh") *
            wCfg.rearGlassThickMult;
          const yBot = Cy + cyL * L + hhL * L - offsetUp;
          if (yBot <= verticalCutoffY) {
            ctx.lineTo(currX, yBot);
          }
        }
        ctx.closePath();

        ctx.fillStyle = isRight
          ? `rgba(244, 246, 250, ${(wCfg.rearGlassAlpha * brightness).toFixed(3)})`
          : `rgba(191, 216, 255, ${(wCfg.rearGlassAlpha * brightness).toFixed(3)})`;
        ctx.fill();
      }
    }

    // 2. 5 Soft Silk Bands per side with +-0.06*L offsets
    for (let bIdx = 0; bIdx < wCfg.bandCount; bIdx++) {
      const bOffsetL = (bIdx - 2) * wCfg.bandOffsetL;
      const bandPts: { x: number; yTop: number; yBot: number }[] = [];

      for (let i = 0; i <= samples; i++) {
        const s = i / samples;
        const uL = 0.5 + s * 3.9;
        const currX = Cx + sigma * uL * L;

        // PCHIP evaluation
        const wingY_L = evalPchip(uL, WING_CENTERLINE_CONTROL_POINTS, "y");
        const wingHh_L = evalPchip(
          uL,
          WING_HALF_THICKNESS_CONTROL_POINTS,
          "hh"
        );

        // Blend from Horn pose during morph
        const hornHh = align.horns.hhEdgeH[1]! * height * 0.4;
        const effHh_L = wingHh_L * pMorph + (hornHh / L) * (1 - pMorph);

        const yc = Cy + (wingY_L + bOffsetL) * L + flutter * (1 - s);
        const hh = effHh_L * L;

        // Hard Limit: Upper edge never rises above logo top for x < 1.0*L
        // Logo top is at Cy - 0.5*L
        let yTop = yc - hh;
        if (uL < 1.0 && yTop < Cy - 0.5 * L) {
          yTop = Cy - 0.5 * L;
        }

        const yBot = Math.min(verticalCutoffY, yc + hh);

        bandPts.push({ x: currX, yTop, yBot });
      }

      ctx.beginPath();
      ctx.moveTo(bandPts[0]!.x, bandPts[0]!.yTop);
      for (let i = 1; i < bandPts.length; i++) {
        ctx.lineTo(bandPts[i]!.x, bandPts[i]!.yTop);
      }
      for (let i = bandPts.length - 1; i >= 0; i--) {
        ctx.lineTo(bandPts[i]!.x, bandPts[i]!.yBot);
      }
      ctx.closePath();

      // Alpha is 1 out to x = 3.0*L, then fades to 0 at screen edge
      const fillGrad = ctx.createLinearGradient(
        Cx + sigma * 0.5 * L,
        Cy,
        Cx + sigma * xSpan,
        Cy
      );
      const alphaBase = (bIdx === 2 ? 0.12 : 0.08) * brightness;

      if (isRight) {
        fillGrad.addColorStop(
          0,
          `rgba(244, 246, 250, ${(alphaBase * 1.2).toFixed(3)})`
        );
        fillGrad.addColorStop(
          0.6,
          `rgba(221, 227, 238, ${(alphaBase * 0.8).toFixed(3)})`
        );
        fillGrad.addColorStop(
          0.85,
          `rgba(92, 100, 117, ${(alphaBase * 0.2).toFixed(3)})`
        );
        fillGrad.addColorStop(1.0, "rgba(92, 100, 117, 0)");
      } else {
        fillGrad.addColorStop(
          0,
          `rgba(191, 216, 255, ${(alphaBase * 1.2).toFixed(3)})`
        );
        fillGrad.addColorStop(
          0.6,
          `rgba(59, 130, 246, ${(alphaBase * 0.8).toFixed(3)})`
        );
        fillGrad.addColorStop(
          0.85,
          `rgba(30, 58, 138, ${(alphaBase * 0.2).toFixed(3)})`
        );
        fillGrad.addColorStop(1.0, "rgba(30, 58, 138, 0)");
      }
      ctx.fillStyle = fillGrad;
      ctx.fill();
    }

    // 3. 10 Fold Streaks concentrated toward lower edge
    const K = tier === "eco" ? 5 : wCfg.foldStreaksK;
    const tw = 0.5;
    ctx.lineWidth = 1.0;

    for (let k = 0; k < K; k++) {
      const phi_k = (Math.PI * k) / K; // lower half of circle (sin positive)
      const streakGrad = ctx.createLinearGradient(
        Cx + sigma * 0.5 * L,
        Cy,
        Cx + sigma * xSpan,
        Cy
      );
      const sAlpha = 0.08 * brightness;

      if (isRight) {
        streakGrad.addColorStop(
          0,
          `rgba(238, 241, 247, ${(sAlpha * 1.4).toFixed(3)})`
        );
        streakGrad.addColorStop(
          0.6,
          `rgba(221, 227, 238, ${(sAlpha * 0.8).toFixed(3)})`
        );
        streakGrad.addColorStop(1, "rgba(92, 100, 117, 0)");
      } else {
        streakGrad.addColorStop(
          0,
          `rgba(156, 199, 255, ${(sAlpha * 1.4).toFixed(3)})`
        );
        streakGrad.addColorStop(
          0.6,
          `rgba(59, 130, 246, ${(sAlpha * 0.8).toFixed(3)})`
        );
        streakGrad.addColorStop(1, "rgba(30, 58, 138, 0)");
      }
      ctx.strokeStyle = streakGrad;

      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const s = i / samples;
        const uL = 0.5 + s * 3.9;
        const currX = Cx + sigma * uL * L;

        const wingY_L = evalPchip(uL, WING_CENTERLINE_CONTROL_POINTS, "y");
        const wingHh_L = evalPchip(
          uL,
          WING_HALF_THICKNESS_CONTROL_POINTS,
          "hh"
        );
        const yc = Cy + wingY_L * L;
        const hh = wingHh_L * L;

        const tau =
          tw * Math.sin(2 * Math.PI * (0.8 * s - 0.15 * t) + sidePhase);
        const y_k = Math.min(verticalCutoffY, yc + hh * Math.sin(phi_k + tau));

        if (i === 0) {
          ctx.moveTo(currX, y_k);
        } else {
          ctx.lineTo(currX, y_k);
        }
      }
      ctx.stroke();
    }

    // 4. Rims: Lower edge bright (alpha 0.6), upper edge softer (0.28)
    const rimColor = isRight
      ? DESIGN_TOKENS.amber.litRim
      : DESIGN_TOKENS.blue.litRim;
    ctx.strokeStyle = rimColor;

    // Lower Edge Rim
    ctx.lineWidth = 1.25;
    ctx.globalAlpha = wCfg.rimLowerAlpha * brightness;
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const s = i / samples;
      const uL = 0.5 + s * 3.9;
      const currX = Cx + sigma * uL * L;
      const wingY_L = evalPchip(uL, WING_CENTERLINE_CONTROL_POINTS, "y");
      const wingHh_L = evalPchip(uL, WING_HALF_THICKNESS_CONTROL_POINTS, "hh");
      const yBot = Math.min(verticalCutoffY, Cy + (wingY_L + wingHh_L) * L);
      if (i === 0) {
        ctx.moveTo(currX, yBot);
      } else {
        ctx.lineTo(currX, yBot);
      }
    }
    ctx.stroke();

    // Upper Edge Rim
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = wCfg.rimUpperAlpha * brightness;
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const s = i / samples;
      const uL = 0.5 + s * 3.9;
      const currX = Cx + sigma * uL * L;
      const wingY_L = evalPchip(uL, WING_CENTERLINE_CONTROL_POINTS, "y");
      const wingHh_L = evalPchip(uL, WING_HALF_THICKNESS_CONTROL_POINTS, "hh");
      const yTop = Cy + (wingY_L - wingHh_L) * L;
      if (yTop > verticalCutoffY) {
        continue;
      }
      if (i === 0) {
        ctx.moveTo(currX, yTop);
      } else {
        ctx.lineTo(currX, yTop);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}
