/**
 * waveMath.ts — Silky Woven Ribbon Engine with Filled Translucent Bands.
 *
 * Implements the exact drawing model specified:
 * - Each ribbon is a FILLED translucent band between two edge curves (c(x) +- w(x)).
 * - Additive ('lighter') compositing: overlapping translucent fills add up to a silky glow.
 * - Exactly 16 items per side: 3 hero ribbons, 5 sibling ribbons, 8 hairline shimmer strands.
 * - Low spatial frequency (dominant 0.95-1.25 cycles, secondary 1.85-2.15 cycles at <=30% amp).
 * - Small phase offsets (+-0.65 rad) so ribbons travel together like a woven sheet.
 * - Smooth envelope: 0 at singularity, peak at 60% span, tapering to 35% at screen edge.
 * - Final state: amplitudes relax to +-5-7% H, sweeping outward and slightly upward from flanks.
 * - Final vertical cutoff: nothing rendered below logo bottom + 0.3 L (never passes behind "Welcome").
 */

import { DESIGN_TOKENS, RIBBON_CONFIG, WELCOME_CONFIG } from "./welcome.config";

export interface RibbonDef {
  edgeAlpha: number;
  fillAlpha: number;
  freq1: number;
  freq2: number;
  halfWidthFactor: number;
  index: number;
  phase1: number;
  phase2: number;
  side: "left" | "right";
  speed1: number;
  speed2: number;
  type: "hero" | "sibling" | "hairline";
  verticalSpread: number; // offset factor relative to bundle center
}

// ── 1. Deterministic Ribbon Parameter Table (Allocated Once) ─────────────────

function createRibbons(): readonly RibbonDef[] {
  const list: RibbonDef[] = [];

  for (const side of ["left", "right"] as const) {
    let idx = 0;

    // ── 3 Hero Ribbons (Wider, Brighter) ──
    for (let i = 0; i < 3; i++) {
      const pOffset = (i - 1) * 0.42; // within +-0.65 rad
      const spread = (i - 1) * 0.35;
      list.push({
        side,
        index: idx++,
        type: "hero",
        freq1: 1.05 + i * 0.08,
        freq2: 1.95 + i * 0.09,
        speed1: 1.1 + i * 0.08,
        speed2: 1.5 + i * 0.1,
        phase1: pOffset,
        phase2: pOffset + 0.3,
        halfWidthFactor: 0.02 + i * 0.006, // 1.6% to 3.2% of H at peak
        fillAlpha: 0.075 + i * 0.015,
        edgeAlpha: 0.45 + i * 0.08,
        verticalSpread: spread,
      });
    }

    // ── 5 Sibling Ribbons (Narrower, Fainter) ──
    for (let i = 0; i < 5; i++) {
      const pOffset = (i - 2) * 0.28;
      const spread = (i - 2) * 0.42;
      list.push({
        side,
        index: idx++,
        type: "sibling",
        freq1: 0.98 + i * 0.06,
        freq2: 1.88 + i * 0.07,
        speed1: 1.0 + i * 0.06,
        speed2: 1.4 + i * 0.08,
        phase1: pOffset,
        phase2: pOffset + 0.25,
        halfWidthFactor: 0.008 + i * 0.0015, // 0.8% to 1.4% of H
        fillAlpha: 0.045,
        edgeAlpha: 0.28,
        verticalSpread: spread,
      });
    }

    // ── 8 Hairline Strands (Shimmer Lines) ──
    for (let i = 0; i < 8; i++) {
      const pOffset = (i - 3.5) * 0.16;
      const spread = (i - 3.5) * 0.24;
      list.push({
        side,
        index: idx++,
        type: "hairline",
        freq1: 1.15 + i * 0.03,
        freq2: 2.1 + i * 0.04,
        speed1: 1.2 + i * 0.05,
        speed2: 1.6 + i * 0.05,
        phase1: pOffset,
        phase2: pOffset + 0.4,
        halfWidthFactor: 0,
        fillAlpha: 0,
        edgeAlpha: 0.22,
        verticalSpread: spread,
      });
    }
  }

  return list;
}

