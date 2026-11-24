"use client";

import { PreviewControls } from "@workspace/core/components/preview/preview-controls";
import {
  ResizeHandles,
  useViewportResize,
} from "@workspace/core/components/preview/resizer";
import { useKeyboardOverlay } from "@workspace/core/hooks/use-keyboard-overlay";
import { usePreviewSweep } from "@workspace/core/hooks/use-preview-sweep";
import {
  appCommand,
  type ComponentPayload,
  formatComponentContext,
  formatComponentLocation,
  formatDisplayPath,
  inspectorCommand,
  isTrustedMessage,
  type NavigationState,
  type NetworkFailure,
  type PreviewTarget,
  parsePreviewMessage,
  parsePreviewUrl,
  type QaReport,
  type RuntimeErrorPayload,
  toDisplayUrl,
  toProxyUrl,
} from "@workspace/core/lib/preview-bridge";
import {
  COMMON_DEV_PORTS,
  openExternal,
  previewClient,
} from "@workspace/core/lib/preview-client";
import { buildHealth } from "@workspace/core/lib/preview-qa";
import {
  CUSTOM_DEVICE_ID,
  clampZoom,
  computeFitScale,
  FIT_MARGIN,
  orientationOf,
  resolveViewport,
  zoomInFrom,
  zoomOutFrom,
} from "@workspace/core/lib/preview-viewports";
import { usePreviewStore } from "@workspace/core/stores/preview-store";
import { cn } from "@workspace/ui/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Code2,
  Copy,
  ExternalLink,
  Loader2,
  RotateCw,
  ServerCrash,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

const PORT_POLL_MS = 3000;
/** No message from the page within this long after mounting = treat as stalled. */
const STALL_MS = 10_000;
/** Time given to a page's injected script after its `load` event. */
const POST_LOAD_STALL_MS = 3000;
const AUDIT_DEBOUNCE_MS = 400;
const MAX_CAPTURED = 50;
/** Ctrl/⌘+wheel distance that counts as one zoom step (trackpad pinch sends many small events). */
const WHEEL_STEP = 60;
const FRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads";
const NAV_BTN =
  "rounded-md p-1.5 hover:bg-accent disabled:opacity-30 cursor-pointer";

interface PortChip {
  detected: boolean;
  port: number;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function InspectorBar({
  onClose,
  rootDirectory,
  selected,
}: {
  onClose: () => void;
  rootDirectory?: string;
  selected: ComponentPayload;
}) {
  const [copied, setCopied] = useState<"path" | "context" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  const hasSource = Boolean(selected.file);
  const fullLocation = formatComponentLocation(selected, rootDirectory);
  const display = formatDisplayPath(fullLocation);
  const lineMatch = /:(\d+)$/.exec(display);
  const location = lineMatch ? display.slice(0, lineMatch.index) : display;
  const slash = location.lastIndexOf("/");
  const dir = slash >= 0 ? location.slice(0, slash + 1) : "";
  const file = slash >= 0 ? location.slice(slash + 1) : location;
  const parents = (selected.stack ?? [])
    .map((entry) => entry.name)
    .filter(Boolean)
    .slice(0, 6);

  const copy = async (kind: "path" | "context") => {
    const text =
      kind === "path"
        ? fullLocation
        : formatComponentContext(selected, rootDirectory);
    const ok = await copyText(text);
    if (!ok) {
      toast.error("Could not copy to the clipboard");
      return;
    }
    setCopied(kind);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCopied(null), 1600);
  };

  const ghost =
    "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60";

