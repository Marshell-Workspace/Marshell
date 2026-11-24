/**
 * homography.ts — Exact 2D Projective Homography Solver for CSS matrix3d.
 *
 * Maps a source rectangle of width w and height h (origin at 0, 0)
 * to an arbitrary quad [p0, p1, p2, p3] (top-left, top-right, bottom-right, bottom-left)
 * with zero external dependencies.
 */

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Computes the 4x4 column-major matrix3d string for CSS transform.
 */
export function quadToMatrix3d(
  w: number,
  h: number,
  p0: Point2D, // top-left
  p1: Point2D, // top-right
  p2: Point2D, // bottom-right
  p3: Point2D // bottom-left
): string {
  if (w <= 0 || h <= 0) {
    return "matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1)";
  }

  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const sx = p0.x - p1.x + p2.x - p3.x;

  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sy = p0.y - p1.y + p2.y - p3.y;

  let g = 0;
  let hProj = 0;

  if (Math.abs(sx) > 1e-5 || Math.abs(sy) > 1e-5) {
    const det = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(det) > 1e-7) {
      g = (sx * dy2 - sy * dx2) / det;
      hProj = (dx1 * sy - dy1 * sx) / det;
    }
  }

  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + hProj * p3.x;
  const c = p0.x;

  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + hProj * p3.y;
  const f = p0.y;

  const affineDet = a * e - b * d;
  if (process.env.NODE_ENV !== "production" && affineDet <= 0) {
    console.warn(`[homography] Non-positive affine determinant: ${affineDet}`);
  }

  // Compose with scale (1/w, 1/h)
  const m00 = a / w;
  const m10 = d / w;
  const m30 = g / w;

  const m01 = b / h;
  const m11 = e / h;
  const m31 = hProj / h;

  const m03 = c;
  const m13 = f;
  const m33 = 1;

  return `matrix3d(${m00.toFixed(7)}, ${m10.toFixed(7)}, 0, ${m30.toFixed(9)}, ${m01.toFixed(7)}, ${m11.toFixed(7)}, 0, ${m31.toFixed(9)}, 0, 0, 1, 0, ${m03.toFixed(3)}, ${m13.toFixed(3)}, 0, ${m33.toFixed(3)})`;
}
