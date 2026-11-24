/**
 * resonanceWaveShader.ts — Screen-Space Analytic Silk Wave & Center Glow for Marshell (Revision 10).
 *
 * Implements Frame 2 RESONANCE (T = 0.50 -> 1.95s):
 * - Screen-space fragment shader over +-0.32H band.
 * - Analytic summation of Gaussians across 84 strands per side (R1: 28, R2: 20, S1-S3: 12 each).
 * - Exact PCHIP centerline with UP crest at u=0.44 (0.067H) and lobe below axis at u=0.92.
 * - Edge-on twist pinch at u=0.68 stacking strands into a bright line via additive blending.
 * - Faint body haze across hero ribbons and soft fanning veil sheets.
 * - Soft seamless center glow (core, inner halo, wide ellipse) with warm white center.
 * - Smooth emergence via smootherstep S(x) = x^3*(6x^2 - 15x + 10):
 *     alpha, width, twist, lift growth. Silk emerges from point without wipe/mask.
 * - Additive rendering into Half-Float render target with half-resolution bloom (strength 0.7).
 * - Hue-preserving tone mapping: l = max(r,g,b); color *= (1 - exp(-1.2*l)) / l;
 *   Strictly no cyan and no lemon, brightest silk pixel 50-80% white.
 * - Canvas completely transparent outside +-0.32H band, preserving the #05070D page background.
 */

import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// 1. STRAND CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
// Offset sk in [-1, 1], alpha ak (+-30%), sigma in px
const STRANDS_GLSL = /* glsl */ `
const vec3 STRANDS_R1[28] = vec3[28](
  vec3(-1.00000, 1.40000, 1.60000),
  vec3(-0.94979, 1.09641, 1.35439),
  vec3(-0.83375, 1.03182, 1.17199),
  vec3(-0.80274, 0.70231, 1.39219),
  vec3(-0.68255, 0.70742, 1.16757),
  vec3(-0.65483, 0.88607, 1.08303),
  vec3(-0.55058, 1.04596, 1.00951),
  vec3(-0.50194, 1.16902, 1.39299),
  vec3(-0.42001, 1.01469, 1.06946),
  vec3(-0.31472, 1.23876, 1.02019),
  vec3(-0.27720, 0.88842, 1.13147),
  vec3(-0.19656, 0.84915, 1.10818),
  vec3(-0.09311, 1.10370, 1.25001),
  vec3(-0.01524, 1.08115, 1.26425),
  vec3(0.01814, 0.75119, 1.24239),
  vec3(0.10245, 1.16630, 1.37003),
  vec3(0.17714, 0.71808, 1.14159),
  vec3(0.24392, 1.02042, 1.21621),
  vec3(0.35607, 1.08201, 1.16278),
  vec3(0.42290, 0.70435, 1.19247),
  vec3(0.48608, 1.18461, 1.12831),
  vec3(0.57085, 0.82296, 1.34950),
  vec3(0.60837, 0.90407, 1.25522),
  vec3(0.69439, 1.04594, 1.02850),
  vec3(0.78427, 1.04754, 1.27177),
  vec3(0.86466, 1.27284, 1.20280),
  vec3(0.94808, 1.19124, 1.06534),
  vec3(1.00000, 1.40000, 1.60000)
);

const vec3 STRANDS_R2[20] = vec3[20](
  vec3(-1.00000, 1.40000, 1.60000),
  vec3(-0.86485, 0.80108, 1.13278),
  vec3(-0.80271, 0.82339, 1.37926),
  vec3(-0.67025, 1.19385, 1.31519),
  vec3(-0.58614, 0.72348, 1.38891),
  vec3(-0.48776, 0.99960, 1.21157),
  vec3(-0.36653, 1.24512, 1.09499),
  vec3(-0.25782, 1.04332, 1.37106),
  vec3(-0.18539, 1.01718, 1.36155),
  vec3(-0.08544, 0.82368, 1.37342),
  vec3(0.02529, 0.90530, 1.09841),
  vec3(0.13629, 1.03591, 1.32167),
  vec3(0.26724, 1.12525, 1.03527),
  vec3(0.35932, 1.18167, 1.32157),
  vec3(0.46027, 0.72919, 1.25232),
  vec3(0.56964, 1.14471, 1.05756),
  vec3(0.70643, 1.27476, 1.31474),
  vec3(0.76496, 0.71098, 1.21685),
  vec3(0.91278, 1.22740, 1.13734),
  vec3(1.00000, 1.40000, 1.60000)
);

const vec3 STRANDS_S1[12] = vec3[12](
  vec3(-1.00000, 1.10000, 2.50000),
  vec3(-0.80355, 0.74275, 2.91202),
  vec3(-0.62377, 1.05818, 2.41729),
  vec3(-0.49557, 1.03676, 2.47904),
  vec3(-0.23245, 1.09523, 2.10998),
  vec3(-0.06498, 1.05724, 2.68284),
  vec3(0.10166, 0.81540, 2.30060),
  vec3(0.33348, 0.71589, 2.00353),
  vec3(0.49347, 1.20386, 2.91013),
  vec3(0.61774, 1.14673, 2.81506),
  vec3(0.86020, 1.09817, 2.69400),
  vec3(1.00000, 1.10000, 2.50000)
);

const vec3 STRANDS_S2[12] = vec3[12](
  vec3(-1.00000, 1.10000, 2.50000),
  vec3(-0.81253, 1.18650, 2.10774),
  vec3(-0.61251, 0.90819, 2.67330),
  vec3(-0.45371, 1.23046, 2.28960),
  vec3(-0.29780, 1.18996, 2.85144),
  vec3(-0.12841, 0.78592, 2.85743),
  vec3(0.05570, 1.28099, 2.06284),
  vec3(0.27229, 0.70922, 2.09302),
  vec3(0.48279, 1.07211, 2.55043),
  vec3(0.66146, 1.16941, 2.47772),
  vec3(0.77321, 0.72143, 2.32817),
  vec3(1.00000, 1.10000, 2.50000)
);

const vec3 STRANDS_S3[12] = vec3[12](
  vec3(-1.00000, 1.10000, 2.50000),
  vec3(-0.82540, 1.21129, 2.06382),
  vec3(-0.65394, 0.88733, 2.02210),
  vec3(-0.48444, 0.83077, 2.37782),
  vec3(-0.27416, 1.13100, 2.71914),
  vec3(-0.15147, 1.05329, 2.64138),
  vec3(0.13196, 0.89928, 2.73181),
  vec3(0.21274, 0.89197, 2.79632),
  vec3(0.39165, 0.82734, 2.92062),
  vec3(0.64090, 1.10846, 2.61916),
  vec3(0.80762, 1.11820, 2.63693),
  vec3(1.00000, 1.10000, 2.50000)
);
`;

