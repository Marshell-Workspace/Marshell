export const AVATAR_BEHAVIOR_CONFIG = {
  promptReactions: {
    surprisedAtWords: 50, // Lower threshold so 50+ word prompts trigger wide open eyes easily
    stronglySurprisedAtWords: 300,
  },

  timing: {
    surprised: 2200, // 2.2 seconds for full 37 frames (0135-0171)
    strongSurprised: 2500,
    wink: 1200,
  },

  cooldowns: {
    surprised: 1000, // Short cooldown so long prompts reliably trigger
    wink: 1000,
  },

  complexity: {
    maxSimpleWords: 50,
    maxQuestions: 2,
    maxRequirements: 3,
    complexityThreshold: 2,
  },

  burstDebounceMs: 1000,
} as const;

export type AvatarBehaviorConfig = typeof AVATAR_BEHAVIOR_CONFIG;
