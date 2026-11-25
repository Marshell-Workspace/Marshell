import type { CliItemMeta } from "./cli-catalog";
import type { CliItemStatus } from "./cli-installer-client";

export type WorkspaceAgentRoute = "direct";

export function supportsWorkspaceGateway(_agentId: string): boolean {
  return false;
}

export function workspaceAgentCommand(
  agent: Pick<CliItemMeta, "id" | "command">,
  _route?: WorkspaceAgentRoute,
  status?: CliItemStatus
): string {
  if (status?.status === "installed" && status.commandName) {
    const separator = agent.command.indexOf(" ");
    return separator === -1
      ? status.commandName
      : status.commandName + agent.command.slice(separator);
  }
  return agent.command;
}

export function isAgentAvailable(status: CliItemStatus | undefined): boolean {
  if (status?.status !== "installed") {
    return false;
  }
  const version = status.version ?? "";
  return !/cannot find module|error|not found/i.test(version);
}
