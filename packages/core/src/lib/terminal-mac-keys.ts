/** macOS text-navigation keys that xterm does not translate for a shell. */

export function isMacPlatform(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
  );
}

/**
 * Terminal.app / iTerm2 equivalents of macOS editing shortcuts, expressed as
 * the readline sequences shells already understand. Returns null when the key
 * should follow xterm's normal handling.
 *
 * Option is deliberately not treated as Meta globally: that would stop layouts
 * which type characters such as @ or { with Option.
 */
export function macTerminalKeySequence(
  event: Pick<
    KeyboardEvent,
    "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey" | "type"
  >,
  isMac: boolean
): string | null {
  if (!isMac || event.type !== "keydown" || event.ctrlKey || event.shiftKey) {
    return null;
  }
  if (event.metaKey && !event.altKey) {
    switch (event.key) {
      case "ArrowLeft":
        return "\x01"; // beginning of line
      case "ArrowRight":
        return "\x05"; // end of line
      case "Backspace":
        return "\x15"; // delete to line start
      default:
        return null;
    }
  }
  if (event.altKey && !event.metaKey) {
    switch (event.key) {
      case "ArrowLeft":
        return "\x1bb"; // back one word
      case "ArrowRight":
        return "\x1bf"; // forward one word
      case "Backspace":
        return "\x1b\x7f"; // delete previous word
      case "Delete":
        return "\x1bd"; // delete next word
      default:
        return null;
    }
  }
  return null;
}
