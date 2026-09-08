/**
 * Global Terminal Layout & Resize Coordinator.
 * Coordinates smooth, synchronized terminal fitting during layout animations
 * (Sidebar, Main Agent, Fullscreen, Window Resize) to eliminate flicker, layout thrashing,
 * and PTY SIGWINCH storms.
 */

type FitCallback = () => void;

class TerminalLayoutManager {
  private readonly fitCallbacks = new Map<string, FitCallback>();
  private isLayoutTransitioning = false;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private rafId: number | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("layout-animation-start", this.onLayoutStart);
      window.addEventListener("layout-animation-end", this.onLayoutEnd);
      window.addEventListener("transitionend", this.onLayoutEnd);
      window.addEventListener("resize", this.onWindowResize);
    }
  }

  register(id: string, fitFn: FitCallback): () => void {
    this.fitCallbacks.set(id, fitFn);
    return () => {
      this.fitCallbacks.delete(id);
    };
  }

  startTransition(durationMs = 320): void {
    this.isLayoutTransitioning = true;
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
    }

    // Suppress intermediate xterm refits during sliding panel animations.
    // Refit exactly once when the panel animation completes.
    this.transitionTimer = setTimeout(() => {
      this.finishTransition();
    }, durationMs + 20);
  }

  finishTransition(): void {
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    this.isLayoutTransitioning = false;
    this.scheduleBatchFit();

    // Additional safety pass after DOM reflow settles completely
    setTimeout(() => {
      this.executeBatchFit();
    }, 60);
  }

  isTransitioning(): boolean {
    return this.isLayoutTransitioning;
  }

  notifyContainerResize(): void {
    if (this.isLayoutTransitioning) {
      return; // Do not refit xterm mid-animation to prevent text-wrap corruption
    }
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
    }
    this.resizeDebounceTimer = setTimeout(() => {
      this.scheduleBatchFit();
    }, 60);
  }

  scheduleBatchFit(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.executeBatchFit();
    });
  }

  private executeBatchFit(): void {
    for (const fitFn of this.fitCallbacks.values()) {
      try {
        fitFn();
      } catch {
        // Guard against unmounted terminals
      }
    }
  }

  private readonly onLayoutStart = (): void => {
    this.startTransition(320);
  };

  private readonly onLayoutEnd = (): void => {
    this.finishTransition();
  };

  private readonly onWindowResize = (): void => {
    this.notifyContainerResize();
  };
}

export const terminalLayoutManager = new TerminalLayoutManager();
