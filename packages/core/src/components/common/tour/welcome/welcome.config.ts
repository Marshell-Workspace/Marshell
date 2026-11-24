/**
 * welcome.config.ts — Parameterized Specification for Marshell Cinematic Intro (Revision 3).
 *
 * Source of Truth: 6-frame Storyboard with High-Resolution Crops.
 *
 * THE BIG IDEA: ONE OBJECT PER SIDE THAT KEEPS CHANGING SHAPE
 * - Frame 2 (RESONANCE): pinched soft SILK RIBBON, narrow at point, wider outward.
 * - Frame 3 (UNFOLD): snaps open into FAN OF FOUR GLASS BLADES per side (bow-tie).
 * - Frame 4 (ALIGN): knot opens, logo blooms into gap (size 1.2*L).
 *   S1 relaxes into tilted text panel; S2-S4 curve into big SILK HORNS flaring off screen corners.
 * - Frame 5 (WELCOME): logo glides to 0.26*H, S1 retracts into logo, horns relax into two soft WINGS.
 *
 * UNITS:
 * Content area W x H. Center C = (W/2, H/2). Half-width Wh = W/2.
 * L = clamp(150px, 0.20*H, 240px) is logo tile edge in final state.
 * La = 1.2*L is logo size during ALIGN.
 * Right side lags 40ms and is ~8% dimmer.
 */

// ── 1. Dynamic Scaling Relative to Logo Tile Edge L & La ──────────────────────

export function calculateLogoSize(contentHeight: number): number {
  return Math.max(150, Math.min(240, contentHeight * 0.2));
}

export function calculateAlignLogoSize(contentHeight: number): number {
  return calculateLogoSize(contentHeight) * 1.2;
}

export function calculateButtonHeight(contentHeight: number): number {
  return Math.max(52, Math.min(80, contentHeight * 0.075));
}

export function calculateFooterFontSize(contentHeight: number): number {
  return Math.max(13, Math.min(18, contentHeight * 0.016));
}

// ── 2. Final Layout Vertical Centering & Proportions (Storyboard Frame 5) ────

export const FINAL_LAYOUT = {
  /** Vertical center of each element as an exact fraction of content height H */
  logoCenter: 0.26,
  welcomeCenter: 0.45,
  marshellCenter: 0.54,
  buttonCenter: 0.67,
  skipCenter: 0.75,
  footerCenter: 0.95,

  /** Proportions relative to L */
  welcomeWidthRatio: 2.0,
  welcomeCapHeightRatio: 0.5,
  marshellWidthRatio: 2.3,
  marshellTracking: "0.70em",
  marshellCapHeightRatio: 0.11,
  buttonWidthRatio: 1.25, // 240 to 280px at 1080p, min 200px
} as const;

// ── 3. Phase Timeline (in Seconds) ───────────────────────────────────────────

