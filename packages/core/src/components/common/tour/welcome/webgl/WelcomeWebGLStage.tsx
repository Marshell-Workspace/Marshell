/**
 * WelcomeWebGLStage.tsx — Three.js GPU Rendering Stage for Marshell (Revision 5).
 *
 * Implements:
 * - Real WebGL 3D stage owning:
 *     Frame 2: RESONANCE (0.70s -> 1.62s) Silk scarves and center flare
 *     Frame 4: ALIGN (2.50s -> 4.00s) Frosted glass panels, rear cards, flank glows, silk horns
 *     Frame 5: WELCOME (4.00s -> 6.10s) Silk crescent wings cradling the glided logo
 * - Hidden and completely dormant during Frame 3 UNFOLD (1.70s -> 2.45s).
 * - Exact camera projection (FOV 30°, distance placing 1 unit = 1 CSS px at z=0).
 * - Accurate 3D panel corner projection to screen coordinates for DOM text homography.
 * - UnrealBloomPass and Depth of Field post-processing with 1.5% film dither.
 * - StrictMode safe, context-loss resilient, zero React state per frame.
 */

"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { FrontQuadCorners } from "../sheetMath";
import type { FrameCallback } from "../useWelcomeTimeline";
import {
  calculateAlignLogoSize,
  calculateLogoSize,
  FINAL_LAYOUT,
  getLayerVisibility,
  WELCOME_CONFIG,
  WING_CUTOFF_Y_L,
} from "../welcome.config";
import {
  createPostProcessingPipeline,
  type PostPipeline,
} from "./dofBloomPass";
import {
  createFlankGlowMaterial,
  createFlareMaterial,
  createLogoRimMaterial,
} from "./flareShader";
import { createGlassPanelMaterial } from "./glassShader";
import {
  createResonancePassPipeline,
  type ResonancePassPipeline,
} from "./resonanceWaveShader";
import { createSilkMaterial } from "./silkShader";

export interface WelcomeWebGLStageProps {
  onProjectedQuads?: (quads: {
    leftFrontQuad: FrontQuadCorners | null;
    rightFrontQuad: FrontQuadCorners | null;
  }) => void;
  reducedMotion: boolean;
  registerFrameCallback: (cb: FrameCallback) => () => void;
  tier: "performance" | "balanced" | "eco";
}

function easeOutCubic(t: number): number {
  const p = Math.max(0, Math.min(1, t));
  return 1 - (1 - p) ** 3;
}

function _easeOutQuart(t: number): number {
  const p = Math.max(0, Math.min(1, t));
  return 1 - (1 - p) ** 4;
}

