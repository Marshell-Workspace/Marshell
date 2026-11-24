import {
  parsePreviewMessage,
  type QaReport,
} from "@workspace/core/lib/preview-bridge";
import {
  buildHealth,
  hasHorizontalOverflow,
  QA_BREAKPOINTS,
  summarizeHealth,
} from "@workspace/core/lib/preview-qa";
import { describe, expect, it } from "vitest";

const report = (over: Partial<QaReport> = {}): QaReport => ({
  blank: false,
  brokenImages: [],
  devicePixelRatio: 1,
  documentHeight: 900,
  documentWidth: 390,
  fixedWidth: [],
  hasViewportMeta: true,
  oversizedImages: [],
  overflowing: [],
  smallText: 0,
  textOverflow: [],
  viewportHeight: 844,
  viewportWidth: 390,
  ...over,
});

const base = { errors: [], expected: { height: 844, width: 390 }, network: [] };
const byId = (items: ReturnType<typeof buildHealth>, id: string) =>
  items.find((i) => i.id === id);

describe("QA breakpoints", () => {
  it("cover the requested checkpoints in ascending order", () => {
    expect(QA_BREAKPOINTS).toEqual([
      320, 360, 375, 390, 414, 480, 640, 768, 820, 1024, 1280, 1366, 1440, 1536,
      1920,
    ]);
  });
});

describe("buildHealth", () => {
  it("is all green for a clean page at the expected viewport", () => {
    const items = buildHealth({ ...base, report: report() });
    expect(summarizeHealth(items)).toEqual({ errors: 0, warnings: 0 });
    expect(byId(items, "viewport")?.status).toBe("ok");
  });

  it("is pending, not green, before the page has reported", () => {
    const items = buildHealth({ ...base, report: null });
    expect(byId(items, "viewport")?.status).toBe("pending");
  });

  it("flags horizontal overflow as an error and lists the offenders", () => {
    const r = report({
      documentWidth: 520,
      overflowing: [{ detail: "ends at 520px", selector: "div.banner" }],
    });
    const items = buildHealth({ ...base, report: r });
    expect(hasHorizontalOverflow(r)).toBe(true);
    expect(byId(items, "overflow-x")?.status).toBe("error");
    expect(byId(items, "overflow-x")?.summary).toContain("130px");
    expect(byId(items, "clipped")?.status).toBe("warn");
    expect(byId(items, "clipped")?.details[0]).toContain("div.banner");
  });

  it("ignores elements past the edge when a container already clips them", () => {
    const r = report({
      overflowing: [{ detail: "ends at 500px", selector: "div.carousel" }],
    });
    // documentWidth === viewportWidth: nothing scrolls sideways.
    expect(byId(buildHealth({ ...base, report: r }), "clipped")?.status).toBe(
      "ok"
    );
  });

  it("tolerates a 1px rounding difference", () => {
    expect(hasHorizontalOverflow(report({ documentWidth: 391 }))).toBe(false);
  });

  it("warns when the page reports a different viewport than simulated", () => {
    const items = buildHealth({
      ...base,
      report: report({ viewportWidth: 375 }),
    });
    expect(byId(items, "viewport")?.status).toBe("warn");
  });

  it("reports broken and oversized images, fixed widths and text overflow", () => {
    const r = report({
      brokenImages: [{ detail: "/a.png", selector: "img.hero" }],
      fixedWidth: [{ detail: "min-width 600px", selector: "table" }],
      oversizedImages: [{ detail: "700px wide", selector: "img.wide" }],
      textOverflow: [{ detail: "text spills 40px", selector: "h1" }],
    });
    const items = buildHealth({ ...base, report: r });
    expect(byId(items, "images")?.summary).toBe("2 image problems");
    expect(byId(items, "fixed-width")?.status).toBe("warn");
    expect(byId(items, "typography")?.status).toBe("warn");
  });

  it("flags a blank page as a rendering error", () => {
    const items = buildHealth({ ...base, report: report({ blank: true }) });
    expect(byId(items, "blank")?.status).toBe("error");
  });

  it("only asks for a viewport meta tag on phone-sized viewports", () => {
    const noMeta = report({ hasViewportMeta: false });
    expect(
      byId(buildHealth({ ...base, report: noMeta }), "viewport-meta")
    ).toBeDefined();
    const desktop = buildHealth({
      ...base,
      expected: { height: 900, width: 1440 },
      report: noMeta,
    });
    expect(byId(desktop, "viewport-meta")).toBeUndefined();
  });

  it("separates uncaught errors, console errors and network failures", () => {
    const items = buildHealth({
      ...base,
      errors: [{ message: "boom" }, { fromConsole: true, message: "warn me" }],
      network: [{ kind: "fetch", method: "GET", status: 404, url: "/api/x" }],
      report: report(),
    });
    expect(byId(items, "runtime")?.status).toBe("error");
    expect(byId(items, "runtime")?.summary).toBe("1 uncaught error");
    expect(byId(items, "console")?.status).toBe("warn");
    expect(byId(items, "network")?.details[0]).toBe("404 GET /api/x");
  });

  it("describes a request that never completed as failed", () => {
    const items = buildHealth({
      ...base,
      network: [{ kind: "resource", status: 0, url: "/logo.png" }],
      report: report(),
    });
    expect(byId(items, "network")?.details[0]).toContain("failed");
  });
});

describe("QA messages", () => {
  const msg = (type: string, payload: unknown) => ({
    payload,
    source: "marshell-devtools",
    type,
  });

  it("parses a qa-report and clamps untrusted fields", () => {
    const parsed = parsePreviewMessage(
      msg("qa-report", {
        blank: "yes",
        documentWidth: 500,
        overflowing: [{ detail: "d", selector: "s" }, "junk", null],
        viewportWidth: 390,
      })
    );
    expect(parsed?.kind).toBe("qa-report");
    if (parsed?.kind === "qa-report") {
      expect(parsed.report.blank).toBe(false);
      expect(parsed.report.documentWidth).toBe(500);
      expect(parsed.report.overflowing).toEqual([
        { detail: "d", selector: "s" },
      ]);
      expect(parsed.report.brokenImages).toEqual([]);
    }
  });

  it("parses network errors and rejects unknown kinds", () => {
    expect(
      parsePreviewMessage(
        msg("network-error", { kind: "fetch", status: 500, url: "/x" })
      )
    ).toEqual({
      failure: { kind: "fetch", method: undefined, status: 500, url: "/x" },
      kind: "network-error",
    });
    expect(
      parsePreviewMessage(msg("network-error", { kind: "evil", url: "/x" }))
    ).toBeNull();
    expect(
      parsePreviewMessage(msg("network-error", { kind: "fetch" }))
    ).toBeNull();
  });
});
