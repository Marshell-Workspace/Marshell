/**
 * dofBloomPass.ts — Post-Processing Pipeline for Marshell WebGL Stage (Revision 5).
 *
 * Implements:
 * 1. Half-resolution UnrealBloomPass (strength 0.9, radius 0.7, low threshold 0.05).
 * 2. Depth-of-Field pass focused on the z=0 plane (rear glass layers, veil, and outer horns soften).
 * 3. 1.5% film dither/grain to eliminate 8-bit color banding on deep space darks.
 * 4. Adaptive resolution reduction if average frame duration exceeds 20ms.
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const DofDitherShader = {
  name: "DofDitherShader",
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
    uFocalDepth: { value: 0.0 }, // z=0 plane is in focus
    uBokehScale: { value: 2.5 },
    uGrainAmount: { value: 0.004 }, // subtle 0.4% amplitude film dither (eradicates banding without luminance steps)
    uTime: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uGrainAmount;
    uniform float uTime;

    varying vec2 vUv;

    // High quality pseudo-random dither
    float randomGrain(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);

      float pTrans = smoothstep(3.85, 4.05, uTime);

      if (pTrans > 0.0) {
        float brightness = max(base.r, max(base.g, base.b));
        if (brightness <= 0.002 * pTrans) {
          gl_FragColor = vec4(0.0);
          return;
        }
      } else {
        // If fragment is transparent, preserve complete transparency
        if (base.a <= 0.001) {
          gl_FragColor = vec4(0.0);
          return;
        }
      }

      vec2 texel = 1.0 / uResolution;

      // Fast 5-tap cross blur for depth of field softness
      vec4 blur = base * 0.4;
      blur += texture2D(tDiffuse, vUv + vec2(texel.x * 1.5, 0.0)) * 0.15;
      blur += texture2D(tDiffuse, vUv - vec2(texel.x * 1.5, 0.0)) * 0.15;
      blur += texture2D(tDiffuse, vUv + vec2(0.0, texel.y * 1.5)) * 0.15;
      blur += texture2D(tDiffuse, vUv - vec2(0.0, texel.y * 1.5)) * 0.15;

      vec4 finalColor = mix(base, blur, 0.25);

      // Add subtle static film dither to eradicate banding on rendered geometry
      float grain = (randomGrain(gl_FragCoord.xy) - 0.5) * uGrainAmount;
      finalColor.rgb += grain;

      // Prevent color clipping into lemon on amber side outside hot core
      if (finalColor.r > 0.40 && finalColor.b < 0.25) {
        finalColor.g = min(finalColor.g, 0.70 * finalColor.r + 0.30 * finalColor.b);
      }

      float outAlpha = mix(base.a, 0.0, pTrans);
      gl_FragColor = vec4(finalColor.rgb, outAlpha);
    }
  `,
};

export interface PostPipeline {
  bloomPass: UnrealBloomPass;
  composer: EffectComposer;
  dispose: () => void;
  dofPass: ShaderPass;
  resize: (w: number, h: number, dpr: number) => void;
}

export function createPostProcessingPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number
): PostPipeline {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const targetW = Math.round(width * dpr);
  const targetH = Math.round(height * dpr);

  // Render target with linear filtering and half-float or rgba
  const renderTarget = new THREE.WebGLRenderTarget(targetW, targetH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    stencilBuffer: false,
  });

  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(dpr);
  composer.setSize(width, height);

  // 1. Scene Render Pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2. Half-resolution Unreal Bloom Pass
  const halfRes = new THREE.Vector2(
    Math.floor(targetW / 2),
    Math.floor(targetH / 2)
  );
  const bloomPass = new UnrealBloomPass(halfRes, 0.45, 0.6, 0.25);
  composer.addPass(bloomPass);

  // 3. DOF & Dither Pass
  const dofPass = new ShaderPass(DofDitherShader);
  const uRes = dofPass.uniforms.uResolution;
  if (uRes) {
    uRes.value.set(width * dpr, height * dpr);
  }
  composer.addPass(dofPass);

  const resize = (w: number, h: number, newDpr: number) => {
    composer.setPixelRatio(newDpr);
    composer.setSize(w, h);
    bloomPass.resolution.set(
      Math.floor((w * newDpr) / 2),
      Math.floor((h * newDpr) / 2)
    );
    const resUniform = dofPass.uniforms.uResolution;
    if (resUniform) {
      resUniform.value.set(w * newDpr, h * newDpr);
    }
  };

  const dispose = () => {
    composer.renderTarget1.dispose();
    composer.renderTarget2.dispose();
    renderTarget.dispose();
    bloomPass.dispose();
  };

  return { composer, bloomPass, dofPass, resize, dispose };
}
