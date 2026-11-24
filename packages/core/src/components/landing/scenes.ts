import { asciiFlameClock, asciiFlameOffsets } from "./ascii-flame";
import {
  growthState,
  smoothProgress,
  TRANSITION_SECONDS,
  workstationTime,
} from "./ascii-timeline";
import {
  generateAvatarBodyPath,
  generateCrestTonguePaths,
  generatePurpleCorePath,
} from "./avatar-flame-geometry";
import { helicopter } from "./helicopter-scene";
import { typingPose, WORKSTATION } from "./workstation-geometry";
import { drawGrowthInstrument, drawLaptop } from "./workstation-instruments";

export type Ctx = CanvasRenderingContext2D;
export type SceneFn = (ctx: Ctx, time: number, ex: number, ey: number) => void;

type Point = readonly [number, number];

export function line(
  ctx: Ctx,
  a: Point,
  b: Point,
  width: number,
  color: string
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...b);
  ctx.stroke();
}

function ellipse(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function path(ctx: Ctx, d: string, color: string | CanvasGradient) {
  ctx.fillStyle = color;
  ctx.fill(new Path2D(d));
}

function limb(
  ctx: Ctx,
  points: readonly Point[],
  widths: readonly number[],
  color: string
) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) {
      line(ctx, a, b, widths[i - 1] ?? 5, color);
    }
  }
}

const SKIN = "#c8d0dd";
const LIGHT = "#dce5f2";
const SHADOW = "#66758d";
const PURPLE = "#68b3fe";

