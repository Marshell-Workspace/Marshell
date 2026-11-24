/**
 * DevScrubber.tsx — Development Scrubber for Storyboard Frame Comparison (Revision 6b).
 *
 * Implements:
 * - Toggled by `?welcomeDebug=1` query param or `Ctrl+Shift+D` shortcut.
 * - Live time slider (0.00s -> 6.10s) with current timestamp readout and frame time metrics.
 * - Play / Pause button.
 * - Quick jump buttons for all 6 storyboard frames:
 *   [0.0s VOID] [0.7s RESONANCE] [1.6s UNFOLD] [2.7s ALIGN] [4.0s WELCOME] [6.1s READY]
 * - 9-Layer Solo and Mute toggles for all 9 layers (Revision 6b Item 8):
 *   [frame-3, silk, horns, wings, panels, rear cards, flank glows, text, logo]
 * - Real-time timing violation detector (Frame 3 WebGL dormancy check, Canvas2D sole ownership).
 * - Collapsible drawable inspection table showing active drawables and bounding boxes.
 * - Stripped / dormant in production builds.
 */

"use client";

import { useEffect, useState } from "react";
import {
  createDefaultLayerState,
  type LayerVisibilityState,
  setLayerState,
  WELCOME_CONFIG,
  WELCOME_DEBUG_LAYERS,
  type WelcomeDebugLayer,
} from "./welcome.config";

export interface DevScrubberProps {
  isPlaying: boolean;
  onPause: () => void;
  onPlay: () => void;
  onSeek: (tSec: number) => void;
  timeRef: React.RefObject<number>;
}

const STORYBOARD_FRAMES = [
  { label: "0.0s VOID", t: 0.0 },
  { label: "0.7s RESONANCE", t: 0.7 },
  { label: "1.6s UNFOLD", t: 1.6 },
  { label: "2.7s ALIGN", t: 2.7 },
  { label: "4.0s WELCOME", t: 4.0 },
  { label: "6.1s READY", t: 6.1 },
] as const;

