/**
 * Marshell Centralized Terminal Identity Color Palette (8 refined, high-contrast dark-mode colors).
 * Each active terminal instance receives one unique color from this palette.
 */
export const TERMINAL_IDENTITY_PALETTE = [
  "#38bdf8", // Sky / Blue
  "#facc15", // Amber / Yellow
  "#c084fc", // Purple
  "#22d3ee", // Cyan
  "#fb923c", // Orange
  "#f472b6", // Pink
  "#f87171", // Red / Rose
  "#4ade80", // Lime / Green
] as const;

export type TerminalIdentityColor = (typeof TERMINAL_IDENTITY_PALETTE)[number];

/**
 * Shuffles an array randomly.
 */
export function shuffleArray<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/**
 * Selects an unused color from the palette given currently used colors in active terminals.
 */
export function getNextAvailableTerminalColor(
  usedColors: Iterable<string>
): string {
  const usedSet = new Set(usedColors);
  const available = TERMINAL_IDENTITY_PALETTE.filter((c) => !usedSet.has(c));
  if (available.length > 0) {
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex]!;
  }
  return TERMINAL_IDENTITY_PALETTE[0];
}
