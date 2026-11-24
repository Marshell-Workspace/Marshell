"use client";

import type { IntentClassification } from "@workspace/core/lib/tour-intent";
import type { PlacementResult } from "@workspace/core/lib/tour-placement";
import type { TourStep } from "@workspace/core/stores/tutorial-store";
import { cn } from "@workspace/ui/lib/utils";
import { Check, Circle } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface TooltipCardProps {
  activeTour: string | null;
  currentStepIndex: number;
  intentResult: IntentClassification;
  isGoalSatisfied: boolean;
  isLast: boolean;
  isOutOfView?: boolean;
  launchedFromCompletion?: boolean;
  onBack: () => void;
  onChainTour?: (tourId: "settings") => void;
  onComplete: () => void;
  onNext: () => void;
  onScrollToAnchor?: () => void;
  onShakeComplete?: () => void;
  onSkipRequest: () => void;
  placement: PlacementResult | null;
  prevStepIndex: number;
  reducedMotion: boolean;
  shakeActionBadge: boolean;
  step: TourStep;
  steps: TourStep[];
  tier: "performance" | "balanced" | "eco";
}

/**
 * TooltipCard — Apple-inspired calm tour popup card.
 *
 * Characteristics:
 * - 320px width, 14px radius
 * - Translucent blurred material (backdrop-filter: blur(24px))
 * - 1px hairline border, soft layered shadow
 * - Top-to-bottom layout:
 *   1. Step counter ("3 of 14", normal case)
 *   2. Title (15px semibold)
 *   3. Body (13px, secondary color, line-height 1.45)
 *   4. Action hint: one quiet line of text with small icon
 *   5. Footer: low-emphasis "Skip", quiet text "Back", compact pill "Next" / "Done"
 * - Step-to-step motion:
 *   - >120px: fade out old card (120ms), move while invisible, fade in with 8px slide (200ms)
 *   - <=120px: smooth translation (240ms)
 *   - Reduced motion: plain crossfade with no movement
 */
