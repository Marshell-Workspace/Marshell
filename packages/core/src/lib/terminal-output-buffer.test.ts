import { afterEach, expect, it, vi } from "vitest";
import { createTerminalOutputBuffer } from "./terminal-output-buffer";

afterEach(() => vi.useRealTimers());

it("coalesces burst output in order within each profile's latency budget", () => {
  vi.useFakeTimers();
  for (const budget of [8, 16, 24]) {
    const write = vi.fn();
    const output = createTerminalOutputBuffer(write);
    output.push("first", budget);
    output.push("second", budget);
    vi.advanceTimersByTime(budget - 1);
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledExactlyOnceWith("firstsecond");
    output.dispose();
  }
});

it("shortens pending latency when switching to a faster profile without reordering", () => {
  vi.useFakeTimers();
  const write = vi.fn();
  const output = createTerminalOutputBuffer(write);
  output.push("eco", 24);
  vi.advanceTimersByTime(2);
  output.push("turbo", 8);
  vi.advanceTimersByTime(8);
  expect(write).toHaveBeenCalledExactlyOnceWith("ecoturbo");
  vi.advanceTimersByTime(50);
  expect(write).toHaveBeenCalledTimes(1);
});

it("flushes large bursts without waiting for a timer", () => {
  vi.useFakeTimers();
  const write = vi.fn();
  const output = createTerminalOutputBuffer(write);
  const data = "x".repeat(64 * 1024);
  output.push("prefix", 24);
  output.push(data, 24);
  expect(write).toHaveBeenCalledExactlyOnceWith(`prefix${data}`);
  expect(vi.getTimerCount()).toBe(0);
});

it("can flush before input and never writes after terminal disposal", () => {
  vi.useFakeTimers();
  const write = vi.fn();
  const output = createTerminalOutputBuffer(write);
  output.push("prompt", 24);
  output.flush();
  expect(write).toHaveBeenCalledExactlyOnceWith("prompt");
  output.push("pending", 24);
  output.dispose();
  output.push("late", 8);
  vi.runAllTimers();
  expect(write).toHaveBeenCalledTimes(1);
});

it("acknowledges byte batches only after parsing, and fences disposed callbacks", () => {
  let parsed: (() => void) | undefined;
  const output = createTerminalOutputBuffer((_data, callback) => {
    parsed = callback;
  });
  const consumed = vi.fn();
  output.push(new Uint8Array([240, 159, 152, 128]), 0, consumed);
  expect(consumed).not.toHaveBeenCalled();
  parsed?.();
  expect(consumed).toHaveBeenCalledTimes(1);
  output.push("later", 0, consumed);
  output.dispose();
  parsed?.();
  expect(consumed).toHaveBeenCalledTimes(1);
});
