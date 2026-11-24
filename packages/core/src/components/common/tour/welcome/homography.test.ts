import { describe, expect, it } from "vitest";
import { quadToMatrix3d } from "./homography";

describe("quadToMatrix3d", () => {
  it("returns identity transform when destination matches source rectangle", () => {
    const res = quadToMatrix3d(
      200,
      100,
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 0, y: 100 }
    );
    expect(res).toContain(
      "matrix3d(1.0000000, 0.0000000, 0, 0.000000000, 0.0000000, 1.0000000, 0, 0.000000000, 0, 0, 1, 0, 0.000, 0.000, 0, 1.000)"
    );
  });

  it("handles translations accurately", () => {
    const res = quadToMatrix3d(
      200,
      100,
      { x: 50, y: 80 },
      { x: 250, y: 80 },
      { x: 250, y: 180 },
      { x: 50, y: 180 }
    );
    expect(res).toContain("50.000, 80.000, 0, 1.000");
  });

  it("handles perspective trapezoid warping without NaN", () => {
    const res = quadToMatrix3d(
      300,
      200,
      { x: 100, y: 60 },
      { x: 400, y: 20 },
      { x: 400, y: 220 },
      { x: 100, y: 180 }
    );
    expect(res).not.toContain("NaN");
    expect(res).toContain("matrix3d(");
  });
});
