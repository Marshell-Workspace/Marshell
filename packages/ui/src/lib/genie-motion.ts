"use client";

import {
  collectFontFamilies,
  snapshotFontStyles,
} from "@workspace/ui/lib/snapshot-fonts";

// Workspace panel deformation, anchored to the button used to open it.

export interface GenieRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface GenieRestingBounds {
  centerX: number;
  centerY: number;
  height: number;
  left: number;
  top: number;
  width: number;
}

export const GENIE_OPEN_DURATION_MS = 440;
export const GENIE_CLOSE_DURATION_MS = 400;
const REDUCED_MOTION_DURATION_MS = 120;
/** Past this, skip the animation rather than leave the surface invisible. */
const SNAPSHOT_TIMEOUT_MS = 1000;

let lastRecordedTriggerElement: HTMLElement | null = null;
let lastRecordedTriggerRect: GenieRect | null = null;
let triggerListenerAttached = false;

const TRIGGER_SELECTOR =
  '[data-workspace-trigger], [data-new-workspace-btn], [data-genie-trigger], [data-settings-trigger], [aria-label="New Workspace"], [aria-label="Settings"]';
const SURFACE_SELECTOR = '[data-slot="genie-modal-surface"]';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Standard CSS cubic-bezier easing, solved with Newton's method. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  return (x: number): number => {
    if (x <= 0) {
      return 0;
    }
    if (x >= 1) {
      return 1;
    }
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = ((ax * t + bx) * t + cx) * t - x;
      const slope = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(error) < 1e-5 || Math.abs(slope) < 1e-6) {
        break;
      }
      t -= error / slope;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}

