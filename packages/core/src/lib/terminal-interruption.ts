import { getTerminalCliLogoId } from "@workspace/core/lib/terminal-cli-logo";
import { useTerminalIdleStore } from "@workspace/core/lib/terminal-idle-store";

/** Interrupt a CLI turn without sending its session-exit keyboard shortcut. */
export async function terminalTaskInterruptBytes(
  terminalId: string
): Promise<string> {
  // A remembered CLI command is a startup preference, not proof it still owns
  // the shell. A later shell prompt/command takes precedence over that history.
  const output =
    useTerminalIdleStore.getState().terminals[terminalId]?.bufferTail ?? "";
  const shellCommand = [
    ...output.matchAll(
      /(?:^|[\r\n])(?:(?:PS[ \t]+)?[a-z]:[^\r\n>]*>|(?:[^\s@]+@[^\s:]+(?::[^\r\n$#%]*|[ \t]+[^\r\n$#%]*)|[~/][^\r\n$#%]*)[$#%])[ \t]*([^\r\n]*)/gi
    ),
  ].at(-1)?.[1];
  if (shellCommand !== undefined) {
    const shellCli = getTerminalCliLogoId(shellCommand);
    return shellCli === "codex" || shellCli === "claude" ? "\x1b" : "\x03";
  }
  const { useWorkspaceStore } = await import(
    "@workspace/core/stores/workspace-store"
  );
  const store = useWorkspaceStore.getState();
  const workspace = store.workspaces.find((candidate) =>
    candidate.panes.some((pane) => pane.id === terminalId)
  );
  const pane = workspace?.panes.find(
    (candidate) => candidate.id === terminalId
  );
  const cli = getTerminalCliLogoId(
    store.getTerminalStartupCommand(
      terminalId,
      pane?.autoCommand ?? workspace?.autoCommand
    )
  );
  return cli === "codex" || cli === "claude" ? "\x1b" : "\x03";
}
