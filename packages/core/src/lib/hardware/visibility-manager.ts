/**
 * Page Visibility & Window Focus Coordinator for Marshell.
 *
 * Unifies HTML5 Page Visibility API with desktop window focus (Tauri 2)
 * to freeze decorative animations, pause canvas frame loops, and throttle
 * non-critical background stores whenever the application is obscured or minimized.
 */

export interface VisibilityStatus {
  isFocused: boolean;
  isVisible: boolean;
  visibilityState: DocumentVisibilityState;
}

type VisibilitySubscriber = (status: VisibilityStatus) => void;

export class PageVisibilityCoordinator {
  private static instance: PageVisibilityCoordinator | null = null;
  private readonly subscribers = new Set<VisibilitySubscriber>();
  private status: VisibilityStatus = {
    isVisible: true,
    visibilityState: "visible",
    isFocused: true,
  };
  private isInitialized = false;
  private unlistenTauriFocus: (() => void) | null = null;

  private constructor() {
    // Lazy initialization
  }

  static getInstance(): PageVisibilityCoordinator {
    if (!PageVisibilityCoordinator.instance) {
      PageVisibilityCoordinator.instance = new PageVisibilityCoordinator();
    }
    return PageVisibilityCoordinator.instance;
  }

  getStatus(): VisibilityStatus {
    if (!this.isInitialized) {
      this.init();
    }
    return this.status;
  }

  isVisible(): boolean {
    return this.status.isVisible;
  }

  subscribe(fn: VisibilitySubscriber): () => void {
    this.subscribers.add(fn);

    if (!this.isInitialized) {
      this.init();
    }

    return () => {
      this.subscribers.delete(fn);
    };
  }

  private init(): void {
    if (this.isInitialized || typeof window === "undefined") {
      return;
    }
    this.isInitialized = true;

    // 1. HTML5 Page Visibility API
    document.addEventListener("visibilitychange", this.handleVisibilityChange, {
      passive: true,
    });

    // 2. Window Focus & Blur
    window.addEventListener("focus", this.handleWindowFocus, { passive: true });
    window.addEventListener("blur", this.handleWindowBlur, { passive: true });

    // 3. Desktop Native (Tauri 2) window focus synchronization
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      import("@tauri-apps/api/window")
        .then(({ getCurrentWindow }) => {
          getCurrentWindow()
            .onFocusChanged(({ payload: focused }) => {
              this.updateStatus({ isFocused: focused });
            })
            .then((unlisten) => {
              this.unlistenTauriFocus = unlisten;
            })
            .catch(() => {
              // Gracefully continue with browser focus if Tauri window hook fails
            });
        })
        .catch(() => {
          // Non-Tauri environment or dynamic import fallback
        });
    }

    // Initial sync without firing subscribers
    const isVisible = document.visibilityState === "visible";
    this.status = {
      visibilityState: document.visibilityState,
      isFocused:
        typeof document.hasFocus === "function" ? document.hasFocus() : true,
      isVisible,
    };
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute(
        "data-visibility",
        isVisible ? "visible" : "hidden"
      );
    }
  }

  private readonly handleVisibilityChange = (): void => {
    this.updateStatus({
      visibilityState: document.visibilityState,
    });
  };

  private readonly handleWindowFocus = (): void => {
    this.updateStatus({ isFocused: true });
  };

  private readonly handleWindowBlur = (): void => {
    this.updateStatus({ isFocused: false });
  };

  private updateStatus(partial: Partial<VisibilityStatus>): void {
    const nextState = partial.visibilityState ?? this.status.visibilityState;
    const nextFocused = partial.isFocused ?? this.status.isFocused;
    const isVisible = nextState === "visible";

    if (
      this.status.visibilityState === nextState &&
      this.status.isFocused === nextFocused &&
      this.status.isVisible === isVisible
    ) {
      return;
    }

    this.status = {
      visibilityState: nextState,
      isFocused: nextFocused,
      isVisible,
    };

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute(
        "data-visibility",
        isVisible ? "visible" : "hidden"
      );
    }

    if (
      nextFocused &&
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    ) {
      import("@tauri-apps/api/core")
        .then(({ invoke }) => invoke("set_taskbar_badge", { show: false }))
        .catch(() => {});
    }

    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    for (const fn of this.subscribers) {
      try {
        fn(this.status);
      } catch (err) {
        console.error("Error in visibility subscriber:", err);
      }
    }
  }

  destroy(): void {
    if (typeof window !== "undefined") {
      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange
      );
      window.removeEventListener("focus", this.handleWindowFocus);
      window.removeEventListener("blur", this.handleWindowBlur);
    }
    if (this.unlistenTauriFocus) {
      this.unlistenTauriFocus();
      this.unlistenTauriFocus = null;
    }
    this.subscribers.clear();
    this.isInitialized = false;
  }
}

export const visibilityCoordinator = PageVisibilityCoordinator.getInstance();
