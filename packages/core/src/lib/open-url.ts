export async function openExternalUrl(url: string): Promise<void> {
  if (
    typeof window !== "undefined" &&
    ("__TAURI__" in window || "__TAURI_INTERNALS__" in window)
  ) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_browser", { url });
        return;
      } catch {
        throw new Error(
          "Could not open your browser. Check your system browser settings and try again."
        );
      }
    }
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
