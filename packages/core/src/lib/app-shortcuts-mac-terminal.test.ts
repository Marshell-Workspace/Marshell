// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { isApplicationShortcut } from "./app-shortcuts";

function keyDownOn(
  target: Element,
  init: { key: string; ctrlKey?: boolean; metaKey?: boolean }
) {
  const event = new KeyboardEvent("keydown", { bubbles: true, ...init });
  Object.defineProperty(event, "target", { value: target });
  return event;
}

function terminalTextarea() {
  const host = document.createElement("div");
  host.className = "xterm";
  const textarea = document.createElement("textarea");
  host.append(textarea);
  document.body.append(host);
  return textarea;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

it("leaves Ctrl chords to the shell on macOS but keeps Cmd for the app", () => {
  vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "Mac" });
  const textarea = terminalTextarea();
  for (const key of ["b", "k", "n", "1"]) {
    expect(
      isApplicationShortcut(keyDownOn(textarea, { key, ctrlKey: true }))
    ).toBe(false);
    expect(
      isApplicationShortcut(keyDownOn(textarea, { key, metaKey: true }))
    ).toBe(true);
  }
});

it("keeps Ctrl application shortcuts on Windows and Linux", () => {
  vi.stubGlobal("navigator", { platform: "Win32", userAgent: "Windows" });
  const textarea = terminalTextarea();
  expect(
    isApplicationShortcut(keyDownOn(textarea, { key: "b", ctrlKey: true }))
  ).toBe(true);
});
