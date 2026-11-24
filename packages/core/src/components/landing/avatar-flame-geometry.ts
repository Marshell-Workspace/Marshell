export type PerformanceTier = "eco" | "balanced" | "performance";

export type CanonicalAvatarState =
  | "idle"
  | "thinking"
  | "working"
  | "success"
  | "listening"
  | "sleeping";

export type MainAgentAvatarVariant = "white" | "obsidian";

export interface FlameOffsets {
  c_mid_x: number;
  c_mid_y: number;
  c_tip_x: number;
  c_tip_y: number;
  l_mid_x: number;
  l_mid_y: number;
  l_tip_x: number;
  l_tip_y: number;
  r_mid_x: number;
  r_mid_y: number;
  r_tip_x: number;
  r_tip_y: number;
}

function hash1(n: number): number {
  const v = Math.sin(n * 127.1 + 311.7) * 43_758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

function smoothNoise(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  const a = hash1(i + seed * 17.31);
  const b = hash1(i + 1 + seed * 17.31);
  return a + (b - a) * u;
}

function smoothstep(lo: number, hi: number, v: number): number {
  const x = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return x * x * (3 - 2 * x);
}

interface FlameProfile {
  bias: number;
  rate: number;
  reach: number;
  rise: number;
  seed: number;
  travel: number;
}

const FLAME_PROFILES = {
  central: { reach: 44, rise: 15, seed: 1.7, rate: 0.82, travel: 1.9, bias: 0 },
  left: { reach: 28, rise: 9, seed: 4.3, rate: 1.15, travel: 1.5, bias: -0.1 },
  right: {
    reach: 30,
    rise: 11,
    seed: 7.9,
    rate: 0.96,
    travel: 1.7,
    bias: 0.08,
  },
} as const satisfies Record<string, FlameProfile>;

function flameDisplacement(
  profile: FlameProfile,
  h: number,
  t: number,
  speed: number,
  amp: number,
  tier: PerformanceTier
): [number, number] {
  const weight = h * (1.5 - 0.5 * h);
  const octaves = tier === "eco" ? 1 : tier === "performance" ? 3 : 2;
  const time = t * speed;

  let sway = 0;
  let norm = 0;
  let rate = profile.rate;
  let gain = 1;
  for (let o = 0; o < octaves; o += 1) {
    sway +=
      gain *
      smoothNoise(
        time * rate - h * profile.travel * (1 + o * 0.6),
        profile.seed + o * 3.7
      );
    norm += gain;
    rate *= 2.15;
    gain *= 0.42;
  }
  sway /= norm;
  sway += 0.28 * sway * Math.abs(sway);

  const lean = smoothNoise(time * 0.19 - h * 0.5, profile.seed + 9.1);
  const gust = smoothstep(
    0.3,
    0.85,
    smoothNoise(time * 0.23, profile.seed + 5.3)
  );

  const rawDx =
    profile.reach *
    amp *
    weight *
    (1 + 0.45 * gust) *
    (sway * 1.35 + lean * 0.55 + profile.bias);
  const limit = profile.reach * Math.max(amp, 0.2) * 1.4;
  const dx = limit * Math.tanh(rawDx / limit);

  const lengthFlicker = smoothNoise(
    time * (profile.rate * 1.25) - h * 1.4,
    profile.seed + 2.2
  );
  const dy =
    -profile.rise *
      amp *
      weight *
      (0.15 + 0.85 * lengthFlicker) *
      (1 + 0.3 * gust) +
    (Math.abs(dx) / profile.reach) * 5 * weight * amp;

  return [dx, dy];
}

export function computeFlameWavePoint(
  x0: number,
  y0: number,
  zone: "central" | "left" | "right" | "core",
  t: number,
  speed: number,
  amp: number,
  tier: PerformanceTier = "balanced"
): [number, number] {
  if (y0 >= 224) {
    return [x0, y0];
  }

  const range = {
    central: { yBase: 222.0, yTip: 8.0 },
    left: { yBase: 224.0, yTip: 168.0 },
    right: { yBase: 210.0, yTip: 132.0 },
    core: { yBase: 210.0, yTip: 8.0 },
  }[zone];

  if (y0 >= range.yBase) {
    return [x0, y0];
  }

  const h = Math.max(
    0.0,
    Math.min(1.0, (range.yBase - y0) / (range.yBase - range.yTip))
  );

  if (zone === "core") {
    const [dx, dy] = flameDisplacement(
      FLAME_PROFILES.central,
      h,
      t - 0.11,
      speed,
      amp * 0.9,
      tier
    );
    return [x0 + dx, y0 + dy * 0.9];
  }

  const [dx, dy] = flameDisplacement(
    FLAME_PROFILES[zone],
    h,
    t,
    speed,
    amp,
    tier
  );
  return [x0 + dx, y0 + dy];
}

function flameStateParams(canonicalState: CanonicalAvatarState): {
  baseAmp: number;
  speed: number;
} {
  switch (canonicalState) {
    case "idle":
      return { speed: 1.0, baseAmp: 1.0 };
    case "working":
      return { speed: 1.25, baseAmp: 1.0 };
    case "thinking":
      return { speed: 1.05, baseAmp: 0.82 };
    case "success":
      return { speed: 1.35, baseAmp: 1.15 };
    case "listening":
      return { speed: 0.95, baseAmp: 0.58 };
    case "sleeping":
      return { speed: 0.45, baseAmp: 0.22 };
    default:
      return { speed: 1.0, baseAmp: 0.75 };
  }
}

export function computeFlameOffsets(
  t: number,
  tier: PerformanceTier = "balanced",
  canonicalState: CanonicalAvatarState = "idle",
  amplitudeScale = 1
): FlameOffsets {
  const { speed, baseAmp } = flameStateParams(canonicalState);
  const tierAmp = tier === "eco" ? 0.75 : 1.0;
  const amp = baseAmp * tierAmp * amplitudeScale;

  const cTip = computeFlameWavePoint(278, 8, "central", t, speed, amp, tier);
  const cMid = computeFlameWavePoint(204, 32, "central", t, speed, amp, tier);
  const lTip = computeFlameWavePoint(88, 168, "left", t, speed, amp, tier);
  const lMid = computeFlameWavePoint(98, 182, "left", t, speed, amp, tier);
  const rTip = computeFlameWavePoint(342, 132, "right", t, speed, amp, tier);
  const rMid = computeFlameWavePoint(352, 136, "right", t, speed, amp, tier);

  return {
    c_tip_x: cTip[0] - 278,
    c_tip_y: cTip[1] - 8,
    c_mid_x: cMid[0] - 204,
    c_mid_y: cMid[1] - 32,
    l_tip_x: lTip[0] - 88,
    l_tip_y: lTip[1] - 168,
    l_mid_x: lMid[0] - 98,
    l_mid_y: lMid[1] - 182,
    r_tip_x: rTip[0] - 342,
    r_tip_y: rTip[1] - 132,
    r_mid_x: rMid[0] - 352,
    r_mid_y: rMid[1] - 136,
  };
}

export function generateAvatarBodyPath(
  o: FlameOffsets,
  timeSec?: number,
  tier: PerformanceTier = "balanced",
  canonicalState: CanonicalAvatarState = "idle",
  amplitudeScale = 1
): string {
  if (timeSec !== undefined) {
    const { speed, baseAmp } = flameStateParams(canonicalState);
    const tierAmp = tier === "eco" ? 0.75 : 1.0;
    const amp = baseAmp * tierAmp * amplitudeScale;

    const p = (x0: number, y0: number, zone: "central" | "left" | "right") => {
      const pt = computeFlameWavePoint(x0, y0, zone, timeSec, speed, amp, tier);
      return `${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`;
    };

    return (
      `M ${p(278, 8, "central")} ` +
      `C ${p(246, 14, "central")}, ${p(204, 32, "central")}, ${p(174, 54, "central")} ` +
      `C ${p(146, 74, "central")}, ${p(130, 106, "central")}, ${p(124, 138, "central")} ` +
      `C ${p(122, 160, "central")}, ${p(124, 186, "central")}, ${p(127, 210, "central")} ` +
      `C ${p(128, 221, "central")}, ${p(122, 225, "central")}, ${p(116, 223, "left")} ` +
      `C ${p(110, 219, "left")}, ${p(102, 198, "left")}, ${p(98, 182, "left")} ` +
      `C ${p(95, 172, "left")}, ${p(92, 168, "left")}, ${p(88, 168, "left")} ` +
      `C ${p(82, 168, "left")}, ${p(72, 184, "left")}, 62 198 ` +
      "C 46 225, 30 260, 22 292 " +
      "C 18 315, 18 342, 24 370 " +
      "C 32 405, 58 440, 92 462 " +
      "C 130 485, 180 488, 228 484 " +
      "C 290 480, 355 460, 396 422 " +
      "C 428 392, 442 350, 436 308 " +
      "C 434 275, 424 240, 408 205 " +
      `C ${p(392, 175, "right")}, ${p(374, 155, "right")}, ${p(352, 136, "right")} ` +
      `C ${p(342, 132, "right")}, ${p(334, 138, "right")}, ${p(327, 146, "right")} ` +
      `C ${p(322, 154, "right")}, ${p(322, 168, "right")}, ${p(320, 178, "right")} ` +
      `C ${p(316, 192, "right")}, ${p(304, 202, "right")}, ${p(288, 208, "central")} ` +
      `C ${p(270, 200, "central")}, ${p(250, 178, "central")}, ${p(242, 150, "central")} ` +
      `C ${p(236, 120, "central")}, ${p(242, 80, "central")}, ${p(258, 45, "central")} ` +
      `C ${p(268, 22, "central")}, ${p(275, 14, "central")}, ${p(278, 8, "central")} Z`
    );
  }

  const cx = o.c_tip_x;
  const cy = o.c_tip_y;
  const cmx = o.c_mid_x;
  const cmy = o.c_mid_y;
  const lx = o.l_tip_x;
  const ly = o.l_tip_y;
  const lmx = o.l_mid_x;
  const lmy = o.l_mid_y;
  const rx = o.r_tip_x;
  const ry = o.r_tip_y;
  const rmx = o.r_mid_x;
  const rmy = o.r_mid_y;

  return (
    `M ${(278 + cx).toFixed(1)} ${(8 + cy).toFixed(1)} ` +
    `C ${(246 + cx * 0.75 + cmx * 0.25).toFixed(1)} ${(14 + cy * 0.75).toFixed(1)}, ${(204 + cx * 0.4 + cmx * 0.6).toFixed(1)} ${(32 + cy * 0.4).toFixed(1)}, ${(174 + cmx).toFixed(1)} ${(54 + cmy).toFixed(1)} ` +
    `C ${(146 + cmx * 0.6).toFixed(1)} ${(74 + cmy * 0.6).toFixed(1)}, ${(130 + cmx * 0.3).toFixed(1)} 106, 124 138 ` +
    "C 122 160, 124 186, 127 210 " +
    "C 128 221, 122 225, 116 223 " +
    `C ${(110 + lmx * 0.2).toFixed(1)} 219, ${(102 + lmx * 0.6).toFixed(1)} ${(198 + lmy * 0.4).toFixed(1)}, ${(98 + lmx * 0.8).toFixed(1)} ${(182 + lmy * 0.7).toFixed(1)} ` +
    `C ${(95 + lmx * 0.9 + lx * 0.1).toFixed(1)} ${(172 + ly * 0.6).toFixed(1)}, ${(92 + lx * 0.8).toFixed(1)} ${(168 + ly * 0.85).toFixed(1)}, ${(88 + lx).toFixed(1)} ${(168 + ly).toFixed(1)} ` +
    `C ${(82 + lx * 0.7).toFixed(1)} ${(168 + ly * 0.7).toFixed(1)}, ${(72 + lmx * 0.5).toFixed(1)} ${(184 + lmy * 0.5).toFixed(1)}, 62 198 ` +
    "C 46 225, 30 260, 22 292 " +
    "C 18 315, 18 342, 24 370 " +
    "C 32 405, 58 440, 92 462 " +
    "C 130 485, 180 488, 228 484 " +
    "C 290 480, 355 460, 396 422 " +
    "C 428 392, 442 350, 436 308 " +
    "C 434 275, 424 240, 408 205 " +
    `C ${(392 + rmx * 0.4).toFixed(1)} ${(175 + rmy * 0.4).toFixed(1)}, ${(374 + rmx * 0.8).toFixed(1)} ${(155 + rmy * 0.8).toFixed(1)}, ${(352 + rx * 0.8).toFixed(1)} ${(136 + ry * 0.8).toFixed(1)} ` +
    `C ${(342 + rx).toFixed(1)} ${(132 + ry).toFixed(1)}, ${(334 + rx * 0.9).toFixed(1)} ${(138 + ry * 0.9).toFixed(1)}, ${(327 + rx * 0.75 + rmx * 0.25).toFixed(1)} ${(146 + ry * 0.75).toFixed(1)} ` +
    `C ${(322 + rmx * 0.7).toFixed(1)} ${(154 + rmy * 0.7).toFixed(1)}, ${(322 + rmx * 0.4).toFixed(1)} 168, 320 178 ` +
    "C 316 192, 304 202, 288 208 " +
    `C ${(270 + cmx * 0.3).toFixed(1)} ${(200 + cmy * 0.2).toFixed(1)}, ${(250 + cmx * 0.6).toFixed(1)} ${(178 + cmy * 0.5).toFixed(1)}, ${(242 + cmx * 0.9).toFixed(1)} ${(150 + cmy * 0.8).toFixed(1)} ` +
    `C ${(236 + cmx).toFixed(1)} ${(120 + cmy).toFixed(1)}, ${(242 + cmx * 0.7 + cx * 0.3).toFixed(1)} ${(80 + cy * 0.4).toFixed(1)}, ${(258 + cmx * 0.3 + cx * 0.7).toFixed(1)} ${(45 + cy * 0.75).toFixed(1)} ` +
    `C ${(268 + cx * 0.85).toFixed(1)} ${(22 + cy * 0.85).toFixed(1)}, ${(275 + cx * 0.95).toFixed(1)} ${(14 + cy * 0.95).toFixed(1)}, ${(278 + cx).toFixed(1)} ${(8 + cy).toFixed(1)} Z`
  );
}

export function generatePurpleCorePath(
  o: FlameOffsets,
  timeSec?: number,
  tier: PerformanceTier = "balanced",
  canonicalState: CanonicalAvatarState = "idle",
  amplitudeScale = 1
): string {
  if (timeSec !== undefined) {
    const { speed, baseAmp } = flameStateParams(canonicalState);
    const tierAmp = tier === "eco" ? 0.75 : 1.0;
    const amp = baseAmp * tierAmp * amplitudeScale;

    const p = (x0: number, y0: number, zone: "central" | "core") => {
      const pt = computeFlameWavePoint(x0, y0, zone, timeSec, speed, amp, tier);
      return `${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`;
    };

    return (
      `M ${p(278, 8, "central")} ` +
      `C ${p(275, 14, "central")}, ${p(268, 22, "central")}, ${p(258, 45, "central")} ` +
      `C ${p(242, 80, "central")}, ${p(236, 120, "central")}, ${p(242, 150, "central")} ` +
      `C ${p(250, 178, "central")}, ${p(270, 200, "central")}, ${p(288, 208, "central")} ` +
      `C ${p(308, 205, "core")}, ${p(324, 195, "core")}, ${p(333, 180, "core")} ` +
      `C ${p(336, 170, "core")}, ${p(330, 155, "core")}, ${p(315, 135, "core")} ` +
      `C ${p(296, 108, "core")}, ${p(274, 75, "core")}, ${p(271, 45, "core")} ` +
      `C ${p(270, 25, "core")}, ${p(275, 16, "core")}, ${p(278, 8, "central")} Z`
    );
  }

  const cx = o.c_tip_x;
  const cy = o.c_tip_y;
  const cmx = o.c_mid_x;
  const cmy = o.c_mid_y;
  const rmx = o.r_mid_x;

  return (
    `M ${(278 + cx).toFixed(1)} ${(8 + cy).toFixed(1)} ` +
    `C ${(275 + cx * 0.95).toFixed(1)} ${(14 + cy * 0.95).toFixed(1)}, ${(268 + cx * 0.85).toFixed(1)} ${(22 + cy * 0.85).toFixed(1)}, ${(258 + cmx * 0.3 + cx * 0.7).toFixed(1)} ${(45 + cy * 0.75).toFixed(1)} ` +
    `C ${(242 + cmx * 0.7 + cx * 0.3).toFixed(1)} ${(80 + cy * 0.4).toFixed(1)}, ${(236 + cmx).toFixed(1)} ${(120 + cmy).toFixed(1)}, ${(242 + cmx * 0.9).toFixed(1)} ${(150 + cmy * 0.8).toFixed(1)} ` +
    `C ${(250 + cmx * 0.6).toFixed(1)} ${(178 + cmy * 0.5).toFixed(1)}, ${(270 + cmx * 0.3).toFixed(1)} ${(200 + cmy * 0.2).toFixed(1)}, 288 208 ` +
    `C ${(308 + rmx * 0.2).toFixed(1)} 205, ${(324 + rmx * 0.5).toFixed(1)} 195, ${(333 + rmx * 0.6).toFixed(1)} 180 ` +
    `C ${(336 + rmx * 0.6).toFixed(1)} 170, ${(330 + rmx * 0.4).toFixed(1)} 155, ${(315 + cmx * 0.3).toFixed(1)} 135 ` +
    `C ${(296 + cmx * 0.5).toFixed(1)} 108, ${(274 + cmx * 0.4 + cx * 0.3).toFixed(1)} 75, ${(271 + cx * 0.6).toFixed(1)} 45 ` +
    `C ${(270 + cx * 0.8).toFixed(1)} 25, ${(275 + cx * 0.95).toFixed(1)} 16, ${(278 + cx).toFixed(1)} ${(8 + cy).toFixed(1)} Z`
  );
}

export function generateCrestTonguePaths(
  cx: number,
  cy: number,
  lx: number,
  ly: number,
  rx: number,
  ry: number,
  t: number
): { center: string; left: string; right: string } {
  const flickC1 = smoothNoise(t * 5.3, 11.1) * 3.5;
  const flickC2 = smoothNoise(t * 4.4, 12.6) * 4.0;
  const center =
    `M ${(cx - 6).toFixed(1)} ${(cy + 3).toFixed(1)} ` +
    `C ${(cx - 4 + flickC1).toFixed(1)} ${(cy - 15).toFixed(1)}, ${(cx + 2 + flickC1 * 1.4).toFixed(1)} ${(cy - 30 + flickC2).toFixed(1)}, ${(cx + flickC1 * 1.8).toFixed(1)} ${(cy - 42 + flickC2).toFixed(1)} ` +
    `C ${(cx + 6 + flickC1).toFixed(1)} ${(cy - 27).toFixed(1)}, ${(cx + 8).toFixed(1)} ${(cy - 9).toFixed(1)}, ${(cx + 5).toFixed(1)} ${(cy + 4).toFixed(1)} Z`;

  const flickL = smoothNoise(t * 5.9, 13.4) * 3.0;
  const left =
    `M ${(lx - 3).toFixed(1)} ${(ly + 2).toFixed(1)} ` +
    `C ${(lx - 7 + flickL).toFixed(1)} ${(ly - 12).toFixed(1)}, ${(lx - 10 + flickL * 1.3).toFixed(1)} ${(ly - 24).toFixed(1)}, ${(lx - 12 + flickL * 1.6).toFixed(1)} ${(ly - 33).toFixed(1)} ` +
    `C ${(lx - 7 + flickL).toFixed(1)} ${(ly - 21).toFixed(1)}, ${(lx - 2).toFixed(1)} ${(ly - 9).toFixed(1)}, ${(lx + 3).toFixed(1)} ${(ly + 2).toFixed(1)} Z`;

  const flickR = smoothNoise(t * 5.1, 14.8) * 3.0;
  const right =
    `M ${(rx - 3).toFixed(1)} ${(ry + 2).toFixed(1)} ` +
    `C ${(rx + 5 + flickR).toFixed(1)} ${(ry - 10).toFixed(1)}, ${(rx + 8 + flickR * 1.3).toFixed(1)} ${(ry - 22).toFixed(1)}, ${(rx + 10 + flickR * 1.6).toFixed(1)} ${(ry - 30).toFixed(1)} ` +
    `C ${(rx + 5 + flickR).toFixed(1)} ${(ry - 18).toFixed(1)}, ${(rx + 1).toFixed(1)} ${(ry - 8).toFixed(1)}, ${(rx + 3).toFixed(1)} ${(ry + 2).toFixed(1)} Z`;

  return { center, left, right };
}
