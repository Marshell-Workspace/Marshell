import type { SceneFn } from "./scenes";

type Ctx = CanvasRenderingContext2D;
type Point = readonly [number, number];

export const MAIN_ROTOR = {
  blades: 4,
  radius: 300,
  root: 20,
  projection: 0.16,
  radiansPerSecond: 14,
  hubX: 0,
  hubY: -108,
} as const;
export const HELICOPTER_GEAR = { mainRadius: 8, tailRadius: 5.5 } as const;

export function helicopterPose(time: number) {
  return {
    x: -42 + time * 7.2,
    y: 49 + Math.sin(time * 0.65) * 2.4,
    pitch: 0.085 + Math.sin(time * 0.55) * 0.004,
  };
}

export function rotorTip(time: number, blade: number): Point {
  const angle = time * MAIN_ROTOR.radiansPerSecond + (blade * Math.PI) / 2;
  return [
    Math.cos(angle) * MAIN_ROTOR.radius,
    Math.sin(angle) * MAIN_ROTOR.radius * MAIN_ROTOR.projection,
  ];
}

function shape(ctx: Ctx, outline: string, color: string) {
  ctx.fillStyle = color;
  ctx.fill(new Path2D(outline));
}

function stroke(
  ctx: Ctx,
  points: readonly Point[],
  width: number,
  color: string
) {
  const start = points[0];
  if (!start) {
    return;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(...start);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    if (point) {
      ctx.lineTo(...point);
    }
  }
  ctx.stroke();
}

