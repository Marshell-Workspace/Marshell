import { usePreviewVerificationStore } from "@workspace/core/stores/preview-verification-store";
import { beforeEach, describe, expect, it } from "vitest";

describe("preview verification store", () => {
  beforeEach(() => {
    usePreviewVerificationStore.setState({ checks: {} });
  });

  it("starts a check as pending", () => {
    usePreviewVerificationStore.getState().requestCheck("ws1", "n1", 3000, "/");
    expect(usePreviewVerificationStore.getState().checks.ws1).toEqual({
      errors: [],
      loadedAt: null,
      nonce: "n1",
      path: "/",
      port: 3000,
      status: "pending",
      url: null,
    });
  });

  it("marks loaded and records the url", () => {
    usePreviewVerificationStore.getState().requestCheck("ws1", "n1", 3000, "/");
    usePreviewVerificationStore.getState().markLoaded("ws1", "n1", "http://x/");
    const check = usePreviewVerificationStore.getState().checks.ws1;
    expect(check?.status).toBe("loaded");
    expect(check?.url).toBe("http://x/");
  });

  it("collects multiple errors in order", () => {
    usePreviewVerificationStore.getState().requestCheck("ws1", "n1", 3000, "/");
    usePreviewVerificationStore
      .getState()
      .addError("ws1", "n1", { message: "a" });
    usePreviewVerificationStore
      .getState()
      .addError("ws1", "n1", { message: "b" });
    expect(usePreviewVerificationStore.getState().checks.ws1?.errors).toEqual([
      { message: "a" },
      { message: "b" },
    ]);
  });

  it("ignores a mutation whose nonce no longer matches (a stale, superseded request)", () => {
    usePreviewVerificationStore.getState().requestCheck("ws1", "n1", 3000, "/");
    usePreviewVerificationStore
      .getState()
      .requestCheck("ws1", "n2", 3000, "/other");
    usePreviewVerificationStore
      .getState()
      .markLoaded("ws1", "n1", "http://stale/");
    expect(usePreviewVerificationStore.getState().checks.ws1?.status).toBe(
      "pending"
    );
    expect(usePreviewVerificationStore.getState().checks.ws1?.nonce).toBe("n2");
  });

  it("does not downgrade a loaded check to timed out", () => {
    usePreviewVerificationStore.getState().requestCheck("ws1", "n1", 3000, "/");
    usePreviewVerificationStore.getState().markLoaded("ws1", "n1", "http://x/");
    usePreviewVerificationStore.getState().markTimedOut("ws1", "n1");
    expect(usePreviewVerificationStore.getState().checks.ws1?.status).toBe(
      "loaded"
    );
  });

  it("clear removes the check for that workspace", () => {
    usePreviewVerificationStore.getState().requestCheck("ws1", "n1", 3000, "/");
    usePreviewVerificationStore.getState().clear("ws1", "n1");
    expect(usePreviewVerificationStore.getState().checks.ws1).toBeUndefined();
  });

  it("scopes checks independently per workspace", () => {
    usePreviewVerificationStore.getState().requestCheck("ws1", "n1", 3000, "/");
    expect(usePreviewVerificationStore.getState().checks.ws2).toBeUndefined();
  });
});
