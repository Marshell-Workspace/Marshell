import { useTerminalIdleStore } from "@workspace/core/lib/terminal-idle-store";
import { terminalTaskInterruptBytes } from "@workspace/core/lib/terminal-interruption";

/**
 * Tauri runs every async command as an independent task, so two quick
 * `write_terminal` calls can reach the PTY writer in either order. Keep one
 * strictly ordered queue per terminal so keystrokes and pastes never reorder.
 */
const inputQueues = new Map<string, Promise<unknown>>();

function enqueueInput<T>(
  terminalId: string,
  task: () => Promise<T>
): Promise<T> {
  const previous = inputQueues.get(terminalId) ?? Promise.resolve();
  const result = previous.then(task, task);
  const tail = result.catch(() => undefined);
  inputQueues.set(terminalId, tail);
  tail.then(() => {
    if (inputQueues.get(terminalId) === tail) {
      inputQueues.delete(terminalId);
    }
  });
  return result;
}

/**
 * Send input to one PTY; task cancellation must not quit an interactive CLI.
 * `beforeSend` runs in queue order, so later input waits for it.
 */
export function sendTerminalInput(
  terminalId: string,
  data: string,
  instanceId?: number,
  beforeSend?: () => Promise<void> | void
): Promise<void> {
  return enqueueInput(terminalId, async () => {
    await beforeSend?.();
    const targetInstanceId =
      instanceId ??
      useTerminalIdleStore.getState().terminals[terminalId]?.instanceId;
    const { invoke } = await import("@tauri-apps/api/core");
    let input = data;
    if (data === "\x03") {
      const interrupt = await terminalTaskInterruptBytes(terminalId);
      if (
        interrupt !== data &&
        (await invoke<boolean>("has_active_process", { id: terminalId }))
      ) {
        input = interrupt;
      }
    }
    await invoke("write_terminal", {
      id: terminalId,
      data: input,
      ...(targetInstanceId === undefined
        ? {}
        : { instanceId: targetInstanceId }),
    });
  });
}