export const WELCOME_CONFIG = {
  timeScale: 1.0,

  rightSideLagSec: 0.04, // 40ms lag for natural asymmetry
  rightSideBrightness: 0.92, // 8% dimmer
  rightSidePhaseOffset: 0.15, // +0.15 rad phase offset

  void: {
    start: 0.0,
    singularityFadeIn: 0.1,
    singularityFadeEnd: 0.45,
    crosshairStart: 0.15,
    crosshairPeak: 0.45,
    crosshairEnd: 0.7,
    gapRatio: 0.05, // 0.05*H from point
    lengthRatio: 0.27, // 0.27*H length
    alpha: 0.25, // 25% white
  },

  resonance: {
    start: 0.62,
    end: 1.95,
    flareRevealStart: 0.62,
    flareRevealEnd: 0.78,
    flareScaleStart: 0.6,
    flareScaleEnd: 1.0,
    flareOvershoot: 1.06,
    crosshairFadeEnd: 1.0,
    silkUnfurlStart: 0.7,
    silkUnfurlEnd: 1.3,
    wavefrontExpansionDuration: 0.6,
    featherWh: 0.12,
    veilFadeStart: 0.9,
    veilFadeEnd: 1.4,
    settledStart: 1.3,
    settledEnd: 1.5,
    inhaleStart: 1.5,
    inhaleEnd: 1.6,
    fadeStart: 1.6,

    R1: {
      centerline: [
        { u: 0.0, yH: 0.0 },
        { u: 0.1, yH: -0.0028 },
        { u: 0.2, yH: -0.0223 },
        { u: 0.3, yH: -0.028 },
        { u: 0.44, yH: -0.068 },
        { u: 0.55, yH: -0.02 },
        { u: 0.68, yH: 0.0307 },
        { u: 0.8, yH: 0.0782 },
        { u: 0.9, yH: 0.1006 },
        { u: 1.0, yH: 0.1061 },
        { u: 1.15, yH: 0.108 },
      ],
      halfWidth: [
        { u: 0.0, wH: 0.0 },
        { u: 0.1, wH: 0.004 },
        { u: 0.25, wH: 0.016 },
        { u: 0.44, wH: 0.028 },
        { u: 0.68, wH: 0.01 },
        { u: 0.9, wH: 0.022 },
        { u: 1.15, wH: 0.018 },
      ],
      alpha: 0.1,
      phase: 0.0,
      twistPinchU: 0.68,
      twistCrestU: 0.44,
    },
    R2: {
      crestU: 0.4,
      crestYH: -0.05,
      widthScale: 0.75,
      phase: 0.3,
      alpha: 0.08,
      uOffset: 0.02,
    },
    siblings: [
      {
        id: "S1",
        ampScale: 0.85,
        uOffset: -0.18,
        halfWidthScale: 0.7,
        alpha: 0.07,
        phase: -0.18,
      },
      {
        id: "S2",
        ampScale: 0.75,
        uOffset: 0.12,
        halfWidthScale: 0.6,
        alpha: 0.06,
        phase: 0.12,
      },
      {
        id: "S3",
        ampScale: 0.6,
        uOffset: 0.22,
        halfWidthScale: 0.5,
        alpha: 0.05,
        phase: 0.22,
      },
    ],
    V_up: {
      centerline: [
        { u: 0.0, yH: 0.0 },
        { u: 0.2, yH: -0.045 },
        { u: 0.4, yH: -0.13 },
        { u: 0.62, yH: -0.22 },
        { u: 0.8, yH: -0.24 },
        { u: 1.0, yH: -0.21 },
        { u: 1.15, yH: -0.19 },
      ],
      halfWidth: [
        { u: 0.0, wH: 0.0 },
        { u: 0.4, wH: 0.04 },
        { u: 0.7, wH: 0.075 },
        { u: 1.0, wH: 0.09 },
        { u: 1.15, wH: 0.095 },
      ],
      alpha: 0.04,
    },
    V_down: {
      centerline: [
        { u: 0.0, yH: 0.0 },
        { u: 0.25, yH: 0.04 },
        { u: 0.5, yH: 0.1 },
        { u: 0.75, yH: 0.16 },
        { u: 1.0, yH: 0.17 },
        { u: 1.15, yH: 0.18 },
      ],
      halfWidth: [
        { u: 0.0, wH: 0.0 },
        { u: 0.4, wH: 0.035 },
        { u: 0.7, wH: 0.05 },
        { u: 1.0, wH: 0.06 },
        { u: 1.15, wH: 0.06 },
      ],
      alpha: 0.035,
    },

    crestSwayAmpH: 0.008,
    crestSwayFreqHz: 0.2,
    breatheAmpRatio: 0.06,
    twistDriftDeg: 12.0,

    flare: {
      coreRadiusH: 0.006,
      innerHaloRadiusWh: 0.08,
      innerHaloAlpha: 0.6,
      ellipseRxWh: 0.38,
      ellipseRyH: 0.16,
      ellipseAlpha: 0.22,
      streakLenH: 0.3,
      streakAlpha: 0.2,
    },

    colors: {
      blue: {
        core: "#FFF8EE",
        light: "#9CC7FF",
        mid: "#3B82F6",
        deep: "#1E3A8A",
      },
      amber: {
        core: "#F4F6FA",
        light: "#EEF1F7",
        mid: "#DDE3EE",
        deep: "#5C6475",
      },
    },
  },

  unfold: {
    start: 1.6,
    end: 2.7,
    inhaleStart: 1.5,
    inhaleEnd: 1.6,
    inhaleScale: 0.75,
    inhaleBrightnessBoost: 1.2,
    releaseFlashDuration: 0.12,
    sheenStart: 1.9,
    sheenEnd: 2.4,
    sheenDuration: 0.5,
    sheenAlpha: 0.18,
    holdStart: 2.4,
    holdEnd: 2.7,
    holdBreatheRatio: 0.015,
    r1StayAlpha: 0.25,
    blades: [
      {
        id: "S1",
        xOutWh: 0.6,
        tanA: 0.43,
        rootAlpha: 0.65,
        tipAlpha: 0.14,
        rimAlpha: 0.9,
        delaySec: 0.0,
        outerLeanH: 0.05,
        bowH: 0.015,
        omega0: 15.0,
        zeta: 0.4,
      },
      {
        id: "S2",
        xOutWh: 0.72,
        tanA: 0.44,
        rootAlpha: 0.45,
        tipAlpha: 0.1,
        rimAlpha: 0.6,
        delaySec: 0.06,
        outerLeanH: -0.05,
        bowH: 0.02,
        omega0: 14.1,
        zeta: 0.42,
      },
      {
        id: "S3",
        xOutWh: 0.83,
        tanA: 0.45,
        rootAlpha: 0.35,
        tipAlpha: 0.08,
        rimAlpha: 0.45,
        delaySec: 0.12,
        outerLeanH: 0.07,
        bowH: 0.025,
        omega0: 13.3,
        zeta: 0.44,
      },
      {
        id: "S4",
        xOutWh: 0.93,
        tanA: 0.47,
        rootAlpha: 0.28,
        tipAlpha: 0.06,
        rimAlpha: 0.35,
        delaySec: 0.18,
        outerLeanH: -0.07,
        bowH: 0.03,
        omega0: 12.5,
        zeta: 0.46,
      },
    ] as const,
    needleInflate: {
      delaySec: 0.07,
      omega0: 11.0,
      zeta: 0.45,
    },
  },

  // Traced corners and configuration for Storyboard Frame 3 (UNFOLD, Revision 7)
  unfoldCorners: {
    left: [
      {
        id: "L1_front",
        depthOrder: 1,
        top: { x: 0.709, y: -0.238 },
        bottom: { x: 0.705, y: 0.229 },
        springOmega: 15.0,
        springZeta: 0.42,
        launchDelaySec: 0.0,
        hasWindow: true,
        windowSpec: {
          xStartWh: 0.22,
          xEndWh: 0.67,
          widthWh: 0.45,
          yCenterH: -0.015,
          heightH: 0.29,
          keystoneInnerRatio: 0.8,
          barsCount: 7,
          barWidthRatios: [0.78, 0.52, 0.66, 0.38, 0.72, 0.45, 0.3] as const,
        },
      },
      {
        id: "L2_tallest",
        depthOrder: 2,
        top: { x: 0.865, y: -0.37 },
        bottom: { x: 0.82, y: 0.372 },
        springOmega: 14.1,
        springZeta: 0.42,
        launchDelaySec: 0.06,
        hasWindow: false,
      },
      {
        id: "L3_outermost",
        depthOrder: 3,
        top: { x: 0.963, y: -0.229 },
        bottom: { x: 0.817, y: 0.372 },
        springOmega: 13.3,
        springZeta: 0.42,
        launchDelaySec: 0.12,
        hasWindow: false,
      },
      {
        id: "L4_rear",
        depthOrder: 4,
        top: { x: 0.76, y: -0.175 },
        bottom: { x: 0.72, y: 0.41 },
        springOmega: 12.5,
        springZeta: 0.42,
        launchDelaySec: 0.18,
        hasWindow: false,
      },
    ],
    right: [
      {
        id: "R1_front",
        depthOrder: 1,
        top: { x: 0.736, y: -0.178 },
        bottom: { x: 0.705, y: 0.192 },
        springOmega: 15.0,
        springZeta: 0.42,
        launchDelaySec: 0.0,
        hasWindow: false,
      },
      {
        id: "R2_tallest",
        depthOrder: 2,
        top: { x: 0.88, y: -0.341 },
        bottom: { x: 0.835, y: 0.289 },
        springOmega: 14.1,
        springZeta: 0.42,
        launchDelaySec: 0.06,
        hasWindow: true,
        windowSpec: {
          xStartWh: 0.58,
          xEndWh: 0.84,
          widthWh: 0.26,
          yCenterH: -0.02,
          heightH: 0.31,
          keystoneInnerRatio: 0.8,
          barsCount: 5,
          barWidthRatios: [0.7, 0.46, 0.62, 0.36, 0.52] as const,
        },
      },
      {
        id: "R3_outermost",
        depthOrder: 3,
        top: { x: 0.99, y: -0.238 },
        bottom: { x: 0.95, y: 0.321 },
        springOmega: 13.3,
        springZeta: 0.42,
        launchDelaySec: 0.12,
        hasWindow: false,
      },
      {
        id: "R4_rear",
        depthOrder: 4,
        top: { x: 0.817, y: -0.201 },
        bottom: { x: 0.748, y: 0.335 },
        springOmega: 12.5,
        springZeta: 0.42,
        launchDelaySec: 0.18,
        hasWindow: false,
      },
    ],
  },

  align: {
    start: 2.7,
    end: 4.0,
    knotOpenStart: 2.55,
    knotOpenEnd: 2.85,
    logoBloomStart: 2.7,
    logoBloomEnd: 3.15,
    logoZeta: 0.55,
    logoPeakScale: 1.06,
    flankGlow: {
      xOffsetRatioLa: 0.55,
      radiusRatioLa: 0.7,
      alpha: 0.45,
    },
    panel: {
      xInnerLa: 0.74,
      xOuterLa: 2.26,
      yInnerTopLa: -0.725, // inner edge height = 1.45 La
      yInnerBotLa: 0.725,
      yOuterTopLa: -0.875, // outer edge height = 1.75 La
      yOuterBotLa: 0.875,
      cornerRadiusLa: 0.14,
      bowLa: 0.0, // straight edges per Revision 5/9
      baseNavy: "rgba(8, 16, 36, 0.74)",
      baseAmber: "rgba(20, 22, 28, 0.74)",
      rearLayer1: {
        offsetOutLa: 0.14,
        offsetUpLa: 0.04,
        heightAddLa: 0.16,
        fillAlpha: 0.1,
        rimAlpha: 0.3,
      },
      rearLayer2: {
        offsetOutLa: 0.28,
        offsetUpLa: 0.08,
        heightAddLa: 0.32,
        fillAlpha: 0.06,
        rimAlpha: 0.18,
      },
      text: {
        fontSizeRatioLa: 0.095,
        lineHeightRatioLa: 0.2,
        leftInsetFarLa: 0.16,
        rightInsetNearLa: 0.3,
        typeStart: 2.95,
        typeEnd: 3.58,
        typeStagger: 0.09,
      },
    },
    horns: {
      morphStart: 2.6,
      morphEnd: 3.35,
      omega0: 10.0,
      zeta: 0.55,
      staggerSec: 0.05,
      xInLa: 0.45, // root xIn = 0.45*La (hidden behind logo)
      xOutWh: 1.12,
      hhProfiles: {
        horn3: [
          { x: 0.5, hh: 0.5 },
          { x: 0.75, hh: 0.66 },
          { x: 1.0, hh: 0.8 },
          { x: 1.6, hh: 1.08 },
          { x: 2.26, hh: 1.42 },
        ] as const,
        horn2: [
          { x: 0.5, hh: 0.38 },
          { x: 0.75, hh: 0.52 },
          { x: 1.0, hh: 0.64 },
          { x: 1.6, hh: 0.9 },
          { x: 2.26, hh: 1.15 },
        ] as const,
        horn1: [
          { x: 0.5, hh: 0.24 },
          { x: 0.75, hh: 0.34 },
          { x: 1.0, hh: 0.44 },
          { x: 1.6, hh: 0.66 },
          { x: 2.26, hh: 0.92 },
        ] as const,
      },
      hhRootLa: [0.24, 0.38, 0.5] as const,
      hhEdgeH: [0.28, 0.37, 0.47] as const,
      flareExponent: 1.6, // s^1.6 concave bell flare
      fillAlphaRoot: [0.22, 0.18, 0.14] as const,
      fillAlphaTip: [0.07, 0.07, 0.07] as const,
      rimAlpha: [0.7, 0.55, 0.45] as const,
      rimWidthPx: 1.25,
      rimBlue: "#8DBBFF",
      rimAmber: "#EEF1F7",
      K: 16,
      tw: 0.6,
      breatheRatio: 0.03,
      sRippleH: 0.015,
      rearBellZWh: -0.2, // rear bell z curvature
    },
    tracedTable: {
      W: 560,
      H: 488,
      C: { x: 299.5, y: 248.5 },
      La: 108,
      logoTileWidth: 101,
      logoTileHeight: 115,
      gapLeftLa: 0.185,
      sampledColors: {
        leftCenter: { rgb: [15, 30, 62], lum: 30.1 },
        leftLogoEdge: { rgb: [24, 60, 120], lum: 59.8 },
        leftFarEdge: { rgb: [10, 20, 44], lum: 21.0 },
        leftGapPool: { rgb: [23, 39, 55], lum: 36.8 },
        rightCenter: { rgb: [42, 26, 12], lum: 28.4 },
        rightLogoEdge: { rgb: [70, 40, 15], lum: 44.6 },
        rightFarEdge: { rgb: [24, 14, 8], lum: 15.7 },
        rightGapPool: { rgb: [43, 33, 31], lum: 35.0 },
        hornLeadingEdge: { rgb: [73, 110, 152], lum: 105.2 },
        hornFillMid: { rgb: [22, 51, 81], lum: 47.0 },
        logoRimSample: { rgb: [162, 169, 175], lum: 167.9 },
      },
    },
    skeletonFadeStart: 2.6,
    skeletonFadeEnd: 2.95,
    terminalStart: 2.95,
    terminalLineStagger: 0.09,
  },

  welcome: {
    start: 4.0,
    textFadeStart: 4.0,
    textFadeEnd: 4.3,
    logoGlideStart: 4.0,
    logoGlideEnd: 4.9,
    panelsRetractStart: 4.0,
    panelsRetractEnd: 4.75,
    rimFadeEnd: 4.3,
    fillFadeEnd: 4.6,
    hornsRelaxStart: 4.0,
    hornsRelaxEnd: 5.2,
    scriptWriteStart: 4.4,
    scriptWriteEnd: 5.8,
    cometTailLength: 90, // px
    wordmarkStart: 5.3,
    wordmarkEnd: 5.8,
    wordmarkLetterStagger: 0.04,
    actionsStart: 5.6,
    actionsEnd: 6.1,
    totalDuration: 6.1,
    wings: {
      cutoffYFromCenterL: 0.75,
      bandCount: 5,
      bandOffsetL: 0.06,
      foldStreaksK: 10,
      rimLowerAlpha: 0.65,
      rimUpperAlpha: 0.28,
      rearGlassLayers: 2,
      rearGlassThickMult: 1.7,
      rearGlassOffsetUpL: 0.08,
      rearGlassAlpha: 0.065,
      flutterAmpL: 0.015,
    },
  },

  ambient: {
    logoFloatAmplitude: 3.0, // px
    logoFloatPeriod: 6.0, // seconds
    glowBreathePeriod: 4.5,
    fpsLimit: 30,
  },
} as const;

