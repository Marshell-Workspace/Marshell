import type {
  NetworkFailure,
  QaIssue,
  QaReport,
  RuntimeErrorPayload,
} from "@workspace/core/lib/preview-bridge";

/** Widths worth checking on any site. These are QA checkpoints, not the app's own breakpoints. */
export const QA_BREAKPOINTS: readonly number[] = [
  320, 360, 375, 390, 414, 480, 640, 768, 820, 1024, 1280, 1366, 1440, 1536,
  1920,
];

export type HealthStatus = "ok" | "warn" | "error" | "pending";

export interface HealthItem {
  /** Elements/URLs behind a warning, for the detail list. */
  details: string[];
  id: string;
  label: string;
  status: HealthStatus;
  summary: string;
}

export interface HealthInput {
  /** Errors thrown by the page (window.onerror, unhandled rejections). */
  errors: RuntimeErrorPayload[];
  /** The viewport the preview is simulating, in CSS pixels. */
  expected: { height: number; width: number };
  network: NetworkFailure[];
  report: QaReport | null;
}

const MAX_DETAILS = 6;

const issueLines = (issues: QaIssue[]): string[] =>
  issues.slice(0, MAX_DETAILS).map((i) => `${i.selector} — ${i.detail}`);

const plural = (n: number, word: string): string =>
  `${n} ${word}${n === 1 ? "" : "s"}`;

/** Detail lines are capped, so a list can be longer than what is shown. */
function issueItem(
  id: string,
  label: string,
  issues: QaIssue[],
  okText: string,
  problemNoun: string,
  status: HealthStatus = "warn"
): HealthItem {
  if (issues.length === 0) {
    return { details: [], id, label, status: "ok", summary: okText };
  }
  return {
    details: issueLines(issues),
    id,
    label,
    status,
    summary: plural(issues.length, problemNoun),
  };
}

/**
 * Turns raw measurements and captured errors into the short checklist shown in the
 * health popover. Pure so every rule can be unit tested.
 */
export function buildHealth(input: HealthInput): HealthItem[] {
  const { errors, expected, network, report } = input;
  const runtime = errors.filter((e) => !e.fromConsole);
  const consoleErrors = errors.filter((e) => e.fromConsole);

  const items: HealthItem[] = [];

  if (report) {
    const exact =
      report.viewportWidth === expected.width &&
      report.viewportHeight === expected.height;
    items.push({
      details: exact
        ? []
        : [
            `Page reports ${report.viewportWidth} × ${report.viewportHeight}, expected ${expected.width} × ${expected.height}`,
          ],
      id: "viewport",
      label: "Viewport",
      status: exact ? "ok" : "warn",
      summary: exact
        ? `${report.viewportWidth} × ${report.viewportHeight} at ${report.devicePixelRatio}× DPR`
        : "Page viewport differs from the simulated size",
    });

    const overflowX = report.documentWidth - report.viewportWidth;
    const hasHorizontalOverflow = overflowX > 1;
    items.push({
      details: hasHorizontalOverflow ? issueLines(report.overflowing) : [],
      id: "overflow-x",
      label: "Horizontal overflow",
      status: hasHorizontalOverflow ? "error" : "ok",
      summary: hasHorizontalOverflow
        ? `Page is ${overflowX}px wider than the viewport`
        : "No horizontal scrolling",
    });

    items.push(
      issueItem(
        "clipped",
        "Elements past the edge",
        // With no page-level overflow the extras are clipped by a container, not a bug.
        hasHorizontalOverflow ? report.overflowing : [],
        "Everything within the viewport",
        "element exceeds the viewport"
      ),
      issueItem(
        "fixed-width",
        "Fixed-width elements",
        report.fixedWidth,
        "No fixed widths wider than the viewport",
        "fixed-width element"
      ),
      issueItem(
        "images",
        "Images",
        [
          ...report.brokenImages.map((i) => ({
            ...i,
            detail: `broken: ${i.detail}`,
          })),
          ...report.oversizedImages,
        ],
        "Images load and fit",
        "image problem"
      ),
      issueItem(
        "typography",
        "Typography",
        report.textOverflow,
        report.smallText > 0
          ? `${plural(report.smallText, "text node")} under 10px`
          : "Text fits its containers",
        "text overflow"
      )
    );

    if (!report.hasViewportMeta && expected.width <= 820) {
      items.push({
        details: [],
        id: "viewport-meta",
        label: "Viewport meta",
        status: "warn",
        summary:
          "Missing <meta name=viewport>; real phones will render zoomed out",
      });
    }

    if (report.blank) {
      items.push({
        details: [],
        id: "blank",
        label: "Rendering",
        status: "error",
        summary: "The page rendered nothing visible",
      });
    }
  } else {
    items.push({
      details: [],
      id: "viewport",
      label: "Layout",
      status: "pending",
      summary: "Waiting for the page to report",
    });
  }

  items.push(
    {
      details: runtime
        .slice(0, MAX_DETAILS)
        .map((e) => e.message.slice(0, 160)),
      id: "runtime",
      label: "Runtime",
      status: runtime.length > 0 ? "error" : "ok",
      summary:
        runtime.length > 0
          ? plural(runtime.length, "uncaught error")
          : "No uncaught errors",
    },
    {
      details: consoleErrors
        .slice(0, MAX_DETAILS)
        .map((e) => e.message.slice(0, 160)),
      id: "console",
      label: "Console",
      status: consoleErrors.length > 0 ? "warn" : "ok",
      summary:
        consoleErrors.length > 0
          ? plural(consoleErrors.length, "console.error call")
          : "No console errors",
    },
    {
      details: network
        .slice(0, MAX_DETAILS)
        .map(
          (n) =>
            `${n.status === 0 ? "failed" : n.status} ${n.method ?? ""} ${n.url}`
        ),
      id: "network",
      label: "Network",
      status: network.length > 0 ? "warn" : "ok",
      summary:
        network.length > 0
          ? plural(network.length, "failed request")
          : "No failed requests",
    }
  );

  return items;
}

/** Headline counts for the toolbar badge. */
export function summarizeHealth(items: HealthItem[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const item of items) {
    if (item.status === "error") {
      errors += 1;
    } else if (item.status === "warn") {
      warnings += 1;
    }
  }
  return { errors, warnings };
}

/** Whether a report shows the page scrolling sideways at this viewport. */
export const hasHorizontalOverflow = (report: QaReport): boolean =>
  report.documentWidth - report.viewportWidth > 1;
