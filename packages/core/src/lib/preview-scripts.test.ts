import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const SCRIPTS = new URL("../../../../public/scripts/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, SCRIPTS), "utf8");

interface Harness {
  calls: string[];
  dispatch: (type: string, event: unknown) => void;
  posts: Array<{
    payload: Record<string, unknown>;
    source: string;
    type: string;
  }>;
  win: Record<string, any>;
}

/** Runs devtools_script.js against a fake browser environment. */
function load(
  href = "http://p/",
  stored: string | null = null,
  extra: Record<string, unknown> = {},
  winProps: Record<string, unknown> = {}
): Harness {
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  const posts: Harness["posts"] = [];
  const calls: string[] = [];
  const parent = { postMessage: (m: never) => posts.push(m) };
  const location = { href, reload: () => calls.push("reload") };
  const history = {
    back: () => calls.push("back"),
    forward: () => calls.push("forward"),
    pushState(_s: unknown, _t: unknown, url: string) {
      location.href = new URL(url, location.href).href;
    },
    replaceState(_s: unknown, _t: unknown, url: string) {
      location.href = new URL(url, location.href).href;
    },
  };
  const storage: Record<string, string> = stored
    ? { __marshell_nav: stored }
    : {};
  const win: Record<string, any> = {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: (t: string, fn: (e: unknown) => void) => {
      listeners[t] = [...(listeners[t] ?? []), fn];
    },
    parent,
    ...winProps,
  };
  runInNewContext(read("devtools_script.js"), {
    document: {
      body: { innerText: "Rendered page content" },
      querySelectorAll: () => [{ innerText: "Welcome" }],
      addEventListener() {},
      querySelector: () => null,
      readyState: "complete",
      title: "Page",
    },
    history,
    location,
    sessionStorage: {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
    },
    window: win,
    ...extra,
  });
  return {
    calls,
    dispatch: (type, event) => {
      for (const fn of listeners[type] ?? []) {
        fn(event);
      }
    },
    posts,
    win: Object.assign(win, { history, location }),
  };
}

const navs = (h: Harness) =>
  h.posts.filter((p) => p.type === "navigation").map((p) => p.payload);

describe("navigation tracker", () => {
  const tracker = () => load().win.__marshellDevtools.createNavTracker();

  it("tracks push, back and forward", () => {
    const t = tracker();
    t.record("load", "/a");
    t.record("push", "/b");
    t.record("push", "/c");
    expect(t.snapshot()).toMatchObject({
      canGoBack: true,
      canGoForward: false,
      index: 2,
    });
    t.record("pop", "/b");
    expect(t.snapshot()).toMatchObject({
      canGoBack: true,
      canGoForward: true,
      index: 1,
    });
    t.record("pop", "/a");
    expect(t.snapshot()).toMatchObject({
      canGoBack: false,
      canGoForward: true,
      index: 0,
    });
  });

  it("drops forward history on a new push and replaces in place", () => {
    const t = tracker();
    for (const [k, h] of [
      ["load", "/a"],
      ["push", "/b"],
      ["pop", "/a"],
      ["push", "/c"],
    ] as const) {
      t.record(k, h);
    }
    expect(t.snapshot().stack).toEqual(["/a", "/c"]);
    t.record("replace", "/d");
    expect(t.snapshot().stack).toEqual(["/a", "/d"]);
  });

  it("follows full-page navigations and ignores reloads", () => {
    const t = tracker();
    t.record("load", "/a");
    t.record("load", "/b");
    t.record("load", "/b");
    expect(t.snapshot().stack).toEqual(["/a", "/b"]);
    t.record("load", "/a");
    expect(t.snapshot()).toMatchObject({ canGoForward: true, index: 0 });
  });

  it("does not double-count a popstate + hashchange pair", () => {
    const t = tracker();
    t.record("load", "/a#1");
    t.record("push", "/a#2");
    t.record("pop", "/a#1");
    t.record("pop", "/a#1");
    expect(t.snapshot()).toMatchObject({ index: 0, stack: ["/a#1", "/a#2"] });
  });

  it("caps the stack", () => {
    const t = tracker();
    for (let i = 0; i < 150; i++) {
      t.record("push", `/${i}`);
    }
    expect(t.snapshot().stack.length).toBeLessThanOrEqual(100);
  });
});

describe("devtools script", () => {
  it("returns rendered page evidence only on a parent inspection request", () => {
    const h = load();
    const data = { command: "inspect-page", source: "marshell-app" };
    h.dispatch("message", { data, source: {} });
    expect(h.posts.some((post) => post.type === "page-snapshot")).toBe(false);
    h.dispatch("message", { data, source: h.win.parent });
    expect(h.posts.at(-1)).toMatchObject({
      type: "page-snapshot",
      payload: {
        title: "Page",
        text: "Rendered page content",
        headings: ["Welcome"],
        width: 1280,
        height: 720,
      },
    });
  });
  it("reports the initial page and patched pushState to the parent", () => {
    const h = load("http://p/");
    expect(navs(h)[0]).toMatchObject({
      canGoBack: false,
      title: "Page",
      url: "http://p/",
    });
    h.win.history.pushState({}, "", "/next");
    expect(navs(h).at(-1)).toMatchObject({
      canGoBack: true,
      url: "http://p/next",
    });
    expect((navs(h).at(-1)?.seq as number) > (navs(h)[0]?.seq as number)).toBe(
      true
    );
  });

  it("restores the stack from sessionStorage across page loads", () => {
    const h = load(
      "http://p/b",
      JSON.stringify({ index: 0, stack: ["http://p/a"] })
    );
    expect(navs(h)[0]).toMatchObject({ canGoBack: true });
  });

  it("obeys commands only from the parent frame", () => {
    const h = load();
    h.dispatch("message", {
      data: { command: "back", source: "marshell-app" },
      source: h.win.parent,
    });
    h.dispatch("message", {
      data: { command: "reload", source: "marshell-app" },
      source: h.win.parent,
    });
    h.dispatch("message", {
      data: { command: "forward", source: "marshell-app" },
      source: {},
    });
    h.dispatch("message", {
      data: { command: "forward", source: "someone-else" },
      source: h.win.parent,
    });
    expect(h.calls).toEqual(["back", "reload"]);
  });
});

interface FakeEl {
  [key: string]: unknown;
}

const el = (over: FakeEl): FakeEl => ({
  clientWidth: 100,
  complete: true,
  firstChild: null,
  getBoundingClientRect: () => ({ height: 20, right: 100, width: 100 }),
  naturalWidth: 10,
  parentElement: null,
  scrollWidth: 100,
  tagName: "DIV",
  ...over,
});

const style = (over: Record<string, string> = {}) => ({
  display: "block",
  fontSize: "16px",
  minWidth: "0px",
  overflowX: "visible",
  visibility: "visible",
  ...over,
});

describe("qa audit", () => {
  const audit = (elements: FakeEl[], styles: Map<FakeEl, object>) => {
    const body = {
      innerText: "hello",
      querySelector: () => null,
      querySelectorAll: () => elements,
    };
    const h = load("http://p/", null, {
      document: {
        addEventListener() {},
        body,
        documentElement: { scrollHeight: 900, scrollWidth: 520 },
        querySelector: () => ({}),
        readyState: "complete",
        title: "Page",
      },
      getComputedStyle: (e: FakeEl) => styles.get(e) ?? style(),
    });
    h.win.innerWidth = 390;
    h.win.innerHeight = 844;
    h.dispatch("message", {
      data: { command: "qa-audit", source: "marshell-app" },
      source: h.win.parent,
    });
    return h.posts.find((p) => p.type === "qa-report")?.payload as Record<
      string,
      any
    >;
  };

  it("reports the real viewport and document size", () => {
    const r = audit([], new Map());
    expect(r).toMatchObject({
      documentWidth: 520,
      hasViewportMeta: true,
      viewportHeight: 844,
      viewportWidth: 390,
    });
  });

  it("only answers a parent request", () => {
    const h = load();
    h.dispatch("message", {
      data: { command: "qa-audit", source: "marshell-app" },
      source: {},
    });
    expect(h.posts.some((p) => p.type === "qa-report")).toBe(false);
  });

  it("lists elements past the right edge but not ones a container clips", () => {
    const wide = el({
      getBoundingClientRect: () => ({ height: 20, right: 520, width: 520 }),
    });
    const clipper = el({});
    const clipped = el({
      getBoundingClientRect: () => ({ height: 20, right: 900, width: 900 }),
      parentElement: clipper,
    });
    const r = audit(
      [wide, clipper, clipped],
      new Map([[clipper, style({ overflowX: "hidden" })]])
    );
    expect(r.overflowing).toHaveLength(1);
    expect(r.overflowing[0].detail).toBe("ends at 520px");
  });

  it("flags min-width beyond the viewport, small text and broken images", () => {
    const fixed = el({});
    const tiny = el({ firstChild: { nodeType: 3, nodeValue: "fine print" } });
    const broken = el({
      complete: true,
      currentSrc: "/x.png",
      naturalWidth: 0,
      tagName: "IMG",
    });
    const r = audit(
      [fixed, tiny, broken],
      new Map<FakeEl, object>([
        [fixed, style({ minWidth: "600px" })],
        [tiny, style({ fontSize: "8px" })],
      ])
    );
    expect(r.fixedWidth[0].detail).toBe("min-width 600px");
    expect(r.smallText).toBe(1);
    expect(r.brokenImages[0].detail).toBe("/x.png");
  });
});

describe("network capture", () => {
  const networkErrors = (h: Harness) =>
    h.posts.filter((p) => p.type === "network-error").map((p) => p.payload);

  it("reports 4xx/5xx and failed fetches, and rethrows the failure", async () => {
    const fetchImpl = (url: string) =>
      url === "/boom"
        ? Promise.reject(new Error("offline"))
        : Promise.resolve({ status: url === "/missing" ? 404 : 200 });
    const h = load("http://p/", null, {}, { fetch: fetchImpl });
    await h.win.fetch("/ok");
    await h.win.fetch("/missing", { method: "POST" });
    await expect(h.win.fetch("/boom")).rejects.toThrow("offline");
    expect(networkErrors(h)).toEqual([
      { kind: "fetch", method: "POST", status: 404, url: "/missing" },
      { kind: "fetch", method: "GET", status: 0, url: "/boom" },
    ]);
  });

  it("ignores dev-server HMR traffic", async () => {
    const h = load(
      "http://p/",
      null,
      {},
      { fetch: () => Promise.resolve({ status: 404 }) }
    );
    await h.win.fetch("/_next/webpack-hmr");
    await h.win.fetch("/__marshell/eruda.js");
    expect(networkErrors(h)).toEqual([]);
  });

  it("reports sub-resources that fail to load", () => {
    const h = load();
    h.dispatch("error", { target: { src: "/logo.png", tagName: "IMG" } });
    h.dispatch("error", { target: { tagName: "DIV" } });
    expect(networkErrors(h)).toEqual([
      { kind: "resource", method: "GET", status: 0, url: "/logo.png" },
    ]);
  });
});

describe("shipped scripts", () => {
  it("all parse as JavaScript", () => {
    for (const name of [
      "bippy_bundle.js",
      "click_to_component_script.js",
      "devtools_script.js",
      "eruda.js",
    ]) {
      expect(() => new Function(read(name)), name).not.toThrow();
    }
  });

  it("inspector speaks the channel the app listens on and supports Alt+click", () => {
    const src = read("click_to_component_script.js");
    expect(src).toContain("'marshell-inspector'");
    expect(src).toContain("event.altKey");
    expect(src).not.toContain("VKBippy");
    expect(read("bippy_bundle.js")).toContain("MarshellBippy");
  });

  it("keeps attribution for adapted third-party code", () => {
    const notice = read("NOTICE.md");
    expect(notice).toContain("Apache License 2.0");
    expect(notice).toContain("MIT");
  });
});

vi.setConfig({ testTimeout: 10_000 });
