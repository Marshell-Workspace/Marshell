/**
 * useWelcomeTimeline.ts — Master Clock Hook for Marshell Cinematic Intro.
 *
 * Implements:
 * - Single requestAnimationFrame loop driving master clock time T (seconds).
 * - Direct element ref updates via registerFrameCallback (zero React re-renders per frame).
 * - Per-frame delta clamped to 50ms (never jumps wildly on lag).
 * - Window visibilitychange pausing (never advances while hidden).
 * - Script font readiness check with 800ms timeout fallback.
 * - Full scrubbing, seek, pause, play, and instant skip-to-end support.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WELCOME_CONFIG } from "./welcome.config";

export interface UseWelcomeTimelineOptions {
  onReady?: () => void;
  reducedMotion: boolean;
  timeScale?: number;
}

export type FrameCallback = (tSec: number) => void;

export function useWelcomeTimeline({
  reducedMotion,
  timeScale = WELCOME_CONFIG.timeScale,
  onReady,
}: UseWelcomeTimelineOptions) {
  const [isFontReady, setIsFontReady] = useState(false);
  const [isReady, setIsReady] = useState(reducedMotion);
  const [isPlaying, setIsPlaying] = useState(!reducedMotion);

  const timeRef = useRef(
    reducedMotion ? WELCOME_CONFIG.welcome.totalDuration : 0
  );
  const isPlayingRef = useRef(!reducedMotion);
  const lastTimestampRef = useRef<number | null>(null);
  const callbacksRef = useRef<Set<FrameCallback>>(new Set());
  const rafIdRef = useRef<number>(0);
  const hasTriggeredReadyRef = useRef(reducedMotion);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // ── 1. Script Font Pre-Flight Readiness Check ──────────────────────────────
  useEffect(() => {
    if (reducedMotion || typeof window === "undefined") {
      setIsFontReady(true);
      return;
    }

    let isCancelled = false;
    const timeout = setTimeout(() => {
      if (!isCancelled) {
        setIsFontReady(true);
      }
    }, 800);

    const fontCheck = document.fonts
      ? Promise.all([
          document.fonts.load('48px "Great Vibes"'),
          document.fonts.load("400 48px Sacramento"),
        ])
      : Promise.resolve();

    fontCheck
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        if (!isCancelled) {
          setIsFontReady(true);
        }
      });

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [reducedMotion]);

  // ── 2. Register Direct DOM Ref Frame Callbacks ────────────────────────────
  const registerFrameCallback = useCallback((callback: FrameCallback) => {
    callbacksRef.current.add(callback);
    // Immediately invoke once with current time
    callback(timeRef.current);
    return () => {
      callbacksRef.current.delete(callback);
    };
  }, []);

  // ── 3. Step Clock and Dispatch to Subscribers ─────────────────────────────
  const stepClock = useCallback((tSec: number) => {
    timeRef.current = tSec;
    for (const cb of callbacksRef.current) {
      cb(tSec);
    }

    if (
      !hasTriggeredReadyRef.current &&
      tSec >= WELCOME_CONFIG.welcome.totalDuration
    ) {
      hasTriggeredReadyRef.current = true;
      setIsReady(true);
      onReadyRef.current?.();
    }
  }, []);

  // ── 4. Master RequestAnimationFrame Loop ──────────────────────────────────
  useEffect(() => {
    if (
      !(isFontReady && isPlaying) ||
      reducedMotion ||
      typeof window === "undefined"
    ) {
      return;
    }

    const onVisibilityChange = () => {
      cancelAnimationFrame(rafIdRef.current);
      lastTimestampRef.current = null;
      if (!document.hidden && isPlayingRef.current) {
        rafIdRef.current = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const tick = (now: number) => {
      if (!isPlayingRef.current || document.hidden) {
        lastTimestampRef.current = null;
        return;
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = now;
      } else {
        // Delta in seconds, clamped to max 50ms to prevent huge jumps on tab switch/lag
        const rawDelta = (now - lastTimestampRef.current) / 1000;
        const clampedDelta = Math.min(0.05, Math.max(0, rawDelta));
        lastTimestampRef.current = now;

        const newTime = Math.min(
          WELCOME_CONFIG.welcome.totalDuration,
          timeRef.current + clampedDelta * timeScale
        );
        stepClock(newTime);
        if (newTime >= WELCOME_CONFIG.welcome.totalDuration) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          return;
        }
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isFontReady, isPlaying, reducedMotion, timeScale, stepClock]);

  // ── 5. Playback Controls ──────────────────────────────────────────────────
  const play = useCallback(() => {
    isPlayingRef.current = true;
    setIsPlaying(true);
    lastTimestampRef.current = null;
  }, []);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    lastTimestampRef.current = null;
  }, []);

  const seek = useCallback(
    (targetSec: number) => {
      stepClock(Math.max(0, targetSec));
    },
    [stepClock]
  );

  const skipToEnd = useCallback(() => {
    stepClock(WELCOME_CONFIG.welcome.totalDuration);
    pause();
  }, [stepClock, pause]);

  useEffect(() => {
    if (reducedMotion) {
      stepClock(WELCOME_CONFIG.welcome.totalDuration);
      pause();
    }
  }, [reducedMotion, stepClock, pause]);

  // Dev hook for instant CDP testing
  useEffect(() => {
    if (typeof window !== "undefined") {
      (
        window as unknown as { __welcomeTimelineSeek?: (t: number) => void }
      ).__welcomeTimelineSeek = seek;
    }
  }, [seek]);

  return {
    timeRef,
    isFontReady,
    isReady,
    isPlaying,
    registerFrameCallback,
    play,
    pause,
    seek,
    skipToEnd,
  };
}
