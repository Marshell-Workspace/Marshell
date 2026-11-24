import {
  getSubmittedTerminalCliLogo,
  getTerminalCliLogoFromHistory,
  getTerminalCliLogoFromPrompt,
  getTerminalCliLogoId,
} from "@workspace/core/lib/terminal-cli-logo";
import { expect, it } from "vitest";

it.each([
  ["claude --dangerously-skip-permissions", "claude"],
  ["codex --yolo", "codex"],
  ["agy", "agy"],
  ["antigravity --help", "agy"],
  ["  CLAUDE.cmd --resume  ", "claude"],
  ['& "C:\\Program Files\\Claude\\claude.exe" --resume', "claude"],
  ["'/usr/local/bin/codex' --yolo", "codex"],
])("resolves the assigned CLI for %s", (command, expected) => {
  expect(getTerminalCliLogoId(command)).toBe(expected);
});

it.each([
  ["D:\\karm\\test>codex", "codex"],
  ["PS D:\\projects> claude --resume", "claude"],
  ["user@host:~/projects$ agy", "agy"],
  ["❯ claude", "claude"],
  ["D:\\projects>echo codex", null],
  ["Tell me about codex", null],
])("detects submitted shell commands in %s", (line, expected) => {
  expect(getTerminalCliLogoFromPrompt(line)).toBe(expected);
});

it("detects a history-recalled command wrapped across terminal lines", () => {
  const lines = [
    { isWrapped: false, translateToString: () => "D:\\projects>cl" },
    { isWrapped: true, translateToString: () => "aude --resume" },
  ];
  const buffer = {
    baseY: 0,
    cursorY: 1,
    getLine: (index: number) => lines[index],
  };
  expect(getSubmittedTerminalCliLogo(buffer, "\r")).toBe("claude");
  expect(getSubmittedTerminalCliLogo(buffer, "x")).toBeNull();
});

it("detects a pasted command only when it includes submission", () => {
  const buffer = {
    baseY: 0,
    cursorY: 0,
    getLine: () => ({
      isWrapped: false,
      translateToString: () => "D:\\projects>",
    }),
  };
  expect(getSubmittedTerminalCliLogo(buffer, "codex\r")).toBe("codex");
  expect(getSubmittedTerminalCliLogo(buffer, "codex")).toBeNull();
});

it("restores the last launched CLI without interpreting output mentions", () => {
  const history =
    "D:\\projects>claude\r\nOutput mentions codex\r\nD:\\projects>agy\r\nAntigravity CLI";
  expect(getTerminalCliLogoFromHistory(history)).toBe("agy");
});

it("updates a Codex launch to AGY from a wrapped PowerShell command", () => {
  const lines = [
    { isWrapped: false, translateToString: () => "PS D:\\projects> ag" },
    { isWrapped: true, translateToString: () => "y --mode=plan" },
  ];
  const buffer = {
    baseY: 0,
    cursorY: 1,
    getLine: (index: number) => lines[index],
  };
  const initialLogo = getTerminalCliLogoId("codex --yolo");
  expect(getSubmittedTerminalCliLogo(buffer, "\r") ?? initialLogo).toBe("agy");
  expect(
    getTerminalCliLogoFromHistory(
      "PS D:\\projects> codex --yolo\r\nPS D:\\projects> agy --mode=plan"
    )
  ).toBe("agy");
});

it.each([
  undefined,
  "",
  "powershell",
  "gemini --yolo",
  "echo claude",
  "cd D:/codex",
  "claude-backup",
])("does not assign a supported logo to %s", (command) => {
  expect(getTerminalCliLogoId(command)).toBeNull();
});