// ─────────────────────────────────────────────────────────────────────────────
// 2. PASS 1: SCENE SHADER (Strands + Veils + Center Glow into Half-Float)
// ─────────────────────────────────────────────────────────────────────────────
const ResonanceSceneVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const ResonanceSceneFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  ${STRANDS_GLSL}

  // Exact PCHIP evaluation for centerline (Both sides crest UP: +0.067H at u=0.44)
  float evalPchip(float u) {
    const float xs[10] = float[10](0.00, 0.10, 0.22, 0.34, 0.44, 0.54, 0.64, 0.74, 0.86, 1.00);
    const float ys[10] = float[10](0.0000, 0.0040, 0.0300, 0.0550, 0.0670, 0.0480, 0.0120, -0.0180, -0.0360, -0.0460);
    const float ds[10] = float[10](0.00000, 0.06615, 0.21242, 0.15105, 0.00000, -0.24873, -0.32727, -0.20204, -0.09766, -0.02912);
    const float hs[9] = float[9](0.10, 0.12, 0.12, 0.10, 0.10, 0.10, 0.10, 0.12, 0.14);

    if (u <= 0.0) return 0.0;
    if (u >= 1.0) return ys[9];

    for (int i = 0; i < 9; i++) {
      if (u <= xs[i + 1]) {
        float t = (u - xs[i]) / hs[i];
        float t2 = t * t;
        float t3 = t2 * t;
        float h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
        float h01 = -2.0 * t3 + 3.0 * t2;
        float h10 = t3 - 2.0 * t2 + t;
        float h11 = t3 - t2;
        return h00 * ys[i] + h01 * ys[i + 1] + h10 * hs[i] * ds[i] + h11 * hs[i] * ds[i + 1];
      }
    }
    return ys[9];
  }

  // Smootherstep S(x) = x^3*(6x^2 - 15x + 10)
  float S(float x) {
    float c = clamp(x, 0.0, 1.0);
    return c * c * c * (c * (c * 6.0 - 15.0) + 10.0);
  }

  // Lift smootherstep with <= 6% overshoot
  float Slift(float x) {
    float c = clamp(x, 0.0, 1.0);
    float s = c * c * c * (c * (c * 6.0 - 15.0) + 10.0);
    float overshoot = 0.06 * sin(c * 3.14159265);
    return s + (c < 1.0 ? overshoot : 0.0);
  }

  // Colors along u:
  // u=0 #EAF2FF / #F4F6FA; u=0.25 #9CC7FF / #EEF1F7; u=0.5 #3B82F6 / #DDE3EE; u=1 #1E3A8A / #5C6475
  // Near-white is ~92% as bright as blue
  vec3 getColorAlongU(float u, float side) {
    vec3 c0 = side < 0.0 ? vec3(0.918, 0.949, 1.0) : vec3(244.0 / 255.0, 246.0 / 255.0, 250.0 / 255.0);
    vec3 c1 = side < 0.0 ? vec3(0.612, 0.780, 1.0) : vec3(238.0 / 255.0, 241.0 / 255.0, 247.0 / 255.0);
    vec3 c2 = side < 0.0 ? vec3(0.231, 0.510, 0.965) : vec3(221.0 / 255.0, 227.0 / 255.0, 238.0 / 255.0);
    vec3 c3 = side < 0.0 ? vec3(0.118, 0.227, 0.541) : vec3(92.0 / 255.0, 100.0 / 255.0, 117.0 / 255.0);

    vec3 col;
    if (u < 0.25) {
      col = mix(c0, c1, u / 0.25);
    } else if (u < 0.50) {
      col = mix(c1, c2, (u - 0.25) / 0.25);
    } else {
      col = mix(c2, c3, clamp((u - 0.50) / 0.50, 0.0, 1.0));
    }

    if (side > 0.0) {
      col *= 0.92;
    }
    return col;
  }

  void main() {
    float H = uResolution.y;
    float Wh = uResolution.x * 0.5;

    // Pixel coordinates relative to screen center
    float x = (vUv.x - 0.5) * uResolution.x;
    float y = (vUv.y - 0.5) * uResolution.y; // Positive is UP

    // Strict +-0.32H band check: completely transparent outside band
    if (abs(y) > 0.32 * H) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float u = abs(x) / Wh;
    float side = x < 0.0 ? -1.0 : 1.0;
    float t = uTime;

    // ─────────────────────────────────────────────────────────────────────────
    // A. CENTER GLOW (T = 0.50 -> 1.56s)
    // ─────────────────────────────────────────────────────────────────────────
    vec3 glowOut = vec3(0.0);
    if (t >= 0.50 && t < 1.56) {
      // Swell from 4px point (0.50s) to full soft glow (0.78s) with <=6% overshoot
      float pGlow = clamp((t - 0.50) / 0.28, 0.0, 1.0);
      float sGlow = S(pGlow) + 0.05 * sin(pGlow * 3.14159265);
      sGlow = max(0.035, sGlow); // 4px dot floor at T=0.50

      // Cross-fade to Frame 3 Canvas2D glow between 1.46 and 1.56s
      float glowAlpha = t < 1.46 ? 1.0 : max(0.0, 1.0 - (t - 1.46) / 0.10);

      float r = sqrt(x * x + y * y);

      // 1. Hot Core (Gaussian sigma 0.010H, near-white)
      float sigmaCore = max(2.0, 0.010 * H * sGlow);
      float coreDensity = exp(-0.5 * (r * r) / (sigmaCore * sigmaCore));

      // 2. Inner Halo (Radius 0.08*Wh, alpha 0.48, monotone profile reaching 0 at boundary)
      float rHalo = 0.08 * Wh * sGlow;
      float haloDensity = 0.0;
      if (r < rHalo) {
        float pHalo = r / rHalo;
        haloDensity = 0.48 * pow(1.0 - pHalo * pHalo, 2.0);
      }

      // 3. Wide Ellipse (rx 0.38*Wh, ry 0.16*H, alpha 0.18, reaching 0 at boundary)
      float rx = 0.38 * Wh * sGlow;
      float ry = 0.16 * H * sGlow;
      float dEll = sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry));
      float ellipseDensity = 0.0;
      if (dEll < 1.0) {
        ellipseDensity = 0.18 * pow(1.0 - dEll * dEll, 2.0);
      }

      // Monotone C1 color blend across center: blue-white -> warm white -> amber-white
      // smoothstep(-0.05*Wh, +0.05*Wh, x) ensures NO seam and NO step at center
      float blendX = smoothstep(-0.05 * Wh, 0.05 * Wh, x);
      vec3 colBlueWhite = vec3(0.918, 0.949, 1.0);  // #EAF2FF
      vec3 colWarmWhite = vec3(244.0 / 255.0, 246.0 / 255.0, 250.0 / 255.0);  // near-white center (#F4F6FA)
      vec3 colAmberWhite = vec3(238.0 / 255.0, 241.0 / 255.0, 247.0 / 255.0); // right side (#EEF1F7)
      vec3 haloColor = blendX < 0.5
        ? mix(colBlueWhite, colWarmWhite, blendX * 2.0)
        : mix(colWarmWhite, colAmberWhite, (blendX - 0.5) * 2.0);

      // Hot core near-white
      vec3 coreColor = mix(haloColor, vec3(1.0), 0.90);

      glowOut = (coreDensity * coreColor * 2.0 + (haloDensity + ellipseDensity) * haloColor) * glowAlpha;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // B. SILK RIBBONS & VEIL (T = 0.62 -> 1.95s)
    // ─────────────────────────────────────────────────────────────────────────
    vec3 silkOut = vec3(0.0);
    if (t >= 0.62 && t < 1.95) {
      // Living silk drift: +-12 deg at 0.11 Hz, +-0.008H sway at 0.2 Hz, +-6% breathing
      float swayPhase = side > 0.0 ? 0.15 : 0.0;
      float sway = 0.008 * H * sin(2.0 * 3.14159265 * 0.20 * t + swayPhase);
      float breath = 1.0 + 0.06 * sin(t * 1.57);

      // Amber side crest shift (+0.02 shift in crest u)
      float uEff = side > 0.0 ? clamp(u - 0.02, 0.0, 1.0) : u;

      // Settlement and fade: 1.50-1.60 drops to 70%, 1.60-1.95 fades to 0
      float settleFade = 1.0;
      if (t >= 1.50 && t < 1.60) {
        settleFade = 1.0 - 0.30 * smoothstep(1.50, 1.60, t);
      } else if (t >= 1.60) {
        settleFade = 0.70 * (1.0 - smoothstep(1.60, 1.95, t));
      }

      // Smooth edge falloff reaching exactly 0 before screen edge
      float edgeFade = 1.0 - smoothstep(0.62, 0.90, u);

      // Axis-line safety: normalize strand density when coincident near center (u < 0.18)
      // so drawn width is >= 1.6px and line's peak is at most 35% of glow's peak
      float strandNorm = mix(0.18, 1.0, smoothstep(0.02, 0.18, uEff));

      float totalDensity = 0.0;
      float A = 0.92;

      // ── Hero Ribbon 1 (R1: 28 strands, wMax = 0.030H) ──
      {
        float dj = 0.0;
        float aProg = S((t - 0.62 - 0.18 * u - dj) / 0.35) * settleFade;
        float wProg = S((t - 0.64 - 0.22 * u - dj) / 0.40);
        float twProg = S((t - 0.72 - 0.22 * u - dj) / 0.45);
        float lfProg = Slift((t - 0.80 - 0.20 * u - dj) / 0.45);

        float drift1 = (12.0 * 3.14159265 / 180.0) * sin(2.0 * 3.14159265 * 0.11 * t);
        float theta1 = (3.14159265 * smoothstep(0.44, 0.92, uEff) + drift1) * twProg;
        float cosTheta1 = cos(theta1);

        float yc1 = lfProg * evalPchip(uEff) * H * A + sway;
        float w1 = 0.030 * H * smoothstep(0.0, 0.40, uEff) * wProg * breath;
        float spread1 = w1 * cosTheta1;

        // Strands summation
        float strandSum1 = 0.0;
        for (int k = 0; k < 28; k++) {
          float sk = STRANDS_R1[k].x;
          float ak = STRANDS_R1[k].y;
          float sig = max(1.4, STRANDS_R1[k].z);
          float yk = yc1 + sk * spread1;
          float diff = (y - yk) / sig;
          strandSum1 += ak * exp(-0.5 * diff * diff);
        }

        // Hero Body Haze across width (sigma = 0.5 * w * |cos theta|, alpha ~ 0.18)
        float sigmaHaze1 = max(1.5, 0.5 * w1 * abs(cosTheta1));
        float bodyHaze1 = 0.18 * exp(-0.5 * pow((y - yc1) / sigmaHaze1, 2.0));

        totalDensity += (strandSum1 * 0.036 * strandNorm + bodyHaze1) * aProg;
      }

      // ── Hero Ribbon 2 (R2: 20 strands, wMax = 0.022H) ──
      {
        float dj = 0.03;
        float aProg = S((t - 0.62 - 0.18 * u - dj) / 0.35) * settleFade;
        float wProg = S((t - 0.64 - 0.22 * u - dj) / 0.40);
        float twProg = S((t - 0.72 - 0.22 * u - dj) / 0.45);
        float lfProg = Slift((t - 0.80 - 0.20 * u - dj) / 0.45);

        float drift2 = (12.0 * 3.14159265 / 180.0) * sin(2.0 * 3.14159265 * 0.11 * t + 0.85);
        float theta2 = (3.14159265 * smoothstep(0.48, 0.96, uEff) + drift2) * twProg;
        float cosTheta2 = cos(theta2);

        float yc2 = lfProg * evalPchip(clamp(uEff + 0.03, 0.0, 1.0)) * H * 0.92 * A + sway * 0.95;
        float w2 = 0.022 * H * smoothstep(0.0, 0.40, uEff) * wProg * breath;
        float spread2 = w2 * cosTheta2;

        float strandSum2 = 0.0;
        for (int k = 0; k < 20; k++) {
          float sk = STRANDS_R2[k].x;
          float ak = STRANDS_R2[k].y;
          float sig = max(1.4, STRANDS_R2[k].z);
          float yk = yc2 + sk * spread2;
          float diff = (y - yk) / sig;
          strandSum2 += ak * exp(-0.5 * diff * diff);
        }

        float sigmaHaze2 = max(1.5, 0.5 * w2 * abs(cosTheta2));
        float bodyHaze2 = 0.12 * exp(-0.5 * pow((y - yc2) / sigmaHaze2, 2.0));

        totalDensity += (strandSum2 * 0.026 * strandNorm + bodyHaze2) * aProg;
      }

      // ── Sibling Ribbons S1, S2, S3 (12 strands each, amp x0.85, x0.75, x0.60, weave offsets -0.18, +0.12, +0.22) ──
      // Begin and end by smooth alpha falloff only (no geometry edge)
      float siblingWindow = smoothstep(0.04, 0.20, u) * smoothstep(0.86, 0.62, u);

      // S1 (amp 0.85, uOffset -0.18)
      {
        float dj = 0.04;
        float aProg = S((t - 0.62 - 0.18 * u - dj) / 0.35) * settleFade * siblingWindow;
        float wProg = S((t - 0.64 - 0.22 * u - dj) / 0.40);
        float twProg = S((t - 0.72 - 0.22 * u - dj) / 0.45);
        float lfProg = Slift((t - 0.80 - 0.20 * u - dj) / 0.45);

        float driftS1 = (12.0 * 3.14159265 / 180.0) * sin(2.0 * 3.14159265 * 0.11 * t + 1.6);
        float thetaS1 = (3.14159265 * smoothstep(0.44, 0.92, uEff) + driftS1) * twProg;
        float cosThetaS1 = cos(thetaS1);

        float ycS1 = lfProg * evalPchip(clamp(uEff - 0.18, 0.0, 1.0)) * H * 0.85 * A + sway * 0.85;
        float wS1 = 0.018 * H * smoothstep(0.0, 0.40, uEff) * wProg * breath;
        float spreadS1 = wS1 * cosThetaS1;

        float strandSumS1 = 0.0;
        for (int k = 0; k < 12; k++) {
          float sk = STRANDS_S1[k].x;
          float ak = STRANDS_S1[k].y;
          float sig = max(2.0, STRANDS_S1[k].z);
          float yk = ycS1 + sk * spreadS1;
          float diff = (y - yk) / sig;
          strandSumS1 += ak * exp(-0.5 * diff * diff);
        }
        totalDensity += strandSumS1 * 0.016 * strandNorm * aProg;
      }

      // S2 (amp 0.75, uOffset +0.12)
      {
        float dj = 0.05;
        float aProg = S((t - 0.62 - 0.18 * u - dj) / 0.35) * settleFade * siblingWindow;
        float wProg = S((t - 0.64 - 0.22 * u - dj) / 0.40);
        float twProg = S((t - 0.72 - 0.22 * u - dj) / 0.45);
        float lfProg = Slift((t - 0.80 - 0.20 * u - dj) / 0.45);

        float driftS2 = (12.0 * 3.14159265 / 180.0) * sin(2.0 * 3.14159265 * 0.11 * t + 2.4);
        float thetaS2 = (3.14159265 * smoothstep(0.44, 0.92, uEff) + driftS2) * twProg;
        float cosThetaS2 = cos(thetaS2);

        float ycS2 = lfProg * evalPchip(clamp(uEff + 0.12, 0.0, 1.0)) * H * 0.75 * A + sway * 0.75;
        float wS2 = 0.015 * H * smoothstep(0.0, 0.40, uEff) * wProg * breath;
        float spreadS2 = wS2 * cosThetaS2;

        float strandSumS2 = 0.0;
        for (int k = 0; k < 12; k++) {
          float sk = STRANDS_S2[k].x;
          float ak = STRANDS_S2[k].y;
          float sig = max(2.0, STRANDS_S2[k].z);
          float yk = ycS2 + sk * spreadS2;
          float diff = (y - yk) / sig;
          strandSumS2 += ak * exp(-0.5 * diff * diff);
        }
        totalDensity += strandSumS2 * 0.014 * strandNorm * aProg;
      }

      // S3 (amp 0.60, uOffset +0.22)
      {
        float dj = 0.06;
        float aProg = S((t - 0.62 - 0.18 * u - dj) / 0.35) * settleFade * siblingWindow;
        float wProg = S((t - 0.64 - 0.22 * u - dj) / 0.40);
        float twProg = S((t - 0.72 - 0.22 * u - dj) / 0.45);
        float lfProg = Slift((t - 0.80 - 0.20 * u - dj) / 0.45);

        float driftS3 = (12.0 * 3.14159265 / 180.0) * sin(2.0 * 3.14159265 * 0.11 * t + 3.1);
        float thetaS3 = (3.14159265 * smoothstep(0.44, 0.92, uEff) + driftS3) * twProg;
        float cosThetaS3 = cos(thetaS3);

        float ycS3 = lfProg * evalPchip(clamp(uEff + 0.22, 0.0, 1.0)) * H * 0.60 * A + sway * 0.60;
        float wS3 = 0.012 * H * smoothstep(0.0, 0.40, uEff) * wProg * breath;
        float spreadS3 = wS3 * cosThetaS3;

        float strandSumS3 = 0.0;
        for (int k = 0; k < 12; k++) {
          float sk = STRANDS_S3[k].x;
          float ak = STRANDS_S3[k].y;
          float sig = max(2.0, STRANDS_S3[k].z);
          float yk = ycS3 + sk * spreadS3;
          float diff = (y - yk) / sig;
          strandSumS3 += ak * exp(-0.5 * diff * diff);
        }
        totalDensity += strandSumS3 * 0.012 * strandNorm * aProg;
      }

      // Edge falloff on ribbons
      totalDensity *= edgeFade;

      // Smooth C1 blend across center so there is ZERO step or seam at x=0
      float blendSilkX = smoothstep(-0.05 * Wh, 0.05 * Wh, x);
      vec3 colBlue = getColorAlongU(u, -1.0);
      vec3 colAmber = getColorAlongU(u, 1.0);
      vec3 silkColor = mix(colBlue, colAmber, blendSilkX);
      silkOut = silkColor * totalDensity;

      // ── Veil Sheets (Two soft gaussian bands per side fanning up & down, alpha 0.03-0.04) ──
      float vProg = S((t - 0.95 - 0.20 * u) / 0.45) * settleFade * edgeFade;
      if (vProg > 0.001) {
        float yVUp = 0.24 * H * smoothstep(0.0, 0.80, uEff);
        float hwVUp = max(2.0, 0.09 * H * smoothstep(0.0, 0.80, uEff));
        float veilUp = 0.038 * exp(-0.5 * pow((y - yVUp) / hwVUp, 2.0));

        float yVDown = -0.17 * H * smoothstep(0.0, 0.80, uEff);
        float hwVDown = max(2.0, 0.06 * H * smoothstep(0.0, 0.80, uEff));
        float veilDown = 0.032 * exp(-0.5 * pow((y - yVDown) / hwVDown, 2.0));

        silkOut += silkColor * (veilUp + veilDown) * vProg;
      }
    }

    // Additive combination of silk + glow into Half-Float buffer
    vec3 totalCol = silkOut + glowOut;
    gl_FragColor = vec4(totalCol, 1.0);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// 3. PASS 2 & 3: BLOOM BLUR SHADERS (9-tap Gaussian Blur)