// ── 4. Parameterized Sheet Model Specification (S1 to S4 per side) ──────────

export interface SheetDefinition {
  align: {
    flare: number;
    fillAlpha: number;
    hInRatio: number;
    hOutRatio: number;
    rimAlpha: number;
    springOmega: number;
    springZeta: number;
    staggerMs: number;
    xInRatio: number;
    xOutRatio: number;
  };
  id: string;
  index: number;
  unfold: {
    bowRatioH: number;
    fillAlphaRoot: number;
    fillAlphaTip: number;
    launchDelaySec: number;
    outerDistRatioWh: number;
    outerHeightRatioH: number;
    outerLeanH: number;
    rimAlpha: number;
    rippleAmpRatioH: number;
    springOmega: number;
    springZeta: number;
    tanA: number;
    yawOffsetRatioWh: number;
  };
}

export const SHEETS_SPEC: readonly SheetDefinition[] = [
  // S1: Front Blade in UNFOLD -> Tilted Trapezoid Panel in ALIGN
  {
    id: "S1",
    index: 0,
    unfold: {
      outerDistRatioWh: 0.6,
      outerHeightRatioH: 0.46,
      tanA: 0.43,
      fillAlphaRoot: 0.65,
      fillAlphaTip: 0.14,
      rimAlpha: 0.9,
      launchDelaySec: 0.0,
      outerLeanH: 0.05,
      bowRatioH: 0.015,
      yawOffsetRatioWh: 0.02,
      springOmega: 15.0,
      springZeta: 0.4,
      rippleAmpRatioH: 0.02,
    },
    align: {
      xInRatio: 0.85, // 0.85*La from C
      xOutRatio: 2.25, // 2.25*La from C
      hInRatio: 0.65, // full height 1.30*La
      hOutRatio: 0.925, // full height 1.85*La
      flare: 1.0, // linear trapezoid (~11 deg tilt)
      fillAlpha: 0.82,
      rimAlpha: 0.55,
      springOmega: 13.0,
      springZeta: 0.5,
      staggerMs: 0,
    },
  },
  // S2: 2nd Blade in UNFOLD -> Horn 1 in ALIGN
  {
    id: "S2",
    index: 1,
    unfold: {
      outerDistRatioWh: 0.72,
      outerHeightRatioH: 0.56,
      tanA: 0.44,
      fillAlphaRoot: 0.45,
      fillAlphaTip: 0.1,
      rimAlpha: 0.6,
      launchDelaySec: 0.06,
      outerLeanH: -0.05,
      bowRatioH: 0.02,
      yawOffsetRatioWh: -0.025,
      springOmega: 14.1,
      springZeta: 0.42,
      rippleAmpRatioH: 0.023,
    },
    align: {
      xInRatio: 0.45, // 0.45*La under logo per Revision 5
      xOutRatio: 1.12, // 1.12*Wh beyond screen edge
      hInRatio: 0.1, // 0.10*La
      hOutRatio: 0.22, // 0.22*H (full height 0.44*H)
      flare: 1.6, // concave bell flare s^1.6 per Revision 5
      fillAlpha: 0.12,
      rimAlpha: 0.55,
      springOmega: 10.0,
      springZeta: 0.55,
      staggerMs: 0,
    },
  },
  // S3: 3rd Blade in UNFOLD -> Horn 2 in ALIGN
  {
    id: "S3",
    index: 2,
    unfold: {
      outerDistRatioWh: 0.83,
      outerHeightRatioH: 0.67,
      tanA: 0.45,
      fillAlphaRoot: 0.35,
      fillAlphaTip: 0.08,
      rimAlpha: 0.45,
      launchDelaySec: 0.12,
      outerLeanH: 0.07,
      bowRatioH: 0.025,
      yawOffsetRatioWh: 0.03,
      springOmega: 13.3,
      springZeta: 0.44,
      rippleAmpRatioH: 0.027,
    },
    align: {
      xInRatio: 0.45,
      xOutRatio: 1.12,
      hInRatio: 0.13, // 0.13*La
      hOutRatio: 0.31, // 0.31*H (full height 0.62*H)
      flare: 1.6,
      fillAlpha: 0.09,
      rimAlpha: 0.4,
      springOmega: 9.5,
      springZeta: 0.55,
      staggerMs: 50,
    },
  },
  // S4: Back Blade in UNFOLD -> Horn 3 in ALIGN
  {
    id: "S4",
    index: 3,
    unfold: {
      outerDistRatioWh: 0.93,
      outerHeightRatioH: 0.77,
      tanA: 0.47,
      fillAlphaRoot: 0.28,
      fillAlphaTip: 0.06,
      rimAlpha: 0.35,
      launchDelaySec: 0.18,
      outerLeanH: -0.07,
      bowRatioH: 0.03,
      yawOffsetRatioWh: -0.03,
      springOmega: 12.5,
      springZeta: 0.46,
      rippleAmpRatioH: 0.03,
    },
    align: {
      xInRatio: 0.45,
      xOutRatio: 1.12,
      hInRatio: 0.16, // 0.16*La
      hOutRatio: 0.4, // 0.40*H (full height 0.80*H)
      flare: 1.6,
      fillAlpha: 0.06,
      rimAlpha: 0.3,
      springOmega: 9.0,
      springZeta: 0.55,
      staggerMs: 100,
    },
  },
] as const;