// macOS restores with a fast launch that settles gently, and minimizes with an
// unhurried start that gathers speed into the Dock.
const openEase = cubicBezier(0.2, 0.7, 0.2, 1);
const closeEase = cubicBezier(0.45, 0, 0.5, 1);

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function isReducedMotionPreferred(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function recordGenieTrigger(el: HTMLElement | null): void {
  if (!el || typeof window === "undefined") {
    return;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width > 2 && rect.height > 2) {
    lastRecordedTriggerElement = el;
    lastRecordedTriggerRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }
}

export function ensureGenieTriggerListener(): void {
  if (typeof window === "undefined" || triggerListenerAttached) {
    return;
  }
  triggerListenerAttached = true;

  const handleActivation = (e: Event) => {
    const target = e.target;
    if (!(target instanceof Element)) {
      return;
    }
    const trigger = target.closest<HTMLElement>(TRIGGER_SELECTOR);
    // Controls inside a genie surface are never origins for a later session.
    if (trigger && !trigger.closest(SURFACE_SELECTOR)) {
      recordGenieTrigger(trigger);
    }
  };

  window.addEventListener("pointerdown", handleActivation, {
    capture: true,
    passive: true,
  });
  // Keyboard activation (Enter/Space) never fires pointerdown.
  window.addEventListener("click", handleActivation, {
    capture: true,
    passive: true,
  });
}

if (typeof window !== "undefined") {
  ensureGenieTriggerListener();
}

function isUsableRect(r: DOMRect): boolean {
  return r.width > 5 && r.height > 5;
}

function toGenieRect(r: DOMRect): GenieRect {
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/**
 * Searches the DOM for the New Workspace button in the sidebar.
 */
export function findNewWorkspaceButton(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  const selectors = [
    '[data-workspace-trigger="new-workspace"]',
    '[data-workspace-trigger="new-workspace-collapsed"]',
    '[data-workspace-trigger="new-workspace-header"]',
    "button.group\\/new-ws",
    "button.group\\/new-ws-collapsed",
    '[aria-label="New Workspace"]',
  ];
  for (const selector of selectors) {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(selector)
    );
    for (const el of elements) {
      if (el.isConnected) {
        const r = el.getBoundingClientRect();
        if (
          r.width > 5 &&
          r.height > 5 &&
          r.bottom > 0 &&
          r.right > 0 &&
          r.top < window.innerHeight &&
          r.left < window.innerWidth
        ) {
          return el;
        }
      }
    }
  }
  return null;
}

export interface GenieOrigin {
  element: HTMLElement | null;
  rect: GenieRect;
}

function defaultOriginRect(): GenieRect {
  const width = 220;
  const rtl =
    typeof document !== "undefined" && document.documentElement.dir === "rtl";
  const left =
    rtl && typeof window !== "undefined"
      ? Math.max(0, window.innerWidth - 16 - width)
      : 16;
  return { left, top: 85, width, height: 36 };
}

/**
 * Resolves the trigger element and bounding rect. Live elements win over the
 * rect locked at open, so a moved or collapsed sidebar is followed on close.
 */
export function resolveGenieOrigin(
  explicitTrigger?: HTMLElement | null,
  fallbackSelector?: string,
  lockedOrigin?: GenieRect | null
): GenieOrigin {
  // 1. Explicit trigger
  if (explicitTrigger?.isConnected) {
    const r = explicitTrigger.getBoundingClientRect();
    if (isUsableRect(r)) {
      return { element: explicitTrigger, rect: toGenieRect(r) };
    }
  }

  // 2. Any visible element matching the caller's selector; the most recently
  //    clicked one wins. Every match is checked, since variants may be hidden.
  if (typeof document !== "undefined" && fallbackSelector) {
    let first: HTMLElement | null = null;
    for (const el of document.querySelectorAll<HTMLElement>(fallbackSelector)) {
      if (el.isConnected && isUsableRect(el.getBoundingClientRect())) {
        if (el === lastRecordedTriggerElement) {
          first = el;
          break;
        }
        first ??= el;
      }
    }
    if (first) {
      return {
        element: first,
        rect: toGenieRect(first.getBoundingClientRect()),
      };
    }
  }

  // 3. A session keeps its own origin, even if another popup records a trigger.
  if (lockedOrigin && lockedOrigin.width > 0 && lockedOrigin.height > 0) {
    return { element: null, rect: lockedOrigin };
  }

  // 4. Last recorded trigger element
  if (
    lastRecordedTriggerElement?.isConnected &&
    (!fallbackSelector || lastRecordedTriggerElement.matches(fallbackSelector))
  ) {
    const r = lastRecordedTriggerElement.getBoundingClientRect();
    if (isUsableRect(r)) {
      return { element: lastRecordedTriggerElement, rect: toGenieRect(r) };
    }
  }

  // 5. The sidebar's New Workspace button, only for callers with no selector
  //    of their own (otherwise e.g. Settings would fly to the wrong button).
  if (!fallbackSelector) {
    const btn = findNewWorkspaceButton();
    if (btn) {
      return { element: btn, rect: toGenieRect(btn.getBoundingClientRect()) };
    }
  }

  // 6. Last recorded rect
  if (lastRecordedTriggerRect && lastRecordedTriggerRect.width > 5) {
    return { element: null, rect: lastRecordedTriggerRect };
  }

  // 7. Default sidebar button location
  return { element: null, rect: defaultOriginRect() };
}

export function resolveGenieOriginRect(
  explicitTrigger?: HTMLElement | null,
  fallbackSelector?: string,
  lockedOrigin?: GenieRect | null
): GenieRect {
  return resolveGenieOrigin(explicitTrigger, fallbackSelector, lockedOrigin)
    .rect;
}

export interface RestingBoundsOptions {
  maxHeight?: number;
  maxWidth?: number;
  vhRatio?: number;
  vwRatio?: number;
}

/**
 * Calculates resting modal viewport dimensions.
 */
export function calculateRestingBounds(
  options?: RestingBoundsOptions
): GenieRestingBounds {
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;

  const maxWidth = options?.maxWidth ?? 1400;
  const maxHeight = options?.maxHeight ?? 960;
  const vwRatio = options?.vwRatio ?? 0.97;
  const vhRatio = options?.vhRatio ?? 0.94;

  const width = Math.min(maxWidth, Math.round(vw * vwRatio));
  const height = Math.min(maxHeight, Math.round(vh * vhRatio));
  const left = Math.round((vw - width) / 2);
  const top = Math.round((vh - height) / 2);

  return {
    left,
    top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
}

const GENIE_STRIP_COUNT = 80;
const STRIP_OVERLAP = 0.75;
const MAX_SNAPSHOT_PIXELS = 2_000_000;
const imageDataCache = new Map<string, Promise<string | null>>();

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export type GenieEdge = "left" | "right" | "top" | "bottom";

export function getGenieEdge(
  origin: GenieRect,
  bounds: GenieRestingBounds
): GenieEdge {
  const x = (origin.left + origin.width / 2 - bounds.centerX) / bounds.width;
  const y = (origin.top + origin.height / 2 - bounds.centerY) / bounds.height;
  if (Math.abs(x) >= Math.abs(y)) {
    return x <= 0 ? "left" : "right";
  }
  return y <= 0 ? "top" : "bottom";
}

/** The sheet crosses the button edge facing the panel, never its center. */
export function getGenieAnchor(origin: GenieRect, edge: GenieEdge): number {
  switch (edge) {
    case "left":
      return origin.left + origin.width;
    case "right":
      return origin.left;
    case "top":
      return origin.top + origin.height;
    case "bottom":
      return origin.top;
    default:
      return origin.left + origin.width;
  }
}

export interface GenieStation {
  axis: number;
  end: number;
  start: number;
}

/** A material section moving through a fixed funnel, rather than shrinking in place. */
export function computeGenieStation(
  progress: number,
  station: number,
  origin: GenieRect,
  bounds: GenieRestingBounds,
  edge = getGenieEdge(origin, bounds)
): GenieStation {
  const closing = 1 - clamp(progress, 0, 1);
  const vertical = edge === "top" || edge === "bottom";
  const reverse = edge === "right" || edge === "bottom";
  const direction = reverse ? -1 : 1;
  const panelStart = vertical ? bounds.top : bounds.left;
  const panelLength = vertical ? bounds.height : bounds.width;
  const anchor = getGenieAnchor(origin, edge);
  const crossAnchor = vertical
    ? origin.left + origin.width / 2
    : origin.top + origin.height / 2;
  const crossStart = vertical ? bounds.left : bounds.top;
  const crossLength = vertical ? bounds.width : bounds.height;
  const mouth = vertical ? origin.width : origin.height;
  const near = (panelStart + (reverse ? panelLength : 0) - anchor) * direction;
  const far = (panelStart + (reverse ? 0 : panelLength) - anchor) * direction;
  const material = reverse ? 1 - station : station;
  const pinch = smoothstep(closing / 0.34);
  const travel = smoothstep((closing - 0.18) / 0.82);
  const distance = lerp(lerp(near, 0, pinch), far, material) - far * travel;
  const flare = smoothstep(distance / Math.max(far, 1));
  const spread = lerp(1, flare, pinch);
  const center = lerp(crossAnchor, crossStart + crossLength / 2, spread);
  const span = lerp(mouth, crossLength, spread);
  return {
    axis: anchor + direction * distance,
    start: center - span / 2,
    end: center + span / 2,
  };
}

/** Clip sections after they enter the button, including triggers inside the panel. */
export function getGenieClipPath(
  progress: number,
  origin: GenieRect,
  bounds: GenieRestingBounds,
  edge: GenieEdge
): string {
  const pinch = smoothstep((1 - progress) / 0.34);
  const x = getGenieAnchor(origin, edge);
  const y = x;
  switch (edge) {
    case "left":
      return `inset(0 0 0 ${Math.max(0, lerp(bounds.left, x, pinch))}px)`;
    case "right":
      return `inset(0 max(0px, calc(100% - ${lerp(bounds.left + bounds.width, x, pinch)}px)) 0 0)`;
    case "top":
      return `inset(${Math.max(0, lerp(bounds.top, y, pinch))}px 0 0 0)`;
    case "bottom":
      return `inset(0 0 max(0px, calc(100% - ${lerp(bounds.top + bounds.height, y, pinch)}px)) 0)`;
    default:
      return "none";
  }
}

interface GenieStrip {
  element: HTMLDivElement;
  station: number;
}

// Keep progress across direction changes (e.g. Escape during opening).
const surfaceProgress = new WeakMap<HTMLElement, number>();

// Capture resolved styles once. A shared SVG image avoids laying out dozens of
// live form copies (which can consume the entire animation before a second paint).
const SNAPSHOT_STYLES = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "box-sizing",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-radius",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "color",
  "opacity",
  "box-shadow",
  "overflow",
  "overflow-x",
  "overflow-y",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-stretch",
  "font-kerning",
  "font-feature-settings",
  "font-variation-settings",
  "font-optical-sizing",
  "font-synthesis",
  "font-variant",
  "word-spacing",
  "-webkit-font-smoothing",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "text-decoration",
  "white-space",
  "word-break",
  "text-overflow",
  "vertical-align",
  "object-fit",
  "object-position",
  "flex-direction",
  "flex-wrap",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "align-items",
  "align-self",
  "align-content",
  "justify-content",
  "gap",
  "grid-template-columns",
  "grid-template-rows",
  "grid-column",
  "grid-row",
  "transform",
  "transform-origin",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "clip-path",
  "visibility",
  "z-index",
  // Tailwind v4 emits individual transform properties, not `transform`.
  "translate",
  "rotate",
  "scale",
  "outline",
  "outline-offset",
  "text-shadow",
  "filter",
  "mix-blend-mode",
  "background-repeat",
  "background-origin",
  "background-clip",
  "-webkit-background-clip",
  "-webkit-line-clamp",
  "-webkit-box-orient",
  "list-style",
  "aspect-ratio",
  "overflow-wrap",
  "text-wrap",
  "text-indent",
  "tab-size",
  "color-scheme",
  "accent-color",
  "order",
  "row-gap",
  "column-gap",
  "justify-items",
  "justify-self",
  "grid-auto-flow",
  "grid-auto-rows",
  "grid-auto-columns",
  "float",
  "clear",
  "fill-opacity",
  "stroke-opacity",
  "stroke-dashoffset",
  "stroke-miterlimit",
] as const;

const PSEUDO_STYLES = [
  "content",
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "margin",
  "padding",
  "box-sizing",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "border",
  "border-radius",
  "color",
  "opacity",
  "box-shadow",
  "transform",
  "translate",
  "rotate",
  "scale",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-transform",
  "flex",
  "align-self",
  "z-index",
] as const;

const PLACEHOLDER_STYLES = [
  "color",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "letter-spacing",
  "text-transform",
] as const;

const IMAGE_FETCH_TIMEOUT_MS = 600;
const MAX_CANVAS_COPY_PIXELS = 1_000_000;
const URL_FUNCTION = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/g;

function readBlobAsDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function fetchDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      cache: "force-cache",
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    return await readBlobAsDataUrl(await response.blob());
  } catch {
    return null;
  }
}

