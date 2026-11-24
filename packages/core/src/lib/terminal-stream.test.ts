import { expect, it } from "vitest";
import { createTerminalOutputBuffer } from "./terminal-output-buffer";
import { takeTerminalBytes } from "./terminal-stream";

it("preserves fragmented spinner characters and ANSI redraws byte for byte", () => {
  const bytes = new TextEncoder().encode("⠋ Working...\r\x1b[2K⠙ Working...");
  const output: number[] = [];
  let offset = 0;
  for (let i = 0; i < bytes.length; i++) {
    const chunk = takeTerminalBytes(
      { offset: i, data: "�", bytes: [bytes[i]!] },
      offset
    );
    offset = chunk.nextOffset;
    output.push(...chunk.data);
  }
  expect(output).toEqual([...bytes]);
  expect(offset).toBe(bytes.length);
});

it("deduplicates overlapping history in bytes rather than UTF-16 characters", () => {
  const bytes = new TextEncoder().encode("⠋done");
  const result = takeTerminalBytes(
    { offset: 0, data: "⠋done", bytes: [...bytes] },
    3
  );
  expect(new TextDecoder().decode(result.data)).toBe("done");
  expect(result.nextOffset).toBe(bytes.length);
  expect(
    takeTerminalBytes(
      { offset: 0, data: "⠋done", bytes: [...bytes] },
      bytes.length
    ).data.length
  ).toBe(0);
});

it("batches binary output without converting split UTF-8 into replacement characters", () => {
  const chunks: Uint8Array[] = [];
  const output = createTerminalOutputBuffer((data) =>
    chunks.push(data as Uint8Array)
  );
  output.push(new Uint8Array([0xe2]), 24);
  output.push(new Uint8Array([0xa0, 0x8b, 13, 27, 91, 50, 75]), 24);
  output.flush();
  expect(chunks).toEqual([
    new Uint8Array([0xe2, 0xa0, 0x8b, 13, 27, 91, 50, 75]),
  ]);
  output.dispose();
});

it("decodes base64 payloads from the native side byte for byte", () => {
  const bytes = new Uint8Array([
    0xe2, 0xa0, 0x8b, 0x1b, 0x5b, 0x32, 0x4b, 0xff,
  ]);
  const encoded = btoa(String.fromCharCode(...bytes));
  const result = takeTerminalBytes({ offset: 10, bytes: encoded }, 0);
  expect([...result.data]).toEqual([...bytes]);
  expect(result.nextOffset).toBe(10 + bytes.length);
  expect(
    takeTerminalBytes({ offset: 10, bytes: encoded }, 12).data.length
  ).toBe(bytes.length - 2);
});
