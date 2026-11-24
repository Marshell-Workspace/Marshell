import { expect, it, vi } from "vitest";
import { registerOwnedTerminal } from "./terminal-registration";

it("uses the owning workspace and undoes registration resolved after disposal", async () => {
  let disposed = false;
  let release = () => {};
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const register = vi.fn(async () => {
    await ready;
  });
  const unregister = vi.fn();
  const registration = registerOwnedTerminal("terminal-A", "workspace-A", {
    register,
    unregister,
    isDisposed: () => disposed,
  });
  expect(register).toHaveBeenCalledWith("terminal-A", "workspace-A");
  disposed = true;
  release();
  expect(await registration).toBe(false);
  expect(unregister).toHaveBeenCalledWith("terminal-A");
});
