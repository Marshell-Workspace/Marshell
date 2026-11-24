import { afterEach, beforeEach, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: native.listen }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const savedSession = {
  session_id: "desktop",
  user_id: "saved-user",
  email: "saved@example.com",
};
let storage: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  native.invoke.mockReset().mockResolvedValue(null);
  native.listen.mockReset().mockResolvedValue(vi.fn());
  storage = new Map([["marshell_auth_session", JSON.stringify(savedSession)]]);
  vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("leaves the spinner within eight seconds when native session restoration never answers", async () => {
  native.invoke.mockImplementation(() => new Promise(() => {}));
  const { useAuthStore } = await import("./auth-store");
  const initialization = useAuthStore.getState().initAuth();
  await vi.advanceTimersByTimeAsync(8001);
  expect(useAuthStore.getState().isLoaded).toBe(true);
  await initialization;
  expect(useAuthStore.getState().session).toEqual(savedSession);
  expect(useAuthStore.getState().authError).toContain("timed out");
  expect(storage.get("marshell_auth_session")).toBe(
    JSON.stringify(savedSession)
  );
  expect(native.listen).not.toHaveBeenCalled();
});

it("bounds a stuck callback listener and allows a clean retry", async () => {
  native.listen.mockImplementationOnce(() => new Promise(() => {}));
  const { useAuthStore } = await import("./auth-store");
  const first = useAuthStore.getState().initAuth();
  const concurrent = useAuthStore.getState().initAuth();
  await vi.advanceTimersByTimeAsync(8001);
  expect(useAuthStore.getState().isLoaded).toBe(true);
  await Promise.all([first, concurrent]);
  expect(native.listen).toHaveBeenCalledTimes(1);
  await useAuthStore.getState().initAuth();
  expect(native.listen).toHaveBeenCalledTimes(3);
  expect(useAuthStore.getState().authError).toBeNull();
});

it("uses one deadline for session restoration and listener installation", async () => {
  native.invoke.mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve(null), 6000))
  );
  native.listen.mockImplementation(() => new Promise(() => {}));
  const { useAuthStore } = await import("./auth-store");
  const initialization = useAuthStore.getState().initAuth();
  await vi.advanceTimersByTimeAsync(7999);
  expect(useAuthStore.getState().isLoaded).toBe(false);
  await vi.advanceTimersByTimeAsync(2);
  expect(useAuthStore.getState().isLoaded).toBe(true);
  await initialization;
});

it("restores the native session on retry after an initial timeout without cached credentials", async () => {
  storage.clear();
  native.invoke.mockImplementationOnce(() => new Promise(() => {}));
  const { useAuthStore } = await import("./auth-store");
  const initialization = useAuthStore.getState().initAuth();
  await vi.advanceTimersByTimeAsync(8001);
  expect(useAuthStore.getState().isLoaded).toBe(true);
  await initialization;
  expect(useAuthStore.getState().session).toBeNull();
  native.invoke.mockResolvedValue(savedSession);
  await useAuthStore.getState().initAuth();
  expect(useAuthStore.getState().session).toEqual(savedSession);
  expect(useAuthStore.getState().authError).toBeNull();
});

it("removes partial and late listener registrations without accepting stale login callbacks", async () => {
  const stopSuccess = vi.fn();
  const stopLate = vi.fn();
  let finishLate: (stop: () => void) => void = () => {};
  let staleSuccess: (event: { payload: unknown }) => void = () => {};
  native.listen
    .mockImplementationOnce(async (_name, callback) => {
      staleSuccess = callback;
      return stopSuccess;
    })
    .mockImplementationOnce(
      () =>
        new Promise<() => void>((resolve) => {
          finishLate = resolve;
        })
    );
  const { useAuthStore } = await import("./auth-store");
  const initialization = useAuthStore.getState().initAuth();
  await vi.advanceTimersByTimeAsync(8001);
  expect(useAuthStore.getState().isLoaded).toBe(true);
  await initialization;
  expect(stopSuccess).toHaveBeenCalledOnce();
  finishLate(stopLate);
  await vi.advanceTimersByTimeAsync(1);
  expect(stopLate).toHaveBeenCalledOnce();
  staleSuccess({ payload: { ...savedSession, user_id: "stale-user" } });
  expect(useAuthStore.getState().session).toEqual(savedSession);
});