// ── 5. Wing Shape Control Points & Pose Presets (Frame 5 WELCOME) ───────────

export type WingPosePresetKey = "revision6" | "section9";

export interface WingPosePresetDefinition {
  centerline: readonly { x: number; y: number }[];
  cutoffYFromCenterL: number;
  description: string;
  name: string;
  thickness: readonly { hh: number; x: number }[];
  tipYFromCenterL: number;
  xStartL: number;
}

export const WING_POSE_PRESETS: Record<
  WingPosePresetKey,
  WingPosePresetDefinition
> = {
  // Pose A: Revision 6 Specification (tips at +0.55L, cutoff at +0.75L)
  revision6: {
    name: "Revision 6 Specification (Pose A)",
    description:
      "Tips at +0.55L, cutoff at +0.75L, matching Revision 6 prompt spec",
    tipYFromCenterL: 0.55,
    cutoffYFromCenterL: 0.75,
    xStartL: 0.55,
    centerline: [
      { x: 0.55, y: 0.55 },
      { x: 1.0, y: 0.46 },
      { x: 1.5, y: 0.24 },
      { x: 2.0, y: -0.02 },
      { x: 2.6, y: -0.24 },
      { x: 3.4, y: -0.4 },
      { x: 4.6, y: -0.5 },
    ],
    thickness: [
      { x: 0.55, hh: 0.0 },
      { x: 1.0, hh: 0.07 },
      { x: 1.5, hh: 0.14 },
      { x: 2.0, hh: 0.2 },
      { x: 2.6, hh: 0.25 },
      { x: 3.4, hh: 0.27 },
      { x: 4.6, hh: 0.22 },
    ],
  },
  // Pose B: Section 9 Tuned Specification (tips at +0.30L, cutoff at +0.45L)
  section9: {
    name: "Section 9 Tuned Specification (Pose B)",
    description:
      "Tips at +0.30L, cutoff at +0.45L, matching Revision 5 Section 9 starting curve",
    tipYFromCenterL: 0.3,
    cutoffYFromCenterL: 0.45,
    xStartL: 0.5,
    centerline: [
      { x: 0.5, y: 0.3 },
      { x: 1.0, y: 0.24 },
      { x: 1.5, y: 0.1 },
      { x: 2.0, y: -0.06 },
      { x: 2.6, y: -0.22 },
      { x: 3.4, y: -0.38 },
      { x: 4.6, y: -0.48 },
    ],
    thickness: [
      { x: 0.5, hh: 0.0 },
      { x: 1.0, hh: 0.07 },
      { x: 1.5, hh: 0.14 },
      { x: 2.0, hh: 0.2 },
      { x: 2.6, hh: 0.25 },
      { x: 3.4, hh: 0.27 },
      { x: 4.6, hh: 0.22 },
    ],
  },
} as const;

