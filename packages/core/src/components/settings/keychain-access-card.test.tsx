// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { KeychainAccessCard } from "./keychain-access-card";

const native = vi.hoisted(() => ({ platform: "darwin", invoke: vi.fn() }));
vi.mock("@workspace/core/lib/desktop-client", () => ({
  getDesktopClient: async () => ({ platform: native.platform }),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
vi.mock("@workspace/i18n", () => ({
  useTranslations: () => (key: string) => key,
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  native.platform = "darwin";
  native.invoke.mockReset();
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});
it("never resets Keychain access on mount or focus and coalesces repeated retry clicks", async () => {
  let resolve!: () => void;
  native.invoke.mockReturnValue(
    new Promise<void>((done) => {
      resolve = done;
    })
  );
  const reset = vi.fn();
  await act(async () => root.render(<KeychainAccessCard onReset={reset} />));
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(native.invoke).not.toHaveBeenCalled();
  await act(async () => {
    host.querySelector("button")?.click();
    host.querySelector("button")?.click();
  });
  expect(native.invoke).toHaveBeenCalledExactlyOnceWith("secure_retry_access");
  await act(async () => {
    resolve();
  });
  expect(reset).toHaveBeenCalledOnce();
  expect(host.querySelector('[role="status"]')?.textContent).toBe("ready");
});
it("keeps reset errors visible without retrying automatically", async () => {
  native.invoke.mockRejectedValue(new Error("worker unavailable"));
  await act(async () => root.render(<KeychainAccessCard />));
  await act(async () => host.querySelector("button")?.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("failed");
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(native.invoke).toHaveBeenCalledOnce();
});
it("does not offer a macOS Keychain action in other platforms", async () => {
  native.platform = "windows";
  await act(async () => root.render(<KeychainAccessCard />));
  expect(host.textContent).toBe("");
  expect(native.invoke).not.toHaveBeenCalled();
});
