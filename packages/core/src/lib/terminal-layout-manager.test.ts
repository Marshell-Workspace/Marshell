// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type TerminalResizeHandler,
  terminalLayoutManager,
} from "./terminal-layout-manager";

describe("TerminalLayoutManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    terminalLayoutManager.init();
  });

  afterEach(() => {
    terminalLayoutManager.destroy();
    vi.restoreAllMocks();
  });

  it("registers and unregisters terminal handlers cleanly", () => {
    const termId = "test-term-1";
    let syncCalled = false;

    const handler: TerminalResizeHandler = {
      getContainer: () => null,
      isActive: () => true,
      isDisposed: () => false,
      syncSize: () => {
        syncCalled = true;
        return true;
      },
    };

    const unregister = terminalLayoutManager.register(termId, handler);
    expect(terminalLayoutManager.syncTerminalSize(termId)).toBe(true);
    expect(syncCalled).toBe(true);

    unregister();
    syncCalled = false;
    expect(terminalLayoutManager.syncTerminalSize(termId)).toBe(false);
    expect(syncCalled).toBe(false);
  });

  it("coalesces intermediate dimensions and executes authoritative sync when geometry stabilizes", () => {
    const termId = "test-term-2";
    let currentWidth = 1000;
    let currentHeight = 600;
    let visualSyncCount = 0;
    let finalSyncCount = 0;

    const mockContainer = {
      get clientWidth() {
        return currentWidth;
      },
      get clientHeight() {
        return currentHeight;
      },
    } as unknown as HTMLElement;

    const handler: TerminalResizeHandler = {
      getContainer: () => mockContainer,
      isActive: () => true,
      isDisposed: () => false,
      syncVisualOnly: () => {
        visualSyncCount++;
      },
      syncSize: () => {
        finalSyncCount++;
        return true;
      },
    };

    terminalLayoutManager.register(termId, handler);
    terminalLayoutManager.scheduleFit(termId);

    // Frame 1: initial measurement (1000x600). Geometry changed from (0,0) -> visual sync called
    vi.advanceTimersByTime(16);
    expect(visualSyncCount).toBe(1);
    expect(finalSyncCount).toBe(0);

    // In motion: Frame 2 changes to 1400x800
    currentWidth = 1400;
    currentHeight = 800;
    vi.advanceTimersByTime(16);
    expect(visualSyncCount).toBe(2);
    expect(finalSyncCount).toBe(0);

    // Reached final fullscreen target: Frame 3 is 1920x1080
    currentWidth = 1920;
    currentHeight = 1080;
    vi.advanceTimersByTime(16);
    expect(visualSyncCount).toBe(3);
    expect(finalSyncCount).toBe(0);

    // Frame 4: stable at 1920x1080 (stableFrames = 1)
    vi.advanceTimersByTime(16);
    expect(finalSyncCount).toBe(0);

    // Frame 5: stable at 1920x1080 (stableFrames = 2 -> STABLE!)
    vi.advanceTimersByTime(16);
    expect(finalSyncCount).toBe(1);

    // Frame 6: no further calls since dimensions are settled
    vi.advanceTimersByTime(16);
    expect(finalSyncCount).toBe(1);
    expect(visualSyncCount).toBe(3);
  });

  it("does not perform fit when container dimensions are zero", () => {
    const termId = "test-term-zero";
    let finalSyncCount = 0;

    const mockContainer = {
      clientWidth: 0,
      clientHeight: 0,
    } as unknown as HTMLElement;

    const handler: TerminalResizeHandler = {
      getContainer: () => mockContainer,
      isActive: () => true,
      isDisposed: () => false,
      syncSize: () => {
        finalSyncCount++;
        return true;
      },
    };

    terminalLayoutManager.register(termId, handler);
    terminalLayoutManager.scheduleFit(termId);

    // Advance multiple frames with 0x0
    for (let i = 0; i < 15; i++) {
      vi.advanceTimersByTime(16);
    }

    expect(finalSyncCount).toBe(0);
  });

  it("aborts scheduled fit if terminal is disposed before stabilization", () => {
    const termId = "test-term-dispose";
    let disposed = false;
    let finalSyncCount = 0;

    const mockContainer = {
      clientWidth: 1200,
      clientHeight: 800,
    } as unknown as HTMLElement;

    const handler: TerminalResizeHandler = {
      getContainer: () => mockContainer,
      isActive: () => true,
      isDisposed: () => disposed,
      syncSize: () => {
        finalSyncCount++;
        return true;
      },
    };

    terminalLayoutManager.register(termId, handler);
    terminalLayoutManager.scheduleFit(termId);

    // Frame 1
    vi.advanceTimersByTime(16);

    // Terminal unmounts
    disposed = true;

    // Advance frames
    vi.advanceTimersByTime(64);

    expect(finalSyncCount).toBe(0);
  });

  it("triggers fullscreen transition synchronization and post-transition settlement", () => {
    const termId = "test-term-fullscreen";
    let finalSyncCount = 0;

    const mockContainer = {
      clientWidth: 1920,
      clientHeight: 1080,
    } as unknown as HTMLElement;

    const handler: TerminalResizeHandler = {
      getContainer: () => mockContainer,
      isActive: () => true,
      isDisposed: () => false,
      syncSize: () => {
        finalSyncCount++;
        return true;
      },
    };

    terminalLayoutManager.register(termId, handler);
    terminalLayoutManager.notifyFullscreenTransition(termId);

    // Wait for frame stability
    vi.advanceTimersByTime(64);
    expect(finalSyncCount).toBe(1);

    // Advance through the 280ms post-transition settlement timer
    vi.advanceTimersByTime(300);
    // Runs safety check
    vi.advanceTimersByTime(64);
    expect(finalSyncCount).toBeGreaterThanOrEqual(1);
  });

  it("recalculates layout on window restore, maximize, and unmaximize events", () => {
    const notifySpy = vi.spyOn(
      terminalLayoutManager,
      "notifyFullscreenTransition"
    );

    window.dispatchEvent(new Event("restore"));
    expect(notifySpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("maximize"));
    expect(notifySpy).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event("unmaximize"));
    expect(notifySpy).toHaveBeenCalledTimes(3);

    notifySpy.mockRestore();
  });
});
