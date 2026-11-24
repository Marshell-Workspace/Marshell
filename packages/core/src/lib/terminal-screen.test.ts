import { expect, it } from "vitest";
import { terminalScreenIsWorking, terminalScreenTail } from "./terminal-screen";

it("reads the latest rendered rows rather than cursor escape fragments or a scrolled viewport", () => {
  const lines = [
    ...Array.from({ length: 45 }, (_, i) => `old ${i}`),
    "› [Pasted content 7524 chars]",
    "",
    "GPT-6-Astra medium · D:\\karm\\Voicela",
    "⚠ 2 warnings · f2 to view",
  ];
  const screen = terminalScreenTail({
    length: lines.length,
    getLine: (i) => ({ translateToString: () => lines[i]! }),
  });
  expect(screen).not.toContain("old 0\n");
  expect(screen).toContain("› [Pasted content 7524 chars]");
  expect(screen).toContain("⚠ 2 warnings · f2 to view");
});
it("distinguishes an active Codex turn from its still-visible empty composer", () => {
  expect(
    terminalScreenIsWorking(
      "• Working (12s • esc to interrupt)\n› \nGPT-6-Astra medium · D:\\work"
    )
  ).toBe(true);
  expect(
    terminalScreenIsWorking("Worked for 12s\n› \nGPT-6-Astra medium · D:\\work")
  ).toBe(false);
});
it("does not interpret a working indicator in scrollback as current activity", () => {
  const lines = [
    "• Working (12s • esc to interrupt)",
    "Old task output",
    "› Ask Codex to do anything",
    "GPT-6-Astra medium · D:\\work",
    "← for agents ⚠ 1 warning · f2 to view",
  ];
  const screen = terminalScreenTail({
    baseY: 2,
    length: lines.length,
    getLine: (i) => ({ translateToString: () => lines[i]! }),
  });
  expect(screen).not.toContain("Working");
  expect(terminalScreenIsWorking(screen)).toBe(false);
});
