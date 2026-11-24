import {
  type SettingsTab,
  usePanelStore,
} from "@workspace/core/stores/panel-store";
import type { TourId, TourStep } from "@workspace/core/stores/tutorial-store";

/**
 * Programmatic registry for dynamic feature tour steps.
 * Allows modules to register steps at runtime with clean unregister handlers.
 */
const dynamicRegistry = new Map<TourId, Map<string, TourStep>>();

export type RegisterTourStepOptions = Partial<TourStep> & {
  body: string;
  id: string;
  title: string;
  tourId?: TourId;
};

export function registerTourStep(
  tourIdOrStep: TourId | RegisterTourStepOptions,
  maybeStep?: RegisterTourStepOptions
): () => void {
  const tourId = (
    typeof tourIdOrStep === "string"
      ? tourIdOrStep
      : (tourIdOrStep.tourId ?? "settings")
  ) as TourId;
  const rawStep = typeof tourIdOrStep === "string" ? maybeStep : tourIdOrStep;

  if (!rawStep?.id) {
    return () => {};
  }

  let sectionMap = dynamicRegistry.get(tourId);
  if (!sectionMap) {
    sectionMap = new Map();
    dynamicRegistry.set(tourId, sectionMap);
  }

  const step: TourStep = {
    ...rawStep,
    anchor: rawStep.anchor ?? rawStep.id,
    type: rawStep.type ?? "info",
    placement: rawStep.placement ?? "right",
    isDynamic: true,
  };

  sectionMap.set(step.id, step);

  return () => {
    const current = dynamicRegistry.get(tourId);
    current?.delete(step.id);
  };
}

export function getRegisteredSteps(tourId: TourId): TourStep[] {
  const sectionMap = dynamicRegistry.get(tourId);
  return sectionMap ? Array.from(sectionMap.values()) : [];
}

export function clearRegisteredSteps(tourId?: TourId): void {
  if (tourId) {
    dynamicRegistry.delete(tourId);
  } else {
    dynamicRegistry.clear();
  }
}

/**
 * Parses an HTML element annotated with data-tour attributes into a TourStep.
 * Attributes supported:
 *  - data-tour-id / data-tour: unique step id (required)
 *  - data-tour-section: "onboarding" | "settings"
 *  - data-tour-title: title string
 *  - data-tour-description / data-tour-body: body copy
 *  - data-tour-order: numeric sort index
 *  - data-tour-placement: "top" | "bottom" | "left" | "right" | "center"
 *  - data-tour-tab: settings tab to activate (e.g. "appearance", "performance")
 *  - data-tour-chapter: optional chapter badge label
 */
export function parseDomTourStep(
  el: HTMLElement,
  tourId: TourId
): TourStep | null {
  const id = el.getAttribute("data-tour-id") || el.getAttribute("data-tour");
  const title = el.getAttribute("data-tour-title");
  const body =
    el.getAttribute("data-tour-description") ||
    el.getAttribute("data-tour-body");

  if (!(id && title && body)) {
    return null;
  }

  const orderAttr = el.getAttribute("data-tour-order");
  const order = orderAttr ? Number.parseFloat(orderAttr) : undefined;
  const placementAttr = el.getAttribute("data-tour-placement");
  const tabAttr = el.getAttribute("data-tour-tab") as SettingsTab | null;
  const chapter = el.getAttribute("data-tour-chapter") || undefined;

  const requires =
    tourId === "settings" ? ("settings-panel" as const) : undefined;

  const step: TourStep = {
    id,
    anchor: id,
    title,
    body,
    chapter,
    order,
    placement: (placementAttr as TourStep["placement"]) || "right",
    type: "info",
    requires,
    isDynamic: true,
    uiState: {
      settingsOpen: tourId === "settings",
      settingsTab: tabAttr ?? undefined,
    },
    ensure: tabAttr
      ? () => {
          usePanelStore.getState().setSettingsTab(tabAttr);
        }
      : undefined,
  };

  return step;
}

/**
 * Scans the DOM for any elements declaring data-tour-section for the given tour.
 */
