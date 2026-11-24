// @vitest-environment jsdom
import { messages, NextIntlClientProvider } from "@workspace/i18n";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "../../stores/workspace-store";
import { FirstTaskGuide } from "./first-task-guide";

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(id: string) {
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={messages.en}>
        <FirstTaskGuide key={id} workspaceId={id} />
      </NextIntlClientProvider>
    )
  );
}
it("takes a new user to tasks and review", async () => {
  useWorkspaceStore.setState({
    workspaces: [
      { id: "one", name: "one", createdAt: 0, terminalCount: 1, panes: [] },
    ],
  });
  await render("one");
  expect(document.querySelector("[role=dialog]")).not.toBeNull();

  let buttons = [...document.querySelectorAll("button")];
  await act(async () =>
    buttons.find((b) => b.textContent === "Open Tasks")?.click()
  );
  expect(useWorkspaceStore.getState().activeView).toBe("board");

  localStorage.removeItem("marshell-first-task-guide-dismissed");
  await render("review");
  buttons = [...document.querySelectorAll("button")];
  await act(async () =>
    buttons.find((b) => b.textContent === "Review Changes")?.click()
  );
  expect(useWorkspaceStore.getState().activeView).toBe("changes");
}, 15_000);

it("only shows guide once globally and does not show again for subsequent workspaces", async () => {
  useWorkspaceStore.setState({
    workspaces: [
      { id: "one", name: "one", createdAt: 0, terminalCount: 1, panes: [] },
    ],
  });
  await render("one");
  expect(document.querySelector("[role=dialog]")).not.toBeNull();
  await act(async () =>
    (
      document.querySelector(
        '[aria-label="Dismiss guide"]'
      ) as HTMLButtonElement
    ).click()
  );
  expect(localStorage.getItem("marshell-first-task-guide-dismissed")).toBe(
    "dismissed"
  );
  await render("two");
  expect(document.querySelector("[role=dialog]")).toBeNull();
});

it("does not show guide if user already has more than 1 workspace", async () => {
  useWorkspaceStore.setState({
    workspaces: [
      { id: "one", name: "one", createdAt: 0, terminalCount: 1, panes: [] },
      { id: "two", name: "two", createdAt: 0, terminalCount: 1, panes: [] },
    ],
  });
  await render("two");
  expect(document.querySelector("[role=dialog]")).toBeNull();
});
