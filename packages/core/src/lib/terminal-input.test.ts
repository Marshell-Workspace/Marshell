import { beforeEach, expect, it, vi } from "vitest";
import { sendTerminalInput } from "./terminal-input";

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));

beforeEach(() => {
  native.invoke.mockReset();
});

it("delivers input in call order even when earlier writes are slower", async () => {
  const delivered: string[] = [];
  native.invoke.mockImplementation(
    async (_command: string, args: { data: string }) => {
      // The first write is the slowest, as it would be on a busy blocking pool.
      await new Promise((resolve) =>
        setTimeout(resolve, args.data === "a" ? 20 : 1)
      );
      delivered.push(args.data);
    }
  );
  await Promise.all(
    ["a", "b", "c", "d"].map((key) => sendTerminalInput("order", key, 1))
  );
  expect(delivered).toEqual(["a", "b", "c", "d"]);
});

it("keeps later input flowing after an earlier write fails", async () => {
  native.invoke
    .mockRejectedValueOnce(new Error("pty closed"))
    .mockResolvedValue(undefined);
  const first = sendTerminalInput("recover", "x", 1);
  const second = sendTerminalInput("recover", "y", 1);
  await expect(first).rejects.toThrow("pty closed");
  await expect(second).resolves.toBeUndefined();
});

it("runs beforeSend in order and does not delay other terminals", async () => {
  const order: string[] = [];
  native.invoke.mockImplementation(
    async (_command: string, args: { id: string; data: string }) => {
      order.push(`${args.id}:${args.data}`);
    }
  );
  const slow = sendTerminalInput("one", "\r", 1, async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    order.push("drained");
  });
  const later = sendTerminalInput("one", "z", 1);
  const other = sendTerminalInput("two", "q", 1);
  await Promise.all([slow, later, other]);
  expect(order.indexOf("two:q")).toBeLessThan(order.indexOf("drained"));
  expect(order.slice(-3)).toEqual(["drained", "one:\r", "one:z"]);
});
