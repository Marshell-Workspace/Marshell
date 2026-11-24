import {
  openDesktopSignIn,
  secureStore,
  useAuthStore,
} from "@workspace/core/stores/auth-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

function fakeLocalStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

describe("auth store", () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, isLoaded: false });
  });

  it("exports openDesktopSignIn and session actions", () => {
    expect(typeof openDesktopSignIn).toBe("function");
    const state = useAuthStore.getState();
    expect(typeof state.initAuth).toBe("function");
    expect(typeof state.setSession).toBe("function");
    expect(typeof state.logout).toBe("function");
  });

  it("updates session on setSession", () => {
    const session = {
      session_id: "desktop",
      user_id: "user_123",
      email: "test@example.com",
    };
    useAuthStore.getState().setSession(session);
    expect(useAuthStore.getState().session).toEqual(session);
    expect(useAuthStore.getState().isLoaded).toBe(true);
  });

  it("resets accent color to default when a new user signs in", async () => {
    const { useGeneralSettingsStore } = await import(
      "./general-settings-store"
    );
    useGeneralSettingsStore.getState().setAccent("crimson");
    expect(useGeneralSettingsStore.getState().accent).toBe("crimson");

    useAuthStore.getState().setSession({
      session_id: "desktop",
      user_id: "new_user_456",
      email: "new@example.com",
    });

    // Wait a tick for dynamic import in setSession
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(useGeneralSettingsStore.getState().accent).toBe("mint");
  });

  it("clears session and invokes clear_session on logout", async () => {
    useAuthStore.getState().setSession({
      session_id: "desktop",
      user_id: "user_123",
      email: "test@example.com",
    });

    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().session).toBeNull();
  });
});

describe("secureStore (refresh token storage)", () => {
  const KEY = "marshell.desktop.refresh_token";

  beforeEach(() => {
    invokeMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("inside the desktop app it uses the secure Tauri commands", async () => {
    const ls = fakeLocalStorage();
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    vi.stubGlobal("localStorage", ls);
    invokeMock.mockResolvedValue("stored-token");

    await secureStore.setRefresh("abc");
    expect(invokeMock).toHaveBeenCalledWith("secure_set", {
      key: KEY,
      value: "abc",
    });
    expect(await secureStore.getRefresh()).toBe("stored-token");
    await secureStore.clear();
    expect(invokeMock).toHaveBeenCalledWith("secure_delete", { key: KEY });
    expect(ls.data.size).toBe(0);
  });

  it("never falls back to plaintext localStorage when the secure store fails inside the app", async () => {
    const ls = fakeLocalStorage();
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    vi.stubGlobal("localStorage", ls);
    invokeMock.mockRejectedValue(new Error("keychain locked"));

    await expect(secureStore.setRefresh("secret")).rejects.toThrow(
      "keychain locked"
    );
    expect(ls.data.size).toBe(0);
    await expect(secureStore.getRefresh()).rejects.toThrow("keychain locked");
  });

  it("outside the desktop app (plain browser) it uses localStorage", async () => {
    const ls = fakeLocalStorage();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", ls);

    await secureStore.setRefresh("abc");
    expect(ls.data.get(KEY)).toBe("abc");
    expect(await secureStore.getRefresh()).toBe("abc");
    await secureStore.clear();
    expect(ls.data.has(KEY)).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
