/**
 * completion.constants.ts — Localizable literal strings & copy for Completion Scene (Step 13).
 * Kept in this dedicated file to make future i18n extraction seamless.
 */

export const COMPLETION_STRINGS = {
  badgeStatus: "READY",
  title: "You're all set.",
  subtitle:
    "Your command center is ready. Start building with your terminal workspaces and tasks.",
  sectionKeepExploring: "Keep exploring",
  ctaDone: "Start building",
  ctaBack: "Back",
  ctaSkip: "Skip tour",
  recapWorkspaceLabel: "Workspace",
  recapTerminalsLabel: "Terminals",
  recapStatusCreated: "created",
  recapStatusRunning: "running",
  tours: {
    settings: {
      id: "settings" as const,
      title: "Settings tour",
      description: "Configure appearance, shortcuts, and environment · 1 min",
      duration: "1 min",
      startAction: "Start tour",
      replayAction: "Replay tour",
    },
  },
} as const;
