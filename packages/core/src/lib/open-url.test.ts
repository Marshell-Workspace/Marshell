import { afterEach, expect, it, vi } from "vitest";
import { openExternalUrl } from "./open-url";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(async () => {
    throw new Error("opener unavailable");
  }),
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => {
    throw new Error("browser unavailable");
  }),
}));
afterEach(() => vi.unstubAllGlobals());
it("reports a desktop browser failure instead of claiming checkout opened", async () => {
  vi.stubGlobal("window", { __TAURI_INTERNALS__: {}, open: vi.fn() });
  await expect(openExternalUrl("https://pay.example/checkout")).rejects.toThrow(
    /browser/i
  );
});
