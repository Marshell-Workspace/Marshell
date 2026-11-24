"use client";

import { siteConfig } from "@workspace/core/config/site";
import { useResolvedTheme } from "@workspace/core/hooks/use-resolved-theme";
import { useAuthStore } from "@workspace/core/stores/auth-store";
import { useTutorialStore } from "@workspace/core/stores/tutorial-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowLeft, ArrowRight, Check, Settings2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { COMPLETION_STRINGS } from "./completion.constants";
import { playTourCompleteSound } from "./sound";

interface CompletionSceneProps {
  onBack: () => void;
  onDone: () => void;
  onSkip: () => void;
  reducedMotion: boolean;
  tier: "performance" | "balanced" | "eco";
}

const APPLE_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Marshell Completion Scene — "You're all set." (Step 13).
 *
 * Cinematic Apple-style finale closing the tour loop:
 * - Light theme: soft off-white background with subtle ambient gradient mesh,
 *   crisp white logo tile with soft layered shadow, near-black primary button,
 *   translucent glass cards, and quiet corner controls.
 * - Dark theme: midnight cosmos background with volumetric blooms,
 *   elevated white primary button, and dark translucent cards.
 * - Smooth entrance choreography over ~1.6s with cubic-bezier(0.22, 1, 0.36, 1).
 * - Ambient drift, subtle 6s float, and gentle mouse parallax (max 6px).
 * - Reduced motion: pure crossfade without movement.
 */
