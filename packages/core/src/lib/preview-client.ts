export interface DetectedPort {
  pid: number;
  port: number;
}

/** Ports worth offering when nothing was detected from the workspace itself. */
export const COMMON_DEV_PORTS = [3000, 3010, 4200, 4321, 5173, 8000, 8080];

async function call<T>(
  command: string,
  args: Record<string, unknown>
): Promise<T> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    throw new Error("The app preview needs the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export const previewClient = {
  detectPorts: (workspaceId: string, terminalIds: string[]) =>
    call<DetectedPort[]>("preview_detect_ports", { terminalIds, workspaceId }),
  probePorts: (ports: number[]) =>
    call<number[]>("preview_probe_ports", { ports }),
  proxyStart: (targetPort: number) =>
    call<string>("preview_proxy_start", { targetPort }),
  proxyStop: (targetPort: number) =>
    call<void>("preview_proxy_stop", { targetPort }),
};

export async function openExternal(url: string): Promise<void> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
