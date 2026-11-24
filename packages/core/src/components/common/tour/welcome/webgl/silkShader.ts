/**
 * silkShader.ts — Custom Additive Silk Surface Shader for Marshell (Revision 9).
 *
 * Implements:
 * - Real 3D volumetric ribbon mesh (512x32 grid) supporting:
 *     Mode 0: Frame 2 RESONANCE Silk Scarves (0.62s -> 1.95s)
 *     Mode 1: Frame 4 ALIGN Silk Horns (3 nested bells per side, 2.50s -> 4.00s)
 *     Mode 2: Frame 5 WELCOME Silk Wings (crescent wings, 4.00s -> 6.10s)
 *     Smooth Morph (4.00s -> 5.20s): Horns smoothly morph into Wings
 * - Exact PCHIP Half-Height evaluation for 3 nested horns:
 *     Horn 3 (outer): (0.50, 0.50) (0.75, 0.66) (1.0, 0.80) (1.6, 1.08) (2.26, 1.42)*La -> 0.47*H
 *     Horn 2:         (0.50, 0.38) (0.75, 0.52) (1.0, 0.64) (1.6, 0.90) (2.26, 1.15)*La -> 0.37*H
 *     Horn 1 (inner): (0.50, 0.24) (0.75, 0.34) (1.0, 0.44) (1.6, 0.66) (2.26, 0.92)*La -> 0.28*H
 * - 16 pleat streaks per horn concentrated toward top and bottom edges with fwidth AA
 * - 1.25px leading-edge lit rims with soft glow stroke (0.70, 0.55, 0.45)
 * - Chromatic gradient along u: root #BFD8FF [#FFE3B8] -> #3B82F6 [#F59E0B] -> #1E3A8A [#7C3E0A]
 * - Soft-shoulder tone mapping strictly preventing cyan and lemon
 * - Amber side perceptual brightness balance (~92% of blue)
 * - Dissolves smoothly at screen edge (no hard vertical cut)
 */

import * as THREE from "three";