export function discoverDomTourSteps(tourId: TourId): TourStep[] {
  if (typeof document === "undefined") {
    return [];
  }

  const selector = `[data-tour-section="${tourId}"], [data-tour-section*="${tourId}"]`;
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const steps: TourStep[] = [];

  for (const el of elements) {
    // Drop elements that are explicitly hidden or detached
    if (!el.isConnected) {
      continue;
    }
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      continue;
    }

    const parsed = parseDomTourStep(el, tourId);
    if (parsed) {
      steps.push(parsed);
    }
  }

  return steps;
}

export interface ResolveTourStepsOptions {
  baselineSteps?: TourStep[];
  seenStepIds?: string[];
  whatsNewOnly?: boolean;
}

/**
 * Resolves the full runtime sequence of tour steps by merging:
 * 1. Static baseline steps
 * 2. Programmatically registered steps
 * 3. DOM-discovered steps (annotated elements)
 *
 * Sorts by `order` (or preserves natural sequence) and filters out seen steps if in "What's new" mode.
 */
export function resolveTourSteps(
  tourId: TourId,
  baselineOrOptions?: TourStep[] | ResolveTourStepsOptions,
  maybeOptions?: ResolveTourStepsOptions
): TourStep[] {
  const options = Array.isArray(baselineOrOptions)
    ? maybeOptions
    : baselineOrOptions;
  const baseline = Array.isArray(baselineOrOptions)
    ? baselineOrOptions
    : (options?.baselineSteps ?? []);
  const programmatic = getRegisteredSteps(tourId);
  const domDiscovered = discoverDomTourSteps(tourId);

  // Map by step ID for deduplication and enrichment
  const stepMap = new Map<string, TourStep>();

  // 1. Seed with baseline
  for (let i = 0; i < baseline.length; i++) {
    const step = baseline[i];
    if (step) {
      stepMap.set(step.id, {
        ...step,
        order: step.order ?? (i + 1) * 10,
      });
    }
  }

  // 2. Merge programmatic steps
  for (const step of programmatic) {
    const existing = stepMap.get(step.id);
    stepMap.set(step.id, {
      ...existing,
      ...step,
      order: step.order ?? existing?.order ?? 999,
    });
  }

  // 3. Merge DOM discovered steps
  for (const step of domDiscovered) {
    const existing = stepMap.get(step.id);
    stepMap.set(step.id, {
      ...existing,
      ...step,
      order: step.order ?? existing?.order ?? 999,
    });
  }

  let merged = Array.from(stepMap.values());

  // Sort by order ascending
  merged.sort((a, b) => (a.order ?? 500) - (b.order ?? 500));

  // "What's new" filter: return only steps that the user has not seen yet
  if (options?.whatsNewOnly && options?.seenStepIds) {
    const seenSet = new Set(options.seenStepIds);
    merged = merged.filter((step) => !seenSet.has(step.id));
  }

  return merged;
}

/**
 * Dev-time safety net: checks whether interactive controls in Settings
 * have appropriate tour coverage and warns in development mode if any are missed.
 */
export function auditTourCoverage(section: "settings"): {
  covered: string[];
  missing: string[];
} {
  const missing: string[] = [];
  const covered: string[] = [];

  if (typeof document === "undefined") {
    return { covered, missing };
  }

  if (section === "settings") {
    // Check known settings tabs plus any rendered [data-settings-tab] controls in DOM
    const expectedTabs = new Set([
      "account",
      "appearance",
      "workspace",
      "notifications",
      "tutorials",
      "performance",
      "system",
    ]);
    for (const node of document.querySelectorAll("[data-settings-tab]")) {
      const tabName = node.getAttribute("data-settings-tab");
      if (tabName) {
        expectedTabs.add(tabName);
      }
    }

    for (const tab of expectedTabs) {
      const el = document.querySelector(
        `[data-settings-tab="${tab}"], [data-tour="settings-nav-${tab}"], [data-tour-id="settings-nav-${tab}"]`
      );
      if (!el) {
        // Tab not currently rendered in DOM
        continue;
      }
      const hasTourMeta =
        el.hasAttribute("data-tour") ||
        el.hasAttribute("data-tour-id") ||
        el.getAttribute("data-tour-section") === "settings";
      if (hasTourMeta) {
        covered.push(tab);
      } else {
        missing.push(tab);
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[Tour Dev Audit] Settings tab "${tab}" is missing tour metadata. Tag it with data-tour-section="settings" to include it in the tour.`
          );
        }
      }
    }
  }

  return { covered, missing };
}
