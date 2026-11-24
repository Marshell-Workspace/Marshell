// @vitest-environment jsdom

import { getSubmittedTerminalCliLogo } from "@workspace/core/lib/terminal-cli-logo";
import { expect, it, vi } from "vitest";

it("detects AGY after pending xterm output has been parsed", async () => {
  // This test exercises the parser without attaching a canvas renderer.
  const canvasContext = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(null);
  const { Terminal } = await import("@xterm/xterm");
  const terminal = new Terminal({ cols: 80, rows: 24 });
  try {
    terminal.write("PS D:\\projects> agy --mode=plan");
    expect(
      getSubmittedTerminalCliLogo(terminal.buffer.active, "\r")
    ).toBeNull();

    await new Promise<void>((resolve) => terminal.write("", resolve));

    expect(getSubmittedTerminalCliLogo(terminal.buffer.active, "\r")).toBe(
      "agy"
    );
  } finally {
    terminal.dispose();
    canvasContext.mockRestore();
  }
});
