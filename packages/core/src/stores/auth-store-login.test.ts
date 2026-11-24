import { useAuthStore } from "@workspace/core/stores/auth-store";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("restores a saved session on startup", async () => {
  vi.stubGlobal("window", {});
  const saved = storage();
  saved.setItem(
    "marshell_auth_session",
    JSON.stringify({
      session_id: "desktop",
      user_id: "user_1",
      email: "me@example.com",
    })
  );
  vi.stubGlobal("localStorage", saved);
  useAuthStore.setState({ session: null, isLoaded: false, authError: null });
  await useAuthStore.getState().initAuth();
  expect(useAuthStore.getState().session?.user_id).toBe("user_1");
  expect(useAuthStore.getState().isLoaded).toBe(true);
});

it("keeps one callback listener across concurrent initialization and returning focus", async () => {
  vi.stubGlobal("window", { __TAURI_INTERNALS__: { invoke: mocks.invoke } });
  const local = storage();
  const sess = storage();
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", sess);
  const callbacks = new Map<
    string,
    (event: { payload: unknown }) => Promise<void>
  >();
  mocks.invoke.mockImplementation(async (name: string) => {
    if (name === "website_request") {
      return {
        status: 200,
        body: JSON.stringify({
          profile: { userId: "user_1", email: "me@example.com" },
        }),
      };
    }
    return null;
  });
  mocks.listen.mockImplementation(async (name, callback) => {
    callbacks.set(name, callback);
    return vi.fn();
  });
  useAuthStore.setState({ session: null, isLoaded: false, authError: null });
  await Promise.all([
    useAuthStore.getState().initAuth(),
    useAuthStore.getState().initAuth(),
  ]);
  expect(mocks.listen).toHaveBeenCalledTimes(2);
  expect(
    mocks.invoke.mock.calls.filter(([name]) => name === "get_session")
  ).toHaveLength(1);

  await useAuthStore.getState().initAuth();
  expect(mocks.listen).toHaveBeenCalledTimes(2);
  sess.setItem(
    "marshell_pkce_pending",
    JSON.stringify({ state: "state", verifier: "verifier" })
  );
  await callbacks.get("auth-code")?.({
    payload: { code: "code", state: "state" },
  });
  expect(useAuthStore.getState().session?.user_id).toBe("user_1");
  await useAuthStore.getState().initAuth();
  expect(useAuthStore.getState().session?.user_id).toBe("user_1");
  expect(mocks.listen).toHaveBeenCalledTimes(2);

  useAuthStore.setState({ session: null, isLoaded: false });
  let resolveSaved: (session: null) => void = () => {};
  mocks.invoke.mockImplementation((name) =>
    name === "get_session"
      ? new Promise<null>((resolve) => {
          resolveSaved = resolve;
        })
      : Promise.resolve(null)
  );
  const initialization = useAuthStore.getState().initAuth();
  await vi.waitFor(() =>
    expect(
      mocks.invoke.mock.calls.filter(([name]) => name === "get_session")
    ).toHaveLength(2)
  );
  useAuthStore.getState().setSession({
    session_id: "desktop",
    user_id: "user_2",
    email: "new@example.com",
  });
  resolveSaved(null);
  await initialization;
  expect(useAuthStore.getState().session?.user_id).toBe("user_2");

  mocks.invoke.mockImplementation(async (name: string) => {
    if (name === "website_request") {
      return {
        status: 200,
        body: JSON.stringify({
          profile: { userId: "user_1", email: "me@example.com" },
        }),
      };
    }
    return null;
  });
  sess.setItem(
    "marshell_pkce_pending",
    JSON.stringify({ state: "state", verifier: "verifier" })
  );
  await callbacks.get("auth-code")?.({
    payload: { code: "code", state: "state" },
  });
  expect(useAuthStore.getState().session?.user_id).toBe("user_1");

  mocks.invoke.mockRejectedValue(new Error("Token service unavailable"));
  sess.setItem(
    "marshell_pkce_pending",
    JSON.stringify({ state: "state", verifier: "verifier" })
  );
  await callbacks.get("auth-code")?.({
    payload: { code: "bad", state: "state" },
  });
  expect(useAuthStore.getState().authError).toBe("Token service unavailable");
});
