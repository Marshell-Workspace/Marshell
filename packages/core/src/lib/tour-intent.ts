/**
 * Passive intent classification and progressive nudge ladder for interactive tours.
 *
 * Adheres to strict privacy boundaries:
 * Never observes or processes password, secret, token, or sensitive input fields.
 */

export type TourIntentType =
  | "hesitating"
  | "searching"
  | "confused"
  | "stalled"
  | "skimming"
  | "leaving"
  | "focused";

export type NudgeLevel = 1 | 2 | 3;

export interface IntentSignals {
  /** Number of times the disabled Next button was clicked */
  blockedNextClicks?: number;
  /** Whether mouse moved near window close / top bar */
  cursorNearExit?: boolean;
  /** Time spent on current step in milliseconds */
  dwellTimeMs: number;
  /** Focused element tag or role (sanitized) */
  focusedElementRole?: string;
  /** Distance cursor moved or scroll speed metric */
  idleDurationMs: number;
  /** Whether the action goal for the current step has been satisfied */
  isActionSatisfied?: boolean;
  /** Number of clicks outside target anchor during this step */
  outsideClicks: number;
  /** Number of rapid forward/backward navigation cycles */
  rapidNavCount: number;
  /** Current step type */
  stepType: "info" | "action";
}

export interface IntentClassification {
  confidence: number;
  guidanceText?: string;
  intent: TourIntentType;
  recommendedNudgeLevel: NudgeLevel;
  shouldPulseAnchor: boolean;
}

const SENSITIVE_INPUT_REGEX = /key|token|secret|password|credential|auth/i;

/**
 * Sanitizes an element descriptor to guarantee no credential or sensitive data is observed.
 */
export function isSensitiveField(
  elementName?: string,
  inputType?: string
): boolean {
  if (!(elementName || inputType)) {
    return false;
  }
  if (inputType === "password") {
    return true;
  }
  if (elementName && SENSITIVE_INPUT_REGEX.test(elementName)) {
    return true;
  }
  return false;
}

/**
 * Pure function to classify user intent during a tour step based on behavioral signals.
 */
export function classifyIntent(signals: IntentSignals): IntentClassification {
  const {
    dwellTimeMs,
    outsideClicks,
    rapidNavCount,
    idleDurationMs,
    stepType,
    isActionSatisfied = false,
    blockedNextClicks = 0,
    cursorNearExit = false,
  } = signals;

  // 1. Leaving: user cursor near exit bounds or rapid close gestures
  if (cursorNearExit && dwellTimeMs > 4000) {
    return {
      intent: "leaving",
      confidence: 0.85,
      recommendedNudgeLevel: 3,
      guidanceText:
        "Need a break? You can skip and replay anytime from Settings.",
      shouldPulseAnchor: false,
    };
  }

  // 2. Confused: clicking blocked Next button or multiple outside clicks on action step
  if (stepType === "action" && (blockedNextClicks >= 2 || outsideClicks >= 3)) {
    return {
      intent: "confused",
      confidence: 0.9,
      recommendedNudgeLevel: 2,
      guidanceText: "Click the highlighted control to complete this step.",
      shouldPulseAnchor: true,
    };
  }

  // 3. Skimming: rapid next/prev navigation back and forth
  if (rapidNavCount >= 3) {
    return {
      intent: "skimming",
      confidence: 0.8,
      recommendedNudgeLevel: 1,
      guidanceText: undefined,
      shouldPulseAnchor: false,
    };
  }

  // 4. Stalled: long idle period without interaction
  if (idleDurationMs > 25_000 && dwellTimeMs > 30_000) {
    return {
      intent: "stalled",
      confidence: 0.75,
      recommendedNudgeLevel: 3,
      guidanceText: "Still there? Click Skip to explore on your own.",
      shouldPulseAnchor: false,
    };
  }

  // 5. Hesitating: dwelling on action step longer than expected with low activity
  if (stepType === "action" && !isActionSatisfied && dwellTimeMs > 10_000) {
    const level: NudgeLevel = dwellTimeMs > 20_000 ? 2 : 1;
    return {
      intent: "hesitating",
      confidence: 0.8,
      recommendedNudgeLevel: level,
      guidanceText:
        level === 2 ? "Perform the highlighted action to continue." : undefined,
      shouldPulseAnchor: true,
    };
  }

  // 6. Searching: moderate outside clicks or scanning on info step
  if (stepType === "info" && outsideClicks >= 2) {
    return {
      intent: "searching",
      confidence: 0.7,
      recommendedNudgeLevel: 1,
      guidanceText: undefined,
      shouldPulseAnchor: false,
    };
  }

  // Default: Focused
  return {
    intent: "focused",
    confidence: 0.95,
    recommendedNudgeLevel: 1,
    guidanceText: undefined,
    shouldPulseAnchor: false,
  };
}
