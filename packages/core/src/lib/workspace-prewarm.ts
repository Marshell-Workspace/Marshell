/**
 * Intent signal for workspace switching. Hovering/focusing a workspace in the
 * sidebar asks the terminal grid to mount that workspace's terminals early, so
 * xterm init (and the shell spawn) happens before the click instead of during
 * the switch animation.
 */
const PREWARM_EVENT = "marshell:prewarm-workspace";

export function prewarmWorkspace(workspaceId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<string>(PREWARM_EVENT, { detail: workspaceId })
  );
}

export function onPrewarmWorkspace(
  listener: (workspaceId: string) => void
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const handler = (event: Event) => {
    const id = (event as CustomEvent<string>).detail;
    if (typeof id === "string") {
      listener(id);
    }
  };
  window.addEventListener(PREWARM_EVENT, handler);
  return () => window.removeEventListener(PREWARM_EVENT, handler);
}