function cachedDataUrl(
  url: string,
  load: () => Promise<string | null>
): Promise<string | null> {
  let pending = imageDataCache.get(url);
  if (!pending) {
    pending = load();
    if (imageDataCache.size >= 48) {
      imageDataCache.clear();
    }
    imageDataCache.set(url, pending);
    pending.then((data) => {
      if (!data) {
        imageDataCache.delete(url);
      }
    });
  }
  return pending;
}

async function inlineSnapshotImage(
  source: HTMLImageElement,
  clone: HTMLImageElement
): Promise<void> {
  const url = source.currentSrc || source.src;
  if (!url || url.startsWith("data:")) {
    return;
  }
  const data = await cachedDataUrl(url, async () => {
    // Small loaded images are copied directly; large ones use the compressed
    // original so the cache does not retain huge uncompressed data URLs.
    if (
      source.complete &&
      source.naturalWidth &&
      source.naturalWidth * source.naturalHeight <= MAX_CANVAS_COPY_PIXELS
    ) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = source.naturalWidth;
        canvas.height = source.naturalHeight;
        const context = canvas.getContext("2d");
        if (context) {
          context.drawImage(source, 0, 0);
          return canvas.toDataURL();
        }
      } catch {
        /* Cross-origin images require a CORS-enabled fetch. */
      }
    }
    return await fetchDataUrl(url);
  });
  clone.removeAttribute("srcset");
  if (data) {
    clone.src = data;
  } else {
    clone.removeAttribute("src");
  }
}

