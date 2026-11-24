const MAX_BUFFERED_CHARACTERS = 64 * 1024;

/** Batches output without delaying input or keeping an unbounded backlog. */
export function createTerminalOutputBuffer(
  write: (data: string | Uint8Array, parsed?: () => void) => void
) {
  let chunks: (string | Uint8Array)[] = [];
  let callbacks: (() => void)[] = [];
  let length = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let deadline = 0;
  let disposed = false;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (length === 0 || disposed) {
      return;
    }
    let data: string | Uint8Array;
    if (chunks.every((chunk) => typeof chunk === "string")) {
      data = chunks.join("");
    } else {
      const binary = chunks.map((chunk) =>
        typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk
      );
      data = new Uint8Array(
        binary.reduce((sum, chunk) => sum + chunk.length, 0)
      );
      let offset = 0;
      for (const chunk of binary) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
    }
    chunks = [];
    length = 0;
    const parsed = callbacks;
    callbacks = [];
    if (parsed.length > 0) {
      write(data, () => {
        if (!disposed) {
          for (const callback of parsed) {
            callback();
          }
        }
      });
    } else {
      write(data);
    }
  };

  return {
    push(data: string | Uint8Array, batchMs: number, parsed?: () => void) {
      if (disposed || data.length === 0) {
        return;
      }
      chunks.push(data);
      if (parsed) {
        callbacks.push(parsed);
      }
      length += data.length;
      if (batchMs <= 0 || length >= MAX_BUFFERED_CHARACTERS) {
        flush();
        return;
      }
      const nextDeadline = Date.now() + batchMs;
      if (timer !== null && nextDeadline >= deadline) {
        return;
      }
      if (timer !== null) {
        clearTimeout(timer);
      }
      deadline = nextDeadline;
      timer = setTimeout(flush, batchMs);
    },
    flush,
    dispose() {
      disposed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      chunks = [];
      callbacks = [];
      length = 0;
    },
  };
}

export type TerminalOutputBuffer = ReturnType<
  typeof createTerminalOutputBuffer
>;
