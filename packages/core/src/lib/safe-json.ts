/**
 * Safe JSON parser utility that prevents "Unexpected end of JSON input" crashes
 * when reading empty strings, invalid tokens, or corrupted localStorage values.
 */
export function safeJsonParse<T = unknown>(
  input: string | null | undefined,
  fallback: T | null = null
): T | null {
  if (!input || typeof input !== "string") {
    return fallback;
  }

  const trimmed = input.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") {
    return fallback;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

const SESSION_STORAGE_KEYS = new Set([
  "marshell-workspaces-v2",
  "marshell-layout-v1",
  "marshell_layout_state",
  "marshell-editor-v1",
  "marshell-kanban-ui-store",
]);

export function isAutoSaveSessionEnabled(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const raw = localStorage.getItem("marshell-general-settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.autoSaveSession === false) {
        return false;
      }
    }
  } catch {
    // Ignore parse error
  }
  return true;
}

/**
 * Safe storage wrapper for Zustand createJSONStorage that handles empty, corrupted,
 * or truncated localStorage entries without throwing "Unexpected end of JSON input".
 */
export const safeStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      const item = localStorage.getItem(name);
      if (!item) {
        return null;
      }
      const trimmed = item.trim();
      if (!trimmed || trimmed === "undefined" || trimmed === "null") {
        return null;
      }
      // Test parse to catch truncation
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      try {
        localStorage.removeItem(name);
      } catch {}
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") {
      return;
    }
    if (SESSION_STORAGE_KEYS.has(name) && !isAutoSaveSessionEnabled()) {
      return;
    }
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.error(`[Storage] Failed to set item "${name}":`, e);
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.error(`[Storage] Failed to remove item "${name}":`, e);
    }
  },
};
