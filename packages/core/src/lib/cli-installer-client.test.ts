import { afterEach, expect, it, vi } from "vitest";
import {
  checkAllCliAgents,
  invalidateCliCache,
} from "./cli-installer-client";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

afterEach(() => {
  invalidateCliCache();
  invoke.mockReset();
  vi.unstubAllGlobals();
});

it("reads real desktop statuses and bypasses the cache on refresh", async () => {
  vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  const detected = {
    agy: { id: "agy", status: "installed", commandName: "agy" },
    codex: { id: "codex", status: "not-installed" },
  };
  invoke.mockResolvedValueOnce(detected).mockResolvedValueOnce({
    ...detected,
    codex: { id: "codex", status: "installed" },
  });
  await expect(checkAllCliAgents()).resolves.toEqual(detected);
  await expect(checkAllCliAgents()).resolves.toEqual(detected);
  expect(invoke).toHaveBeenCalledExactlyOnceWith("check_all_cli_agents", {
    force: false,
  });
  await expect(checkAllCliAgents(true)).resolves.toMatchObject({
    codex: { status: "installed" },
  });
  expect(invoke).toHaveBeenLastCalledWith("check_all_cli_agents", {
    force: true,
  });
});

it("does not claim to detect local tools in a web browser", async () => {
  vi.stubGlobal("window", {});
  await expect(checkAllCliAgents()).resolves.toEqual({});
  expect(invoke).not.toHaveBeenCalled();
});
