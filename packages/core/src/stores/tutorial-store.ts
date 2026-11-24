"use client";

import { safeJsonParse } from "@workspace/core/lib/safe-json";
import { resolveTourSteps } from "@workspace/core/lib/tour-discovery";
import { useLayoutStore } from "@workspace/core/stores/layout-store";
import {
  type SettingsTab,
  usePanelStore,
} from "@workspace/core/stores/panel-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import { create } from "zustand";
import { playWorkspaceCreatedSound } from "../components/common/tour/sound";

export type TourId = "onboarding" | "settings";

export type TourMachineState =
  | "idle"
  | "waitingForAnchor"
  | "active"
  | "paused"
  | "interrupted"
  | "completed"
  | "skipped";

export type TourStatus =
  | "pending"
  | "started"
  | "completed"
  | "skipped"
  | "dismissedForever";

export type TourStepType = "info" | "action";
export type TourStepPlacement = "top" | "bottom" | "left" | "right" | "center";

export type TourRequiredPanel = "settings-panel" | "create-workspace-dialog";

export type TourActionEvent =
  | "dialog-opened"
  | "name-entered"
  | "directory-selected"
  | "workspace-created"
  | "fullscreen-toggled";

export interface CanAdvanceResult {
  ok: boolean;
  reason?: string;
}

export interface TourStepUiState {
  ensureWorkspace?: boolean;
  settingsOpen?: boolean;
  settingsTab?: SettingsTab;
}

export interface TourUiSnapshot {
  isSettingsOpen: boolean;
  isSidebarOpen: boolean;
  settingsTab?: SettingsTab;
  temporaryWorkspaceId?: string | null;
}

export interface TourStep {
  actionHint?: string;
  anchor: string | string[] | null;
  avoid?: string[];
  body: string;
  chapter?: string;
  completeWhen?: TourActionEvent;
  ensure?: () => void;
  id: string;
  isDynamic?: boolean;
  isSatisfied?: () => boolean;
  keepClear?: string[];
  onExit?: () => void;
  optional?: boolean;
  order?: number;
  placement: TourStepPlacement;
  requires?: TourRequiredPanel;
  title: string;
  type: TourStepType;
  uiState?: TourStepUiState;
}

export interface UserTourRecord {
  lastStepId?: string;
  onboarding: TourStatus;
  onboardingShownAt?: number;
  seenStepIds?: string[];
  settings: TourStatus;
  settingsShownAt?: number;
  version: number;
}

const STORAGE_KEY = "marshell_tour_state_v4";

export const ONBOARDING_STEPS: TourStep[] = [
  {
    id: "onboarding-welcome",
    anchor: null,
    placement: "center",
    type: "info",
    chapter: "WELCOME",
    title: "Welcome to Marshell",
    body: "Your terminal workspace and task command center.",
  },
  {
    id: "onboarding-sidebar",
    anchor: "sidebar",
    placement: "right",
    type: "info",
    chapter: "SETUP",
    ensure: () => {
      useLayoutStore.getState().setSidebarOpen(true);
    },
    title: "Your workspaces",
    body: "Everything you build lives here, one workspace per project.",
  },
  {
    id: "onboarding-create-btn",
    anchor: ["create-workspace-empty-cta", "create-workspace-btn"],
    placement: "right",
    type: "action",
    chapter: "SETUP",
    completeWhen: "dialog-opened",
    ensure: () => {
      useLayoutStore.getState().setSidebarOpen(true);
      useTutorialStore.getState().snapshotBaselineWorkspaces();
    },
    isSatisfied: () => {
      if (useTutorialStore.getState().isCreateWorkspaceDialogOpen) {
        return true;
      }
      if (typeof document !== "undefined") {
        return Boolean(
          document.querySelector('[data-slot="dialog-content"]') ||
            document.querySelector('[data-tour="workspace-name-input"]')
        );
      }
      return false;
    },
    actionHint: "Click Create Workspace to begin",
    title: "New workspace",
    body: "Start a workspace to organize your code, terminals, and agents.",
  },
  {
    id: "onboarding-ws-name",
    anchor: "workspace-name-input",
    placement: "right",
    type: "action",
    chapter: "SETUP",
    completeWhen: "name-entered",
    requires: "create-workspace-dialog",
    isSatisfied: () => {
      if (typeof document === "undefined") {
        return false;
      }
      const el = document.querySelector<HTMLInputElement>(
        '[data-tour="workspace-name-input"]'
      );
      return Boolean(el?.value && el.value.trim().length > 0);
    },
    actionHint: "Edit the name, then press Next",
    title: "Workspace name",
    body: "Name your project or keep the suggestion to continue.",
    keepClear: ["workspace-dir-input"],
    avoid: ["workspace-ai-agents-list"],
  },
  {
    id: "onboarding-ws-dir",
    anchor: "workspace-dir-input",
    placement: "right",
    type: "action",
    chapter: "SETUP",
    completeWhen: "directory-selected",
    requires: "create-workspace-dialog",
    isSatisfied: () => {
      if (typeof document === "undefined") {
        return false;
      }
      const el =
        document.querySelector<HTMLInputElement>("#ws-dir") ||
        document.querySelector<HTMLInputElement>(
          '[data-tour="workspace-dir-input"] input'
        ) ||
        document.querySelector<HTMLInputElement>(
          '[data-tour="workspace-dir-input"]'
        );
      return Boolean(el?.value && el.value.trim().length > 0);
    },
    actionHint: "Click Browse or a recent folder",
    title: "Project folder",
    body: "Select the local directory where your project files live.",
  },
  {
    id: "onboarding-autorun",
    anchor: "autorun-input",
    placement: "right",
    type: "info",
    chapter: "SETUP",
    optional: true,
    requires: "create-workspace-dialog",
    title: "Startup command",
    body: "Optionally run a development command when this workspace opens.",
  },
  {
    id: "onboarding-terminal-layout",
    anchor: "layout-selector",
    placement: "right",
    type: "info",
    chapter: "SETUP",
    requires: "create-workspace-dialog",
    title: "Terminal layout",
    body: "Choose how many terminals open across your workspace grid.",
  },
  {
    id: "onboarding-submit",
    anchor: "submit-workspace-btn",
    placement: "top",
    type: "action",
    chapter: "SETUP",
    completeWhen: "workspace-created",
    requires: "create-workspace-dialog",
    isSatisfied: () => {
      const state = useTutorialStore.getState();
      if (state.isReplay) {
        return true;
      }
      if (typeof window === "undefined") {
        return Boolean(state.workspaceCreatedInTour);
      }
      const wsStore = useWorkspaceStore.getState();
      const hasNewWorkspace = wsStore.workspaces.some(
        (w) => !state.baselineWorkspaceIds.includes(w.id)
      );
      return Boolean(state.workspaceCreatedInTour && hasNewWorkspace);
    },
    actionHint: "Click Create Workspace to launch",
    title: "Create workspace",
    body: "Launch your new workspace to initialize the terminal grid.",
    keepClear: ["workspace-cancel-btn"],
    onExit: () => {
      useTutorialStore.getState().setCreateWorkspaceDialogOpen(false);
    },
  },
  {
    id: "onboarding-notifications",
    anchor: "notifications-btn",
    placement: "bottom",
    type: "info",
    chapter: "EXPLORE",
    ensure: () => {
      useTutorialStore.getState().setCreateWorkspaceDialogOpen(false);
    },
    title: "Activity feed",
    body: "Review workspace alerts and notification updates.",
  },
  {
    id: "onboarding-settings",
    anchor: "sidebar-settings-btn",
    placement: "right",
    type: "info",
    chapter: "EXPLORE",
    title: "Preferences",
    body: "Configure your appearance, shortcuts, and workspace preferences.",
  },
  {
    id: "onboarding-complete",
    anchor: null,
    placement: "center",
    type: "info",
    chapter: "DONE",
    title: "You're set.",
    body: "Your command center is ready. Start building with your terminal workspaces and tasks.",
  },
];

