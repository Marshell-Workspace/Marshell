import { expect, it } from "vitest";
import { macTerminalKeySequence } from "./terminal-mac-keys";

const key = (
  name: string,
  mods: Partial<
    Record<"altKey" | "ctrlKey" | "metaKey" | "shiftKey", boolean>
  > = {},
  type = "keydown"
) => ({
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  key: name,
  type,
  ...mods,
});

it("maps Cmd and Option editing keys to readline sequences on macOS", () => {
  expect(
    macTerminalKeySequence(key("ArrowLeft", { metaKey: true }), true)
  ).toBe("\x01");
  expect(
    macTerminalKeySequence(key("ArrowRight", { metaKey: true }), true)
  ).toBe("\x05");
  expect(
    macTerminalKeySequence(key("Backspace", { metaKey: true }), true)
  ).toBe("\x15");
  expect(macTerminalKeySequence(key("ArrowLeft", { altKey: true }), true)).toBe(
    "\x1bb"
  );
  expect(
    macTerminalKeySequence(key("ArrowRight", { altKey: true }), true)
  ).toBe("\x1bf");
  expect(macTerminalKeySequence(key("Backspace", { altKey: true }), true)).toBe(
    "\x1b\x7f"
  );
});

it("leaves other platforms, key-ups, shifted selections and Ctrl chords alone", () => {
  expect(
    macTerminalKeySequence(key("ArrowLeft", { metaKey: true }), false)
  ).toBe(null);
  expect(
    macTerminalKeySequence(key("ArrowLeft", { metaKey: true }, "keyup"), true)
  ).toBe(null);
  expect(
    macTerminalKeySequence(
      key("ArrowLeft", { metaKey: true, shiftKey: true }),
      true
    )
  ).toBe(null);
  expect(
    macTerminalKeySequence(key("ArrowLeft", { ctrlKey: true }), true)
  ).toBe(null);
  expect(macTerminalKeySequence(key("a", { altKey: true }), true)).toBe(null);
});
