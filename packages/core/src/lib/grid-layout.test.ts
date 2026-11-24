import {
  getGridBreakpoint,
  getResponsiveGridConfig,
} from "@workspace/core/lib/grid-layout";
import { describe, expect, it } from "vitest";

describe("grid-layout", () => {
  describe("getGridBreakpoint", () => {
    it("returns lg for >= 1080px", () => {
      expect(getGridBreakpoint(1200)).toBe("lg");
      expect(getGridBreakpoint(1080)).toBe("lg");
    });

    it("returns md for 760px - 1079px", () => {
      expect(getGridBreakpoint(900)).toBe("md");
      expect(getGridBreakpoint(760)).toBe("md");
    });

    it("returns sm for 500px - 759px", () => {
      expect(getGridBreakpoint(600)).toBe("sm");
    });

    it("returns xs for < 500px", () => {
      expect(getGridBreakpoint(400)).toBe("xs");
    });
  });

  describe("getResponsiveGridConfig layout rules (lg / desktop)", () => {
    it("1 pane: 1 row full width", () => {
      const config = getResponsiveGridConfig(1, "lg");
      expect(config.gridClass).toBe("grid-cols-12 grid-rows-1");
      expect(config.getPaneClass(0)).toBe("col-span-12");
      expect(config.isScrollable).toBe(false);
    });

    it("2 panes: 1 row, 2 columns", () => {
      const config = getResponsiveGridConfig(2, "lg");
      expect(config.gridClass).toBe("grid-cols-12 grid-rows-1");
      expect(config.getPaneClass(0)).toBe("col-span-6");
      expect(config.getPaneClass(1)).toBe("col-span-6");
      expect(config.isScrollable).toBe(false);
    });

    it("3 panes: 1 row, 3 columns", () => {
      const config = getResponsiveGridConfig(3, "lg");
      expect(config.gridClass).toBe("grid-cols-12 grid-rows-1");
      expect(config.getPaneClass(0)).toBe("col-span-4");
      expect(config.getPaneClass(1)).toBe("col-span-4");
      expect(config.getPaneClass(2)).toBe("col-span-4");
      expect(config.isScrollable).toBe(false);
    });

    it("4 panes: 2 rows (2+2)", () => {
      const config = getResponsiveGridConfig(4, "lg");
      expect(config.gridClass).toBe("grid-cols-12 grid-rows-2");
      expect(config.getPaneClass(0)).toBe("col-span-6");
      expect(config.isScrollable).toBe(false);
    });

    it("5 panes: 2 rows (3 top + 2 bottom)", () => {
      const config = getResponsiveGridConfig(5, "lg");
      expect(config.gridClass).toBe("grid-cols-12 grid-rows-2");
      expect(config.getPaneClass(0)).toBe("col-span-4");
      expect(config.getPaneClass(1)).toBe("col-span-4");
      expect(config.getPaneClass(2)).toBe("col-span-4");
      expect(config.getPaneClass(3)).toBe("col-span-6");
      expect(config.getPaneClass(4)).toBe("col-span-6");
      expect(config.isScrollable).toBe(false);
    });

    it("6 panes: 2 rows (3 top + 3 bottom)", () => {
      const config = getResponsiveGridConfig(6, "lg");
      expect(config.gridClass).toBe("grid-cols-12 grid-rows-2");
      expect(config.getPaneClass(0)).toBe("col-span-4");
      expect(config.isScrollable).toBe(false);
    });

    it("7 panes: 2 rows (4 top + 3 bottom)", () => {
      const config = getResponsiveGridConfig(7, "lg");
      expect(config.gridClass).toBe("grid-cols-12 grid-rows-2");
      expect(config.getPaneClass(0)).toBe("col-span-3");
      expect(config.getPaneClass(3)).toBe("col-span-3");
      expect(config.getPaneClass(4)).toBe("col-span-4");
      expect(config.getPaneClass(6)).toBe("col-span-4");
      expect(config.isScrollable).toBe(false);
    });

    it("8 panes: 2 rows (4 top + 4 bottom)", () => {
      const config = getResponsiveGridConfig(8, "lg");
      expect(config.gridClass).toBe("grid-cols-12 grid-rows-2");
      expect(config.getPaneClass(0)).toBe("col-span-3");
      expect(config.getPaneClass(7)).toBe("col-span-3");
      expect(config.isScrollable).toBe(false);
    });
  });
});
