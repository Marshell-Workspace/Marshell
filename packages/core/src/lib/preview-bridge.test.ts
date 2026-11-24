import {
  formatComponentContext,
  formatComponentLocation,
  isTrustedMessage,
  parsePreviewMessage,
  parsePreviewUrl,
  relativizePath,
  toDisplayUrl,
} from "@workspace/core/lib/preview-bridge";
import { frameLayout, VIEWPORTS } from "@workspace/core/lib/preview-viewports";
import { describe, expect, it } from "vitest";

it("bounds and validates untrusted preview snapshots", () => {
  const parsed = parsePreviewMessage({
    source: "marshell-devtools",
    type: "page-snapshot",
    payload: {
      text: "x".repeat(20_000),
      title: "Page",
      headings: [null, "Hello", 5],
      width: Number.NaN,
      height: 720,
    },
  });
  expect(parsed?.kind).toBe("page-snapshot");
  if (parsed?.kind === "page-snapshot") {
    expect(parsed.snapshot.text).toHaveLength(12_000);
    expect(parsed.snapshot.headings).toEqual(["Hello"]);
    expect(parsed.snapshot.width).toBe(0);
  }
});

describe("parsePreviewUrl", () => {
  it.each([
    ["3000", 3000, "/"],
    [":5173", 5173, "/"],
    ["localhost:3010/app?x=1#top", 3010, "/app?x=1#top"],
    ["http://127.0.0.1:8080/a", 8080, "/a"],
    ["0.0.0.0:4200", 4200, "/"],
    ["http://[::1]:3000/", 3000, "/"],
  ])("accepts %s", (input, port, path) => {
    expect(parsePreviewUrl(input)).toEqual({ target: { path, port } });
  });

  it.each([
    "",
    "0",
    "70000",
    "localhost",
    "https://localhost:3000",
    "http://example.com:3000",
    "ftp://localhost:3000",
    "not a url",
  ])("rejects %j", (input) => {
    expect(parsePreviewUrl(input)).toHaveProperty("error");
  });
});

describe("parsePreviewMessage", () => {
  it("parses navigation, component and eruda messages", () => {
    expect(
      parsePreviewMessage({
        payload: { canGoBack: true, seq: 2, title: "Home", url: "http://x/" },
        source: "marshell-devtools",
        type: "navigation",
      })
    ).toEqual({
      kind: "navigation",
      state: {
        canGoBack: true,
        canGoForward: false,
        seq: 2,
        title: "Home",
        url: "http://x/",
      },
    });
    expect(
      parsePreviewMessage({
        payload: {},
        source: "marshell-devtools",
        type: "eruda-ready",
      })
    ).toEqual({ kind: "eruda-ready" });
    const component = parsePreviewMessage({
      payload: {
        component: "Header",
        file: "src/Header.tsx",
        framework: "react",
        line: 42,
        stack: [{ name: "Header" }, "junk"],
      },
      source: "marshell-inspector",
      type: "component-detected",
      version: 2,
    });
    expect(component).toMatchObject({
      kind: "component",
      payload: { component: "Header", line: 42, stack: [{ name: "Header" }] },
    });
  });

  it("ignores anything malformed or from another source", () => {
    for (const bad of [
      null,
      "x",
      1,
      {},
      { source: "other", type: "navigation" },
      { payload: { url: 5 }, source: "marshell-devtools", type: "navigation" },
      { payload: "str", source: "marshell-devtools", type: "navigation" },
    ]) {
      expect(parsePreviewMessage(bad)).toBeNull();
    }
  });

  it("parses a runtime-error message", () => {
    expect(
      parsePreviewMessage({
        payload: {
          col: 5,
          fromConsole: true,
          line: 10,
          message: "boom",
          source: "app.js",
          stack: "Error: boom\n at x",
        },
        source: "marshell-devtools",
        type: "runtime-error",
      })
    ).toEqual({
      kind: "runtime-error",
      payload: {
        col: 5,
        fromConsole: true,
        line: 10,
        message: "boom",
        source: "app.js",
        stack: "Error: boom\n at x",
      },
    });
  });

  it("ignores a runtime-error message without a message string", () => {
    expect(
      parsePreviewMessage({
        payload: {},
        source: "marshell-devtools",
        type: "runtime-error",
      })
    ).toBeNull();
  });
});

