interface TerminalRegistrationDependencies {
  isDisposed: () => boolean;
  register: (terminalId: string, workspaceId: string) => Promise<unknown>;
  unregister: (terminalId: string) => unknown;
}

/** Registration belongs to a terminal's workspace, never the selected one. */
export async function registerOwnedTerminal(
  terminalId: string,
  workspaceId: string,
  dependencies: TerminalRegistrationDependencies
): Promise<boolean> {
  if (dependencies.isDisposed()) {
    return false;
  }
  await dependencies.register(terminalId, workspaceId);
  if (dependencies.isDisposed()) {
    await dependencies.unregister(terminalId);
    return false;
  }
  return true;
}
