/** Shell-specific input for a PTY, keyed by the shell that is actually running. */

export type TerminalShellKind =
  | "powershell"
  | "cmd"
  | "bash"
  | "zsh"
  | "fish"
  | "gitbash"
  | "sh"
  | "other";

const KNOWN_KINDS: readonly string[] = [
  "powershell",
  "cmd",
  "bash",
  "zsh",
  "fish",
  "gitbash",
  "sh",
  "other",
];

const shellKinds = new Map<string, TerminalShellKind>();

export function parseTerminalShellKind(
  value: unknown
): TerminalShellKind | undefined {
  return typeof value === "string" && KNOWN_KINDS.includes(value)
    ? (value as TerminalShellKind)
    : undefined;
}

export function setTerminalShellKind(
  terminalId: string,
  kind: TerminalShellKind | undefined
): void {
  if (kind) {
    shellKinds.set(terminalId, kind);
  } else {
    shellKinds.delete(terminalId);
  }
}

export function getTerminalShellKind(
  terminalId: string
): TerminalShellKind | undefined {
  return shellKinds.get(terminalId);
}

export function terminalShellLabel(kind: TerminalShellKind): string {
  switch (kind) {
    case "powershell":
      return "PowerShell";
    case "cmd":
      return "Command Prompt";
    case "bash":
      return "Bash Shell";
    case "zsh":
      return "Zsh";
    case "fish":
      return "Fish";
    case "gitbash":
      return "Git Bash";
    default:
      return "Shell";
  }
}

/**
 * What to send so the shell clears its screen. Line editors (readline, zle,
 * PSReadLine, fish) bind Ctrl+L to it, which keeps any half-typed command and
 * types nothing. cmd.exe has no such key, so it needs the `cls` command.
 */
export function clearScreenInput(kind: TerminalShellKind | undefined): string {
  return kind === "cmd" ? "cls\r" : "\x0c";
}

/**
 * Appends a marker line carrying the previous command's exit status, in the
 * syntax of the running shell. cmd needs `call echo %^errorlevel%` because a
 * plain %errorlevel% is expanded once for the whole line, before the command runs.
 */
export function taskExitSuffix(
  kind: TerminalShellKind | undefined,
  taskId: string
): string {
  const marker = `TASK_FINISHED_${taskId}_`;
  switch (kind) {
    case "cmd":
      return ` & call echo ${marker}%^errorlevel%`;
    case "powershell":
      return ` ; echo ${marker}$LASTEXITCODE`;
    case "fish":
      return `; echo ${marker}$status`;
    default:
      return `; echo ${marker}$?`;
  }
}
