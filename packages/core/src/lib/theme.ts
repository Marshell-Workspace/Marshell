import {
  DEFAULT_ACCENT_ID,
  ensureDarkContrast,
  getAutoForeground,
  getLightModeInk,
  hexToRgb,
  isValidAccentId,
  type PresetAccentId,
} from "./accent-colors";

export type ThemeMode = "light" | "dark" | "system";

export type ContrastMode = "low" | "default" | "high";

export const CONTRAST_MODES: readonly ContrastMode[] = [
  "low",
  "default",
  "high",
] as const;

export function isContrastMode(value: unknown): value is ContrastMode {
  return value === "low" || value === "default" || value === "high";
}

/**
 * Contrast is a modifier on the resolved light/dark theme. The attribute is
 * only present for low/high; CSS then retunes each theme separately.
 */
export function applyContrast(mode: ContrastMode): void {
  if (typeof document === "undefined" || !document.documentElement) {
    return;
  }
  const root = document.documentElement;
  if (mode === "default") {
    root.removeAttribute("data-contrast");
  } else {
    root.setAttribute("data-contrast", mode);
  }
}

export type AccentOption = PresetAccentId | "custom";

export function getResolvedTheme(mode: ThemeMode): "light" | "dark" {
  if (typeof window === "undefined") {
    return "dark";
  }
  if (mode === "system") {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

function paintResolvedTheme(resolved: "light" | "dark"): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  if (resolved === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
}

/**
 * Keep the native window chrome (title bar, controls) in step with the app.
 *
 * - Explicit Light/Dark: pin the window to that theme.
 * - System: RELEASE the window (`setTheme(null)`) so it follows the OS again.
 *   Pinning it to the theme we resolved would feed back into the webview's
 *   `prefers-color-scheme` and lock the app to whatever it resolved first,
 *   which is exactly how "System" got stuck on light with the OS in dark.
 *   After releasing, the window's own theme is the authoritative OS value.
 * No-op in the browser or if the permission is missing.
 */
function syncNativeWindowTheme(mode: ThemeMode): void {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return;
  }
  import("@tauri-apps/api/window")
    .then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      if (mode !== "system") {
        await win.setTheme(mode);
        return;
      }
      await win.setTheme(null);
      const osTheme = await win.theme();
      if (osTheme !== "light" && osTheme !== "dark") {
        return;
      }
      // Still following the OS? Then reconcile in case matchMedia lagged.
      if (
        typeof document !== "undefined" &&
        document.documentElement.getAttribute("data-theme") !== osTheme &&
        globalThis.localStorage?.getItem("marshell-theme") !== "light" &&
        globalThis.localStorage?.getItem("marshell-theme") !== "dark"
      ) {
        paintResolvedTheme(osTheme);
        refreshCustomAccent();
      }
    })
    .catch(() => undefined);
}

let themeTransitionTimer: ReturnType<typeof setTimeout> | null = null;

export function applyTheme(mode: ThemeMode): void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !document.documentElement
  ) {
    return;
  }
  const resolved = getResolvedTheme(mode);
  const root = document.documentElement;
  const previousTheme = root.getAttribute("data-theme");

  const isSwitching = Boolean(previousTheme && previousTheme !== resolved);
  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  if (isSwitching && !prefersReducedMotion) {
    // Smooth, minimal transition without heavy View Transitions API or lag
    if (themeTransitionTimer) {
      clearTimeout(themeTransitionTimer);
    }
    root.classList.add("theme-transition");
    themeTransitionTimer = setTimeout(() => {
      root.classList.remove("theme-transition");
      themeTransitionTimer = null;
    }, 220);
  }

  paintResolvedTheme(resolved);
  syncNativeWindowTheme(mode);
  refreshCustomAccent();
}

/** The custom accent's ink depends on the theme, so re-derive it after a switch. */
function refreshCustomAccent(): void {
  const root = document.documentElement;
  if (root.getAttribute("data-accent") === "custom") {
    try {
      const customHex =
        window.localStorage?.getItem("marshell-custom-accent") || "#38bdf8";
      applyAccent("custom", customHex);
    } catch {}
  }
}

export function applyAccent(accent: AccentOption, customHex?: string): void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !document.documentElement
  ) {
    return;
  }
  const root = document.documentElement;
  const safeAccent: AccentOption = isValidAccentId(accent)
    ? accent
    : DEFAULT_ACCENT_ID;

  root.setAttribute("data-accent", safeAccent);

  if (safeAccent === "custom") {
    let resolvedHex = customHex;
    if (!resolvedHex && typeof window !== "undefined") {
      try {
        resolvedHex =
          window.localStorage?.getItem("marshell-custom-accent") || undefined;
      } catch {}
    }
    const { hex: safeHex } = ensureDarkContrast(resolvedHex || "#8b5cf6");
    const [r, g, b] = hexToRgb(safeHex);
    const on = getAutoForeground(safeHex);
    const isLight =
      root.getAttribute("data-theme") === "light" ||
      !root.classList.contains("dark");
    const ink = isLight ? getLightModeInk(safeHex) : safeHex;

    root.style.setProperty("--accent-fill", safeHex);
    root.style.setProperty("--accent-ink", ink);
    root.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
    root.style.setProperty("--accent-on", on);
  } else {
    // Preset: remove inline CSS variable overrides so CSS rules apply cleanly
    root.style.removeProperty("--accent-fill");
    root.style.removeProperty("--accent-ink");
    root.style.removeProperty("--accent-rgb");
    root.style.removeProperty("--accent-on");
  }
}
