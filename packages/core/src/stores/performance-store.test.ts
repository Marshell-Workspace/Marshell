import {
  getPerformancePolicy,
  normalizeTier,
  usePerformanceStore,
} from "@workspace/core/stores/performance-store";
import { beforeEach, describe, expect, it } from "vitest";

describe("performance-store", () => {
  beforeEach(() => {
    usePerformanceStore.setState({
      tier: "balanced",
      userTier: "balanced",
      policy: getPerformancePolicy("balanced"),
      autoDetected: true,
      autoEcoOnLowBattery: true,
      battery: {
        supported: false,
        charging: true,
        chargingTime: 0,
        dischargingTime: Number.POSITIVE_INFINITY,
        level: 100,
        isLow: false,
        isCritical: false,
      },
      visibility: {
        isVisible: true,
        isFocused: true,
        visibilityState: "visible",
      },
    });
  });

  describe("normalizeTier", () => {
    it("normalizes null or undefined to balanced", () => {
      expect(normalizeTier(null)).toBe("balanced");
      expect(normalizeTier(undefined)).toBe("balanced");
      expect(normalizeTier("")).toBe("balanced");
    });

    it("normalizes eco variants to eco", () => {
      expect(normalizeTier("eco")).toBe("eco");
      expect(normalizeTier("ECO")).toBe("eco");
    });

    it("normalizes performance, turbo, and full variants to performance", () => {
      expect(normalizeTier("performance")).toBe("performance");
      expect(normalizeTier("turbo")).toBe("performance");
      expect(normalizeTier("full")).toBe("performance");
      expect(normalizeTier("TURBO")).toBe("performance");
    });

    it("falls back to balanced for unknown tiers", () => {
      expect(normalizeTier("unknown")).toBe("balanced");
    });
  });

  describe("getPerformancePolicy", () => {
    it("keeps the same appearance and terminal features in every mode", () => {
      const appearance = (tier: "eco" | "balanced" | "performance") => {
        const {
          aiStreamingBatchMs,
          avatarFps,
          prefetch,
          terminalWriteBatchMs,
          ...visuals
        } = getPerformancePolicy(tier).features;
        return visuals;
      };
      expect(appearance("eco")).toEqual(appearance("balanced"));
      expect(appearance("performance")).toEqual(appearance("balanced"));
      expect(appearance("eco").avatarMode).toBe("animated");
      expect(appearance("eco").terminalAncillaryUI).toBe("full");
    });
    it("uses progressively larger batches without exceeding interactive latency budgets", () => {
      const turbo = getPerformancePolicy("performance").features;
      const balanced = getPerformancePolicy("balanced").features;
      const eco = getPerformancePolicy("eco").features;
      expect(turbo.terminalWriteBatchMs).toBeLessThan(
        balanced.terminalWriteBatchMs
      );
      expect(balanced.terminalWriteBatchMs).toBeLessThan(
        eco.terminalWriteBatchMs
      );
      expect(eco.terminalWriteBatchMs).toBeLessThanOrEqual(32);
      expect(turbo.aiStreamingBatchMs).toBeLessThan(
        balanced.aiStreamingBatchMs
      );
      expect(balanced.aiStreamingBatchMs).toBeLessThan(eco.aiStreamingBatchMs);
      expect(eco.aiStreamingBatchMs).toBeLessThanOrEqual(50);
      expect(eco.prefetch).toBe(false);
      expect(eco.avatarFps).toBeLessThan(balanced.avatarFps);
      expect(turbo.prefetch).toBe(true);
    });
  });

  describe("store actions", () => {
    it("updates tier manually via setTier", () => {
      const store = usePerformanceStore.getState();
      store.setTier("performance");

      const state = usePerformanceStore.getState();
      expect(state.userTier).toBe("performance");
      expect(state.tier).toBe("performance");
      expect(state.policy.tier).toBe("performance");
      expect(state.autoDetected).toBe(false);
    });

    it("automatically degrades to eco when battery is low and uncharged", () => {
      const store = usePerformanceStore.getState();
      store.setTier("performance");
      store.onBatteryChange({
        supported: true,
        charging: false,
        chargingTime: 0,
        dischargingTime: 3600,
        level: 10,
        isLow: true,
        isCritical: false,
      });

      const state = usePerformanceStore.getState();
      expect(state.userTier).toBe("performance"); // User choice preserved
      expect(state.tier).toBe("eco"); // Effective tier switched to eco
      expect(state.policy.tier).toBe("eco");
    });

    it("restores user tier when charging resumes", () => {
      const store = usePerformanceStore.getState();
      store.setTier("performance");
      store.onBatteryChange({
        supported: true,
        charging: false,
        chargingTime: 0,
        dischargingTime: 3600,
        level: 10,
        isLow: true,
        isCritical: false,
      });
      expect(usePerformanceStore.getState().tier).toBe("eco");

      store.onBatteryChange({
        supported: true,
        charging: true,
        chargingTime: 3600,
        dischargingTime: Number.POSITIVE_INFINITY,
        level: 15,
        isLow: false,
        isCritical: false,
      });
      expect(usePerformanceStore.getState().tier).toBe("performance");
    });

    it("updates visibility state without throwing", () => {
      const store = usePerformanceStore.getState();
      store.onVisibilityChange({
        isVisible: false,
        isFocused: false,
        visibilityState: "hidden",
      });

      expect(usePerformanceStore.getState().visibility.visibilityState).toBe(
        "hidden"
      );
    });
  });
});
