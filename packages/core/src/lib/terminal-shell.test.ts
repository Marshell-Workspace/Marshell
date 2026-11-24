import { expect, it } from "vitest";
import {
  clearScreenInput,
  getTerminalShellKind,
  parseTerminalShellKind,
  setTerminalShellKind,
  taskExitSuffix,
  terminalShellLabel,
} from "./terminal-shell";

it("clears with the key the shell understands and never types into a line editor", () => {
  expect(clearScreenInput("cmd")).toBe("cls\r");
  for (const kind of [
    "powershell",
    "bash",
    "zsh",
    "fish",
    "gitbash",
    "sh",
  ] as const) {
    expect(clearScreenInput(kind)).toBe("\x0c");
  }
});

it("builds an exit-status marker in each shell's own syntax", () => {
  expect(taskExitSuffix("cmd", "t1")).toBe(
    " & call echo TASK_FINISHED_t1_%^errorlevel%"
  );
  expect(taskExitSuffix("powershell", "t1")).toContain("$LASTEXITCODE");
  expect(taskExitSuffix("fish", "t1")).toContain("$status");
  expect(taskExitSuffix("gitbash", "t1")).toBe("; echo TASK_FINISHED_t1_$?");
  expect(taskExitSuffix(undefined, "t1")).toContain("$?");
});

it("labels the effective shell and remembers it per terminal", () => {
  expect(terminalShellLabel("cmd")).toBe("Command Prompt");
  expect(parseTerminalShellKind("zsh")).toBe("zsh");
  expect(parseTerminalShellKind("nope")).toBeUndefined();
  setTerminalShellKind("a", "cmd");
  expect(getTerminalShellKind("a")).toBe("cmd");
  setTerminalShellKind("a", undefined);
  expect(getTerminalShellKind("a")).toBeUndefined();
});
