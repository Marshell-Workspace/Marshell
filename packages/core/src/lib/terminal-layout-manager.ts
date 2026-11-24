/**
 * Global Terminal Layout & Resize Coordinator.
 * Coordinates smooth, frame-synchronized, coalesced terminal fitting during:
 * - Application Fullscreen (F11 / native Tauri / browser) enter & exit
 * - Single Pane Terminal Fullscreen / Maximize toggles
 * - Continuous Window Resizing & OS maximizing / restoring
 * - Draggable Pane / Splitter interactions
 * - Sidebar & AI Agent sliding transitions
 * - Dynamic 1–8 pane grid adjustments
 *
 * Architecture:
 * 1. Geometry change event arrives (ResizeObserver, window resize, fullscreen toggle).
 * 2. Intermediate frame geometry is monitored across requestAnimationFrame.
 * 3. Stable dimension detection waits until container dimensions stop changing for consecutive frames.
 * 4. Authoritative final synchronization fits xterm, reads exact final cols/rows,
 *    and delivers asynchronous, serialized PTY resize to ConPTY.
 *
 * Eliminates visual jitter, layout thrashing, excessive canvas redraws,
 * stale line wrapping, prompt clipping, and ConPTY SIGWINCH storms.
 */

export interface TerminalResizeHandler {
  getContainer: () => HTMLElement | null;
  getFitAddon?: () => unknown;
  getTerminal?: () => unknown;
  isActive: () => boolean;
  isDisposed: () => boolean;
  syncSize: (force?: boolean) => boolean;
  syncVisualOnly?: () => void;
}

export type FitCallback = (force?: boolean) => void;

interface TerminalLayoutState {
  isMonitoring: boolean;
  lastHeight: number;
  lastWidth: number;
  rafId: number | null;
  stableFrames: number;
}

function safeRequestAnimationFrame(callback: () => void): number {
  if (typeof requestAnimationFrame !== "undefined") {
    return requestAnimationFrame(callback);
  }
  return setTimeout(callback, 16) as unknown as number;
}

function safeCancelAnimationFrame(id: number | null): void {
  if (id === null) {
    return;
  }
  if (typeof cancelAnimationFrame === "undefined") {
    clearTimeout(id);
  } else {
    cancelAnimationFrame(id);
  }
}

class TerminalLayoutManager {
  private readonly handlers = new Map<string, TerminalResizeHandler>();
  private readonly layoutStates = new Map<string, TerminalLayoutState>();
  private readonly forcedFitRequests = new Set<string>();
  private isLayoutTransitioning = false;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private unlistenWindowResize: (() => void) | null = null;

  constructor() {
    this.init();
  }

