import { describe, expect, it } from "vitest";
import {
  classifyIntent,
  type IntentSignals,
  isSensitiveField,
} from "./tour-intent";

describe("tour-intent classifier and privacy guard", () => {
  it("strictly identifies sensitive and credential fields for privacy", () => {
    expect(isSensitiveField("password", "password")).toBe(true);
    expect(isSensitiveField("openai-api-key", "text")).toBe(true);
    expect(isSensitiveField("anthropic_token", "text")).toBe(true);
    expect(isSensitiveField("user-secret", "text")).toBe(true);
    expect(isSensitiveField("auth-credential", "text")).toBe(true);
    expect(isSensitiveField("workspace-name-input", "text")).toBe(false);
    expect(isSensitiveField("workspace-dir-input", "text")).toBe(false);
  });

  it("classifies default state as focused", () => {
    const signals: IntentSignals = {
      dwellTimeMs: 2000,
      outsideClicks: 0,
      rapidNavCount: 0,
      idleDurationMs: 500,
      stepType: "info",
    };
    const result = classifyIntent(signals);
    expect(result.intent).toBe("focused");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.shouldPulseAnchor).toBe(false);
  });

  it("classifies hesitating on action steps when dwelling with no action taken", () => {
    const signals: IntentSignals = {
      dwellTimeMs: 12_000,
      outsideClicks: 0,
      rapidNavCount: 0,
      idleDurationMs: 4000,
      stepType: "action",
      isActionSatisfied: false,
    };
    const result = classifyIntent(signals);
    expect(result.intent).toBe("hesitating");
    expect(result.recommendedNudgeLevel).toBe(1);
    expect(result.shouldPulseAnchor).toBe(true);

    // After 20 seconds, escalates to nudge level 2
    const prolongedResult = classifyIntent({
      ...signals,
      dwellTimeMs: 22_000,
    });
    expect(prolongedResult.recommendedNudgeLevel).toBe(2);
    expect(prolongedResult.guidanceText).toBeDefined();
  });

  it("classifies confused when user clicks blocked Next or clicks repeatedly outside", () => {
    const signals: IntentSignals = {
      dwellTimeMs: 5000,
      outsideClicks: 1,
      rapidNavCount: 0,
      idleDurationMs: 1000,
      stepType: "action",
      blockedNextClicks: 2,
    };
    const result = classifyIntent(signals);
    expect(result.intent).toBe("confused");
    expect(result.recommendedNudgeLevel).toBe(2);
    expect(result.shouldPulseAnchor).toBe(true);
  });

  it("classifies skimming when rapid navigation occurs", () => {
    const signals: IntentSignals = {
      dwellTimeMs: 3000,
      outsideClicks: 0,
      rapidNavCount: 4,
      idleDurationMs: 200,
      stepType: "info",
    };
    const result = classifyIntent(signals);
    expect(result.intent).toBe("skimming");
  });

  it("classifies stalled on prolonged inactivity", () => {
    const signals: IntentSignals = {
      dwellTimeMs: 35_000,
      outsideClicks: 0,
      rapidNavCount: 0,
      idleDurationMs: 28_000,
      stepType: "info",
    };
    const result = classifyIntent(signals);
    expect(result.intent).toBe("stalled");
    expect(result.recommendedNudgeLevel).toBe(3);
  });

  it("classifies leaving when cursor hovers exit area", () => {
    const signals: IntentSignals = {
      dwellTimeMs: 6000,
      outsideClicks: 0,
      rapidNavCount: 0,
      idleDurationMs: 500,
      stepType: "action",
      cursorNearExit: true,
    };
    const result = classifyIntent(signals);
    expect(result.intent).toBe("leaving");
    expect(result.recommendedNudgeLevel).toBe(3);
  });
});
