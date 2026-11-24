import { usePerformanceStore } from "@workspace/core/stores/performance-store";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startResourcePolling } from "./resource-polling";

let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  usePerformanceStore.setState({
    tier: "balanced",
    visibility: {
      isVisible: true,
      isFocused: true,
      visibilityState: "visible",
    },
  });
});
afterEach(() => {
  stop?.();
  vi.useRealTimers();
});

it("adjusts background frequency when switching modes and removes timers on cleanup", async () => {
  const refresh = vi.fn();
  stop = startResourcePolling(refresh, 1000);
  await vi.advanceTimersByTimeAsync(1000);
  expect(refresh).toHaveBeenCalledTimes(2);
  usePerformanceStore.setState({ tier: "eco" });
  await vi.advanceTimersByTimeAsync(1999);
  expect(refresh).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(refresh).toHaveBeenCalledTimes(3);
  usePerformanceStore.setState({ tier: "performance" });
  await vi.advanceTimersByTimeAsync(500);
  expect(refresh).toHaveBeenCalledTimes(4);
  stop();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(refresh).toHaveBeenCalledTimes(4);
});

it("pauses optional work while hidden and refreshes immediately on return", async () => {
  const refresh = vi.fn();
  stop = startResourcePolling(refresh, 1000, { pauseWhenHidden: true });
  await vi.advanceTimersByTimeAsync(0);
  usePerformanceStore.getState().onVisibilityChange({
    isVisible: false,
    isFocused: false,
    visibilityState: "hidden",
  });
  await vi.advanceTimersByTimeAsync(10_000);
  expect(refresh).toHaveBeenCalledTimes(1);
  usePerformanceStore.getState().onVisibilityChange({
    isVisible: true,
    isFocused: true,
    visibilityState: "visible",
  });
  expect(refresh).toHaveBeenCalledTimes(2);
});

it("keeps essential checks running while hidden without overlapping slow requests", async () => {
  let finish: (() => void) | undefined;
  const refresh = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  stop = startResourcePolling(refresh, 1000);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(refresh).toHaveBeenCalledTimes(1);
  finish?.();
  await vi.advanceTimersByTimeAsync(0);
  usePerformanceStore.getState().onVisibilityChange({
    isVisible: false,
    isFocused: false,
    visibilityState: "hidden",
  });
  await vi.advanceTimersByTimeAsync(5000);
  expect(refresh).toHaveBeenCalledTimes(2);
  stop();
  finish?.();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(refresh).toHaveBeenCalledTimes(2);
});
