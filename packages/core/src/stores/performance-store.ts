import {
  type BatteryStatus,
  batteryManager,
} from "@workspace/core/lib/hardware/battery-manager";
import {
  type VisibilityStatus,
  visibilityCoordinator,
} from "@workspace/core/lib/hardware/visibility-manager";
import { safeStorage } from "@workspace/core/lib/safe-json";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type PerformanceTier = "eco" | "balanced" | "performance";
export type LegacyPerformanceTier = "turbo" | "full";
export type AnyPerformanceTier = PerformanceTier | LegacyPerformanceTier;

export interface PerformancePolicy {
  features: {
    // Glass & Visual
    aiStreamingBatchMs: number;
    animationDuration: "fast" | "normal" | "smooth";
    animationFPS: number;
    animationQuality: "low" | "medium" | "high";
    avatarFps: number;
    // Avatar
    avatarMode: "animated" | "lightweight" | "static";
    avatarQuality: "static" | "lightweight" | "animated";
    backgroundEffects: "minimal" | "moderate" | "high";
    blurRadius: number;
    glassMode: "rich" | "lite" | "none";
    glassQuality: "none" | "lite" | "rich";
    glow: false | "subtle" | "rich";
    // Motion
    motionLevel: "full" | "reduced" | "static";
    particleEffects: boolean;
    // System / Network
    prefetch: boolean;
    refraction: boolean;
    reflection: false | "subtle" | "enhanced";
    renderingComplexity: "minimal" | "standard" | "ultra";
    shadowQuality: "minimal" | "moderate" | "enhanced";
    svgFilters: boolean;
    terminalAncillaryUI: "full" | "reduced" | "minimal";
    // Terminal
    terminalWriteBatchMs: number;
    visualQuality: "low" | "medium" | "high";
  };
  tier: PerformanceTier;
}

export function normalizeTier(raw: string | null | undefined): PerformanceTier {
  if (!raw) {
    return "balanced";
  }
  const lower = raw.toLowerCase().trim();
  if (lower === "performance" || lower === "turbo" || lower === "full") {
    return "performance";
  }
  if (lower === "eco") {
    return "eco";
  }
  return "balanced";
}

// Appearance is shared. Profiles only tune scheduling and resource use.
const SHARED_VISUAL_FEATURES = {
  animationDuration: "normal",
  animationFPS: 20,
  animationQuality: "medium",
  avatarMode: "animated",
  avatarQuality: "animated",
  backgroundEffects: "moderate",
  blurRadius: 8,
  glassMode: "lite",
  glassQuality: "lite",
  glow: "subtle",
  motionLevel: "full",
  particleEffects: false,
  reflection: "subtle",
  refraction: false,
  renderingComplexity: "standard",
  shadowQuality: "moderate",
  svgFilters: false,
  terminalAncillaryUI: "full",
  visualQuality: "medium",
} as const;

const RESOURCE_BUDGETS = {
  performance: {
    avatarFps: 20,
    aiStreamingBatchMs: 16,
    prefetch: true,
    terminalWriteBatchMs: 8,
  },
  balanced: {
    avatarFps: 20,
    aiStreamingBatchMs: 32,
    prefetch: false,
    terminalWriteBatchMs: 16,
  },
  eco: {
    avatarFps: 10,
    aiStreamingBatchMs: 48,
    prefetch: false,
    terminalWriteBatchMs: 24,
  },
} as const;

export function getPerformancePolicy(tier: PerformanceTier): PerformancePolicy {
  return {
    tier,
    features: { ...SHARED_VISUAL_FEATURES, ...RESOURCE_BUDGETS[tier] },
  };
}

interface PerformanceState {
  autoDetected: boolean;
  autoEcoOnLowBattery: boolean;
  battery: BatteryStatus;
  initTier: () => void;
  onBatteryChange: (status: BatteryStatus) => void;
  onVisibilityChange: (status: VisibilityStatus) => void;
  policy: PerformancePolicy;
  setAutoEcoOnLowBattery: (enabled: boolean) => void;
  setTier: (tier: AnyPerformanceTier) => void;
  tier: PerformanceTier;
  userTier: PerformanceTier;
  visibility: VisibilityStatus;
}