/** SVG images cannot load external resources, so url() backgrounds must be embedded. */
async function inlineBackgroundImage(
  clone: HTMLElement,
  backgroundImage: string
): Promise<void> {
  const references = [...backgroundImage.matchAll(URL_FUNCTION)];
  let result = backgroundImage;
  for (const match of references) {
    const url = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!url || url.startsWith("data:")) {
      continue;
    }
    const absolute = new URL(url, document.baseURI).href;
    const data = await cachedDataUrl(absolute, () => fetchDataUrl(absolute));
    result = result.replace(match[0], data ? `url("${data}")` : "none");
  }
  clone.style.setProperty("background-image", result);
}

/** XML 1.0 forbids most control characters; one in a field value fails the whole snapshot. */
function stripXmlInvalidCharacters(value: string): string {
  let result = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const allowed =
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code !== 0xff_fe && code !== 0xff_ff);
    if (allowed) {
      result += char;
    }
  }
  return result;
}

/** Collects `::before`/`::after`/`::placeholder` rules; classes are stripped from the clone. */
function collectPseudoRules(
  source: HTMLElement,
  id: string,
  rules: string[]
): void {
  for (const pseudo of ["::before", "::after"] as const) {
    const style = getComputedStyle(source, pseudo);
    if (
      !style.content ||
      style.content === "none" ||
      style.content === "normal"
    ) {
      continue;
    }
    const declarations = PSEUDO_STYLES.map(
      (property) => `${property}:${style.getPropertyValue(property)}`
    ).join(";");
    rules.push(`[data-genie-snap="${id}"]${pseudo}{${declarations}}`);
  }
  if (
    (source instanceof HTMLInputElement ||
      source instanceof HTMLTextAreaElement) &&
    source.placeholder
  ) {
    const style = getComputedStyle(source, "::placeholder");
    const declarations = PLACEHOLDER_STYLES.map(
      (property) => `${property}:${style.getPropertyValue(property)}`
    ).join(";");
    rules.push(`[data-genie-snap="${id}"]::placeholder{${declarations}}`);
  }
}

function copyFormState(source: HTMLElement, clone: HTMLElement): void {
  if (clone instanceof HTMLInputElement && source instanceof HTMLInputElement) {
    // Masked fields only need the right length; never serialize the secret.
    const value =
      source.type === "password"
        ? "x".repeat(source.value.length)
        : stripXmlInvalidCharacters(source.value);
    clone.setAttribute("value", value);
    if (source.checked) {
      clone.setAttribute("checked", "");
    } else {
      clone.removeAttribute("checked");
    }
  } else if (
    clone instanceof HTMLTextAreaElement &&
    source instanceof HTMLTextAreaElement
  ) {
    clone.textContent = stripXmlInvalidCharacters(source.value);
  } else if (
    clone instanceof HTMLSelectElement &&
    source instanceof HTMLSelectElement
  ) {
    for (const [index, option] of [...source.options].entries()) {
      const cloned = clone.options[index];
      if (option.selected) {
        cloned?.setAttribute("selected", "");
      } else {
        cloned?.removeAttribute("selected");
      }
    }
  }
}

const MEASURE_RANGE =
  typeof document === "undefined" ? null : document.createRange();
const LINE_TOLERANCE = 0.5;

function hasOwnText(element: HTMLElement): boolean {
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      return true;
    }
  }
  return false;
}