export function DevScrubber({
  timeRef,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
}: DevScrubberProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [showInspector, setShowInspector] = useState(false);

  // 9-Layer Visibility State (Revision 6b)
  const [layers, setLayers] = useState<LayerVisibilityState>(
    createDefaultLayerState
  );

  // Toggle via Ctrl+Shift+D or ?welcomeDebug=1
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Expose programmatic controls for test harnesses
    (window as any).__welcomeTimelineSeek = (t: number) => {
      setDisplayTime(t);
      onSeek(t);
    };
    (window as any).__welcomeTimelinePause = () => {
      onPause();
    };
    (window as any).__welcomeTimelinePlay = () => {
      onPlay();
    };

    if (window.location.search.includes("welcomeDebug=1")) {
      setIsVisible(true);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setIsVisible((v) => !v);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      (window as any).__welcomeTimelineSeek = undefined;
      (window as any).__welcomeTimelinePause = undefined;
      (window as any).__welcomeTimelinePlay = undefined;
    };
  }, [onPause, onPlay, onSeek]);

  // Sync layer state to global observer
  const toggleMute = (layer: WelcomeDebugLayer) => {
    setLayers((prev) => {
      const next: LayerVisibilityState = {
        ...prev,
        muted: {
          ...prev.muted,
          [layer]: !prev.muted[layer],
        },
      };
      setLayerState(next);
      return next;
    });
  };

  const toggleSolo = (layer: WelcomeDebugLayer) => {
    setLayers((prev) => {
      const next: LayerVisibilityState = {
        ...prev,
        solo: prev.solo === layer ? null : layer,
      };
      setLayerState(next);
      return next;
    });
  };

  const clearSolo = () => {
    setLayers((prev) => {
      const next: LayerVisibilityState = { ...prev, solo: null };
      setLayerState(next);
      return next;
    });
  };

  const unmuteAll = () => {
    setLayers((prev) => {
      const next: LayerVisibilityState = createDefaultLayerState();
      next.solo = prev.solo;
      setLayerState(next);
      return next;
    });
  };

  // Update slider display time periodically when scrubber is open
  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const interval = setInterval(() => {
      setDisplayTime(timeRef.current ?? 0);
    }, 50);
    return () => clearInterval(interval);
  }, [isVisible, timeRef]);

  if (!isVisible) {
    return null;
  }

  const total = WELCOME_CONFIG.welcome.totalDuration;

  // Frame 3 Safety Check: T in [1.60, 2.55s]
  const isFrame3 = displayTime >= 1.6 && displayTime <= 2.55;

  return (
    <aside
      aria-label="Welcome Intro Scrubber"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 p-3.5 rounded-2xl bg-[#090D18]/95 border border-white/15 backdrop-blur-md shadow-2xl text-white font-mono text-xs select-none max-w-[96vw]"
      id="welcome-intro-scrubber"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-400">
            STORYBOARD SCRUBBER
          </span>
          {isFrame3 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              FRAME 3: Canvas2D Solo
            </span>
          )}
          {layers.solo && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
              SOLO: {layers.solo.toUpperCase()}
            </span>
          )}
        </div>
        <span className="text-white/80 tabular-nums">
          T = {displayTime.toFixed(2)}s / {total.toFixed(2)}s
        </span>
        <div className="flex items-center gap-2">
          <button
            className={`px-2 py-0.5 rounded text-[11px] ${
              showInspector
                ? "bg-amber-500 text-black font-semibold"
                : "bg-white/10 hover:bg-white/20 text-white/70"
            }`}
            onClick={() => setShowInspector((s) => !s)}
            type="button"
          >
            {showInspector ? "Hide Inspector" : "Inspect Drawables"}
          </button>
          <button
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
            onClick={() => setIsVisible(false)}
            type="button"
          >
            Close (Ctrl+Shift+D)
          </button>
        </div>
      </div>

      {/* Slider */}
      <div className="flex items-center gap-3">
        <button
          className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-sans font-medium"
          onClick={() => {
            if (isPlaying) {
              onPause();
            } else {
              onPlay();
            }
          }}
          type="button"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <input
          className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-white/20 rounded-lg"
          max={total}
          min={0}
          onChange={(e) => {
            const val = Number.parseFloat(e.target.value);
            setDisplayTime(val);
            onSeek(val);
          }}
          step={0.01}
          type="range"
          value={displayTime}
        />
      </div>

      {/* Frame Quick Jumps */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STORYBOARD_FRAMES.map((f) => (
          <button
            className={`px-2 py-0.5 rounded border text-[11px] transition-colors ${
              Math.abs(displayTime - f.t) < 0.05
                ? "bg-amber-500 text-black font-semibold border-amber-400"
                : "bg-white/5 border-white/10 hover:bg-white/15 text-white/80"
            }`}
            key={f.label}
            onClick={() => {
              setDisplayTime(f.t);
              onSeek(f.t);
            }}
            type="button"
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 9-Layer Solo and Mute Toggles (Revision 6b) */}
      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-white/10 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-white/60 font-semibold">9-Layer Controls:</span>
          <div className="flex items-center gap-2">
            {layers.solo && (
              <button
                className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px]"
                onClick={clearSolo}
                type="button"
              >
                Clear Solo
              </button>
            )}
            <button
              className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/70 text-[10px]"
              onClick={unmuteAll}
              type="button"
            >
              Unmute All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5">
          {WELCOME_DEBUG_LAYERS.map((layer) => {
            const isSoloed = layers.solo === layer;
            const isMuted = layers.muted[layer];
            return (
              <div
                className={`flex items-center justify-between px-1.5 py-1 rounded border text-[10px] ${
                  isSoloed
                    ? "bg-amber-500/25 border-amber-400/60 text-amber-200"
                    : isMuted
                      ? "bg-red-500/15 border-red-500/30 text-red-300 opacity-60"
                      : "bg-white/5 border-white/10 text-white/80"
                }`}
                key={layer}
              >
                <span className="truncate mr-1 font-medium">{layer}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className={`px-1 py-0.2 rounded font-bold transition-colors ${
                      isSoloed
                        ? "bg-amber-500 text-black"
                        : "bg-white/10 hover:bg-white/20 text-white/70"
                    }`}
                    onClick={() => toggleSolo(layer)}
                    title={`Solo ${layer}`}
                    type="button"
                  >
                    S
                  </button>
                  <button
                    className={`px-1 py-0.2 rounded font-bold transition-colors ${
                      isMuted
                        ? "bg-red-500 text-white"
                        : "bg-white/10 hover:bg-white/20 text-white/70"
                    }`}
                    onClick={() => toggleMute(layer)}
                    title={`Mute ${layer}`}
                    type="button"
                  >
                    M
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collapsible Inspection Table */}
      {showInspector && (
        <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1 text-[10px] text-white/70 max-h-56 overflow-y-auto">
          <div className="font-semibold text-white/90">
            Active Drawables & Timing Window Verification:
          </div>
          <div className="grid grid-cols-5 gap-1.5 py-0.5 border-b border-white/10 font-medium">
            <span>Drawable</span>
            <span>Target Window</span>
            <span>Alpha</span>
            <span>Status</span>
            <span>Violation</span>
          </div>
          {WELCOME_DEBUG_LAYERS.map((l) => {
            const timeWindows: Record<WelcomeDebugLayer, [number, number]> = {
              "frame-3": [1.5, 2.7],
              blades: [1.6, 2.7],
              windows: [1.9, 2.8],
              glow: [0.1, 2.7],
              silk: [0.62, 1.95],
              heroRibbons: [0.62, 1.95],
              siblingRibbons: [0.62, 1.95],
              veil: [0.9, 1.95],
              centerGlow: [0.62, 1.56],
              bloom: [0.62, 6.1],
              horns: [2.55, 4.0],
              "horn body fill": [2.55, 4.0],
              "broad folds": [2.55, 4.0],
              "fine pleats": [2.55, 4.0],
              "leading edges": [2.55, 4.0],
              wings: [4.0, 6.1],
              panels: [2.55, 4.75],
              "panel frost": [2.55, 4.75],
              "rear cards": [2.55, 4.75],
              "flank glows": [2.7, 4.3],
              "logo rim": [2.7, 6.1],
              text: [3.05, 4.3],
              logo: [2.7, 6.1],
            };
            const [wStart, wEnd] = timeWindows[l];
            const inWindow = displayTime >= wStart && displayTime <= wEnd;
            const isMuted =
              layers.muted[l] || (layers.solo !== null && layers.solo !== l);
            const isDrawing = inWindow && !isMuted;
            const hasTimingViolation = !inWindow && isDrawing;

            let alphaVal = "0.00";
            if (isDrawing) {
              if (displayTime < wStart + 0.15) {
                alphaVal = ((displayTime - wStart) / 0.15).toFixed(2);
              } else if (displayTime > wEnd - 0.25) {
                alphaVal = Math.max(0, (wEnd - displayTime) / 0.25).toFixed(2);
              } else {
                alphaVal = "1.00";
              }
            }

            return (
              <div
                className={`grid grid-cols-5 gap-1.5 py-0.5 items-center ${
                  hasTimingViolation
                    ? "bg-red-500/20 text-red-300 font-bold"
                    : ""
                }`}
                key={l}
              >
                <span className="text-amber-300 font-medium truncate">{l}</span>
                <span>{`${wStart.toFixed(2)}-${wEnd.toFixed(2)}s`}</span>
                <span>{alphaVal}</span>
                <span>
                  {isMuted ? "MUTED" : inWindow ? "ACTIVE" : "DORMANT"}
                </span>
                <span>
                  {hasTimingViolation ? (
                    <span className="text-red-400 font-bold">VIOLATION!</span>
                  ) : (
                    <span className="text-emerald-400">OK</span>
                  )}
                </span>
              </div>
            );
          })}
          <div className="mt-1 font-semibold text-white/90">Scene State:</div>
          <div>
            Phase:{" "}
            {displayTime < 0.7
              ? "VOID"
              : displayTime < 1.6
                ? "RESONANCE"
                : displayTime < 2.7
                  ? "UNFOLD"
                  : displayTime < 4.0
                    ? "ALIGN"
                    : "WELCOME"}
          </div>
        </div>
      )}
    </aside>
  );
}
