// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { createTerminalOutputBuffer } from "./terminal-output-buffer";
import { takeTerminalBytes } from "./terminal-stream";

afterEach(() => vi.restoreAllMocks());

it("renders split UTF-8 spinner redraws on one line in xterm", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const { Terminal } = await import("@xterm/xterm");
  const terminal = new Terminal({ cols: 60, rows: 10 });
  const output = createTerminalOutputBuffer((data) => terminal.write(data));
  const bytes = new TextEncoder().encode(
    `⠋ ${"Working...".padEnd(58)}\r\x1b[2K⠙ Working...`
  );
  let offset = 0;
  for (let i = 0; i < bytes.length; i++) {
    const chunk = takeTerminalBytes(
      { offset: i, data: "�", bytes: [bytes[i]!] },
      offset
    );
    offset = chunk.nextOffset;
    output.push(chunk.data, 0);
  }
  await new Promise<void>((resolve) => terminal.write("", resolve));
  expect(terminal.buffer.active.getLine(0)?.translateToString(true)).toBe(
    "⠙ Working..."
  );
  expect(terminal.buffer.active.cursorY).toBe(0);
  terminal.dispose();
  output.dispose();
});

it.each([
  47, 80,
])("keeps repeated multi-line CLI frames in place at %i columns", async (cols) => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const { Terminal } = await import("@xterm/xterm");
  const terminal = new Terminal({ cols, rows: 12 });
  const output = createTerminalOutputBuffer((data) => terminal.write(data));
  let offset = 0;
  try {
    for (let frame = 0; frame < 80; frame++) {
      const redraw = `${frame ? "\x1b[2A\r" : ""}\x1b[2K⠋ Reading requirements\r\n\x1b[2KSearching workspace files\r\n\x1b[2KWorking frame ${frame}`;
      const bytes = new TextEncoder().encode(redraw);
      for (let start = 0; start < bytes.length; start += 7) {
        const part = bytes.subarray(start, start + 7);
        const chunk = takeTerminalBytes(
          { offset, bytes: [...part], data: "" },
          offset
        );
        offset = chunk.nextOffset;
        output.push(chunk.data, 0);
      }
    }
    await new Promise<void>((resolve) => terminal.write("", resolve));
    expect(terminal.buffer.active.cursorY).toBe(2);
    expect(terminal.buffer.active.baseY).toBe(0);
    expect(terminal.buffer.active.getLine(2)?.translateToString(true)).toBe(
      "Working frame 79"
    );
    expect(terminal.buffer.active.getLine(3)?.translateToString(true)).toBe("");
  } finally {
    terminal.dispose();
    output.dispose();
  }
});