export const SETTINGS_STEPS: TourStep[] = [
  {
    id: "settings-overview",
    anchor: "settings-nav",
    placement: "right",
    type: "info",
    requires: "settings-panel",
    ensure: () => {
      usePanelStore.getState().openSettings("account");
    },
    title: "Settings overview",
    body: "Browse account preferences, appearance, workspaces, notifications, and system health.",
  },
  {
    id: "settings-search",
    anchor: "settings-search-input",
    placement: "right",
    type: "info",
    requires: "settings-panel",
    title: "Search preferences",
    body: "Quickly filter settings sections, workspace options, and shortcuts.",
  },
  {
    id: "settings-account-nav",
    anchor: "settings-nav-account",
    placement: "right",
    type: "info",
    requires: "settings-panel",
    title: "Account & Profile",
    body: "Manage your user profile and session preferences.",
  },
  {
    id: "settings-appearance-nav",
    anchor: "settings-nav-appearance",
    placement: "right",
    type: "info",
    requires: "settings-panel",
    title: "Appearance & Themes",
    body: "Configure themes, OKLCh presets, and custom accent colors.",
  },
  {
    id: "settings-performance-nav",
    anchor: "settings-nav-performance",
    placement: "right",
    type: "info",
    requires: "settings-panel",
    title: "Performance & Battery",
    body: "Manage hardware acceleration, background throttling, and GPU mode.",
  },
  {
    id: "settings-system-nav",
    anchor: "settings-nav-system",
    placement: "right",
    type: "info",
    requires: "settings-panel",
    title: "System health",
    body: "Inspect WebView runtime, PTY bridges, and diagnostics.",
  },
  {
    id: "settings-tutorials-section",
    anchor: "settings-tutorials-section",
    placement: "top",
    type: "info",
    requires: "settings-panel",
    ensure: () => {
      usePanelStore.getState().setSettingsTab("tutorials");
    },
    title: "Interactive tutorials",
    body: "Replay any walkthrough anytime from this dedicated section.",
  },
];

export const TOUR_REGISTRY: Record<TourId, TourStep[]> = {
  onboarding: ONBOARDING_STEPS,
  settings: SETTINGS_STEPS,
};

function loadStoredTourStates(): Record<string, UserTourRecord> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? safeJsonParse<Record<string, UserTourRecord>>(raw) || {} : {};
  } catch {
    return {};
  }
}

function persistTourStates(states: Record<string, UserTourRecord>): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch {
    // ignore quota error
  }
}