  init(): void {
    if (typeof window !== "undefined") {
      window.addEventListener("layout-animation-start", this.onLayoutStart);
      window.addEventListener("layout-animation-end", this.onLayoutEnd);
      window.addEventListener("transitionend", this.onLayoutEnd);
      window.addEventListener("resize", this.onWindowResize);
      window.addEventListener("focus", this.onWindowFocus);
      window.addEventListener("restore", this.onWindowRestoreOrMaximize);
      window.addEventListener("maximize", this.onWindowRestoreOrMaximize);
      window.addEventListener("unmaximize", this.onWindowRestoreOrMaximize);
      document.addEventListener("fullscreenchange", this.onFullscreenChange);
      document.addEventListener("visibilitychange", this.onVisibilityChange);

      // Attach native Tauri window resize listener if in Tauri environment
      import("@tauri-apps/api/core")
        .then(({ isTauri }) => {
          if (isTauri()) {
            import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
              getCurrentWindow()
                .onResized(() => {
                  this.notifyFullscreenTransition();
                })
                .then((unlisten) => {
                  this.unlistenWindowResize = unlisten;
                })
                .catch(() => {});
            });
          }
        })
        .catch(() => {});
    }
  }

  /**
   * Destroys all global listeners attached to window/Tauri/document (used for clean HMR).
   */
  destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("layout-animation-start", this.onLayoutStart);
      window.removeEventListener("layout-animation-end", this.onLayoutEnd);
      window.removeEventListener("transitionend", this.onLayoutEnd);
      window.removeEventListener("resize", this.onWindowResize);
      window.removeEventListener("focus", this.onWindowFocus);
      window.removeEventListener("restore", this.onWindowRestoreOrMaximize);
      window.removeEventListener("maximize", this.onWindowRestoreOrMaximize);
      window.removeEventListener("unmaximize", this.onWindowRestoreOrMaximize);
      document.removeEventListener("fullscreenchange", this.onFullscreenChange);
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    }
    if (this.unlistenWindowResize) {
      this.unlistenWindowResize();
      this.unlistenWindowResize = null;
    }
    if (this.transitionTimer !== null) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    for (const state of this.layoutStates.values()) {
      safeCancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    this.handlers.clear();
    this.layoutStates.clear();
    this.forcedFitRequests.clear();
  }

  /**
   * Registers a terminal instance resize handler or legacy callback.
   */
  register(
    id: string,
    handlerOrFn: TerminalResizeHandler | FitCallback
  ): () => void {
    let handler: TerminalResizeHandler;
    if (typeof handlerOrFn === "function") {
      handler = {
        getContainer: () => null,
        isDisposed: () => false,
        isActive: () => true,
        syncSize: (force) => {
          handlerOrFn(force);
          return true;
        },
      };
    } else {
      handler = handlerOrFn;
    }

    this.handlers.set(id, handler);
    return () => {
      this.unregister(id);
    };
  }

  /**
   * Unregisters a terminal instance and cancels any pending scheduled fits or RAFs.
   */
  unregister(id: string): void {
    this.handlers.delete(id);
    this.forcedFitRequests.delete(id);
    const state = this.layoutStates.get(id);
    if (state) {
      safeCancelAnimationFrame(state.rafId);
      this.layoutStates.delete(id);
    }
  }

  /**
   * Performs an immediate authoritative synchronization for a specific terminal.
   * Returns true if size synchronization succeeded.
   */
  syncTerminalSize(id: string, force = false): boolean {
    const handler = this.handlers.get(id);
    if (!handler || handler.isDisposed()) {
      return false;
    }
    return handler.syncSize(force);
  }

  /**
   * Authoritatively synchronizes all active registered terminals.
   */
  syncAllTerminals(force = false): void {
    for (const [_, handler] of this.handlers) {
      if (!handler.isDisposed() && handler.isActive()) {
        try {
          handler.syncSize(force);
        } catch {
          // Guard against any unmounted terminal errors
        }
      }
    }
  }

  /**
   * Schedules a frame-synchronized, stable-geometry fit operation for a terminal.
   * Coalesces intermediate geometry changes until dimensions stabilize, then
   * executes the authoritative final synchronization.
   */
  scheduleFit(id: string, force = false): void {
    const handler = this.handlers.get(id);
    if (!handler || handler.isDisposed()) {
      return;
    }

    if (this.isLayoutTransitioning) {
      if (force) {
        this.forcedFitRequests.add(id);
      }
      return;
    }

    if (force) {
      this.forcedFitRequests.add(id);
    }

    let state = this.layoutStates.get(id);
    if (!state) {
      state = {
        lastWidth: 0,
        lastHeight: 0,
        stableFrames: 0,
        rafId: null,
        isMonitoring: false,
      };
      this.layoutStates.set(id, state);
    }

    if (state.isMonitoring) {
      return;
    }

    state.isMonitoring = true;
    state.stableFrames = 0;

    const checkStability = () => {
      if (handler.isDisposed() || !handler.isActive()) {
        state.isMonitoring = false;
        state.rafId = null;
        return;
      }

      const container = handler.getContainer();
      if (!container) {
        // Fallback for legacy handlers without direct container access
        state.isMonitoring = false;
        state.rafId = null;
        const shouldForce = this.forcedFitRequests.has(id);
        this.forcedFitRequests.delete(id);
        handler.syncSize(shouldForce);
        return;
      }

      const currentW = Math.round(container.clientWidth);
      const currentH = Math.round(container.clientHeight);

      // Do NOT fit at zero or invalid dimensions (e.g. while hidden or unmounted)
      if (currentW <= 0 || currentH <= 0) {
        if (state.stableFrames < 10) {
          state.stableFrames++;
          state.rafId = safeRequestAnimationFrame(checkStability);
        } else {
          state.isMonitoring = false;
          state.rafId = null;
        }
        return;
      }

      // Check if dimensions changed since last frame
      const changed =
        Math.abs(currentW - state.lastWidth) >= 1 ||
        Math.abs(currentH - state.lastHeight) >= 1;

      if (changed) {
        state.lastWidth = currentW;
        state.lastHeight = currentH;
        state.stableFrames = 0;
        // Keep UI resizing smooth at 60fps visually
        handler.syncVisualOnly?.();
        // Continue monitoring next frame
        state.rafId = safeRequestAnimationFrame(checkStability);
        return;
      }

      // Dimensions are identical to previous frame
      state.stableFrames++;

      if (state.stableFrames < 2) {
        // Wait for 2 consecutive stable frames to ensure OS window manager has settled
        state.rafId = safeRequestAnimationFrame(checkStability);
        return;
      }

      // Authoritative stable geometry reached!
      state.isMonitoring = false;
      state.rafId = null;

      const shouldForce = this.forcedFitRequests.has(id);
      this.forcedFitRequests.delete(id);

      handler.syncSize(shouldForce);
    };

    state.rafId = safeRequestAnimationFrame(checkStability);
  }

  /**
   * Cancels any pending scheduled fit for a terminal.
   */
  cancelScheduledFit(id: string): void {
    this.forcedFitRequests.delete(id);
    const state = this.layoutStates.get(id);
    if (state) {
      safeCancelAnimationFrame(state.rafId);
      state.rafId = null;
      state.isMonitoring = false;
    }
  }

  /**
   * Schedules a frame-synchronized batch fit for all registered active terminals.
   */
  scheduleBatchFit(force = false): void {
    if (this.isLayoutTransitioning) {
      if (force) {
        for (const id of this.handlers.keys()) {
          this.forcedFitRequests.add(id);
        }
      }
      return;
    }

    for (const [id, handler] of this.handlers) {
      if (!handler.isDisposed() && handler.isActive()) {
        this.scheduleFit(id, force);
      }
    }
  }

  /**
   * Dedicated Fullscreen & Window Maximize / Restore Transition Coordinator.
   * Fullscreen transitions generate intermediate OS window geometry changes.
   * This method coordinates visual scaling during the transition and guarantees
   * authoritative final synchronization once the window geometry settles.
   */
  notifyFullscreenTransition(terminalId?: string): void {
    if (terminalId) {
      this.scheduleFit(terminalId, true);
    } else {
      this.scheduleBatchFit(true);
    }

    // Safety settlement check after OS window manager animations complete
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
    }
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      if (terminalId) {
        this.scheduleFit(terminalId, true);
      } else {
        this.scheduleBatchFit(true);
      }
    }, 280);
  }

  /**
   * Refits all visible registered terminals on the next animation frame.
   */
  refreshAllTerminalsLayout(_force = true): void {
    this.notifyFullscreenTransition();
  }

  /**
   * Refits a single terminal instance by ID.
   */
  refreshTerminalLayout(id: string, force = true): void {
    this.scheduleFit(id, force);
  }

  /**
   * Starts a layout transition (e.g. sidebar sliding, animated panels).
   * Suppresses intermediate fits during the sliding animation to avoid jitter.
   */
  startTransition(durationMs = 340): void {
    this.isLayoutTransitioning = true;
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
    }

    this.transitionTimer = setTimeout(() => {
      this.finishTransition();
    }, durationMs + 20);
  }

  /**
   * Finishes layout transition and performs a clean, authoritative fit.
   */
  finishTransition(): void {
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    this.isLayoutTransitioning = false;
    this.scheduleBatchFit(true);
  }

  isTransitioning(): boolean {
    return this.isLayoutTransitioning;
  }

  private readonly onLayoutStart = (): void => {
    this.startTransition(340);
  };

  private readonly onLayoutEnd = (event?: Event): void => {
    if (event && event.type === "transitionend") {
      const e = event as TransitionEvent;
      const target = e.target as HTMLElement | null;
      const slot = target?.getAttribute?.("data-slot");
      // Only finish when primary sidebar/agent transitions complete
      if (
        slot !== "sidebar-gap" &&
        slot !== "sidebar-container" &&
        slot !== "agent-sidebar"
      ) {
        return;
      }
      if (
        e.propertyName !== "width" &&
        e.propertyName !== "margin-left" &&
        e.propertyName !== "margin-right"
      ) {
        return;
      }
    }
    this.finishTransition();
  };

  private readonly onWindowResize = (): void => {
    this.scheduleBatchFit(false);
  };

  private readonly onWindowFocus = (): void => {
    this.scheduleBatchFit(true);
  };

  private readonly onWindowRestoreOrMaximize = (): void => {
    this.notifyFullscreenTransition();
  };

  private readonly onVisibilityChange = (): void => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
    ) {
      this.scheduleBatchFit(true);
    }
  };

  private readonly onFullscreenChange = (): void => {
    this.notifyFullscreenTransition();
  };
}

// Preserve single instance across development HMR reloads
declare global {
  interface Window {
    __marshellTerminalLayoutManager__?: TerminalLayoutManager;
  }
}

function getSingletonTerminalLayoutManager(): TerminalLayoutManager {
  if (typeof window !== "undefined") {
    if (window.__marshellTerminalLayoutManager__) {
      window.__marshellTerminalLayoutManager__.destroy();
    }
    const instance = new TerminalLayoutManager();
    window.__marshellTerminalLayoutManager__ = instance;
    return instance;
  }
  return new TerminalLayoutManager();
}

export const terminalLayoutManager = getSingletonTerminalLayoutManager();
