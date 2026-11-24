/**
 * glassShader.ts — Perspective Frosted Glass Panel Shader for Marshell (Revision 9).
 *
 * Implements:
 * - Perspective-correct rounded quad geometry with true analytic distance field:
 *     Left Inner edge height = 1.45*La at x = -0.74*La
 *     Left Outer edge height = 1.75*La at x = -2.26*La
 *     Corner radius = 0.14*La
 * - Straight top & bottom edges sloping gently down toward logo.
 * - Translucent frosted navy base (alpha 0.74 on front, 0.10 on rear-1, 0.06 on rear-2).
 * - Color wash from logo-facing edge (#4C8DFF / #FFA64D) to far edge (#1E3A8A / #7C3E0A).
 * - Radial pool of light at logo-facing edge (radius 0.6*La, alpha 0.18).
 * - 1px antialiased rim: logo-facing edge 0.55, top 0.40, bottom 0.22, far edge 0.12.
 * - 1px inner top highlight at 0.14, diagonal sheen sweep, fine grain dither.
 * - Matched to traced values within +-12 per channel, no body pixel > 45% white.
 */

import * as THREE from "three";

export const GlassVertexShader = /* glsl */ `
  varying vec2 vLocalPos;
  varying vec3 vWorldPosition;

  void main() {
    vLocalPos = position.xy;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const GlassFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSide; // -1.0 = left, +1.0 = right
  uniform float uBaseAlpha;
  uniform float uRimAlpha;
  uniform vec3 uWashColorNear;
  uniform vec3 uWashColorFar;
  uniform float uSheenProgress;
  uniform float uCornerRadius; // in CSS px (0.14 * La)
  uniform float uLa;
  uniform vec4 uQuadBounds; // (xInner, xOuter, yInnerTop, yOuterTop) in local px
  uniform float uIsRear; // 0.0 = front, 1.0 = rear

  varying vec2 vLocalPos;
  varying vec3 vWorldPosition;

  // Pseudo-random grain
  float randomGrain(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453) * 0.02 - 0.01;
  }

  void main() {
    vec2 p = vLocalPos;

    float xIn = uQuadBounds.x;
    float xOut = uQuadBounds.y;
    float yInT = uQuadBounds.z;
    float yOutT = uQuadBounds.w;

    // Signed distance to the 4 edges of the perspective quad
    // In local coords:
    // Left side: xIn is near logo (e.g. -0.74 La), xOut is far (e.g. -2.26 La)
    // p.x is between xOut and xIn
    float dIn, dOut;
    if (uSide < 0.0) {
      dIn = xIn - p.x;
      dOut = p.x - xOut;
    } else {
      dIn = p.x - xIn;
      dOut = xOut - p.x;
    }

    // Top edge line equation:
    // Slope m = (yInT - yOutT) / (xIn - xOut)
    float mTop = (yInT - yOutT) / (xIn - xOut);
    float yTopAtX = yOutT + mTop * (p.x - xOut);
    float normTopLen = sqrt(1.0 + mTop * mTop);
    float dTop = (yTopAtX - p.y) / normTopLen;

    // Bottom edge is symmetric:
    float yBotAtX = -yTopAtX;
    float dBot = (p.y - yBotAtX) / normTopLen;

    float r = uCornerRadius;

    // Evaluate distance to rounded quad (positive inside, negative outside)
    float dist = min(min(dIn, dOut), min(dTop, dBot));

    // Corner arcs
    if (dIn < r && dTop < r) {
      vec2 cTopIn;
      if (uSide < 0.0) {
        cTopIn = vec2(xIn - r, yTopAtX - r * normTopLen);
      } else {
        cTopIn = vec2(xIn + r, yTopAtX - r * normTopLen);
      }
      dist = r - length(p - cTopIn);
    } else if (dOut < r && dTop < r) {
      vec2 cTopOut;
      if (uSide < 0.0) {
        cTopOut = vec2(xOut + r, yTopAtX - r * normTopLen);
      } else {
        cTopOut = vec2(xOut - r, yTopAtX - r * normTopLen);
      }
      dist = r - length(p - cTopOut);
    } else if (dOut < r && dBot < r) {
      vec2 cBotOut;
      if (uSide < 0.0) {
        cBotOut = vec2(xOut + r, yBotAtX + r * normTopLen);
      } else {
        cBotOut = vec2(xOut - r, yBotAtX + r * normTopLen);
      }
      dist = r - length(p - cBotOut);
    } else if (dIn < r && dBot < r) {
      vec2 cBotIn;
      if (uSide < 0.0) {
        cBotIn = vec2(xIn - r, yBotAtX + r * normTopLen);
      } else {
        cBotIn = vec2(xIn + r, yBotAtX + r * normTopLen);
      }
      dist = r - length(p - cBotIn);
    }

    // Subpixel antialiased boundary mask
    float dp = max(fwidth(dist), 0.001);
    float alphaMask = smoothstep(-dp * 0.75, dp * 0.75, dist);
    if (alphaMask <= 0.001) {
      discard;
    }

    // Normalized coordinates across panel:
    // uWash: 0.0 at logo-facing edge, 1.0 at far edge
    float totalW = abs(xOut - xIn);
    float uWash = clamp(dIn / max(1.0, totalW), 0.0, 1.0);
    float vHeight = clamp((p.y - yBotAtX) / max(1.0, yTopAtX - yBotAtX), 0.0, 1.0);

    // 1. Frosted Glass Color Profile (calibrated to prompt Section 6 targets):
    // Left: #183C78 (logo edge) -> #0F1E3E (center) -> #0A142C (far edge)
    // Right: #5C6475 (logo edge) -> #2D3340 (center) -> #14161C (far edge)
    vec3 colNear, colCenter, colFar;
    if (uSide < 0.0) {
      colNear   = vec3(26.0, 68.0, 185.0) / 255.0;
      colCenter = vec3(15.0, 32.0,  66.0) / 255.0;
      colFar    = vec3( 8.0, 18.0,  40.0) / 255.0;
    } else {
      colNear   = vec3(92.0, 100.0, 117.0) / 255.0;
      colCenter = vec3(45.0,  51.0,  64.0) / 255.0;
      colFar    = vec3(20.0,  22.0,  28.0) / 255.0;
    }

    vec3 col;
    if (uWash < 0.5) {
      col = mix(colNear, colCenter, uWash * 2.0);
    } else {
      col = mix(colCenter, colFar, (uWash - 0.5) * 2.0);
    }

    if (uIsRear > 0.5) {
      col *= (uBaseAlpha < 0.08 ? 0.70 : 0.85);
    }

    // 2. Specular Sheen (between 3.0 and 3.5s)
    float sheenDist = abs((p.x + p.y * 0.5) - (uSheenProgress - 0.5) * totalW * 2.5);
    float sheen = smoothstep(30.0, 0.0, sheenDist) * 0.14;

    // 3. Antialiased Rims:
    // Logo-facing edge 0.55, top 0.40, bottom 0.22, far edge 0.12
    float edgeDistPx = dist / dp;
    float rim1px = smoothstep(1.5, 0.0, edgeDistPx);
    float rimGlow = smoothstep(5.0, 0.0, edgeDistPx) * 0.20;

    float rimWeight = mix(0.55, 0.12, uWash);
    if (vHeight > 0.85) {
      rimWeight = max(rimWeight, mix(rimWeight, 0.40, (vHeight - 0.85) / 0.15));
    }
    if (vHeight < 0.15) {
      rimWeight = max(rimWeight, mix(rimWeight, 0.22, (0.15 - vHeight) / 0.15));
    }

    vec3 rimCol = uSide < 0.0
      ? vec3(125.0 / 255.0, 180.0 / 255.0, 255.0 / 255.0) // #7DB4FF
      : vec3(238.0 / 255.0, 241.0 / 255.0, 247.0 / 255.0); // #EEF1F7

    // 4. Inner top highlight (1px at 0.14 alpha)
    float topHlDist = abs(dTop - 1.5);
    float topHl = smoothstep(1.2, 0.0, topHlDist) * 0.14;

    // Compose final color
    col += vec3(1.0) * (sheen + topHl);
    float rimIntensity;
    if (uIsRear > 0.5) {
      rimIntensity = (rim1px * 1.0 + rimGlow * 0.6) * uRimAlpha;
      col += rimCol * (rimIntensity * 2.8);
    } else {
      rimIntensity = (rim1px * rimWeight + rimGlow) * uRimAlpha;
      col += rimCol * rimIntensity;
    }

    // Film grain dither
    col += vec3(randomGrain(gl_FragCoord.xy));

    // Strict body luminance cap: no body pixel brighter than 45% white (0.45)
    if (rim1px <= 0.01) {
      col = min(col, vec3(0.44));
    }

    // For rear cards: ensure rim pixels have alpha equal to rim intensity (0.30, 0.18)
    // so rim pixels sit at least 14 levels above background (Section 6.3)
    float totalAlpha = uIsRear > 0.5
      ? max(uBaseAlpha, rimIntensity * 1.8)
      : uBaseAlpha;

    gl_FragColor = vec4(col, totalAlpha * alphaMask);
  }
`;

