/**
 * welcome.constants.ts — Localizable literal strings & copy for Welcome Scene (Step 0).
 * Kept in this dedicated file to make future i18n extraction seamless.
 */

export const WELCOME_STRINGS = {
  appName: "Marshell",
  headlinePrefix: "Welcome to ",
  subtitle: "Your AI development command center.",
  ctaStart: "Start the tour",
  ctaSkip: "Skip for now",
  footerReplay: "Replay anytime in Settings → Tutorials.",
  durationEstimate: "About 2 minutes",
  previewItems: [
    { id: "workspace", label: "WORKSPACE" },
    { id: "terminals", label: "TERMINALS" },
    { id: "agents", label: "AI AGENTS" },
  ],
  systemTiles: [
    { id: "sys_01", code: "SYS.CORE", name: "Autonomous Core" },
    { id: "sys_02", code: "SYS.TERM", name: "PTY Terminal Grid" },
    { id: "sys_03", code: "SYS.AGNT", name: "Subagent Swarm" },
    { id: "sys_04", code: "SYS.SYNC", name: "State Telemetry" },
  ],
} as const;

/** Single feature flag to toggle decorative boot log ticker */
export const ENABLE_BOOT_LOG_TICKER = true;

export const BOOT_LOG_LINES = [
  { id: "log_01", text: "initializing agents" },
  { id: "log_02", text: "mounting terminal matrix" },
  { id: "log_03", text: "telemetry channels active" },
] as const;
