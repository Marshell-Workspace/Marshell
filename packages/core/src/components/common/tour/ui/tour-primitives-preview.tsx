"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { CompletionScene } from "../completion-scene";
import { ProgressNodeChain } from "../progress";
import { SkipDialog } from "../resume-chip";
import { AnimatedStepIcon } from "../step-icons";
import {
  bootContainerVariants,
  bootItemVariants,
  HudPanel,
  MicroLabel,
  StatusLed,
  SuccessBurst,
} from "./index";

/**
 * TourPrimitivesPreview — Internal visual review story / preview
 * for Mission Control HUD tokens, primitives, and motion presets.
 * Supports live Dark/Light theme switching and performance-tier inspection.
 */
export function TourPrimitivesPreview({
  initialScreen,
  initialTier,
}: {
  initialScreen?: string;
  initialTier?: "performance" | "balanced" | "eco";
} = {}) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [tier, setTier] = useState<"performance" | "balanced" | "eco">(
    initialTier || "performance"
  );
  const [scanKey, setScanKey] = useState(0);
  const [bootKey, setBootKey] = useState(0);
  const [burstPos, setBurstPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [showSkip, setShowSkip] = useState(initialScreen === "skip");
  const [showCompletion, setShowCompletion] = useState(
    initialScreen === "completion"
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("screen") === "skip") {
        setShowSkip(true);
      } else if (params.get("screen") === "completion") {
        setShowCompletion(true);
      }
    }
  }, []);

  return (
    <div
      className={`min-h-screen p-6 sm:p-10 transition-colors motion-normal ${
        theme === "dark"
          ? "dark bg-[#07090e] text-[#f4f4f5]"
          : "light bg-[#f4f1e8] text-[#09090b]"
      }`}
      data-theme={theme}
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* ── Control Header ─────────────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[var(--tour-border)]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <StatusLed size="md" status="active" tier={tier} />
              <MicroLabel badge size="xs" variant="accent">
                Mission Control Onboarding
              </MicroLabel>
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-display">
              HUD Identity & Primitive Foundation
            </h1>
            <p className="text-xs text-[var(--tour-text-muted)] mt-1 font-mono">
              Theme-adaptive token layer &bull; Chamfered HUD &bull; Telemetry
              Primitives
            </p>
          </div>

          {/* Interactive controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Theme Toggle */}
            <div className="flex items-center rounded-lg border border-[var(--tour-border)] p-0.5 bg-[var(--tour-surface)]">
              <button
                className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                  theme === "dark"
                    ? "bg-[var(--tour-accent)] text-white"
                    : "text-[var(--tour-text-muted)] hover:text-[var(--tour-text)]"
                }`}
                onClick={() => setTheme("dark")}
                type="button"
              >
                DARK
              </button>
              <button
                className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                  theme === "light"
                    ? "bg-[var(--tour-accent)] text-white"
                    : "text-[var(--tour-text-muted)] hover:text-[var(--tour-text)]"
                }`}
                onClick={() => setTheme("light")}
                type="button"
              >
                LIGHT
              </button>
            </div>

            {/* Performance Tier Toggle */}
            <div className="flex items-center rounded-lg border border-[var(--tour-border)] p-0.5 bg-[var(--tour-surface)]">
              {(["performance", "balanced", "eco"] as const).map((t) => (
                <button
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium capitalize transition-colors ${
                    tier === t
                      ? "bg-[var(--tour-surface-raised)] text-[var(--tour-text)] shadow-xs"
                      : "text-[var(--tour-text-muted)] hover:text-[var(--tour-text)]"
                  }`}
                  key={t}
                  onClick={() => setTier(t)}
                  type="button"
                >
                  {t}
                </button>
              ))}
            </div>

            {/* ScanLine Trigger */}
            <button
              className="px-3 py-1.5 rounded-lg border border-[var(--tour-border)] text-xs font-mono font-semibold bg-[var(--tour-surface-raised)] text-[var(--tour-text)] hover:brightness-110 active:scale-95 transition-ui cursor-pointer"
              onClick={() => setScanKey((k) => k + 1)}
              type="button"
            >
              SCANLINE
            </button>

            {/* Success Burst Trigger (Touch 1) */}
            <button
              className="px-3 py-1.5 rounded-lg border border-[color-mix(in_oklab,var(--tour-success)_40%,transparent)] text-xs font-mono font-semibold bg-[color-mix(in_oklab,var(--tour-success)_12%,transparent)] text-[var(--tour-success)] hover:brightness-110 active:scale-95 transition-ui cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setBurstPos({
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                });
              }}
              type="button"
            >
              BURST PULSE
            </button>

            {/* Skip Dialog Trigger */}
            <button
              className="px-3 py-1.5 rounded-lg border border-amber-500/30 text-xs font-mono font-semibold bg-amber-500/10 text-amber-400 hover:brightness-110 active:scale-95 transition-ui cursor-pointer"
              onClick={() => setShowSkip(true)}
              type="button"
            >
              SKIP DIALOG
            </button>

            {/* Completion Scene Trigger */}
            <button
              className="px-3 py-1.5 rounded-lg border border-blue-500/30 text-xs font-mono font-semibold bg-blue-500/10 text-blue-400 hover:brightness-110 active:scale-95 transition-ui cursor-pointer"
              onClick={() => setShowCompletion(true)}
              type="button"
            >
              COMPLETION SCENE
            </button>
          </div>
        </header>

        {/* ── Grid of Components ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Panel 1: HudPanel with Chamfer & Corner Ticks */}
          <div className="space-y-3">
            <MicroLabel size="xs" variant="muted">
              01 &bull; HudPanel Primitive
            </MicroLabel>
            <HudPanel cornerTicks key={scanKey} scanline tier={tier}>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusLed size="sm" status="active" tier={tier} />
                    <MicroLabel size="xs" variant="accent">
                      TELEMETRY_LINK_01
                    </MicroLabel>
                  </div>
                  <MicroLabel badge size="xs" variant="success">
                    ONLINE
                  </MicroLabel>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-semibold font-display">
                    Chamfered Command Surface
                  </h3>
                  <p className="text-sm text-[var(--tour-text-muted)] leading-relaxed">
                    12px diagonal chamfers, 1px high-precision border, top
                    specular highlight, and optional corner targeting ticks.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-[var(--tour-border)] bg-[var(--tour-surface-raised)]">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[var(--tour-text-muted)]">
                      SYSTEM_DIAGNOSTICS
                    </span>
                    <span className="text-[var(--tour-success)]">NOMINAL</span>
                  </div>
                </div>
              </div>
            </HudPanel>
          </div>

          {/* Panel 2: MicroLabel & StatusLed Matrix */}
          <div className="space-y-3">
            <MicroLabel size="xs" variant="muted">
              02 &bull; MicroLabels & Status Leds
            </MicroLabel>
            <HudPanel raised tier={tier}>
              <div className="p-5 space-y-5">
                <div>
                  <h4 className="text-xs font-mono font-semibold text-[var(--tour-text-muted)] uppercase mb-2.5">
                    Status LED Telemetry
                  </h4>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <StatusLed size="md" status="active" tier={tier} />
                      <span className="text-xs font-mono">Active (Pulse)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusLed size="md" status="ready" tier={tier} />
                      <span className="text-xs font-mono">Ready (Success)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusLed size="md" status="alert" tier={tier} />
                      <span className="text-xs font-mono">Alert (Warning)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusLed size="md" status="standby" tier={tier} />
                      <span className="text-xs font-mono">Standby</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-mono font-semibold text-[var(--tour-text-muted)] uppercase mb-2.5">
                    MicroLabel Variants
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <MicroLabel badge dot size="xs" variant="default">
                      DEFAULT
                    </MicroLabel>
                    <MicroLabel badge dot size="xs" variant="accent">
                      PRIMARY_ACCENT
                    </MicroLabel>
                    <MicroLabel badge dot size="xs" variant="success">
                      CONFIRMED
                    </MicroLabel>
                    <MicroLabel badge dot size="xs" variant="warning">
                      ATTENTION_REQ
                    </MicroLabel>
                    <MicroLabel badge size="xs" variant="muted">
                      STEP 04 OF 14
                    </MicroLabel>
                  </div>
                </div>

                {/* Animated Step Icons (Touch 2) */}
                <div>
                  <h4 className="text-xs font-mono font-semibold text-[var(--tour-text-muted)] uppercase mb-2.5">
                    Step Icons with Micro-Animations (Touch 2)
                  </h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg border border-[var(--tour-border)] bg-[var(--tour-surface)]">
                      <AnimatedStepIcon
                        reducedMotion={false}
                        stepId="onboarding-notifications"
                        tier={tier}
                      />
                      <span className="text-[10px] font-mono">Bell Ring</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg border border-[var(--tour-border)] bg-[var(--tour-surface)]">
                      <AnimatedStepIcon
                        reducedMotion={false}
                        stepId="onboarding-settings"
                        tier={tier}
                      />
                      <span className="text-[10px] font-mono">Gear Rotate</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg border border-[var(--tour-border)] bg-[var(--tour-surface)]">
                      <AnimatedStepIcon
                        reducedMotion={false}
                        stepId="onboarding-create-btn"
                        tier={tier}
                      />
                      <span className="text-[10px] font-mono">Draw Plus</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg border border-[var(--tour-border)] bg-[var(--tour-surface)]">
                      <AnimatedStepIcon
                        reducedMotion={false}
                        stepId="onboarding-submit"
                        tier={tier}
                      />
                      <span className="text-[10px] font-mono">Play Nudge</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg border border-[var(--tour-border)] bg-[var(--tour-surface)]">
                      <AnimatedStepIcon
                        reducedMotion={false}
                        stepId="onboarding-ai-agents"
                        tier={tier}
                      />
                      <span className="text-[10px] font-mono">Bot Blink</span>
                    </div>
                  </div>
                </div>
              </div>
            </HudPanel>
          </div>
        </div>

        {/* ── Staggered Boot Sequence Demo ───────────────────────────────── */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <MicroLabel size="xs" variant="muted">
              03 &bull; Named Motion Preset: Boot Sequence
            </MicroLabel>
            <button
              className="px-2.5 py-1 text-xs font-mono text-[var(--tour-accent)] hover:underline cursor-pointer"
              onClick={() => setBootKey((k) => k + 1)}
              type="button"
            >
              [Replay Boot Sequence]
            </button>
          </div>

          <motion.div
            animate="animate"
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            initial="initial"
            key={bootKey}
            variants={bootContainerVariants}
          >
            {[
              {
                id: "SYS_CORE",
                title: "Autonomous Core",
                status: "ONLINE",
                variant: "success" as const,
              },
              {
                id: "ORBIT_NAV",
                title: "Targeting Matrix",
                status: "LOCKED",
                variant: "accent" as const,
              },
              {
                id: "AGENT_PTY",
                title: "Terminal Shell",
                status: "STANDBY",
                variant: "muted" as const,
              },
            ].map((node) => (
              <motion.div key={node.id} variants={bootItemVariants}>
                <HudPanel cornerTicks tier={tier}>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <MicroLabel size="xs" variant="muted">
                        {node.id}
                      </MicroLabel>
                      <MicroLabel badge size="xs" variant={node.variant}>
                        {node.status}
                      </MicroLabel>
                    </div>
                    <div className="font-semibold text-sm">{node.title}</div>
                  </div>
                </HudPanel>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* ── Section 04: In-Flow Node Chain & Action States ─────────────── */}
        <div className="space-y-4 pt-4 border-t border-[var(--tour-border)]">
          <div className="flex items-center justify-between">
            <MicroLabel size="xs" variant="muted">
              04 &bull; In-Flow Chapter Node Chain & Status Rows
            </MicroLabel>
            <MicroLabel badge size="xs" variant="accent">
              STEPS 01-12
            </MicroLabel>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Progress Node Chain Preview */}
            <HudPanel cornerTicks tier={tier}>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusLed size="sm" status="active" tier={tier} />
                    <MicroLabel size="xs" variant="accent">
                      CHAPTER_NODE_CHAIN
                    </MicroLabel>
                  </div>
                  <MicroLabel badge size="xs" variant="muted">
                    ACTIVE STEP 03
                  </MicroLabel>
                </div>

                <div className="rounded-lg border border-[var(--tour-border)] overflow-hidden bg-[var(--tour-surface)]">
                  <ProgressNodeChain
                    currentStepIndex={2}
                    steps={[
                      { id: "s0", title: "Welcome", chapter: "SETUP" },
                      { id: "s1", title: "WS Name", chapter: "SETUP" },
                      { id: "s2", title: "Directory", chapter: "SETUP" },
                      { id: "s3", title: "Agents", chapter: "SETUP" },
                      { id: "s4", title: "Comm", chapter: "SETUP" },
                      { id: "s5", title: "Finish", chapter: "SETUP" },
                      { id: "s6", title: "Agent Tour", chapter: "EXPLORE" },
                      { id: "s7", title: "Settings Tour", chapter: "EXPLORE" },
                    ]}
                    tier={tier}
                    tourId="onboarding"
                  />
                </div>
              </div>
            </HudPanel>

            {/* Action Gated Status Row Preview (Awaiting vs ACK) */}
            <HudPanel cornerTicks tier={tier}>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusLed size="sm" status="ready" tier={tier} />
                    <MicroLabel size="xs" variant="success">
                      ACTION_GATE_STATES
                    </MicroLabel>
                  </div>
                </div>

                {/* State A: Awaiting Input */}
                <div className="space-y-2">
                  <MicroLabel size="xs" variant="muted">
                    STATE 1: AWAITING INPUT
                  </MicroLabel>
                  <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 border border-[color-mix(in_oklab,var(--tour-accent)_40%,transparent)] bg-[var(--tour-surface-raised)]/70">
                    <StatusLed
                      pulse={tier !== "eco"}
                      size="sm"
                      status="active"
                      tier={tier}
                    />
                    <div className="flex flex-col">
                      <MicroLabel
                        className="font-mono text-[9px] tracking-widest text-[var(--tour-accent)]"
                        size="xs"
                        variant="accent"
                      >
                        AWAITING INPUT
                      </MicroLabel>
                      <span className="font-sans text-xs text-[var(--tour-text)]">
                        Enter a unique name for your first workspace
                      </span>
                    </div>
                  </div>
                </div>

                {/* State B: ACK Received */}
                <div className="space-y-2 pt-1">
                  <MicroLabel size="xs" variant="muted">
                    STATE 2: ACKNOWLEDGED
                  </MicroLabel>
                  <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 border border-[color-mix(in_oklab,var(--tour-success)_40%,transparent)] bg-[color-mix(in_oklab,var(--tour-success)_12%,transparent)]">
                    <StatusLed
                      pulse={false}
                      size="sm"
                      status="ready"
                      tier={tier}
                    />
                    <div className="flex items-center gap-2">
                      <MicroLabel
                        className="font-mono text-[10px] text-[var(--tour-success)] tracking-wider"
                        size="xs"
                        variant="default"
                      >
                        {"ACK // INPUT RECEIVED"}
                      </MicroLabel>
                      <svg
                        className="size-3.5 text-[var(--tour-success)]"
                        fill="none"
                        viewBox="0 0 16 16"
                      >
                        <path
                          d="M3 8.5L6.5 12L13 4"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </HudPanel>
          </div>
        </div>
      </div>

      {/* Interactive SuccessBurst instance */}
      {burstPos && (
        <SuccessBurst
          onComplete={() => setBurstPos(null)}
          origin={burstPos}
          tier={tier}
        />
      )}

      {/* Interactive SkipDialog Preview */}
      <AnimatePresence>
        {showSkip && (
          <SkipDialog
            onClose={() => setShowSkip(false)}
            onDismissForever={() => setShowSkip(false)}
            onSkip={() => setShowSkip(false)}
          />
        )}
      </AnimatePresence>

      {/* Interactive CompletionScene Preview */}
      <AnimatePresence>
        {showCompletion && (
          <CompletionScene
            onBack={() => setShowCompletion(false)}
            onDone={() => setShowCompletion(false)}
            onSkip={() => setShowCompletion(false)}
            reducedMotion={false}
            tier={tier}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
