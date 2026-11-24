import { usePerformanceStore } from "@workspace/core/stores/performance-store";

/** Serial polling, with no overlap and immediate refresh when the app returns. */
export function startResourcePolling(
  refresh: () => void | Promise<void>,
  intervalMs: number,
  { pauseWhenHidden = false }: { pauseWhenHidden?: boolean } = {}
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let stopped = false;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = () => {
    clearTimer();
    const { tier, visibility } = usePerformanceStore.getState();
    if (stopped || running || (pauseWhenHidden && !visibility.isVisible)) {
      return;
    }
    const multiplier = { performance: 0.5, balanced: 1, eco: 2 }[tier];
    const delay = visibility.isVisible
      ? intervalMs * multiplier
      : Math.max(5000, intervalMs * multiplier * 4);
    timer = setTimeout(run, delay);
  };

  const run = async () => {
    clearTimer();
    if (stopped || running) {
      return;
    }
    if (
      pauseWhenHidden &&
      !usePerformanceStore.getState().visibility.isVisible
    ) {
      return;
    }
    running = true;
    try {
      await refresh();
    } catch {
      // A transient refresh failure must not stop subsequent polling.
    } finally {
      running = false;
      schedule();
    }
  };

  const unsubscribe = usePerformanceStore.subscribe((state, previous) => {
    const becameVisible =
      state.visibility.isVisible && !previous.visibility.isVisible;
    if (becameVisible) {
      run();
    } else if (
      state.tier !== previous.tier ||
      state.visibility.isVisible !== previous.visibility.isVisible
    ) {
      schedule();
    }
  });
  run();

  return () => {
    stopped = true;
    clearTimer();
    unsubscribe();
  };
}
