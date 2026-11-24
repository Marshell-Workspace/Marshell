import type { CliItemMeta } from "./cli-catalog";
import type { CliItemStatus } from "./cli-installer-client";

export type WorkspaceAgentRoute = "direct";

export function supportsWorkspaceGateway(_agentId: string): boolean {
  return false;
}

export function workspaceAgentCommand(
  agent: Pick<CliItemMeta, "id" | "command">,
  _route?: WorkspaceAgentRoute
): string {
  return agent.command;
}

export function isAgentAvailable(status: CliItemStatus | undefined): boolean {
  if (status?.status !== "installed") {
    return false;
  }
  const version = status.version ?? "";
  return !/cannot find module|error|not found/i.test(version);
}