/** Human landmarks are fractions of total height, not unrelated pixel offsets. */
function standingBoy(ctx: Ctx, time: number, index: number) {
  const breath = Math.sin(time * 1.5 + index * 1.3) * 0.002;
  const sway = Math.sin(time * 0.65 + index * 1.7) * 0.003;
  ctx.save();
  ctx.translate(sway, 0);

  // Trousers: a connected pelvis, two tapered legs, and distinct shoes.
  path(
    ctx,
    "M -.086 .435 Q 0 .42 .086 .435 L .082 .56 L .058 .745 L .061 .967 L .005 .967 L -.008 .74 L -.025 .555 L -.035 .747 L -.048 .967 L -.105 .967 L -.092 .74 Z",
    "#8996aa"
  );
  path(
    ctx,
    "M .005 .56 L .014 .744 L .026 .958 L .055 .958 L .052 .744 L .069 .535 Z",
    "#aab6c8"
  );
  line(ctx, [-0.049, 0.55], [-0.061, 0.92], 0.004, "#556178");
  path(
    ctx,
    "M -.108 .955 L -.046 .955 L -.034 .983 Q -.033 1 -.057 1 L -.132 1 Q -.145 .988 -.125 .976 Z",
    LIGHT
  );
  path(
    ctx,
    "M .006 .955 L .063 .955 L .089 .98 Q .111 .997 .088 1 L .008 1 Z",
    LIGHT
  );

  ctx.save();
  ctx.translate(0, breath);
  // A visible neck, sloped shoulders and a waist establish anatomy before detail.
  path(ctx, "M -.027 .118 L .028 .118 L .032 .17 L -.032 .17 Z", SKIN);
  const shirt = index === 1 ? "#aebacc" : "#9baac0";
  path(
    ctx,
    "M -.03 .147 Q -.059 .164 -.104 .182 Q -.125 .199 -.118 .234 L -.091 .325 L -.088 .458 Q 0 .483 .091 .458 L .087 .33 L .119 .232 Q .123 .204 .104 .182 L .031 .147 Q 0 .179 -.03 .147 Z",
    shirt
  );
  path(
    ctx,
    "M -.092 .212 Q -.066 .255 -.068 .34 L -.071 .45 L -.087 .454 L -.093 .327 L -.114 .232 Z",
    SHADOW
  );
  line(ctx, [-0.067, 0.443], [0.073, 0.448], 0.006, LIGHT);
  if (index === 0 || index === 3) {
    path(
      ctx,
      "M -.04 .143 Q -.09 .154 -.066 .203 Q -.024 .227 .036 .202 Q .076 .179 .041 .143 L .026 .166 Q 0 .188 -.027 .164 Z",
      "#d0d9e7"
    );
    line(ctx, [-0.02, 0.2], [-0.018, 0.261], 0.003, SHADOW);
    line(ctx, [0.021, 0.2], [0.023, 0.255], 0.003, SHADOW);
  } else {
    line(ctx, [0, 0.183], [0.002, 0.443], 0.003, "#d6deec");
  }

  // Upper arm + forearm + palm: wrists naturally reach the upper thigh.
  const gesture = index === 4 ? Math.sin(time * 0.8) * 0.012 : 0;
  const left: Point[] = [
    [-0.101, 0.206],
    [-0.129, 0.363],
    [-0.111, 0.502],
  ];
  const right: Point[] = [
    [0.101, 0.207],
    [0.134, 0.36],
    [0.124 + gesture, 0.493],
  ];
  limb(ctx, left, [0.052, 0.039], shirt);
  limb(ctx, right, [0.052, 0.039], shirt);
  ellipse(ctx, -0.11, 0.527, 0.018, 0.032, SKIN);
  ellipse(ctx, 0.124 + gesture, 0.518, 0.018, 0.032, SKIN);
  line(ctx, [-0.142, 0.365], [-0.119, 0.369], 0.004, LIGHT);
  line(ctx, [0.121, 0.367], [0.147, 0.369], 0.004, LIGHT);

  // Tapered jaw, ears and a full-sized cranium: roughly 7.3 heads tall.
  ellipse(ctx, -0.049, 0.078, 0.009, 0.017, SKIN);
  ellipse(ctx, 0.049, 0.078, 0.009, 0.017, SKIN);
  path(
    ctx,
    "M 0 .004 C -.035 .004 -.051 .026 -.05 .063 L -.045 .097 Q -.034 .127 -.014 .136 L .015 .136 Q .039 .122 .047 .095 L .051 .055 Q .05 .008 0 .004 Z",
    SKIN
  );
  path(
    ctx,
    "M -.044 .066 Q -.028 .082 -.032 .106 L -.012 .13 Q -.039 .12 -.045 .096 Z",
    "#8f9db3"
  );
  // Restrained facial landmarks; no giant glowing eyes or skull-like circles.
  line(ctx, [-0.028, 0.067], [-0.014, 0.065], 0.004, "#58667d");
  line(ctx, [0.014, 0.065], [0.028, 0.067], 0.004, "#58667d");
  line(ctx, [0.003, 0.075], [0.007, 0.094], 0.003, "#8593a8");
  line(ctx, [-0.012, 0.109], [0.016, 0.109], 0.003, "#7b899e");
  if (index === 2) {
    for (let i = 0; i < 7; i++) {
      const angle = Math.PI + (i * Math.PI) / 6;
      ellipse(
        ctx,
        Math.cos(angle) * 0.042,
        0.037 + Math.sin(angle) * 0.035,
        0.019,
        0.02,
        "#e0e7f2"
      );
    }
  } else if (index === 3) {
    path(
      ctx,
      "M -.056 .045 Q -.05 -.007 .006 -.009 Q .05 -.007 .056 .04 L .082 .053 L -.059 .053 Z",
      LIGHT
    );
  } else {
    path(
      ctx,
      "M -.051 .061 Q -.064 .008 -.022 -.007 Q .026 -.027 .052 .023 L .054 .056 L .032 .034 L .012 .044 L -.002 .027 L -.025 .049 L -.038 .035 Z",
      LIGHT
    );
  }
  if (index === 1) {
    line(ctx, [0.045, 0.245], [0.058, 0.28], 0.009, PURPLE);
  }
  ctx.restore();
  ctx.restore();
}

