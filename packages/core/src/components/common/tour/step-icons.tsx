"use client";

import { cn } from "@workspace/ui/lib/utils";
import {
  Bell,
  CheckCircle2,
  FileText,
  FolderOpen,
  Gauge,
  GraduationCap,
  HeartPulse,
  LayoutGrid,
  LayoutPanelLeft,
  type LucideIcon,
  PanelLeft,
  Play,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Terminal,
  UserRound,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";

export interface StepIconConfig {
  /** One-shot glyph animation description (for aria / docs) */
  animLabel: string;
  animVariant:
    | "draw-plus"
    | "open-folder"
    | "blink"
    | "bell-ring"
    | "gear-rotate"
    | "search-sweep"
    | "play-nudge"
    | "none";
  Icon: LucideIcon;
}

const ICON_MAP: Record<string, StepIconConfig> = {
  // Onboarding
  "onboarding-sidebar": {
    Icon: PanelLeft,
    animVariant: "none",
    animLabel: "Panel slides in",
  },
  "onboarding-create-btn": {
    Icon: Plus,
    animVariant: "draw-plus",
    animLabel: "Plus sign draws",
  },
  "onboarding-ws-name": {
    Icon: FileText,
    animVariant: "none",
    animLabel: "Document",
  },
  "onboarding-ws-dir": {
    Icon: FolderOpen,
    animVariant: "open-folder",
    animLabel: "Folder opens",
  },
  "onboarding-autorun": {
    Icon: Terminal,
    animVariant: "none",
    animLabel: "Terminal",
  },
  "onboarding-terminal-layout": {
    Icon: LayoutGrid,
    animVariant: "none",
    animLabel: "Grid",
  },
  "onboarding-submit": {
    Icon: Play,
    animVariant: "play-nudge",
    animLabel: "Play nudges right",
  },
  "onboarding-notifications": {
    Icon: Bell,
    animVariant: "bell-ring",
    animLabel: "Bell rings",
  },
  "onboarding-settings": {
    Icon: Settings2,
    animVariant: "gear-rotate",
    animLabel: "Gear rotates 60deg",
  },
  "onboarding-complete": {
    Icon: CheckCircle2,
    animVariant: "none",
    animLabel: "Check circle",
  },
  // Settings
  "settings-overview": {
    Icon: LayoutPanelLeft,
    animVariant: "none",
    animLabel: "Panel layout",
  },
  "settings-search": {
    Icon: Search,
    animVariant: "search-sweep",
    animLabel: "Search sweeps",
  },
  "settings-general-nav": {
    Icon: SlidersHorizontal,
    animVariant: "none",
    animLabel: "Sliders",
  },
  "settings-account-nav": {
    Icon: UserRound,
    animVariant: "none",
    animLabel: "User",
  },
  "settings-performance-nav": {
    Icon: Gauge,
    animVariant: "none",
    animLabel: "Gauge",
  },
  "settings-system-nav": {
    Icon: HeartPulse,
    animVariant: "none",
    animLabel: "Heart pulse",
  },
  "settings-tutorials-section": {
    Icon: GraduationCap,
    animVariant: "none",
    animLabel: "Graduate cap",
  },
};

const FALLBACK: StepIconConfig = {
  Icon: Settings2,
  animVariant: "none",
  animLabel: "Settings",
};

export function getStepIconConfig(stepId: string): StepIconConfig {
  return ICON_MAP[stepId] ?? FALLBACK;
}

// ─── Animated glyph wrapper ────────────────────────────────────────────────

/** Single feature flag to easily toggle step icon micro-animations */
export const ENABLE_STEP_ICON_ANIMATIONS = true;

interface AnimatedStepIconProps {
  className?: string;
  reducedMotion: boolean;
  stepId: string;
  tier?: "performance" | "balanced" | "eco";
}

export function AnimatedStepIcon({
  stepId,
  className,
  reducedMotion,
  tier = "performance",
}: AnimatedStepIconProps) {
  const config = getStepIconConfig(stepId);
  const { Icon, animVariant } = config;
  const hasAnimated = useRef(false);
  const iconRef = useRef<SVGSVGElement>(null);
  const isEco = tier === "eco" || reducedMotion;

  useEffect(() => {
    if (
      !ENABLE_STEP_ICON_ANIMATIONS ||
      isEco ||
      hasAnimated.current ||
      animVariant === "none"
    ) {
      return;
    }
    hasAnimated.current = true;
    // One-shot CSS animation trigger via class add/remove
    const el = iconRef.current;
    if (!el) {
      return;
    }
    el.setAttribute("data-anim", animVariant);
  }, [animVariant, isEco]);

  // Performance gate & feature flag: static fallback if disabled, eco, or reduced motion
  if (!ENABLE_STEP_ICON_ANIMATIONS || isEco || animVariant === "none") {
    return <Icon className={cn("size-4", className)} />;
  }

  if (animVariant === "gear-rotate") {
    return (
      <motion.div
        animate={{ rotate: 75 }}
        initial={{ rotate: 0 }}
        transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <Icon className={cn("size-4", className)} />
      </motion.div>
    );
  }

  if (animVariant === "play-nudge") {
    return (
      <motion.div
        animate={{ x: [0, 4, 0] }}
        initial={{ x: 0 }}
        transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <Icon className={cn("size-4", className)} />
      </motion.div>
    );
  }

  if (animVariant === "blink") {
    return (
      <motion.div
        animate={{ opacity: [1, 0.15, 1, 0.15, 1] }}
        initial={{ opacity: 1 }}
        transition={{ duration: 0.75, times: [0, 0.25, 0.5, 0.75, 1] }}
      >
        <Icon className={cn("size-4", className)} />
      </motion.div>
    );
  }

  if (animVariant === "bell-ring") {
    return (
      <motion.div
        animate={{ rotate: [0, 18, -18, 12, -12, 6, -6, 0] }}
        initial={{ rotate: 0 }}
        style={{ transformOrigin: "top center" }}
        transition={{ duration: 0.75, ease: "easeInOut" }}
      >
        <Icon className={cn("size-4", className)} />
      </motion.div>
    );
  }

  if (animVariant === "search-sweep") {
    return (
      <motion.div
        animate={{ x: [0, 3, -3, 2, 0] }}
        initial={{ x: 0 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Icon className={cn("size-4", className)} />
      </motion.div>
    );
  }

  if (animVariant === "open-folder") {
    return (
      <motion.div
        animate={{ scaleY: [1, 1.15, 1], y: [0, -1.5, 0] }}
        initial={{ scaleY: 1, y: 0 }}
        style={{ transformOrigin: "bottom" }}
        transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <Icon className={cn("size-4", className)} />
      </motion.div>
    );
  }

  if (animVariant === "draw-plus") {
    return (
      <motion.div
        animate={{ scale: [0.55, 1.2, 1], rotate: [0, 90, 0] }}
        initial={{ scale: 0.55, rotate: 0 }}
        transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <Icon className={cn("size-4", className)} />
      </motion.div>
    );
  }

  return <Icon className={cn("size-4", className)} />;
}
