/**
 * Centralized Client Service for AI Agent & Tool CLI installation and detection.
 * Communicates with native Tauri backend when running as desktop app,
 * or safely falls back to standard checks when running on web.
 */

export interface CliInstallEventPayload {
  executable?: string;
  id: string;
  message?: string;
  status: "installing" | "success" | "error";
  version?: string;
}

export interface CliDetectionResult {
  checkedAt?: number;
  commandName?: string;
  executable?: string;
  id: string;
  name?: string;
  prereqName?: string;
  /** Human-readable diagnostic message explaining the current status */
  reason?: string;
  status:
    | "installed"
    | "not-installed"
    | "installing"
    | "failed"
    | "missing-prereq"
    | "unsupported"
    | "unknown";
  version?: string;
}

export type CliItemStatus = CliDetectionResult;

export async function checkCliInstalled(
  id: string
): Promise<CliDetectionResult> {
  try {
    return (await checkAllCliAgents())[id] ?? { id, status: "unknown" };
  } catch {
    return { id, status: "unknown" };
  }
}

let cachedStatusMap: Record<string, CliDetectionResult> | null = null;

export function invalidateCliCache(): void {
  cachedStatusMap = null;
}

export function getCachedCliStatusMap(): Record<
  string,
  CliDetectionResult
> | null {
  return cachedStatusMap;
}

export async function checkAllCliAgents(
  force = false
): Promise<Record<string, CliDetectionResult>> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return {};
  }
  if (!force && cachedStatusMap) {
    return cachedStatusMap;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const results = await invoke<Record<string, CliDetectionResult>>(
    "check_all_cli_agents",
    { force }
  );
  cachedStatusMap = results;
  return results;
}

export async function installCliAgent(_id: string): Promise<boolean> {
  return false;
}

export async function launchCliTool(
  _id: string,
  _directory?: string
): Promise<boolean> {
  return false;
}

export async function refreshCliEnvironment(): Promise<void> {
  cachedStatusMap = null;
}

export async function listenCliInstallProgress(
  _callback: (payload: CliInstallEventPayload) => void
): Promise<() => void> {
  return () => {};
}
