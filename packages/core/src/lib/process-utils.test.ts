import {
  appendLogs,
  filterLogLines,
  type LogLine,
  splitCommandLine,
} from "@workspace/core/lib/process-utils";
import { describe, expect, it } from "vitest";

const line = (seq: number, text: string): LogLine => ({
  seq,
  stream: "stdout",
  text,
});

describe("splitCommandLine", () => {
  it("splits on whitespace and honours quotes", () => {
    expect(splitCommandLine("pnpm dev --port 3010")).toEqual([
      "pnpm",
      "dev",
      "--port",
      "3010",
    ]);
    expect(splitCommandLine(`node -e "console.log('a b')"`)).toEqual([
      "node",
      "-e",
      "console.log('a b')",
    ]);
    expect(splitCommandLine(`echo "a\\"b" ''`)).toEqual(["echo", 'a"b', ""]);
    expect(splitCommandLine("   ")).toEqual([]);
  });
  it("rejects unterminated quotes", () => {
    expect(() => splitCommandLine('echo "oops')).toThrow("Unterminated");
  });
});

describe("filterLogLines", () => {
  const lines = [
    line(0, "Ready on :3000"),
    line(1, "ERROR boom"),
    line(2, "warn: slow"),
  ];
  it("matches substrings case-insensitively", () => {
    expect(
      filterLogLines(lines, "error", false).lines.map((l) => l.seq)
    ).toEqual([1]);
  });
  it("supports regex and reports invalid ones without dropping lines", () => {
    expect(
      filterLogLines(lines, "^(ready|warn)", true).lines.map((l) => l.seq)
    ).toEqual([0, 2]);
    const bad = filterLogLines(lines, "(", true);
    expect(bad.error).not.toBeNull();
    expect(bad.lines).toHaveLength(3);
  });
});

describe("appendLogs", () => {
  it("keeps only the newest lines", () => {
    const out = appendLogs([line(0, "a"), line(1, "b")], [line(2, "c")], 2);
    expect(out.map((l) => l.seq)).toEqual([1, 2]);
  });
});
