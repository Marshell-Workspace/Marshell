"use client";

import { formatHotkeyDisplay } from "@workspace/core/lib/utils";
import { useCommandPaletteStore } from "@workspace/core/stores/command-palette-store";
import { useTutorialStore } from "@workspace/core/stores/tutorial-store";
import { Button } from "@workspace/ui/components/button";
import { recordGenieTrigger } from "@workspace/ui/lib/genie-motion";
import { Plus } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface NoWorkspacesHeroProps {
  greeting: string;
  name: string;
  onCreateWorkspace?: () => void;
}

/** What a workspace gives you. Each line is a real, shipped capability. */
const getTips = (paletteKey: string): string[] => [
  "Run several project terminals side by side in a shared grid.",
  "Preview your dev server across responsive desktop and mobile viewports.",
  `Press ${paletteKey} for the command palette and jump anywhere.`,
  "Every workspace keeps its own terminals, tasks, and layout.",
  "Inspect git diffs and track tasks on your workspace board.",
];

const TIP_INTERVAL_MS = 5200;
const CELEBRATE_MS = 1500;
const TILT_DEG = 7;
const SHIFT_PX = 12;

/** Slow embers drifting up behind the flame. Positions are fixed so SSR and
 * client agree; only transform/opacity animate. */
const EMBERS = [
  { x: -150, size: 3, delay: 0, duration: 7.2 },
  { x: -96, size: 2, delay: 1.6, duration: 8.4 },
  { x: -52, size: 4, delay: 3.1, duration: 6.6 },
  { x: -14, size: 2, delay: 0.7, duration: 9 },
  { x: 28, size: 3, delay: 2.4, duration: 7.8 },
  { x: 70, size: 2, delay: 4.2, duration: 8.8 },
  { x: 112, size: 4, delay: 1.1, duration: 6.9 },
  { x: 154, size: 2, delay: 3.6, duration: 8.1 },
] as const;

const WORD_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

