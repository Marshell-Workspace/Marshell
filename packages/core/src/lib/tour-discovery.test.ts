// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLayoutStore } from "../stores/layout-store";
import { usePanelStore } from "../stores/panel-store";
import { useTutorialStore } from "../stores/tutorial-store";
import { useWorkspaceStore } from "../stores/workspace-store";
import {
  auditTourCoverage,
  clearRegisteredSteps,
  discoverDomTourSteps,
  getRegisteredSteps,
  registerTourStep,
  resolveTourSteps,
} from "./tour-discovery";

describe("Tour dynamic discovery and registration system", () => {
  beforeEach(() => {
    clearRegisteredSteps();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  afterEach(() => {
    clearRegisteredSteps();
    document.body.innerHTML = "";
  });

  it("registers and retrieves programmatic tour steps", () => {
    registerTourStep({
      id: "feature-performance-mode",
      tourId: "settings",
      title: "Performance Mode",
      body: "Tune rendering performance settings.",
      order: 42,
      placement: "right",
    });

    const steps = getRegisteredSteps("settings");
    expect(steps).toHaveLength(1);
    expect(steps[0]?.id).toBe("feature-performance-mode");
    expect(steps[0]?.title).toBe("Performance Mode");
    expect(steps[0]?.order).toBe(42);
  });

  it("discovers tour steps declared on DOM elements via HTML data attributes", () => {
    const el = document.createElement("div");
    el.setAttribute("data-tour-section", "settings");
    el.setAttribute("data-tour-id", "settings-nav-performance");
    el.setAttribute("data-tour-title", "Performance");
    el.setAttribute("data-tour-description", "Tune hardware performance.");
    el.setAttribute("data-tour-order", "45");
    el.setAttribute("data-tour-tab", "performance");
    document.body.appendChild(el);

    const steps = discoverDomTourSteps("settings");
    expect(steps).toHaveLength(1);
    expect(steps[0]?.id).toBe("settings-nav-performance");
    expect(steps[0]?.title).toBe("Performance");
    expect(steps[0]?.order).toBe(45);
    expect(steps[0]?.uiState?.settingsTab).toBe("performance");
  });

  it("drops DOM elements that are unmounted or hidden", () => {
    const hiddenEl = document.createElement("div");
    hiddenEl.setAttribute("data-tour-section", "settings");
    hiddenEl.setAttribute("data-tour-id", "settings-hidden-feature");
    hiddenEl.setAttribute("data-tour-title", "Hidden");
    hiddenEl.setAttribute("data-tour-description", "Should not appear");
    hiddenEl.style.display = "none";
    document.body.appendChild(hiddenEl);

    const steps = discoverDomTourSteps("settings");
    expect(steps).toHaveLength(0);
  });

  it("merges baseline, programmatic, and DOM steps sorted by order", () => {
    const baseline = [
      {
        id: "step-1",
        title: "Step 1",
        body: "First",
        placement: "right" as const,
        type: "info" as const,
        anchor: "step-1",
        order: 10,
      },
      {
        id: "step-3",
        title: "Step 3",
        body: "Third",
        placement: "right" as const,
        type: "info" as const,
        anchor: "step-3",
        order: 30,
      },
    ];

    registerTourStep({
      id: "step-2",
      tourId: "settings",
      title: "Step 2",
      body: "Second",
      order: 20,
    });

    const domEl = document.createElement("div");
    domEl.setAttribute("data-tour-section", "settings");
    domEl.setAttribute("data-tour-id", "step-4");
    domEl.setAttribute("data-tour-title", "Step 4");
    domEl.setAttribute("data-tour-description", "Fourth");
    domEl.setAttribute("data-tour-order", "40");
    document.body.appendChild(domEl);

    const resolved = resolveTourSteps("settings", baseline);
    expect(resolved.map((s) => s.id)).toEqual([
      "step-1",
      "step-2",
      "step-3",
      "step-4",
    ]);
  });

  it("supports 'What\\'s new' mode by returning only unseen step IDs", () => {
    const baseline = [
      {
        id: "step-old-1",
        title: "Old 1",
        body: "Seen",
        placement: "right" as const,
        type: "info" as const,
        anchor: "old-1",
      },
      {
        id: "step-new-feature",
        title: "New Feature",
        body: "Unseen",
        placement: "right" as const,
        type: "info" as const,
        anchor: "new-feature",
      },
    ];

    const whatsNew = resolveTourSteps("settings", baseline, {
      whatsNewOnly: true,
      seenStepIds: ["step-old-1"],
    });

    expect(whatsNew).toHaveLength(1);
    expect(whatsNew[0]?.id).toBe("step-new-feature");
  });

  it("audits coverage and warns in development when an interactive section lacks tour metadata", () => {
    const navBtn = document.createElement("button");
    navBtn.setAttribute("data-settings-tab", "custom-tab");
    document.body.appendChild(navBtn);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const audit = auditTourCoverage("settings");

    expect(audit.missing).toContain("custom-tab");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("missing tour metadata")
    );
    warnSpy.mockRestore();
  });
});

describe("Tour state restoration on complete and skip", () => {
  beforeEach(() => {
    useTutorialStore.setState({
      activeTour: null,
      machineState: "idle",
      initialUiSnapshot: null,
    });
    useLayoutStore.setState({ isSidebarOpen: false });
    usePanelStore.setState({ isSettingsOpen: false, settingsTab: "general" });
  });

  it("restores original UI state when tour is completed", () => {
    useTutorialStore.setState({
      initialUiSnapshot: {
        isSettingsOpen: false,
        isSidebarOpen: false,
        settingsTab: "general",
        temporaryWorkspaceId: null,
      },
    });

    useLayoutStore.getState().setSidebarOpen(true);
    usePanelStore.getState().openSettings("appearance");

    useTutorialStore.getState().restoreUiState();

    expect(useLayoutStore.getState().isSidebarOpen).toBe(false);
    expect(usePanelStore.getState().isSettingsOpen).toBe(false);
  });

  it("cleans up temporary workspace created for the tour", () => {
    const tempId = "temp-tour-ws-test";
    useWorkspaceStore.getState().createWorkspace("Temp", 1);
    const createdWs = useWorkspaceStore
      .getState()
      .workspaces.find((w) => w.name === "Temp");
    const wsId = createdWs?.id || tempId;

    useTutorialStore.setState({
      initialUiSnapshot: {
        isSettingsOpen: false,
        isSidebarOpen: false,
        temporaryWorkspaceId: wsId,
      },
    });

    expect(
      useWorkspaceStore.getState().workspaces.some((w) => w.id === wsId)
    ).toBe(true);

    useTutorialStore.getState().restoreUiState();

    expect(
      useWorkspaceStore.getState().workspaces.some((w) => w.id === wsId)
    ).toBe(false);
  });
});
