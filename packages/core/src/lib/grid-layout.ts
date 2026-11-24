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
 * Core layout rules (Strict Maximum 2 Rows for desktop/large displays):
 * - 1 terminal: 1x1 full width (1 row)
 * - 2 terminals: 2 columns (1 row)
 * - 3 terminals: 3 columns (1 row)
 * - 4 terminals: 2 x 2 (2 rows)
 * - 5 terminals: 3 top + 2 bottom (2 rows, 3 top span 4, 2 bottom span 6 in 12-col grid)
 * - 6 terminals: 3 + 3 (2 rows, 3 top span 4, 3 bottom span 4 in 12-col grid)
 * - 7 terminals: 4 top + 3 bottom (2 rows, 4 top span 3, 3 bottom span 4 in 12-col grid)
 * - 8 terminals: 4 + 4 (2 rows, 4 top span 3, 4 bottom span 3 in 12-col grid)
 */
export function getResponsiveGridConfig(
  count: number,
  breakpoint: GridBreakpoint
): GridConfig {
  if (count <= 1) {
    return {
      gridClass: "grid-cols-12 grid-rows-1",
      getPaneClass: () => "col-span-12",
      isScrollable: false,
    };
  }

  // Large desktop (>= 1080px) and Medium desktop (760px - 1079px) -> Strict 2-row maximum
  if (breakpoint === "lg" || breakpoint === "md") {
    switch (count) {
      case 2:
        return {
          gridClass: "grid-cols-12 grid-rows-1",
          getPaneClass: () => "col-span-6",
          isScrollable: false,
        };
      case 3:
        return {
          gridClass: "grid-cols-12 grid-rows-1",
          getPaneClass: () => "col-span-4",
          isScrollable: false,
        };
      case 4:
        return {
          gridClass: "grid-cols-12 grid-rows-2",
          getPaneClass: () => "col-span-6",
          isScrollable: false,
        };
      case 5:
        return {
          gridClass: "grid-cols-12 grid-rows-2",
          getPaneClass: (idx) => (idx < 3 ? "col-span-4" : "col-span-6"),
          isScrollable: false,
        };
      case 6:
        return {
          gridClass: "grid-cols-12 grid-rows-2",
          getPaneClass: () => "col-span-4",
          isScrollable: false,
        };
      case 7:
        return {
          gridClass: "grid-cols-12 grid-rows-2",
          getPaneClass: (idx) => (idx < 4 ? "col-span-3" : "col-span-4"),
          isScrollable: false,
        };
      case 8:
        return {
          gridClass: "grid-cols-12 grid-rows-2",
          getPaneClass: () => "col-span-3",
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