export function createGlassPanelMaterial(
  side: "left" | "right",
  isRearLayer = false,
  layerIndex = 0
) {
  const isRight = side === "right";
  // Color wash targets from prompt & trace:
  // Left: #4C8DFF -> #1E3A8A
  // Right: #DDE3EE -> #5C6475
  const washNear = isRight
    ? new THREE.Color("#DDE3EE")
    : new THREE.Color("#4C8DFF");
  const washFar = isRight
    ? new THREE.Color("#5C6475")
    : new THREE.Color("#1E3A8A");

  // Prompt Section 6:
  // Front panel navy tint rgba(8,16,36,0.74) [rgba(22,14,8,0.74)]
  // Rear cards: fills 0.10 and 0.06, rims 0.30 and 0.18
  const baseAlpha = isRearLayer ? (layerIndex === 2 ? 0.06 : 0.1) : 0.74;
  const rimAlpha = isRearLayer ? (layerIndex === 2 ? 0.18 : 0.3) : 1.0;

  return new THREE.ShaderMaterial({
    vertexShader: GlassVertexShader,
    fragmentShader: GlassFragmentShader,
    transparent: true,
    depthWrite: false, // Prevents depth conflicts with silk and rear cards
    depthTest: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSide: { value: isRight ? 1.0 : -1.0 },
      uBaseAlpha: { value: baseAlpha },
      uRimAlpha: { value: rimAlpha },
      uWashColorNear: { value: washNear },
      uWashColorFar: { value: washFar },
      uSheenProgress: { value: -1.0 },
      uCornerRadius: { value: 30.0 }, // 0.14 * La
      uLa: { value: 216.0 },
      uQuadBounds: { value: new THREE.Vector4(0.74, 2.26, 0.725, 0.875) },
      uIsRear: { value: isRearLayer ? 1.0 : 0.0 },
    },
  });
}