export function TooltipCard({
  step,
  steps,
  currentStepIndex,
  activeTour,
  placement,
  onNext,
  onBack,
  onComplete,
  onSkipRequest,
  isGoalSatisfied,
  isLast,
  launchedFromCompletion: _launchedFromCompletion,
  onChainTour: _onChainTour,
  intentResult,
  reducedMotion,
}: TooltipCardProps) {
  const [isPeeking, setIsPeeking] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isBottomSheet = placement?.mode === "bottom-sheet";

  const targetX = placement?.x ?? 0;
  const targetY = placement?.y ?? 0;

  // Step transition state machine
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [cardOpacity, setCardOpacity] = useState(1);
  const [slideY, setSlideY] = useState(0);
  const [smoothMoving, setSmoothMoving] = useState(false);
  const prevPlacementRef = useRef<{ x: number; y: number } | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!placement) {
      return;
    }

    const newX = placement.x;
    const newY = placement.y;

    if (prevPlacementRef.current === null) {
      // First position: snap immediately without 0,0 frame or fly-in
      setCoords({ x: newX, y: newY });
      setCardOpacity(1);
      setSlideY(0);
      setSmoothMoving(false);
      prevPlacementRef.current = { x: newX, y: newY };
      return;
    }

    const oldX = prevPlacementRef.current.x;
    const oldY = prevPlacementRef.current.y;
    const dist = Math.hypot(newX - oldX, newY - oldY);

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    if (reducedMotion) {
      // Reduced motion: plain crossfade without movement
      setSmoothMoving(false);
      setCardOpacity(0);
      transitionTimerRef.current = setTimeout(() => {
        setCoords({ x: newX, y: newY });
        setSlideY(0);
        setCardOpacity(1);
        prevPlacementRef.current = { x: newX, y: newY };
      }, 120);
      return;
    }

    if (dist <= 120) {
      // Within ~120px: animate smoothly in 240ms
      setSmoothMoving(true);
      setCoords({ x: newX, y: newY });
      setSlideY(0);
      setCardOpacity(1);
      prevPlacementRef.current = { x: newX, y: newY };
      return;
    }

    // Distance > 120px: fade out old card (120ms), move while invisible, fade in with 8px slide (200ms)
    setSmoothMoving(false);
    setCardOpacity(0);
    transitionTimerRef.current = setTimeout(() => {
      setCoords({ x: newX, y: newY });
      setSlideY(8);
      requestAnimationFrame(() => {
        setCardOpacity(1);
        setSlideY(0);
        prevPlacementRef.current = { x: newX, y: newY };
      });
    }, 120);

    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, [placement?.x, placement?.y, reducedMotion, placement]);

  // Peek behind card via Alt key hold
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setIsPeeking(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setIsPeeking(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Horizontal touch swipe handling for mobile
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) {
      return;
    }
    const touch = e.changedTouches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      if (deltaX < 0) {
        // Swipe Left: Advance step
        if (step.type === "action" && !isGoalSatisfied) {
          onNext();
        } else if (isLast) {
          onComplete();
        } else {
          onNext();
        }
      } else if (deltaX > 0) {
        // Swipe Right: Back step
        const isBackBlocked =
          currentStepIndex === 0 ||
          (activeTour === "onboarding" && currentStepIndex >= 10);
        if (!isBackBlocked) {
          onBack();
        }
      }
    }
  };

  const isHidden = !placement;

  return (
    <motion.div
      animate={{
        x: coords?.x ?? targetX,
        y: (coords?.y ?? targetY) + slideY,
        opacity: isPeeking ? 0.12 : isHidden ? 0 : cardOpacity,
      }}
      aria-live="polite"
      className={cn(
        "fixed pointer-events-auto flex flex-col focus:outline-none select-none font-sans",
        isHidden && "opacity-0 pointer-events-none"
      )}
      data-tour-element="tooltip-card"
      initial={false}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      ref={cardRef}
      style={{
        width: 320,
        zIndex: 9995,
        position: "fixed",
        top: 0,
        left: 0,
      }}
      tabIndex={step.type === "info" ? 0 : -1}
      transition={
        smoothMoving
          ? {
              x: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
              y: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.15 },
            }
          : {
              x: { duration: 0 },
              y: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
              opacity: {
                duration: cardOpacity === 0 ? 0.12 : 0.2,
                ease: [0.22, 1, 0.36, 1],
              },
            }
      }
    >
      <div
        className="w-full relative flex flex-col font-sans select-none overflow-hidden"
        style={{
          width: 320,
          backgroundColor: "var(--tour-card-bg)",
          border: "1px solid var(--tour-card-border)",
          borderRadius: "14px",
          boxShadow: "var(--tour-card-shadow)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          padding: "16px 18px",
        }}
      >
        {/* Mobile Bottom-Sheet Drag Handle */}
        {isBottomSheet && (
          <div aria-hidden="true" className="flex justify-center pb-2 -mt-1">
            <span className="w-9 h-1 rounded-full bg-foreground/20" />
          </div>
        )}

        {/* 1. Small step counter: "3 of 14", normal case */}
        <div className="text-[12px] font-normal text-[var(--tour-text-muted)] mb-2 select-none">
          {currentStepIndex + 1} of {steps.length}
        </div>

        {/* 2 & 3. Title (15px semibold) & Body (13px, secondary color, line-height 1.45) */}
        <div className="text-left">
          <h3 className="font-semibold text-[15px] leading-snug text-[var(--tour-text)] mb-1">
            {step.title}
          </h3>

          <p className="text-[13px] leading-[1.45] text-[var(--tour-text-muted)]">
            {step.body}
          </p>

          {/* 4. Action-step hint: one quiet line of text with a small icon */}
          {step.type === "action" && (
            <div className="flex items-center gap-1.5 pt-2 text-[12px] text-[var(--tour-text-muted)]">
              {isGoalSatisfied ? (
                <>
                  <Check className="size-3.5 text-[var(--tour-text-muted)] shrink-0" />
                  <span>Input received</span>
                </>
              ) : (
                <>
                  <Circle className="size-2 fill-current text-[var(--tour-text-muted)] shrink-0" />
                  <span>
                    {intentResult.guidanceText ||
                      step.actionHint ||
                      "Perform action to continue"}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* 5. Footer: low-emphasis "Skip", quiet text "Back", compact pill "Next" / "Done" */}
        <div className="flex items-center justify-between pt-4 mt-auto">
          <button
            className="text-[13px] text-[var(--tour-text-muted)] hover:text-[var(--tour-text)] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tour-focus-ring)] rounded"
            onClick={onSkipRequest}
            type="button"
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            {/* Quiet text-style "Back" */}
            {currentStepIndex > 0 &&
              !(activeTour === "onboarding" && currentStepIndex === 10) && (
                <button
                  className="px-2 py-1 text-[13px] text-[var(--tour-text-muted)] hover:text-[var(--tour-text)] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tour-focus-ring)] rounded"
                  onClick={onBack}
                  type="button"
                >
                  Back
                </button>
              )}

            {/* Compact pill-shaped "Next" / "Done" */}
            <button
              aria-disabled={step.type === "action" && !isGoalSatisfied}
              className={cn(
                "h-[32px] px-3.5 rounded-full text-[13px] font-medium transition-ui active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tour-focus-ring)] focus-visible:ring-offset-2 flex items-center justify-center gap-1.5",
                step.type === "action" && !isGoalSatisfied
                  ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                  : "bg-[#1D1D1F] text-white hover:bg-[#2c2c2e] dark:bg-primary dark:text-primary-foreground dark:hover:opacity-90"
              )}
              onClick={isLast ? onComplete : onNext}
              type="button"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
