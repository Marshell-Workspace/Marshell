/**
 * Core Fullscreen Manager
 * Unified helper for Web and Tauri native window fullscreen management.
 */

import { terminalLayoutManager } from "@workspace/core/lib/terminal-layout-manager";

export async function isApplicationFullscreen(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    if (isTauri()) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      return await getCurrentWindow().isFullscreen();
    }
  } catch {
    // Fall back to web
  }

  return Boolean(document.fullscreenElement);
}

export async function setApplicationFullscreen(
  enable: boolean
): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  let result = false;

  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    if (isTauri()) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setFullscreen(enable);
      result = enable;
    }
  } catch {
    // Fall back to web
  }

  if (!result) {
    try {
      if (enable) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          result = true;
        }
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
        result = false;
      }
    } catch {
      // Browser fullscreen request might be denied or cancelled
    }
  }

  terminalLayoutManager.notifyFullscreenTransition();
  return result;
}

export async function toggleApplicationFullscreen(): Promise<boolean> {
  const current = await isApplicationFullscreen();
  return await setApplicationFullscreen(!current);
}