function Embers() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-1/2 h-72 -translate-y-1/2 overflow-hidden"
    >
      {EMBERS.map((e) => (
        <motion.span
          animate={{ y: -230, opacity: [0, 0.7, 0], scale: [1, 0.6] }}
          className="absolute bottom-0 left-1/2 rounded-full bg-primary"
          initial={{ y: 0, opacity: 0 }}
          key={e.x}
          style={{ x: e.x, width: e.size, height: e.size }}
          transition={{
            duration: e.duration,
            delay: e.delay,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

function RotatingTip() {
  const [index, setIndex] = useState(0);
  const tips = getTips(formatHotkeyDisplay("mod+k").join("+"));

  useEffect(() => {
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % 5),
      TIP_INTERVAL_MS
    );
    return () => window.clearInterval(id);
  }, []);

  const text = tips[index] ?? "";

  return (
    <div
      aria-live="polite"
      className="mx-auto flex h-16 w-full max-w-xl flex-col items-center justify-start gap-2"
    >
      <AnimatePresence mode="wait">
        <motion.p
          animate={{ opacity: 1, y: 0 }}
          className="text-balance text-center text-muted-foreground text-sm leading-snug"
          exit={{ opacity: 0, y: -6 }}
          initial={{ opacity: 0, y: 6 }}
          key={index}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {text}
        </motion.p>
      </AnimatePresence>
      <div aria-hidden="true" className="flex items-center gap-1.5">
        {tips.map((t, i) => (
          <span
            className={
              i === index
                ? "h-1 w-4 rounded-full bg-primary transition-[width,background-color]"
                : "h-1 w-1 rounded-full bg-border transition-[width,background-color]"
            }
            key={t}
          />
        ))}
      </div>
    </div>
  );
}

export function NoWorkspacesHero({
  greeting,
  name,
  onCreateWorkspace,
}: NoWorkspacesHeroProps) {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const celebrateTimer = useRef<number | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  // Pointer position within the stage, normalised to -1..1.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 120, damping: 18, mass: 0.6 });
  const shiftX = useTransform(sx, (v) => v * SHIFT_PX);
  const shiftY = useTransform(sy, (v) => v * SHIFT_PX);
  const rotateY = useTransform(sx, (v) => v * TILT_DEG);
  const rotateX = useTransform(sy, (v) => v * -TILT_DEG);
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reduced) {
        return;
      }
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) {
        return;
      }
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      px.set(Math.max(-1, Math.min(1, nx)));
      py.set(Math.max(-1, Math.min(1, ny)));
    },
    [px, py, reduced]
  );

  const onPointerLeave = useCallback(() => {
    px.set(0);
    py.set(0);
  }, [px, py]);

  useEffect(
    () => () => {
      if (celebrateTimer.current) {
        window.clearTimeout(celebrateTimer.current);
      }
    },
    []
  );

  const celebrate = () => {
    setCelebrating(true);
    if (celebrateTimer.current) {
      window.clearTimeout(celebrateTimer.current);
    }
    celebrateTimer.current = window.setTimeout(
      () => setCelebrating(false),
      CELEBRATE_MS
    );
  };

  const words = `${greeting}${name ? `, ${name}` : ""}`.split(" ");
  const createKey = formatHotkeyDisplay("mod+n").join("+");
  return (
    <div
      className="relative flex h-full w-full flex-1 flex-col items-center justify-center overflow-hidden bg-background p-6"
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      ref={stageRef}
    >
      <div className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
        <div className="relative mb-6 flex items-center justify-center">
          {!reduced && <Embers />}
          <motion.button
            aria-label="Marshell"
            className="relative cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            onClick={celebrate}
            style={
              reduced
                ? undefined
                : {
                    x: shiftX,
                    y: shiftY,
                    rotateX,
                    rotateY,
                    transformPerspective: 700,
                  }
            }
            type="button"
            whileTap={reduced ? undefined : { scale: 0.94 }}
          >
            <motion.span
              animate={
                celebrating && !reduced
                  ? { y: [0, -14, 0], scale: [1, 1.08, 1] }
                  : { y: 0, scale: 1 }
              }
              className="block"
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <img
                alt="Marshell"
                className="size-24 object-contain drop-shadow-md marshell-logo-dark"
                src="/main_logo_256.webp"
              />
              <img
                alt="Marshell"
                className="size-24 object-contain drop-shadow-md marshell-logo-light"
                src="/main_logo_light_256.webp"
              />
            </motion.span>
          </motion.button>
        </div>

        <motion.h1
          animate="visible"
          aria-label={words.join(" ")}
          className="mb-2 flex flex-wrap justify-center gap-x-[0.28em] font-display font-semibold text-2xl text-foreground tracking-tight leading-tight sm:text-3xl"
          initial="hidden"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: reduced ? 0 : 0.07,
                delayChildren: 0.1,
              },
            },
          }}
        >
          {words.map((w, i) => (
            <motion.span
              aria-hidden="true"
              className="inline-block"
              key={`${w}-${i}`}
              variants={reduced ? undefined : WORD_VARIANTS}
            >
              {w}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          animate={{ opacity: 1, y: 0 }}
          className="mb-7 max-w-xs text-muted-foreground text-sm leading-relaxed sm:max-w-sm sm:text-base"
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          transition={{ duration: 0.5, delay: reduced ? 0 : 0.45 }}
        >
          Create a workspace to organize your terminals, preview, and tasks.
        </motion.p>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          transition={{ duration: 0.5, delay: reduced ? 0 : 0.6 }}
        >
          <Button
            className="group inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-primary px-5 font-medium font-sans text-primary-foreground text-sm shadow-sm transition-[background-color,transform] hover:bg-primary/85 active:scale-[0.98]"
            data-tour="create-workspace-empty-cta"
            data-workspace-trigger="new-workspace-empty"
            onClick={(e) => {
              recordGenieTrigger(e.currentTarget);
              useTutorialStore.getState().setCreateWorkspaceDialogOpen(true);
              onCreateWorkspace?.();
            }}
          >
            <Plus className="mr-2 size-4 shrink-0 transition-transform group-hover:rotate-90" />
            <span>Create Workspace</span>
            <kbd className="ml-3 hidden rounded bg-primary-foreground/15 px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground sm:inline-block">
              {createKey}
            </kbd>
          </Button>
          <button
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            onClick={() => useCommandPaletteStore.getState().open()}
            type="button"
          >
            Or search everything
          </button>
        </motion.div>

        <motion.div
          animate={{ opacity: 1 }}
          className="w-full"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.6, delay: reduced ? 0 : 0.9 }}
        >
          <RotatingTip />
        </motion.div>
      </div>
    </div>
  );
}