export const RIBBON_REGISTRY = createRibbons();

// ── 2. Envelope & Curve Evaluation (Zero Allocation) ─────────────────────────

/**
 * Envelope function: 0 at singularity (u=0), peaks at u=0.6, tapers to 35% at edge (u=1).
 */
export function evaluateEnvelope(u: number): number {
  if (u <= 0) {
    return 0;
  }
  if (u >= 1) {
    return 0.35;
  }
  // Scaled smooth curve
  if (u <= 0.6) {
    const p = u / 0.6;
    return Math.sin((p * Math.PI) / 2) ** 1.3;
  }
  const p = (u - 0.6) / 0.4;
  return 1.0 - 0.65 * (p * p * (3 - 2 * p));
}

/**
 * Evaluates the centerline vertical position c(x) at normalized distance u in [0, 1].
 */
export function evaluateCenterlineY(
  u: number,
  t: number,
  ribbon: RibbonDef,
  baseAmpPx: number,
  isFinalState: boolean,
  viewportHeight: number
): number {
  const env = evaluateEnvelope(u);

  // Dominant sinusoid + weaker second sinusoid (<=30% amplitude)
  const wave1 = Math.sin(
    ribbon.freq1 * u * Math.PI * 2 - ribbon.speed1 * t + ribbon.phase1
  );
  const wave2 = Math.sin(
    ribbon.freq2 * u * Math.PI * 2 + ribbon.speed2 * t + ribbon.phase2
  );

  // Slow incommensurate modulation (prevents visible loops)
  const mod = 1.0 + 0.12 * Math.sin(0.43 * t + ribbon.phase1);

  const undulatingY =
    (wave1 + RIBBON_CONFIG.secondAmpRatio * wave2) * mod * env * baseAmpPx;

  // Vertical bundle fanning
  const spreadY = ribbon.verticalSpread * env * (baseAmpPx * 0.55);

  // In final state: ribbons sweep outward and slightly upward from flanks
  let sweepUp = 0;
  if (isFinalState) {
    sweepUp = -viewportHeight * RIBBON_CONFIG.finalSweepUpRatio * u ** 1.4;
  }

  return undulatingY + spreadY + sweepUp;
}

// ── 3. High-Performance Canvas 2D Ribbon Render Loop ─────────────────────────