  return (
    <section
      aria-label="Selected component"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-border border-t bg-card px-3.5 py-2.5 text-xs"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono font-semibold text-foreground text-[13px]">
            &lt;{selected.component}&gt;
          </span>
          <span className="shrink-0 text-subtle uppercase tracking-[0.1em] text-[10px]">
            {selected.framework}
          </span>
          {parents.length > 1 && (
            <span
              className="min-w-0 truncate text-subtle"
              title={parents.join(" › ")}
            >
              in {parents.slice(1, 4).join(" › ")}
            </span>
          )}
        </div>
        {hasSource ? (
          <div
            className="flex min-w-0 items-center gap-1.5 font-mono"
            title={fullLocation}
          >
            <Code2 className="size-3.5 shrink-0 text-subtle" />
            <span className="min-w-0 truncate">
              <span className="text-subtle">{dir}</span>
              <span className="font-medium text-foreground">{file}</span>
              {lineMatch && (
                <span className="text-[var(--accent-ink)]">
                  :{lineMatch[1]}
                </span>
              )}
            </span>
          </div>
        ) : (
          <p className="text-muted-foreground">
            No source location for this element (it may come from a library or
            production build).
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {hasSource && (
          <button className={ghost} onClick={() => copy("path")} type="button">
            {copied === "path" ? (
              <Check className="size-3 text-[var(--accent-ink)]" />
            ) : (
              <Copy className="size-3" />
            )}
            {copied === "path" ? "Copied" : "Copy path"}
          </button>
        )}
        <button className={ghost} onClick={() => copy("context")} type="button">
          {copied === "context" ? (
            <Check className="size-3 text-[var(--accent-ink)]" />
          ) : (
            <ClipboardList className="size-3" />
          )}
          {copied === "context" ? "Copied" : "Copy context"}
        </button>
        <button
          aria-label="Close inspector panel"
          className="cursor-pointer rounded-md p-1 text-subtle transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          onClick={onClose}
          type="button"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </section>
  );
}

/**
 * Professional responsive device preview & emulation system.
 *
 * Separates three distinct layers:
 * 1. DEVICE VIEWPORT: Actual simulated CSS viewport received by the website (e.g. 393×852).
 * 2. PREVIEW CANVAS: Available area inside the Marshell preview pane.
 * 3. ZOOM: Visual magnification of the rendered device within the canvas.
 */
export function PreviewBrowser({
  active = true,
  paneIds,
  rootDirectory,
  workspaceId,
}: {
  /** False while the tab is hidden: polling pauses. */
  active?: boolean;
  paneIds: string[];
  rootDirectory?: string;
  workspaceId: string;
}) {
  const savedUrl = usePreviewStore((s) => s.urls[workspaceId] ?? "");
  const isFullscreen = usePreviewStore((s) => s.isFullscreen);
  const toggleFullscreen = usePreviewStore((s) => s.toggleFullscreen);

  // Preview store persistence
  const deviceId = usePreviewStore((s) => s.deviceId);
  const orientation = usePreviewStore((s) => s.orientation);
  const zoom = usePreviewStore((s) => s.zoom);
  const foldState = usePreviewStore((s) => s.foldState);
  const customWidth = usePreviewStore((s) => s.customWidth);
  const customHeight = usePreviewStore((s) => s.customHeight);
  const setDevice = usePreviewStore((s) => s.setDevice);
  const setOrientation = usePreviewStore((s) => s.setOrientation);
  const setZoom = usePreviewStore((s) => s.setZoom);
  const setFoldState = usePreviewStore((s) => s.setFoldState);
  const setCustomSize = usePreviewStore((s) => s.setCustomSize);

  useKeyboardOverlay(isFullscreen, toggleFullscreen);

  const [input, setInput] = useState(savedUrl);
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nav, setNav] = useState<NavigationState | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [inspectOn, setInspectOn] = useState(false);
  const [devtoolsOn, setDevtoolsOn] = useState(false);
  const [ports, setPorts] = useState<PortChip[]>([]);
  const [selected, setSelected] = useState<ComponentPayload | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // Scroll container's client size (excludes scrollbars), the space Fit works within.
  const [canvasSize, setCanvasSize] = useState({ h: 0, w: 0 });
  const [frameStatus, setFrameStatus] = useState<
    "loading" | "ready" | "stalled"
  >("loading");
  const [runtimeErrors, setRuntimeErrors] = useState<RuntimeErrorPayload[]>([]);
  const [networkFailures, setNetworkFailures] = useState<NetworkFailure[]>([]);
  const [qaReport, setQaReport] = useState<QaReport | null>(null);
  const [auditTick, setAuditTick] = useState(0);
  const [portsScanned, setPortsScanned] = useState(false);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStallTimer = useCallback(() => {
    if (stallTimer.current) {
      clearTimeout(stallTimer.current);
      stallTimer.current = null;
    }
  }, []);
  const armStallTimer = useCallback(
    (ms: number) => {
      clearStallTimer();
      stallTimer.current = setTimeout(
        () => setFrameStatus((s) => (s === "ready" ? s : "stalled")),
        ms
      );
    },
    [clearStallTimer]
  );

  const post = useCallback(
    (message: unknown) => {
      if (origin) {
        frameRef.current?.contentWindow?.postMessage(message, origin);
      }
    },
    [origin]
  );

  // Start the proxy for the current target.
  const targetPort = target?.port;
  useEffect(() => {
    if (targetPort === undefined) {
      return;
    }
    let cancelled = false;
    setOrigin(null);
    setNav(null);
    previewClient
      .proxyStart(targetPort)
      .then((o) => !cancelled && setOrigin(o))
      .catch(
        (err) =>
          !cancelled &&
          setError(err instanceof Error ? err.message : String(err))
      );
    return () => {
      cancelled = true;
    };
  }, [targetPort]);

  const open = useCallback(
    (raw: string) => {
      const parsed = parsePreviewUrl(raw);
      if ("error" in parsed) {
        setError(parsed.error);
        return;
      }
      setError(null);
      setInspectOn(false);
      setSelected(null);
      setTarget(parsed.target);
      setFrameKey((k) => k + 1);
      const shown = `localhost:${parsed.target.port}${parsed.target.path === "/" ? "" : parsed.target.path}`;
      setInput(shown);
      usePreviewStore.getState().setUrl(workspaceId, shown);
    },
    [workspaceId]
  );

  // Addresses requested from elsewhere (e.g. a port chip in the processes drawer).
  const requested = usePreviewStore((s) => s.requested[workspaceId]);
  useEffect(() => {
    if (requested) {
      const url = usePreviewStore.getState().takeRequest(workspaceId);
      if (url) {
        open(url);
      }
    }
  }, [requested, workspaceId, open]);

  // Restore the last address once when the tab first mounts.
  const restored = useRef(false);
  useEffect(() => {
    if (!restored.current && savedUrl) {
      restored.current = true;
      open(savedUrl);
    }
  }, [savedUrl, open]);

  // Discover dev servers
  useEffect(() => {
    if (!active) {
      return;
    }
    let stopped = false;
    let inFlight = false;

    const scan = async () => {
      if (inFlight || stopped) {
        return;
      }
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      inFlight = true;
      try {
        const [owned, alive] = await Promise.all([
          previewClient.detectPorts(workspaceId, paneIds),
          previewClient.probePorts(COMMON_DEV_PORTS),
        ]);
        if (stopped) {
          return;
        }
        const detected = new Set(owned.map((p) => p.port));
        const all = new Set([...detected, ...alive]);
        setPortsScanned(true);
        setPorts(
          [...all]
            .sort((a, b) => a - b)
            .map((port) => ({ detected: detected.has(port), port }))
        );
      } catch {
        // Not running in desktop app
      } finally {
        inFlight = false;
      }
    };

    scan();
    const timer = setInterval(scan, PORT_POLL_MS);

    const onVisibilityChange = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        scan();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      stopped = true;
      clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [active, workspaceId, paneIds]);

  // Fill in the address automatically when exactly one dev server belongs to this workspace.
  const owned = useMemo(() => ports.filter((p) => p.detected), [ports]);
  useEffect(() => {
    if (!(target || input) && owned.length === 1 && owned[0]) {
      open(String(owned[0].port));
    }
  }, [target, input, owned, open]);

  // Messages from the previewed page.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedMessage(event, frameRef.current?.contentWindow, origin)) {
        return;
      }
      const parsed = parsePreviewMessage(event.data);
      if (!parsed) {
        return;
      }
      if (parsed.kind === "eruda-closed") {
        setDevtoolsOn(false);
      } else if (parsed.kind === "runtime-error") {
        setRuntimeErrors((list) =>
          list.length >= MAX_CAPTURED ? list : [...list, parsed.payload]
        );
      } else if (parsed.kind === "network-error") {
        setNetworkFailures((list) => {
          const { status, url } = parsed.failure;
          const seen = list.some((f) => f.url === url && f.status === status);
          return seen || list.length >= MAX_CAPTURED
            ? list
            : [...list, parsed.failure];
        });
      } else if (parsed.kind === "qa-report") {
        setQaReport(parsed.report);
      } else if (parsed.kind === "navigation") {
        // seq restarts at 1 for every new document (reload, HMR full refresh, navigation).
        if (parsed.state.seq <= 1) {
          setRuntimeErrors([]);
          setNetworkFailures([]);
          setQaReport(null);
        }
        clearStallTimer();
        setFrameStatus("ready");
        setAuditTick((t) => t + 1);
        setNav(parsed.state);
        if (origin && targetPort !== undefined) {
          setInput(
            toDisplayUrl(parsed.state.url, origin, targetPort).replace(
              /^http:\/\//,
              ""
            )
          );
        }
      } else if (parsed.kind === "component") {
        setInspectOn(false);
        setSelected(parsed.payload);
        const where = formatComponentLocation(parsed.payload, rootDirectory);
        const elementName = `<${parsed.payload.component}>`;
        copyText(where).then((ok) =>
          toast.success(
            ok ? `Copied ${elementName}` : `Selected ${elementName}`
          )
        );
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, targetPort, rootDirectory, clearStallTimer]);

