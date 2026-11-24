"use client";

import { SignalLine } from "@workspace/core/components/common/tour/ui/signal-line";

export interface LeaderLineProps {
  /** Accent color string */
  accent: string;
  /** Card rect */
  card: { height: number; left: number; top: number; width: number };
  /** Whether reduced motion is active */
  reducedMotion?: boolean;
  /** Side the card is on relative to the anchor */
  side: "top" | "bottom" | "left" | "right" | "bottom-sheet";
  /** Performance tier */
  tier?: "performance" | "balanced" | "eco";
  /** Anchor rect center point */
  to: { x: number; y: number };
  /** Only render when visible */
  visible: boolean;
}

/**
 * Tactical SignalLine leader connecting card edge to target anchor with
 * an animated origin trace and pulsing telemetry target node.
 */
export function LeaderLine({
  card,
  side,
  to,
  accent,
  visible,
  tier = "performance",
  reducedMotion = false,
}: LeaderLineProps) {
  if (!visible || side === "bottom-sheet") {
    return null;
  }

  // Compute the start point on the card edge facing the anchor
  let fromX = 0;
  let fromY = 0;
  const cardCx = card.left + card.width / 2;
  const cardCy = card.top + card.height / 2;

  switch (side) {
    case "right":
      fromX = card.left;
      fromY = cardCy;
      break;
    case "left":
      fromX = card.left + card.width;
      fromY = cardCy;
      break;
    case "bottom":
      fromX = cardCx;
      fromY = card.top;
      break;
    case "top":
      fromX = cardCx;
      fromY = card.top + card.height;
      break;
    default:
      fromX = cardCx;
      fromY = cardCy;
      break;
  }

  return (
    <SignalLine
      accent={accent}
      animated={true}
      from={{ x: fromX, y: fromY }}
      nodeEnd={true}
      nodeStart={true}
      reducedMotion={reducedMotion}
      tier={tier}
      to={to}
    />
  );
}