export const SilkVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSide; // -1.0 = left, +1.0 = right
  uniform float uPhase;
  uniform float uAmp;
  uniform float uSway;
  uniform float uWh;
  uniform float uHeight;
  uniform float uWavefrontRadius;
  uniform float uWavefrontFeather;
  uniform float uZOffset;
  uniform float uMode; // 0.0 = ribbon, 1.0 = horn, 2.0 = wing
  uniform float uMorph; // 0.0 (horn) -> 1.0 (wing)
  uniform vec2 uLogoCenter; // in CSS px relative to content center
  uniform float uL;
  uniform float uLa;

  // Mode 0: Spline uniforms
  uniform vec2 uSplineCenterline[11]; // (u, yH) control points
  uniform vec2 uSplineWidth[7];       // (u, wH) control points
  uniform float uTwistCrestU;          // ~0.44
  uniform float uTwistPinchU;          // ~0.68
  uniform float uTwistDrift;           // radians

  // Horn uniforms: 6 PCHIP control points (xPx, hhPx)
  uniform vec2 uHornPoints[6];
  uniform float uRearBellZWh;
  uniform float uWingCutoffL;

  // Spline control points for wings (7 points, in units of L, y positive DOWN)
  uniform vec3 uWingCenterlinePchip[7]; // (x, y, d)
  uniform vec3 uWingThicknessPchip[7];  // (x, hh, d)
  uniform float uMorphShading;
  uniform float uSheetIndex;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vWavefrontAlpha;
  varying float vLengthAlpha;
  varying float vWingAlpha;
  varying float vLowerCutoffAlpha;
  varying float vTwistAngle;
  varying float vPchipHh;
  varying float vXL;
  varying float vDistBelowBandLower;

  // Exact PCHIP Hermite evaluation on GPU for wing curves
  float evalPchip7(float xVal, vec3 pts[7]) {
    if (xVal <= pts[0].x) return pts[0].y;
    if (xVal >= pts[6].x) return pts[6].y;
    for (int i = 0; i < 6; i++) {
      if (xVal >= pts[i].x && xVal <= pts[i + 1].x) {
        float h = pts[i + 1].x - pts[i].x;
        float t = (xVal - pts[i].x) / max(0.0001, h);
        float t2 = t * t;
        float t3 = t2 * t;
        float h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
        float h01 = -2.0 * t3 + 3.0 * t2;
        float h10 = t3 - 2.0 * t2 + t;
        float h11 = t3 - t2;
        return h00 * pts[i].y + h01 * pts[i + 1].y + h10 * h * pts[i].z + h11 * h * pts[i + 1].z;
      }
    }
    return pts[0].y;
  }

  // PCHIP evaluation for horn half-height (6 points: 5 in La, 1 at Wh)
  float evalHornPchip(float xVal, vec2 pts[6]) {
    if (xVal <= pts[0].x) {
      // Extrapolate with initial slope
      float d0 = (pts[1].y - pts[0].y) / max(0.001, pts[1].x - pts[0].x);
      return max(2.0, pts[0].y + d0 * (xVal - pts[0].x));
    }
    if (xVal >= pts[5].x) {
      // Extrapolate past Wh with edge slope
      float d5 = (pts[5].y - pts[4].y) / max(0.001, pts[5].x - pts[4].x);
      return pts[5].y + d5 * (xVal - pts[5].x);
    }
    for (int i = 0; i < 5; i++) {
      if (xVal >= pts[i].x && xVal <= pts[i + 1].x) {
        float h = pts[i + 1].x - pts[i].x;
        float t = (xVal - pts[i].x) / max(0.0001, h);
        float t2 = t * t;
        float t3 = t2 * t;
        float h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
        float h01 = -2.0 * t3 + 3.0 * t2;
        float d0 = i > 0 ? (pts[i + 1].y - pts[i - 1].y) / max(0.001, pts[i + 1].x - pts[i - 1].x) * h : (pts[1].y - pts[0].y);
        float d1 = i < 4 ? (pts[i + 2].y - pts[i].y) / max(0.001, pts[i + 2].x - pts[i].x) * h : (pts[5].y - pts[4].y);
        float h10 = t3 - 2.0 * t2 + t;
        float h11 = t3 - t2;
        return h00 * pts[i].y + h01 * pts[i + 1].y + h10 * d0 + h11 * d1;
      }
    }
    return pts[0].y;
  }

  // Spline 11-point evaluation for Mode 0 centerline
  float evalSpline11(float uVal, vec2 pts[11]) {
    if (uVal <= pts[0].x) return pts[0].y;
    if (uVal >= pts[10].x) return pts[10].y;
    for (int i = 0; i < 10; i++) {
      if (uVal >= pts[i].x && uVal <= pts[i + 1].x) {
        float h = pts[i + 1].x - pts[i].x;
        float t = (uVal - pts[i].x) / max(0.0001, h);
        float t2 = t * t;
        float t3 = t2 * t;
        float h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
        float h01 = -2.0 * t3 + 3.0 * t2;
        float d0 = i > 0 ? (pts[i + 1].y - pts[i - 1].y) / max(0.001, pts[i + 1].x - pts[i - 1].x) * h : (pts[1].y - pts[0].y);
        float d1 = i < 9 ? (pts[i + 2].y - pts[i].y) / max(0.001, pts[i + 2].x - pts[i].x) * h : (pts[10].y - pts[9].y);
        float h10 = t3 - 2.0 * t2 + t;
        float h11 = t3 - t2;
        return h00 * pts[i].y + h01 * pts[i + 1].y + h10 * d0 + h11 * d1;
      }
    }
    return 0.0;
  }

  // Spline 7-point evaluation for Mode 0 half-width
  float evalSpline7(float uVal, vec2 pts[7]) {
    if (uVal <= pts[0].x) return pts[0].y;
    if (uVal >= pts[6].x) return pts[6].y;
    for (int i = 0; i < 6; i++) {
      if (uVal >= pts[i].x && uVal <= pts[i + 1].x) {
        float h = pts[i + 1].x - pts[i].x;
        float t = (uVal - pts[i].x) / max(0.0001, h);
        float t2 = t * t;
        float t3 = t2 * t;
        float h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
        float h01 = -2.0 * t3 + 3.0 * t2;
        float d0 = i > 0 ? (pts[i + 1].y - pts[i - 1].y) / max(0.001, pts[i + 1].x - pts[i - 1].x) * h : (pts[1].y - pts[0].y);
        float d1 = i < 5 ? (pts[i + 2].y - pts[i].y) / max(0.001, pts[i + 2].x - pts[i].x) * h : (pts[6].y - pts[5].y);
        float h10 = t3 - 2.0 * t2 + t;
        float h11 = t3 - t2;
        return h00 * pts[i].y + h01 * pts[i + 1].y + h10 * d0 + h11 * d1;
      }
    }
    return 0.0;
  }

  void main() {
    vUv = uv;
    float u = uv.x;
    float v = (uv.y - 0.5) * 2.0; // [-1.0, 1.0]

    vec3 pos = vec3(0.0);
    vec3 norm = vec3(0.0, 0.0, 1.0);
    vLowerCutoffAlpha = 1.0;
    vTwistAngle = 0.0;
    vPchipHh = 100.0;

    if (uMode < 0.5) {
      // ══════════════════════════════════════════════════════════════════════
      // MODE 0: FRAME 2 RESONANCE SILK SCARVES (0.62s -> 1.95s)
      // ══════════════════════════════════════════════════════════════════════
      float dist = u * uWh;
      float x = uSide * dist;

      float ycH = evalSpline11(u, uSplineCenterline);
      float yc = -(ycH * uHeight * uAmp + uSway);

      float wH = evalSpline7(u, uSplineWidth);
      float w = max(1.5, wH * uHeight * uAmp);

      float uPinch = uTwistPinchU + 0.03 * sin(uTime * 1.15 + uPhase);
      float twist = 0.0;
      if (u <= uTwistCrestU) {
        float p = u / max(0.001, uTwistCrestU);
        twist = 0.15 * sin(p * 3.14159) * sin(uTime * 0.8 + uPhase);
      } else {
        float pTwist = (u - uTwistCrestU) / max(0.001, uPinch - uTwistCrestU);
        twist = pTwist * 1.5707963 + uTwistDrift;
      }
      vTwistAngle = twist;

      float deltaY = v * w * cos(twist);
      float deltaZ = v * w * sin(twist);

      pos.x = x;
      pos.y = yc + deltaY;
      pos.z = uZOffset + deltaZ;

      vec3 tanV = vec3(0.0, cos(twist), sin(twist));
      vec3 tanU = vec3(uSide * uWh, -yc, 0.0);
      norm = normalize(cross(tanU, tanV));

      float wfDist = abs(x);
      vWavefrontAlpha = smoothstep(uWavefrontRadius, max(0.001, uWavefrontRadius - uWavefrontFeather), wfDist);
      vLengthAlpha = smoothstep(0.88, 0.68, u);
    } else {
      // ══════════════════════════════════════════════════════════════════════
      // MODE 1 & 2: SILK HORNS (ALIGN) & SILK WINGS (WELCOME)
      // ══════════════════════════════════════════════════════════════════════
      // Extend silk to 1.25 Wh so it runs past screen edge without geometry end
      float xInPx = 0.50 * uLa;
      float xOutPx = 1.25 * uWh;
      float xAbsPx = xInPx + u * (xOutPx - xInPx);
      float xHorn = uSide * xAbsPx;

      // Evaluate exact PCHIP profile for horn half-height
      float hhHorn = evalHornPchip(xAbsPx, uHornPoints);
      vPchipHh = hhHorn;

      // Lateral drape wave (+-0.04 La, 1.2 cycles, different phase per bell)
      // Makes sheets cross and overlap like a fanned hand
      float drapeWave = 0.04 * uLa * sin(1.2 * 6.2831853 * u + uPhase) * (1.0 - exp(-3.0 * u));

      // Slow S-ripple of +-0.015 La
      float sRipple = 0.015 * uLa * sin(6.2831853 * (u - 0.20 * uTime)) * u;
      // Alive breathing +-3%
      float breathe = 1.0 + 0.03 * sin(uTime * 1.6);
      float yHornCss = v * hhHorn * breathe + sRipple + drapeWave;

      // Push outer horn back in Z (up to -0.20 Wh at tip)
      float zHorn = uZOffset + uRearBellZWh * uWh * u * u;
      vec3 posHorn = vec3(xHorn, yHornCss, zHorn);

      // Frame 5 Wing Pose
      float xStart = 0.55;
      float xEnd = 4.60;
      float xL = xStart + u * (xEnd - xStart);
      vXL = xL;
      float xWing = uSide * xL * uL;

      // Base centerline and thickness from exact PCHIP
      float cyBase = evalPchip7(xL, uWingCenterlinePchip);
      float hhBase = evalPchip7(xL, uWingThicknessPchip);

      // Tip taper over first 0.6 L (from 0.55 to 1.15)
      float tipTaper = smoothstep(0.55, 1.15, xL);
      hhBase *= tipTaper;

      // Sheet variations:
      // Index 0: Main Band (raised 0.0, thickness x1.0)
      // Index 1: Sheet 2 (raised 0.10 L, thickness x1.7)
      // Index 2: Sheet 3 (raised 0.22 L, thickness x2.4)
      float yRaised = 0.0;
      float thickMult = 1.0;
      if (uSheetIndex > 1.5) {
        yRaised = 0.22;
        thickMult = 2.4;
      } else if (uSheetIndex > 0.5) {
        yRaised = 0.10;
        thickMult = 1.7;
      }

      float cyWingL = cyBase - yRaised;
      float hhWingL = hhBase * thickMult;

      // Idle wave: ONE slow sine over the whole wing (amp <= 0.012 L, freq <= 0.15 Hz = 0.94 rad/s)
      float idleSine = 0.010 * sin(uTime * 0.90 + (uSide > 0.0 ? 0.15 : 0.0)) * smoothstep(0.55, 2.5, xL);
      cyWingL += idleSine;

      float yWingCss = -(cyWingL + v * hhWingL) * uL;
      vec3 posWing = vec3(uLogoCenter.x + xWing, yWingCss - uLogoCenter.y, uZOffset);

      float distOut = abs(xHorn);
      float hornFade = 1.0 - smoothstep(0.80 * uWh, 1.00 * uWh, distOut);
      float wingFade = smoothstep(4.6, 3.0, xL) * tipTaper;

      pos = mix(posHorn, posWing, clamp(uMorph, 0.0, 1.0));
      vLengthAlpha = hornFade;
      vWingAlpha = wingFade;

      float cssYRelLogo = -posWing.y - uLogoCenter.y;
      vLowerCutoffAlpha = smoothstep(uWingCutoffL * uL, (uWingCutoffL - 0.03) * uL, cssYRelLogo);

      norm = vec3(0.0, 0.0, 1.0);
      vWavefrontAlpha = 1.0;

      // Distance below main band's lower edge (for sheets 2 & 3):
      float bandLowerY = cyBase + hhBase;
      float currentY = cyWingL + v * hhWingL;
      vDistBelowBandLower = bandLowerY - currentY;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPosition.xyz;
    vNormal = normalize(normalMatrix * norm);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const SilkFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSide;
  uniform float uPhase;
  uniform float uAlphaBase;
  uniform float uWh;
  uniform float uLa;
  uniform vec3 uColor0; // near-white root
  uniform vec3 uColor1; // light core
  uniform vec3 uColor2; // mid blue/amber
  uniform vec3 uColor3; // deep blue/amber
  uniform float uDimmer; // amber perceptual brightness balance (~0.92)
  uniform float uMode;
  uniform float uIsVeil;
  uniform float uIsHero;
  uniform float uRimAlphaTarget; // 0.70 for Horn 1, 0.55 for Horn 2, 0.45 for Horn 3
  uniform float uMorphShading;
  uniform float uSheetIndex;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vWavefrontAlpha;
  varying float vLengthAlpha;
  varying float vWingAlpha;
  varying float vLowerCutoffAlpha;
  varying float vTwistAngle;
  varying float vPchipHh;
  varying float vXL;
  varying float vDistBelowBandLower;

  void main() {
    float u = vUv.x;
    float v = (vUv.y - 0.5) * 2.0; // [-1.0, 1.0]

    // 1. Color gradient along length u:
    // Root: blue-white #BFD8FF [amber-white #FFE3B8]
    // Mid: #3B82F6 [#F59E0B]
    // Far: #1E3A8A [#7C3E0A]
    vec3 col = uColor0;
    if (u < 0.35) {
      col = mix(uColor0, uColor1, smoothstep(0.0, 0.35, u));
    } else if (u < 0.70) {
      col = mix(uColor1, uColor2, smoothstep(0.35, 0.70, u));
    } else {
      col = mix(uColor2, uColor3, smoothstep(0.70, 1.0, u));
    }

    // Strict chromatic bounds: eradicate cyan and lemon
    if (uSide < 0.0) {
      // Blue side: ensure R >= 0.45 * G to prevent cyan
      col.r = max(col.r, 0.45 * col.g);
    } else {
      // Amber side: ensure G <= 0.68 * R + 0.32 * B to prevent lemon
      col.g = min(col.g, 0.68 * col.r + 0.32 * col.b);
    }

    if (uMode < 0.5) {
      // ══════════════════════════════════════════════════════════════════════
      // MODE 0: RESONANCE SILK
      // ══════════════════════════════════════════════════════════════════════
      float cosTheta = max(abs(cos(vTwistAngle)), 0.25);
      float edgeOnBoost = uIsVeil > 0.5 ? 1.0 : (1.0 / cosTheta);

      float f = 26.0;
      float twistPhase = vTwistAngle * 0.5 - 0.15 * uTime + uPhase;
      float s1 = sin(v * f + twistPhase * 6.28);
      float s2 = sin(v * (f * 1.07) - twistPhase * 4.0);
      float mesh = 0.5 * (s1 * s1 + s2 * s2);
      float strandFactor = uIsVeil > 0.5 ? 1.0 : (0.35 + 0.65 * mesh);

      float dv = max(fwidth(v), 0.001);
      float litEdge = smoothstep(0.80, 1.0 - dv * 1.5, v);
      float shadowEdge = smoothstep(0.80, 1.0 - dv * 1.5, -v);
      float sinTwist = abs(sin(vTwistAngle));
      float rimWeight = mix(0.30, 0.80, smoothstep(0.1, 0.7, sinTwist));
      float rimAlpha = (uIsHero > 0.5 && uIsVeil < 0.5) ? uDimmer * rimWeight * (0.45 * litEdge + 0.25 * shadowEdge) : 0.0;

      float coreHighlight = (uIsHero > 0.5 && uIsVeil < 0.5) ? (1.0 + 2.0 * exp(-5.0 * v * v)) : 1.0;
      float bodyAlpha = uAlphaBase * uDimmer * edgeOnBoost * coreHighlight * strandFactor;
      float totalAlpha = (bodyAlpha + rimAlpha * (1.0 - bodyAlpha)) * vWavefrontAlpha * vLengthAlpha;

      if (totalAlpha <= 0.001) {
        discard;
      }

      vec3 finalCol = col * totalAlpha;
      if (finalCol.b > 0.4 && finalCol.g > 0.4) {
        finalCol.r = max(finalCol.r, 0.38 * min(finalCol.b, finalCol.g));
      }
      if (finalCol.r > 0.4 && finalCol.g > 0.25) {
        finalCol.g = min(finalCol.g, 0.72 * finalCol.r + 0.28 * finalCol.b);
      }

      gl_FragColor = vec4(finalCol, totalAlpha);
    } else {
      // ══════════════════════════════════════════════════════════════════════
      // MODE 1 & 2: SILK HORNS (ALIGN) & WINGS (WELCOME)
      // ══════════════════════════════════════════════════════════════════════
      // Section 6.1: Translucent silk sheets, not rays
      // Treat each bell as upper sheet (v > 0) and lower sheet (v < 0) joined at axis
      float vHalf = abs(v); // [0.0, 1.0] from axis to leading edge

      // 1. Body Fill:
      // fillAlpha(v) = peak * (0.35 + 0.65 * smoothstep(0.10, 0.90, vHalf))
      // Brightest next to leading edge and dimmer toward axis
      // Peak values calibrated to satisfy Visibility Floor (>= 24 levels above background at x=1.6 La)
      float peakFill = mix(0.48, 0.22, pow(u, 0.70));
      float fillV = 0.40 + 0.60 * smoothstep(0.08, 0.92, vHalf);
      float bodyFillA = peakFill * fillV * uDimmer;

      // 2. Broad Folds:
      // 6 to 9 per bell, each about 6 to 14px wide at 1080p, soft-edged, curved along profile
      // Modulates body by +-18%, drifts slowly at 0.03 cycles/sec
      float foldCoord = vHalf * 6.5 + 1.2 * u + sin(2.5 * u + uPhase) * 0.35;
      float foldDrift = 0.03 * 6.2831853 * uTime;
      float broadFold = sin(foldCoord * 3.14159265 - foldDrift);
      float foldModulation = 1.0 + 0.18 * broadFold;

      // 3. Fine Pleats:
      // Subtle micro-sheen within sheet, bunched toward leading edges (|v|^0.75).
      // Cut to subtle shimmer so cross-section line features remain <= 8
      float vPleat = pow(vHalf, 0.75);
      float pleatPhase = 6.0 * 3.14159265 * vPleat + 6.28318 * (0.5 * u - 0.15 * uTime + uPhase);
      float pleatCos = cos(pleatPhase);
      float pleatRaw = smoothstep(0.40, 0.90, pleatCos);
      float gapPleatMask = smoothstep(0.06, 0.16, u); // suppresses fine pleats in gap pool
      float pleatStreak = pleatRaw * 0.04 * gapPleatMask * bodyFillA;

      // 4. Leading Edges & Depth-of-Field:
      // 1.25px core + 4 to 6px soft glow. Alpha 0.70, 0.55, 0.45 (bells 1 to 3)
      // Beyond 0.7 Wh, edge widens by 3x (soft DoF)
      float dv = max(fwidth(v), 0.0004);
      float distToEdgePx = (1.0 - vHalf) / dv;

      // Depth of field softening beyond 0.70 Wh
      float xAbs = 0.50 * uLa + u * (1.25 * uWh - 0.50 * uLa);
      float dofFactor = 1.0 + 2.0 * smoothstep(0.70 * uWh, 1.00 * uWh, xAbs);
      float coreWidth = 1.25 * dofFactor;
      float glowWidth = 5.0 * dofFactor;

      float rim1px = smoothstep(coreWidth, 0.0, distToEdgePx);
      float rimGlow = smoothstep(glowWidth, 0.0, distToEdgePx) * 0.40;
      float rimAlpha = (rim1px * 1.0 + rimGlow * 0.6) * uRimAlphaTarget * uDimmer;

      // Leading edge color: near white at root (#D6E6FF blue, #F4F6FA near-white), easing to litRim by 1.6 La
      vec3 rootRimCol = uSide < 0.0
        ? vec3(214.0 / 255.0, 230.0 / 255.0, 255.0 / 255.0)
        : vec3(244.0 / 255.0, 246.0 / 255.0, 250.0 / 255.0);
      vec3 midRimCol = uSide < 0.0
        ? vec3(141.0 / 255.0, 187.0 / 255.0, 255.0 / 255.0)
        : vec3(238.0 / 255.0, 241.0 / 255.0, 247.0 / 255.0);
      vec3 rimCol = mix(rootRimCol, midRimCol, smoothstep(0.0, 0.35, u));
      rimCol = mix(rimCol, vec3(1.0), 0.65 + 0.35 * rim1px);

      // Sheet body alpha: translucent luminous sheet
      float sheetAlpha = (bodyFillA * foldModulation + pleatStreak) * uAlphaBase;
      float totalAlpha = (sheetAlpha + rimAlpha * (1.0 - sheetAlpha * 0.5)) * vLengthAlpha;

      // Mode 1 luminous silk color wash
      vec3 mode1SilkCol = uSide < 0.0
        ? mix(vec3(0.35, 0.62, 1.0), vec3(0.18, 0.38, 0.85), smoothstep(0.2, 0.8, u))
        : mix(vec3(221.0 / 255.0, 227.0 / 255.0, 238.0 / 255.0), vec3(92.0 / 255.0, 100.0 / 255.0, 117.0 / 255.0), smoothstep(0.2, 0.8, u));

      // Compose final color
      vec3 finalCol = mix(mode1SilkCol, rimCol, clamp(rimAlpha / max(0.001, totalAlpha), 0.0, 1.0));

      // Soft-shoulder tone map preventing cyan/lemon
      if (finalCol.b > 0.42 && finalCol.g > 0.42) {
        finalCol.r = max(finalCol.r, 0.45 * min(finalCol.b, finalCol.g));
      }
      if (finalCol.r > 0.42 && finalCol.g > 0.30) {
        finalCol.g = min(finalCol.g, 0.68 * finalCol.r + 0.32 * finalCol.b);
      }

      vec4 hornOutput = vec4(finalCol, totalAlpha);

      // If uMorphShading <= 0.0001, strictly return hornOutput (Frames 3 & 4 unchanged!)
      if (uMorphShading <= 0.0001) {
        if (totalAlpha <= 0.001) {
          discard;
        }
        gl_FragColor = hornOutput;
        return;
      }

      // ── WING RENDERING (Mode 2) ──
      // Colors along length xL:
      // Root near-white -> Light mid -> Deep edge
      vec3 rootCol = uSide < 0.0 ? vec3(0.92, 0.95, 1.0) : vec3(244.0 / 255.0, 246.0 / 255.0, 250.0 / 255.0);
      vec3 lightCol = uSide < 0.0 ? vec3(0.61, 0.78, 1.0) : vec3(238.0 / 255.0, 241.0 / 255.0, 247.0 / 255.0);
      vec3 midCol = uSide < 0.0 ? vec3(59.0 / 255.0, 130.0 / 255.0, 246.0 / 255.0) : vec3(221.0 / 255.0, 227.0 / 255.0, 238.0 / 255.0);
      vec3 deepCol = uSide < 0.0 ? vec3(30.0 / 255.0, 58.0 / 255.0, 138.0 / 255.0) : vec3(92.0 / 255.0, 100.0 / 255.0, 117.0 / 255.0);

      vec3 bodyCol = rootCol;
      if (vXL < 1.5) {
        bodyCol = mix(rootCol, lightCol, smoothstep(0.55, 1.5, vXL));
      } else if (vXL < 2.5) {
        bodyCol = mix(lightCol, midCol, smoothstep(1.5, 2.5, vXL));
      } else {
        bodyCol = mix(midCol, deepCol, smoothstep(2.5, 4.6, vXL));
      }

      vec4 wingOutput = vec4(0.0);

      if (uSheetIndex < 0.5) {
        // Main Wing Band (Index 0)
        // Body alpha across thickness: 0.05 + 0.14*smoothstep(0.1, 1.0, v)
        float bodyAlpha = (0.05 + 0.14 * smoothstep(0.1, 1.0, v)) * vWingAlpha;

        // 12 irregular strands across v in [-1, 1], gaps vary by >= 25%
        float strands[12] = float[12](-0.70, -0.48, -0.28, -0.10, 0.06, 0.20, 0.33, 0.45, 0.58, 0.70, 0.82, 0.93);
        float strandDrift = 0.035 * sin(1.2 * vXL - 0.25 * uTime + uPhase);
        float strandSum = 0.0;
        for (int k = 0; k < 12; k++) {
          float vk = strands[k] + strandDrift;
          float distPx = abs(v - vk) / dv;
          strandSum += exp(-0.5 * (distPx / 0.75) * (distPx / 0.75));
        }
        float aaFade = smoothstep(1.5, 2.5, 0.11 / dv);
        float strandAlpha = min(0.12, strandSum * 0.08 * aaFade) * vWingAlpha;

        // Lower rim: 1.4px core + 6px soft glow at alpha about 0.65
        float distLowerPx = max(0.0, (1.0 - v) / dv);
        float rimLowerCore = smoothstep(1.4, 0.0, distLowerPx);
        float rimLowerGlow = smoothstep(6.0, 0.0, distLowerPx) * 0.50;
        float rimLowerAlpha = (rimLowerCore + rimLowerGlow) * 0.65 * vWingAlpha;

        // Upper edge: alpha 0.25
        float distUpperPx = max(0.0, (v - (-1.0)) / dv);
        float rimUpperAlpha = smoothstep(1.4, 0.0, distUpperPx) * 0.25 * vWingAlpha;

        // Lower rim color: #9CC7FF blue / #EEF1F7 near-white, near-white over first 0.8 L
        vec3 baseRimCol = uSide < 0.0 ? vec3(156.0 / 255.0, 199.0 / 255.0, 1.0) : vec3(238.0 / 255.0, 241.0 / 255.0, 247.0 / 255.0);
        float nearWhite = 1.0 - smoothstep(0.55, 1.35, vXL);
        vec3 rimColW = mix(baseRimCol, vec3(0.98, 0.98, 1.0), nearWhite * 0.85);

        // Additive raw RGB: calibrated so lower rim core is ~1.15 (maps to 75% white)
        // and body is <= 0.35 (maps to <= 35% white, strictly < 45%)
        vec3 rawWingRgb = bodyCol * bodyAlpha + bodyCol * (strandAlpha * 0.75) + rimColW * (rimLowerAlpha * 1.15 + rimUpperAlpha * 0.8);
        float totalAlphaW = (bodyAlpha + strandAlpha + rimLowerAlpha + rimUpperAlpha) * vLowerCutoffAlpha;

        wingOutput = vec4(rawWingRgb * vLowerCutoffAlpha, totalAlphaW);
      } else {
        // Broader Sheets (Index 1: Sheet 2 [alpha 0.06], Index 2: Sheet 3 [alpha 0.035])
        float targetAlpha = (uSheetIndex > 1.5) ? 0.035 : 0.06;
        float distToEdgeV = min(1.0 - v, v - (-1.0));
        float distToEdgePx = distToEdgeV / dv;
        float edgeFade = smoothstep(0.0, 8.0, distToEdgePx);
        float sheetAlpha = targetAlpha * edgeFade * vWingAlpha * vLowerCutoffAlpha;

        float belowCutoff = smoothstep(-0.01, 0.02, vDistBelowBandLower);
        sheetAlpha *= belowCutoff;

        vec3 rawSheetRgb = bodyCol * sheetAlpha;
        wingOutput = vec4(rawSheetRgb, sheetAlpha);
      }

      // Amber balance: 92% of blue
      float wingDimmer = uSide > 0.0 ? 0.92 : 1.0;
      wingOutput.rgb *= wingDimmer;

      // Hue-preserving tone mapping on RGB (hue is preserved, intensities rolled off)
      float maxC = max(wingOutput.r, max(wingOutput.g, wingOutput.b));
      if (maxC > 0.0001) {
        float mappedL = (1.0 - exp(-1.2 * maxC));
        wingOutput.rgb *= (mappedL / maxC);
      }

      // Chromatic guards:
      // Blue stays blue (hue 205 to 225, no cyan B>=240, G>=240, R<=160)
      // Amber stays orange (hue 25 to 40, no lemon R>=240, G>=240, B<=140)
      if (uSide < 0.0) {
        wingOutput.r = max(wingOutput.r, 0.45 * wingOutput.g);
      } else {
        wingOutput.g = min(wingOutput.g, 0.68 * wingOutput.r + 0.32 * wingOutput.b);
        wingOutput.b = min(wingOutput.b, 0.40 * wingOutput.r);
      }

      vec4 blended = mix(hornOutput, wingOutput, uMorphShading);
      if (blended.a <= 0.001) {
        discard;
      }
      gl_FragColor = blended;
    }
  }
`;

export function createSilkMaterial(
  side: "left" | "right",
  isVeil = false,
  isHero = false,
  hornIndex = 0
) {
  const isRight = side === "right";
  // Color palette:
  // Left: #BFD8FF -> #9CC7FF -> #3B82F6 -> #1E3A8A
  // Right: #F4F6FA -> #EEF1F7 -> #DDE3EE -> #5C6475
  const colors = isRight
    ? {
        c0: new THREE.Color("#F4F6FA"),
        c1: new THREE.Color("#EEF1F7"),
        c2: new THREE.Color("#DDE3EE"),
        c3: new THREE.Color("#5C6475"),
      }
    : {
        c0: new THREE.Color("#BFD8FF"),
        c1: new THREE.Color("#9CC7FF"),
        c2: new THREE.Color("#3B82F6"),
        c3: new THREE.Color("#1E3A8A"),
      };

  const defaultCenterline: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.1, -0.0028),
    new THREE.Vector2(0.2, -0.0223),
    new THREE.Vector2(0.3, -0.048),
    new THREE.Vector2(0.44, -0.068),
    new THREE.Vector2(0.55, -0.036),
    new THREE.Vector2(0.68, 0.0307),
    new THREE.Vector2(0.8, 0.0782),
    new THREE.Vector2(0.9, 0.1006),
    new THREE.Vector2(1.0, 0.1061),
    new THREE.Vector2(1.15, 0.108),
  ];

  const defaultWidth: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.1, 0.004),
    new THREE.Vector2(0.25, 0.016),
    new THREE.Vector2(0.44, 0.028),
    new THREE.Vector2(0.68, 0.01),
    new THREE.Vector2(0.9, 0.022),
    new THREE.Vector2(1.15, 0.018),
  ];

  // Horn leading rim target alphas: alpha 0.70, 0.55, and 0.45 (bells 1 to 3)
  const rimTargets = [0.7, 0.55, 0.45];
  const rimAlphaTarget = rimTargets[hornIndex] ?? 0.5;

  return new THREE.ShaderMaterial({
    vertexShader: SilkVertexShader,
    fragmentShader: SilkFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSide: { value: isRight ? 1.0 : -1.0 },
      uPhase: { value: isRight ? 0.15 : 0.0 },
      uAmp: { value: 1.0 },
      uSway: { value: 0.0 },
      uWh: { value: 960.0 },
      uHeight: { value: 1080.0 },
      uWavefrontRadius: { value: 0.0 },
      uWavefrontFeather: { value: 115.0 },
      uZOffset: { value: 0.0 },
      uMode: { value: 0.0 },
      uIsVeil: { value: isVeil ? 1.0 : 0.0 },
      uIsHero: { value: isHero ? 1.0 : 0.0 },
      uRimAlphaTarget: { value: rimAlphaTarget },
      uMorph: { value: 0.0 },
      uSplineCenterline: { value: defaultCenterline },
      uSplineWidth: { value: defaultWidth },
      uTwistCrestU: { value: 0.44 },
      uTwistPinchU: { value: 0.68 },
      uTwistDrift: { value: 0.0 },
      uLogoCenter: { value: new THREE.Vector2(0, 0) },
      uL: { value: 180.0 },
      uLa: { value: 216.0 },
      uHornPoints: {
        value: [
          new THREE.Vector2(108, 108),
          new THREE.Vector2(162, 142),
          new THREE.Vector2(216, 172),
          new THREE.Vector2(345, 233),
          new THREE.Vector2(488, 306),
          new THREE.Vector2(960, 507),
        ],
      },
      uRearBellZWh: { value: 0.0 },
      uWingCutoffL: { value: 0.75 },
      uAlphaBase: { value: 1.0 },
      uSheetIndex: { value: hornIndex },
      uMorphShading: { value: 0.0 },
      uDimmer: { value: isRight ? 0.82 : 1.0 }, // Amber Rec.709 luminance balance (~92% of blue)
      uColor0: { value: colors.c0 },
      uColor1: { value: colors.c1 },
      uColor2: { value: colors.c2 },
      uColor3: { value: colors.c3 },
      uWingCenterlinePchip: {
        value: [
          new THREE.Vector3(0.55, 0.55, -0.086_316),
          new THREE.Vector3(1.0, 0.46, -0.273_203),
          new THREE.Vector3(1.5, 0.24, -0.476_667),
          new THREE.Vector3(2.0, -0.02, -0.432_341),
          new THREE.Vector3(2.6, -0.24, -0.2625),
          new THREE.Vector3(3.4, -0.4, -0.120_968),
          new THREE.Vector3(4.6, -0.5, -0.013_333),
        ],
      },
      uWingThicknessPchip: {
        value: [
          new THREE.Vector3(0.55, 0.0, 0.162_924),
          new THREE.Vector3(1.0, 0.07, 0.147_505),
          new THREE.Vector3(1.5, 0.14, 0.129_231),
          new THREE.Vector3(2.0, 0.2, 0.098_901),
          new THREE.Vector3(2.6, 0.25, 0.039_474),
          new THREE.Vector3(3.4, 0.27, 0.0),
          new THREE.Vector3(4.6, 0.22, -0.081_667),
        ],
      },
    },
  });
}