interface TourStoreState {
  // Active state
  activeSteps: TourStep[];
  activeTour: TourId | null;
  baselineWorkspaceIds: string[];
  blockedReason?: string;
  canAdvance: (stepIndex?: number) => CanAdvanceResult;
  celebratingStep: boolean;
  checkSelfHeal: () => void;
  childSurface: boolean;
  clearBlocked: () => void;
  completeTour: (userId?: string) => void;
  currentStepIndex: number;
  enterActive: (stepIndex?: number, reason?: string) => void;
  fireAction: (event: TourActionEvent) => boolean;
  getCurrentStep: () => TourStep | null;
  getTourRecord: (userId?: string) => UserTourRecord;
  getWhatsNewSteps: (tourId: TourId, userId?: string) => TourStep[];
  goToStep: (index: number) => boolean;
  initialUiSnapshot: TourUiSnapshot | null;
  interruptedReason: string | null;
  interruptTour: (reason: string) => void;
  isBlocked: boolean;
  isCreateWorkspaceDialogOpen: boolean;
  isReplay: boolean;
  launchedFromCompletion: boolean;
  launchTour: (
    tourId: TourId,
    options?: {
      fromCompletion?: boolean;
      isReplay?: boolean;
      stepIndex?: number;
      userId?: string;
      whatsNewOnly?: boolean;
    }
  ) => void;
  machineState: TourMachineState;
  markStepSeen: (stepId: string, userId?: string) => void;
  nextStep: () => boolean;
  pauseTour: () => void;
  prevStep: () => void;
  replayTour: (tourId: TourId) => void;
  resolveResumeStep: (tourId: TourId) => number;
  restoreUiState: () => void;
  resumeFromInterrupt: () => void;
  resumeTour: () => void;
  setChildSurface: (active: boolean) => void;
  setCreateWorkspaceDialogOpen: (open: boolean) => void;
  setMachineState: (state: TourMachineState) => void;
  setSkipConfirmOpen: (open: boolean) => void;
  skipConfirmOpen: boolean;
  skipTour: (reason: "skipped" | "dismissedForever", userId?: string) => void;
  snapshotBaselineWorkspaces: () => void;
  startTour: (
    tourId: TourId,
    options?: {
      isReplay?: boolean;
      stepIndex?: number;
      userId?: string;
      whatsNewOnly?: boolean;
    }
  ) => void;
  startWhatsNewTour: (tourId: TourId, options?: { userId?: string }) => boolean;
  stepEpoch: number;
  userTourStates: Record<string, UserTourRecord>;
  workspaceCreatedInTour: boolean;
}

export function getStepsForStore(state: {
  activeSteps: TourStep[];
  activeTour: TourId | null;
}): TourStep[] {
  if (state.activeSteps && state.activeSteps.length > 0) {
    return state.activeSteps;
  }
  return state.activeTour ? (TOUR_REGISTRY[state.activeTour] ?? []) : [];
}