/**
 * SINGLE CONFIG SWITCH FOR WING POSE:
 * Choose "revision6" (Pose A, tips +0.55L, cutoff +0.75L) or "section9" (Pose B, tips +0.30L, cutoff +0.45L).
 */
export const ACTIVE_WING_POSE_PRESET: WingPosePresetKey = "revision6";

export const ACTIVE_WING_PRESET_CONFIG =
  WING_POSE_PRESETS[ACTIVE_WING_POSE_PRESET];

/** Centerline points (x, y) relative to logo center, in units of L (y is positive DOWN per Revision 5) */
export const WING_CENTERLINE_CONTROL_POINTS =
  ACTIVE_WING_PRESET_CONFIG.centerline;

/** Half-thickness control points (x, hh) relative to logo center, in units of L per Revision 5 */
export const WING_HALF_THICKNESS_CONTROL_POINTS =
  ACTIVE_WING_PRESET_CONFIG.thickness;

export const WING_CUTOFF_Y_L = ACTIVE_WING_PRESET_CONFIG.cutoffYFromCenterL;

// Backward-compatible alias
export const WING_CENTERLINE_POINTS = ACTIVE_WING_PRESET_CONFIG.centerline.map(
  (pt, i) => ({
    x: pt.x,
    y: pt.y,
    halfThickness: ACTIVE_WING_PRESET_CONFIG.thickness[i]?.hh ?? 0.0,
  })
);

