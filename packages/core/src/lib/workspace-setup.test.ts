import { expect, it } from "vitest";
import { AI_AGENTS_CATALOG } from "./cli-catalog";
import { isAgentAvailable, workspaceAgentCommand } from "./workspace-setup";

it("does not report an undetected agent as available", () => {
  expect(isAgentAvailable(undefined)).toBe(false);
});

it("accepts a detected installed agent", () => {
  expect(
    isAgentAvailable({ id: "codex", status: "installed", version: "1.0" })
  ).toBe(true);
});

it("rejects broken executables even if detection says installed", () => {
  expect(
    isAgentAvailable({
      id: "codex",
      status: "installed",
      version: "Cannot find module",
    })
  ).toBe(false);
});

it.each([
  "codex",
  "claude",
])("returns the direct command for %s without losing launch flags", (id) => {
  const agent = AI_AGENTS_CATALOG.find((item) => item.id === id);
  expect(agent).toBeDefined();
  if (!agent) {
    throw new Error(`Missing agent ${id}`);
  }
  expect(workspaceAgentCommand(agent, "direct")).toBe(agent.command);
});