export function renderSilkRibbons(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  originX: number,
  originY: number,
  t: number,
  verticalCutoffY: number | null,
  tier: "performance" | "balanced" | "eco" = "performance"
): void {
  const resStart = WELCOME_CONFIG.resonance.start;
  const resEnd = WELCOME_CONFIG.resonance.end;

  if (t < resStart) {
    return;
  }

  // Wavefront expansion: 0 -> 1 across RESONANCE (0.7s -> 1.6s)
  const wfRaw = Math.min(1.0, (t - resStart) / (resEnd - resStart));
  const wavefrontProgress = 1 - (1 - wfRaw) ** 2.2; // smooth ease-out

  const isFinalState = t >= WELCOME_CONFIG.welcome.start;

  // Determine base amplitude depending on stage
  let ampRatio: number = RIBBON_CONFIG.ampResonance;
  if (t < WELCOME_CONFIG.unfold.start) {
    ampRatio = RIBBON_CONFIG.ampResonance;
  } else if (t < WELCOME_CONFIG.welcome.start) {
    ampRatio = RIBBON_CONFIG.ampUnfoldAlign;
  } else {
    // Settle down to ambient +-5-7% of H
    const pSettle = Math.min(1.0, (t - WELCOME_CONFIG.welcome.start) / 0.9);
    ampRatio =
      RIBBON_CONFIG.ampUnfoldAlign +
      (RIBBON_CONFIG.ampFinal - RIBBON_CONFIG.ampUnfoldAlign) * pSettle;
  }

  const baseAmpPx = height * ampRatio;
  const globalAlpha = Math.min(1.0, (t - resStart) / 0.35);

  const samples = tier === "eco" ? 45 : 75;
  const maxLeftDist = originX;
  const maxRightDist = width - originX;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Pre-create color gradients
  const leftFillGrad = ctx.createLinearGradient(originX, originY, 0, originY);
  leftFillGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  leftFillGrad.addColorStop(0.1, DESIGN_TOKENS.blue.highlight);
  leftFillGrad.addColorStop(0.45, DESIGN_TOKENS.blue.core);
  leftFillGrad.addColorStop(0.85, DESIGN_TOKENS.blue.deep);
  leftFillGrad.addColorStop(1, "rgba(30, 58, 138, 0)");

  const rightFillGrad = ctx.createLinearGradient(
    originX,
    originY,
    width,
    originY
  );
  rightFillGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  rightFillGrad.addColorStop(0.1, DESIGN_TOKENS.amber.highlight);
  rightFillGrad.addColorStop(0.45, DESIGN_TOKENS.amber.core2);
  rightFillGrad.addColorStop(0.85, DESIGN_TOKENS.amber.deep);
  rightFillGrad.addColorStop(1, "rgba(92, 100, 117, 0)");

  // Clip region in final state: strictly ABOVE headline (never below verticalCutoffY)
  if (isFinalState && verticalCutoffY !== null) {
    ctx.beginPath();
    ctx.rect(0, 0, width, verticalCutoffY);
    ctx.clip();
  }

  // Pre-allocated arrays for upper and lower curves
  const topX = new Float32Array(samples + 1);
  const topY = new Float32Array(samples + 1);
  const botY = new Float32Array(samples + 1);

  for (const ribbon of RIBBON_REGISTRY) {
    if (tier === "eco" && ribbon.type === "hairline") {
      continue;
    }

    const isLeft = ribbon.side === "left";
    const maxDist = isLeft ? maxLeftDist : maxRightDist;
    const grad = isLeft ? leftFillGrad : rightFillGrad;

    const activeDist = maxDist * wavefrontProgress;
    if (activeDist <= 1) {
      continue;
    }

    const step = activeDist / samples;

    // Calculate top and bottom edge curves
    for (let i = 0; i <= samples; i++) {
      const d = i * step;
      const u = d / maxDist;
      const cy =
        originY +
        evaluateCenterlineY(u, t, ribbon, baseAmpPx, isFinalState, height);

      const halfW = height * ribbon.halfWidthFactor * evaluateEnvelope(u);
      const px = isLeft ? originX - d : originX + d;

      topX[i] = px;
      topY[i] = cy - halfW;
      botY[i] = cy + halfW;
    }

    // ── 1. Render Filled Translucent Ribbon Band ──
    if (ribbon.type !== "hairline") {
      ctx.beginPath();
      ctx.moveTo(topX[0]!, topY[0]!);
      for (let i = 1; i <= samples; i++) {
        ctx.lineTo(topX[i]!, topY[i]!);
      }
      for (let i = samples; i >= 0; i--) {
        ctx.lineTo(topX[i]!, botY[i]!);
      }
      ctx.closePath();

      ctx.fillStyle = grad;
      ctx.globalAlpha = ribbon.fillAlpha * globalAlpha;
      ctx.fill();
    }

    // ── 2. Stroke Top Edge (1px) ──
    ctx.beginPath();
    ctx.moveTo(topX[0]!, topY[0]!);
    for (let i = 1; i <= samples; i++) {
      ctx.lineTo(topX[i]!, topY[i]!);
    }
    ctx.strokeStyle = grad;
    ctx.globalAlpha = ribbon.edgeAlpha * globalAlpha;
    ctx.lineWidth = ribbon.type === "hairline" ? 1.0 : 1.2;
    ctx.stroke();

    // ── 3. Stroke Bottom Edge (for filled bands) ──
    if (ribbon.type !== "hairline") {
      ctx.beginPath();
      ctx.moveTo(topX[0]!, botY[0]!);
      for (let i = 1; i <= samples; i++) {
        ctx.lineTo(topX[i]!, botY[i]!);
      }
      ctx.strokeStyle = grad;
      ctx.globalAlpha = ribbon.edgeAlpha * globalAlpha * 0.9;
      ctx.lineWidth = 1.0;
      ctx.stroke();
    }
  }

  ctx.restore();
}
