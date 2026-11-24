/**
 * Pure placement engine for the Marshell tour system.
 *
 * No DOM access. All inputs are plain rect objects.
 * Extracted from tutorial-overlay.tsx to enable unit testing (FX 5 / V13).
 */

export const TOUR_PLACEMENT_V2 = true;

export interface PlacementRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface PlacementLeader {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export type PlacementMode =
  | "adjacent"
  | "slid"
  | "inside"
  | "relaxed"
  | "bottom-sheet";
export type PlacementSide =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "bottom-sheet";

export interface PlacementInput {
  /** Rect of the highlighted anchor element (padded 6px already) */
  anchor: PlacementRect;
  /** Estimated card height (from ResizeObserver) */
  cardHeight: number;
  /** Preferred card widths to try in order [full, compact] */
  cardWidths: [number, number];
  /** Optional current surface identifier */
  currentSurface?: string | null;
  /** Gap between card edge and anchor surface in px */
  gap: number;
  /** Hard rects — card must never overlap these */
  hard: PlacementRect[];
  /** Optional interactive element rects in surface for least disturbance (P4) */
  interactiveRects?: PlacementRect[];
  /** Margin from viewport / surface edge in px */
  margin: number;
  /** Optional next step target rect to avoid covering it (H3) */
  nextTargetRect?: PlacementRect | null;
  /** Preferred placement side from step data */
  preferred: PlacementSide;
  /** Optional previous card center for minimizing mouse travel (P3) */
  previousCardCenter?: { x: number; y: number } | null;
  /** Optional previous step side for side-locking within same surface (P2) */
  previousSide?: PlacementSide | null;
  /** Optional previous surface identifier */
  previousSurface?: string | null;
  /** Soft rects — scored but not rejected if overlap unavoidable */
  soft: PlacementRect[];
  /**
   * Optional surface bounds (dialog / panel root intersected with viewport,
   * inset by margin). If null, the viewport (inset margin all sides) is used.
   */
  surfaceBounds: PlacementRect | null;
  /** Viewport dimensions */
  viewport: { height: number; width: number };
}

export interface PlacementResult {
  /** Computed card height slot (same as cardHeight for now — reserved) */
  height: number;
  /** Leader line endpoints, or null when card is adjacent (gap ≤ 48px) */
  leader: PlacementLeader | null;
  mode: PlacementMode;
  /** Winning side */
  side: PlacementSide;
  /** Card width selected */
  width: number;
  /** Card left offset (fixed, from viewport left) */
  x: number;
  /** Card top offset (fixed, from viewport top) */
  y: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function rectsOverlap(a: PlacementRect, b: PlacementRect): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

function overlapArea(a: PlacementRect, b: PlacementRect): number {
  const ox = Math.max(
    0,
    Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)
  );
  const oy = Math.max(
    0,
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
  );
  return ox * oy;
}

function insideBounds(card: PlacementRect, bounds: PlacementRect): boolean {
  return (
    card.left >= bounds.left &&
    card.top >= bounds.top &&
    card.left + card.width <= bounds.left + bounds.width &&
    card.top + card.height <= bounds.top + bounds.height
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildBounds(
  _surfaceBounds: PlacementRect | null,
  viewport: { width: number; height: number },
  margin: number
): PlacementRect {
  // Card bounds must ALWAYS be viewport inset margin on all sides.
  // A surface (dialog, Settings, Agent panel) is a soft avoid rect, never the card bounds.
  return {
    left: margin,
    top: margin,
    width: Math.max(0, viewport.width - margin * 2),
    height: Math.max(0, viewport.height - margin * 2),
  };
}

/** Compute ideal card top / left for a given side + width + height. */
function candidatePosition(
  side: PlacementSide,
  anchor: PlacementRect,
  cardWidth: number,
  cardHeight: number,
  gap: number,
  bounds: PlacementRect
): { left: number; top: number } {
  const cx = anchor.left + anchor.width / 2;
  const cy = anchor.top + anchor.height / 2;

  switch (side) {
    case "right": {
      const left = anchor.left + anchor.width + gap;
      const idealTop = cy - cardHeight / 2;
      const top = clamp(
        idealTop,
        bounds.top,
        bounds.top + bounds.height - cardHeight
      );
      return { left, top };
    }
    case "left": {
      const left = anchor.left - cardWidth - gap;
      const idealTop = cy - cardHeight / 2;
      const top = clamp(
        idealTop,
        bounds.top,
        bounds.top + bounds.height - cardHeight
      );
      return { left, top };
    }
    case "bottom": {
      const top = anchor.top + anchor.height + gap;
      // Top-right targets (e.g. notifications bell):
      // Place card below target, fully inside viewport with margin (right-aligned to bounds)
      const isTopRight =
        anchor.top < bounds.top + 80 &&
        anchor.left + anchor.width > bounds.left + bounds.width - 250;
      const idealLeft = isTopRight
        ? bounds.left + bounds.width - cardWidth
        : cx - cardWidth / 2;
      const left = clamp(
        idealLeft,
        bounds.left,
        bounds.left + bounds.width - cardWidth
      );
      return { left, top };
    }
    case "top": {
      const top = anchor.top - cardHeight - gap;
      // Step 10 & bottom-right dialog targets: place card above button, right-aligned to it
      const isBottomRight =
        anchor.left > bounds.left + bounds.width * 0.4 &&
        anchor.top > bounds.top + bounds.height * 0.4;
      const idealLeft = isBottomRight
        ? anchor.left + anchor.width - cardWidth
        : cx - cardWidth / 2;
      const left = clamp(
        idealLeft,
        bounds.left,
        bounds.left + bounds.width - cardWidth
      );
      return { left, top };
    }
    default: {
      return { left: bounds.left, top: bounds.top };
    }
  }
}

const SIDE_ORDER: PlacementSide[] = ["right", "left", "bottom", "top"];

function opposite(side: PlacementSide): PlacementSide {
  const map: Record<PlacementSide, PlacementSide> = {
    right: "left",
    left: "right",
    top: "bottom",
    bottom: "top",
    "bottom-sheet": "top",
  };
  return map[side];
}

function sidePriority(side: PlacementSide, preferred: PlacementSide): number {
  if (side === preferred) {
    return 0;
  }
  if (side === opposite(preferred)) {
    return 1;
  }
  return 2;
}

function buildLeader(
  card: PlacementRect,
  anchor: PlacementRect,
  side: PlacementSide,
  _gap: number
): PlacementLeader | null {
  // Only draw leader when gap > 48px
  const anchorCx = anchor.left + anchor.width / 2;
  const anchorCy = anchor.top + anchor.height / 2;
  const cardCx = card.left + card.width / 2;
  const cardCy = card.top + card.height / 2;

  // Compute actual gap between card edge and anchor edge
  let actualGap = 0;
  let from = { x: 0, y: 0 };
  let to = { x: 0, y: 0 };

  switch (side) {
    case "right":
      actualGap = card.left - (anchor.left + anchor.width);
      from = { x: card.left, y: cardCy };
      to = { x: anchor.left + anchor.width, y: anchorCy };
      break;
    case "left":
      actualGap = anchor.left - (card.left + card.width);
      from = { x: card.left + card.width, y: cardCy };
      to = { x: anchor.left, y: anchorCy };
      break;
    case "bottom":
      actualGap = card.top - (anchor.top + anchor.height);
      from = { x: cardCx, y: card.top };
      to = { x: anchorCx, y: anchor.top + anchor.height };
      break;
    case "top":
      actualGap = anchor.top - (card.top + card.height);
      from = { x: cardCx, y: card.top + card.height };
      to = { x: anchorCx, y: anchor.top };
      break;
    default:
      break;
  }

  if (actualGap > 48) {
    return { from, to };
  }
  return null;
}

// ─── Main export ───────────────────────────────────────────────────────────

/**
 * Compute card placement given viewport, surface, anchor and avoidance rects.
 *
 * Algorithm:
 * 1. Build effective bounds from surfaceBounds ∩ viewport, inset margin.
 * 2. If anchor fills >60% of viewport, return "inside" at top of anchor.
 * 3. For each width (full then compact), for each side in priority order,
 *    compute ideal position, reject if outside bounds or overlapping any hard
 *    rect or anchor. Score survivors by soft overlap + distance penalty.
 * 4. If no candidate survives, relax soft scoring, then allow compact width.
 * 5. Last resort: pick best side by clearance.
 */
function computeCardPlacementV1(input: PlacementInput): PlacementResult {
  const {
    anchor,
    cardWidths,
    cardHeight,
    gap,
    hard,
    margin,
    soft,
    surfaceBounds,
    preferred,
    viewport,
  } = input;

  // Mobile viewport (< 640px): dock card as a bottom sheet
  if (viewport.width < 640) {
    const sheetMargin = 8;
    const sheetWidth = Math.max(0, viewport.width - sheetMargin * 2);
    const sheetY = Math.max(
      sheetMargin,
      viewport.height - cardHeight - sheetMargin
    );
    return {
      x: sheetMargin,
      y: sheetY,
      width: sheetWidth,
      height: cardHeight,
      side: "bottom",
      mode: "bottom-sheet",
      leader: null,
    };
  }

  const bounds = buildBounds(surfaceBounds, viewport, margin);

  // Surface is a soft avoid rect with high penalty weight
  const effectiveSoft: Array<{ rect: PlacementRect; weight: number }> =
    soft.map((s) => ({ rect: s, weight: 10 }));
  if (surfaceBounds) {
    effectiveSoft.push({ rect: surfaceBounds, weight: 100 });
  }

  // Inside fallback: anchor fills > 60% of viewport area
  const viewportArea = viewport.width * viewport.height;
  if (anchor.width * anchor.height > viewportArea * 0.6) {
    const insideWidth = Math.min(cardWidths[0], anchor.width - margin * 2);
    const x = anchor.left + anchor.width / 2 - insideWidth / 2;
    const y = anchor.top + margin;
    return {
      x,
      y,
      width: insideWidth,
      height: cardHeight,
      side: preferred,
      mode: "inside",
      leader: null,
    };
  }

  // Build side sweep order: preferred, opposite, then the other two
  const opp = opposite(preferred);
  const others = SIDE_ORDER.filter((s) => s !== preferred && s !== opp);
  const sideOrder: PlacementSide[] = [preferred, opp, ...others];

  interface Candidate {
    card: PlacementRect;
    leader: PlacementLeader | null;
    mode: PlacementMode;
    score: number;
    side: PlacementSide;
    width: number;
  }

  const survivors: Candidate[] = [];

  for (const width of cardWidths) {
    for (const side of sideOrder) {
      // Sweep: try aligned start, center, end, then sweep in 24px steps
      const { left: idealLeft, top: idealTop } = candidatePosition(
        side,
        anchor,
        width,
        cardHeight,
        gap,
        bounds
      );

      const sweepPositions: { left: number; top: number }[] = [];

      if (side === "right" || side === "left") {
        // Sweep vertically
        let t = bounds.top;
        while (t + cardHeight <= bounds.top + bounds.height) {
          sweepPositions.push({ left: idealLeft, top: t });
          t += 24;
        }
        // Always include ideal
        sweepPositions.push({ left: idealLeft, top: idealTop });
      } else {
        // If anchor is top-right or bottom-right, don't sweep across the screen over the target
        const isTopRight =
          anchor.top < bounds.top + 80 &&
          anchor.left + anchor.width > bounds.left + bounds.width - 250;
        const isBottomRight =
          anchor.left > bounds.left + bounds.width * 0.4 &&
          anchor.top > bounds.top + bounds.height * 0.4;

        if (isTopRight || isBottomRight) {
          sweepPositions.push({ left: idealLeft, top: idealTop });
        } else {
          // Sweep horizontally
          let l = bounds.left;
          while (l + width <= bounds.left + bounds.width) {
            sweepPositions.push({ left: l, top: idealTop });
            l += 24;
          }
          sweepPositions.push({ left: idealLeft, top: idealTop });
        }
      }

      for (const pos of sweepPositions) {
        const card: PlacementRect = {
          left: pos.left,
          top: pos.top,
          width,
          height: cardHeight,
        };

        // Reject: outside effective bounds
        if (!insideBounds(card, bounds)) {
          continue;
        }

        // Reject: overlaps anchor
        if (rectsOverlap(card, anchor)) {
          continue;
        }

        // Reject: overlaps any hard rect
        let hardViolation = false;
        for (const h of hard) {
          if (rectsOverlap(card, h)) {
            hardViolation = true;
            break;
          }
        }
        if (hardViolation) {
          continue;
        }

        // Score: soft overlap area × weight + distance from ideal + side penalty
        let softScore = 0;
        for (const s of effectiveSoft) {
          softScore += overlapArea(card, s.rect) * s.weight;
        }
        const distFromIdeal =
          Math.abs(card.left - idealLeft) + Math.abs(card.top - idealTop);
        const sp = sidePriority(side, preferred) * 5000;
        const score = softScore + distFromIdeal + sp;

        // Distance to gap: adjacent if <= 48px
        const actualGapDist = (() => {
          switch (side) {
            case "right":
              return card.left - (anchor.left + anchor.width);
            case "left":
              return anchor.left - (card.left + card.width);
            case "bottom":
              return card.top - (anchor.top + anchor.height);
            case "top":
              return anchor.top - (card.top + card.height);
            default:
              return 0;
          }
        })();
        const mode: PlacementMode = actualGapDist <= 48 ? "adjacent" : "slid";

        survivors.push({
          card,
          side,
          width,
          score,
          mode,
          leader: mode === "slid" ? buildLeader(card, anchor, side, gap) : null,
        });
      }
    }
  }

  if (survivors.length > 0) {
    survivors.sort((a, b) => a.score - b.score);
    const winner = survivors[0]!;
    return {
      x: winner.card.left,
      y: winner.card.top,
      width: winner.width,
      height: cardHeight,
      side: winner.side,
      mode: winner.mode,
      leader: winner.leader,
    };
  }

  // Relaxed pass: ignore soft overlap scoring, try compact width only
  for (const side of sideOrder) {
    const width = cardWidths[1]!;
    const { left, top } = candidatePosition(
      side,
      anchor,
      width,
      cardHeight,
      gap,
      bounds
    );
    const card: PlacementRect = { left, top, width, height: cardHeight };

    if (!insideBounds(card, bounds)) {
      continue;
    }
    if (rectsOverlap(card, anchor)) {
      continue;
    }
    let hardViolation = false;
    for (const h of hard) {
      if (rectsOverlap(card, h)) {
        hardViolation = true;
        break;
      }
    }
    if (hardViolation) {
      continue;
    }

    return {
      x: card.left,
      y: card.top,
      width,
      height: cardHeight,
      side,
      mode: "relaxed",
      leader: buildLeader(card, anchor, side, gap),
    };
  }

  // Last resort: pick clearance side guaranteed to never overlap anchor
  const spaceRight = viewport.width - (anchor.left + anchor.width);
  const spaceLeft = anchor.left;
  const spaceBottom = viewport.height - (anchor.top + anchor.height);
  const spaceTop = anchor.top;

  const spaces: { side: PlacementSide; space: number }[] = [
    { side: "right", space: spaceRight },
    { side: "left", space: spaceLeft },
    { side: "bottom", space: spaceBottom },
    { side: "top", space: spaceTop },
  ];
  // Prioritize preferred side if it has adequate clearance
  spaces.sort((a, b) => {
    const aPref = a.side === preferred ? 1 : 0;
    const bPref = b.side === preferred ? 1 : 0;
    if (aPref !== bPref) {
      return bPref - aPref;
    }
    return b.space - a.space;
  });

  const fallbackWidth = cardWidths[1]!;

  for (const { side } of spaces) {
    let left = 0;
    let top = 0;
    const cx = anchor.left + anchor.width / 2;
    const cy = anchor.top + anchor.height / 2;

    switch (side) {
      case "right":
        left = anchor.left + anchor.width + gap;
        top = clamp(
          cy - cardHeight / 2,
          bounds.top,
          bounds.top + bounds.height - cardHeight
        );
        break;
      case "left":
        left = anchor.left - fallbackWidth - gap;
        top = clamp(
          cy - cardHeight / 2,
          bounds.top,
          bounds.top + bounds.height - cardHeight
        );
        break;
      case "bottom":
        top = anchor.top + anchor.height + gap;
        left = clamp(
          cx - fallbackWidth / 2,
          bounds.left,
          bounds.left + bounds.width - fallbackWidth
        );
        break;
      case "top":
        top = anchor.top - cardHeight - gap;
        left = clamp(
          cx - fallbackWidth / 2,
          bounds.left,
          bounds.left + bounds.width - fallbackWidth
        );
        break;
      default:
        break;
    }

    const testCard: PlacementRect = {
      left,
      top,
      width: fallbackWidth,
      height: cardHeight,
    };

    if (!rectsOverlap(testCard, anchor)) {
      let finalLeft = clamp(
        testCard.left,
        bounds.left,
        bounds.left + bounds.width - fallbackWidth
      );
      let finalTop = clamp(
        testCard.top,
        bounds.top,
        bounds.top + bounds.height - cardHeight
      );

      // Clamp must NEVER cause overlap with anchor
      if (side === "right" && finalLeft < anchor.left + anchor.width + gap) {
        finalLeft = anchor.left + anchor.width + gap;
      } else if (
        side === "left" &&
        finalLeft + fallbackWidth > anchor.left - gap
      ) {
        finalLeft = anchor.left - fallbackWidth - gap;
      } else if (
        side === "bottom" &&
        finalTop < anchor.top + anchor.height + gap
      ) {
        finalTop = anchor.top + anchor.height + gap;
      } else if (side === "top" && finalTop + cardHeight > anchor.top - gap) {
        finalTop = anchor.top - cardHeight - gap;
      }

      const finalCard: PlacementRect = {
        left: finalLeft,
        top: finalTop,
        width: fallbackWidth,
        height: cardHeight,
      };

      return {
        x: finalCard.left,
        y: finalCard.top,
        width: fallbackWidth,
        height: cardHeight,
        side,
        mode: "relaxed",
        leader: buildLeader(finalCard, anchor, side, gap),
      };
    }
  }

  // Absolute safety net: place at bestSide without clamping across anchor
  const bestSide = spaces[0]?.side ?? "right";
  let safeLeft = bounds.left;
  let safeTop = bounds.top;
  if (bestSide === "right") {
    safeLeft = anchor.left + anchor.width + gap;
    safeTop = clamp(
      anchor.top,
      bounds.top,
      bounds.top + bounds.height - cardHeight
    );
  } else if (bestSide === "left") {
    safeLeft = Math.max(0, anchor.left - fallbackWidth - gap);
    safeTop = clamp(
      anchor.top,
      bounds.top,
      bounds.top + bounds.height - cardHeight
    );
  } else if (bestSide === "bottom") {
    safeLeft = clamp(
      anchor.left,
      bounds.left,
      bounds.left + bounds.width - fallbackWidth
    );
    safeTop = anchor.top + anchor.height + gap;
  } else {
    safeLeft = clamp(
      anchor.left,
      bounds.left,
      bounds.left + bounds.width - fallbackWidth
    );
    safeTop = Math.max(0, anchor.top - cardHeight - gap);
  }

  const safeCard: PlacementRect = {
    left: safeLeft,
    top: safeTop,
    width: fallbackWidth,
    height: cardHeight,
  };

  return {
    x: safeCard.left,
    y: safeCard.top,
    width: fallbackWidth,
    height: cardHeight,
    side: bestSide,
    mode: "relaxed",
    leader: buildLeader(safeCard, anchor, bestSide, gap),
  };
}

// ─── V2 Placement Engine ───────────────────────────────────────────────────

function computeCardPlacementV2(input: PlacementInput): PlacementResult {
  const {
    anchor,
    cardWidths,
    cardHeight,
    gap: inputGap,
    hard,
    margin: inputMargin,
    preferred,
    soft,
    viewport,
    previousSide,
    previousCardCenter,
    previousSurface,
    currentSurface,
    nextTargetRect,
    interactiveRects = [],
  } = input;

  // Mobile viewport (< 640px): dock card as a bottom sheet (same as V1)
  if (viewport.width < 640) {
    const sheetMargin = 8;
    const sheetWidth = Math.max(0, viewport.width - sheetMargin * 2);
    const sheetY = Math.max(
      sheetMargin,
      viewport.height - cardHeight - sheetMargin
    );
    return {
      x: sheetMargin,
      y: sheetY,
      width: sheetWidth,
      height: cardHeight,
      side: "bottom",
      mode: "bottom-sheet",
      leader: null,
    };
  }

  // Inside fallback: anchor fills > 60% of viewport area
  const viewportArea = viewport.width * viewport.height;
  if (anchor.width * anchor.height > viewportArea * 0.6) {
    const insideWidth = Math.min(
      cardWidths[0],
      anchor.width - (inputMargin || 16) * 2
    );
    const x = anchor.left + anchor.width / 2 - insideWidth / 2;
    const y = anchor.top + (inputMargin || 16);
    return {
      x,
      y,
      width: insideWidth,
      height: cardHeight,
      side: preferred,
      mode: "inside",
      leader: null,
    };
  }

  // H1: The card never overlaps the cutout inflated by 12px
  const INFLATION = 12;
  const inflatedCutout: PlacementRect = {
    left: anchor.left - INFLATION,
    top: anchor.top - INFLATION,
    width: anchor.width + INFLATION * 2,
    height: anchor.height + INFLATION * 2,
  };

  // H2: Viewport margin - 16px minimum, prefer 24px where it fits
  const MIN_MARGIN = 16;
  const PREFERRED_MARGIN = Math.min(24, Math.max(16, inputMargin || 24));
  const viewportBoundsMin: PlacementRect = {
    left: MIN_MARGIN,
    top: MIN_MARGIN,
    width: Math.max(0, viewport.width - MIN_MARGIN * 2),
    height: Math.max(0, viewport.height - MIN_MARGIN * 2),
  };

  // Gap: 12px to 20px, default 16px
  const gap = clamp(inputGap || 16, 12, 20);

  // Side lock (P2): within one surface keep the SAME side as previous step
  const sameSurface = Boolean(
    currentSurface && previousSurface && currentSurface === previousSurface
  );
  const lockedSide = sameSurface && previousSide ? previousSide : null;

  // Edge target detection (P5)
  const isTopRight =
    anchor.top < 90 && anchor.left + anchor.width > viewport.width - 250;
  const isBottomLeft =
    anchor.left < 140 && anchor.top + anchor.height > viewport.height - 120;
  const isRightDockedPanel = anchor.left > viewport.width - 450;

  // Order of sides to evaluate (P1): right, then left, then below, then above
  const baseSides: PlacementSide[] = ["right", "left", "bottom", "top"];

  const sidePriorityOrder: PlacementSide[] = [];
  if (isTopRight) {
    sidePriorityOrder.push("bottom", "left", "right", "top");
  } else if (isBottomLeft) {
    sidePriorityOrder.push("right", "top", "bottom", "left");
  } else if (isRightDockedPanel) {
    sidePriorityOrder.push("left", "bottom", "top", "right");
  } else if (lockedSide) {
    sidePriorityOrder.push(lockedSide);
    for (const s of baseSides) {
      if (!sidePriorityOrder.includes(s)) {
        sidePriorityOrder.push(s);
      }
    }
  } else if (preferred && preferred !== "bottom-sheet") {
    sidePriorityOrder.push(preferred);
    for (const s of baseSides) {
      if (!sidePriorityOrder.includes(s)) {
        sidePriorityOrder.push(s);
      }
    }
  } else {
    sidePriorityOrder.push(...baseSides);
  }

  // P6: For wide targets, if right side has no room, prefer below or above
  if (
    anchor.width > 500 &&
    !isRightDockedPanel &&
    !isTopRight &&
    !isBottomLeft
  ) {
    const spaceOnRight =
      viewport.width - MIN_MARGIN - (anchor.left + anchor.width + gap);
    if (spaceOnRight < cardWidths[1]) {
      // Re-order to try bottom and top before left
      const filtered = sidePriorityOrder.filter(
        (s) => s !== "bottom" && s !== "top"
      );
      sidePriorityOrder.length = 0;
      sidePriorityOrder.push("bottom", "top", ...filtered);
    }
  }

  interface Candidate {
    actualGap: number;
    breaksH3: boolean;
    card: PlacementRect;
    score: number;
    side: PlacementSide;
    targetOverlap: number;
    width: number;
  }

  const validCandidates: Candidate[] = [];
  const fallbackCandidates: Candidate[] = [];

  for (const width of cardWidths) {
    for (const side of sidePriorityOrder) {
      const cx = anchor.left + anchor.width / 2;
      const cy = anchor.top + anchor.height / 2;

      let idealLeft = 0;
      let idealTop = 0;

      if (side === "right") {
        idealLeft = anchor.left + anchor.width + gap;
        idealTop = cy - cardHeight / 2;
        if (isBottomLeft) {
          idealTop = Math.min(
            idealTop,
            anchor.top + anchor.height - cardHeight
          );
        }
      } else if (side === "left") {
        idealLeft = anchor.left - width - gap;
        idealTop = cy - cardHeight / 2;
      } else if (side === "bottom") {
        idealTop = anchor.top + anchor.height + gap;
        idealLeft = cx - width / 2;
        if (isTopRight) {
          idealLeft = Math.min(
            idealLeft,
            viewport.width - PREFERRED_MARGIN - width
          );
        }
      } else if (side === "top") {
        idealTop = anchor.top - cardHeight - gap;
        idealLeft = cx - width / 2;
        if (isBottomLeft) {
          idealLeft = Math.max(idealLeft, PREFERRED_MARGIN);
        }
      }

      // Test margins: preferred (24px) first, then fallback to min (16px)
      const clampMargins = [PREFERRED_MARGIN, MIN_MARGIN];
      for (const m of clampMargins) {
        const bounds: PlacementRect = {
          left: m,
          top: m,
          width: Math.max(0, viewport.width - m * 2),
          height: Math.max(0, viewport.height - m * 2),
        };

        let clampedTop = idealTop;
        let clampedLeft = idealLeft;

        if (side === "right" || side === "left") {
          clampedTop = clamp(
            idealTop,
            bounds.top,
            bounds.top + bounds.height - cardHeight
          );
        } else {
          clampedLeft = clamp(
            idealLeft,
            bounds.left,
            bounds.left + bounds.width - width
          );
        }

        // Test tangent offsets along perpendicular axis
        const tangentOffsets = [0, -24, 24, -48, 48, -72, 72, -96, 96];
        // Also test nudges that clear any hard rects
        const extraTangentTops: number[] = [];
        const extraTangentLefts: number[] = [];
        if (side === "right" || side === "left") {
          for (const h of hard) {
            extraTangentTops.push(h.top + h.height + 4);
            extraTangentTops.push(h.top - cardHeight - 4);
          }
        } else {
          for (const h of hard) {
            extraTangentLefts.push(h.left + h.width + 4);
            extraTangentLefts.push(h.left - width - 4);
          }
        }

        const candidatePositions: Array<{
          left: number;
          top: number;
          offset: number;
        }> = [];
        for (const offset of tangentOffsets) {
          const testLeft =
            side === "right" || side === "left"
              ? clampedLeft
              : clamp(
                  clampedLeft + offset,
                  bounds.left,
                  bounds.left + bounds.width - width
                );
          const testTop =
            side === "bottom" || side === "top"
              ? clampedTop
              : clamp(
                  clampedTop + offset,
                  bounds.top,
                  bounds.top + bounds.height - cardHeight
                );
          candidatePositions.push({ left: testLeft, top: testTop, offset });
        }
        for (const tTop of extraTangentTops) {
          const clamped = clamp(
            tTop,
            bounds.top,
            bounds.top + bounds.height - cardHeight
          );
          candidatePositions.push({
            left: clampedLeft,
            top: clamped,
            offset: Math.abs(clamped - idealTop),
          });
        }
        for (const tLeft of extraTangentLefts) {
          const clamped = clamp(
            tLeft,
            bounds.left,
            bounds.left + bounds.width - width
          );
          candidatePositions.push({
            left: clamped,
            top: clampedTop,
            offset: Math.abs(clamped - idealLeft),
          });
        }

        for (const pos of candidatePositions) {
          const card: PlacementRect = {
            left: pos.left,
            top: pos.top,
            width,
            height: cardHeight,
          };

          // H2 check: must stay fully inside viewport bounds
          if (!insideBounds(card, viewportBoundsMin)) {
            continue;
          }

          // H1 check: must never overlap inflated cutout
          const overlapsCutout = rectsOverlap(card, inflatedCutout);
          const rawTargetOverlap = overlapArea(card, anchor);

          // H4 check: must never overlap hard rects (open popovers)
          let hardOverlap = false;
          for (const h of hard) {
            if (rectsOverlap(card, h)) {
              hardOverlap = true;
              break;
            }
          }
          if (hardOverlap) {
            continue;
          }

          // Gap calculation
          let actualGap = 0;
          if (side === "right") {
            actualGap = card.left - (anchor.left + anchor.width);
          } else if (side === "left") {
            actualGap = anchor.left - (card.left + card.width);
          } else if (side === "bottom") {
            actualGap = card.top - (anchor.top + anchor.height);
          } else if (side === "top") {
            actualGap = anchor.top - (card.top + card.height);
          }

          // H3 check: avoids next target if visible
          const breaksH3 = Boolean(
            nextTargetRect && rectsOverlap(card, nextTargetRect)
          );

          // P2: Side penalty
          let sidePenalty = 0;
          if (lockedSide) {
            if (side === lockedSide) {
              sidePenalty = 0;
            } else {
              sidePenalty = 50_000;
            }
          } else if (side === preferred) {
            sidePenalty = 0;
          } else if (side === "right") {
            sidePenalty = 500;
          } else if (side === "left") {
            sidePenalty = 1000;
          } else if (side === "bottom") {
            sidePenalty = 1500;
          } else {
            sidePenalty = 2000;
          }

          // P3: Less mouse travel
          let travelScore = 0;
          if (previousCardCenter) {
            const cardCenter = {
              x: card.left + card.width / 2,
              y: card.top + card.height / 2,
            };
            const dist = Math.hypot(
              cardCenter.x - previousCardCenter.x,
              cardCenter.y - previousCardCenter.y
            );
            travelScore = dist * 0.6;
          }

          // P4: Least disturbance of interactive controls
          let disturbanceScore = 0;
          for (const ctrl of interactiveRects) {
            disturbanceScore += overlapArea(card, ctrl) * 0.2;
          }
          for (const s of soft) {
            disturbanceScore += overlapArea(card, s) * 0.05;
          }

          // Minor penalties: prefer centered alignment and full card width
          const tangentPenalty = Math.abs(pos.offset) * 2;
          const widthPenalty = width === cardWidths[0] ? 0 : 40;
          const h3Penalty = breaksH3 ? 20_000 : 0;
          const nonAdjacentPenalty =
            actualGap > 48 ? (actualGap - 48) * 100 : 0;

          const totalScore =
            sidePenalty +
            travelScore +
            disturbanceScore +
            tangentPenalty +
            widthPenalty +
            h3Penalty +
            nonAdjacentPenalty;

          const cand: Candidate = {
            card,
            side,
            width,
            score: totalScore,
            actualGap,
            breaksH3,
            targetOverlap: rawTargetOverlap,
          };

          if (overlapsCutout) {
            fallbackCandidates.push(cand);
          } else {
            validCandidates.push(cand);
          }
        }
      }
    }
  }

  // Pick winner
  let winner: Candidate | null = null;

  if (validCandidates.length > 0) {
    // Prefer candidates that do NOT break H3
    const h3Satisfied = validCandidates.filter((c) => !c.breaksH3);
    const pool = h3Satisfied.length > 0 ? h3Satisfied : validCandidates;
    pool.sort((a, b) => a.score - b.score);
    winner = pool[0]!;
  } else if (fallbackCandidates.length > 0) {
    // Fallback: pick candidate with zero target overlap and smallest score
    fallbackCandidates.sort(
      (a, b) => a.targetOverlap - b.targetOverlap || a.score - b.score
    );
    winner = fallbackCandidates[0]!;
  }

  if (winner) {
    const mode: PlacementMode = winner.actualGap <= 48 ? "adjacent" : "slid";
    const leader =
      winner.actualGap > 48
        ? buildLeader(winner.card, anchor, winner.side, gap)
        : null;

    return {
      x: winner.card.left,
      y: winner.card.top,
      width: winner.width,
      height: cardHeight,
      side: winner.side,
      mode,
      leader,
    };
  }

  // Extreme safety fallback: call V1
  return computeCardPlacementV1(input);
}

// ─── Main Export ───────────────────────────────────────────────────────────

export function computeCardPlacement(input: PlacementInput): PlacementResult {
  if (!TOUR_PLACEMENT_V2) {
    return computeCardPlacementV1(input);
  }
  try {
    return computeCardPlacementV2(input);
  } catch (err) {
    console.warn("[TourPlacement] V2 failed, falling back to V1:", err);
    return computeCardPlacementV1(input);
  }
}
