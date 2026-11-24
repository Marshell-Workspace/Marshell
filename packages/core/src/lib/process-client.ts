import type { LogLine } from "@workspace/core/lib/process-utils";

export type ProcessStatus = "crashed" | "exited" | "running" | "stopped";

export interface ProcessInfo {
  command: string;
  cpuPercent: number | null;
  cwd: string;
  exitCode: number | null;
  /** Diagnosis of the last crash, e.g. a port conflict. */
  hint: string | null;
  id: string;
  memoryMb: number | null;
  pid: number | null;
  /** Ports the process (or anything it started) is listening on. */
  ports: number[];
  restartOnCrash: boolean;
  restartPending: boolean;
  /** Automatic restarts so far. */
  restarts: number;
  startedAt: number;
  status: ProcessStatus;
  workspaceId: string;
}

async function call<T>(
  command: string,
  args: Record<string, unknown>
): Promise<T> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    throw new Error("Background processes need the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export const processClient = {
  list: (workspaceId: string) =>
    call<ProcessInfo[]>("process_list", { workspaceId }),
  logs: (processId: string, afterSeq?: number) =>
    call<{ lines: LogLine[]; next: number }>("process_logs", {
      afterSeq,
      processId,
    }),
  remove: (processId: string) => call<void>("process_remove", { processId }),
  restart: (processId: string) => call<void>("process_restart", { processId }),
  start: (
    workspaceId: string,
    command: string,
    args: string[],
    cwd: string,
    options: { env?: Record<string, string>; restartOnCrash?: boolean } = {}
  ) =>
    call<string>("process_start", {
      args,
      command,
      cwd,
      env: options.env,
      restartOnCrash: options.restartOnCrash,
      workspaceId,
    }),
  stop: (processId: string) => call<void>("process_stop", { processId }),
};