export const useTutorialStore = create<TourStoreState>((set, get) => {
  const initialRecords = loadStoredTourStates();

  return {
    machineState: "idle",
    activeTour: null,
    activeSteps: [],
    initialUiSnapshot: null,
    currentStepIndex: 0,
    isReplay: false,
    celebratingStep: false,
    skipConfirmOpen: false,
    childSurface: false,
    interruptedReason: null,
    workspaceCreatedInTour: false,
    isCreateWorkspaceDialogOpen: false,
    baselineWorkspaceIds: [],
    launchedFromCompletion: false,
    stepEpoch: 0,
    isBlocked: false,
    blockedReason: undefined,
    userTourStates: initialRecords,

    snapshotBaselineWorkspaces: () => {
      const ws =
        typeof window === "undefined"
          ? []
          : useWorkspaceStore.getState().workspaces;
      set({ baselineWorkspaceIds: ws.map((w) => w.id) });
    },

    checkSelfHeal: () => {
      const state = get();
      const {
        activeTour,
        currentStepIndex,
        workspaceCreatedInTour,
        isReplay,
        isCreateWorkspaceDialogOpen,
      } = state;
      if (!activeTour) {
        return;
      }

      const steps = getStepsForStore(state);
      if (currentStepIndex < 0 || currentStepIndex >= steps.length) {
        const safeIndex = Math.max(
          0,
          Math.min(currentStepIndex, steps.length - 1)
        );
        set({ currentStepIndex: safeIndex });
      }

      if (activeTour === "onboarding") {
        // If post-dialog step (>= 8), dialog must NEVER stay open
        if (currentStepIndex >= 8 && isCreateWorkspaceDialogOpen) {
          set({ isCreateWorkspaceDialogOpen: false });
        }

        // If at step >= 8 without creating a workspace (and not replay), snap back to step 7 (onboarding-submit)
        const hasExistingWorkspaces =
          typeof window !== "undefined" &&
          useWorkspaceStore.getState().workspaces.length > 0;
        if (
          currentStepIndex >= 8 &&
          !workspaceCreatedInTour &&
          !isReplay &&
          !hasExistingWorkspaces
        ) {
          set({
            currentStepIndex: 7,
            isCreateWorkspaceDialogOpen: true,
            isBlocked: true,
            blockedReason: "Click Create Workspace to launch",
          });
        }
      }
    },

    clearBlocked: () => {
      set({ isBlocked: false, blockedReason: undefined });
    },

    canAdvance: (stepIndex?: number): CanAdvanceResult => {
      const state = get();
      const { activeTour, currentStepIndex } = state;
      if (!activeTour) {
        return { ok: false, reason: "No active tour" };
      }
      const idx = stepIndex ?? currentStepIndex;
      const steps = getStepsForStore(state);
      const step = steps[idx];
      if (!step) {
        return { ok: false, reason: "Step not found" };
      }

      // Info steps can advance unconditionally
      if (step.type === "info") {
        return { ok: true };
      }

      // Gated action/input steps evaluate LIVE app state
      if (step.id === "onboarding-create-btn") {
        const isDialogOpen =
          state.isCreateWorkspaceDialogOpen ||
          (typeof document !== "undefined" &&
            Boolean(
              document.querySelector('[data-slot="dialog-content"]') ||
                document.querySelector('[data-tour="workspace-name-input"]')
            ));
        if (!isDialogOpen) {
          return {
            ok: false,
            reason: step.actionHint || "Click Create Workspace to begin",
          };
        }
        return { ok: true };
      }

      if (step.id === "onboarding-ws-name") {
        if (typeof document !== "undefined") {
          const el = document.querySelector<HTMLInputElement>(
            '[data-tour="workspace-name-input"]'
          );
          const hasName = Boolean(el?.value && el.value.trim().length > 0);
          if (!hasName) {
            return {
              ok: false,
              reason: step.actionHint || "Edit the name, then press Next",
            };
          }
        }
        return { ok: true };
      }

      if (step.id === "onboarding-ws-dir") {
        if (typeof document !== "undefined") {
          const el =
            document.querySelector<HTMLInputElement>("#ws-dir") ||
            document.querySelector<HTMLInputElement>(
              '[data-tour="workspace-dir-input"] input'
            ) ||
            document.querySelector<HTMLInputElement>(
              '[data-tour="workspace-dir-input"]'
            );
          const hasDir = Boolean(el?.value && el.value.trim().length > 0);
          if (!hasDir) {
            return {
              ok: false,
              reason: step.actionHint || "Click Browse or a recent folder",
            };
          }
        }
        return { ok: true };
      }

      if (step.id === "onboarding-submit") {
        if (state.isReplay) {
          return { ok: true };
        }
        const wsStore =
          typeof window === "undefined"
            ? { workspaces: [], activeWorkspaceId: null }
            : useWorkspaceStore.getState();
        const hasNewWorkspace = wsStore.workspaces.some(
          (w) => !state.baselineWorkspaceIds.includes(w.id)
        );
        const created = state.workspaceCreatedInTour && hasNewWorkspace;
        if (!created) {
          // Check validation of inputs to provide exact missing copy
          if (typeof document !== "undefined") {
            const nameEl = document.querySelector<HTMLInputElement>(
              '[data-tour="workspace-name-input"]'
            );
            if (!nameEl?.value?.trim()) {
              return { ok: false, reason: "Edit the name, then press Next" };
            }
            const dirEl =
              document.querySelector<HTMLInputElement>("#ws-dir") ||
              document.querySelector<HTMLInputElement>(
                '[data-tour="workspace-dir-input"] input'
              ) ||
              document.querySelector<HTMLInputElement>(
                '[data-tour="workspace-dir-input"]'
              );
            if (!dirEl?.value?.trim()) {
              return { ok: false, reason: "Click Browse or a recent folder" };
            }
          }
          return {
            ok: false,
            reason: step.actionHint || "Click Create Workspace to launch",
          };
        }
        return { ok: true };
      }

      // General action steps: check isSatisfied() if defined
      if (step.isSatisfied) {
        const satisfied = step.isSatisfied();
        if (!satisfied) {
          return {
            ok: false,
            reason: step.actionHint || "Perform action to continue",
          };
        }
      }

      return { ok: true };
    },

    resolveResumeStep: (tourId: TourId): number => {
      const state = get();
      const steps =
        state.activeSteps.length > 0
          ? state.activeSteps
          : (TOUR_REGISTRY[tourId] ?? []);
      if (!steps || steps.length === 0) {
        return 0;
      }
      if (tourId === "onboarding" && state.workspaceCreatedInTour) {
        const notifyIndex = steps.findIndex(
          (s) => s.id === "onboarding-notifications"
        );
        const startIndex = notifyIndex >= 0 ? notifyIndex : 0;
        for (let i = startIndex; i < steps.length; i++) {
          const step = steps[i];
          if (step && (step.type === "action" || step.completeWhen)) {
            const gate = state.canAdvance(i);
            if (!gate.ok) {
              return i;
            }
          }
        }
        return startIndex;
      }
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step && (step.type === "action" || step.completeWhen)) {
          const gate = state.canAdvance(i);
          if (!gate.ok) {
            return i;
          }
        }
      }
      return 0;
    },

    getTourRecord: (userId?: string): UserTourRecord => {
      const id = userId?.trim() || "guest_default";
      const existing = get().userTourStates[id];
      if (existing) {
        return existing;
      }
      return {
        onboarding: "pending",
        settings: "pending",
        version: 1,
      };
    },

    getCurrentStep: (): TourStep | null => {
      const state = get();
      const { activeTour, currentStepIndex } = state;
      if (!activeTour) {
        return null;
      }
      const steps = getStepsForStore(state);
      return steps[currentStepIndex] ?? null;
    },

    setMachineState: (machineState: TourMachineState) => {
      set({ machineState });
    },

    setSkipConfirmOpen: (skipConfirmOpen: boolean) => {
      set({ skipConfirmOpen });
    },

    setCreateWorkspaceDialogOpen: (open: boolean) => {
      const { activeTour, currentStepIndex, workspaceCreatedInTour } = get();
      if (
        activeTour === "onboarding" &&
        workspaceCreatedInTour &&
        currentStepIndex >= 8 &&
        open
      ) {
        return;
      }

      set({ isCreateWorkspaceDialogOpen: open });
      if (open) {
        get().fireAction("dialog-opened");
      } else {
        const step = get().getCurrentStep();
        if (
          step?.requires === "create-workspace-dialog" &&
          get().machineState === "active" &&
          !workspaceCreatedInTour
        ) {
          get().pauseTour();
        }
      }
    },

    enterActive: (stepIndex?: number, _reason?: string) => {
      const state = get();
      const activeTour = state.activeTour;
      if (!activeTour) {
        return;
      }
      const steps = getStepsForStore(state);
      const targetIndex = Math.min(
        Math.max(0, stepIndex ?? state.currentStepIndex),
        steps.length - 1
      );
      const targetStep = steps[targetIndex];

      if (
        targetStep?.requires === "settings-panel" ||
        targetStep?.uiState?.settingsOpen ||
        activeTour === "settings"
      ) {
        const tab = targetStep?.uiState?.settingsTab ?? "account";
        if (!usePanelStore.getState().isSettingsOpen) {
          usePanelStore.getState().openSettings(tab);
        } else if (targetStep?.uiState?.settingsTab) {
          usePanelStore
            .getState()
            .setSettingsTab(targetStep.uiState.settingsTab);
        }
      } else if (
        targetStep?.requires === "create-workspace-dialog" &&
        !state.workspaceCreatedInTour
      ) {
        set({ isCreateWorkspaceDialogOpen: true });
      }

      set({
        machineState: "active",
        currentStepIndex: targetIndex,
        stepEpoch: (state.stepEpoch ?? 0) + 1,
        interruptedReason: null,
        isBlocked: false,
        blockedReason: undefined,
        celebratingStep: false,
        skipConfirmOpen: false,
      });

      if (targetStep?.id) {
        get().markStepSeen(targetStep.id);
      }

      if (targetStep?.ensure) {
        try {
          targetStep.ensure();
        } catch {
          // ignore
        }
      }

      get().checkSelfHeal();
    },

    launchTour: (tourId, options) => {
      const state = get();
      const { activeTour, machineState } = state;

      const initialSnapshot: TourUiSnapshot = {
        isSettingsOpen: usePanelStore.getState().isSettingsOpen,
        isSidebarOpen: useLayoutStore.getState().isSidebarOpen,
        settingsTab: usePanelStore.getState().settingsTab,
        temporaryWorkspaceId: null,
      };

      // Single-tour guarantee: if another tour is running, dismiss cleanly
      if (
        activeTour &&
        (machineState === "active" ||
          machineState === "paused" ||
          machineState === "interrupted")
      ) {
        const curr = state.getCurrentStep();
        if (curr?.onExit) {
          try {
            curr.onExit();
          } catch {
            // ignore
          }
        }
      }

      const baselineSteps = TOUR_REGISTRY[tourId] ?? [];
      const userId = options?.userId?.trim() || "guest_default";
      const userRecord = state.getTourRecord(userId);

      const resolved = resolveTourSteps(tourId, baselineSteps, {
        whatsNewOnly: options?.whatsNewOnly,
        seenStepIds: userRecord.seenStepIds,
      });

      if (!resolved || resolved.length === 0) {
        return;
      }

      const tempWsId: string | null = null;
      if (tourId === "settings") {
        usePanelStore.getState().openSettings("account");
      } else if (
        tourId === "onboarding" &&
        usePanelStore.getState().isSettingsOpen
      ) {
        usePanelStore.getState().closeSettings();
      }

      const startIndex = Math.min(
        Math.max(0, options?.stepIndex ?? 0),
        resolved.length - 1
      );

      const isReplay = options?.isReplay ?? false;
      const targetStep = resolved[startIndex];

      if (targetStep?.ensure) {
        try {
          targetStep.ensure();
        } catch {
          // ignore
        }
      }

      if (tourId === "onboarding") {
        const ws =
          typeof window === "undefined"
            ? []
            : useWorkspaceStore.getState().workspaces;
        set({ baselineWorkspaceIds: ws.map((w) => w.id) });
      }

      set({
        activeTour: tourId,
        activeSteps: resolved,
        initialUiSnapshot: {
          ...initialSnapshot,
          temporaryWorkspaceId: tempWsId,
        },
        currentStepIndex: startIndex,
        machineState: "active",
        isReplay,
        workspaceCreatedInTour: startIndex >= 10,
        isCreateWorkspaceDialogOpen: false,
        celebratingStep: false,
        skipConfirmOpen: false,
        isBlocked: false,
        blockedReason: undefined,
        launchedFromCompletion: Boolean(options?.fromCompletion),
        stepEpoch: (state.stepEpoch ?? 0) + 1,
      });

      if (targetStep?.id) {
        get().markStepSeen(targetStep.id, userId);
      }

      // Immediately persist that this tour has started/been shown to prevent restart on app close
      if (!isReplay) {
        const currentRecord = get().getTourRecord(userId);
        const now = Date.now();
        const shownKey =
          tourId === "onboarding"
            ? ("onboardingShownAt" as const)
            : ("settingsShownAt" as const);

        const updatedRecord: UserTourRecord = {
          ...currentRecord,
          [tourId]:
            currentRecord[tourId] === "pending"
              ? "started"
              : currentRecord[tourId],
          [shownKey]: currentRecord[shownKey] ?? now,
        };
        const updatedStates = {
          ...get().userTourStates,
          [userId]: updatedRecord,
        };
        persistTourStates(updatedStates);
        set({ userTourStates: updatedStates });
      }

      get().checkSelfHeal();
    },

    startTour: (tourId, options) => {
      const { activeTour, machineState } = get();
      if (
        activeTour &&
        (machineState === "active" ||
          machineState === "paused" ||
          machineState === "interrupted")
      ) {
        return;
      }
      get().launchTour(tourId, options);
    },

    nextStep: () => {
      const {
        activeTour,
        currentStepIndex,
        machineState,
        completeTour,
        getCurrentStep,
        canAdvance,
        enterActive,
      } = get();
      if (!activeTour || machineState !== "active") {
        return false;
      }

      const gate = canAdvance(currentStepIndex);
      if (!gate.ok) {
        set({ isBlocked: true, blockedReason: gate.reason });
        return false;
      }

      const currentStep = getCurrentStep();
      if (currentStep?.type === "action" && !gate.ok) {
        return false;
      }

      if (currentStep?.onExit) {
        try {
          currentStep.onExit();
        } catch {
          // ignore
        }
      }

      const steps = getStepsForStore(get());
      const nextIndex = currentStepIndex + 1;

      if (nextIndex >= steps.length) {
        completeTour();
      } else {
        enterActive(nextIndex, "nextStep");
      }
      return true;
    },

    prevStep: () => {
      const {
        activeTour,
        currentStepIndex,
        machineState,
        getCurrentStep,
        workspaceCreatedInTour,
        enterActive,
      } = get();
      if (!activeTour || machineState !== "active" || currentStepIndex <= 0) {
        return;
      }

      // After workspace has been created in tour, never navigate back from step 8 into the create workspace modal
      if (
        activeTour === "onboarding" &&
        workspaceCreatedInTour &&
        currentStepIndex <= 8
      ) {
        return;
      }

      const currentStep = getCurrentStep();
      if (currentStep?.onExit) {
        try {
          currentStep.onExit();
        } catch {
          // ignore
        }
      }

      const prevIndex = currentStepIndex - 1;
      enterActive(prevIndex, "prevStep");
    },

    goToStep: (index: number) => {
      const {
        activeTour,
        currentStepIndex,
        getCurrentStep,
        workspaceCreatedInTour,
        canAdvance,
        enterActive,
      } = get();
      if (!activeTour) {
        return false;
      }
      // When at post-creation steps (>= 8), never navigate back into the create workspace modal (< 8)
      if (
        activeTour === "onboarding" &&
        currentStepIndex >= 8 &&
        workspaceCreatedInTour &&
        index < 8
      ) {
        return false;
      }
      const steps = getStepsForStore(get());
      if (index < 0 || index >= steps.length) {
        return false;
      }

      // If moving forward, every intermediate step must be satisfied!
      if (index > currentStepIndex) {
        for (let i = currentStepIndex; i < index; i++) {
          const gate = canAdvance(i);
          if (!gate.ok) {
            set({ isBlocked: true, blockedReason: gate.reason });
            return false;
          }
        }
      }

      const currentStep = getCurrentStep();
      if (currentStep?.onExit) {
        try {
          currentStep.onExit();
        } catch {
          // ignore
        }
      }

      enterActive(index, "goToStep");
      return true;
    },

    fireAction: (event: TourActionEvent) => {
      const {
        activeTour,
        currentStepIndex,
        machineState,
        getCurrentStep,
        completeTour,
        canAdvance,
        enterActive,
      } = get();
      if (!activeTour) {
        return false;
      }

      // If workspace created, verify workspace exists in workspace store and event matches
      if (event === "workspace-created") {
        const wsStore =
          typeof window === "undefined"
            ? { workspaces: [], activeWorkspaceId: null }
            : useWorkspaceStore.getState();
        const isReplay = get().isReplay;
        const hasNewWorkspace =
          isReplay ||
          wsStore.workspaces.some(
            (w) => !get().baselineWorkspaceIds.includes(w.id)
          );
        if (!hasNewWorkspace) {
          set({
            isBlocked: true,
            blockedReason: "Please select or enter a working directory.",
          });
          return false;
        }

        const steps = getStepsForStore(get());
        const notifyIndex = steps.findIndex(
          (s) => s.id === "onboarding-notifications"
        );
        const nextIndex = notifyIndex >= 0 ? notifyIndex : 0;
        set({
          celebratingStep: false,
          workspaceCreatedInTour: true,
          isCreateWorkspaceDialogOpen: false,
          currentStepIndex: nextIndex,
          stepEpoch: (get().stepEpoch ?? 0) + 1,
          isBlocked: false,
          blockedReason: undefined,
        });

        try {
          playWorkspaceCreatedSound();
        } catch {
          // ignore sound errors
        }
        setTimeout(() => {
          set({ celebratingStep: false });
          let isGuideDismissed = false;
          try {
            isGuideDismissed =
              localStorage.getItem("marshell-first-task-guide-dismissed") ===
              "dismissed";
          } catch {
            isGuideDismissed = true;
          }
          const wsCount =
            typeof window === "undefined"
              ? 0
              : useWorkspaceStore.getState().workspaces.length;
          const willShowFirstTaskGuide = !isGuideDismissed && wsCount <= 1;

          if (willShowFirstTaskGuide) {
            get().interruptTour("firstTaskModal");
          } else {
            get().enterActive(nextIndex, "workspace-created");
          }
        }, 380);
        return true;
      }

      if (machineState !== "active" && machineState !== "paused") {
        return false;
      }

      const currentStep = getCurrentStep();
      if (!currentStep) {
        return false;
      }

      // If event does not match step's completeWhen, fail and block
      if (currentStep.completeWhen !== event) {
        set({
          isBlocked: true,
          blockedReason: currentStep.actionHint || "Action required",
        });
        return false;
      }

      if (event === "dialog-opened") {
        set({ isCreateWorkspaceDialogOpen: true });
      }

      const gate = canAdvance(currentStepIndex);
      if (!gate.ok) {
        set({ isBlocked: true, blockedReason: gate.reason });
        return false;
      }

      if (currentStep.onExit) {
        try {
          currentStep.onExit();
        } catch {
          // ignore
        }
      }

      const steps = getStepsForStore(get());
      const nextIndex = currentStepIndex + 1;

      if (nextIndex >= steps.length) {
        completeTour();
      } else {
        enterActive(nextIndex, "fireAction");
      }
      return true;
    },

    interruptTour: (reason: string) => {
      set({
        machineState: "interrupted",
        interruptedReason: reason,
      });
    },

    resumeFromInterrupt: () => {
      const {
        activeTour,
        interruptedReason,
        workspaceCreatedInTour,
        resolveResumeStep,
        enterActive,
        currentStepIndex,
      } = get();
      if (!activeTour) {
        return;
      }

      if (
        activeTour === "onboarding" &&
        (interruptedReason === "firstTaskModal" || workspaceCreatedInTour)
      ) {
        const steps = getStepsForStore(get());
        const notifyIndex = steps.findIndex(
          (s) => s.id === "onboarding-notifications"
        );
        const minIndex = notifyIndex >= 0 ? notifyIndex : 0;
        const targetIndex = Math.max(currentStepIndex, minIndex);
        if (usePanelStore.getState().isSettingsOpen) {
          usePanelStore.getState().closeSettings();
        }
        set({
          isCreateWorkspaceDialogOpen: false,
          workspaceCreatedInTour: true,
          interruptedReason: null,
        });
        enterActive(targetIndex, "resumeFromInterrupt");
        return;
      }

      const steps = getStepsForStore(get());
      const validIndex =
        currentStepIndex >= 0 && currentStepIndex < steps.length
          ? currentStepIndex
          : resolveResumeStep(activeTour);
      set({ interruptedReason: null });
      enterActive(validIndex, "resumeFromInterrupt");
    },

    setChildSurface: (active: boolean) => {
      set({ childSurface: active });
    },

    pauseTour: () => {
      const { machineState } = get();
      if (machineState === "active") {
        set({ machineState: "paused" });
      }
    },

    resumeTour: () => {
      const {
        activeTour,
        interruptedReason,
        workspaceCreatedInTour,
        isCreateWorkspaceDialogOpen,
        resumeFromInterrupt,
        resolveResumeStep,
        enterActive,
        currentStepIndex,
      } = get();
      if (!activeTour) {
        return;
      }

      if (interruptedReason) {
        resumeFromInterrupt();
        return;
      }

      const steps = getStepsForStore(get());
      const validIndex =
        currentStepIndex >= 0 && currentStepIndex < steps.length
          ? currentStepIndex
          : resolveResumeStep(activeTour);

      if (activeTour === "onboarding" && workspaceCreatedInTour) {
        const notifyIndex = steps.findIndex(
          (s) => s.id === "onboarding-notifications"
        );
        const minIndex = notifyIndex >= 0 ? notifyIndex : 0;
        const targetIndex = Math.max(validIndex, minIndex);
        if (usePanelStore.getState().isSettingsOpen) {
          usePanelStore.getState().closeSettings();
        }
        if (typeof document !== "undefined") {
          const dismissBtn = document.querySelector<HTMLButtonElement>(
            '[data-slot="dialog-content"] button[aria-label]'
          );
          if (dismissBtn) {
            dismissBtn.click();
          }
        }
        set({ isCreateWorkspaceDialogOpen: false });
        enterActive(targetIndex, "resumeTour");
        return;
      }

      if (activeTour === "onboarding" && !workspaceCreatedInTour) {
        const step = steps[validIndex];
        const targetIndex =
          step?.requires === "create-workspace-dialog" &&
          !isCreateWorkspaceDialogOpen
            ? resolveResumeStep("onboarding")
            : validIndex;

        const targetStep = steps[targetIndex];
        if (targetStep?.requires === "create-workspace-dialog") {
          set({
            isCreateWorkspaceDialogOpen: true,
            childSurface: false,
          });
        } else {
          set({
            isCreateWorkspaceDialogOpen: false,
            childSurface: false,
          });
        }

        enterActive(targetIndex, "resumeTour");
        return;
      }

      if (activeTour === "settings") {
        if (!usePanelStore.getState().isSettingsOpen) {
          usePanelStore.getState().openSettings("account");
        }
        enterActive(validIndex, "resumeTour");
        return;
      }

      enterActive(validIndex, "resumeTour");
    },

    restoreUiState: () => {
      const { initialUiSnapshot } = get();
      if (!initialUiSnapshot) {
        return;
      }

      if (initialUiSnapshot.isSettingsOpen) {
        if (!usePanelStore.getState().isSettingsOpen) {
          usePanelStore
            .getState()
            .openSettings(initialUiSnapshot.settingsTab ?? "account");
        }
      } else if (usePanelStore.getState().isSettingsOpen) {
        usePanelStore.getState().closeSettings();
      }

      if (
        useLayoutStore.getState().isSidebarOpen !==
        initialUiSnapshot.isSidebarOpen
      ) {
        useLayoutStore
          .getState()
          .setSidebarOpen(initialUiSnapshot.isSidebarOpen);
      }

      if (initialUiSnapshot.temporaryWorkspaceId) {
        const wsStore = useWorkspaceStore.getState();
        const exists = wsStore.workspaces.some(
          (w) => w.id === initialUiSnapshot.temporaryWorkspaceId
        );
        if (exists) {
          wsStore.deleteWorkspace(initialUiSnapshot.temporaryWorkspaceId);
        }
      }

      set({ initialUiSnapshot: null });
    },

    markStepSeen: (stepId: string, userId?: string) => {
      const id = userId?.trim() || "guest_default";
      const { userTourStates } = get();
      const currentRecord = get().getTourRecord(id);
      const seen = new Set(currentRecord.seenStepIds ?? []);
      if (!seen.has(stepId)) {
        seen.add(stepId);
        const updatedRecord: UserTourRecord = {
          ...currentRecord,
          seenStepIds: Array.from(seen),
        };
        const updatedStates = {
          ...userTourStates,
          [id]: updatedRecord,
        };
        persistTourStates(updatedStates);
        set({ userTourStates: updatedStates });
      }
    },

    getWhatsNewSteps: (tourId: TourId, userId?: string): TourStep[] => {
      const id = userId?.trim() || "guest_default";
      const record = get().getTourRecord(id);
      const baseline = TOUR_REGISTRY[tourId] ?? [];
      return resolveTourSteps(tourId, baseline, {
        whatsNewOnly: true,
        seenStepIds: record.seenStepIds,
      });
    },

    startWhatsNewTour: (
      tourId: TourId,
      options?: { userId?: string }
    ): boolean => {
      const whatsNewSteps = get().getWhatsNewSteps(tourId, options?.userId);
      if (whatsNewSteps.length === 0) {
        return false;
      }
      get().launchTour(tourId, {
        userId: options?.userId,
        whatsNewOnly: true,
      });
      return true;
    },

    skipTour: (reason: "skipped" | "dismissedForever", userId?: string) => {
      const { activeTour, isReplay, userTourStates, getCurrentStep } = get();
      const currentStep = getCurrentStep();
      if (currentStep?.onExit) {
        try {
          currentStep.onExit();
        } catch {
          // ignore
        }
      }

      get().restoreUiState();

      if (activeTour && !isReplay) {
        const id = userId?.trim() || "guest_default";
        const currentRecord = get().getTourRecord(id);
        const updatedRecord: UserTourRecord = {
          ...currentRecord,
          [activeTour]: reason,
        };
        const updatedStates = {
          ...userTourStates,
          [id]: updatedRecord,
        };
        persistTourStates(updatedStates);
        set({
          userTourStates: updatedStates,
          activeTour: null,
          activeSteps: [],
          currentStepIndex: 0,
          machineState: "skipped",
          skipConfirmOpen: false,
        });
      } else {
        set({
          activeTour: null,
          activeSteps: [],
          currentStepIndex: 0,
          machineState: "skipped",
          skipConfirmOpen: false,
        });
      }
    },

    completeTour: (userId?: string) => {
      const { activeTour, isReplay, userTourStates, getCurrentStep } = get();
      const currentStep = getCurrentStep();
      if (currentStep?.onExit) {
        try {
          currentStep.onExit();
        } catch {
          // ignore
        }
      }

      get().restoreUiState();

      if (activeTour && !isReplay) {
        const id = userId?.trim() || "guest_default";
        const currentRecord = get().getTourRecord(id);
        const updatedRecord: UserTourRecord = {
          ...currentRecord,
          [activeTour]: "completed",
        };
        const updatedStates = {
          ...userTourStates,
          [id]: updatedRecord,
        };
        persistTourStates(updatedStates);
        set({
          userTourStates: updatedStates,
          activeTour: null,
          activeSteps: [],
          currentStepIndex: 0,
          machineState: "completed",
          celebratingStep: false,
        });
      } else {
        set({
          activeTour: null,
          activeSteps: [],
          currentStepIndex: 0,
          machineState: "completed",
          celebratingStep: false,
        });
      }
    },

    replayTour: (tourId: TourId) => {
      get().launchTour(tourId, { isReplay: true, stepIndex: 0 });
    },
  };
});

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).useTutorialStore =
    useTutorialStore;
  (window as unknown as Record<string, unknown>).useWorkspaceStore =
    useWorkspaceStore;
}