describe("isTrustedMessage", () => {
  const frame = {};
  it("requires the iframe window and the proxy origin", () => {
    expect(
      isTrustedMessage(
        { origin: "http://127.0.0.1:9", source: frame },
        frame,
        "http://127.0.0.1:9"
      )
    ).toBe(true);
    expect(
      isTrustedMessage(
        { origin: "http://evil", source: frame },
        frame,
        "http://127.0.0.1:9"
      )
    ).toBe(false);
    expect(
      isTrustedMessage(
        { origin: "http://127.0.0.1:9", source: {} },
        frame,
        "http://127.0.0.1:9"
      )
    ).toBe(false);
    expect(
      isTrustedMessage(
        { origin: "http://127.0.0.1:9", source: frame },
        frame,
        null
      )
    ).toBe(false);
    expect(
      isTrustedMessage(
        { origin: "http://127.0.0.1:9", source: undefined },
        undefined,
        "http://127.0.0.1:9"
      )
    ).toBe(false);
  });
});

describe("locations", () => {
  it("shows the address the user typed, not the proxy's", () => {
    expect(
      toDisplayUrl("http://127.0.0.1:9/a?b", "http://127.0.0.1:9", 3000)
    ).toBe("http://localhost:3000/a?b");
    expect(toDisplayUrl("http://127.0.0.1:9", "http://127.0.0.1:9", 3000)).toBe(
      "http://localhost:3000/"
    );
  });

  it("makes paths project-relative and drops query strings", () => {
    expect(
      relativizePath("/home/me/app/src/Header.tsx?t=1", "/home/me/app")
    ).toBe("src/Header.tsx");
    expect(relativizePath("C:\\app\\src\\Header.tsx", "C:\\app")).toBe(
      "src/Header.tsx"
    );
    expect(relativizePath("./src/a.tsx")).toBe("src/a.tsx");
    // Dev servers report URL paths; those are project-relative, not filesystem-absolute.
    expect(relativizePath("/src/App.tsx")).toBe("src/App.tsx");
    expect(
      relativizePath("/r/src/app/%5Blocale%5D/%28app%29/layout.tsx:12:4", "/r")
    ).toBe("src/app/[locale]/(app)/layout.tsx:12:4");
    expect(relativizePath("/r/src/100%.tsx", "/r")).toBe("src/100%.tsx");
    expect(relativizePath("/home/other/proj/src/a.tsx", "/home/me/app")).toBe(
      "/home/other/proj/src/a.tsx"
    );
  });

  it("formats file:line and the agent context", () => {
    const p = {
      component: "Header",
      file: "/r/src/Header.tsx",
      framework: "react",
      htmlPreview: "<h1 />",
      line: 42,
      stack: [{ file: "/r/src/Header.tsx:42:5", name: "Header" }],
    };
    expect(formatComponentLocation(p, "/r")).toBe("src/Header.tsx:42");
    expect(formatComponentLocation({ ...p, file: undefined })).toBe("Header");
    const ctx = formatComponentContext(p, "/r");
    expect(ctx).toContain("Location: src/Header.tsx:42");
    expect(ctx).toContain("in Header (src/Header.tsx:42:5)");
    expect(ctx).toContain("<h1 />");
  });
});

describe("frameLayout", () => {
  const preset = (id: string) => VIEWPORTS.find((v) => v.id === id)!;
  it("fills the space and compensates for zoom in responsive mode", () => {
    const l = frameLayout(preset("responsive"), "portrait", 0.5);
    expect(l).toMatchObject({
      innerWidth: "200%",
      outerWidth: "100%",
      scale: 0.5,
    });
  });
  it("sizes device presets and swaps them with orientation", () => {
    expect(frameLayout(preset("iphone-16"), "portrait", 1)).toMatchObject({
      outerHeight: "852px",
      outerWidth: "393px",
      innerHeight: "100%",
      innerWidth: "100%",
    });
    expect(frameLayout(preset("iphone-16"), "landscape", 1)).toMatchObject({
      outerHeight: "393px",
      outerWidth: "852px",
    });
    expect(frameLayout(preset("desktop"), "landscape", 0.5)).toMatchObject({
      outerWidth: "720px",
      outerHeight: "450px",
      innerWidth: "200%",
    });
    expect(frameLayout(preset("desktop"), "portrait", 1)).toMatchObject({
      outerWidth: "900px",
    });
  });
});