export const UNFOLD_BLADE_CORNERS = WELCOME_CONFIG.unfoldCorners;

// ── 5b. Debug Layer Model (Revision 7) ───────────────────────────────────────

export const WELCOME_DEBUG_LAYERS = [
  "frame-3",
  "blades",
  "windows",
  "glow",
  "silk",
  "heroRibbons",
  "siblingRibbons",
  "veil",
  "centerGlow",
  "bloom",
  "horns",
  "horn body fill",
  "broad folds",
  "fine pleats",
  "leading edges",
  "wings",
  "panels",
  "panel frost",
  "rear cards",
  "flank glows",
  "logo rim",
  "text",
  "logo",
] as const;

export type WelcomeDebugLayer = (typeof WELCOME_DEBUG_LAYERS)[number];

export interface LayerVisibilityState {
  muted: Record<WelcomeDebugLayer, boolean>;
  solo: WelcomeDebugLayer | null;
}

export function createDefaultLayerState(): LayerVisibilityState {
  return {
    solo: null,
    muted: {
      "frame-3": false,
      blades: false,
      windows: false,
      glow: false,
      silk: false,
      heroRibbons: false,
      siblingRibbons: false,
      veil: false,
      centerGlow: false,
      bloom: false,
      horns: false,
      "horn body fill": false,
      "broad folds": false,
      "fine pleats": false,
      "leading edges": false,
      wings: false,
      panels: false,
      "panel frost": false,
      "rear cards": false,
      "flank glows": false,
      "logo rim": false,
      text: false,
      logo: false,
    },
  };
}

export function getLayerVisibility(layer: WelcomeDebugLayer): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  const state = (
    window as unknown as { __MARSHELL_LAYERS__?: LayerVisibilityState }
  ).__MARSHELL_LAYERS__;
  if (!state) {
    return true;
  }
  if (state.solo !== null) {
    return state.solo === layer;
  }
  return !state.muted[layer];
}