  // --- Viewport, canvas and scale -------------------------------------------------------
  // Three separate things: the simulated viewport (what the page sees), the canvas (space
  // available in this pane) and the scale (how the viewport is drawn inside the canvas).
  const resolved = resolveViewport(deviceId, orientation, foldState, {
    height: customHeight,
    width: customWidth,
  });
  const { device, fluid } = resolved;
  const isCustom = deviceId === CUSTOM_DEVICE_ID;

  // Fluid fills the canvas (minus the fit margin) at 1:1; fixed devices use their own size.
  const viewportW = fluid
    ? Math.max(1, canvasSize.w - FIT_MARGIN * 2)
    : resolved.viewport.width;
  const viewportH = fluid
    ? Math.max(1, canvasSize.h - FIT_MARGIN * 2)
    : resolved.viewport.height;

  const fitScale = computeFitScale(
    viewportW,
    viewportH,
    canvasSize.w,
    canvasSize.h
  );
  let activeScale = 1;
  if (!fluid) {
    activeScale = zoom === "fit" ? fitScale : clampZoom(zoom);
  }

  const stageW = viewportW * activeScale;
  const stageH = viewportH * activeScale;

  // Observe the scroll container itself so Fit follows every kind of resize: window,
  // sidebar, fullscreen, toolbar wrapping, devtools panels.
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const next = { h: el.clientHeight, w: el.clientWidth };
      setCanvasSize((prev) =>
        prev.h === next.h && prev.w === next.w ? prev : next
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keep the same part of the preview in view when its size changes (zoom, device switch).
  const prevStage = useRef({ h: 0, w: 0 });
  useLayoutEffect(() => {
    const el = canvasRef.current;
    const prev = prevStage.current;
    prevStage.current = { h: stageH, w: stageW };
    if (!el || prev.w <= 0 || prev.h <= 0) {
      return;
    }
    if (prev.w === stageW && prev.h === stageH) {
      return;
    }
    const pad = FIT_MARGIN * 2;
    const cx = (el.scrollLeft + el.clientWidth / 2) / (prev.w + pad);
    const cy = (el.scrollTop + el.clientHeight / 2) / (prev.h + pad);
    el.scrollLeft = cx * (stageW + pad) - el.clientWidth / 2;
    el.scrollTop = cy * (stageH + pad) - el.clientHeight / 2;
  }, [stageW, stageH]);

  // --- Zoom actions ---------------------------------------------------------------------
  const zoomIn = useCallback(
    () => setZoom(clampZoom(zoomInFrom(activeScale))),
    [activeScale, setZoom]
  );
  const zoomOut = useCallback(
    () => setZoom(clampZoom(zoomOutFrom(activeScale))),
    [activeScale, setZoom]
  );

  const rotate = useCallback(() => {
    if (isCustom) {
      setCustomSize(customHeight, customWidth);
    } else {
      setOrientation(orientation === "portrait" ? "landscape" : "portrait");
    }
  }, [
    isCustom,
    customHeight,
    customWidth,
    orientation,
    setCustomSize,
    setOrientation,
  ]);

  // Keyboard: Ctrl/Cmd + and - zoom, Ctrl/Cmd 0 = 100%, Ctrl/Cmd Shift 0 = Fit.
  // Only while the tab is visible, and never while typing in a field.
  useEffect(() => {
    if (!active || fluid) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) {
        return;
      }
      if (e.code === "Digit0" || e.code === "Numpad0") {
        e.preventDefault();
        setZoom(e.shiftKey ? "fit" : 1);
      } else if (e.code === "Equal" || e.code === "NumpadAdd") {
        e.preventDefault();
        zoomIn();
      } else if (e.code === "Minus" || e.code === "NumpadSubtract") {
        e.preventDefault();
        zoomOut();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, fluid, setZoom, zoomIn, zoomOut]);

  // Ctrl/Cmd + wheel (and trackpad pinch) over the canvas zooms instead of scrolling.
  const wheelAccum = useRef(0);
  const zoomActions = useRef({ zoomIn, zoomOut });
  zoomActions.current = { zoomIn, zoomOut };
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || fluid) {
      return;
    }
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        return;
      }
      e.preventDefault();
      wheelAccum.current += e.deltaY;
      if (Math.abs(wheelAccum.current) < WHEEL_STEP) {
        return;
      }
      if (wheelAccum.current < 0) {
        zoomActions.current.zoomIn();
      } else {
        zoomActions.current.zoomOut();
      }
      wheelAccum.current = 0;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fluid]);

  // Drag the gutter around the preview to pan when it is larger than the canvas.
  const [isPanning, setIsPanning] = useState(false);
  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = canvasRef.current;
    if (!el || e.target !== e.currentTarget || e.button !== 0) {
      return;
    }
    if (
      el.scrollWidth <= el.clientWidth &&
      el.scrollHeight <= el.clientHeight
    ) {
      return;
    }
    el.setPointerCapture(e.pointerId);
    setIsPanning(true);
    const startX = e.clientX + el.scrollLeft;
    const startY = e.clientY + el.scrollTop;
    const onMove = (move: PointerEvent) => {
      el.scrollLeft = startX - move.clientX;
      el.scrollTop = startY - move.clientY;
    };
    const onUp = (up: PointerEvent) => {
      try {
        el.releasePointerCapture(up.pointerId);
      } catch {
        // Already released.
      }
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      setIsPanning(false);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  const { isDragging, onPointerDown } = useViewportResize({
    height: viewportH,
    onResize: setCustomSize,
    scale: activeScale,
    width: viewportW,
  });

  // --- Frame lifecycle and diagnostics -------------------------------------------------
  const src = origin && target ? toProxyUrl(origin, target) : undefined;

  // A fresh frame starts loading again; if the page never reports, say so.
  useEffect(() => {
    if (!src) {
      return;
    }
    setFrameStatus("loading");
    setRuntimeErrors([]);
    setNetworkFailures([]);
    setQaReport(null);
    armStallTimer(STALL_MS);
    return clearStallTimer;
  }, [src, frameKey, armStallTimer, clearStallTimer]);

  // Audit after every load/navigation and whenever the viewport changes. Anything measured
  // at the old size is dropped first so a stale report is never shown for the new one.
  useEffect(() => {
    setQaReport(null);
  }, [viewportW, viewportH]);
  useEffect(() => {
    if (!origin || frameStatus !== "ready") {
      return;
    }
    const timer = setTimeout(
      () => post(appCommand("qa-audit")),
      AUDIT_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [origin, frameStatus, auditTick, viewportW, viewportH, post]);

  const health = useMemo(
    () =>
      buildHealth({
        errors: runtimeErrors,
        expected: { height: viewportH, width: viewportW },
        network: networkFailures,
        report: qaReport,
      }),
    [runtimeErrors, networkFailures, qaReport, viewportH, viewportW]
  );
  const sweep = usePreviewSweep(qaReport, viewportH);

  const targetServerDown =
    portsScanned &&
    targetPort !== undefined &&
    !ports.some((p) => p.port === targetPort);
  const isSurfaceDuoUnfolded =
    device.id === "surface-duo" && foldState === "unfolded";

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-card",
        !isFullscreen && "rounded-xl border border-border"
      )}
    >
      {/* Address bar & navigation controls */}
      {!isFullscreen && (
        <form
          className="flex items-center gap-1 border-border border-b px-2 py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            open(input);
          }}
        >
          <button
            aria-label="Back"
            className={NAV_BTN}
            disabled={!nav?.canGoBack}
            onClick={() => post(appCommand("back"))}
            type="button"
          >
            <ArrowLeft className="size-4 text-foreground/80" />
          </button>
          <button
            aria-label="Forward"
            className={NAV_BTN}
            disabled={!nav?.canGoForward}
            onClick={() => post(appCommand("forward"))}
            type="button"
          >
            <ArrowRight className="size-4 text-foreground/80" />
          </button>
          <button
            aria-label="Reload"
            className={NAV_BTN}
            onClick={() => {
              if (target) {
                setFrameKey((k) => k + 1);
              } else {
                open(input);
              }
            }}
            type="button"
          >
            <RotateCw className="size-4 text-foreground/80" />
          </button>
          <input
            className="h-7 min-w-0 flex-1 rounded-md border border-border bg-secondary px-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
            onChange={(e) => setInput(e.target.value)}
            placeholder="localhost:3000 or full URL"
            value={input}
          />
          {origin && target && (
            <button
              aria-label="Open in external browser"
              className={NAV_BTN}
              onClick={() => openExternal(toProxyUrl(origin, target))}
              title="Open in external browser"
              type="button"
            >
              <ExternalLink className="size-4 text-foreground/80" />
            </button>
          )}
        </form>
      )}

      {/* Detected dev servers: a quiet text row, the open one washed. */}
      {ports.length > 0 && !isFullscreen && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-border border-b px-3 py-1.5 text-xs">
          <span className="mr-1 text-subtle uppercase tracking-[0.12em] text-[10px]">
            Servers
          </span>
          {ports.map((p) => (
            <button
              aria-pressed={target?.port === p.port}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-xs tabular-nums transition-colors",
                target?.port === p.port
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
              key={p.port}
              onClick={() => open(String(p.port))}
              title={
                p.detected
                  ? `Dev server detected on :${p.port}`
                  : `Open :${p.port}`
              }
              type="button"
            >
              <span>:{p.port}</span>
              {p.detected && (
                <span
                  aria-label="Detected dev server"
                  className="size-1.5 rounded-full bg-primary"
                  role="img"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main Preview Controls Toolbar */}
      <PreviewControls
        activeScale={activeScale}
        customHeight={customHeight}
        customWidth={customWidth}
        deviceId={deviceId}
        deviceName={fluid ? "Responsive" : device.name}
        devtoolsOn={devtoolsOn}
        fluid={fluid}
        foldState={foldState}
        health={health}
        inspectOn={inspectOn}
        isFoldable={Boolean(device.isFoldable)}
        isFullscreen={isFullscreen}
        onCustomSize={setCustomSize}
        onDevice={setDevice}
        onDevtools={() => {
          setDevtoolsOn((v) => !v);
          post(appCommand("toggle-eruda"));
        }}
        onFoldState={setFoldState}
        onFullscreen={toggleFullscreen}
        onInspect={() => {
          post(inspectorCommand(!inspectOn));
          setInspectOn((v) => !v);
        }}
        onRotate={rotate}
        onZoom={setZoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        orientation={orientationOf({ height: viewportH, width: viewportW })}
        sweep={sweep}
        viewportH={fluid ? Math.round(viewportH) : viewportH}
        viewportW={fluid ? Math.round(viewportW) : viewportW}
        zoom={zoom}
      />

      {error && (
        <p className="px-3 py-2 text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {/*
        Canvas (scroll container) > stage (layout box at the scaled size) > frame (the real
        CSS viewport, scaled with a transform) > iframe. Zoom only changes the transform, so
        the page never reloads or reflows. `m-auto` on the stage centres it while it fits and
        lets the canvas scroll from the start edge once it overflows (no clipping).
      */}
      <div
        className={cn(
          "relative flex min-h-0 flex-1 select-none overflow-auto bg-background",
          isPanning && "cursor-grabbing"
        )}
        onPointerDown={onCanvasPointerDown}
        ref={canvasRef}
        style={{ padding: FIT_MARGIN }}
      >
        {src ? (
          <div
            className="relative m-auto shrink-0"
            style={{ height: stageH, width: stageW }}
          >
            <div
              className="absolute top-0 left-0 origin-top-left overflow-hidden rounded-sm bg-background shadow-md ring-1 ring-border"
              style={{
                height: viewportH,
                transform: `scale(${activeScale})`,
                width: viewportW,
              }}
            >
              {isSurfaceDuoUnfolded && device.hinge && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 bottom-0 z-30 border-border border-x bg-card"
                  style={{
                    left: device.foldedWidth ?? 0,
                    width: device.hinge.width,
                  }}
                />
              )}
              <iframe
                className="block size-full border-0"
                key={frameKey}
                onLoad={() => {
                  // The page's injected script normally reports within moments of `load`.
                  armStallTimer(POST_LOAD_STALL_MS);
                }}
                ref={frameRef}
                sandbox={FRAME_SANDBOX}
                src={src}
                style={{ pointerEvents: isDragging ? "none" : "auto" }}
                title="App preview"
              />
              {frameStatus === "loading" && (
                <div
                  aria-live="polite"
                  className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center pt-6"
                  role="status"
                >
                  <span className="flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-muted-foreground text-xs shadow-sm">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading…
                  </span>
                </div>
              )}
            </div>
            {isCustom && <ResizeHandles onPointerDown={onPointerDown} />}
          </div>
        ) : (
          <div className="m-auto max-w-sm p-6 text-center text-muted-foreground text-sm">
            {target
              ? "Starting the preview…"
              : "Start your dev server in a terminal, then pick its port above or type an address."}
          </div>
        )}

        {src && frameStatus === "stalled" && (
          <div
            className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4"
            role="alert"
          >
            <div className="pointer-events-auto flex max-w-md items-start gap-3 rounded-lg border border-border bg-secondary p-3 text-xs shadow-lg">
              <ServerCrash className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {targetServerDown
                    ? `Nothing is listening on :${targetPort}`
                    : "The page isn't responding"}
                </p>
                <p className="text-muted-foreground">
                  {targetServerDown
                    ? "The dev server may have stopped. Start it, then reload."
                    : "It may still be compiling, or it failed to render. Check the dev server output."}
                </p>
                <button
                  className="cursor-pointer rounded-md border border-border px-2 py-1 text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  onClick={() => setFrameKey((k) => k + 1)}
                  type="button"
                >
                  Reload
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inspector: what was clicked, where it lives, and what to do with it. */}
      {selected && (
        <InspectorBar
          onClose={() => setSelected(null)}
          rootDirectory={rootDirectory}
          selected={selected}
        />
      )}
    </div>
  );
}
