import { siteConfig } from "@workspace/core/config/site";

const V_PREFIX_DIGIT_REGEX = /^v\d/;
const V_PREFIX_REGEX = /^v/;
const MAC_REGEX = /Mac|iPod|iPhone|iPad/;
const KEY_SPLIT_REGEX = /[+>]+/;
export async function fetchLatestGithubVersion(): Promise<string | null> {
  try {
    const res = await fetch(siteConfig.links.githubApi);
    if (!res.ok) {
      return null;
    }
    const releases: {
      tag_name: string;
      prerelease: boolean;
      draft: boolean;
    }[] = await res.json();
    const appRelease = releases.find(
      (r) => !(r.prerelease || r.draft) && V_PREFIX_DIGIT_REGEX.test(r.tag_name)
    );
    return appRelease?.tag_name?.replace(V_PREFIX_REGEX, "") || null;
  } catch {
    return null;
  }
}

/**
 * Returns a human-readable label for a hotkey key string.
 * Detects macOS to show ⌘ instead of Ctrl.
 * Handles sequence strings (e.g. "g>s") and combinators (e.g. "mod+k").
 */
export function formatHotkeyDisplay(keys: string): string[] {
  const isMac =
    typeof navigator !== "undefined" && MAC_REGEX.test(navigator.userAgent);

  // Split by either `+` or `>` to support sequences like "g>s" and chords like "mod+k"
  return keys.split(KEY_SPLIT_REGEX).map((key) => {
    switch (key) {
      case "mod":
        return isMac ? "⌘" : "Ctrl";
      case "shift":
        return isMac ? "⇧" : "Shift";
      case "alt":
        return isMac ? "⌥" : "Alt";
      default:
        return key.toUpperCase();
    }
  });
}

export function formatTimeAgo(date: string | number | Date): string {
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) {
    return "";
  }
  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
