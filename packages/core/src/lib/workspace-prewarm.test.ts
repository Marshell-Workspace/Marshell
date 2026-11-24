// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { onPrewarmWorkspace, prewarmWorkspace } from "./workspace-prewarm";

it("delivers a prewarm request to subscribers and stops after unsubscribe", () => {
  const listener = vi.fn();
  const off = onPrewarmWorkspace(listener);
  prewarmWorkspace("ws-1");
  expect(listener).toHaveBeenCalledWith("ws-1");
  off();
  prewarmWorkspace("ws-2");
  expect(listener).toHaveBeenCalledTimes(1);
});