function _smoothstep(min: number, max: number, value: number): number {
  if (max <= min) {
    return 0;
  }
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

function calcSpringVal(tau: number, omega0: number, zeta: number): number {
  if (tau <= 0) {
    return 0;
  }
  const wd = omega0 * Math.sqrt(Math.max(0.001, 1 - zeta * zeta));
  const expFactor = Math.exp(-zeta * omega0 * tau);
  const cosTerm = Math.cos(wd * tau);
  const sinTerm = Math.sin(wd * tau);
  return 1 - expFactor * (cosTerm + ((zeta * omega0) / wd) * sinTerm);
}

function setUniform(mat: THREE.ShaderMaterial, name: string, value: unknown) {
  const u = mat.uniforms[name];
  if (u) {
    u.value = value;
  }
}

export function WelcomeWebGLStage({
  reducedMotion,
  registerFrameCallback,
  tier,
  onProjectedQuads,
}: WelcomeWebGLStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onProjectedQuadsRef = useRef(onProjectedQuads);
  onProjectedQuadsRef.current = onProjectedQuads;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      typeof window === "undefined" ||
      reducedMotion ||
      tier === "eco"
    ) {
      return;
    }

    let width = canvas.parentElement?.clientWidth || window.innerWidth;
    let height = canvas.parentElement?.clientHeight || window.innerHeight;
    const maxDpr = tier === "performance" ? 2 : 1;
    let dpr = Math.min(maxDpr, window.devicePixelRatio || 1);

    // 1. Renderer Setup
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        premultipliedAlpha: true,
        antialias: tier === "performance",
        powerPreference:
          tier === "performance" ? "high-performance" : "low-power",
      });
      renderer.setClearColor(0x00_00_00, 0);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height);
    } catch (e) {
      console.warn(
        "[WelcomeWebGLStage] WebGL2 not available, falling back:",
        e
      );
      return;
    }

    // 2. Camera Setup (FOV 30°, distance D = (height / 2) / tan(15°))
    const fov = 30;
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 5000);
    const updateCameraDistance = (h: number) => {
      const halfFovRad = (fov / 2) * (Math.PI / 180);
      const dist = h / 2 / Math.tan(halfFovRad);
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };
    updateCameraDistance(height);

    // 3. Scene & Post Processing
    const scene = new THREE.Scene();
    let postPipeline: PostPipeline | null = null;
    if (tier === "performance") {
      try {
        postPipeline = createPostProcessingPipeline(
          renderer,
          scene,
          camera,
          width,
          height
        );
      } catch (err) {
        console.warn("[WelcomeWebGLStage] Post pipeline error:", err);
      }
    }

    let resonancePass: ResonancePassPipeline | null = null;
    try {
      resonancePass = createResonancePassPipeline(renderer, width, height, dpr);
    } catch (err) {
      console.warn("[WelcomeWebGLStage] Resonance pass error:", err);
    }

    // ── GEOMETRY PRIMITIVES ─────────────────────────────────────────────────
    // A. Silk Surface Mesh: 512x32 grid (Section 8)
    const silkGeom = new THREE.PlaneGeometry(
      1,
      1,
      tier === "performance" ? 512 : 128,
      tier === "performance" ? 32 : 16
    );

    // B. Flare Plane: 1x1 plane
    const flareGeom = new THREE.PlaneGeometry(1, 1);

    // C. Panel Perspective Quad Geometries (4 vertices, 2 triangles each)
    const createQuadGeom = () => {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(12);
      const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      return g;
    };

    const geomLeftFront = createQuadGeom();
    const geomLeftRear1 = createQuadGeom();
    const geomLeftRear2 = createQuadGeom();
    const geomRightFront = createQuadGeom();
    const geomRightRear1 = createQuadGeom();
    const geomRightRear2 = createQuadGeom();

    const updateQuadGeometry = (
      geom: THREE.BufferGeometry,
      p0: { x: number; y: number }, // top-outer
      p1: { x: number; y: number }, // top-inner
      p2: { x: number; y: number }, // bot-inner
      p3: { x: number; y: number }, // bot-outer
      z: number
    ) => {
      const posAttr = geom.getAttribute("position");
      if (!posAttr) {
        return;
      }
      const pos = posAttr.array as Float32Array;
      pos[0] = p0.x;
      pos[1] = p0.y;
      pos[2] = z;
      pos[3] = p1.x;
      pos[4] = p1.y;
      pos[5] = z;
      pos[6] = p2.x;
      pos[7] = p2.y;
      pos[8] = z;
      pos[9] = p3.x;
      pos[10] = p3.y;
      pos[11] = z;
      posAttr.needsUpdate = true;
    };

    // ── MESH INSTANCES ──────────────────────────────────────────────────────
    // 1. Frame 2: Silk Scarves (R1, R2, S1-S3, V_up, V_down per side)
    const r1Centerline = [
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
    const r1Width = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.1, 0.004),
      new THREE.Vector2(0.25, 0.016),
      new THREE.Vector2(0.44, 0.028),
      new THREE.Vector2(0.68, 0.01),
      new THREE.Vector2(0.9, 0.022),
      new THREE.Vector2(1.15, 0.018),
    ];

    const r2Centerline = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.1, -0.002),
      new THREE.Vector2(0.2, -0.016),
      new THREE.Vector2(0.3, -0.026),
      new THREE.Vector2(0.4, -0.038),
      new THREE.Vector2(0.52, -0.02),
      new THREE.Vector2(0.65, 0.022),
      new THREE.Vector2(0.78, 0.058),
      new THREE.Vector2(0.9, 0.075),
      new THREE.Vector2(1.0, 0.079),
      new THREE.Vector2(1.15, 0.08),
    ];
    const r2Width = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.1, 0.003),
      new THREE.Vector2(0.25, 0.012),
      new THREE.Vector2(0.4, 0.021),
      new THREE.Vector2(0.65, 0.008),
      new THREE.Vector2(0.9, 0.016),
      new THREE.Vector2(1.15, 0.014),
    ];

    const s1Centerline = r1Centerline.map(
      (p) => new THREE.Vector2(p.x, p.y * 0.85)
    );
    const s1Width = r1Width.map((p) => new THREE.Vector2(p.x, p.y * 0.7));
    const s2Centerline = r1Centerline.map(
      (p) => new THREE.Vector2(p.x, p.y * 0.75)
    );
    const s2Width = r1Width.map((p) => new THREE.Vector2(p.x, p.y * 0.6));
    const s3Centerline = r1Centerline.map(
      (p) => new THREE.Vector2(p.x, p.y * 0.6)
    );
    const s3Width = r1Width.map((p) => new THREE.Vector2(p.x, p.y * 0.5));

    const vUpCenterline = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.1, -0.02),
      new THREE.Vector2(0.2, -0.045),
      new THREE.Vector2(0.3, -0.085),
      new THREE.Vector2(0.4, -0.13),
      new THREE.Vector2(0.5, -0.175),
      new THREE.Vector2(0.62, -0.22),
      new THREE.Vector2(0.8, -0.24),
      new THREE.Vector2(0.9, -0.23),
      new THREE.Vector2(1.0, -0.21),
      new THREE.Vector2(1.15, -0.19),
    ];
    const vUpWidth = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.1, 0.01),
      new THREE.Vector2(0.25, 0.025),
      new THREE.Vector2(0.4, 0.04),
      new THREE.Vector2(0.7, 0.075),
      new THREE.Vector2(1.0, 0.09),
      new THREE.Vector2(1.15, 0.095),
    ];

    const vDownCenterline = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.1, 0.015),
      new THREE.Vector2(0.25, 0.04),
      new THREE.Vector2(0.38, 0.07),
      new THREE.Vector2(0.5, 0.1),
      new THREE.Vector2(0.62, 0.13),
      new THREE.Vector2(0.75, 0.16),
      new THREE.Vector2(0.88, 0.17),
      new THREE.Vector2(1.0, 0.17),
      new THREE.Vector2(1.08, 0.175),
      new THREE.Vector2(1.15, 0.18),
    ];
    const vDownWidth = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.1, 0.01),
      new THREE.Vector2(0.25, 0.02),
      new THREE.Vector2(0.4, 0.035),
      new THREE.Vector2(0.7, 0.05),
      new THREE.Vector2(1.0, 0.06),
      new THREE.Vector2(1.15, 0.06),
    ];

    const initRibbonMat = (
      mat: THREE.ShaderMaterial,
      centerline: THREE.Vector2[],
      widthPts: THREE.Vector2[],
      crestU: number,
      pinchU: number,
      phase: number
    ) => {
      const uCenterline = mat.uniforms.uSplineCenterline?.value as
        | THREE.Vector2[]
        | undefined;
      if (uCenterline && Array.isArray(uCenterline)) {
        for (
          let i = 0;
          i < Math.min(uCenterline.length, centerline.length);
          i++
        ) {
          uCenterline[i]?.copy(centerline[i]!);
        }
      } else {
        setUniform(mat, "uSplineCenterline", centerline);
      }
      const uWidth = mat.uniforms.uSplineWidth?.value as
        | THREE.Vector2[]
        | undefined;
      if (uWidth && Array.isArray(uWidth)) {
        for (let i = 0; i < Math.min(uWidth.length, widthPts.length); i++) {
          uWidth[i]?.copy(widthPts[i]!);
        }
      } else {
        setUniform(mat, "uSplineWidth", widthPts);
      }
      setUniform(mat, "uTwistCrestU", crestU);
      setUniform(mat, "uTwistPinchU", pinchU);
      setUniform(mat, "uPhase", phase);
    };

    // Instantiate 14 materials & meshes (Hero ribbons R1 and R2 have bright lit rims)
    const silkMatLeftR1 = createSilkMaterial("left", false, true);
    const silkMatRightR1 = createSilkMaterial("right", false, true);
    initRibbonMat(silkMatLeftR1, r1Centerline, r1Width, 0.44, 0.68, 0.0);
    initRibbonMat(silkMatRightR1, r1Centerline, r1Width, 0.44, 0.68, 0.15);

    const silkMatLeftR2 = createSilkMaterial("left", false, true);
    const silkMatRightR2 = createSilkMaterial("right", false, true);
    initRibbonMat(silkMatLeftR2, r2Centerline, r2Width, 0.4, 0.65, 0.3);
    initRibbonMat(silkMatRightR2, r2Centerline, r2Width, 0.4, 0.65, 0.45);

    const silkMatLeftS1 = createSilkMaterial("left", false, false);
    const silkMatRightS1 = createSilkMaterial("right", false, false);
    initRibbonMat(silkMatLeftS1, s1Centerline, s1Width, 0.46, 0.7, -0.18);
    initRibbonMat(silkMatRightS1, s1Centerline, s1Width, 0.46, 0.7, -0.05);

    const silkMatLeftS2 = createSilkMaterial("left", false, false);
    const silkMatRightS2 = createSilkMaterial("right", false, false);
    initRibbonMat(silkMatLeftS2, s2Centerline, s2Width, 0.42, 0.66, 0.12);
    initRibbonMat(silkMatRightS2, s2Centerline, s2Width, 0.42, 0.66, 0.25);

    const silkMatLeftS3 = createSilkMaterial("left", false, false);
    const silkMatRightS3 = createSilkMaterial("right", false, false);
    initRibbonMat(silkMatLeftS3, s3Centerline, s3Width, 0.4, 0.64, 0.22);
    initRibbonMat(silkMatRightS3, s3Centerline, s3Width, 0.4, 0.64, 0.35);

    const silkMatLeftVUp = createSilkMaterial("left", true, false);
    const silkMatRightVUp = createSilkMaterial("right", true, false);
    initRibbonMat(silkMatLeftVUp, vUpCenterline, vUpWidth, 0.5, 0.8, 0.0);
    initRibbonMat(silkMatRightVUp, vUpCenterline, vUpWidth, 0.5, 0.8, 0.1);

    const silkMatLeftVDown = createSilkMaterial("left", true, false);
    const silkMatRightVDown = createSilkMaterial("right", true, false);
    initRibbonMat(silkMatLeftVDown, vDownCenterline, vDownWidth, 0.5, 0.8, 0.0);
    initRibbonMat(
      silkMatRightVDown,
      vDownCenterline,
      vDownWidth,
      0.5,
      0.8,
      0.1
    );

    const silkMeshLeftR1 = new THREE.Mesh(silkGeom, silkMatLeftR1);
    const silkMeshRightR1 = new THREE.Mesh(silkGeom, silkMatRightR1);
    const silkMeshLeftR2 = new THREE.Mesh(silkGeom, silkMatLeftR2);
    const silkMeshRightR2 = new THREE.Mesh(silkGeom, silkMatRightR2);
    const silkMeshLeftS1 = new THREE.Mesh(silkGeom, silkMatLeftS1);
    const silkMeshRightS1 = new THREE.Mesh(silkGeom, silkMatRightS1);
    const silkMeshLeftS2 = new THREE.Mesh(silkGeom, silkMatLeftS2);
    const silkMeshRightS2 = new THREE.Mesh(silkGeom, silkMatRightS2);
    const silkMeshLeftS3 = new THREE.Mesh(silkGeom, silkMatLeftS3);
    const silkMeshRightS3 = new THREE.Mesh(silkGeom, silkMatRightS3);
    const silkMeshLeftVUp = new THREE.Mesh(silkGeom, silkMatLeftVUp);
    const silkMeshRightVUp = new THREE.Mesh(silkGeom, silkMatRightVUp);
    const silkMeshLeftVDown = new THREE.Mesh(silkGeom, silkMatLeftVDown);
    const silkMeshRightVDown = new THREE.Mesh(silkGeom, silkMatRightVDown);

    // Add in back-to-front depth order
    scene.add(silkMeshLeftVDown);
    scene.add(silkMeshRightVDown);
    scene.add(silkMeshLeftVUp);
    scene.add(silkMeshRightVUp);
    scene.add(silkMeshLeftS3);
    scene.add(silkMeshRightS3);
    scene.add(silkMeshLeftS2);
    scene.add(silkMeshRightS2);
    scene.add(silkMeshLeftR2);
    scene.add(silkMeshRightR2);
    scene.add(silkMeshLeftS1);
    scene.add(silkMeshRightS1);
    scene.add(silkMeshLeftR1);
    scene.add(silkMeshRightR1);

    // 2. Frame 2: Center Flare
    const flareMat = createFlareMaterial();
    const flareMesh = new THREE.Mesh(flareGeom, flareMat);
    scene.add(flareMesh);

    // 3. Frame 4: Flank Glow Pools
    const flankMatLeft = createFlankGlowMaterial("left");
    const flankMeshLeft = new THREE.Mesh(flareGeom, flankMatLeft);
    const flankMatRight = createFlankGlowMaterial("right");
    const flankMeshRight = new THREE.Mesh(flareGeom, flankMatRight);
    scene.add(flankMeshLeft);
    scene.add(flankMeshRight);

    // 3b. Frame 4: Logo Luminous Rim (1.25px ring around tile)
    const logoRimMat = createLogoRimMaterial();
    const logoRimMesh = new THREE.Mesh(flareGeom, logoRimMat);
    scene.add(logoRimMesh);

    // 4. Frame 4: Silk Horns (3 nested bells per side) & Frame 5 Wings
    const hornMatsLeft = [
      createSilkMaterial("left", false, false, 0),
      createSilkMaterial("left", false, false, 1),
      createSilkMaterial("left", false, false, 2),
    ];
    const hornMeshesLeft = hornMatsLeft.map((m) => new THREE.Mesh(silkGeom, m));
    const hornMatsRight = [
      createSilkMaterial("right", false, false, 0),
      createSilkMaterial("right", false, false, 1),
      createSilkMaterial("right", false, false, 2),
    ];
    const hornMeshesRight = hornMatsRight.map(
      (m) => new THREE.Mesh(silkGeom, m)
    );
    for (let i = 2; i >= 0; i--) {
      scene.add(hornMeshesLeft[i]!);
      scene.add(hornMeshesRight[i]!);
    }

    // 5. Frame 4: Glass Panels (Front + 2 Rear per side)
    const glassMatLeftFront = createGlassPanelMaterial("left", false, 0);
    const glassMatLeftRear1 = createGlassPanelMaterial("left", true, 1);
    const glassMatLeftRear2 = createGlassPanelMaterial("left", true, 2);
    const glassMeshLeftRear2 = new THREE.Mesh(geomLeftRear2, glassMatLeftRear2);
    const glassMeshLeftRear1 = new THREE.Mesh(geomLeftRear1, glassMatLeftRear1);
    const glassMeshLeftFront = new THREE.Mesh(geomLeftFront, glassMatLeftFront);

    const glassMatRightFront = createGlassPanelMaterial("right", false, 0);
    const glassMatRightRear1 = createGlassPanelMaterial("right", true, 1);
    const glassMatRightRear2 = createGlassPanelMaterial("right", true, 2);
    const glassMeshRightRear2 = new THREE.Mesh(
      geomRightRear2,
      glassMatRightRear2
    );
    const glassMeshRightRear1 = new THREE.Mesh(
      geomRightRear1,
      glassMatRightRear1
    );
    const glassMeshRightFront = new THREE.Mesh(
      geomRightFront,
      glassMatRightFront
    );

    scene.add(glassMeshLeftRear2);
    scene.add(glassMeshLeftRear1);
    scene.add(glassMeshLeftFront);
    scene.add(glassMeshRightRear2);
    scene.add(glassMeshRightRear1);
    scene.add(glassMeshRightFront);

    // ── RESIZE HANDLER ──────────────────────────────────────────────────────
    const onResize = () => {
      width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.parentElement?.clientHeight || window.innerHeight;
      dpr = Math.min(maxDpr, window.devicePixelRatio || 1);

      if (renderer) {
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height);
      }
      camera.aspect = width / height;
      updateCameraDistance(height);

      if (postPipeline) {
        postPipeline.resize(width, height, dpr);
      }
      if (resonancePass) {
        resonancePass.resize(width, height, dpr);
      }
    };

    const ro = new ResizeObserver(onResize);
    if (canvas.parentElement) {
      ro.observe(canvas.parentElement);
    }
    window.addEventListener("resize", onResize);

    // ── FRAME RENDER FUNCTION ───────────────────────────────────────────────
    const onFrame = (t: number) => {
      if (width <= 0 || height <= 0 || !renderer) {
        return;
      }

      // Frame 1 (VOID < 0.50) and Frame 3 deep freeze (1.95s <= t < 2.45s)
      if (t < 0.5 || (t >= 1.95 && t < 2.45)) {
        canvas.style.display = "none";
        return;
      }
      canvas.style.display = "block";

      // Smooth Handoff Dissolve into Frame 4 ALIGN [2.45 - 2.70s]
      let stageOpacity = 1.0;
      if (t >= 2.45 && t <= 2.7) {
        stageOpacity = Math.min(1.0, (t - 2.45) / (2.7 - 2.45));
      }
      canvas.style.opacity = stageOpacity.toFixed(3);

      const Wh = width / 2;
      const L = calculateLogoSize(height);
      const La = calculateAlignLogoSize(height);
      const { align, welcome } = WELCOME_CONFIG;

      // ───────────────────────────────────────────────────────────────────────
      // 1. FRAME 2: RESONANCE (0.50s -> 1.95s)
      // ───────────────────────────────────────────────────────────────────────
      const isResonance = t >= 0.5 && t < 1.95;
      if (isResonance) {
        if (resonancePass) {
          resonancePass.render(t, width, height);
        }
        return;
      }

      silkMeshLeftR1.visible = false;
      silkMeshRightR1.visible = false;
      silkMeshLeftR2.visible = false;
      silkMeshRightR2.visible = false;
      silkMeshLeftS1.visible = false;
      silkMeshRightS1.visible = false;
      silkMeshLeftS2.visible = false;
      silkMeshRightS2.visible = false;
      silkMeshLeftS3.visible = false;
      silkMeshRightS3.visible = false;
      silkMeshLeftVUp.visible = false;
      silkMeshRightVUp.visible = false;
      silkMeshLeftVDown.visible = false;
      silkMeshRightVDown.visible = false;
      flareMesh.visible = false;

      // ───────────────────────────────────────────────────────────────────────
      // 2. FRAME 4: ALIGN (2.50s -> 4.00s) & FRAME 5: WELCOME (4.00s -> 6.10s)
      // ───────────────────────────────────────────────────────────────────────
      const isAlignOrWelcome = t >= 2.48;
      if (isAlignOrWelcome) {
        // Logo Glide: 4.0 -> 4.9s from (0, 0) to (0, targetGlideY)
        const targetGlideCssY = height * FINAL_LAYOUT.logoCenter;
        const initialCssY = height / 2;
        let logoOffsetCssY = 0;
        if (t >= welcome.logoGlideStart) {
          const pGlide = Math.min(
            1.0,
            (t - welcome.logoGlideStart) /
              (welcome.logoGlideEnd - welcome.logoGlideStart)
          );
          logoOffsetCssY =
            (targetGlideCssY - initialCssY) * easeOutCubic(pGlide);
        }

        // Flank Glows (bloom 2.70 -> 3.15s, fade out by 4.30s)
        let flankAlpha = 0;
        if (t >= align.logoBloomStart && t < welcome.textFadeEnd) {
          if (t < align.logoBloomEnd) {
            const tauBloom = t - align.logoBloomStart;
            flankAlpha =
              align.flankGlow.alpha * calcSpringVal(tauBloom, 14.0, 0.55);
          } else if (t < welcome.start) {
            flankAlpha = align.flankGlow.alpha;
          } else {
            flankAlpha =
              align.flankGlow.alpha *
              Math.max(0, 1.0 - (t - welcome.start) / 0.3);
          }
        }
        setUniform(flankMatLeft, "uAlpha", flankAlpha * 0.68); // Left gap pool balance (~36.8 lum)
        setUniform(flankMatRight, "uAlpha", flankAlpha * 0.41); // Amber gap pool balance (~35.0 lum)
        setUniform(flankMatLeft, "uRadiusRatio", (0.7 * La) / (1.25 * La));
        setUniform(flankMatRight, "uRadiusRatio", (0.7 * La) / (1.25 * La));
        flankMeshLeft.position.set(-0.55 * La, -logoOffsetCssY, -5);
        flankMeshRight.position.set(0.55 * La, -logoOffsetCssY, -5);
        flankMeshLeft.scale.set(2.5 * La, 2.5 * La, 1);
        flankMeshRight.scale.set(2.5 * La, 2.5 * La, 1);
        const showFlank = getLayerVisibility("flank glows");
        flankMeshLeft.visible = flankAlpha > 0.01 && showFlank;
        flankMeshRight.visible = flankAlpha > 0.01 && showFlank;

        // Logo Light: Rim (Frame 4 ALIGN) & Halo + Pools (Frame 5 WELCOME)
        let logoRimAlpha = 0;
        let haloAlpha = 0;
        let poolAlpha = 0;
        let rimAlpha = 0;
        let rimQuadSize = 1.5 * La;

        if (t >= align.logoBloomStart && t < welcome.start) {
          logoRimAlpha = 1.0;
        } else if (t >= welcome.start) {
          logoRimAlpha = 1.0;
          const pHaloIn = Math.min(
            1.0,
            Math.max(0.0, (t - welcome.start) / 0.8)
          );
          rimQuadSize = (1.5 + 1.7 * pHaloIn) * La;
          haloAlpha = pHaloIn * (1.0 + 0.04 * Math.sin(t * 1.0));
          poolAlpha = Math.min(
            1.0,
            Math.max(0.0, (t - (welcome.start + 0.2)) / 0.8)
          );
          rimAlpha = 1.0;
        }

        setUniform(logoRimMat, "uAlpha", logoRimAlpha);
        setUniform(logoRimMat, "uHaloAlpha", haloAlpha);
        setUniform(logoRimMat, "uPoolAlpha", poolAlpha);
        setUniform(logoRimMat, "uRimAlpha", rimAlpha);
        setUniform(logoRimMat, "uLa", t >= welcome.start ? L : La);
        setUniform(logoRimMat, "uQuadSize", rimQuadSize);
        logoRimMesh.position.set(0, -logoOffsetCssY, -4);
        logoRimMesh.scale.set(rimQuadSize, rimQuadSize, 1);
        const showLogoRim = getLayerVisibility("logo rim");
        logoRimMesh.visible =
          (logoRimAlpha > 0.01 || haloAlpha > 0.01) && showLogoRim;

        // Front Glass Panels & Rear Cards: 2.55s -> 4.75s
        if (t >= align.knotOpenStart && t < welcome.panelsRetractEnd) {
          const showPanels = getLayerVisibility("panels");
          const showRearCards = getLayerVisibility("rear cards");

          // Spring morph into panel: 2.55 -> 3.00s
          const tauPanel = Math.max(0, t - align.knotOpenStart);
          const pPanelIn = calcSpringVal(tauPanel, 13.0, 0.5);

          // Retract spring: 4.00 -> 4.75s
          let pRetract = 0;
          if (t >= welcome.panelsRetractStart) {
            const tauRetract = t - welcome.panelsRetractStart;
            pRetract = calcSpringVal(tauRetract, 9.0, 0.5);
          }

          const sGrow = pPanelIn * (1.0 - 0.75 * pRetract);

          // Alpha fadeout: rims 4.0 -> 4.3s, fill 4.3 -> 4.6s
          let fillA = 0.74;
          let rimA = 1.0;
          if (t >= welcome.start) {
            rimA = Math.max(0, 1.0 - (t - welcome.start) / 0.3);
            if (t >= welcome.rimFadeEnd) {
              fillA = 0.74 * Math.max(0, 1.0 - (t - welcome.rimFadeEnd) / 0.3);
            }
          }

          const sheenProg = (t - 3.0) / 0.5;

          // Helper to set perspective quad geometry and shader uniforms
          const applyQuad = (
            geom: THREE.BufferGeometry,
            mat: THREE.ShaderMaterial,
            mesh: THREE.Mesh,
            sideSign: number, // -1 for left, +1 for right
            kRear: number, // 0 for front, 1 for rear1, 2 for rear2
            zPos: number,
            visible: boolean
          ) => {
            // Base panel parameters:
            // inner: x = 0.74*La, height = 1.45*La (y in [-0.725, +0.725]*La)
            // outer: x = 2.26*La, height = 1.75*La (y in [-0.875, +0.875]*La)
            const xInBase = (0.74 + 0.14 * kRear) * La;
            const xOutBase = (2.26 + 0.14 * kRear) * La;
            const yInTopBase = (0.725 + 0.12 * kRear) * La;
            const yInBotBase = (-0.725 - 0.04 * kRear) * La;
            const yOutTopBase = (0.875 + 0.12 * kRear) * La;
            const yOutBotBase = (-0.875 - 0.04 * kRear) * La;

            const xIn = sideSign * xInBase * sGrow;
            const xOut = sideSign * xOutBase * sGrow;
            const yInT = yInTopBase * sGrow - logoOffsetCssY;
            const yInB = yInBotBase * sGrow - logoOffsetCssY;
            const yOutT = yOutTopBase * sGrow - logoOffsetCssY;
            const yOutB = yOutBotBase * sGrow - logoOffsetCssY;

            let p0: { x: number; y: number }; // top-outer
            let p1: { x: number; y: number }; // top-inner
            let p2: { x: number; y: number }; // bot-inner
            let p3: { x: number; y: number }; // bot-outer

            if (sideSign < 0) {
              p0 = { x: xOut, y: yOutT };
              p1 = { x: xIn, y: yInT };
              p2 = { x: xIn, y: yInB };
              p3 = { x: xOut, y: yOutB };
            } else {
              p0 = { x: xIn, y: yInT };
              p1 = { x: xOut, y: yOutT };
              p2 = { x: xOut, y: yOutB };
              p3 = { x: xIn, y: yInB };
            }

            updateQuadGeometry(geom, p0, p1, p2, p3, zPos);

            setUniform(mat, "uTime", t);
            const baseFill = kRear === 2 ? 0.06 : kRear === 1 ? 0.1 : 0.74;
            const baseRim = kRear === 2 ? 0.24 : kRear === 1 ? 0.35 : 1.0;
            setUniform(mat, "uBaseAlpha", fillA * (baseFill / 0.74));
            setUniform(mat, "uRimAlpha", rimA * baseRim);
            setUniform(mat, "uSheenProgress", sheenProg);
            setUniform(mat, "uCornerRadius", 0.14 * La * sGrow);
            setUniform(mat, "uLa", La);
            const bounds = mat.uniforms.uQuadBounds;
            if (bounds && bounds.value instanceof THREE.Vector4) {
              bounds.value.set(xIn, xOut, yInT, yOutT);
            }
            mesh.visible = fillA > 0.01 && visible;

            return { p0, p1, p2, p3 };
          };

          // Update left panels
          const leftFrontPts = applyQuad(
            geomLeftFront,
            glassMatLeftFront,
            glassMeshLeftFront,
            -1,
            0,
            0,
            showPanels
          );
          applyQuad(
            geomLeftRear1,
            glassMatLeftRear1,
            glassMeshLeftRear1,
            -1,
            1,
            -10,
            showRearCards
          );
          applyQuad(
            geomLeftRear2,
            glassMatLeftRear2,
            glassMeshLeftRear2,
            -1,
            2,
            -15,
            showRearCards
          );

          // Update right panels
          const rightFrontPts = applyQuad(
            geomRightFront,
            glassMatRightFront,
            glassMeshRightFront,
            1,
            0,
            0,
            showPanels
          );
          applyQuad(
            geomRightRear1,
            glassMatRightRear1,
            glassMeshRightRear1,
            1,
            1,
            -10,
            showRearCards
          );
          applyQuad(
            geomRightRear2,
            glassMatRightRear2,
            glassMeshRightRear2,
            1,
            2,
            -15,
            showRearCards
          );

          // ── PROJECT FRONT PANEL CORNERS FOR DOM TEXT HOMOGRAPHY ──
          if (onProjectedQuadsRef.current) {
            const toScreen = (pt: { x: number; y: number }) => ({
              x: Wh + pt.x,
              y: height * 0.5 - pt.y,
            });

            onProjectedQuadsRef.current({
              leftFrontQuad: {
                pTopOuter: toScreen(leftFrontPts.p0),
                pTopInner: toScreen(leftFrontPts.p1),
                pBotInner: toScreen(leftFrontPts.p2),
                pBotOuter: toScreen(leftFrontPts.p3),
              },
              rightFrontQuad: {
                pTopInner: toScreen(rightFrontPts.p0),
                pTopOuter: toScreen(rightFrontPts.p1),
                pBotOuter: toScreen(rightFrontPts.p2),
                pBotInner: toScreen(rightFrontPts.p3),
              },
            });
          }
        } else {
          glassMeshLeftFront.visible = false;
          glassMeshLeftRear1.visible = false;
          glassMeshLeftRear2.visible = false;
          glassMeshRightFront.visible = false;
          glassMeshRightRear1.visible = false;
          glassMeshRightRear2.visible = false;
        }

        // ── SILK HORNS (ALIGN) & SILK WINGS (WELCOME) ───────────────────────
        let morphFactor = 0.0;
        let morphShading = 0.0;
        if (t >= welcome.hornsRelaxStart) {
          const tauWing = t - welcome.hornsRelaxStart;
          morphFactor = calcSpringVal(tauWing, 7.0, 0.7);
          const uNorm = Math.min(
            1.0,
            Math.max(
              0.0,
              (t - welcome.hornsRelaxStart) /
                (welcome.hornsRelaxEnd - welcome.hornsRelaxStart)
            )
          );
          morphShading =
            uNorm * uNorm * uNorm * (uNorm * (uNorm * 6.0 - 15.0) + 10.0);
        }

        const hornConfig = align.horns;

        // Exact PCHIP Half-Height points for the 3 nested horns
        const hornPchipProfiles = [
          // Horn 1 (inner): (0.50, 0.24) (0.75, 0.34) (1.0, 0.44) (1.6, 0.66) (2.26, 0.92)*La, 0.28*H at Wh
          [
            new THREE.Vector2(0.5 * La, 0.24 * La),
            new THREE.Vector2(0.75 * La, 0.34 * La),
            new THREE.Vector2(1.0 * La, 0.44 * La),
            new THREE.Vector2(1.6 * La, 0.66 * La),
            new THREE.Vector2(2.26 * La, 0.92 * La),
            new THREE.Vector2(Wh, 0.28 * height),
          ],
          // Horn 2 (mid): (0.50, 0.38) (0.75, 0.52) (1.0, 0.64) (1.6, 0.90) (2.26, 1.15)*La, 0.37*H at Wh
          [
            new THREE.Vector2(0.5 * La, 0.38 * La),
            new THREE.Vector2(0.75 * La, 0.52 * La),
            new THREE.Vector2(1.0 * La, 0.64 * La),
            new THREE.Vector2(1.6 * La, 0.9 * La),
            new THREE.Vector2(2.26 * La, 1.15 * La),
            new THREE.Vector2(Wh, 0.37 * height),
          ],
          // Horn 3 (outer): (0.50, 0.50) (0.75, 0.66) (1.0, 0.80) (1.6, 1.08) (2.26, 1.42)*La, 0.47*H at Wh
          [
            new THREE.Vector2(0.5 * La, 0.5 * La),
            new THREE.Vector2(0.75 * La, 0.66 * La),
            new THREE.Vector2(1.0 * La, 0.8 * La),
            new THREE.Vector2(1.6 * La, 1.08 * La),
            new THREE.Vector2(2.26 * La, 1.42 * La),
            new THREE.Vector2(Wh, 0.47 * height),
          ],
        ];

        for (let i = 0; i < 3; i++) {
          const stagger = i * hornConfig.staggerSec;
          const tauHorn = Math.max(0, t - hornConfig.morphStart - stagger);
          const pHornIn = calcSpringVal(
            tauHorn,
            hornConfig.omega0,
            hornConfig.zeta
          );

          const zOffset = i === 2 ? -60 : i === 1 ? -40 : -20;
          const rearBellZ = i === 2 ? -0.2 : i === 1 ? -0.1 : 0.0;
          const pchipPts = hornPchipProfiles[i]!;

          const updateHornWing = (
            mesh: THREE.Mesh,
            mat: THREE.ShaderMaterial
          ) => {
            setUniform(mat, "uTime", t);
            setUniform(mat, "uWh", Wh);
            setUniform(mat, "uHeight", height);
            setUniform(mat, "uL", L);
            setUniform(mat, "uLa", La);
            const logoC = mat.uniforms.uLogoCenter;
            if (logoC && logoC.value instanceof THREE.Vector2) {
              logoC.value.set(0, logoOffsetCssY);
            }
            setUniform(mat, "uMode", 1.0);
            setUniform(mat, "uMorph", morphFactor);
            setUniform(mat, "uMorphShading", morphShading);
            setUniform(mat, "uSheetIndex", i);
            setUniform(mat, "uHornPoints", pchipPts);
            setUniform(mat, "uRearBellZWh", rearBellZ);
            setUniform(mat, "uZOffset", zOffset);
            setUniform(mat, "uAlphaBase", pHornIn);
            setUniform(mat, "uWingCutoffL", WING_CUTOFF_Y_L);
            const showActiveHornWing =
              t >= welcome.start
                ? getLayerVisibility("wings")
                : getLayerVisibility("horns");
            mesh.visible = pHornIn > 0.005 && showActiveHornWing;
          };

          updateHornWing(hornMeshesLeft[i]!, hornMatsLeft[i]!);
          updateHornWing(hornMeshesRight[i]!, hornMatsRight[i]!);
        }
      }

      // Render through post processing pipeline or direct renderer
      if (postPipeline) {
        setUniform(
          postPipeline.dofPass.material as THREE.ShaderMaterial,
          "uTime",
          t
        );
        postPipeline.composer.render();
      } else {
        renderer.render(scene, camera);
      }
    };

    const unbind = registerFrameCallback(onFrame);

    // ── CLEANUP ─────────────────────────────────────────────────────────────
    return () => {
      unbind();
      ro.disconnect();
      window.removeEventListener("resize", onResize);

      if (postPipeline) {
        postPipeline.dispose();
      }
      silkGeom.dispose();
      flareGeom.dispose();
      geomLeftFront.dispose();
      geomLeftRear1.dispose();
      geomLeftRear2.dispose();
      geomRightFront.dispose();
      geomRightRear1.dispose();
      geomRightRear2.dispose();
      silkMatLeftR1.dispose();
      silkMatLeftR2.dispose();
      silkMatLeftS1.dispose();
      silkMatLeftS2.dispose();
      silkMatLeftS3.dispose();
      silkMatLeftVUp.dispose();
      silkMatLeftVDown.dispose();

      silkMatRightR1.dispose();
      silkMatRightR2.dispose();
      silkMatRightS1.dispose();
      silkMatRightS2.dispose();
      silkMatRightS3.dispose();
      silkMatRightVUp.dispose();
      silkMatRightVDown.dispose();
      flareMat.dispose();
      flankMatLeft.dispose();
      flankMatRight.dispose();
      logoRimMat.dispose();
      glassMatLeftFront.dispose();
      glassMatLeftRear1.dispose();
      glassMatLeftRear2.dispose();
      glassMatRightFront.dispose();
      glassMatRightRear1.dispose();
      glassMatRightRear2.dispose();
      for (const m of hornMatsLeft) {
        m.dispose();
      }
      for (const m of hornMatsRight) {
        m.dispose();
      }
      resonancePass?.dispose();
      renderer.dispose();
    };
  }, [reducedMotion, registerFrameCallback, tier]);

  return (
    <canvas
      className="absolute inset-0 pointer-events-none"
      ref={canvasRef}
      style={{
        zIndex: 12,
        contain: "strict",
      }}
    />
  );
}
