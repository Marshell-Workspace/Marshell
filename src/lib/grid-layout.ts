export type GridBreakpoint = "lg" | "md" | "sm" | "xs";

export interface GridConfig {
  getPaneClass: (index: number) => string;
  gridClass: string;
  isScrollable: boolean;
}

/**
 * Determines the responsive breakpoint based on container pixel width.
 */
export function getGridBreakpoint(width: number): GridBreakpoint {
  const effective = width > 0 ? width : 1200;
  if (effective >= 1080) {
    return "lg";
  }
  if (effective >= 760) {
    return "md";
  }
  if (effective >= 500) {
    return "sm";
  }
  return "xs";
}

/**
 * Calculates the optimal, balanced terminal grid layout based on terminal count and viewport breakpoint.
 *
 * Core layout rules:
 * - 1 terminal: 1x1 full screen
 * - 2 terminals: 2x1 (2 columns)
 * - 3 terminals: 2x2 (2 top + 1 full-width bottom) -> NEVER 3 narrow single-row columns
 * - 4 terminals: 2x2 (2 columns, 2 rows)
 * - 5 terminals: 2+2+1 (2 top + 2 middle + 1 full-width bottom)
 * - 6 terminals: 3x2 (3 columns, 2 rows)
 * - 7 terminals: 3+3+1 (3 top + 3 middle + 1 full-width bottom)
 * - 8 terminals: 4x2 (4 columns, 2 rows) on desktop / 3x3 on medium / 2x4 on small
 */
export function getResponsiveGridConfig(
  count: number,
  breakpoint: GridBreakpoint
): GridConfig {
  if (count <= 1) {
    return {
      gridClass: "grid-cols-1 grid-rows-1",
      getPaneClass: () => "",
      isScrollable: false,
    };
  }

  // Large desktop (>= 1080px)
  if (breakpoint === "lg") {
    switch (count) {
      case 2:
        return {
          gridClass: "grid-cols-2 grid-rows-1",
          getPaneClass: () => "",
          isScrollable: false,
        };
      case 3:
        return {
          gridClass: "grid-cols-2 grid-rows-2",
          getPaneClass: (idx) => (idx === 2 ? "col-span-2" : "col-span-1"),
          isScrollable: false,
        };
      case 4:
        return {
          gridClass: "grid-cols-2 grid-rows-2",
          getPaneClass: () => "",
          isScrollable: false,
        };
      case 5:
        return {
          gridClass: "grid-cols-2 grid-rows-3",
          getPaneClass: (idx) => (idx === 4 ? "col-span-2" : "col-span-1"),
          isScrollable: false,
        };
      case 6:
        return {
          gridClass: "grid-cols-3 grid-rows-2",
          getPaneClass: () => "",
          isScrollable: false,
        };
      case 7:
        return {
          gridClass: "grid-cols-3 grid-rows-3",
          getPaneClass: (idx) => (idx === 6 ? "col-span-3" : "col-span-1"),
          isScrollable: false,
        };
      case 8:
        return {
          gridClass: "grid-cols-4 grid-rows-2",
          getPaneClass: () => "",
          isScrollable: false,
        };
      default: {
        const cols = 4;
        const rem = count % cols;
        return {
          gridClass: "grid-cols-4 auto-rows-fr",
          getPaneClass: (idx) =>
            rem === 1 && idx === count - 1 ? `col-span-${cols}` : "",
          isScrollable: true,
        };
      }
    }
  }

  // Medium desktop / tablet landscape (760px - 1079px) -> Max 3 columns
  if (breakpoint === "md") {
    switch (count) {
      case 2:
        return {
          gridClass: "grid-cols-2 grid-rows-1",
          getPaneClass: () => "",
          isScrollable: false,
        };
      case 3:
        return {
          gridClass: "grid-cols-2 grid-rows-2",
          getPaneClass: (idx) => (idx === 2 ? "col-span-2" : "col-span-1"),
          isScrollable: false,
        };
      case 4:
        return {
          gridClass: "grid-cols-2 grid-rows-2",
          getPaneClass: () => "",
          isScrollable: false,
        };
      case 5:
        return {
          gridClass: "grid-cols-2 grid-rows-3",
          getPaneClass: (idx) => (idx === 4 ? "col-span-2" : "col-span-1"),
          isScrollable: true,
        };
      case 6:
        return {
          gridClass: "grid-cols-3 grid-rows-2",
          getPaneClass: () => "",
          isScrollable: false,
        };
      case 7:
        return {
          gridClass: "grid-cols-3 grid-rows-3",
          getPaneClass: (idx) => (idx === 6 ? "col-span-3" : "col-span-1"),
          isScrollable: true,
        };
      case 8:
        return {
          gridClass: "grid-cols-6 grid-rows-3",
          getPaneClass: (idx) => (idx < 6 ? "col-span-2" : "col-span-3"),
          isScrollable: true,
        };
      default:
        return {
          gridClass: "grid-cols-3 auto-rows-fr",
          getPaneClass: () => "",
          isScrollable: true,
        };
    }
  }

  // Small / tablet portrait (500px - 759px) -> Max 2 columns
  if (breakpoint === "sm") {
    switch (count) {
      case 2:
        return {
          gridClass: "grid-cols-2 grid-rows-1",
          getPaneClass: () => "",
          isScrollable: false,
        };
      case 3:
        return {
          gridClass: "grid-cols-2 grid-rows-2",
          getPaneClass: (idx) => (idx === 2 ? "col-span-2" : "col-span-1"),
          isScrollable: false,
        };
      case 4:
        return {
          gridClass: "grid-cols-2 grid-rows-2",
          getPaneClass: () => "",
          isScrollable: false,
        };
      case 5:
        return {
          gridClass: "grid-cols-2 grid-rows-3",
          getPaneClass: (idx) => (idx === 4 ? "col-span-2" : "col-span-1"),
          isScrollable: true,
        };
      case 6:
        return {
          gridClass: "grid-cols-2 grid-rows-3",
          getPaneClass: () => "",
          isScrollable: true,
        };
      case 7:
        return {
          gridClass: "grid-cols-2 grid-rows-4",
          getPaneClass: (idx) => (idx === 6 ? "col-span-2" : "col-span-1"),
          isScrollable: true,
        };
      case 8:
        return {
          gridClass: "grid-cols-2 grid-rows-4",
          getPaneClass: () => "",
          isScrollable: true,
        };
      default:
        return {
          gridClass: "grid-cols-2 auto-rows-fr",
          getPaneClass: () => "",
          isScrollable: true,
        };
    }
  }

  // Extra small / mobile (< 500px) -> 1 column
  return {
    gridClass: "grid-cols-1 auto-rows-fr",
    getPaneClass: () => "",
    isScrollable: count > 1,
  };
}