export function CompletionScene({
  onDone,
  onBack,
  onSkip,
  reducedMotion: propReducedMotion,
  tier,
}: CompletionSceneProps) {
  const systemReduced = Boolean(useReducedMotion());
  const isReduced = propReducedMotion || systemReduced;
  const isEco = tier === "eco" || isReduced;

  const resolvedTheme = useResolvedTheme();
  const isLight = resolvedTheme === "light";

  const [exitTour, setExitTour] = useState<"settings" | null>(null);

  const session = useAuthStore((s) => s.session);
  const userId = session?.user_id || session?.email || "guest_default";
  const getTourRecord = useTutorialStore((s) => s.getTourRecord);
  const launchTour = useTutorialStore((s) => s.launchTour);
  const tourRecord = getTourRecord(userId);
  const isSettingsDone = tourRecord.settings === "completed";

  // Real store data from workspace creation
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const terminalsCount = activeWorkspace?.panes?.length ?? 4;
  const workspaceName = activeWorkspace?.name || "Main Workspace";

  const titleWords = COMPLETION_STRINGS.title.split(" ");

  const launchedRef = useRef(false);

  const handleCardClick = (tourId: "settings") => {
    if (launchedRef.current) {
      return;
    }
    if (isReduced) {
      launchedRef.current = true;
      launchTour(tourId, { fromCompletion: true, userId });
    } else {
      setExitTour(tourId);
      setTimeout(() => {
        if (!launchedRef.current) {
          launchedRef.current = true;
          launchTour(tourId, { fromCompletion: true, userId });
        }
      }, 260);
    }
  };

  // Play soft audio cue once on mount (respects user mute preference & reduced motion)
  useEffect(() => {
    playTourCompleteSound();
  }, []);

  // Keyboard navigation: Enter = complete ("Start building"), Escape = skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "Enter") {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== "BUTTON" && activeTag !== "A") {
          e.preventDefault();
          onDone();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDone, onSkip]);

  const viewportHeight =
    typeof window === "undefined" ? 800 : window.innerHeight;
  const contentScale =
    viewportHeight < 760 ? Math.max(0.78, viewportHeight / 780) : 1;

  return (
    <motion.div
      animate={{ opacity: exitTour ? 0 : 1 }}
      className={cn(
        "fixed inset-0 select-none overflow-hidden flex flex-col items-center justify-center p-4 pointer-events-auto",
        isLight ? "text-[#1D1D1F]" : "text-[var(--tour-text)]"
      )}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      initial={{ opacity: 0 }}
      onAnimationComplete={() => {
        if (exitTour && !launchedRef.current) {
          launchedRef.current = true;
          launchTour(exitTour, { fromCompletion: true, userId });
        }
      }}
      style={{
        zIndex: 9995,
        backgroundColor: isLight ? "#F5F5F7" : "#05070D",
      }}
      transition={{ duration: isEco ? 0.12 : 0.25 }}
    >
      {/* ── Background: Light Apple Gradient Mesh / Dark Cinematic Cosmos ── */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none"
        style={{
          background: isLight
            ? "linear-gradient(180deg, #F5F5F7 0%, #FFFFFF 100%)"
            : "linear-gradient(180deg, #05070D 0%, #030509 100%)",
        }}
      />

      {isLight ? (
        /* Light Theme: subtle large radial gradient mesh with slow 20s+ drift */
        <motion.div
          animate={isReduced ? undefined : { x: [-8, 8, -8], y: [-6, 6, -6] }}
          aria-hidden="true"
          className="fixed inset-[-30px] pointer-events-none"
          style={{
            backgroundImage: [
              "radial-gradient(circle at 20% 25%, rgba(245, 158, 11, 0.08) 0%, transparent 45%)",
              "radial-gradient(circle at 80% 30%, rgba(139, 92, 246, 0.07) 0%, transparent 48%)",
              "radial-gradient(circle at 50% 85%, rgba(13, 148, 136, 0.07) 0%, transparent 50%)",
            ].join(", "),
          }}
          transition={{
            duration: 24,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      ) : (
        /* Dark Theme: midnight cosmos background with soft volumetric blooms */
        <>
          <div
            aria-hidden="true"
            className="fixed -top-[12%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] rounded-full blur-[140px] pointer-events-none opacity-20"
            style={{
              background:
                "radial-gradient(ellipse at center, var(--tour-accent, #3b82f6) 0%, transparent 70%)",
            }}
          />
          <div
            aria-hidden="true"
            className="fixed -bottom-[16%] right-[10%] w-[700px] h-[500px] rounded-full blur-[160px] pointer-events-none opacity-10"
            style={{
              background:
                "radial-gradient(circle, #f59e0b 0%, #d97706 30%, transparent 70%)",
            }}
          />
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, transparent 55%, rgba(3, 5, 10, 0.75) 100%)",
            }}
          />
        </>
      )}

      {/* ── Discreet Corner Controls (Back and Skip tour) ───── */}
      <button
        aria-label="Back to previous step"
        className={cn(
          "fixed top-6 left-6 flex items-center gap-1.5 font-sans text-xs font-medium transition-colors py-1.5 px-3 rounded-lg cursor-pointer z-30 focus:outline-none",
          isLight
            ? "text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04] focus-visible:ring-1 focus-visible:ring-black/30"
            : "text-white/50 hover:text-white/85 hover:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-white/40"
        )}
        onClick={onBack}
        type="button"
      >
        <ArrowLeft className="size-3.5" />
        <span>{COMPLETION_STRINGS.ctaBack}</span>
      </button>

      <button
        aria-label="Skip tour"
        className={cn(
          "fixed top-6 right-6 font-sans text-xs font-medium transition-colors py-1.5 px-3 rounded-lg cursor-pointer z-30 focus:outline-none",
          isLight
            ? "text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04] focus-visible:ring-1 focus-visible:ring-black/30"
            : "text-white/50 hover:text-white/85 hover:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-white/40"
        )}
        onClick={onSkip}
        type="button"
      >
        {COMPLETION_STRINGS.ctaSkip}
      </button>

      {/* ── Main Scene Column (Choreographed Entrance) ────────────── */}
      <div
        className="relative z-10 flex flex-col items-center text-center max-w-[620px] w-full px-4"
        style={{
          transform: `scale(${contentScale})`,
          transformOrigin: "center 30%",
        }}
      >
        {/* ── 1. The Central Marshell Emblem + Light Bloom ─────────── */}
        <div className="relative flex items-center justify-center mb-6">
          {/* Bloom behind logo */}
          <motion.div
            animate={{
              scale: isReduced ? 1 : [0.8, 1],
              opacity: isReduced
                ? isLight
                  ? 0.85
                  : 0.75
                : isLight
                  ? [0, 0.85]
                  : [0, 0.9, 0.75],
            }}
            aria-hidden="true"
            className="absolute -inset-12 rounded-full pointer-events-none"
            initial={{ scale: 0.8, opacity: 0 }}
            style={{
              background: isLight
                ? "radial-gradient(circle at center, rgba(37, 99, 235, 0.12) 0%, rgba(245, 158, 11, 0.08) 45%, transparent 70%)"
                : "radial-gradient(ellipse at 40% 45%, var(--tour-accent-glow, rgba(59, 130, 246, 0.45)) 0%, color-mix(in oklab, #f59e0b 20%, transparent) 55%, transparent 75%)",
            }}
            transition={{
              duration: isReduced ? 0.1 : 0.55,
              ease: APPLE_EASE,
            }}
          />

          {/* Central Logo Tile: settles after entrance and stays completely STILL */}
          <motion.div
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="relative z-20 flex size-[86px] sm:size-[90px] items-center justify-center rounded-[22px] overflow-hidden"
            initial={{
              scale: isReduced ? 1 : 0.92,
              opacity: 0,
              y: isReduced ? 0 : 8,
            }}
            style={{
              background: isLight
                ? "#FFFFFF"
                : "linear-gradient(180deg, rgba(20, 28, 48, 0.85) 0%, rgba(10, 15, 30, 0.95) 100%)",
              border: isLight ? "1px solid rgba(0, 0, 0, 0.08)" : undefined,
              boxShadow: isLight
                ? [
                    "0 0 0 1px rgba(0, 0, 0, 0.04)",
                    "0 16px 36px -4px rgba(0, 0, 0, 0.08)",
                    "0 4px 12px -2px rgba(0, 0, 0, 0.04)",
                  ].join(", ")
                : [
                    "0 0 0 1px rgba(255, 255, 255, 0.14)",
                    "inset 0 1px 0 rgba(255, 255, 255, 0.32)",
                    "0 20px 48px rgba(0, 0, 0, 0.65)",
                    "0 0 36px var(--tour-accent-glow, rgba(59, 130, 246, 0.28))",
                  ].join(", "),
            }}
            transition={{
              duration: isReduced ? 0.15 : 0.5,
              delay: isReduced ? 0 : 0.05,
              ease: APPLE_EASE,
            }}
          >
            <Image
              alt={siteConfig.name}
              className="size-[64px] sm:size-[68px] object-contain select-none relative z-10"
              height={68}
              priority
              src={
                isLight ? "/main_logo_light_256.webp" : "/main_logo_256.webp"
              }
              width={68}
            />

            {/* Single soft light sweep across the logo tile right after it settles (~900ms, once, never loops) */}
            {!isReduced && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[22px] overflow-hidden z-20"
              >
                <motion.div
                  animate={{
                    transform: "translateX(240%) rotate(25deg)",
                    opacity: isLight ? [0, 0.45, 0] : [0, 0.5, 0],
                  }}
                  className={cn(
                    "pointer-events-none absolute -inset-y-8 -left-8 w-12",
                    isLight
                      ? "bg-gradient-to-r from-transparent via-white/80 to-transparent"
                      : "bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  )}
                  initial={{
                    transform: "translateX(-160%) rotate(25deg)",
                    opacity: 0,
                  }}
                  transition={{
                    duration: 0.9,
                    delay: 0.58,
                    ease: "easeInOut",
                  }}
                />
              </div>
            )}
          </motion.div>
        </div>

        {/* ── 2. Headline: Word by word reveal (60ms stagger) + one-time sheen ── */}
        <div className="relative inline-block">
          <h1
            className={cn(
              "font-display text-4xl sm:text-[46px] font-semibold tracking-tight leading-tight flex flex-wrap justify-center gap-x-2.5",
              isLight ? "text-[#1D1D1F]" : "text-white"
            )}
          >
            {titleWords.map((word, wi) => (
              <motion.span
                animate={{
                  y: 0,
                  opacity: 1,
                  filter: "blur(0px)",
                }}
                className="inline-block"
                initial={
                  isReduced
                    ? { opacity: 0 }
                    : { y: 8, opacity: 0, filter: "blur(4px)" }
                }
                key={word}
                transition={{
                  duration: isReduced ? 0.15 : 0.4,
                  delay: isReduced ? 0 : 0.25 + wi * 0.06,
                  ease: APPLE_EASE,
                }}
              >
                {word}
              </motion.span>
            ))}
          </h1>

          {/* One-time subtle sheen across the headline after it appears */}
          {!isReduced && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <motion.div
                animate={{
                  transform: "translateX(250%) skewX(-20deg)",
                  opacity: isLight ? [0, 0.25, 0] : [0, 0.35, 0],
                }}
                className={cn(
                  "pointer-events-none absolute -inset-y-4 -left-12 w-1/3",
                  isLight
                    ? "bg-gradient-to-r from-transparent via-slate-900/15 to-transparent"
                    : "bg-gradient-to-r from-transparent via-white/35 to-transparent"
                )}
                initial={{
                  transform: "translateX(-150%) skewX(-20deg)",
                  opacity: 0,
                }}
                transition={{
                  duration: 0.8,
                  delay: 0.75,
                  ease: "easeInOut",
                }}
              />
            </div>
          )}
        </div>

        <motion.p
          animate={{ y: 0, opacity: 1 }}
          className={cn(
            "mt-3 font-sans text-[14px] sm:text-[15px] leading-relaxed max-w-[460px]",
            isLight ? "text-[rgba(60,60,67,0.7)]" : "text-zinc-400"
          )}
          initial={{ y: isReduced ? 0 : 6, opacity: 0 }}
          transition={{
            duration: isReduced ? 0.15 : 0.35,
            delay: isReduced ? 0 : 0.48,
            ease: APPLE_EASE,
          }}
        >
          {COMPLETION_STRINGS.subtitle}
        </motion.p>

        {/* ── 3. Workspace Glass Pill (Expands from small dot) + Terminal Dots ── */}
        <motion.div
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            clipPath: isReduced ? undefined : "inset(0 0% 0 0% round 9999px)",
          }}
          className={cn(
            "mt-5 inline-flex items-center gap-3 px-4 py-2 rounded-full text-xs font-sans shadow-xs backdrop-blur-xl overflow-hidden",
            isLight
              ? "border border-black/[0.08] bg-black/[0.03] text-[#1D1D1F]"
              : "border border-white/[0.08] bg-white/[0.03] text-zinc-300"
          )}
          initial={
            isReduced
              ? { opacity: 0, y: 0 }
              : {
                  opacity: 0,
                  y: 6,
                  scale: 0.85,
                  clipPath: "inset(0 47% 0 47% round 9999px)",
                }
          }
          transition={{
            duration: isReduced ? 0.15 : 0.38,
            delay: isReduced ? 0 : 0.65,
            ease: APPLE_EASE,
          }}
        >
          {/* Sequential mini terminal dots (illuminate one by one, 80ms apart) */}
          <div aria-hidden="true" className="flex items-center gap-1.5 pl-0.5">
            {[0, 1, 2, 3].map((idx) => (
              <motion.span
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                className={cn(
                  "size-1.5 rounded-full",
                  isLight
                    ? "bg-amber-500 shadow-xs"
                    : "bg-amber-400/90 shadow-[0_0_6px_rgba(245,158,11,0.5)]"
                )}
                initial={{
                  opacity: isReduced ? 1 : 0.15,
                  scale: isReduced ? 1 : 0.6,
                }}
                key={`term-node-${idx}`}
                transition={{
                  duration: isReduced ? 0.1 : 0.22,
                  delay: isReduced ? 0 : 1.02 + idx * 0.08,
                  ease: APPLE_EASE,
                }}
              />
            ))}
          </div>

          <motion.div
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 leading-none"
            initial={{ opacity: isReduced ? 1 : 0 }}
            transition={{
              duration: isReduced ? 0.1 : 0.25,
              delay: isReduced ? 0 : 0.85,
            }}
          >
            <span
              className={cn(
                "font-medium",
                isLight ? "text-[#1D1D1F]" : "text-white"
              )}
            >
              {workspaceName}
            </span>
            <span className={isLight ? "text-zinc-400" : "text-zinc-500"}>
              &bull;
            </span>
            <span
              className={
                isLight ? "text-[rgba(60,60,67,0.7)]" : "text-zinc-400"
              }
            >
              {terminalsCount} active{" "}
              {terminalsCount === 1 ? "terminal" : "terminals"}
            </span>
          </motion.div>
        </motion.div>

        {/* ── 4. Primary Action: Pill Button ────────── */}
        <motion.div
          animate={{ y: 0, opacity: 1 }}
          className="mt-7 relative flex justify-center"
          initial={{ y: isReduced ? 0 : 8, opacity: 0 }}
          transition={{
            duration: isReduced ? 0.15 : 0.35,
            delay: isReduced ? 0 : 1.05,
            ease: APPLE_EASE,
          }}
        >
          <motion.button
            autoFocus
            className={cn(
              "group relative h-12 px-8 rounded-full flex items-center justify-center gap-2.5 font-sans font-semibold text-[15px] cursor-pointer select-none overflow-hidden focus:outline-none",
              isLight
                ? "bg-[#1D1D1F] text-white hover:bg-[#2c2c2e] focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F5F7]"
                : "bg-white text-zinc-950 hover:brightness-[1.03] focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070D]"
            )}
            onClick={onDone}
            style={{
              boxShadow: isLight
                ? "0 8px 24px -2px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08)"
                : "inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 8px 24px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.25)",
            }}
            type="button"
            whileHover={isReduced ? undefined : { y: -1 }}
            whileTap={isReduced ? undefined : { scale: 0.97, y: 0 }}
          >
            <span>{COMPLETION_STRINGS.ctaDone}</span>
            <ArrowRight className="size-4 shrink-0 transition-transform ease-out group-hover:translate-x-[3px]" />

            {/* Single soft shimmer pass (once, about 700ms, never loops) */}
            {!isReduced && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full overflow-hidden"
              >
                <motion.div
                  animate={{
                    transform: "translateX(250%) skewX(-20deg)",
                    opacity: isLight ? [0, 0.35, 0] : [0, 0.45, 0],
                  }}
                  className={cn(
                    "pointer-events-none absolute -inset-y-2 w-1/2",
                    isLight
                      ? "bg-gradient-to-r from-transparent via-white/40 to-transparent"
                      : "bg-gradient-to-r from-transparent via-white/60 to-transparent"
                  )}
                  initial={{
                    transform: "translateX(-150%) skewX(-20deg)",
                    opacity: 0,
                  }}
                  transition={{
                    duration: 0.7,
                    delay: 1.32,
                    ease: "easeInOut",
                  }}
                />
              </div>
            )}
          </motion.button>
        </motion.div>

        {/* ── 5. Keep Exploring: Settings Tour Card ──────────── */}
        <div className="mt-8 w-full max-w-[340px]">
          <div className="grid grid-cols-1 gap-3 w-full">
            {/* Settings Tour Card */}
            <motion.button
              animate={{ y: 0, opacity: 1 }}
              className={cn(
                "group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl text-left cursor-pointer overflow-hidden focus:outline-none transition-colors",
                isLight
                  ? "bg-white/[0.85] backdrop-blur-xl border border-black/[0.08] hover:border-black/20 focus-visible:ring-1 focus-visible:ring-black/40"
                  : "border border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/20 focus-visible:ring-1 focus-visible:ring-white/40"
              )}
              initial={{ y: isReduced ? 0 : 8, opacity: 0 }}
              onClick={() => handleCardClick("settings")}
              style={{
                boxShadow: isLight
                  ? "0 8px 24px -4px rgba(0, 0, 0, 0.06), 0 2px 8px -2px rgba(0, 0, 0, 0.04)"
                  : "0 4px 20px rgba(0, 0, 0, 0.25)",
              }}
              transition={{
                duration: isReduced ? 0.15 : 0.38,
                delay: isReduced ? 0 : 1.24,
                ease: APPLE_EASE,
              }}
              type="button"
              whileHover={
                isReduced
                  ? undefined
                  : {
                      y: -2,
                      boxShadow: isLight
                        ? "0 12px 28px -4px rgba(0, 0, 0, 0.10), 0 4px 12px -2px rgba(0, 0, 0, 0.06)"
                        : "0 8px 24px rgba(0, 0, 0, 0.35)",
                    }
              }
            >
              {/* Subtle top-lit highlight on dark */}
              {!isLight && (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent pointer-events-none"
                />
              )}

              <div className="flex items-center gap-3 pr-2">
                <div
                  className={cn(
                    "size-9.5 shrink-0 rounded-xl flex items-center justify-center transition-colors",
                    isLight
                      ? "bg-teal-100/90 border border-teal-200/80 text-teal-700 group-hover:bg-teal-100"
                      : "bg-teal-500/10 border border-teal-500/20 text-teal-400 group-hover:bg-teal-500/15"
                  )}
                >
                  <Settings2 className="size-4.5" />
                </div>
                <div>
                  <div
                    className={cn(
                      "font-sans font-medium text-sm flex items-center gap-2",
                      isLight ? "text-[#1D1D1F]" : "text-zinc-100"
                    )}
                  >
                    <span>{COMPLETION_STRINGS.tours.settings.title}</span>
                    {isSettingsDone && (
                      <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-normal">
                        <Check className="size-3 text-zinc-500" />
                        Done
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "font-sans text-[12px] mt-0.5 leading-normal",
                      isLight ? "text-[rgba(60,60,67,0.7)]" : "text-zinc-400"
                    )}
                  >
                    {COMPLETION_STRINGS.tours.settings.description}
                  </p>
                </div>
              </div>

              <ArrowRight
                className={cn(
                  "size-4 group-hover:translate-x-0.5 transition-transform ease-out shrink-0 ml-1",
                  isLight
                    ? "text-zinc-400 group-hover:text-zinc-700"
                    : "text-zinc-500 group-hover:text-zinc-200"
                )}
              />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
