export type TerminalCliLogoId = "claude" | "codex" | "agy";

const EXECUTABLE_PATTERN = /^(?:&\s+)?(?:"([^"]+)"|'([^']+)'|(\S+))/;
const EXECUTABLE_EXTENSION_PATTERN = /\.(?:exe|cmd|bat)$/i;
const PATH_SEPARATOR_PATTERN = /[\\/]/;
const WINDOWS_PROMPT_PATTERN = /^(?:PS\s+)?[a-z]:[^>\r\n]*>\s*(.*)$/i;
const UNIX_PROMPT_PATTERN = /^(?:[^\r\n]*?[$#]|❯|➜)\s+(.*)$/;
const ANSI_COLOR_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;

export interface TerminalCommandBuffer {
  baseY: number;
  cursorY: number;
  getLine: (index: number) =>
    | {
        isWrapped: boolean;
        translateToString: (trimRight?: boolean) => string;
      }
    | undefined;
}

/** Resolve the assigned CLI without mistaking arguments or folder names for it. */
export function getTerminalCliLogoId(
  command: string | undefined
): TerminalCliLogoId | null {
  const match = EXECUTABLE_PATTERN.exec(command?.trim() ?? "");
  const executable = match?.[1] ?? match?.[2] ?? match?.[3];
  const name = executable
    ?.split(PATH_SEPARATOR_PATTERN)
    .at(-1)
    ?.replace(EXECUTABLE_EXTENSION_PATTERN, "")
    .toLowerCase();

  switch (name) {
    case "claude":
      return "claude";
    case "codex":
      return "codex";
    case "agy":
    case "antigravity":
      return "agy";
    default:
      return null;
  }
}

/** Only shell prompts identify launches; mentions in CLI output do not. */
export function getTerminalCliLogoFromPrompt(
  line: string
): TerminalCliLogoId | null {
  return getTerminalCliLogoId(getCommandFromPrompt(line));
}

function getCommandFromPrompt(line: string): string | undefined {
  const cleanLine = line.replace(ANSI_COLOR_PATTERN, "").trim();
  return (
    WINDOWS_PROMPT_PATTERN.exec(cleanLine)?.[1] ??
    UNIX_PROMPT_PATTERN.exec(cleanLine)?.[1]
  );
}

export function getSubmittedTerminalCliLogo(
  buffer: TerminalCommandBuffer,
  data: string
): TerminalCliLogoId | null {
  return getTerminalCliLogoId(
    getSubmittedTerminalCliCommand(buffer, data) ?? undefined
  );
}

/** Preserve explicit CLI launches, never CLI chat text or unrelated shell commands. */
export function getSubmittedTerminalCliCommand(
  buffer: TerminalCommandBuffer,
  data: string
): string | null {
  if (!(data.includes("\r") || data.includes("\n"))) {
    return null;
  }
  let index = buffer.baseY + buffer.cursorY;
  let line = buffer.getLine(index);
  let text = line?.translateToString(true) ?? "";
  // Reconstruct commands wrapped by narrow panes, including history-recalled edits.
  while (line?.isWrapped && index > 0) {
    index -= 1;
    line = buffer.getLine(index);
    text = (line?.translateToString(false) ?? "") + text;
  }
  const pastedCommand = data.split(/[\r\n]/)[0] ?? "";
  const command = getCommandFromPrompt(text + pastedCommand)?.trim();
  return command && getTerminalCliLogoId(command) ? command : null;
}

export function getTerminalCliLogoFromHistory(
  history: string
): TerminalCliLogoId | null {
  let logo: TerminalCliLogoId | null = null;
  for (const line of history.split(/[\r\n]+/)) {
    logo = getTerminalCliLogoFromPrompt(line) ?? logo;
  }
  return logo;
}