export const fivePeople: SceneFn = (ctx, time, ex, ey) => {
  const height = Math.min(ey * 1.24, 410);
  const span = Math.min(ex * 1.63, 570);
  const ground = height * 0.55;
  for (let i = 0; i < 5; i++) {
    const scale = [0.94, 0.97, 1, 1.02, 1.05][i] ?? 1;
    const h = height * scale;
    const arrival = smoothProgress((time - i * 0.17) / 1.6);
    ctx.save();
    ctx.globalAlpha *= arrival;
    ctx.translate(-span / 2 + (i * span) / 4 - (1 - arrival) * 48, ground - h);
    ctx.scale(h, h);
    standingBoy(ctx, time, i);
    ctx.restore();
  }
  line(
    ctx,
    [-span * 0.59, ground + 5],
    [span * 0.59, ground + 5],
    0.7,
    "#364358"
  );
};

function mascot(ctx: Ctx, time: number, size: number) {
  ctx.save();
  ctx.scale(size / 500, size / 500);
  ctx.translate(-230, -250);
  const offsets = asciiFlameOffsets(time);
  const flameTime = asciiFlameClock(time);
  // The continuous path deforms the stems and shoulders as well as the tips.
  path(
    ctx,
    generateAvatarBodyPath(offsets, flameTime, "balanced", "working"),
    "#dce6f4"
  );
  // Accent flame in the app's sky accent (#68b3fe): pale tip fading to a deeper sky.
  const fire = ctx.createLinearGradient(240, 10, 320, 205);
  fire.addColorStop(0, "#e8f4ff");
  fire.addColorStop(0.16, "#68b3fe");
  fire.addColorStop(0.48, "#5aa6f8");
  fire.addColorStop(1, "#4a93ec");
  path(
    ctx,
    generatePurpleCorePath(offsets, flameTime, "balanced", "working"),
    fire
  );
  const tongues = generateCrestTonguePaths(
    278 + offsets.c_tip_x,
    8 + offsets.c_tip_y,
    88 + offsets.l_tip_x,
    168 + offsets.l_tip_y,
    342 + offsets.r_tip_x,
    132 + offsets.r_tip_y,
    flameTime
  );
  ctx.save();
  ctx.globalAlpha *= 0.7;
  path(ctx, tongues.center, "#68b3fe");
  path(ctx, tongues.left, "#4a93ec");
  path(ctx, tongues.right, "#8cc4fe");
  ctx.restore();
  const blink = Math.max(0, Math.cos(time * 1.35)) ** 48;
  for (const [x, y] of [
    [260, 317],
    [344, 306],
  ]) {
    ctx.save();
    ctx.translate(x ?? 0, y ?? 0);
    ctx.rotate((-11.6 * Math.PI) / 180);
    ctx.scale(1, 1 - blink * 0.92);
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.roundRect(-21, -47.5, 42, 95, 21);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export const avatar: SceneFn = (ctx, time, ex, ey) => {
  const size = Math.min(ex * 1.5, ey * 1.45, 475);
  ctx.save();
  ctx.translate(0, Math.sin(time * 0.9) * 3);
  mascot(ctx, time, size);
  ctx.restore();
};

function seatedCoder(ctx: Ctx, time: number) {
  // Far arm and leg are shaded and drawn behind the body to clarify depth.
  limb(
    ctx,
    [
      [-163, 62],
      [-77, 86],
      [-90, 220],
    ],
    [37, 25],
    "#7a8ba6"
  );
  path(ctx, "M -102 216 L -80 216 Q -62 220 -53 235 L -106 235 Z", "#adbbcf");
  // Pelvis is supported by the seat; thighs are horizontal, knees near 90 degrees.
  path(
    ctx,
    "M -193 45 Q -152 41 -128 62 L -56 75 Q -41 82 -43 103 L -69 111 L -151 93 L -190 82 Z",
    "#a8b5c9"
  );
  limb(
    ctx,
    [
      [-56, 93],
      [-50, 218],
    ],
    [27],
    "#a4b2c8"
  );
  path(
    ctx,
    "M -64 214 L -38 214 L -18 227 Q -11 234 -24 235 L -67 235 Z",
    LIGHT
  );
  line(ctx, [-62, 94], [-55, 188], 3, "#7488a3");
  const breath = Math.sin(time * 1.3) * 0.8;
  ctx.save();
  ctx.translate(0, breath);
  path(
    ctx,
    "M -180 -104 Q -150 -116 -127 -99 Q -111 -80 -120 -32 L -126 23 L -119 65 Q -148 88 -192 65 L -200 15 L -196 -46 Z",
    "#c2cede"
  );
  path(
    ctx,
    "M -191 -67 Q -175 -44 -175 0 L -170 66 L -192 65 L -200 13 Z",
    "#879bb5"
  );
  path(
    ctx,
    "M -170 -115 Q -197 -119 -198 -89 Q -185 -65 -153 -79 L -137 -98 L -150 -112 Z",
    "#a0b3cc"
  );
  line(ctx, [-154, -83], [-150, -43], 3, SHADOW);
  line(ctx, [-137, -85], [-131, -47], 3, SHADOW);
  line(ctx, [-180, 45], [-132, 42], 3, "#96a8bf");
  line(ctx, [-182, 60], [-134, 58], 3, LIGHT);
  // Neck connects behind the jaw, with a human profile rather than an oval on a stick.
  path(ctx, "M -161 -137 L -136 -132 L -138 -107 Q -153 -96 -169 -111 Z", SKIN);
  path(
    ctx,
    "M -172 -184 Q -153 -201 -130 -185 Q -116 -173 -119 -153 L -108 -141 L -120 -137 L -120 -122 Q -128 -111 -143 -117 L -164 -134 L -177 -157 Z",
    SKIN
  );
  path(
    ctx,
    "M -174 -151 Q -192 -178 -172 -196 Q -147 -215 -122 -189 L -117 -176 L -137 -179 L -150 -166 L -162 -165 L -166 -147 Z",
    "#e0e8f3"
  );
  ellipse(ctx, -162, -150, 6, 9, "#a1b2c9");
  line(ctx, [-134, -158], [-122, -157], 2.7, "#52647d");
  line(ctx, [-134, -129], [-123, -129], 2, "#8192aa");
  // Glasses and temple make the direction of the gaze toward the display explicit.
  line(ctx, [-155, -161], [-139, -160], 2, "#788ea8");
  line(ctx, [-140, -163], [-119, -161], 2.5, "#9fb4d0");
  line(ctx, [-140, -163], [-138, -151], 2.5, "#9fb4d0");
  line(ctx, [-138, -151], [-121, -150], 2, "#9fb4d0");
  ctx.restore();
}

function typingArm(ctx: Ctx, time: number, near: boolean) {
  const pose = typingPose(time, near);
  limb(
    ctx,
    [pose.shoulder, pose.elbow, pose.wrist],
    [25, 17],
    near ? "#c8d4e4" : "#91a5c0"
  );
  const [x, y] = pose.wrist;
  path(
    ctx,
    `M ${x - 5} ${y - 5} Q ${x + 3} ${y - 8} ${x + 11} ${y - 3} L ${x + 15} ${y + 1} L ${x + 8} ${y + 5} L ${x - 4} ${y + 4} Z`,
    SKIN
  );
  for (let finger = 0; finger < 3; finger++) {
    const lift =
      finger === Math.floor(time * 3 + (near ? 0 : 1)) % 3
        ? pose.fingerLift
        : 0;
    line(
      ctx,
      [x + 8 + finger * 3, y],
      [x + 15 + finger * 3, y + 4 - lift],
      2.6,
      "#d7e0ed"
    );
  }
}

function workstation(
  ctx: Ctx,
  time: number,
  ex: number,
  ey: number,
  growthTime = 0
) {
  ctx.save();
  const fit = Math.min(ex / 325, ey / 310, 1.18);
  ctx.scale(fit, fit);
  ctx.translate(-8, -8);
  // Ergonomic backrest, cushion, stem, five-star base and small casters.
  path(
    ctx,
    "M -220 -80 Q -220 -99 -201 -96 L -188 -89 L -185 69 L -119 78 L -121 95 L -201 91 Q -212 88 -214 72 Z",
    "#71859f"
  );
  line(ctx, [-176, 92], [-176, 204], 7, "#92a5bf");
  for (const end of [
    [-225, 220],
    [-128, 222],
    [-185, 231],
  ] as const) {
    line(ctx, [-176, 204], end, 5, "#8fa3be");
    ellipse(ctx, end[0], end[1], 7, 5, "#b6c4d8");
  }
  // Rear desk supports sit behind the person and leave proper leg clearance.
  path(ctx, "M 72 64 L 82 64 L 79 235 L 67 235 Z", "#7c91ad");
  path(ctx, "M 252 64 L 263 64 L 268 235 L 256 235 Z", "#7c91ad");
  line(ctx, [75, 206], [263, 206], 3.5, "#526983");
  seatedCoder(ctx, time);
  ctx.save();
  ctx.translate(0, WORKSTATION.laptopY);
  drawLaptop(ctx, time);
  ctx.restore();
  typingArm(ctx, time, false);
  typingArm(ctx, time, true);
  // Foreground table, support legs, cup and restrained steam.
  path(
    ctx,
    `M -65 ${WORKSTATION.tableTop} L 264 ${WORKSTATION.tableTop} L 249 ${WORKSTATION.tableFront} L -80 ${WORKSTATION.tableFront} Z`,
    "#8398b4"
  );
  path(
    ctx,
    `M -80 ${WORKSTATION.tableFront} L 249 ${WORKSTATION.tableFront} L 249 ${WORKSTATION.tableBottom} L -80 ${WORKSTATION.tableBottom} Z`,
    "#a9bad0"
  );
  line(ctx, [-79, 58], [248, 58], 2.2, "#d0dbea");
  line(ctx, [-78, 69], [248, 69], 2, "#465d79");
  ctx.save();
  ctx.translate(-18, -74);
  path(ctx, "M 236 87 L 260 87 L 257 118 L 240 118 Z", "#b9c8dc");
  ctx.strokeStyle = "#a3b6cf";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(263, 99, 8, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(246, 79);
  ctx.bezierCurveTo(236 + Math.sin(time) * 3, 67, 258, 64, 249, 53);
  ctx.strokeStyle = "#52677f";
  ctx.stroke();
  ctx.restore();
  const entry = growthState(growthTime).entry;
  const inverse = 1 - entry;
  const x =
    inverse ** 3 * 57 +
    3 * inverse ** 2 * entry * 122 +
    3 * inverse * entry ** 2 * 133 +
    entry ** 3 * 160;
  const y =
    inverse ** 3 * (-188 + Math.sin(time * 0.8) * 2) +
    3 * inverse ** 2 * entry * -181 +
    3 * inverse * entry ** 2 * -108 +
    entry ** 3 * -66;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 - entry * 0.63, 1);
  // One continuous avatar. No opacity switch, clipping toggle, or replacement icon.
  mascot(
    ctx,
    time,
    WORKSTATION.hoverSize +
      entry * (WORKSTATION.screenAvatarSize - WORKSTATION.hoverSize)
  );
  ctx.restore();
  drawGrowthInstrument(ctx, growthTime);
  line(ctx, [-253, 236], [281, 236], 0.8, "#40516a");
  ctx.restore();
}

export const coder: SceneFn = (ctx, time, ex, ey) => {
  workstation(ctx, workstationTime("coder", time), ex, ey);
};

export const growth: SceneFn = (ctx, time, ex, ey) => {
  workstation(
    ctx,
    workstationTime("growth", time),
    ex,
    ey,
    Math.max(0, time - TRANSITION_SECONDS)
  );
};

export const SCENES: readonly SceneFn[] = [
  fivePeople,
  avatar,
  coder,
  growth,
  helicopter,
];
