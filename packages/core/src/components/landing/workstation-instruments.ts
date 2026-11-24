import { paintAsciiGrowth } from "./ascii-growth";
import { WORKSTATION } from "./workstation-geometry";

type Ctx = CanvasRenderingContext2D;
const DISPLAY = "M 165 -140 L 193 -133 L 158 23 L 130 17 Z";

function shape(ctx: Ctx, outline: string, color: string) {
  ctx.fillStyle = color;
  ctx.fill(new Path2D(outline));
}

/** Oblique side elevation: the display faces left, toward the seated person. */
export function drawLaptop(ctx: Ctx, time: number) {
  shape(ctx, "M 158 -155 L 204 -144 L 166 37 L 120 28 Z", "#8fa2bd");
  shape(ctx, "M 162 -149 L 198 -140 L 162 31 L 125 23 Z", "#d2ddec");
  shape(ctx, DISPLAY, "#25364f");
  ctx.save();
  ctx.clip(new Path2D(DISPLAY));
  // The visible slice of an editor follows the same slanted screen plane.
  ctx.transform(0.2, 0.05, -0.225, 1, 164, -134);
  for (let row = 0; row < 13; row++) {
    const y = 8 + row * 10;
    ctx.fillStyle = row % 3 === 0 ? "#68b3fe" : "#8ca9c9";
    ctx.fillRect(7 + (row % 3) * 13, y, 58 + (row % 2) * 24, 3);
  }
  ctx.fillStyle = "#d4dff0";
  ctx.fillRect(108, 8 + Math.floor((time * 0.6) % 12) * 10, 5, 7);
  ctx.restore();
  // Lid thickness, hinge, keyboard, palm rest and supported base.
  shape(ctx, "M 198 -140 L 204 -144 L 166 37 L 160 34 Z", "#617b9d");
  shape(ctx, "M -34 30 L 120 27 L 166 37 L -20 42 Z", "#9eafc7");
  shape(ctx, "M -20 42 L 166 37 L 163 44 L -19 44 Z", "#d1ddec");
  shape(ctx, "M -12 30 L 108 29 L 134 35 L 5 38 Z", "#405570");
  for (let row = 0; row < 3; row++) {
    for (let key = 0; key < 11; key++) {
      shape(
        ctx,
        `M ${-9 + key * 10 + row * 5} ${30 + row * 2.5} h 6 v 1.6 h -6 Z`,
        "#becce0"
      );
    }
  }
  shape(ctx, "M 6 39 L 49 38 L 58 40 L 10 41 Z", "#7187a7");
  shape(ctx, "M 73 41 L 87 40.5 L 87 42 L 73 42.5 Z", "#3d506d");
  shape(ctx, "M 97 40 L 107 39.7 L 107 41.3 L 97 41.6 Z", "#3d506d");
  shape(ctx, "M 121 26 L 165 34 L 165 39 L 119 30 Z", "#506986");
}

export function drawGrowthInstrument(ctx: Ctx, time: number) {
  paintAsciiGrowth(
    ctx,
    time,
    WORKSTATION.progressLeft,
    WORKSTATION.progressRight,
    WORKSTATION.progressY
  );
}
