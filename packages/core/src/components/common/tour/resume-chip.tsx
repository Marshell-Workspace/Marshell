"use client";

import { useResolvedTheme } from "@workspace/core/hooks/use-resolved-theme";
import {
  TOUR_REGISTRY,
  useTutorialStore,
} from "@workspace/core/stores/tutorial-store";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowRight, Compass, Play, Settings, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";

interface ResumeChipProps {
  currentStep: number;
  isInterrupted: boolean;
  onDismiss: () => void;
  onResume: () => void;
  totalSteps: number;
}

/**
 * Opaque resume chip with SVG progress ring.
 * Slides up 12px with a spring. Never overlaps the 72×72 dev-badge corner.
 * No blur (fixes V10, V4).
 */
export function ResumeChip({
  currentStep,
  totalSteps,
  onResume,
  onDismiss,
  isInterrupted,
}: ResumeChipProps) {
  const resolvedTheme = useResolvedTheme();
  const isLight = resolvedTheme === "light";
  const progress = totalSteps > 0 ? currentStep / totalSteps : 0;
  const RING_SIZE = 26;
  const STROKE = 2.2;
  const RADIUS = (RING_SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="fixed z-[9999] pointer-events-auto"
      exit={{ opacity: 0, y: 12 }}
      initial={{ opacity: 0, y: 12 }}
      // 24px from right, 24px from bottom — stays above the 72×72 dev badge corner
      style={{ right: 24, bottom: 88, left: "auto" }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <div
        className="relative flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 overflow-hidden text-[var(--tour-text)]"
        data-tour-element="resume-chip"
        style={{
          background: isLight
            ? "rgba(255, 255, 255, 0.92)"
            : "var(--tour-surface)",
          border: isLight
            ? "1px solid rgba(0, 0, 0, 0.08)"
            : "1px solid var(--tour-border)",
          boxShadow: isLight
            ? "0 12px 32px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.06)"
            : "0 12px 32px rgba(0,0,0,0.5), 0 0 20px var(--tour-accent-glow)",
          backdropFilter: isLight ? "blur(20px)" : undefined,
        }}
      >
        {/* Top specular highlight line */}
        <div
          aria-hidden="true"
          className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-[var(--tour-text)]/15 to-transparent pointer-events-none hidden dark:block"
        />

        {/* SVG progress ring */}
        <svg className="shrink-0" height={RING_SIZE} width={RING_SIZE}>
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={RADIUS}
            stroke="color-mix(in oklab, var(--tour-text) 14%, transparent)"
            strokeWidth={STROKE}
          />
          <motion.circle
            animate={{
              strokeDashoffset: CIRCUMFERENCE * (1 - progress),
            }}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            r={RADIUS}
            stroke="var(--tour-accent)"
            strokeDasharray={CIRCUMFERENCE}
            strokeLinecap="round"
            strokeWidth={STROKE}
            style={{ rotate: "-90deg", transformOrigin: "center" }}
            transition={{ duration: 0.3 }}
          />
          {/* Play icon center */}
          <foreignObject height={10} width={10} x={8} y={8}>
            <div className="flex items-center justify-center size-full">
              <Play
                className="size-2.5 fill-current ml-0.5"
                style={{ color: "var(--tour-accent)" }}
              />
            </div>
          </foreignObject>
        </svg>

        <div className="flex flex-col text-left pr-0.5">
          <span className="font-sans font-semibold text-xs leading-none tracking-tight">
            {isInterrupted ? "Tour paused" : "Tour paused"}
          </span>
          <span className="font-mono text-[11px] text-[var(--tour-text-muted)] mt-1 leading-none tracking-wide">
            Step {currentStep} of {totalSteps}
          </span>
        </div>

        <button
          className={cn(
            "h-7 px-3 rounded-lg font-sans text-xs font-semibold cursor-pointer transition-ui motion-fast hover:brightness-110 active:scale-[0.98]",
            isLight ? "text-white" : "text-white"
          )}
          onClick={onResume}
          style={{
            background: isLight ? "#1D1D1F" : "var(--tour-accent)",
            boxShadow: isLight
              ? "0 2px 6px rgba(0, 0, 0, 0.12)"
              : "0 2px 8px var(--tour-accent-glow)",
          }}
          type="button"
        >
          Continue
        </button>

        <button
          aria-label="Dismiss tour"
          className="size-6 flex items-center justify-center rounded-lg text-[var(--tour-text-muted)] hover:text-[var(--tour-text)] hover:bg-black/[0.05] dark:hover:bg-[var(--tour-surface-raised)] transition-colors cursor-pointer ml-0.5"
          onClick={onDismiss}
          type="button"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Skip dialog ──────────────────────────────────────────────────────────────

interface SkipDialogProps {
  onClose: () => void;
  onDismissForever: () => void;
  onSkip: () => void;
}

/**
 * Redesigned SkipDialog — Calm, tactile intermission.
 * Features:
 * - Translucent blurred material with hairline border & soft layered shadow (~18px radius).
 * - Mini path illustration (Settings -> Tutorials) affirming safe replay.
 * - Progress ring with "Step X of Y" when active tour data exists.
 * - Primary "Keep going", quiet secondary "Skip for now", discreet "Don't show again" text link.
 * - Full keyboard support: Enter = Keep going, Escape = Resume, Tab focus visible, reduced-motion compliant.
 */
export function SkipDialog({
  onSkip,
  onDismissForever,
  onClose,
}: SkipDialogProps) {
  const reduced = Boolean(useReducedMotion());
  const resolvedTheme = useResolvedTheme();
  const isLight = resolvedTheme === "light";

  const activeTour = useTutorialStore((s) => s.activeTour);
  const currentStepIndex = useTutorialStore((s) => s.currentStepIndex);
  const steps = activeTour ? (TOUR_REGISTRY[activeTour] ?? []) : [];
  const totalSteps = steps.length;
  const currentStepNumber = Math.min(currentStepIndex + 1, totalSteps);
  const hasProgress = totalSteps > 0 && currentStepNumber > 0;

  const RING_SIZE = 18;
  const STROKE = 2;
  const RADIUS = (RING_SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const progressRatio = hasProgress ? currentStepNumber / totalSteps : 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "Enter") {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== "BUTTON" && activeTag !== "A") {
          e.preventDefault();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-auto backdrop-blur-md"
      data-tour-element="skip-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{
        background: isLight ? "rgba(15, 23, 42, 0.25)" : "rgba(3, 5, 10, 0.65)",
      }}
    >
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "relative w-full max-w-[380px] rounded-[18px] p-6 pointer-events-auto overflow-hidden select-none backdrop-blur-2xl",
          isLight
            ? "border border-black/[0.08] text-[#1D1D1F]"
            : "border border-white/[0.12] dark:border-white/[0.09] text-[var(--tour-text)]"
        )}
        data-tour-element="skip-dialog"
        exit={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
        initial={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
        style={{
          background: isLight
            ? "rgba(255, 255, 255, 0.94)"
            : "linear-gradient(180deg, color-mix(in oklab, var(--tour-surface) 92%, #090e1c) 0%, var(--tour-surface) 100%)",
          boxShadow: isLight
            ? "0 20px 48px -8px rgba(0, 0, 0, 0.15), 0 4px 16px -2px rgba(0, 0, 0, 0.08)"
            : "0 24px 64px -12px rgba(0,0,0,0.75), 0 8px 24px -4px rgba(0,0,0,0.45)",
        }}
        transition={{
          duration: reduced ? 0.08 : 0.22,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {/* Subtle top specular highlight */}
        <div
          aria-hidden="true"
          className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none hidden dark:block"
        />

        {/* Header: Title & Optional Progress Ring */}
        <div className="flex items-center justify-between gap-3">
          <h3
            className={cn(
              "font-heading text-[16px] font-semibold tracking-tight",
              isLight ? "text-[#1D1D1F]" : "text-[var(--tour-text)]"
            )}
          >
            Pause tutorial?
          </h3>

          {hasProgress && (
            <div
              aria-label={`Step ${currentStepNumber} of ${totalSteps}`}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                isLight
                  ? "bg-black/[0.04] border border-black/[0.08]"
                  : "bg-white/[0.04] dark:bg-white/[0.03] border border-white/[0.08]"
              )}
              role="status"
            >
              <svg
                aria-hidden="true"
                className="shrink-0"
                height={RING_SIZE}
                width={RING_SIZE}
              >
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  fill="none"
                  r={RADIUS}
                  stroke="color-mix(in oklab, var(--tour-text) 14%, transparent)"
                  strokeWidth={STROKE}
                />
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  fill="none"
                  r={RADIUS}
                  stroke="var(--tour-accent, #3b82f6)"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - progressRatio)}
                  strokeLinecap="round"
                  strokeWidth={STROKE}
                  style={{ rotate: "-90deg", transformOrigin: "center" }}
                />
              </svg>
              <span className="font-sans text-[11px] font-medium text-[var(--tour-text-muted)] leading-none">
                {currentStepNumber} of {totalSteps}
              </span>
            </div>
          )}
        </div>

        {/* Mini Path Illustration: Settings -> Tutorials */}
        <div
          className={cn(
            "relative mt-4 mb-5 rounded-xl p-3 text-left overflow-hidden",
            isLight
              ? "border border-black/[0.08] bg-black/[0.02]"
              : "border border-white/[0.08] dark:border-white/[0.06] bg-white/[0.03] dark:bg-white/[0.02]"
          )}
        >
          {/* Subtle top sheen */}
          <div
            aria-hidden="true"
            className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none hidden dark:block"
          />

          <div
            className={cn(
              "flex items-center justify-between text-xs",
              isLight ? "text-[#1D1D1F]" : "text-[var(--tour-text)]"
            )}
          >
            <div className="flex items-center gap-2 font-medium">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-lg",
                  isLight
                    ? "bg-black/[0.05] border border-black/[0.08] text-zinc-700"
                    : "bg-white/[0.06] border border-white/[0.08] text-[var(--tour-text-muted)]"
                )}
              >
                <Settings className="size-3.5" />
              </div>
              <span className="text-[12px]">Settings</span>
            </div>

            <div
              aria-hidden="true"
              className={cn(
                "flex items-center gap-1.5 px-2",
                isLight ? "text-zinc-400" : "text-[var(--tour-text-muted)]/40"
              )}
            >
              <span className="h-px w-3.5 bg-current opacity-30" />
              <ArrowRight
                className={cn(
                  "size-3 opacity-70",
                  isLight ? "text-blue-600" : "text-[var(--tour-accent)]"
                )}
              />
              <span className="h-px w-3.5 bg-current opacity-30" />
            </div>

            <div className="flex items-center gap-2 font-medium">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-lg",
                  isLight
                    ? "bg-blue-50 border border-blue-200 text-blue-600"
                    : "bg-[var(--tour-accent)]/15 border border-[var(--tour-accent)]/30 text-[var(--tour-accent)]"
                )}
              >
                <Compass className="size-3.5" />
              </div>
              <span className="text-[12px]">Tutorials</span>
            </div>
          </div>

          <p
            className={cn(
              "mt-2.5 text-[12px] leading-relaxed font-sans",
              isLight
                ? "text-[rgba(60,60,67,0.7)]"
                : "text-[var(--tour-text-muted)]"
            )}
          >
            Your progress is preserved. You can resume or replay every tour
            anytime.
          </p>
        </div>

        {/* Action Buttons: Primary "Keep going" + Secondary "Skip for now" */}
        <div className="flex items-center gap-2.5">
          <button
            className={cn(
              "h-10 flex-1 rounded-full font-sans text-xs font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tour-focus-ring)]",
              isLight
                ? "border border-black/[0.1] bg-black/[0.03] hover:bg-black/[0.07] text-[#1D1D1F]"
                : "border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.07] text-[var(--tour-text)]"
            )}
            onClick={onSkip}
            type="button"
          >
            Skip for now
          </button>
          <button
            autoFocus
            className="group relative h-10 flex-1 rounded-full font-sans text-xs font-semibold cursor-pointer overflow-hidden transition-[transform,filter] motion-fast hover:-translate-y-[0.5px] hover:brightness-[1.04] active:translate-y-0 active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tour-focus-ring)] focus-visible:ring-offset-2"
            onClick={onClose}
            style={{
              background: isLight
                ? "#1D1D1F"
                : "linear-gradient(180deg, #FFC25C 0%, #F5A31F 100%)",
              boxShadow: isLight
                ? "0 4px 14px rgba(0, 0, 0, 0.16)"
                : "inset 0 1px 0 rgba(255, 255, 255, 0.4), inset 0 -1px 0 rgba(0, 0, 0, 0.2), 0 4px 14px rgba(245, 158, 11, 0.24)",
              color: isLight ? "#ffffff" : "#1B1208",
            }}
            type="button"
          >
            <span>Keep going</span>
          </button>
        </div>

        {/* Discreet "Don't show again" text link */}
        <div className="mt-3.5 flex justify-center">
          <button
            className="font-sans text-[11.5px] text-[var(--tour-text-muted)] hover:text-[var(--tour-text)] transition-colors cursor-pointer underline-offset-4 hover:underline py-1 px-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--tour-focus-ring)] rounded"
            onClick={onDismissForever}
            type="button"
          >
            Don&apos;t show again
          </button>
        </div>
      </motion.div>
    </div>
  );
}
