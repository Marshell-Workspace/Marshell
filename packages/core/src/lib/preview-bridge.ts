/**
 * Messaging between Marshell and a page shown in the preview iframe. The page gets
 * `public/scripts/*` injected by the preview proxy; these helpers validate everything that
 * comes back, because the previewed page is untrusted code.
 */

export const DEVTOOLS_SOURCE = "marshell-devtools";
export const INSPECTOR_SOURCE = "marshell-inspector";
export const APP_SOURCE = "marshell-app";

export interface NavigationState {
  canGoBack: boolean;
  canGoForward: boolean;
  seq: number;
  title: string;
  url: string;
}

export interface ComponentPayload {
  column?: number;
  component: string;
  cssClass?: string;
  file?: string;
  framework: string;
  htmlPreview: string;
  line?: number;
  stack?: Array<{ file?: string; name: string }>;
  tagName?: string;
}

export interface RuntimeErrorPayload {
  col?: number;
  fromConsole?: boolean;
  line?: number;
  message: string;
  source?: string;
  stack?: string;
}

export interface QaIssue {
  detail: string;
  selector: string;
}

/** Raw layout facts measured inside the previewed page (see `qa-audit` in devtools_script.js). */
export interface QaReport {
  blank: boolean;
  brokenImages: QaIssue[];
  devicePixelRatio: number;
  documentHeight: number;
  documentWidth: number;
  fixedWidth: QaIssue[];
  hasViewportMeta: boolean;
  overflowing: QaIssue[];
  oversizedImages: QaIssue[];
  smallText: number;
  textOverflow: QaIssue[];
  viewportHeight: number;
  viewportWidth: number;
}

export interface NetworkFailure {
  kind: "fetch" | "xhr" | "resource";
  method?: string;
  /** HTTP status, or 0 when the request never completed. */
  status: number;
  url: string;
}

export type PreviewEvent =
  | { kind: "page-snapshot"; snapshot: PreviewSnapshot }
  | { kind: "qa-report"; report: QaReport }
  | { kind: "network-error"; failure: NetworkFailure }
  | { kind: "component"; payload: ComponentPayload }
  | { kind: "eruda-ready" }
  | { kind: "eruda-closed" }
  | { kind: "navigation"; state: NavigationState }
  | { kind: "runtime-error"; payload: RuntimeErrorPayload };