export function setLayerState(state: LayerVisibilityState) {
  if (typeof window === "undefined") {
    return;
  }
  const win = window as unknown as {
    __MARSHELL_LAYERS__?: LayerVisibilityState;
    __MARSHELL_LAYER_LISTENERS__?: Array<(s: LayerVisibilityState) => void>;
  };
  win.__MARSHELL_LAYERS__ = state;
  const listeners = win.__MARSHELL_LAYER_LISTENERS__;
  if (listeners) {
    for (const cb of listeners) {
      cb(state);
    }
  }
}

// ── 6. Design Tokens ─────────────────────────────────────────────────────────

export const DESIGN_TOKENS = {
  bg: "#05070D",
  glassNavyBase: "rgba(6, 12, 28, 0.30)",
  glassNavyPanel: "rgba(8, 16, 36, 0.82)",

  blue: {
    rootWhite: "#BFD8FF",
    core: "#3B82F6",
    deep: "#1E3A8A",
    light: "#7DB4FF",
    highlight: "#93C5FD",
    litRim: "#9CC7FF",
    panelBorderLit: "#9CC7FF",
    text: "#8FB8FF",
  },

  amber: {
    rootWhite: "#F4F6FA",
    core: "#DDE3EE",
    core2: "#8E97A8",
    deep: "#5C6475",
    light: "#EEF1F7",
    highlight: "#F4F6FA",
    litRim: "#EEF1F7",
    panelBorderLit: "#EEF1F7",
    text: "#EEF1F7",
  },

  singularity: {
    coreColor: "#FFFFFF",
    flareBlue: "rgba(59, 130, 246, 0.75)",
    flareAmber: "rgba(238, 241, 247, 0.75)",
  },
} as const;

// ── 7. Terminal Text Lines (ALIGN Phase) ──────────────────────────────────────

export const TERMINAL_LINES = {
  left: [
    "> init workspace",
    "> select agent --main",
    "> spawn agents (8)",
    "> sync context",
    "> plan tasks",
    "> execute",
    "> track changes",
  ],
  right: [
    "> analyze codebase",
    "> write changes",
    "> run tests",
    "> review",
    "> commit",
    "> rollback",
  ],
} as const;

// ── 8. UI Strings & Copy ─────────────────────────────────────────────────────

export const WELCOME_STRINGS = {
  appName: "MARSHELL",
  headline: "Welcome", // Strictly "Welcome", no name, no comma!
  ctaStart: "Start the tour →",
  ctaSkip: "Skip for now",
  footer: "About 2 minutes. Replay anytime in Settings → Tutorials.",
} as const;

// ── 9. Backwards-Compatibility Exports ───────────────────────────────────────

export const DESKTOP_LOGO_SIZE = 160;
export const DESKTOP_LOGO_RADIUS = 36;
export const MOBILE_LOGO_SIZE = 120;
export const MOBILE_LOGO_RADIUS = 28;
export const RASTER_SCALE = 3;
export const DESKTOP_RASTER_TILE_PX = DESKTOP_LOGO_SIZE * RASTER_SCALE;
export const MOBILE_RASTER_TILE_PX = MOBILE_LOGO_SIZE * RASTER_SCALE;

export const HANDOFF_DURATION_MS = 700;
export const HANDOFF_ON_START_DELAY_MS = 300;
export const EXIT_ON_START_DELAY_MS = 250;
export const EXIT_ZOOM_DURATION_SEC = 0.45;
export const FLIGHT_MS = 5400;
export const LANDING_SOFTNESS = 2.6;
export const SETTLE_SCALE = 1.018;
export const BLUR_MAX_PX = 14;
export const FLYBY_PEAK_Z = -0.7;
export const TURNS = 1.5;
export const REPLAY_TURNS = 1.0;
export const START_ANGLE_DEG = -40;
export const ORBIT_RADIUS = 1.0;
export const RADIUS_HOLD_U = 0.55;
export const REPLAY_SPEED_FACTOR = 0.625;
export const FAST_FORWARD_DURATION_SEC = 0.38;
export const PEN_LIGHT = true;
export type QualityTier = "auto" | "full" | "lite";

export const Z_KEYFRAMES = [
  { u: 0.0, z: -0.78 },
  { u: 0.2, z: 0.2 },
  { u: 0.42, z: 1.6 },
  { u: 0.62, z: 0.9 },
  { u: 0.72, z: FLYBY_PEAK_Z },
  { u: 0.86, z: -0.04 },
  { u: 1.0, z: 0.0 },
] as const;

export const TIME_WARP = {
  initialVelocityRatio: 0.15,
  cruiseStartU: 0.12,
  easeOutStartU: 0.65,
  easeOutPower: 2.2,
  peakVelocityRatio: 2.1,
  settleDeceleration: 3.4,
} as const;

