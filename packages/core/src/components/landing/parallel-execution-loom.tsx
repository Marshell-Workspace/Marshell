"use client";

import { useEffect, useRef } from "react";
import {
  ASCII_BACKGROUND,
  ASCII_FONT,
  ASCII_LAYOUT,
  fieldPalette,
} from "./ascii-field";
import { growthGlyph, growthMaskLayout } from "./ascii-growth";
import {
  ambientShiftX,
  ambientShiftY,
  ambientTone,
  helicopterInk,
  materialGrain,
} from "./ascii-texture";
import {
  GROWTH_TIMING,
  growthState,
  INTRO_SECONDS,
  SCENE_NAMES,
  SCENE_SECONDS,
  sceneFrameTimes,
  smoothProgress,
} from "./ascii-timeline";
import { waveIllumination, waveReveal } from "./ascii-wave";
import { SCENES, type SceneFn } from "./scenes";
import { WORKSTATION } from "./workstation-geometry";

const CELL_WIDTH = ASCII_LAYOUT.cellWidth;
const CELL_HEIGHT = ASCII_LAYOUT.cellHeight;
const GLYPHS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]<>/\\=+;:.*#-| ";
const BACKGROUND = ASCII_BACKGROUND;
const GLYPH_WIDTH = ASCII_LAYOUT.spriteWidth;
const GLYPH_HEIGHT = ASCII_LAYOUT.spriteHeight;

interface ParallelExecutionLoomProps {
  className?: string;
  mode?: "sign-in" | "sign-up" | "forgot-password";
}

// A stable distribution keeps the material from flashing or regenerating each frame.
function noise(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43_758.5453;
  return value - Math.floor(value);
}

