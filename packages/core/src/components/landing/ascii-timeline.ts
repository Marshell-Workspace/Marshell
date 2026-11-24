export const SCENE_SECONDS = 10;
export const TRANSITION_SECONDS = 3.2;
export const INTRO_SECONDS = 3.2;
export const GROWTH_TIMING = {
  entryStart: 0.4,
  entryEnd: 2.8,
  start: 3,
  end: 6,
  revealSeconds: 0.35,
} as const;
export const SCENE_NAMES = [
  "people",
  "marshell",
  "coder",
  "growth",
  "helicopter",
] as const;

export function smoothProgress(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

/** Both pictures remain live while the wave passes; incoming motion continues at the boundary. */
export function sceneFrameTimes(
  localTime: number,
  phase: (typeof SCENE_NAMES)[number]
) {
  const elapsed = Math.max(0, localTime - SCENE_SECONDS + TRANSITION_SECONDS);
  return {
    source: localTime + TRANSITION_SECONDS,
    target: elapsed,
    // The avatar entering the laptop is an action inside the workstation scene.
    progress: phase === "coder" ? 0 : Math.min(1, elapsed / TRANSITION_SECONDS),
  };
}

export function growthState(time: number) {
  const entry = smoothProgress(
    (time - GROWTH_TIMING.entryStart) /
      (GROWTH_TIMING.entryEnd - GROWTH_TIMING.entryStart)
  );
  const progress = smoothProgress(
    (time - GROWTH_TIMING.start) / (GROWTH_TIMING.end - GROWTH_TIMING.start)
  );
  // Keep decimal timing boundaries from rounding an exact halfway value down.
  const percent = Math.round((progress + Number.EPSILON) * 99);
  return { entry, progress, percent, fraction: percent / 100 };
}

/** Shared camera/pose time across the coder → growth boundary. */
export function workstationTime(
  scene: "coder" | "growth",
  contentTime: number
) {
  return scene === "growth" ? SCENE_SECONDS + contentTime : contentTime;
}
