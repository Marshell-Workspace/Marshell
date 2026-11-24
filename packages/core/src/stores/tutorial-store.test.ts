// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  TOUR_REGISTRY,
  type TourActionEvent,
  type TourId,
  useTutorialStore,
} from "./tutorial-store";
import { useWorkspaceStore } from "./workspace-store";

describe("tutorial-store state machine and tour registry", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    useWorkspaceStore.setState({ workspaces: [] });
    useTutorialStore.setState({
      activeTour: null,
      currentStepIndex: 0,
      machineState: "idle",
      isReplay: false,
      celebratingStep: false,
      skipConfirmOpen: false,
      isCreateWorkspaceDialogOpen: false,
      workspaceCreatedInTour: false,
      userTourStates: {},
    });
  });

  it("initializes with idle state and valid tour registries", () => {
    const state = useTutorialStore.getState();
    expect(state.machineState).toBe("idle");
    expect(state.activeTour).toBeNull();
    expect(TOUR_REGISTRY.onboarding).toHaveLength(11);
    expect(TOUR_REGISTRY.settings).toHaveLength(7);
  });

  it("reads default pending status for any new user id", () => {
    const record1 = useTutorialStore.getState().getTourRecord("user_abc");
    expect(record1.onboarding).toBe("pending");
    expect(record1.settings).toBe("pending");

    const record2 = useTutorialStore.getState().getTourRecord("user_xyz");
    expect(record2.onboarding).toBe("pending");
  });

  it("starts onboarding tour and respects single active tour constraint", () => {
    useTutorialStore.getState().startTour("onboarding", { userId: "user_1" });
    expect(useTutorialStore.getState().activeTour).toBe("onboarding");
    expect(useTutorialStore.getState().machineState).toBe("active");
    expect(useTutorialStore.getState().currentStepIndex).toBe(0);

    // Attempting to start another tour while active does not override
    useTutorialStore.getState().startTour("settings", { userId: "user_1" });
    expect(useTutorialStore.getState().activeTour).toBe("onboarding");
  });

  it("allows advancing through info steps with nextStep and prevStep", () => {
    useTutorialStore.getState().startTour("onboarding");
    expect(useTutorialStore.getState().currentStepIndex).toBe(0); // welcome (info)

    useTutorialStore.getState().nextStep();
    expect(useTutorialStore.getState().currentStepIndex).toBe(1); // sidebar (info)

    useTutorialStore.getState().prevStep();
    expect(useTutorialStore.getState().currentStepIndex).toBe(0);
  });

  it("gates action steps: nextStep does nothing on action steps", () => {
    useTutorialStore.getState().startTour("onboarding");
    useTutorialStore.getState().goToStep(2); // Step 2: create-workspace-btn (action, completeWhen: dialog-opened)

    const step = useTutorialStore.getState().getCurrentStep();
    expect(step?.type).toBe("action");
    expect(step?.completeWhen).toBe("dialog-opened");

    // Calling nextStep must NOT advance an action step!
    useTutorialStore.getState().nextStep();
    expect(useTutorialStore.getState().currentStepIndex).toBe(2);

    // Step only advances when real completeWhen event fires
    useTutorialStore.getState().fireAction("dialog-opened");
    expect(useTutorialStore.getState().currentStepIndex).toBe(3);
  });

  it("handles sequential action steps in onboarding flow", () => {
    document.body.innerHTML = `
      <input data-tour="workspace-name-input" value="Marshell Workspace" />
      <input id="ws-dir" value="C:\\Projects\\Marshell" />
    `;
    useTutorialStore.getState().startTour("onboarding");
    useTutorialStore.setState({
      isCreateWorkspaceDialogOpen: true,
      currentStepIndex: 3,
    }); // Workspace name (action: name-entered)

    useTutorialStore.getState().fireAction("name-entered");
    expect(useTutorialStore.getState().currentStepIndex).toBe(4); // Working directory (action: directory-selected)

    useTutorialStore.getState().fireAction("directory-selected");
    expect(useTutorialStore.getState().currentStepIndex).toBe(5); // Autorun command (info)
  });

  it("pauses tour when required panel is closed and resumes when requested", () => {
    useTutorialStore.getState().startTour("settings");
    expect(useTutorialStore.getState().machineState).toBe("active");

    useTutorialStore.getState().pauseTour();
    expect(useTutorialStore.getState().machineState).toBe("paused");

    useTutorialStore.getState().resumeTour();
    expect(useTutorialStore.getState().machineState).toBe("active");
  });

  it("marks tour skipped per user when skipped", () => {
    useTutorialStore
      .getState()
      .startTour("onboarding", { userId: "user_skip" });
    useTutorialStore.getState().skipTour("skipped", "user_skip");

    expect(useTutorialStore.getState().activeTour).toBeNull();
    expect(useTutorialStore.getState().machineState).toBe("skipped");

    const record = useTutorialStore.getState().getTourRecord("user_skip");
    expect(record.onboarding).toBe("skipped");
  });

  it("marks tour dismissedForever per user when user chooses Don't show again", () => {
    useTutorialStore
      .getState()
      .startTour("onboarding", { userId: "user_never" });
    useTutorialStore.getState().skipTour("dismissedForever", "user_never");

    const record = useTutorialStore.getState().getTourRecord("user_never");
    expect(record.onboarding).toBe("dismissedForever");
  });

  it("marks tour completed per user upon completion", () => {
    useTutorialStore.getState().startTour("settings", { userId: "user_done" });
    useTutorialStore.getState().completeTour("user_done");

    expect(useTutorialStore.getState().activeTour).toBeNull();
    expect(useTutorialStore.getState().machineState).toBe("completed");

    const record = useTutorialStore.getState().getTourRecord("user_done");
    expect(record.settings).toBe("completed");
  });

  it("replayTour runs without mutating existing completed or skipped user records", () => {
    // User already completed onboarding
    useTutorialStore
      .getState()
      .startTour("onboarding", { userId: "user_replay" });
    useTutorialStore.getState().completeTour("user_replay");

    expect(
      useTutorialStore.getState().getTourRecord("user_replay").onboarding
    ).toBe("completed");

    // Replay tour
    useTutorialStore.getState().replayTour("onboarding");
    expect(useTutorialStore.getState().activeTour).toBe("onboarding");
    expect(useTutorialStore.getState().isReplay).toBe(true);

    // Skip replay
    useTutorialStore.getState().skipTour("skipped", "user_replay");
    // Status must remain completed!
    expect(
      useTutorialStore.getState().getTourRecord("user_replay").onboarding
    ).toBe("completed");
  });

  it("supports array anchors and chapter eyebrows on onboarding steps", () => {
    const step3 = TOUR_REGISTRY.onboarding[2];
    expect(step3?.id).toBe("onboarding-create-btn");
    expect(Array.isArray(step3?.anchor)).toBe(true);
    expect(step3?.anchor).toContain("create-workspace-empty-cta");
    expect(step3?.anchor).toContain("create-workspace-btn");
    expect(step3?.chapter).toBe("SETUP");

    const welcomeStep = TOUR_REGISTRY.onboarding[0];
    expect(welcomeStep?.chapter).toBe("WELCOME");

    const doneStep = TOUR_REGISTRY.onboarding[10];
    expect(doneStep?.chapter).toBe("DONE");
  });

  it("handles childSurface state toggling cleanly", () => {
    expect(useTutorialStore.getState().childSurface).toBe(false);
    useTutorialStore.getState().setChildSurface(true);
    expect(useTutorialStore.getState().childSurface).toBe(true);
    useTutorialStore.getState().setChildSurface(false);
    expect(useTutorialStore.getState().childSurface).toBe(false);
  });

  it("advances Step 3 when setCreateWorkspaceDialogOpen(true) is invoked", () => {
    useTutorialStore.getState().startTour("onboarding");
    useTutorialStore.getState().goToStep(2); // Step 3: create-workspace-btn (index 2)
    expect(useTutorialStore.getState().currentStepIndex).toBe(2);

    useTutorialStore.getState().setCreateWorkspaceDialogOpen(true);
    expect(useTutorialStore.getState().currentStepIndex).toBe(3); // Advanced to Step 4: onboarding-ws-name
  });

  it("advances directly to Step 9 on workspace-created action and avoids Step 8 loop on resume", () => {
    useWorkspaceStore.setState({
      workspaces: [{ id: "test-ws", name: "Test WS", path: "/test" } as any],
    });
    useTutorialStore.getState().startTour("onboarding");
    useTutorialStore.setState({
      isCreateWorkspaceDialogOpen: true,
      currentStepIndex: 7,
    }); // onboarding-submit (index 7)
    expect(useTutorialStore.getState().currentStepIndex).toBe(7);

    // Simulate creating a NEW workspace during tour
    useWorkspaceStore.setState({
      workspaces: [
        { id: "test-ws", name: "Test WS", path: "/test" },
        { id: "new-ws", name: "New WS", path: "/new" },
      ] as any,
      activeWorkspaceId: "new-ws",
    });

    // Fire workspace-created
    useTutorialStore.getState().fireAction("workspace-created");
    expect(useTutorialStore.getState().workspaceCreatedInTour).toBe(true);
    expect(useTutorialStore.getState().currentStepIndex).toBe(8); // Directly at onboarding-notifications (index 8)

    // Simulating resumeTour while paused
    useTutorialStore.getState().pauseTour();
    expect(useTutorialStore.getState().machineState).toBe("paused");

    useTutorialStore.getState().resumeTour();
    expect(useTutorialStore.getState().machineState).toBe("active");
    expect(useTutorialStore.getState().currentStepIndex).toBe(8);

    // Prev step or goToStep backward into modal is blocked
    useTutorialStore.getState().prevStep();
    expect(useTutorialStore.getState().currentStepIndex).toBe(8);

    useTutorialStore.getState().goToStep(6);
    expect(useTutorialStore.getState().currentStepIndex).toBe(8);
  });

  it("handles workspace-created even if paused and forces Step 9 on resume", () => {
    useWorkspaceStore.setState({
      workspaces: [{ id: "test-ws", name: "Test WS", path: "/test" } as any],
    });
    useTutorialStore.getState().startTour("onboarding");
    useTutorialStore.setState({
      isCreateWorkspaceDialogOpen: true,
      currentStepIndex: 7,
    });
    useTutorialStore.getState().pauseTour();
    expect(useTutorialStore.getState().machineState).toBe("paused");

    // Simulate creating a NEW workspace during tour
    useWorkspaceStore.setState({
      workspaces: [
        { id: "test-ws", name: "Test WS", path: "/test" },
        { id: "new-ws", name: "New WS", path: "/new" },
      ] as any,
      activeWorkspaceId: "new-ws",
    });

    // Fire workspace-created while paused (e.g. from dialog close event race)
    useTutorialStore.getState().fireAction("workspace-created");
    useTutorialStore.getState().resumeTour();
    expect(useTutorialStore.getState().currentStepIndex).toBe(8);
    expect(useTutorialStore.getState().machineState).toBe("active");
  });

  it("allows prevStep navigation backward from Step 10 to 9 and between steps 5 and 4", () => {
    useTutorialStore.getState().startTour("onboarding");
    useTutorialStore.setState({
      isCreateWorkspaceDialogOpen: true,
      currentStepIndex: 4,
    }); // Step 5 (index 4)
    expect(useTutorialStore.getState().currentStepIndex).toBe(4);

    useTutorialStore.getState().prevStep();
    expect(useTutorialStore.getState().currentStepIndex).toBe(3); // Step 4 (index 3)

    // And from post-creation steps:
    useTutorialStore.setState({
      workspaceCreatedInTour: true,
      currentStepIndex: 9,
    }); // Step 10 (index 9)
    useTutorialStore.getState().prevStep();
    expect(useTutorialStore.getState().currentStepIndex).toBe(8); // Step 9 (index 8)

    // But from index 8, cannot enter modal (stay on 8)
    useTutorialStore.getState().prevStep();
    expect(useTutorialStore.getState().currentStepIndex).toBe(8);
  });

  it("advances cleanly from Step 5 to Step 6 without pausing, and resumes at current step when dialog is open", () => {
    useTutorialStore.getState().startTour("onboarding");
    useTutorialStore.setState({
      isCreateWorkspaceDialogOpen: true,
      currentStepIndex: 4, // Step 5: onboarding-ws-dir
      machineState: "active",
    });

    // Advance to Step 6 (onboarding-autorun)
    useTutorialStore.getState().enterActive(5, "nextStep");
    expect(useTutorialStore.getState().currentStepIndex).toBe(5);
    expect(useTutorialStore.getState().machineState).toBe("active");
    expect(useTutorialStore.getState().isCreateWorkspaceDialogOpen).toBe(true);

    // If paused with dialog open, resumeTour preserves Step 6
    useTutorialStore.getState().pauseTour();
    expect(useTutorialStore.getState().machineState).toBe("paused");

    useTutorialStore.getState().resumeTour();
    expect(useTutorialStore.getState().machineState).toBe("active");
    expect(useTutorialStore.getState().currentStepIndex).toBe(5); // Stays at Step 6, not reset to Step 2
  });

  it("post-creation steps enter active state without premature pause or snap back", () => {
    useWorkspaceStore.setState({
      workspaces: [{ id: "ws-1", name: "WS 1", path: "/test" } as any],
    });
    useTutorialStore.getState().startTour("onboarding");
    useTutorialStore.setState({
      workspaceCreatedInTour: true,
      isCreateWorkspaceDialogOpen: false,
    });

    // Enter index 8: onboarding-notifications
    useTutorialStore.getState().enterActive(8, "test");
    expect(useTutorialStore.getState().currentStepIndex).toBe(8);
    expect(useTutorialStore.getState().machineState).toBe("active");
    expect(useTutorialStore.getState().isBlocked).toBe(false);

    // Advance to index 9: onboarding-settings
    useTutorialStore.getState().nextStep();
    expect(useTutorialStore.getState().currentStepIndex).toBe(9);

    // Prev step back to index 8
    useTutorialStore.getState().prevStep();
    expect(useTutorialStore.getState().currentStepIndex).toBe(8);

    // Advance through the rest to completion
    useTutorialStore.getState().nextStep(); // 9: onboarding-settings
    expect(useTutorialStore.getState().currentStepIndex).toBe(9);
    useTutorialStore.getState().nextStep(); // 10: onboarding-complete
    expect(useTutorialStore.getState().currentStepIndex).toBe(10);
  });

  it("Settings tour traverses all 7 steps forward and backward", () => {
    useTutorialStore.getState().startTour("settings");
    expect(useTutorialStore.getState().activeTour).toBe("settings");
    expect(useTutorialStore.getState().currentStepIndex).toBe(0);

    // Traverse all steps forward
    for (let i = 0; i < 6; i++) {
      useTutorialStore.getState().nextStep();
      expect(useTutorialStore.getState().currentStepIndex).toBe(i + 1);
    }
    expect(useTutorialStore.getState().currentStepIndex).toBe(6);

    // Traverse all steps backward
    for (let i = 6; i > 0; i--) {
      useTutorialStore.getState().prevStep();
      expect(useTutorialStore.getState().currentStepIndex).toBe(i - 1);
    }
    expect(useTutorialStore.getState().currentStepIndex).toBe(0);

    // Complete tour from last step
    useTutorialStore.getState().goToStep(6);
    useTutorialStore.getState().completeTour();
    expect(useTutorialStore.getState().machineState).toBe("completed");
  });

  describe("Bug B3: strict gating and canAdvance", () => {
    it("step 2 (onboarding-create-btn) blocks nextStep, goToStep(+1), and wrong fireAction while dialog is closed", () => {
      useTutorialStore.getState().startTour("onboarding");
      useTutorialStore.getState().nextStep(); // step 0 -> step 1
      useTutorialStore.getState().nextStep(); // step 1 -> step 2 (onboarding-create-btn)
      expect(useTutorialStore.getState().currentStepIndex).toBe(2);

      // nextStep fails
      expect(useTutorialStore.getState().nextStep()).toBe(false);
      expect(useTutorialStore.getState().currentStepIndex).toBe(2);
      expect(useTutorialStore.getState().isBlocked).toBe(true);

      // goToStep(+1) fails
      expect(useTutorialStore.getState().goToStep(3)).toBe(false);
      expect(useTutorialStore.getState().currentStepIndex).toBe(2);

      // goToStep(+3) fails
      expect(useTutorialStore.getState().goToStep(5)).toBe(false);
      expect(useTutorialStore.getState().currentStepIndex).toBe(2);

      // fireAction with wrong event fails
      expect(useTutorialStore.getState().fireAction("name-entered")).toBe(
        false
      );
      expect(useTutorialStore.getState().currentStepIndex).toBe(2);

      // Succeeds after dialog is opened
      expect(useTutorialStore.getState().fireAction("dialog-opened")).toBe(
        true
      );
      expect(useTutorialStore.getState().currentStepIndex).toBe(3);
    });

    it("step 3 (onboarding-ws-name) blocks forward progress if input is empty", () => {
      useTutorialStore.getState().startTour("onboarding");
      useTutorialStore.setState({
        isCreateWorkspaceDialogOpen: true,
        currentStepIndex: 3,
      });

      // Create empty input in DOM
      document.body.innerHTML =
        '<input data-tour="workspace-name-input" value="   " />';

      expect(useTutorialStore.getState().nextStep()).toBe(false);
      expect(useTutorialStore.getState().goToStep(4)).toBe(false);
      expect(useTutorialStore.getState().goToStep(6)).toBe(false);
      expect(useTutorialStore.getState().canAdvance(3).ok).toBe(false);

      // Enter name
      const input = document.querySelector<HTMLInputElement>(
        '[data-tour="workspace-name-input"]'
      )!;
      input.value = "Marshell Test Workspace";

      expect(useTutorialStore.getState().canAdvance(3).ok).toBe(true);
      expect(useTutorialStore.getState().fireAction("name-entered")).toBe(true);
      expect(useTutorialStore.getState().currentStepIndex).toBe(4);
    });

    it("step 4 (onboarding-ws-dir) blocks forward progress if directory is empty", () => {
      useTutorialStore.getState().startTour("onboarding");
      useTutorialStore.setState({
        isCreateWorkspaceDialogOpen: true,
        currentStepIndex: 4,
      });

      // Create empty dir input in DOM
      document.body.innerHTML = '<input id="ws-dir" value="" />';

      expect(useTutorialStore.getState().nextStep()).toBe(false);
      expect(useTutorialStore.getState().goToStep(5)).toBe(false);
      expect(useTutorialStore.getState().goToStep(8)).toBe(false);
      expect(useTutorialStore.getState().canAdvance(4).ok).toBe(false);

      // Enter directory
      const input = document.querySelector<HTMLInputElement>("#ws-dir")!;
      input.value = "C:\\Projects\\Test";

      expect(useTutorialStore.getState().canAdvance(4).ok).toBe(true);
      expect(useTutorialStore.getState().fireAction("directory-selected")).toBe(
        true
      );
      expect(useTutorialStore.getState().currentStepIndex).toBe(5);
    });

    it("step 10 (onboarding-submit) blocks forward progress and Step 11 is unreachable before workspace creation", () => {
      useWorkspaceStore.setState({ workspaces: [] });
      useTutorialStore.getState().startTour("onboarding");
      useTutorialStore.setState({
        isCreateWorkspaceDialogOpen: true,
        currentStepIndex: 7, // step 8 (onboarding-submit)
        workspaceCreatedInTour: false,
      });

      // Attempting to advance via nextStep fails
      expect(useTutorialStore.getState().nextStep()).toBe(false);
      expect(useTutorialStore.getState().currentStepIndex).toBe(7);

      // Attempting to jump to step 8 (Notifications) fails
      expect(useTutorialStore.getState().goToStep(8)).toBe(false);
      expect(useTutorialStore.getState().currentStepIndex).toBe(7);

      // Attempting to jump to step 10 (Done) fails
      expect(useTutorialStore.getState().goToStep(10)).toBe(false);
      expect(useTutorialStore.getState().currentStepIndex).toBe(7);

      // fireAction workspace-created without workspaces in workspace-store fails
      expect(useTutorialStore.getState().fireAction("workspace-created")).toBe(
        false
      );
      expect(useTutorialStore.getState().currentStepIndex).toBe(7);

      // Once workspace exists and workspace-created fires, succeeds
      useWorkspaceStore.setState({
        workspaces: [{ id: "ws-1", name: "WS 1", path: "/test" } as any],
      });
      expect(useTutorialStore.getState().fireAction("workspace-created")).toBe(
        true
      );
      expect(useTutorialStore.getState().currentStepIndex).toBe(8); // Notifications step
      expect(useTutorialStore.getState().workspaceCreatedInTour).toBe(true);
    });

    it("resuming after closing create workspace dialog returns to onboarding-create-btn", () => {
      useWorkspaceStore.setState({ workspaces: [] });
      useTutorialStore.getState().startTour("onboarding");
      useTutorialStore.setState({
        isCreateWorkspaceDialogOpen: false,
        currentStepIndex: 6, // mid-dialog step
        workspaceCreatedInTour: false,
        machineState: "paused",
      });

      useTutorialStore.getState().resumeTour();
      expect(useTutorialStore.getState().currentStepIndex).toBe(2); // onboarding-create-btn
      expect(useTutorialStore.getState().machineState).toBe("active");
    });
  });

  describe("Bug 1: workspace baseline snapshot and step 10 gating", () => {
    it("rejects pre-existing workspaces and only satisfies step 10 when a new workspace is created", () => {
      // User already had a workspace before starting tour
      useWorkspaceStore.setState({
        workspaces: [
          { id: "existing-ws", name: "Existing", path: "/old" } as any,
        ],
        activeWorkspaceId: "existing-ws",
      });
      useTutorialStore.getState().startTour("onboarding");

      // Baseline recorded
      expect(useTutorialStore.getState().baselineWorkspaceIds).toContain(
        "existing-ws"
      );

      // Navigate to step 7 (onboarding-submit)
      useTutorialStore.setState({
        isCreateWorkspaceDialogOpen: true,
        currentStepIndex: 7,
        workspaceCreatedInTour: false,
      });

      // canAdvance fails because no new workspace exists
      const gateBefore = useTutorialStore.getState().canAdvance(7);
      expect(gateBefore.ok).toBe(false);

      // Firing workspace-created fails
      expect(useTutorialStore.getState().fireAction("workspace-created")).toBe(
        false
      );
      expect(useTutorialStore.getState().currentStepIndex).toBe(7);

      // User creates a NEW workspace
      useWorkspaceStore.setState({
        workspaces: [
          { id: "existing-ws", name: "Existing", path: "/old" },
          { id: "brand-new-ws", name: "Brand New", path: "/new" },
        ] as any,
        activeWorkspaceId: "brand-new-ws",
      });

      // Now firing workspace-created succeeds
      expect(useTutorialStore.getState().fireAction("workspace-created")).toBe(
        true
      );
      expect(useTutorialStore.getState().workspaceCreatedInTour).toBe(true);
      expect(useTutorialStore.getState().currentStepIndex).toBe(8);
      expect(useTutorialStore.getState().isCreateWorkspaceDialogOpen).toBe(
        false
      );
    });

    it("in replay mode, satisfies step 10 and closes the dialog on exit", () => {
      useWorkspaceStore.setState({
        workspaces: [
          { id: "existing-ws", name: "Existing", path: "/old" } as any,
        ],
      });
      useTutorialStore.getState().replayTour("onboarding");
      useTutorialStore.setState({
        isCreateWorkspaceDialogOpen: true,
        currentStepIndex: 7,
      });

      expect(useTutorialStore.getState().isReplay).toBe(true);
      expect(useTutorialStore.getState().canAdvance(7).ok).toBe(true);

      // Advance to step 8 (post-creation)
      useTutorialStore.getState().nextStep();
      expect(useTutorialStore.getState().currentStepIndex).toBe(8);
      expect(useTutorialStore.getState().isCreateWorkspaceDialogOpen).toBe(
        false
      );
    });

    it("self-heal closes dialog if store is at step 10+ of onboarding", () => {
      useTutorialStore.getState().startTour("onboarding");
      useTutorialStore.setState({
        workspaceCreatedInTour: true,
        currentStepIndex: 11,
        isCreateWorkspaceDialogOpen: true,
      });

      useTutorialStore.getState().checkSelfHeal();
      expect(useTutorialStore.getState().isCreateWorkspaceDialogOpen).toBe(
        false
      );
    });
  });

  describe("Bug 2: launchTour and chaining from completion", () => {
    it("cancels running tour cleanly when launchTour is called (single-tour guarantee)", () => {
      useTutorialStore.getState().startTour("onboarding");
      expect(useTutorialStore.getState().activeTour).toBe("onboarding");

      useTutorialStore.getState().launchTour("settings");
      expect(useTutorialStore.getState().activeTour).toBe("settings");
      expect(useTutorialStore.getState().machineState).toBe("active");
      expect(useTutorialStore.getState().currentStepIndex).toBe(0);

      useTutorialStore
        .getState()
        .launchTour("settings", { fromCompletion: true });
      expect(useTutorialStore.getState().activeTour).toBe("settings");
      expect(useTutorialStore.getState().launchedFromCompletion).toBe(true);
    });
  });

  describe("Bug 5: enterActive and pause/resume triggers", () => {
    it("enterActive resets transient flags, increments stepEpoch, and ensures required panel", () => {
      useTutorialStore.getState().startTour("settings");
      const epochBefore = useTutorialStore.getState().stepEpoch;

      useTutorialStore.setState({
        isBlocked: true,
        blockedReason: "Action required",
        celebratingStep: true,
        skipConfirmOpen: true,
      });

      useTutorialStore.getState().enterActive(2, "test");
      const state = useTutorialStore.getState();
      expect(state.currentStepIndex).toBe(2);
      expect(state.stepEpoch).toBeGreaterThan(epochBefore);
      expect(state.isBlocked).toBe(false);
      expect(state.blockedReason).toBeUndefined();
      expect(state.celebratingStep).toBe(false);
      expect(state.skipConfirmOpen).toBe(false);
      expect(state.machineState).toBe("active");
    });
  });

  describe("Bug 6: 5,000-step deterministic seeded fuzz test (Invariants I1-I9)", () => {
    function mulberry32(seed: number) {
      let a = seed;
      return () => {
        a += 0x6d_2b_79_f5;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
      };
    }

    it("verifies invariants I1-I9 across 5,000 random actions", () => {
      const rng = mulberry32(0xde_ad_be_ef);
      const tours: TourId[] = ["onboarding", "settings"];
      const events: TourActionEvent[] = [
        "dialog-opened",
        "name-entered",
        "directory-selected",
        "workspace-created",
        "fullscreen-toggled",
      ];

      for (let step = 0; step < 5000; step++) {
        const actionChoice = Math.floor(rng() * 14);

        switch (actionChoice) {
          case 0:
            useTutorialStore.getState().nextStep();
            break;
          case 1:
            useTutorialStore.getState().prevStep();
            break;
          case 2:
            useTutorialStore.getState().goToStep(Math.floor(rng() * 16));
            break;
          case 3:
            useTutorialStore
              .getState()
              .fireAction(events[Math.floor(rng() * events.length)]!);
            break;
          case 4:
            useTutorialStore.getState().pauseTour();
            break;
          case 5:
            useTutorialStore.getState().resumeTour();
            break;
          case 6:
            useTutorialStore.getState().interruptTour("fuzzInterrupt");
            break;
          case 7:
            useTutorialStore.getState().resumeFromInterrupt();
            break;
          case 8:
            useTutorialStore
              .getState()
              .startTour(tours[Math.floor(rng() * tours.length)]!);
            break;
          case 9:
            useTutorialStore
              .getState()
              .launchTour(tours[Math.floor(rng() * tours.length)]!, {
                fromCompletion: rng() > 0.5,
                isReplay: rng() > 0.5,
              });
            break;
          case 10:
            useTutorialStore
              .getState()
              .setCreateWorkspaceDialogOpen(rng() > 0.5);
            break;
          case 11:
            useTutorialStore.getState().checkSelfHeal();
            break;
          case 12: {
            // Add a new workspace
            const currentWs = useWorkspaceStore.getState().workspaces;
            const newId = `ws-${step}`;
            useWorkspaceStore.setState({
              workspaces: [
                ...currentWs,
                { id: newId, name: `WS ${step}`, path: `/${newId}` } as any,
              ],
              activeWorkspaceId: newId,
            });
            break;
          }
          case 13: {
            // Clear or mutate workspaces
            if (rng() > 0.7) {
              useWorkspaceStore.setState({ workspaces: [] });
            }
            break;
          }
          default:
            break;
        }

        // Check invariants I1 - I9 on every single step
        const s = useTutorialStore.getState();

        // I1: Valid activeTour
        expect(
          s.activeTour === null ||
            ["onboarding", "settings"].includes(s.activeTour)
        ).toBe(true);

        // I2: Clamped index
        if (s.activeTour) {
          const stepList = TOUR_REGISTRY[s.activeTour];
          expect(s.currentStepIndex).toBeGreaterThanOrEqual(0);
          expect(s.currentStepIndex).toBeLessThan(stepList.length);
        }

        // I3: Cannot pass step 7 in onboarding without workspace creation (non-replay)
        if (
          s.activeTour === "onboarding" &&
          !s.isReplay &&
          s.currentStepIndex > 7
        ) {
          expect(s.workspaceCreatedInTour).toBe(true);
        }

        // I4: Post-creation step index (>= 8) in onboarding never has dialog open
        if (s.activeTour === "onboarding" && s.currentStepIndex >= 8) {
          expect(s.isCreateWorkspaceDialogOpen).toBe(false);
        }

        // I5: If blocked, reason is non-empty string
        if (s.isBlocked) {
          expect(typeof s.blockedReason).toBe("string");
          expect(s.blockedReason!.length).toBeGreaterThan(0);
        }

        // I6: Machine state is valid
        const validStates = [
          "idle",
          "waitingForAnchor",
          "active",
          "paused",
          "interrupted",
          "completed",
          "skipped",
        ];
        expect(validStates.includes(s.machineState)).toBe(true);

        // I7: If workspace created in onboarding, step index is >= 8 (or celebrating)
        if (
          s.activeTour === "onboarding" &&
          s.workspaceCreatedInTour &&
          !s.celebratingStep
        ) {
          expect(s.currentStepIndex).toBeGreaterThanOrEqual(8);
        }

        // I8: In replay mode at step 8+, dialog is never open
        if (
          s.activeTour === "onboarding" &&
          s.isReplay &&
          s.currentStepIndex >= 8
        ) {
          expect(s.isCreateWorkspaceDialogOpen).toBe(false);
        }

        // I9: Finite integers for currentStepIndex and stepEpoch
        expect(Number.isInteger(s.currentStepIndex)).toBe(true);
        expect(Number.isInteger(s.stepEpoch)).toBe(true);
        expect(Number.isNaN(s.currentStepIndex)).toBe(false);
        expect(Number.isNaN(s.stepEpoch)).toBe(false);
      }
    }, 90_000);
  });
});
