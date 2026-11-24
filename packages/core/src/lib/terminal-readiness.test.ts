import { Terminal } from "@xterm/xterm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { terminalActivity, useTerminalIdleStore } from "./terminal-idle-store";
import {
  terminalScreenComposer,
  terminalScreenIsWorking,
  terminalScreenTail,
} from "./terminal-screen";

const terminals: Terminal[] = [];
afterEach(() => {
  for (const terminal of terminals.splice(0)) {
    terminal.dispose();
  }
  useTerminalIdleStore.setState({ terminals: {} });
  vi.useRealTimers();
});

async function render(output: string, cols = 80): Promise<Terminal> {
  const terminal = new Terminal({ cols, rows: 16, allowProposedApi: true });
  terminals.push(terminal);
  await new Promise<void>((resolve) => terminal.write(output, resolve));
  return terminal;
}

describe("rendered CLI composer readiness", () => {
  it("recognizes the reported Antigravity 1.5.12 Auto mode hint as empty input", async () => {
    const terminal = await render(
      `${[
        "Antigravity CLI 1.5.12",
        "Gemini 3.8 Flash (High)",
        "",
        "───────────────────────────────────────────────────────────────",
        "> Auto mode: edits & safe commands auto-approved (shift+tab...",
        "───────────────────────────────────────────────────────────────",
        "? for shortcuts                  auto · Gemini 3.8 Flash · high",
      ].join("\r\n")}\x1b[5;3H`,
      63
    );
    expect(terminalScreenComposer(terminal.buffer.active)).toBe("ready");
    await new Promise<void>((resolve) => terminal.write("\x1b[5;62H", resolve));
    expect(terminalScreenComposer(terminal.buffer.active)).toBe("draft");
  });

  it("recognizes a composer above an unfamiliar, wrapped model/footer", async () => {
    const terminal = await render(
      "\x1b[10;1H› \x1b[12;1HCustom model ultra · workspace\r\nconnection: connected\x1b[10;3H",
      30
    );
    const store = useTerminalIdleStore.getState();
    store.startSession("t", 1);
    const screen = terminalScreenTail(terminal.buffer.active);
    store.updateScreen(
      "t",
      screen,
      1,
      terminalScreenComposer(terminal.buffer.active)
    );
    expect(terminalActivity(useTerminalIdleStore.getState().terminals.t)).toBe(
      "ready"
    );
  });

  it("recognizes Claude's suggestion at the cursor but preserves the same text typed as a draft", async () => {
    const terminal = await render(
      'Claude Code\r\n────────\r\n❯ Try "fix typecheck errors"\r\n────────\r\n⏵⏵ auto mode on (shift+tab to cycle) · ← for agents\x1b[3;3H'
    );
    expect(terminalScreenComposer(terminal.buffer.active)).toBe("ready");
    await new Promise<void>((resolve) => terminal.write("\x1b[3;29H", resolve));
    expect(terminalScreenComposer(terminal.buffer.active)).toBe("draft");
  });

  it("keeps a wrapped or multiline pasted instruction a draft", async () => {
    const terminal = await render(
      "\x1b[6;1H❯ Implement the requested UI\r\n  Preserve this second line\x1b[9;1Hauto · model high\x1b[7;28H",
      40
    );
    expect(terminalScreenComposer(terminal.buffer.active)).toBe("draft");
  });

  it("does not mistake a typed Codex placeholder for an empty input", async () => {
    const terminal = await render("› Ask Codex to do anything\x1b[1;3H");
    expect(terminalScreenComposer(terminal.buffer.active)).toBe("ready");
    await new Promise<void>((resolve) => terminal.write("\x1b[1;27H", resolve));
    expect(terminalScreenComposer(terminal.buffer.active)).toBe("draft");
  });

  it("recognizes completion from fresh parsed readiness above an unfamiliar footer", async () => {
    const terminal = await render("Done\r\n› \r\ncustom footer\x1b[2;3H");
    vi.useFakeTimers();
    const store = useTerminalIdleStore.getState();
    store.startSession("t", 1);
    store.markBusy("t");
    store.ingest("t", "Done");
    store.updateScreen(
      "t",
      terminalScreenTail(terminal.buffer.active),
      1,
      terminalScreenComposer(terminal.buffer.active)
    );
    vi.advanceTimersByTime(3000);
    store.refreshIdleStatus();
    expect(terminalActivity(useTerminalIdleStore.getState().terminals.t)).toBe(
      "ready"
    );
  });

  it("does not make a running Claude turn ready because the empty composer is visible", async () => {
    const terminal = await render(
      "✻ Thinking… (2s · esc to interrupt)\r\n────────\r\n❯ \r\n────────\r\nmodel footer\x1b[3;3H"
    );
    const screen = terminalScreenTail(terminal.buffer.active);
    expect(terminalScreenIsWorking(screen)).toBe(true);
    const store = useTerminalIdleStore.getState();
    store.startSession("t", 1);
    store.updateScreen(
      "t",
      screen,
      1,
      terminalScreenComposer(terminal.buffer.active)
    );
    expect(terminalActivity(useTerminalIdleStore.getState().terminals.t)).toBe(
      "working"
    );
  });

  it("does not reuse cursor readiness from before assignment or a replaced session", async () => {
    const terminal = await render("› \x1b[4;1Hunknown footer\x1b[1;3H");
    const store = useTerminalIdleStore.getState();
    store.startSession("t", 1);
    store.updateScreen(
      "t",
      terminalScreenTail(terminal.buffer.active),
      1,
      terminalScreenComposer(terminal.buffer.active)
    );
    store.markBusy("t");
    store.updateScreen(
      "t",
      terminalScreenTail(terminal.buffer.active),
      1,
      "ready"
    );
    expect(terminalActivity(useTerminalIdleStore.getState().terminals.t)).toBe(
      "unconfirmed"
    );
    store.startSession("t", 2);
    store.updateScreen(
      "t",
      terminalScreenTail(terminal.buffer.active),
      1,
      "ready"
    );
    expect(terminalActivity(useTerminalIdleStore.getState().terminals.t)).toBe(
      "unobserved"
    );
  });
});