function computeEffectiveTier(
  userTier: PerformanceTier,
  autoEcoOnLowBattery: boolean,
  battery: BatteryStatus
): PerformanceTier {
  if (
    autoEcoOnLowBattery &&
    battery.supported &&
    battery.isLow &&
    !battery.charging
  ) {
    return "eco";
  }
  return userTier;
}

function detectOptimalTier(): PerformanceTier {
  if (typeof window === "undefined") {
    return "balanced";
  }

  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  )?.matches;
  if (prefersReducedMotion) {
    return "eco";
  }

  const cores = navigator.hardwareConcurrency ?? 8;
  if (cores <= 4) {
    return "eco";
  }

  const navWithMem = navigator as unknown as { deviceMemory?: number };
  if (navWithMem.deviceMemory && navWithMem.deviceMemory <= 4) {
    return "eco";
  }

  // Core count alone does not justify aggressive refresh and prefetch budgets.
  // Turbo remains a manual choice.
  return "balanced";
}

function applyTierToDom(tier: PerformanceTier) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-performance-tier", tier);
  }
}

export const usePerformanceStore = create<PerformanceState>()(
  persist(
    (set, get) => ({
      tier: "balanced",
      userTier: "balanced",
      policy: getPerformancePolicy("balanced"),
      autoDetected: true,
      autoEcoOnLowBattery: true,
      battery: batteryManager.getStatus(),
      visibility: visibilityCoordinator.getStatus(),

      setTier: (targetTier: AnyPerformanceTier) => {
        const userTier = normalizeTier(targetTier);
        const { autoEcoOnLowBattery, battery } = get();
        const effective = computeEffectiveTier(
          userTier,
          autoEcoOnLowBattery,
          battery
        );
        const policy = getPerformancePolicy(effective);
        applyTierToDom(effective);
        set({
          userTier,
          tier: effective,
          policy,
          autoDetected: false,
        });
      },

      setAutoEcoOnLowBattery: (autoEcoOnLowBattery: boolean) => {
        const { userTier, battery } = get();
        const effective = computeEffectiveTier(
          userTier,
          autoEcoOnLowBattery,
          battery
        );
        const policy = getPerformancePolicy(effective);
        applyTierToDom(effective);
        set({
          autoEcoOnLowBattery,
          tier: effective,
          policy,
        });
      },

      initTier: () => {
        const currentTier = normalizeTier(get().userTier || get().tier);
        const autoDetected = get().autoDetected;
        let optimalUserTier = currentTier;
        if (autoDetected) {
          optimalUserTier = detectOptimalTier();
        }
        const { autoEcoOnLowBattery, battery } = get();
        const effective = computeEffectiveTier(
          optimalUserTier,
          autoEcoOnLowBattery,
          battery
        );
        applyTierToDom(effective);
        set({
          userTier: optimalUserTier,
          tier: effective,
          policy: getPerformancePolicy(effective),
          autoDetected,
        });
      },

      onBatteryChange: (battery: BatteryStatus) => {
        const {
          userTier,
          autoEcoOnLowBattery,
          tier: currentTier,
          battery: prevBattery,
        } = get();
        if (
          prevBattery.level === battery.level &&
          prevBattery.charging === battery.charging &&
          prevBattery.isLow === battery.isLow &&
          prevBattery.supported === battery.supported
        ) {
          return;
        }
        const effective = computeEffectiveTier(
          userTier,
          autoEcoOnLowBattery,
          battery
        );
        if (effective === currentTier) {
          set({ battery });
        } else {
          applyTierToDom(effective);
          set({
            battery,
            tier: effective,
            policy: getPerformancePolicy(effective),
          });
        }
      },

      onVisibilityChange: (visibility: VisibilityStatus) => {
        const prev = get().visibility;
        if (
          prev.isVisible === visibility.isVisible &&
          prev.isFocused === visibility.isFocused &&
          prev.visibilityState === visibility.visibilityState
        ) {
          return;
        }
        set({ visibility });
      },
    }),
    {
      name: "marshell_performance_tier",
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        userTier: state.userTier,
        tier: state.userTier,
        autoDetected: state.autoDetected,
        autoEcoOnLowBattery: state.autoEcoOnLowBattery,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const rawTier = state.userTier || state.tier;
          const normalized = normalizeTier(rawTier);
          state.userTier = normalized;
          state.tier = normalized;
          state.policy = getPerformancePolicy(normalized);
          applyTierToDom(normalized);
        }
      },
    }
  )
);