export interface PreviewSnapshot {
  headings: string[];
  height: number;
  text: string;
  title: string;
  width: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
const optStr = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;
const optNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const MAX_QA_ISSUES = 20;

function parseIssues(v: unknown): QaIssue[] {
  if (!Array.isArray(v)) {
    return [];
  }
  return v
    .filter(isRecord)
    .slice(0, MAX_QA_ISSUES)
    .map((i) => ({
      detail: str(i.detail).slice(0, 200),
      selector: str(i.selector).slice(0, 200),
    }));
}

const NETWORK_KINDS = new Set(["fetch", "xhr", "resource"]);

/** Structural validation of a postMessage payload; anything unexpected yields null. */
export function parsePreviewMessage(data: unknown): PreviewEvent | null {
  if (
    !isRecord(data) ||
    (!isRecord(data.payload) && data.payload !== undefined)
  ) {
    return null;
  }
  const payload = isRecord(data.payload) ? data.payload : {};

  if (data.source === DEVTOOLS_SOURCE) {
    if (data.type === "page-snapshot" && typeof payload.text === "string") {
      return {
        kind: "page-snapshot",
        snapshot: {
          title: str(payload.title).slice(0, 500),
          text: payload.text.slice(0, 12_000),
          headings: Array.isArray(payload.headings)
            ? payload.headings
                .filter(
                  (heading): heading is string => typeof heading === "string"
                )
                .slice(0, 50)
                .map((heading) => heading.slice(0, 300))
            : [],
          width: optNum(payload.width) ?? 0,
          height: optNum(payload.height) ?? 0,
        },
      };
    }
    if (data.type === "qa-report") {
      return {
        kind: "qa-report",
        report: {
          blank: payload.blank === true,
          brokenImages: parseIssues(payload.brokenImages),
          devicePixelRatio: optNum(payload.devicePixelRatio) ?? 1,
          documentHeight: optNum(payload.documentHeight) ?? 0,
          documentWidth: optNum(payload.documentWidth) ?? 0,
          fixedWidth: parseIssues(payload.fixedWidth),
          hasViewportMeta: payload.hasViewportMeta === true,
          oversizedImages: parseIssues(payload.oversizedImages),
          overflowing: parseIssues(payload.overflowing),
          smallText: optNum(payload.smallText) ?? 0,
          textOverflow: parseIssues(payload.textOverflow),
          viewportHeight: optNum(payload.viewportHeight) ?? 0,
          viewportWidth: optNum(payload.viewportWidth) ?? 0,
        },
      };
    }
    if (
      data.type === "network-error" &&
      typeof payload.url === "string" &&
      typeof payload.kind === "string" &&
      NETWORK_KINDS.has(payload.kind)
    ) {
      return {
        kind: "network-error",
        failure: {
          kind: payload.kind as NetworkFailure["kind"],
          method: optStr(payload.method),
          status: optNum(payload.status) ?? 0,
          url: payload.url.slice(0, 500),
        },
      };
    }
    if (data.type === "eruda-ready") {
      return { kind: "eruda-ready" };
    }
    if (data.type === "eruda-closed") {
      return { kind: "eruda-closed" };
    }
    if (data.type === "navigation" && typeof payload.url === "string") {
      return {
        kind: "navigation",
        state: {
          canGoBack: payload.canGoBack === true,
          canGoForward: payload.canGoForward === true,
          seq: optNum(payload.seq) ?? 0,
          title: str(payload.title),
          url: payload.url,
        },
      };
    }
    if (data.type === "runtime-error" && typeof payload.message === "string") {
      return {
        kind: "runtime-error",
        payload: {
          col: optNum(payload.col),
          fromConsole: payload.fromConsole === true,
          line: optNum(payload.line),
          message: payload.message,
          source: optStr(payload.source),
          stack: optStr(payload.stack),
        },
      };
    }
    return null;
  }

  if (
    data.source === INSPECTOR_SOURCE &&
    data.type === "component-detected" &&
    typeof payload.component === "string"
  ) {
    const stack = Array.isArray(payload.stack)
      ? payload.stack
          .filter(isRecord)
          .map((e) => ({ file: optStr(e.file), name: str(e.name) }))
      : undefined;
    return {
      kind: "component",
      payload: {
        column: optNum(payload.column),
        component: payload.component,
        cssClass: optStr(payload.cssClass),
        file: optStr(payload.file),
        framework: str(payload.framework, "html"),
        htmlPreview: str(payload.htmlPreview),
        line: optNum(payload.line),
        stack,
        tagName: optStr(payload.tagName),
      },
    };
  }
  return null;
}

/** Only accept messages from our own iframe, served from the expected proxy origin. */
export function isTrustedMessage(
  event: { origin: string; source: unknown },
  frameWindow: unknown,
  proxyOrigin: string | null
): boolean {
  return (
    proxyOrigin !== null &&
    frameWindow !== null &&
    frameWindow !== undefined &&
    event.source === frameWindow &&
    event.origin === proxyOrigin
  );
}

export const appCommand = (
  command:
    | "back"
    | "forward"
    | "reload"
    | "toggle-eruda"
    | "inspect-page"
    | "qa-audit"
) => ({
  command,
  source: APP_SOURCE,
});

export const inspectorCommand = (active: boolean) => ({
  payload: { active },
  source: INSPECTOR_SOURCE,
  type: "toggle-inspect",
});

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

export interface PreviewTarget {
  path: string;
  port: number;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);
const MAX_PORT = 65_535;

/**
 * Accepts `3000`, `:3000`, `localhost:3000/a?b#c`, `http://127.0.0.1:5173/`. Only local dev
 * servers can be previewed, since the proxy connects to loopback.
 */
export function parsePreviewUrl(
  input: string
): { error: string } | { target: PreviewTarget } {
  const raw = input.trim();
  if (!raw) {
    return { error: "Enter a port or URL, e.g. 3000 or localhost:5173" };
  }
  if (/^:?\d+$/.test(raw)) {
    return validatePort(Number(raw.replace(":", "")), "/");
  }
  if (/^https:\/\//i.test(raw)) {
    return { error: "HTTPS dev servers aren't supported; use http://" };
  }
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`);
  } catch {
    return { error: "That doesn't look like a URL" };
  }
  if (url.protocol !== "http:") {
    return { error: "Only http:// dev servers can be previewed" };
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    return { error: "Only local dev servers (localhost) can be previewed" };
  }
  if (!url.port) {
    return { error: "Include the dev server's port, e.g. localhost:3000" };
  }
  return validatePort(
    Number(url.port),
    `${url.pathname}${url.search}${url.hash}`
  );
}

function validatePort(
  port: number,
  path: string
): { error: string } | { target: PreviewTarget } {
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    return { error: `Port must be between 1 and ${MAX_PORT}` };
  }
  return { target: { path, port } };
}

/** The iframe URL for a target, given the proxy's origin. */
export const toProxyUrl = (origin: string, target: PreviewTarget): string =>
  `${origin}${target.path}`;

/** Shows an address the user recognises (localhost:PORT) instead of the proxy's. */
export function toDisplayUrl(
  href: string,
  proxyOrigin: string,
  targetPort: number
): string {
  return href.startsWith(proxyOrigin)
    ? `http://localhost:${targetPort}${href.slice(proxyOrigin.length) || "/"}`
    : href;
}

// ---------------------------------------------------------------------------
// Component locations
// ---------------------------------------------------------------------------

const normalizeSlashes = (p: string) => p.replace(/\\/g, "/");

/** Real filesystem roots; any other leading-slash path is a dev-server URL path like /src/App.tsx. */
const FILESYSTEM_ROOT =
  /^\/(home|Users|usr|var|tmp|opt|mnt|private|root|srv|Volumes|workspace|app)\//;

/** Next.js reports route folders percent-encoded, e.g. `%5Blocale%5D` for `[locale]`. */
function decodePath(path: string): string {
  if (!path.includes("%")) {
    return path;
  }
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** Project-relative path without query strings, e.g. `src/components/Header.tsx`. */
export function relativizePath(file: string, rootDir?: string): string {
  let path = decodePath(normalizeSlashes(file).split(/[?#]/)[0] ?? "");
  if (rootDir) {
    const root = normalizeSlashes(rootDir).replace(/\/+$/, "");
    if (root && path.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
      path = path.slice(root.length + 1);
    }
  }
  path = path.replace(/^\.\//, "");
  return path.startsWith("/") && !FILESYSTEM_ROOT.test(path)
    ? path.slice(1)
    : path;
}

/** Clean, human-friendly relative path for UI display (e.g. `packages/core/src/.../auth-provider.tsx`). */
export function formatDisplayPath(location: string): string {
  const norm = normalizeSlashes(location);
  const match = norm.match(
    /(?:^|[/\\])((?:packages|src|app|pages|components|lib)[/\\].*)$/i
  );
  if (match?.[1]) {
    return match[1];
  }
  const parts = norm.split("/");
  if (parts.length > 3) {
    return `…/${parts.slice(-3).join("/")}`;
  }
  return norm;
}

/** `src/components/Header.tsx:42` (or just the component name when no source is known). */
export function formatComponentLocation(
  p: ComponentPayload,
  rootDir?: string
): string {
  if (!p.file) {
    return p.component;
  }
  const file = relativizePath(p.file, rootDir);
  return p.line ? `${file}:${p.line}` : file;
}

/** Context block for the agent prompt: where the element lives and what it looks like. */
export function formatComponentContext(
  p: ComponentPayload,
  rootDir?: string
): string {
  const lines = [
    `Selected element in the app preview: <${p.component}> (${p.framework})`,
    `Location: ${formatComponentLocation(p, rootDir)}`,
  ];
  if (p.stack?.length) {
    lines.push(
      "Component stack:",
      ...p.stack.map(
        (e) =>
          `  in ${e.name || "(anonymous)"}${e.file ? ` (${relativizePath(e.file, rootDir)})` : ""}`
      )
    );
  }
  if (p.htmlPreview) {
    lines.push("```html", p.htmlPreview, "```");
  }
  return lines.join("\n");
}
