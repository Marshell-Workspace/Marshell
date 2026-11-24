import { siteConfig } from "@workspace/core/config/site";
import { DEFAULT_ACCENT_ID } from "@workspace/core/lib/accent-colors";
import { getDesktopClient } from "@workspace/core/lib/desktop-client";
import { safeJsonParse } from "@workspace/core/lib/safe-json";
import { toast } from "sonner";
import { create } from "zustand";

export interface AuthSession {
  avatar?: string;
  email: string;
  name?: string;
  session_id: string;
  user_id: string;
  username?: string;
}

interface AuthState {
  authError: string | null;
  initAuth: () => Promise<void>;
  isLoaded: boolean;
  logout: () => Promise<void>;
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
}

const STORAGE_KEY = "marshell_auth_session";
const REFRESH_TOKEN_KEY = "marshell.desktop.refresh_token";
const PKCE_PENDING_KEY = "marshell_pkce_pending";

const isTauri = () =>
  typeof window !== "undefined" &&
  ("__TAURI__" in window ||
    "__TAURI_INTERNALS__" in window ||
    "__TAURI_POST_MESSAGE__" in window ||
    process.env.NEXT_PUBLIC_IS_NATIVE === "true");

const getWebOrigin = (): string => new URL(siteConfig.links.website).origin;

function isSecureStorageEnabled(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const raw = localStorage.getItem("marshell-general-settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.secureStorage === false) {
        return false;
      }
    }
  } catch {
    // Keep true on error
  }
  return true;
}

export const secureStore = {
  async clear(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }
    if (isTauri() && isSecureStorageEnabled()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("secure_delete", { key: REFRESH_TOKEN_KEY });
      return;
    }
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
  async getRefresh(): Promise<string | null> {
    if (typeof window === "undefined") {
      return null;
    }
    if (isTauri() && isSecureStorageEnabled()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return (
        (await invoke<string | null>("secure_get", {
          key: REFRESH_TOKEN_KEY,
        })) ?? null
      );
    }
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  async setRefresh(token: string): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }
    if (isTauri() && isSecureStorageEnabled()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("secure_set", { key: REFRESH_TOKEN_KEY, value: token });
      return;
    }
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },
};

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function createPkcePair(): Promise<{
  challenge: string;
  verifier: string;
}> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

let pendingPkce: { state: string; verifier: string } | null = null;

function savePendingPkce(
  value: { state: string; verifier: string } | null
): void {
  pendingPkce = value;
  if (typeof window !== "undefined") {
    try {
      if (value) {
        sessionStorage.setItem(PKCE_PENDING_KEY, JSON.stringify(value));
      } else {
        sessionStorage.removeItem(PKCE_PENDING_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }
}

function getPendingPkce(): { state: string; verifier: string } | null {
  if (pendingPkce) {
    return pendingPkce;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(PKCE_PENDING_KEY);
      if (raw) {
        return JSON.parse(raw) as { state: string; verifier: string };
      }
    } catch {
      // Ignore storage errors
    }
  }
  return null;
}

async function exchangeAuthCode(
  code: string,
  state: string
): Promise<{
  email: string;
  refresh_token?: string;
  userId: string;
} | null> {
  const pending = getPendingPkce();
  if (!pending || pending.state !== state) {
    return null;
  }
  savePendingPkce(null);
  const client = await getDesktopClient().catch(() => undefined);
  const endpoint = `${getWebOrigin()}/api/desktop/auth/token`;
  const payload = JSON.stringify({
    code,
    verifier: pending.verifier,
    ...(client ? { client } : {}),
  });

  let status = 0;
  let bodyText = "";
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const response = await invoke<{ body: string; status: number }>(
      "website_request",
      {
        url: endpoint,
        method: "POST",
        authorization: null,
        installationProof: null,
        body: payload,
      }
    );
    status = response.status;
    bodyText = response.body;
  } else {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    status = response.status;
    bodyText = await response.text();
  }

  const parsed = safeJsonParse<{
    error?: { message?: string };
    profile?: { email: string; userId: string };
    refresh_token?: string;
  }>(bodyText);

  if (status < 200 || status >= 300 || !parsed?.profile) {
    throw new Error(
      parsed?.error?.message ??
        "Authentication failed. Please try signing in again."
    );
  }
  if (parsed.refresh_token) {
    await secureStore.setRefresh(parsed.refresh_token).catch(() => {});
  }
  return {
    userId: parsed.profile.userId,
    email: parsed.profile.email,
    refresh_token: parsed.refresh_token,
  };
}

export async function openDesktopSignIn(): Promise<void> {
  await useAuthStore.getState().initAuth();
  const error = useAuthStore.getState().authError;
  if (error) {
    throw new Error(error);
  }
  let port = 8844;
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    port = await invoke<number>("get_auth_callback_port");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      "Invalid authentication callback port. Please restart Marshell."
    );
  }
  const { verifier, challenge } = await createPkcePair();
  const state = base64Url(crypto.getRandomValues(new Uint8Array(16)));
  savePendingPkce({ state, verifier });

  const url = new URL(`${getWebOrigin()}/auth/app-login`);
  url.searchParams.set("port", String(port));
  url.searchParams.set("challenge", challenge);
  url.searchParams.set("state", state);

  if (isTauri()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url.toString());
    } catch {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_browser", { url: url.toString() });
    }
  } else {
    window.open(url.toString(), "_blank", "noopener");
  }
}

let _authUnlistenFns: (() => void)[] = [];
let authInitialization: Promise<void> | null = null;
let sessionRevision = 0;
const AUTH_STARTUP_TIMEOUT_MS = 8000;

