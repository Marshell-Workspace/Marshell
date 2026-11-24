/**
 * flareShader.ts — Volumetric Center Flare & Flank Glow Shader (Revision 8).
 *
 * Implements Section 7 Center Glow:
 * 1. Hot core: radius ~0.006H, near-white #FFF8EE
 * 2. Inner halo: radius ~0.08 Wh, alpha ~0.60, blue-tinted left, amber-tinted right
 * 3. Wide soft ellipse: rx ~0.38 Wh, ry ~0.16H, alpha ~0.22, blue left, amber right
 * 4. Faint horizontal streak: length ~0.30H, alpha ~0.20, tapering
 * All radial falloffs reach EXACT zero alpha at boundary via smoothstep (no disc, no ring).
 */

import * as THREE from "three";

export const FlareVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const FlareFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uAlpha;
  uniform float uWh;
  uniform float uHeight;
  uniform float uStreakAlpha;

  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0; // [-1.0, 1.0]

    float H = uHeight;
    float Wh = uWh;
    float scale = max(0.01, uScale);

    // 1. Hot Core: radius ~0.006 H (~6.5px at 1080p), near-white #FFF8EE
    float rCoreNorm = length(p * vec2(Wh / (0.008 * H * scale), 1.0 / (0.012 * scale)));
    float core = exp(-rCoreNorm * rCoreNorm * 1.5);

    // 2. Inner Halo: radius ~0.08 Wh (~76px at 1080p), alpha ~0.60
    float rHaloNorm = length(p * vec2(1.0 / (0.08 * scale), (H / Wh) / (0.08 * scale)));
    float haloFalloff = smoothstep(1.0, 0.0, rHaloNorm);
    float halo = haloFalloff * exp(-rHaloNorm * rHaloNorm * 1.4) * 0.60;

    // 3. Wide Soft Ellipse: rx ~0.38 Wh, ry ~0.16H, alpha ~0.22
    vec2 pEllip = vec2(p.x / (0.38 * scale), p.y / (0.16 * scale));
    float rEllip = length(pEllip);
    float ellipseFalloff = smoothstep(1.0, 0.0, rEllip);
    float ellipse = ellipseFalloff * exp(-rEllip * rEllip * 1.4) * 0.22;

    // 4. Horizontal Anamorphic Streak: length ~0.30H, alpha ~0.20
    float streakX = abs(p.x * Wh / (0.30 * H * scale));
    float streakY = abs(p.y * H / (0.003 * H * scale));
    float streakFalloff = smoothstep(1.0, 0.0, streakX);
    float streak = streakFalloff * exp(-streakX * 1.8) * exp(-streakY * streakY) * uStreakAlpha;

    // Dual-tint: Blue-white on left (p.x < 0), Near-white on right (p.x > 0)
    vec3 colCore = vec3(255.0 / 255.0, 248.0 / 255.0, 238.0 / 255.0);
    vec3 colBlue = vec3(120.0 / 255.0, 180.0 / 255.0, 255.0 / 255.0);
    vec3 colAmber = vec3(221.0 / 255.0, 227.0 / 255.0, 238.0 / 255.0);

    float tSide = clamp(p.x * 2.0, -1.0, 1.0);
    vec3 sideTint = tSide < 0.0 ? mix(colCore, colBlue, -tSide * 0.75) : mix(colCore, colAmber, tSide * 0.75);

    // Composite layers
    vec3 color = colCore * core * 1.35;
    color += sideTint * (halo + ellipse);
    color += mix(sideTint, vec3(1.0), 0.65) * streak;

    // Tone map shoulder
    if (color.b > 0.85 && color.g > 0.85) {
      color.r = max(color.r, 0.65 * min(color.b, color.g));
    }
    if (color.r > 0.85 && color.g > 0.85) {
      color.b = max(color.b, 0.55 * min(color.r, color.g));
    }

    float totalAlpha = (core + halo + ellipse + streak) * uAlpha;
    if (totalAlpha <= 0.001) {
      discard;
    }

    gl_FragColor = vec4(color * uAlpha, totalAlpha);
  }
`;

export function createFlareMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: FlareVertexShader,
    fragmentShader: FlareFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 1.0 },
      uAlpha: { value: 1.0 },
      uWh: { value: 960.0 },
      uHeight: { value: 1080.0 },
      uStreakAlpha: { value: 0.2 },
    },
  });
}

// ── Flank Glow Material (Blue or Amber pool between logo and panel) ──────────

export const FlankGlowFragmentShader = /* glsl */ `
  uniform float uAlpha;
  uniform vec3 uColor;
  uniform float uRadiusRatio; // ratio of glow radius (0.7 La) to quad half-size (e.g. 0.833)

  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float rMax = max(0.1, uRadiusRatio);
    if (r >= rMax) {
      discard;
    }

    float normR = r / rMax;
    float falloff = smoothstep(1.0, 0.0, normR);
    float glow = exp(-normR * normR * 2.2) * falloff;

    float a = glow * uAlpha;
    if (a <= 0.001) discard;

    // Additive pool: Three.js AdditiveBlending multiplies RGB by A
    gl_FragColor = vec4(uColor, a);
  }