export const WELCOME_TIMINGS = {
  totalTimelineMs: 4600,
  logoRiseStartMs: 300,
  logoRiseDurationMs: 650,
  powerOnStartMs: 950,
  powerOnDurationMs: 350,
  glyphGlowStartMs: 1300,
  glyphGlowDurationMs: 350,
  flightStartMs: 700,
  landingMs: 6100,
  greetingStartMs: 1650,
  greetingDurationMs: 1200,
  greetingReplayDurationMs: 750,
  wordmarkStartMs: 2500,
  wordmarkLetterStaggerMs: 40,
  wordmarkLetterDurationMs: 450,
  subtitleStartMs: 2950,
  subtitleDurationMs: 450,
  ctaStartMs: 3250,
  ctaDurationMs: 450,
  skipFooterStartMs: 3550,
  backdropFadeMs: 1000,
  landingSettleDurationMs: 500,
  shockwaveDurationMs: 900,
  liftToSlotStartMs: 6300,
  liftToSlotDurationMs: 900,
  reducedMotionTotalMs: 1200,
} as const;

export const ATMOSPHERE = {
  bgTopColor: "#05070D",
  bgBottomColor: "#05070D",
  dustParticleCount: { performance: 140, balanced: 50, eco: 24 } as Record<
    "performance" | "balanced" | "eco",
    number
  > & { [key: string]: number },
  bokehCount: 8,
  fogBlobCount: 3,
  fogDriftDurationRange: [40, 70] as const,
  grainOpacity: 0.015,
  vignetteStrength: 0.85,
  dollyStartScale: 1.0,
  dollyEndScale: 1.06,
  godRayCount: 5,
  particleSpeedMultiplier: 0.7,
} as const;

export const GOD_RAYS = {
  count: 5,
  rayCount: 12,
  rotationDurationSec: 120,
  baseOpacity: 0.06,
  peakOpacity: 0.18,
} as const;

export const ORBIT_TRAIL = {
  trailLength: 0.14,
  sampleCount: 40,
} as const;

export const EASINGS = {
  decel: [0.16, 1, 0.3, 1] as const,
  accel: "cubic-bezier(0.7, 0, 0.84, 0)",
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  ambientFloatDurationSec: 6.0,
} as const;

export const SPRINGS = {
  landingImpact: { stiffness: 420, damping: 26, mass: 0.9 },
  liftToSlot: { stiffness: 180, damping: 24, mass: 1.0 },
  idleBreatheDurationSec: 6.0,
  maxPointerTiltDeg: 7.0,
  tiltRampDurationMs: 1200,
} as const;

export const INTRO_TIMINGS = {
  totalDuration: 0.95,
  logo: {
    start: 2.7,
    duration: 1.3,
    delay: 0.2,
    yOffset: 36,
    initialScale: 0.8,
  },
  headline: {
    delay: 0.18,
    duration: 0.5,
    yOffset: 16,
  },
  subtextLine1: {
    delay: 0.32,
    duration: 0.4,
    yOffset: 12,
  },
  subtextLine2: {
    delay: 0.38,
    duration: 0.4,
    yOffset: 12,
  },
  primaryButton: {
    delay: 0.48,
    duration: 0.4,
    yOffset: 12,
  },
  secondaryButton: {
    delay: 0.55,
    duration: 0.35,
    yOffset: 10,
  },
  footer: {
    delay: 0.62,
    duration: 0.35,
    yOffset: 8,
  },
} as const;

export const RIBBON_CONFIG = {
  secondAmpRatio: 0.28,
  finalSweepUpRatio: 0.12,
  ampResonance: 0.085,
  ampUnfoldAlign: 0.14,
  ampFinal: 0.06,
} as const;

export const PANEL_CONFIG = {
  cornerRadiusRatio: 0.15,
  unfold: {
    bladeCount: 4,
    staggersMs: [0, 60, 120, 180] as const,
    stiffness: [140, 130, 120, 110] as const,
    damping: [13.5, 13.0, 12.5, 12.0] as const,
    outerDistances: [0.6, 0.72, 0.83, 0.93] as const,
    outerHeights: [0.46, 0.56, 0.67, 0.77] as const,
    innerEdgeHeightRatio: 0.045,
    sheenDuration: 0.5,
  },
  align: {
    widthRatio: 1.5,
    heightRatio: 1.5,
    innerGapRatio: 0.2,
    tiltDeg: 20,
    textPaddingRatio: 0.2,
    textFontSizeRatio: 0.09,
  },
} as const;

export type ScriptFontKey = "sacramento" | "yellowtail" | "damion";
export const ACTIVE_SCRIPT_FONT: ScriptFontKey = "sacramento";
export const GREETING_WEIGHT_BOOST = 1.15;

export const APP_NAME = WELCOME_STRINGS.appName;
export const LOGO_IMG_RATIO = 0.82;
export const LOGO_SIZE_PX = DESKTOP_LOGO_SIZE;
export const LOGO_IMG_PX = Math.round(DESKTOP_LOGO_SIZE * LOGO_IMG_RATIO);
export const LOGO_RADIUS_PX = DESKTOP_LOGO_RADIUS;

/** @deprecated Use BLUR_MAX_PX */
export const PEAK_SCALE = 4.5;
/** @deprecated Use TURNS */
export const SPIRAL_TURNS = TURNS;

export function sanitizeFirstName(rawName?: string | null): string {
  if (!rawName) {
    return "";
  }
  return rawName.trim().split(/\s+/)[0] || "";
}
