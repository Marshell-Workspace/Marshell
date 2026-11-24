import { safeUUID } from "@workspace/core/lib/uuid";

const DEVICE_ID_KEY = "marshell_device_id";

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "server";
  }
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }
    const created = safeUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return safeUUID();
  }
}

export interface DesktopClient {
  deviceId: string;
  platform: "windows" | "darwin" | "linux" | "android" | "ios" | "web";
  version: string;
}
export async function getDesktopClient(): Promise<DesktopClient> {
  const deviceId = getOrCreateDeviceId();
  if (
    typeof window !== "undefined" &&
    ("__TAURI__" in window || "__TAURI_INTERNALS__" in window)
  ) {
    const { invoke } = await import("@tauri-apps/api/core");
    const metadata =
      await invoke<Omit<DesktopClient, "deviceId">>("desktop_metadata");
    return { ...metadata, deviceId };
  }
  return {
    deviceId,
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.1",
    platform: "web",
  };
}