`;

export function createFlankGlowMaterial(side: "left" | "right") {
  const isRight = side === "right";
  // Blue-white / Near-white tint
  const color = isRight
    ? new THREE.Color("#DDE3EE")
    : new THREE.Color("#4C8DFF");

  return new THREE.ShaderMaterial({
    vertexShader: FlareVertexShader,
    fragmentShader: FlankGlowFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uAlpha: { value: 0.0 },
      uColor: { value: color },
      uRadiusRatio: { value: 0.8 }, // reaches exactly zero at 80% of quad radius
    },
  });
}

// ── Logo Rim & Halo Material (Halo, Thin Rim & Wing Tip Pools) ──────────

export const LogoRimFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uAlpha;
  uniform float uLa;
  uniform float uQuadSize;
  uniform float uHaloAlpha;
  uniform float uPoolAlpha;
  uniform float uRimAlpha;

  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * uQuadSize;
    float L = uLa;
    float tileHalf = 0.50 * L;
    float cornerR = 0.22 * L;

    // ── 1. Soft Radial Halo Behind Logo ──
    // Radius about 1.1 L, alpha about 0.22, blue-white left, warm white center, amber-white right
    // Smoothstep to exactly 0 before its edge so NO square plate
    float r = length(p);
    float rMax = 1.10 * L;
    float haloFalloff = smoothstep(rMax, rMax * 0.35, r);
    float haloA = haloFalloff * 0.22 * uHaloAlpha;

    vec3 colWarmWhite = vec3(1.0, 0.98, 0.95);
    vec3 colBlueWhite = vec3(180.0 / 255.0, 215.0 / 255.0, 1.0);
    vec3 colAmberWhite = vec3(244.0 / 255.0, 246.0 / 255.0, 250.0 / 255.0);
    float tSide = clamp(p.x / max(0.001, 0.70 * L), -1.0, 1.0);
    vec3 haloCol = tSide < 0.0 ? mix(colWarmWhite, colBlueWhite, -tSide) : mix(colWarmWhite, colAmberWhite, tSide);

    // ── 2. Thin Luminous Rim Hugging Tile (1 to 1.5px, alpha about 0.40) ──
    vec2 q = abs(p) - vec2(tileHalf - cornerR);
    float d = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - cornerR;
    float rimCore = smoothstep(1.35, 0.0, abs(d));
    float rimGlow = smoothstep(5.5, 0.0, max(0.0, d)) * 0.14;
    float flankFade = pow(clamp(abs(p.x) / max(0.001, length(p)), 0.0, 1.0), 0.70);
    float effectiveRimAlpha = max(uRimAlpha, uAlpha);
    float rimA = (rimCore * 0.40 + rimGlow) * flankFade * effectiveRimAlpha;
    vec3 rimCol = p.x < 0.0
      ? vec3(191.0 / 255.0, 216.0 / 255.0, 255.0 / 255.0)
      : vec3(238.0 / 255.0, 241.0 / 255.0, 247.0 / 255.0);

    // ── Frame 4 ALIGN exact pass (when halo and pools are idle) ──
    if (uHaloAlpha <= 0.001 && uPoolAlpha <= 0.001) {
      float rimCoreAlign = smoothstep(1.35, 0.0, abs(d));
      float rimGlowAlign = smoothstep(6.0, 0.0, max(0.0, d)) * 0.12;
      float aAlign = (rimCoreAlign * 0.40 + rimGlowAlign) * flankFade * uAlpha;
      if (aAlign <= 0.001) discard;
      gl_FragColor = vec4(rimCol, aAlign);
      return;
    }

    // ── 3. Light Pools Where Wing Tips Meet Logo Lower Corners ──
    // Lower corners: x = +-0.52 L, y = -0.48 L (Three.js coordinates, below center is negative Y)
    // Radius about 0.45 L, alpha about 0.20
    vec2 leftCorner = vec2(-0.52 * L, -0.48 * L);
    vec2 rightCorner = vec2(0.52 * L, -0.48 * L);
    float dLeft = length(p - leftCorner);
    float dRight = length(p - rightCorner);
    float poolRMax = 0.45 * L;
    float poolLeftA = smoothstep(poolRMax, 0.0, dLeft) * exp(-2.5 * (dLeft / poolRMax) * (dLeft / poolRMax)) * 0.20 * uPoolAlpha;
    float poolRightA = smoothstep(poolRMax, 0.0, dRight) * exp(-2.5 * (dRight / poolRMax) * (dRight / poolRMax)) * 0.20 * uPoolAlpha;
    vec3 poolLeftCol = vec3(160.0 / 255.0, 205.0 / 255.0, 1.0);
    vec3 poolRightCol = vec3(238.0 / 255.0, 241.0 / 255.0, 247.0 / 255.0);

    // Compose additively for Welcome idle
    vec3 outCol = haloCol * haloA + rimCol * rimA + poolLeftCol * poolLeftA + poolRightCol * poolRightA;
    float totalA = haloA + rimA + poolLeftA + poolRightA;

    if (totalA <= 0.001) {
      discard;
    }

    gl_FragColor = vec4(outCol, 1.0);
  }
`;

export function createLogoRimMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: FlareVertexShader,
    fragmentShader: LogoRimFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 0.0 },
      uLa: { value: 216.0 },
      uQuadSize: { value: 350.0 },
      uHaloAlpha: { value: 0.0 },
      uPoolAlpha: { value: 0.0 },
      uRimAlpha: { value: 0.0 },
    },
  });
}