export function ParallelExecutionLoom({
  className = "",
}: ParallelExecutionLoomProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!(canvas && parent && ctx)) {
      return;
    }
    const mask = document.createElement("canvas");
    const maskCtx = mask.getContext("2d", { willReadFrequently: true });
    if (!maskCtx) {
      return;
    }
    const atlas = document.createElement("canvas");
    const atlasCtx = atlas.getContext("2d");
    if (!atlasCtx) {
      return;
    }
    let atlasDpr = 1;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let scale = 1;
    let raf = 0;
    let time = 0;
    let previousTime: number | null = null;
    let inView = true;
    let disposed = false;
    let random = new Float32Array(0);
    let offsets = new Float32Array(0);
    let renderedCells = new Int32Array(0);

    const stamp = (
      target: CanvasRenderingContext2D,
      character: number,
      tone: number,
      x: number,
      y: number,
      shiftX: number,
      shiftY: number
    ) => {
      // Integer device-pixel cell bounds prevent neighboring glyphs from erasing each other.
      const left = Math.round((x - CELL_WIDTH / 2) * atlasDpr) / atlasDpr;
      const top = Math.round((y - CELL_HEIGHT / 2) * atlasDpr) / atlasDpr;
      const cellWidth =
        Math.round((x + CELL_WIDTH / 2) * atlasDpr) / atlasDpr - left;
      const cellHeight =
        Math.round((y + CELL_HEIGHT / 2) * atlasDpr) / atlasDpr - top;
      const opacity = target.globalAlpha;
      target.globalAlpha = 1;
      target.fillStyle = BACKGROUND;
      target.fillRect(left, top, cellWidth, cellHeight);
      target.globalAlpha = opacity;
      target.drawImage(
        atlas,
        (character * GLYPH_WIDTH + GLYPH_WIDTH / 2 + left - x - shiftX) *
          atlasDpr,
        (tone * GLYPH_HEIGHT + GLYPH_HEIGHT / 2 + top - y - shiftY) * atlasDpr,
        cellWidth * atlasDpr,
        cellHeight * atlasDpr,
        left,
        top,
        cellWidth,
        cellHeight
      );
    };

    const sample = (scene: SceneFn, seconds: number): Uint8ClampedArray => {
      maskCtx.setTransform(1, 0, 0, 1, 0, 0);
      maskCtx.fillStyle = "#000";
      maskCtx.fillRect(0, 0, cols, rows);
      maskCtx.setTransform(
        scale / CELL_WIDTH,
        0,
        0,
        scale / CELL_HEIGHT,
        cols / 2,
        rows / 2
      );
      scene(maskCtx, seconds, width / (2 * scale), height / (2 * scale));
      return maskCtx.getImageData(0, 0, cols, rows).data;
    };

    const paint = () => {
      if (!(width && height && cols && rows)) {
        return;
      }
      const still = reducedMotion.matches;
      const seconds = still ? 3 : time;
      const textureTime = still ? 0 : seconds;
      const sceneIndex = Math.floor(seconds / SCENE_SECONDS) % SCENES.length;
      const localTime = seconds % SCENE_SECONDS;
      const current = SCENES[sceneIndex];
      const phase = SCENE_NAMES[sceneIndex];
      if (!(current && phase)) {
        return;
      }
      const clocks = sceneFrameTimes(localTime, phase);
      const progress = clocks.progress;
      const next = SCENES[(sceneIndex + 1) % SCENES.length];
      const nextPhase = SCENE_NAMES[(sceneIndex + 1) % SCENE_NAMES.length];
      const currentData = sample(current, clocks.source);
      const nextData =
        progress > 0 && next ? sample(next, clocks.target) : null;
      canvas.dataset.scene = phase;
      canvas.dataset.material = "ascii";
      const percent = growthState(localTime).percent;
      if (SCENE_NAMES[sceneIndex] === "growth") {
        canvas.dataset.growth = String(percent);
      } else {
        delete canvas.dataset.growth;
      }
      ctx.globalAlpha = 1;
      const formation = still ? 1 : Math.min(1, time / INTRO_SECONDS);
      const fit = Math.min(
        width / (2 * scale) / 325,
        height / (2 * scale) / 310,
        1.18
      );
      const growthLayout =
        SCENE_NAMES[sceneIndex] === "growth" &&
        localTime > GROWTH_TIMING.entryEnd + GROWTH_TIMING.revealSeconds
          ? growthMaskLayout(
              {
                a: (scale / CELL_WIDTH) * fit,
                d: (scale / CELL_HEIGHT) * fit,
                e: cols / 2 - ((8 * scale) / CELL_WIDTH) * fit,
                f: rows / 2 - ((8 * scale) / CELL_HEIGHT) * fit,
              },
              WORKSTATION.progressLeft,
              WORKSTATION.progressRight,
              WORKSTATION.progressY
            )
          : null;
      for (let cell = 0; cell < cols * rows; cell++) {
        const seed = random[cell] ?? 0;
        const column = cell % cols;
        const row = Math.floor(cell / cols);
        const x = (column + 0.5) / cols;
        const y = (row + 0.5) / rows;
        const reveal = progress > 0 ? waveReveal(progress, x, y) : 0;
        const appear = formation < 1 ? waveReveal(formation, x, y) : 1;
        const light = Math.max(
          waveIllumination(reveal, seed),
          waveIllumination(appear, seed)
        );
        const mix = nextData ? reveal : 0;
        const channel = cell * 4;
        const red =
          (currentData[channel] ?? 0) * (1 - mix) +
          (nextData?.[channel] ?? 0) * mix;
        const green =
          (currentData[channel + 1] ?? 0) * (1 - mix) +
          (nextData?.[channel + 1] ?? 0) * mix;
        const blue =
          (currentData[channel + 2] ?? 0) * (1 - mix) +
          (nextData?.[channel + 2] ?? 0) * mix;
        const helicopterAmount =
          phase === "helicopter"
            ? 1 - mix
            : nextPhase === "helicopter"
              ? mix
              : 0;
        // Sky-accent flame pixels keep their full brightness so the colour reads clearly.
        const isAccent = blue - red > 100;
        const signal =
          helicopterInk(Math.max(red, green, blue) / 255, helicopterAmount) *
          appear *
          (isAccent
            ? 0.92 + seed * 0.08
            : materialGrain(seed, column, row, textureTime));
        let tone =
          Math.max(
            ambientTone(seed, column, row, textureTime),
            Math.min(31, Math.round(Math.max(signal * 1.2, light) * 31))
          ) + (isAccent && signal > 0.08 ? 32 : 0);
        const ambient = 1 - smoothProgress(signal / 0.18);
        let dx = still
          ? 0
          : Math.round(ambientShiftX(row, seconds) * ambient * 4);
        let dy = still
          ? 0
          : Math.round(ambientShiftY(column, seconds) * ambient * 4);
        const tick = still
          ? 0
          : Math.floor(seconds * (signal > 0.08 ? 2.2 : 0.7) + seed * 7);
        let character =
          (Math.floor((offsets[cell] ?? 0) * GLYPHS.length) + tick) %
          GLYPHS.length;
        let opacity = Math.round(
          Math.min(1, 0.76 + seed * 0.18 + signal * 0.06) *
            (1 -
              helicopterAmount *
                0.4 *
                (1 - smoothProgress(Math.max(signal, light) / 0.18))) *
            127
        );
        const instrumentGlyph =
          growthLayout && reveal < 0.2
            ? growthGlyph(growthLayout, percent, column, row)
            : undefined;
        if (instrumentGlyph !== undefined) {
          character = GLYPHS.indexOf(instrumentGlyph);
          dx = 0;
          dy = 0;
          opacity = 127;
          if (
            (instrumentGlyph >= "0" && instrumentGlyph <= "9") ||
            instrumentGlyph === "o" ||
            instrumentGlyph === "/"
          ) {
            tone = Math.max(24, tone);
          }
          if (
            instrumentGlyph === "+" ||
            instrumentGlyph === "-" ||
            instrumentGlyph === "|"
          ) {
            tone = Math.max(17, tone);
          }
        }
        const signature =
          character |
          (tone << 7) |
          (opacity << 13) |
          ((dx + 3) << 20) |
          ((dy + 1) << 23);
        if (renderedCells[cell] === signature) {
          continue;
        }
        renderedCells[cell] = signature;
        ctx.globalAlpha = opacity / 127;
        // One glyph per cell; ambient drift moves only its ink inside the clipped cell.
        stamp(
          ctx,
          character,
          tone,
          (column + 0.5) * CELL_WIDTH,
          (row + 0.5) * CELL_HEIGHT,
          dx / 4,
          dy / 4
        );
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      width = parent.clientWidth;
      height = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      atlasDpr = dpr;
      atlas.width = Math.ceil(GLYPHS.length * GLYPH_WIDTH * dpr);
      atlas.height = Math.ceil(64 * GLYPH_HEIGHT * dpr);
      atlasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      atlasCtx.font = ASCII_FONT;
      atlasCtx.textBaseline = "alphabetic";
      atlasCtx.textAlign = "center";
      const metrics = atlasCtx.measureText(GLYPHS);
      const baselineOffset =
        (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) /
        2;
      for (let tone = 0; tone < 64; tone++) {
        atlasCtx.fillStyle = fieldPalette(tone);
        for (let character = 0; character < GLYPHS.length; character++) {
          atlasCtx.fillText(
            GLYPHS[character] ?? ".",
            (character + 0.5) * GLYPH_WIDTH,
            (tone + 0.5) * GLYPH_HEIGHT + baselineOffset
          );
        }
      }
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = BACKGROUND;
      ctx.fillRect(0, 0, width, height);
      cols = Math.max(1, Math.ceil(width / CELL_WIDTH));
      rows = Math.max(1, Math.ceil(height / CELL_HEIGHT));
      mask.width = cols;
      mask.height = rows;
      scale = Math.min(width / 720, height / 760);
      random = Float32Array.from({ length: cols * rows }, (_, i) =>
        noise(i, 1)
      );
      offsets = Float32Array.from({ length: cols * rows }, (_, i) =>
        noise(i, 2)
      );
      renderedCells = new Int32Array(cols * rows).fill(-1);
      paint();
    };

    const frame = (now: number) => {
      raf = 0;
      if (disposed || document.hidden || !inView || reducedMotion.matches) {
        previousTime = null;
        return;
      }
      if (previousTime !== null) {
        time += Math.min((now - previousTime) / 1000, 0.1);
      }
      previousTime = now;
      paint();
      raf = requestAnimationFrame(frame);
    };
    const syncPlayback = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      previousTime = null;
      if (reducedMotion.matches) {
        paint();
      } else if (!(document.hidden || !inView || disposed)) {
        raf = requestAnimationFrame(frame);
      }
    };
    const observer = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      syncPlayback();
    });
    resize();
    observer.observe(parent);
    intersection.observe(canvas);
    document.fonts.addEventListener("loadingdone", resize);
    document.addEventListener("visibilitychange", syncPlayback);
    reducedMotion.addEventListener("change", syncPlayback);
    syncPlayback();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      intersection.disconnect();
      document.fonts.removeEventListener("loadingdone", resize);
      reducedMotion.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`relative size-full select-none overflow-hidden bg-black ${className}`}
    >
      <canvas
        className="pointer-events-none absolute inset-0 block size-full"
        ref={canvasRef}
      />
    </div>
  );
}

export { ParallelExecutionLoom as AsciiVideo };