/** True when all of an element's text sits on one line in the live layout. */
function isSingleLineText(element: HTMLElement): boolean {
  if (!MEASURE_RANGE || typeof MEASURE_RANGE.getClientRects !== "function") {
    return false;
  }
  MEASURE_RANGE.selectNodeContents(element);
  const rects = [...MEASURE_RANGE.getClientRects()].filter(
    (rect) => rect.width > 0 && rect.height > 0
  );
  const [first] = rects;
  if (!first) {
    return false;
  }
  const middle = (first.top + first.bottom) / 2;
  return rects.every(
    (rect) =>
      Math.abs((rect.top + rect.bottom) / 2 - middle) <
      Math.max(first.height, rect.height) * LINE_TOLERANCE
  );
}

/** True when every flex item shares one line, i.e. the container did not wrap. */
function isSingleLineFlexRow(element: HTMLElement): boolean {
  const rects = [...element.children]
    .map((child) => child.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  return rects.every((rect, index) => {
    const previous = rects[index - 1];
    return (
      !previous || (rect.top < previous.bottom && rect.bottom > previous.top)
    );
  });
}

/**
 * The clone is laid out again from copied pixel sizes, so a box sized exactly to
 * its content can come out a fraction of a pixel too narrow and wrap ("Get CLI"
 * onto two lines, a button group onto a second row). Where the live layout did
 * not wrap, forbid wrapping in the snapshot.
 */
function keepLiveLineBreaks(
  source: HTMLElement,
  clone: HTMLElement,
  computed: CSSStyleDeclaration
): void {
  const { display } = computed;
  const isFlex = display === "flex" || display === "inline-flex";
  if (
    isFlex &&
    computed.flexWrap !== "nowrap" &&
    computed.flexDirection.startsWith("row") &&
    isSingleLineFlexRow(source)
  ) {
    clone.style.setProperty("flex-wrap", "nowrap");
  }
  if (
    computed.whiteSpace === "normal" &&
    display !== "inline" &&
    display !== "contents" &&
    display !== "none" &&
    hasOwnText(source) &&
    isSingleLineText(source)
  ) {
    clone.style.setProperty("white-space", "nowrap");
  }
}

/** Canvas bitmaps are not cloned; swap in an image of their current contents. */
function replaceCanvasWithImage(
  source: HTMLCanvasElement,
  clone: HTMLCanvasElement
): void {
  try {
    const image = document.createElement("img");
    image.src = source.toDataURL();
    image.setAttribute("style", clone.getAttribute("style") ?? "");
    clone.replaceWith(image);
  } catch {
    /* A tainted canvas stays blank in the snapshot. */
  }
}

interface GenieSnapshot {
  count: number;
  dispose: () => void;
  layer: HTMLDivElement;
  length: number;
  strips: GenieStrip[];
}

/** Capture once for GPU deformation; callers own and release the returned raster. */
export async function capturePopupRaster(
  surface: HTMLElement,
  bounds: Pick<GenieRestingBounds, "width" | "height">,
  gpuCompatible = false
): Promise<HTMLCanvasElement> {
  const template = surface.cloneNode(true) as HTMLElement;
  const sources = [surface, ...surface.querySelectorAll<HTMLElement>("*")];
  const clones = [template, ...template.querySelectorAll<HTMLElement>("*")];
  const images: Promise<void>[] = [];
  const families = new Set<string>();
  const pseudoRules: string[] = [];
  const canvases: [HTMLCanvasElement, HTMLCanvasElement][] = [];
  for (const [index, clone] of clones.entries()) {
    const source = sources[index];
    if (!source) {
      continue;
    }
    const computed = getComputedStyle(source);
    collectFontFamilies(computed.fontFamily, families);
    for (const property of SNAPSHOT_STYLES) {
      clone.style.setProperty(property, computed.getPropertyValue(property));
    }
    // Classes are removed (their rules do not exist inside the SVG image), so
    // pseudo-element and placeholder styling is re-emitted by snapshot id.
    // The resolved fill colour is only worth copying when it differs from the
    // text colour (gradient text). Copying it always would also be inherited by
    // `::placeholder`, turning grey placeholders into value-coloured text.
    const textFill = computed.getPropertyValue("-webkit-text-fill-color");
    if (textFill && textFill !== computed.color) {
      clone.style.setProperty("-webkit-text-fill-color", textFill);
    }
    clone.removeAttribute("class");
    clone.setAttribute("data-genie-snap", String(index));
    collectPseudoRules(source, String(index), pseudoRules);
    clone.style.animation = "none";
    clone.style.transition = "none";
    clone.style.setProperty("scrollbar-width", "none");
    clone.style.setProperty("-ms-overflow-style", "none");
    copyFormState(source, clone);
    keepLiveLineBreaks(source, clone, computed);
    if (computed.backgroundImage.includes("url(")) {
      images.push(inlineBackgroundImage(clone, computed.backgroundImage));
    }
    if (
      clone instanceof HTMLImageElement &&
      source instanceof HTMLImageElement
    ) {
      images.push(inlineSnapshotImage(source, clone));
    }
    if (
      clone instanceof HTMLCanvasElement &&
      source instanceof HTMLCanvasElement
    ) {
      canvases.push([source, clone]);
    }
  }
  for (const [index, source] of sources.entries()) {
    const clone = clones[index];
    if (!(clone && (source.scrollTop || source.scrollLeft))) {
      continue;
    }
    for (const child of clone.children) {
      // Sticky/fixed children stay where they are pinned in the scrolled view.
      if (
        child instanceof HTMLElement &&
        child.style.position !== "sticky" &&
        child.style.position !== "fixed"
      ) {
        const transform =
          child.style.transform === "none" ? "" : child.style.transform;
        child.style.transform = `translate(${-source.scrollLeft}px, ${-source.scrollTop}px) ${transform}`;
      }
    }
  }
  for (const [source, clone] of canvases) {
    replaceCanvasWithImage(source, clone);
  }
  Object.assign(template.style, {
    position: "relative",
    left: "0px",
    top: "0px",
    margin: "0",
    transform: "none",
    filter: "none",
    translate: "none",
    rotate: "none",
    scale: "none",
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    maxWidth: "none",
    maxHeight: "none",
    opacity: "1",
    visibility: "visible",
    scrollbarWidth: "none",
  });
  const [fontCss] = await Promise.all([
    snapshotFontStyles(families),
    Promise.all(images),
  ]);
  const fontStyle = document.createElement("style");
  fontStyle.textContent = `
    * {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    *::-webkit-scrollbar,
    ::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    ${pseudoRules.join("\n")}
    ${fontCss}
  `;
  template.prepend(fontStyle);
  const markup = new XMLSerializer().serializeToString(template);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
  const url = gpuCompatible
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    : URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
      );
  const bitmap = new Image();
  bitmap.src = url;
  try {
    await bitmap.decode();
  } finally {
    if (!gpuCompatible) {
      URL.revokeObjectURL(url);
    }
  }

  const resolution = Math.min(
    clamp(window.devicePixelRatio || 1, 1, 2),
    Math.sqrt(MAX_SNAPSHOT_PIXELS / Math.max(1, bounds.width * bounds.height))
  );
  const raster = document.createElement("canvas");
  raster.width = Math.ceil(bounds.width * resolution);
  raster.height = Math.ceil(bounds.height * resolution);
  const rasterContext = raster.getContext("2d");
  if (!rasterContext) {
    throw new Error("Canvas snapshot is unavailable");
  }
  rasterContext.drawImage(bitmap, 0, 0, raster.width, raster.height);
  return raster;
}

