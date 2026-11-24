// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useTutorialStore } from "../../stores/tutorial-store";
import { TutorialsSettingsTab } from "./tutorials-settings-tab";

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("renders interactive walkthrough replay cards", async () => {
  await act(async () => root.render(<TutorialsSettingsTab />));
  expect(host.textContent).toContain("App Tour");
  expect(host.textContent).not.toContain("Main Agent Tour");
  expect(host.textContent).toContain("Settings Tour");
  expect(
    host.querySelector("[data-tour='settings-tutorials-section']")
  ).not.toBeNull();
});

it("triggers tour replay when tour button is clicked", async () => {
  const replaySpy = vi.spyOn(useTutorialStore.getState(), "replayTour");
  await act(async () => root.render(<TutorialsSettingsTab />));
  const buttons = host.querySelectorAll<HTMLButtonElement>("button");
  expect(buttons.length).toBeGreaterThanOrEqual(2);
  await act(async () => buttons[0]?.click());
  expect(replaySpy).toHaveBeenCalledWith("onboarding");
  await act(async () => buttons[1]?.click());
  expect(replaySpy).toHaveBeenCalledWith("settings");
  replaySpy.mockRestore();
});

it("triggers tour replay when entire card container is clicked", async () => {
  const replaySpy = vi.spyOn(useTutorialStore.getState(), "replayTour");
  await act(async () => root.render(<TutorialsSettingsTab />));
  const cardOnboarding = host.querySelector<HTMLElement>(
    '[data-tour-action="replay-onboarding"]'
  );
  const cardSettings = host.querySelector<HTMLElement>(
    '[data-tour-action="replay-settings"]'
  );

  expect(cardOnboarding).not.toBeNull();
  expect(cardSettings).not.toBeNull();

  await act(async () => cardOnboarding?.click());
  expect(replaySpy).toHaveBeenCalledWith("onboarding");

  await act(async () => cardSettings?.click());
  expect(replaySpy).toHaveBeenCalledWith("settings");

  replaySpy.mockRestore();
});
