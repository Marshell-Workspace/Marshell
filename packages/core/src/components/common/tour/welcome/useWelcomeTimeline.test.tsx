// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWelcomeTimeline } from "./useWelcomeTimeline";
import { WELCOME_CONFIG } from "./welcome.config";

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
let timeline: ReturnType<typeof useWelcomeTimeline>;
let hidden = false;

function Harness({ reducedMotion = false }: { reducedMotion?: boolean }) {
  timeline = useWelcomeTimeline({ reducedMotion, timeScale: 1 });
  return null;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16)
    )
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn(window.clearTimeout));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Harness />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("stops scheduling frames when the intro reaches its final state", async () => {
  await act(async () => vi.advanceTimersByTimeAsync(8000));
  expect(timeline.timeRef.current).toBe(WELCOME_CONFIG.welcome.totalDuration);
  expect(timeline.isReady).toBe(true);
  expect(timeline.isPlaying).toBe(false);
  const frameCount = vi.mocked(requestAnimationFrame).mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(requestAnimationFrame).toHaveBeenCalledTimes(frameCount);
});

it("stops while hidden and resumes without advancing the hidden interval", async () => {
  await act(async () => vi.advanceTimersByTimeAsync(500));
  hidden = true;
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  const time = timeline.timeRef.current;
  const frameCount = vi.mocked(requestAnimationFrame).mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(timeline.timeRef.current).toBe(time);
  expect(requestAnimationFrame).toHaveBeenCalledTimes(frameCount);
  hidden = false;
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(timeline.timeRef.current).toBeGreaterThan(time);
  expect(timeline.timeRef.current).toBeLessThan(time + 0.15);
});

it("cancels paused frames and skips to the end when reduced motion is enabled", async () => {
  await act(async () => vi.advanceTimersByTimeAsync(500));
  await act(async () => timeline.pause());
  const frameCount = vi.mocked(requestAnimationFrame).mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(500));
  expect(requestAnimationFrame).toHaveBeenCalledTimes(frameCount);
  await act(async () => timeline.play());
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(vi.mocked(requestAnimationFrame).mock.calls.length).toBeGreaterThan(
    frameCount
  );
  await act(async () => root.render(<Harness reducedMotion />));
  expect(timeline.isReady).toBe(true);
  expect(timeline.isPlaying).toBe(false);
  expect(timeline.timeRef.current).toBe(WELCOME_CONFIG.welcome.totalDuration);
});