// --- Pre-captured raster ----------------------------------------------------
// Closing used to wait for a fresh capture, so the dialog sat still for a beat
// after the click. While the dialog is open and idle we keep a raster ready.

const RASTER_IDLE_MS = 450;

interface SurfaceRasterCache {
  bounds: Pick<GenieRestingBounds, "width" | "height">;
  raster: HTMLCanvasElement | null;
  version: number;
}

const rasterCaches = new WeakMap<HTMLElement, SurfaceRasterCache>();

function releaseRaster(cache: SurfaceRasterCache): void {
  if (cache.raster) {
    cache.raster.width = 0;
    cache.raster.height = 0;
    cache.raster = null;
  }
}

/** Keeps a current raster of an open, idle surface. Returns a stop function. */
export function watchGenieSurface(
  surface: HTMLElement,
  bounds: Pick<GenieRestingBounds, "width" | "height">
): () => void {
  if (
    typeof window === "undefined" ||
    typeof MutationObserver === "undefined" ||
    isReducedMotionPreferred()
  ) {
    return () => undefined;
  }
  const cache: SurfaceRasterCache = {
    bounds: { width: bounds.width, height: bounds.height },
    raster: null,
    version: 0,
  };
  const previous = rasterCaches.get(surface);
  if (previous) {
    previous.version++;
    releaseRaster(previous);
  }
  rasterCaches.set(surface, cache);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const capture = async () => {
    const version = cache.version;
    try {
      const raster = await capturePopupRaster(surface, cache.bounds);
      if (stopped || version !== cache.version) {
        raster.width = 0;
        raster.height = 0;
        return;
      }
      cache.raster = raster;
    } catch {
      /* Closing falls back to a fresh capture. */
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(capture, RASTER_IDLE_MS);
  };
  const invalidate = () => {
    cache.version++;
    releaseRaster(cache);
    schedule();
  };
  // Attribute churn on the surface itself (opacity, inert, data-state) never
  // changes what the content looks like.
  const isContentChange = (record: MutationRecord) =>
    !(record.type === "attributes" && record.target === surface);
  const observer = new MutationObserver((records) => {
    if (records.some(isContentChange)) {
      invalidate();
    }
  });
  observer.observe(surface, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  const events = ["input", "change", "focusin", "focusout"] as const;
  for (const name of events) {
    surface.addEventListener(name, invalidate);
  }
  surface.addEventListener("scroll", invalidate, true);
  schedule();

  return () => {
    stopped = true;
    clearTimeout(timer);
    // Content changed in the same commit that ended this watch (e.g. a submit
    // spinner right before closing): the raster would be stale.
    if (observer.takeRecords().some(isContentChange)) {
      cache.version++;
      releaseRaster(cache);
    }
    observer.disconnect();
    for (const name of events) {
      surface.removeEventListener(name, invalidate);
    }
    surface.removeEventListener("scroll", invalidate, true);
    if (!surface.isConnected) {
      releaseRaster(cache);
    }
  };
}

function takeCachedRaster(
  surface: HTMLElement,
  bounds: Pick<GenieRestingBounds, "width" | "height">
): HTMLCanvasElement | null {
  const cache = rasterCaches.get(surface);
  if (
    !cache?.raster ||
    Math.abs(cache.bounds.width - bounds.width) > 0.5 ||
    Math.abs(cache.bounds.height - bounds.height) > 0.5
  ) {
    return null;
  }
  return cache.raster;
}

function releaseCachedRaster(surface: HTMLElement): void {
  const cache = rasterCaches.get(surface);
  if (cache) {
    cache.version++;
    releaseRaster(cache);
    rasterCaches.delete(surface);
  }
}

async function createGenieStrips(
  surface: HTMLElement,
  bounds: GenieRestingBounds,
  vertical: boolean,
  cachedRaster: HTMLCanvasElement | null = null
): Promise<GenieSnapshot> {
  const raster = cachedRaster ?? (await capturePopupRaster(surface, bounds));
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.dataset.genieAnimation = "";
  layer.inert = true;
  layer.style.cssText =
    "position:fixed;inset:0;z-index:50;pointer-events:none;overflow:visible;visibility:hidden;";
  const strips: GenieStrip[] = [];
  // Keep small menus light while retaining enough sections for a smooth curve.
  const count = Math.round(
    clamp((vertical ? bounds.height : bounds.width) / 14, 24, GENIE_STRIP_COUNT)
  );
  const length = (vertical ? bounds.height : bounds.width) / count;
  const resolution = raster.width / bounds.width;
  for (let index = 0; index < count; index++) {
    const strip = document.createElement("div");
    strip.style.cssText = `position:absolute;left:0;top:0;width:${vertical ? bounds.width : length + STRIP_OVERLAP}px;height:${vertical ? length + STRIP_OVERLAP : bounds.height}px;overflow:hidden;transform-origin:0 0;will-change:transform;`;
    const tile = document.createElement("canvas");
    const width = vertical ? bounds.width : length + STRIP_OVERLAP;
    const height = vertical ? length + STRIP_OVERLAP : bounds.height;
    tile.width = Math.ceil(width * resolution);
    tile.height = Math.ceil(height * resolution);
    tile.style.cssText = "display:block;width:100%;height:100%;max-width:none;";
    tile
      .getContext("2d")
      ?.drawImage(
        raster,
        (vertical ? 0 : index * length) * resolution,
        (vertical ? index * length : 0) * resolution,
        width * resolution,
        height * resolution,
        0,
        0,
        tile.width,
        tile.height
      );
    strip.append(tile);
    layer.append(strip);
    strips.push({ element: strip, station: index / count });
  }
  if (!cachedRaster) {
    raster.width = 0;
    raster.height = 0;
  }
  // Popper wrappers are transformed containing blocks; the viewport layer must escape them.
  let zIndex = 50;
  for (
    let ancestor: HTMLElement | null = surface;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    zIndex = Math.max(
      zIndex,
      Number.parseInt(getComputedStyle(ancestor).zIndex, 10) || 0
    );
  }
  layer.style.zIndex = String(zIndex);
  document.body.append(layer);
  return {
    layer,
    strips,
    length,
    count,
    dispose: () => {
      layer.remove();
    },
  };
}

export interface RunGenieOptions {
  edge?: GenieEdge;
  mode: "open" | "close";
  onComplete?: () => void;
  originRect: GenieRect;
  overlayEl?: HTMLElement | null;
  restingBounds: GenieRestingBounds;
  surfaceEl: HTMLElement;
}

/** Animate only composited transforms; the live form remains mounted and accessible. */
export function runGenieAnimation({
  surfaceEl,
  overlayEl,
  originRect,
  restingBounds,
  edge: explicitEdge,
  mode,
  onComplete,
}: RunGenieOptions): () => void {
  const reduced = isReducedMotionPreferred();
  const initial = surfaceProgress.get(surfaceEl) ?? (mode === "open" ? 0 : 1);
  const target = mode === "open" ? 1 : 0;
  const duration = reduced
    ? REDUCED_MOTION_DURATION_MS * Math.abs(target - initial)
    : (mode === "open" ? GENIE_OPEN_DURATION_MS : GENIE_CLOSE_DURATION_MS) *
      Math.abs(target - initial);
  const originalOpacity = surfaceEl.style.opacity;
  const edge = explicitEdge ?? getGenieEdge(originRect, restingBounds);
  const vertical = edge === "top" || edge === "bottom";
  let snapshot: GenieSnapshot | null = null;
  surfaceProgress.set(surfaceEl, initial);
  if (!reduced && mode === "open") {
    surfaceEl.style.opacity = "0";
  }
  if (overlayEl) {
    overlayEl.style.opacity = String(smoothstep(initial));
  }
  let raf = 0;
  let cancelled = false;
  let start: number | null = null;
  // Radix owns pointer-events: its modal layer enables the surface after mount.
  // Restoring a captured value here can undo that update and inherit body:none.

  const apply = (u: number) => {
    surfaceProgress.set(surfaceEl, u);
    surfaceEl.style.opacity = snapshot ? "0" : String(u);
    if (overlayEl) {
      overlayEl.style.opacity = String(smoothstep(u));
    }
    if (!snapshot) {
      return;
    }
    snapshot.layer.style.clipPath = getGenieClipPath(
      u,
      originRect,
      restingBounds,
      edge
    );
    snapshot.layer.style.visibility = u === 0 ? "hidden" : "visible";
    const { strips, count, length } = snapshot;
    // Neighbouring strips share an edge, so each boundary is solved once.
    let first = computeGenieStation(u, 0, originRect, restingBounds, edge);
    for (const [index, { element }] of strips.entries()) {
      const second = computeGenieStation(
        u,
        (index + 1) / count,
        originRect,
        restingBounds,
        edge
      );
      // Project a source rectangle to a trapezoid with matching shared edges.
      const span = first.end - first.start;
      const ratio = span / (second.end - second.start);
      const perspective = (ratio - 1) / length;
      const axial = (second.axis * ratio - first.axis) / length;
      const shear = (second.start * ratio - first.start) / length;
      const transverse =
        span / (vertical ? restingBounds.width : restingBounds.height);
      element.style.transform = vertical
        ? `matrix3d(${transverse},0,0,0,${shear},${axial},0,${perspective},0,0,1,0,${first.start},${first.axis},0,1)`
        : `matrix3d(${axial},${shear},0,${perspective},0,${transverse},0,0,0,0,1,0,${first.axis},${first.start},0,1)`;
      first = second;
    }
  };
  const clean = () => {
    snapshot?.dispose();
    releaseCachedRaster(surfaceEl);
    surfaceEl.style.opacity = mode === "open" ? "" : originalOpacity;
  };
  const step = (now: number) => {
    if (cancelled) {
      return;
    }
    start ??= now;
    const elapsed = duration === 0 ? 1 : clamp((now - start) / duration, 0, 1);
    let progress = smoothstep(elapsed);
    if (!reduced) {
      progress = (mode === "open" ? openEase : closeEase)(elapsed);
    }
    apply(lerp(initial, target, progress));
    if (elapsed < 1) {
      raf = requestAnimationFrame(step);
      return;
    }
    if (mode === "open" && snapshot) {
      // Reveal the live surface first and drop the snapshot a frame later, so
      // the hand-off never leaves a frame with neither on screen.
      const finished = snapshot;
      snapshot = null;
      surfaceEl.style.opacity = "";
      requestAnimationFrame(() => finished.dispose());
    }
    clean();
    if (mode === "close") {
      surfaceEl.style.opacity = "0";
      if (overlayEl) {
        overlayEl.style.opacity = "0";
      }
    } else if (overlayEl) {
      overlayEl.style.opacity = "";
    }
    onComplete?.();
  };
  const begin = () => {
    apply(initial);
    if (!snapshot) {
      raf = requestAnimationFrame(step);
      return;
    }
    // Inserting dozens of layers makes the first frame slow. Start the clock
    // on the second frame so that cost is not skipped out of the motion.
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame((now) => {
        start = now;
        step(now);
      });
    });
  };
  async function prepare() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const pending = createGenieStrips(
      surfaceEl,
      restingBounds,
      vertical,
      mode === "close" ? takeCachedRaster(surfaceEl, restingBounds) : null
    );
    try {
      const prepared = await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            reject(new Error("Genie snapshot timed out"));
          }, SNAPSHOT_TIMEOUT_MS);
        }),
      ]);
      clearTimeout(timer);
      if (cancelled) {
        prepared.dispose();
        return;
      }
      snapshot = prepared;
      begin();
    } catch {
      clearTimeout(timer);
      if (timedOut) {
        // A late snapshot must not linger over the live surface.
        pending.then((late) => late.dispose()).catch(() => undefined);
      }
      // Fail open if the webview cannot decode an SVG snapshot: never leave an invisible form.
      clean();
      if (!cancelled || mode === "close") {
        onComplete?.();
      }
    }
  }
  if (reduced) {
    begin();
  } else {
    prepare();
  }
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
    clean();
    if (mode === "close") {
      onComplete?.();
    }
  };
}
