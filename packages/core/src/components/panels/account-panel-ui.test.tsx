// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { type AuthSession, useAuthStore } from "../../stores/auth-store";
import { AccountPanelContent, buildGoogleAuthState } from "./account-panel";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@workspace/ui/components/dialog", () => {
  const Container = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <div>{children}</div> : null,
    DialogContent: Container,
    DialogHeader: Container,
    DialogTitle: Container,
    DialogDescription: Container,
    DialogFooter: Container,
  };
});
const session = {
  user_id: "user_1",
  session_id: "session_1",
  email: "me@example.com",
  name: "Me Example",
  username: "me",
  avatar: "https://example.com/photo.jpg",
};
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
let save: ReturnType<typeof vi.fn<(session: AuthSession | null) => void>>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  useAuthStore.setState({ session });
  save = vi.fn();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useAuthStore.setState({ session: null });
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () =>
    root.render(
      <AccountPanelContent
        authSession={session}
        googleAuthState={buildGoogleAuthState(session)}
        setSession={save}
      />
    )
  );
}
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find(
    (item) => item.textContent === text
  );
  expect(button).toBeDefined();
  await act(async () => button?.click());
}
async function fill(id: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`#${id}`);
  expect(input).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("keeps edits while typing and saves photo removal locally", async () => {
  await render();
  await fill("account-username", "new_handle");
  expect(host.querySelector<HTMLInputElement>("#account-username")?.value).toBe(
    "new_handle"
  );
  await click("Remove");
  await click("Save changes");
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ username: "new_handle", avatar: "" })
  );
  expect(localStorage.getItem("marshell_account_profile:user_1")).toContain(
    '"avatarUrl":""'
  );
});

it("shares the saved profile with the rest of the app", async () => {
  await render();
  await fill("account-username", "shared_handle");
  await click("Save changes");
  for (const key of [
    "marshell_account_profile",
    "marshell_account_profile:user_1",
  ]) {
    expect(JSON.parse(localStorage.getItem(key) ?? "{}").username).toBe(
      "shared_handle"
    );
  }
});

it("keeps a locally saved photo removal instead of the provider photo", async () => {
  localStorage.setItem(
    "marshell_account_profile:user_1",
    JSON.stringify({ avatarUrl: "", username: "saved_handle" })
  );
  await render();
  expect(
    [...host.querySelectorAll("button")].some(
      (item) => item.textContent === "Remove"
    )
  ).toBe(false);
  expect(host.querySelector<HTMLInputElement>("#account-username")?.value).toBe(
    "saved_handle"
  );
});

it("clears the shared profile on sign out so the next account does not inherit it", async () => {
  localStorage.setItem("marshell_account_profile", '{"displayName":"Me"}');
  useAuthStore.setState({ logout: vi.fn(async () => undefined) });
  await render();
  await click("Sign out this device");
  expect(localStorage.getItem("marshell_account_profile")).toBeNull();
});
