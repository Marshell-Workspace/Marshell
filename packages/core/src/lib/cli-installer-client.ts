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
  return { id, status: "not-installed" };
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
  _force = false
): Promise<Record<string, CliDetectionResult>> {
  cachedStatusMap = {};
  return {};
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