class AuthStartupTimeoutError extends Error {
  constructor() {
    super(
      "Marshell startup timed out while contacting the desktop app. Restart Marshell and try again."
    );
  }
}

function stopAuthListener(stop: () => void): void {
  try {
    Promise.resolve(stop()).catch(() => {});
  } catch {
    // Ignore cleanup errors
  }
}

function authStartupStep<T>(
  operation: () => Promise<T>,
  deadline: number,
  onLateResult?: (value: T) => void
): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    return Promise.reject(new AuthStartupTimeoutError());
  }
  return new Promise<T>((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(new AuthStartupTimeoutError());
    }, remaining);
    Promise.resolve()
      .then(operation)
      .then(
        (value) => {
          clearTimeout(timer);
          if (expired) {
            onLateResult?.(value);
          } else {
            resolve(value);
          }
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        }
      );
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  authError: null,
  session: null,
  isLoaded: false,

  setSession: (session) => {
    sessionRevision += 1;
    const prevSession = get().session;
    const isDifferentUser = Boolean(
      prevSession && session && prevSession.user_id !== session.user_id
    );

    if (isDifferentUser || !session) {
      savePendingPkce(null);
      secureStore.clear().catch(() => {});
    }

    const isNewUserSignIn = Boolean(
      session && (!prevSession || prevSession.user_id !== session.user_id)
    );
    if (isNewUserSignIn) {
      import("@workspace/core/stores/general-settings-store")
        .then(({ useGeneralSettingsStore }) => {
          useGeneralSettingsStore.getState().setAccent(DEFAULT_ACCENT_ID);
        })
        .catch(() => {});
    }

    set({
      session,
      authError: null,
      isLoaded: true,
    });
    if (typeof window !== "undefined") {
      if (session) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    if (isTauri()) {
      import("@tauri-apps/api/core")
        .then(({ invoke }) => {
          if (session) {
            invoke("save_session", { session }).catch(console.error);
          } else {
            invoke("clear_session").catch(console.error);
          }
        })
        .catch(() => {});
    }
  },

  logout: async () => {
    sessionRevision += 1;
    savePendingPkce(null);
    await secureStore.clear().catch(() => {});
    set({
      session: null,
      isLoaded: true,
      authError: null,
    });
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("clear_session");
      } catch (e) {
        console.error(e);
      }
    }
  },

  initAuth: async () => {
    if (typeof window === "undefined") {
      return;
    }

    if (authInitialization) {
      return await authInitialization;
    }
    if (get().isLoaded && (!isTauri() || _authUnlistenFns.length > 0)) {
      return;
    }
    const revision = sessionRevision;
    const deadline = Date.now() + AUTH_STARTUP_TIMEOUT_MS;
    set({ authError: null });
    authInitialization = (async () => {
      let savedSession: AuthSession | null = null;
      let restoredFromNative = false;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        savedSession = safeJsonParse<AuthSession>(stored);
      } catch (e) {
        console.error("Failed to parse saved session", e);
      }

      if (isTauri()) {
        try {
          const tauriSession = await authStartupStep(async () => {
            const { invoke } = await import("@tauri-apps/api/core");
            return await invoke<AuthSession | null>("get_session");
          }, deadline);
          if (tauriSession) {
            savedSession = tauriSession;
            restoredFromNative = true;
          }
        } catch (e) {
          if (e instanceof AuthStartupTimeoutError) {
            set({ authError: e.message });
          }
        }

        const provisionalListeners: (() => void)[] = [];
        let listenersCancelled = false;
        try {
          const { listen } = await authStartupStep(
            () => import("@tauri-apps/api/event"),
            deadline
          );

          if (_authUnlistenFns.length === 0) {
            const unlistenSuccess = await authStartupStep(
              () =>
                listen<AuthSession>("auth-success", (event) => {
                  if (!listenersCancelled) {
                    get().setSession(event.payload);
                  }
                }),
              deadline,
              stopAuthListener
            );
            provisionalListeners.push(unlistenSuccess);

            const unlistenCode = await authStartupStep(
              () =>
                listen<{ code: string; state: string }>(
                  "auth-code",
                  async (event) => {
                    if (listenersCancelled) {
                      return;
                    }
                    try {
                      const { code, state } = event.payload;
                      const profile = await exchangeAuthCode(code, state);
                      if (listenersCancelled || !profile) {
                        return;
                      }
                      const current = get().session;
                      get().setSession({
                        ...(current?.user_id === profile.userId ? current : {}),
                        session_id: "desktop",
                        user_id: profile.userId,
                        email: profile.email,
                      });
                    } catch (err) {
                      if (listenersCancelled) {
                        return;
                      }
                      const message =
                        err instanceof Error
                          ? err.message
                          : "Failed to sign in. Please try again.";
                      set({ authError: message });
                      toast.error(message);
                    }
                  }
                ),
              deadline,
              stopAuthListener
            );

            _authUnlistenFns = [unlistenSuccess, unlistenCode];
          }
        } catch (e) {
          listenersCancelled = true;
          for (const stop of provisionalListeners) {
            stopAuthListener(stop);
          }
          set({
            authError:
              e instanceof AuthStartupTimeoutError
                ? e.message
                : "Marshell could not listen for sign-in. Restart the app and try again.",
          });
        }
      }

      if (
        sessionRevision === revision &&
        (!get().isLoaded || restoredFromNative)
      ) {
        set({ session: savedSession, isLoaded: true });
      }
    })();
    try {
      await authInitialization;
    } finally {
      authInitialization = null;
    }
  },
}));
