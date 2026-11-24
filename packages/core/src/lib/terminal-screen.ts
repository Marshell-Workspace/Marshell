interface ScreenBuffer {
  baseY?: number;
  cursorX?: number;
  cursorY?: number;
  getLine: (
    index: number
  ) => { translateToString: (trimRight: boolean) => string } | undefined;
  length: number;
}

export type TerminalComposerState = "ready" | "draft";

const CODEX_AGENT_FOOTER =
  /^← for agents(?:[\s·]*\? for shortcuts)?(?:[\s·]*⚠\uFE0F?\s*\d+ warnings?\s*·\s*f2 to view)?$/i;
const COMPOSER_BORDER = /^[─━╌╭╰╮╯│┌└┐┘\s]+$/;

/** Text-only fallback; rendered cursor evidence takes precedence when available. */
export function terminalComposerState(
  output: string
): TerminalComposerState | undefined {
  const lines = output.replace(/\r/g, "\n").trimEnd().split("\n");
  while (lines.length > 0) {
    const line = lines.pop()?.trim() ?? "";
    if (!line || CODEX_AGENT_FOOTER.test(line) || COMPOSER_BORDER.test(line)) {
      continue;
    }
    if (
      /^(?:\? for shortcuts|← for agents.*\? for shortcuts.*|.*\d+% context left|.*shift\+tab to cycle.*|GPT-[\w.-]+\s+(?:low|medium|high|xhigh|max|ultra)\s+·.*|⚠\s*\d+ warnings?\s*·\s*f2 to view)$/i.test(
        line
      )
    ) {
      continue;
    }
    if (
      /^(?:❯|›|>)\s*$/.test(line) ||
      /^›\s+Ask Codex to do anything$/.test(line)
    ) {
      return "ready";
    }
    return /^(?:❯|›|>)\s+\S/.test(line) ? "draft" : undefined;
  }
  return;
}

/** Locate the actual composer above CLI footers, including wrapped drafts. */
export function terminalScreenComposer(
  buffer: ScreenBuffer
): TerminalComposerState | undefined {
  if (buffer.cursorX === undefined || buffer.cursorY === undefined) {
    return;
  }
  const cursorRow = (buffer.baseY ?? 0) + buffer.cursorY;
  for (let row = cursorRow; row >= (buffer.baseY ?? 0); row--) {
    const line = buffer.getLine(row)?.translateToString(true) ?? "";
    if (/^\s*[❯›>]\s*(?:\S.*)?$/.test(line)) {
      if (row !== cursorRow) {
        return "draft";
      }
      // CLIs paint a suggestion after the cursor in an otherwise empty
      // composer. The same text typed with the cursor at its end is a draft.
      if (
        (/^\s*❯\s+Try "[^"\n]+"\s*$/.test(line) ||
          /^\s*›\s+Ask Codex to do anything\s*$/.test(line) ||
          /^\s*>\s+Auto mode: edits & safe commands auto-approved\b.*$/.test(
            line
          )) &&
        /^\s*[❯›>]\s*$/.test(line.slice(0, buffer.cursorX))
      ) {
        return "ready";
      }
      return /^\s*[❯›>]\s*$/.test(line) ? "ready" : "draft";
    }
    if (COMPOSER_BORDER.test(line) && line.trim()) {
      return;
    }
  }
  return;
}

/** Codex keeps its empty composer visible while a turn is running. */
export function terminalScreenIsWorking(screen: string): boolean {
  return /(?:^|\n)\s*[•◦✻✽✶✢✳✺·⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s+[^\n]*(?:esc to (?:interrupt|cancel))/i.test(
    screen
  );
}
/** Read the rendered bottom of the live buffer, independent of scroll position. */
export function terminalScreenTail(buffer: ScreenBuffer): string {
  const lines: string[] = [];
  for (
    let row = Math.max(0, buffer.baseY ?? 0, buffer.length - 40);
    row < buffer.length;
    row++
  ) {
    lines.push(buffer.getLine(row)?.translateToString(true) ?? "");
  }
  return lines.join("\n").trimEnd();
}