// ─────────────────────────────────────────────────────────────────────────────
const BlurVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BlurFragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uDirection; // (1.0/w, 0.0) or (0.0, 1.0/h)
  varying vec2 vUv;

  void main() {
    // 9-tap separable Gaussian blur with low-threshold extraction
    vec2 off = uDirection * 1.5;
    vec4 col = texture2D(tDiffuse, vUv) * 0.227027;
    col += texture2D(tDiffuse, vUv + off * 1.0) * 0.1945946;
    col += texture2D(tDiffuse, vUv - off * 1.0) * 0.1945946;
    col += texture2D(tDiffuse, vUv + off * 2.0) * 0.1216216;
    col += texture2D(tDiffuse, vUv - off * 2.0) * 0.1216216;
    col += texture2D(tDiffuse, vUv + off * 3.0) * 0.054054;
    col += texture2D(tDiffuse, vUv - off * 3.0) * 0.054054;
    col += texture2D(tDiffuse, vUv + off * 4.0) * 0.016216;
    col += texture2D(tDiffuse, vUv - off * 4.0) * 0.016216;

    gl_FragColor = col;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// 4. PASS 4: COMPOSITE & HUE-PRESERVING TONE MAPPING
// ─────────────────────────────────────────────────────────────────────────────
const CompositeFragmentShader = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float uBloomStrength; // 0.70
  uniform vec2 uResolution;
  varying vec2 vUv;

  void main() {
    float H = uResolution.y;
    float y = (vUv.y - 0.5) * H;

    // Strict +-0.32H band check: completely transparent outside band
    if (abs(y) > 0.32 * H) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec3 sceneCol = texture2D(tScene, vUv).rgb;
    vec3 bloomCol = texture2D(tBloom, vUv).rgb;
    vec3 col = sceneCol + bloomCol * uBloomStrength;

    float l = max(col.r, max(col.g, col.b));
    if (l <= 0.0005) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // THE RULE THAT PREVENTS THE LAST FAILURE:
    // Hue-preserving tone mapping: l = max(r,g,b); color *= T(l)/l with T(x) = 1 - exp(-1.2*x);
    // No per-channel clipping.
    float tl = 1.0 - exp(-1.2 * l);
    col *= (tl / l);

    // Strict chromatic bounds:
    // Blue side: Hue 205-225 (no cyan: B>=240 && G>=240 && R<=160)
    // Amber side: Hue 25-40 (no lemon: R>=240 && G>=240 && B<=140)
    float x = (vUv.x - 0.5) * uResolution.x;
    float distFromCenter = sqrt(x * x + y * y);
    if (distFromCenter > 0.03 * H) {
      if (x < 0.0) {
        // Blue side: prevent cyan by maintaining R >= 0.45 * G
        col.r = max(col.r, 0.45 * col.g);
      } else {
        // Amber side: prevent lemon by maintaining G <= 0.68 * R + 0.32 * B
        col.g = min(col.g, 0.68 * col.r + 0.32 * col.b);
      }
    }

    // Ensure bloom never leaks light to screen edges (x=0 and x=W-1)
    float uEdge = abs(x) / (uResolution.x * 0.5);
    float edgeMask = 1.0 - smoothstep(0.85, 0.98, uEdge);
    col *= edgeMask;

    // Additive canvas alpha for WebGL premultipliedAlpha compositing over CSS page
    float alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface ResonancePassPipeline {
  dispose: () => void;
  render: (t: number, width: number, height: number) => void;
  resize: (w: number, h: number, dpr: number) => void;
}

function setMatUniform(mat: THREE.ShaderMaterial, name: string, val: unknown) {
  const u = mat.uniforms[name];
  if (u) {
    u.value = val;
  }
}

export function createResonancePassPipeline(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
  dpr: number
): ResonancePassPipeline {
  const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeom = new THREE.PlaneGeometry(2, 2);

  let targetW = Math.round(width * dpr);
  let targetH = Math.round(height * dpr);
  let halfW = Math.max(1, Math.floor(targetW / 2));
  let halfH = Math.max(1, Math.floor(targetH / 2));

  const rtParams: THREE.RenderTargetOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    stencilBuffer: false,
    depthBuffer: false,
  };

  const rtScene = new THREE.WebGLRenderTarget(targetW, targetH, rtParams);
  const rtBloomH = new THREE.WebGLRenderTarget(halfW, halfH, rtParams);
  const rtBloomV = new THREE.WebGLRenderTarget(halfW, halfH, rtParams);

  // Materials
  const sceneMat = new THREE.ShaderMaterial({
    vertexShader: ResonanceSceneVertexShader,
    fragmentShader: ResonanceSceneFragmentShader,
    uniforms: {
      uTime: { value: 0.0 },
      uResolution: { value: new THREE.Vector2(targetW, targetH) },
    },
    depthTest: false,
    depthWrite: false,
  });

  const blurHMat = new THREE.ShaderMaterial({
    vertexShader: BlurVertexShader,
    fragmentShader: BlurFragmentShader,
    uniforms: {
      tDiffuse: { value: null },
      uDirection: { value: new THREE.Vector2(1.0 / halfW, 0.0) },
    },
    depthTest: false,
    depthWrite: false,
  });

  const blurVMat = new THREE.ShaderMaterial({
    vertexShader: BlurVertexShader,
    fragmentShader: BlurFragmentShader,
    uniforms: {
      tDiffuse: { value: null },
      uDirection: { value: new THREE.Vector2(0.0, 1.0 / halfH) },
    },
    depthTest: false,
    depthWrite: false,
  });

  const compositeMat = new THREE.ShaderMaterial({
    vertexShader: ResonanceSceneVertexShader,
    fragmentShader: CompositeFragmentShader,
    uniforms: {
      tScene: { value: null },
      tBloom: { value: null },
      uBloomStrength: { value: 0.7 },
      uResolution: { value: new THREE.Vector2(targetW, targetH) },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const quadMesh = new THREE.Mesh(quadGeom, sceneMat);
  const orthoScene = new THREE.Scene();
  orthoScene.add(quadMesh);

  const resize = (w: number, h: number, newDpr: number) => {
    targetW = Math.round(w * newDpr);
    targetH = Math.round(h * newDpr);
    halfW = Math.max(1, Math.floor(targetW / 2));
    halfH = Math.max(1, Math.floor(targetH / 2));

    rtScene.setSize(targetW, targetH);
    rtBloomH.setSize(halfW, halfH);
    rtBloomV.setSize(halfW, halfH);

    const uRes = sceneMat.uniforms.uResolution;
    if (uRes) {
      (uRes.value as THREE.Vector2).set(targetW, targetH);
    }
    const uCompRes = compositeMat.uniforms.uResolution;
    if (uCompRes) {
      (uCompRes.value as THREE.Vector2).set(targetW, targetH);
    }
    const uDirH = blurHMat.uniforms.uDirection;
    if (uDirH) {
      (uDirH.value as THREE.Vector2).set(1.0 / halfW, 0.0);
    }
    const uDirV = blurVMat.uniforms.uDirection;
    if (uDirV) {
      (uDirV.value as THREE.Vector2).set(0.0, 1.0 / halfH);
    }
  };

  const render = (t: number, _w: number, _h: number) => {
    // 1. Render Scene to rtScene
    setMatUniform(sceneMat, "uTime", t);
    const uRes = sceneMat.uniforms.uResolution;
    if (uRes) {
      (uRes.value as THREE.Vector2).set(targetW, targetH);
    }
    quadMesh.material = sceneMat;

    renderer.setRenderTarget(rtScene);
    renderer.setClearColor(0x00_00_00, 0);
    renderer.clear(true, true, false);
    renderer.render(orthoScene, orthoCamera);

    // 2. Downsample & Horizontal Blur to rtBloomH
    quadMesh.material = blurHMat;
    setMatUniform(blurHMat, "tDiffuse", rtScene.texture);
    renderer.setRenderTarget(rtBloomH);
    renderer.setClearColor(0x00_00_00, 0);
    renderer.clear(true, true, false);
    renderer.render(orthoScene, orthoCamera);

    // 3. Vertical Blur to rtBloomV
    quadMesh.material = blurVMat;
    setMatUniform(blurVMat, "tDiffuse", rtBloomH.texture);
    renderer.setRenderTarget(rtBloomV);
    renderer.setClearColor(0x00_00_00, 0);
    renderer.clear(true, true, false);
    renderer.render(orthoScene, orthoCamera);

    // 4. Tone-mapped Composite to Canvas (Screen)
    quadMesh.material = compositeMat;
    setMatUniform(compositeMat, "tScene", rtScene.texture);
    setMatUniform(compositeMat, "tBloom", rtBloomV.texture);
    const uCompRes = compositeMat.uniforms.uResolution;
    if (uCompRes) {
      (uCompRes.value as THREE.Vector2).set(targetW, targetH);
    }

    renderer.setRenderTarget(null);
    renderer.setClearColor(0x00_00_00, 0);
    renderer.clear(true, true, false);
    renderer.render(orthoScene, orthoCamera);
  };

  const dispose = () => {
    rtScene.dispose();
    rtBloomH.dispose();
    rtBloomV.dispose();
    quadGeom.dispose();
    sceneMat.dispose();
    blurHMat.dispose();
    blurVMat.dispose();
    compositeMat.dispose();
  };

  return { render, resize, dispose };
}
