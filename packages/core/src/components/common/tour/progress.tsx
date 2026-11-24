"use client";

import { MicroLabel } from "@workspace/core/components/common/tour/ui/micro-label";
import type { TourStep } from "@workspace/core/stores/tutorial-store";
import { cn } from "@workspace/ui/lib/utils";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";

export interface ProgressProps {
  className?: string;
  currentStepIndex: number;
  reducedMotion?: boolean;
  steps: Pick<TourStep, "id" | "title" | "chapter">[];
  tier?: "performance" | "balanced" | "eco";
  tourId: string | null;
}

/**
 * ProgressNodeChain — Chapter-grouped node chain progress indicator.
 *
 * Replaces old segmented pills with Mission Control tactical node telemetry.
 * - Nodes grouped by chapter (e.g. SETUP, EXPLORE)
 * - Completed nodes are lit and joined by filled accent lines
 * - Current active node pulses with ambient glow ring
 * - Unvisited nodes remain dim
 */
export function ProgressNodeChain({
  steps,
  currentStepIndex,
  tourId,
  reducedMotion = false,
  tier = "performance",
  className,
}: ProgressProps) {
  // Group steps by chapter
  const groups: { chapter: string; indices: number[] }[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) {
      continue;
    }
    const ch = step.chapter ?? (tourId === "settings" ? "SETTINGS" : "TOUR");
    const last = groups.at(-1);
    if (last?.chapter === ch) {
      last.indices.push(i);
    } else {
      groups.push({ chapter: ch, indices: [i] });
    }
  }

  const isEco = tier === "eco" || reducedMotion;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-5 py-2.5 border-b border-[var(--tour-border)] bg-[var(--tour-surface-raised)]/30 select-none overflow-x-auto",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {groups.map((group, gi) => {
          const isCurrentChapter = group.indices.includes(currentStepIndex);
          const isDoneChapter = group.indices.every(
            (idx) => idx < currentStepIndex
          );

          return (
            <div className="flex items-center gap-1.5" key={group.chapter}>
              {gi > 0 && (
                <span
                  aria-hidden="true"
                  className="mx-1 h-2.5 w-px bg-[var(--tour-border)] opacity-60"
                />
              )}
              {/* Monospace micro chapter badge */}
              <MicroLabel
                className={cn(
                  "text-[9px] tracking-wider transition-opacity",
                  !(isCurrentChapter || isDoneChapter) && "opacity-45"
                )}
                size="xs"
                variant={
                  isCurrentChapter
                    ? "accent"
                    : isDoneChapter
                      ? "default"
                      : "muted"
                }
              >
                {group.chapter}
              </MicroLabel>

              {/* Node chain for this chapter */}
              <div className="flex items-center">
                {group.indices.map((idx, nodeIdx) => {
                  const isDone = idx < currentStepIndex;
                  const isCurrent = idx === currentStepIndex;
                  const nextIdx = group.indices[nodeIdx + 1];
                  const hasNext = nextIdx !== undefined;
                  const isConnectorDone =
                    isDone && (nextIdx ?? 0) <= currentStepIndex;

                  return (
                    <div className="flex items-center" key={idx}>
                      {/* Node circle */}
                      <div className="relative flex size-2.5 items-center justify-center">
                        {isCurrent && !isEco && (
                          <motion.span
                            animate={{
                              scale: [1, 2.0],
                              opacity: [0.55, 0],
                            }}
                            className="absolute size-2.5 rounded-full pointer-events-none"
                            style={{
                              backgroundColor: "var(--tour-accent)",
                            }}
                            transition={{
                              duration: 1.6,
                              ease: "easeOut",
                              repeat: Number.POSITIVE_INFINITY,
                            }}
                          />
                        )}
                        <span
                          className={cn(
                            "size-1.5 rounded-full transition-ui motion-normal",
                            isDone &&
                              "bg-[var(--tour-accent)] dark:shadow-[0_0_5px_var(--tour-accent-glow)] shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
                            isCurrent &&
                              "bg-[var(--tour-accent)] scale-125 dark:shadow-[0_0_8px_var(--tour-accent)] shadow-[0_2px_4px_rgba(0,0,0,0.18)]",
                            !(isDone || isCurrent) &&
                              "bg-black/20 dark:bg-[var(--tour-border)] opacity-60 dark:opacity-50"
                          )}
                        />
                      </div>

                      {/* Line connector to next node within the same chapter */}
                      {hasNext && (
                        <div
                          className={cn(
                            "h-[1.5px] w-2 transition-colors motion-normal",
                            isConnectorDone
                              ? "bg-[var(--tour-accent)]"
                              : "bg-black/15 dark:bg-[var(--tour-border)] opacity-50 dark:opacity-40"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Locale-safe step counter */}
      <StepCounter current={currentStepIndex + 1} total={steps.length} />
    </div>
  );
}

/**
 * Backward compatibility alias for ProgressNodeChain
 */
export const ProgressPills = ProgressNodeChain;

// ─── Locale-safe Step Counter ────────────────────────────────────────────────

export interface StepCounterProps {
  className?: string;
  current: number;
  total: number;
}

/**
 * Locale-safe step counter formatted as "n / total" in MicroLabel style.
 * Avoids language-specific words like "of" to stay strictly locale-neutral.
 */
export function StepCounter({ current, total, className }: StepCounterProps) {
  const currentStr = String(current).padStart(2, "0");
  const totalStr = String(total).padStart(2, "0");

  return (
    <MicroLabel
      className={cn(
        "tabular-nums tracking-widest text-[10px] select-none font-mono font-medium shrink-0",
        className
      )}
      size="xs"
      variant="muted"
    >
      <span className="text-[var(--tour-text)]">{currentStr}</span>
      <span className="opacity-35 mx-1 font-mono">/</span>
      <span className="opacity-60">{totalStr}</span>
    </MicroLabel>
  );
}

/**
 * OdometerCounter — Maintained for backwards compatibility, styled with MicroLabel.
 */
export function OdometerCounter({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const prevRef = useRef(current);
  const isIncreasing = current >= prevRef.current;

  useEffect(() => {
    prevRef.current = current;
  }, [current]);

  return (
    <div className="flex items-center tabular-nums text-[11px] font-mono select-none">
      <motion.span
        animate={{ y: 0, opacity: 1 }}
        className="inline-block text-[var(--tour-text)] font-semibold"
        exit={{ y: isIncreasing ? -6 : 6, opacity: 0 }}
        initial={{ y: isIncreasing ? 6 : -6, opacity: 0 }}
        key={current}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {String(current).padStart(2, "0")}
      </motion.span>
      <span className="text-[var(--tour-text-muted)] opacity-40 mx-1">/</span>
      <span className="text-[var(--tour-text-muted)] opacity-60">
        {String(total).padStart(2, "0")}
      </span>
    </div>
  );
}