function oval(
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

function tire(ctx: Ctx, x: number, y: number, radius: number, far = false) {
  oval(ctx, x, y, radius * 0.82, radius, far ? "#63758e" : "#97a8bf");
  oval(ctx, x + 0.8, y + 0.5, radius * 0.58, radius * 0.75, "#192a40");
  oval(ctx, x, y, radius * 0.24, radius * 0.28, "#93a7c2");
  stroke(
    ctx,
    [
      [x - radius * 0.43, y - radius * 0.72],
      [x + radius * 0.26, y - radius * 0.8],
    ],
    1.7,
    "#c7d2e3"
  );
}

function blade(ctx: Ctx, angle: number) {
  const { root, radius, hubX, hubY, projection } = MAIN_ROTOR;
  ctx.save();
  ctx.translate(hubX, hubY);
  ctx.scale(1, projection);
  ctx.rotate(angle);
  // Rigid tapered planform: narrow cuff, broad spar, swept tip and separate tip band.
  shape(
    ctx,
    `M ${root} -5 L 52 -10 L ${radius - 24} -8 L ${radius} -2 L ${radius - 2} 8 L 54 13 L ${root} 6 Z`,
    "#b7c7dd"
  );
  shape(
    ctx,
    `M 54 -10 L ${radius - 24} -8 L ${radius - 23} -3 L 54 -4 Z`,
    "#e1e7f1"
  );
  shape(
    ctx,
    `M ${radius - 20} -7 L ${radius} -2 L ${radius - 2} 8 L ${radius - 20} 8 Z`,
    "#8cc4fe"
  );
  ctx.restore();
  const c = Math.cos(angle),
    s = Math.sin(angle);
  stroke(
    ctx,
    [
      [hubX + root * c, hubY + root * s * projection],
      [hubX + radius * c, hubY + radius * s * projection],
    ],
    5.2,
    "#e0e8f3"
  );
}

function rotor(ctx: Ctx, time: number, front: boolean) {
  for (let index = 0; index < 4; index++) {
    const angle = time * MAIN_ROTOR.radiansPerSecond + (index * Math.PI) / 2;
    if (Math.sin(angle) >= 0 !== front) {
      continue;
    }
    for (let exposure = 3; exposure > 0; exposure--) {
      ctx.save();
      ctx.globalAlpha *= 0.065;
      blade(ctx, angle - exposure * 0.045);
      ctx.restore();
    }
    blade(ctx, angle);
  }
}

function outlined(
  ctx: Ctx,
  outline: string,
  fill: string,
  edge: string,
  width = 3
) {
  const geometry = new Path2D(outline);
  ctx.fillStyle = fill;
  ctx.fill(geometry);
  ctx.strokeStyle = edge;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.stroke(geometry);
}

function tailRotor(ctx: Ctx, time: number) {
  stroke(
    ctx,
    [
      [-313, -37],
      [-306, -37],
    ],
    4,
    "#becde0"
  );
  ctx.save();
  ctx.translate(-307, -37);
  ctx.rotate(-time * 22);
  for (let index = 0; index < 4; index++) {
    ctx.save();
    ctx.rotate((index * Math.PI) / 2);
    shape(ctx, "M 5 -2 L 29 -4 L 33 1 L 6 4 Z", "#bdcde1");
    shape(ctx, "M 26 -3 L 29 -4 L 33 1 L 26 3 Z", "#e2e9f3");
    ctx.restore();
  }
  oval(ctx, 0, 0, 5, 5, "#c9d6e7");
  ctx.restore();
}

/** Reference-led tandem-canopy silhouette, facing right; the field renders it entirely in ASCII. */
export const helicopter: SceneFn = (ctx, time, ex, ey) => {
  const pose = helicopterPose(time);
  ctx.save();
  const fit = Math.min(ex / 400, ey / 260, 1.08);
  ctx.scale(fit, fit);
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.pitch);
  rotor(ctx, time, false);

  // Far gear and wing stay behind the long slender airframe.
  stroke(
    ctx,
    [
      [54, 43],
      [64, 78],
    ],
    3.5,
    "#7890af"
  );
  tire(ctx, 66, 85, 6.5, true);
  outlined(
    ctx,
    "M -32 0 L -97 17 L -87 29 L 18 20 Z",
    "#3d536f",
    "#849cb9",
    2.6
  );

  // Tapered tail boom, swept fin and horizontal stabilizer.
  outlined(
    ctx,
    "M -63 -4 L -293 -24 L -311 -16 L -292 -5 L -55 38 Z",
    "#526b89",
    "#a9bdd6"
  );
  shape(ctx, "M -291 -12 L -63 15 L -55 38 L -292 -5 Z", "#3a516e");
  stroke(
    ctx,
    [
      [-286, -23],
      [-69, -2],
    ],
    3.5,
    "#cedbea"
  );
  outlined(
    ctx,
    "M -298 -6 L -327 -100 L -317 -111 L -289 -36 L -276 1 Z",
    "#738ba9",
    "#c1d1e5"
  );
  shape(ctx, "M -325 -96 L -316 -103 L -310 -87 L -321 -80 Z", "#d1ddec");
  outlined(
    ctx,
    "M -254 -3 L -304 16 L -281 23 L -235 9 Z",
    "#607b9d",
    "#afc4df",
    2.5
  );
  stroke(
    ctx,
    [
      [-157, 12],
      [-168, 55],
    ],
    3.5,
    "#b3c7de"
  );
  stroke(
    ctx,
    [
      [-183, 8],
      [-168, 55],
    ],
    2.7,
    "#718baa"
  );
  tire(ctx, -171, 63, HELICOPTER_GEAR.tailRadius);

  // Sculpted engine shoulders and exhaust behind the higher rear cockpit.
  outlined(
    ctx,
    "M -86 -3 L -80 -42 Q -70 -64 -42 -65 L -11 -52 L 14 -23 L 8 6 Z",
    "#758ba7",
    "#b8c9df"
  );
  outlined(
    ctx,
    "M -80 -29 Q -95 -44 -76 -54 L -50 -52 L -45 -35 Z",
    "#324963",
    "#a8bfd9",
    3.5
  );
  oval(ctx, -72, -43, 11, 7, "#162b43");
  for (let vent = 0; vent < 4; vent++) {
    stroke(
      ctx,
      [
        [-44 + vent * 7, -48],
        [-34 + vent * 7, -27],
      ],
      3,
      "#c0d0e5"
    );
  }
  shape(ctx, "M -13 -60 L 13 -60 L 23 -32 L -20 -31 Z", "#637e9f");

  // Swept tandem canopy and a low, extended nose, rather than the former utility cabin.
  outlined(
    ctx,
    "M -87 5 Q -69 -10 -16 -10 Q -8 -44 18 -61 Q 39 -73 62 -56 L 137 -25 Q 180 -12 215 18 Q 233 28 237 40 Q 239 55 213 61 L 137 65 L -33 52 Q -78 43 -91 24 Z",
    "#6c839f",
    "#c4d3e6",
    3.5
  );
  shape(
    ctx,
    "M -87 22 Q -56 39 -19 38 L 136 49 L 229 43 Q 237 57 213 61 L 137 65 L -33 52 Q -78 43 -87 22 Z",
    "#3f5876"
  );
  stroke(
    ctx,
    [
      [-30, 49],
      [136, 62],
      [206, 57],
    ],
    3.2,
    "#9cb5d2"
  );

  // Two cockpit positions with dark glazed panes and a raked center frame.
  outlined(
    ctx,
    "M 2 -18 Q 8 -45 24 -55 Q 40 -63 57 -49 L 77 -34 L 81 -8 Z",
    "#000000",
    "#dae3ef",
    4.4
  );
  outlined(
    ctx,
    "M 88 -31 L 134 -17 Q 159 -7 179 13 L 173 23 L 91 7 Z",
    "#000000",
    "#c9d8e9",
    4.4
  );
  stroke(
    ctx,
    [
      [79, -34],
      [84, 11],
    ],
    4,
    "#a9c0dc"
  );
  stroke(
    ctx,
    [
      [143, -9],
      [167, 18],
    ],
    3.2,
    "#a2bad7"
  );
  stroke(
    ctx,
    [
      [37, -23],
      [56, -18],
    ],
    3.5,
    "#7894b6"
  );
  stroke(
    ctx,
    [
      [117, 3],
      [136, 7],
    ],
    3.2,
    "#8da7c4"
  );
  stroke(
    ctx,
    [
      [15, -14],
      [73, -4],
      [90, 13],
      [177, 29],
      [221, 36],
    ],
    3,
    "#b9cde4"
  );

  // Nose panel divisions, chin optics, belly ribs and forward equipment bay.
  stroke(
    ctx,
    [
      [183, 15],
      [211, 25],
      [227, 39],
    ],
    3,
    "#d3dfed"
  );
  outlined(
    ctx,
    "M 113 31 L 171 39 L 166 53 L 108 46 Z",
    "#546d8b",
    "#91abc9",
    2.5
  );
  for (let rib = 0; rib < 5; rib++) {
    stroke(
      ctx,
      [
        [-51 + rib * 24, 1 + rib * 2],
        [-49 + rib * 24, 28 + rib * 2],
      ],
      2.8,
      "#a0b7d2"
    );
  }
  outlined(
    ctx,
    "M 198 56 Q 211 49 223 55 L 226 63 Q 216 74 202 66 Z",
    "#8199b5",
    "#b9cee4",
    2.8
  );
  oval(ctx, 216, 60, 4.5, 5, "#233e59");

  // Near stub wing and an underslung fairing give the reference's layered side profile.
  outlined(
    ctx,
    "M -47 12 L 42 30 L -4 49 L -121 37 Z",
    "#5d7798",
    "#bfd0e5",
    3.2
  );
  stroke(
    ctx,
    [
      [-46, 13],
      [40, 30],
      [-4, 47],
    ],
    3,
    "#e0e7f1"
  );
  outlined(
    ctx,
    "M -100 43 L -23 51 Q 10 55 9 65 Q 7 77 -18 74 L -103 63 Q -113 53 -100 43 Z",
    "#4e698a",
    "#b7cce3",
    3
  );
  shape(
    ctx,
    "M -103 58 L -16 67 Q 3 69 9 63 Q 7 77 -18 74 L -103 63 Z",
    "#314b69"
  );
  for (let rib = 0; rib < 4; rib++) {
    stroke(
      ctx,
      [
        [-89 + rib * 22, 49 + rib * 2],
        [-90 + rib * 22, 61 + rib * 2],
      ],
      2.8,
      "#a2bad7"
    );
  }

  // Small main wheel, braced strut and axle. The tire's dark core remains visible.
  stroke(
    ctx,
    [
      [75, 48],
      [89, 87],
    ],
    4.5,
    "#bacfe6"
  );
  stroke(
    ctx,
    [
      [109, 53],
      [91, 84],
    ],
    3.1,
    "#7895b8"
  );
  stroke(
    ctx,
    [
      [84, 90],
      [98, 90],
    ],
    3.3,
    "#d0ddeb"
  );
  tire(ctx, 95, 98, HELICOPTER_GEAR.mainRadius);

  tailRotor(ctx, time);
  stroke(
    ctx,
    [
      [0, -61],
      [0, -108],
    ],
    6,
    "#cad8e9"
  );
  stroke(
    ctx,
    [
      [-13, -82],
      [14, -82],
    ],
    4,
    "#8da7c9"
  );
  rotor(ctx, time, true);
  oval(ctx, 0, -108, 13, 5, "#dbe4f1");
  oval(ctx, 0, -112, 6, 5, "#9fb5d1");
  ctx.restore();
};
