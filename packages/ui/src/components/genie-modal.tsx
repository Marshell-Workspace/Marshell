"use client";

import {
  calculateRestingBounds,
  type GenieEdge,
  type GenieRect,
  type GenieRestingBounds,
  resolveGenieOrigin,
  runGenieAnimation,
  watchGenieSurface,
} from "@workspace/ui/lib/genie-motion";
import { cn } from "@workspace/ui/lib/utils";
import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type GenieModalPhase = "closed" | "opening" | "open" | "closing";

export interface GenieModalContextValue {
  closeModal: () => void;
  edge?: GenieEdge;
  getOriginRect: () => GenieRect;
  getRestingBounds: () => GenieRestingBounds;
  maxHeight?: number;
  maxWidth?: number;
  onCloseComplete: () => void;
  onOpenComplete: () => void;
  open: boolean;
  openModal: () => void;
  phase: GenieModalPhase;
  requestClose: () => void;
  restingBounds?: GenieRestingBounds;
  restoreFocus: () => void;
  triggerSelector?: string;
  vhRatio?: number;
  vwRatio?: number;
}

const GenieModalContext = createContext<GenieModalContextValue | null>(null);

/**
 * Public hook to interact with the active GenieModal.
 */
export function useGenieModal(): Pick<
  GenieModalContextValue,
  "closeModal" | "open" | "openModal" | "phase"
> {
  const ctx = useContext(GenieModalContext);
  if (!ctx) {
    return {
      open: false,
      phase: "closed",
      closeModal: () => undefined,
      openModal: () => undefined,
    };
  }
  return {
    open: ctx.open,
    phase: ctx.phase,
    closeModal: ctx.closeModal,
    openModal: ctx.openModal,
  };
}

export interface GenieModalProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  edge?: GenieEdge;
  maxHeight?: number;
  maxWidth?: number;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  triggerSelector?: string;
  vhRatio?: number;
  vwRatio?: number;
}

/**
 * GenieModal orchestrates the 4-phase lifecycle (closed -> opening -> open -> closing -> closed).
 * It preserves the portal and runs the authentic macOS Genie deformation during both open and close.
 */
export function GenieModal({
  open: openProp,
  defaultOpen = false,
  edge,
  maxHeight,
  maxWidth,
  onOpenChange,
  triggerSelector,
  vhRatio,
  vwRatio,
  children,
}: GenieModalProps) {
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const targetOpen = isControlled ? Boolean(openProp) : uncontrolledOpen;

  const [phase, setPhase] = useState<GenieModalPhase>(
    targetOpen ? "opening" : "closed"
  );
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const originRectRef = useRef<GenieRect | null>(null);
  const originElementRef = useRef<HTMLElement | null>(null);
  const restingBoundsRef = useRef<GenieRestingBounds | null>(null);
  const prevTargetOpenRef = useRef(targetOpen);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocus = useCallback(() => {
    if (returnFocusRef.current?.isConnected) {
      returnFocusRef.current.focus({ preventScroll: true });
    }
  }, []);

  const [restingBounds, setRestingBounds] = useState<GenieRestingBounds>(() =>
    calculateRestingBounds({
      maxWidth,
      maxHeight,
      vwRatio,
      vhRatio,
    })
  );

  const getOriginRect = useCallback((): GenieRect => {
    if (originRectRef.current && originRectRef.current.width > 5) {
      return originRectRef.current;
    }
    const resolved = resolveGenieOrigin(null, triggerSelector, null);
    originElementRef.current = resolved.element;
    originRectRef.current = resolved.rect;
    return resolved.rect;
  }, [triggerSelector]);

  // The trigger may have moved (resize, collapsed sidebar) since opening, so the
  // live element is preferred over the rect locked at open.
  const refreshOriginForClose = useCallback(() => {
    const resolved = resolveGenieOrigin(
      originElementRef.current,
      triggerSelector,
      originRectRef.current
    );
    originElementRef.current = resolved.element ?? originElementRef.current;
    originRectRef.current = resolved.rect;
  }, [triggerSelector]);

  const getRestingBounds = useCallback((): GenieRestingBounds => {
    if (
      phase !== "open" &&
      restingBoundsRef.current &&
      restingBoundsRef.current.width > 50
    ) {
      return restingBoundsRef.current;
    }
    const resolved = calculateRestingBounds({
      maxWidth,
      maxHeight,
      vwRatio,
      vhRatio,
    });
    restingBoundsRef.current = resolved;
    return resolved;
  }, [phase, maxWidth, maxHeight, vwRatio, vhRatio]);

  // Recalculate resting bounds whenever window dimensions change (e.g. window maximize/restore or resize)
  useEffect(() => {
    if (!targetOpen || phase === "closed") {
      return;
    }

    let rafId: number | null = null;
    const handleWindowChange = () => {
      // Do not recalculate during active fluid morphing to prevent visual glitches
      if (phase === "opening" || phase === "closing") {
        return;
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const updated = calculateRestingBounds({
          maxWidth,
          maxHeight,
          vwRatio,
          vhRatio,
        });
        restingBoundsRef.current = updated;
        setRestingBounds(updated);
      });
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("maximize", handleWindowChange);
    window.addEventListener("unmaximize", handleWindowChange);
    window.addEventListener("restore", handleWindowChange);
    window.addEventListener("orientationchange", handleWindowChange);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("maximize", handleWindowChange);
      window.removeEventListener("unmaximize", handleWindowChange);
      window.removeEventListener("restore", handleWindowChange);
      window.removeEventListener("orientationchange", handleWindowChange);
    };
  }, [targetOpen, phase, maxWidth, maxHeight, vwRatio, vhRatio]);

  // Synchronize targetOpen transitions with lifecycle phases (preventing re-open loops)
  useLayoutEffect(() => {
    const prevOpen = prevTargetOpenRef.current;
    prevTargetOpenRef.current = targetOpen;

    if (targetOpen && !prevOpen) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      // Transition from closed/closing to opening on user request
      const origin = resolveGenieOrigin(null, triggerSelector, null);
      originElementRef.current = origin.element;
      originRectRef.current = origin.rect;
      const initial = calculateRestingBounds({
        maxWidth,
        maxHeight,
        vwRatio,
        vhRatio,
      });
      restingBoundsRef.current = initial;
      setRestingBounds(initial);
      setPhase("opening");
    } else if (
      !targetOpen &&
      prevOpen &&
      (phase === "open" || phase === "opening")
    ) {
      // Transition from open/opening to closing on user/parent request
      refreshOriginForClose();
      const closeBounds = calculateRestingBounds({
        maxWidth,
        maxHeight,
        vwRatio,
        vhRatio,
      });
      restingBoundsRef.current = closeBounds;
      setRestingBounds(closeBounds);
      setPhase("closing");
    } else if (targetOpen && phase === "opening" && !returnFocusRef.current) {
      // Mounted already open: there was no false->true transition to record focus.
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
  }, [
    targetOpen,
    phase,
    triggerSelector,
    refreshOriginForClose,
    maxWidth,
    maxHeight,
    vwRatio,
    vhRatio,
  ]);

  const openModal = useCallback(() => {
    if (isControlled) {
      onOpenChangeRef.current?.(true);
      return;
    }
    setUncontrolledOpen(true);
    onOpenChangeRef.current?.(true);
  }, [isControlled]);

  // Closing is driven by the open state, never by phase alone: when a
  // controlled parent declines the close, the modal stays open and in sync.
  const requestClose = useCallback(() => {
    if (phase === "closed" || phase === "closing") {
      return;
    }
    if (!isControlled) {
      setUncontrolledOpen(false);
    }
    onOpenChangeRef.current?.(false);
  }, [phase, isControlled]);

  const onOpenComplete = useCallback(() => {
    setPhase("open");
    const settledBounds = calculateRestingBounds({
      maxWidth,
      maxHeight,
      vwRatio,
      vhRatio,
    });
    restingBoundsRef.current = settledBounds;
    setRestingBounds(settledBounds);
  }, [maxWidth, maxHeight, vwRatio, vhRatio]);

  const onCloseComplete = useCallback(() => {
    setPhase("closed");
    originRectRef.current = null;
    originElementRef.current = null;
    restingBoundsRef.current = null;
  }, []);

  const contextValue = useMemo<GenieModalContextValue>(
    () => ({
      open: phase === "open" || phase === "opening",
      phase,
      closeModal: requestClose,
      openModal,
      requestClose,
      restoreFocus,
      onOpenComplete,
      onCloseComplete,
      getOriginRect,
      getRestingBounds,
      restingBounds,
      triggerSelector,
      edge,
      maxWidth,
      maxHeight,
      vwRatio,
      vhRatio,
    }),
    [
      phase,
      requestClose,
      openModal,
      restoreFocus,
      onOpenComplete,
      onCloseComplete,
      getOriginRect,
      getRestingBounds,
      restingBounds,
      triggerSelector,
      edge,
      maxWidth,
      maxHeight,
      vwRatio,
      vhRatio,
    ]
  );

  return (
    <GenieModalContext.Provider value={contextValue}>
      <DialogPrimitive.Root
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            requestClose();
          }
        }}
        open={phase !== "closed"}
      >
        {children}
      </DialogPrimitive.Root>
    </GenieModalContext.Provider>
  );
}

export interface GenieModalContentProps
  extends React.ComponentProps<typeof DialogPrimitive.Content> {
  backdropClassName?: string;
}

/**
 * GenieModalContent renders the modal dialog inside a body portal with the Genie physics surface.
 * When closed, it renders null. When opening or closing, it smoothly animates without re-render lag.
 */
export function GenieModalContent({
  children,
  className,
  backdropClassName,
  onEscapeKeyDown,
  onInteractOutside,
  onPointerDownOutside,
  onCloseAutoFocus,
  style,
  ...restProps
}: GenieModalContentProps) {
  const ctx = useContext(GenieModalContext);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [surfaceNode, setSurfaceNode] = useState<HTMLDivElement | null>(null);
  const setSurfaceRef = useCallback((node: HTMLDivElement | null) => {
    surfaceRef.current = node;
    setSurfaceNode(node);
  }, []);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  // Preserve cached children while closing to prevent blanking or layout shifts
  const cachedChildrenRef = useRef<React.ReactNode>(children);
  if (ctx && (ctx.phase === "open" || ctx.phase === "opening")) {
    cachedChildrenRef.current = children;
  }
  const renderedChildren =
    ctx?.phase === "closing" ? cachedChildrenRef.current : children;

  // Own exactly one animation per effect, including Strict Mode setup/cleanup.
  useLayoutEffect(() => {
    if (
      !(ctx && surfaceNode) ||
      (ctx.phase !== "opening" && ctx.phase !== "closing")
    ) {
      return;
    }
    const opening = ctx.phase === "opening";
    return runGenieAnimation({
      surfaceEl: surfaceNode,
      overlayEl: backdropRef.current,
      originRect: ctx.getOriginRect(),
      restingBounds: ctx.getRestingBounds(),
      edge: ctx.edge,
      mode: opening ? "open" : "close",
      onComplete: opening ? ctx.onOpenComplete : ctx.onCloseComplete,
    });
  }, [ctx, surfaceNode]);

  // While open, keep a raster ready so closing can start on the very next frame.
  const settledWidth = ctx?.restingBounds?.width;
  const settledHeight = ctx?.restingBounds?.height;
  const settled = ctx?.phase === "open";
  useLayoutEffect(() => {
    if (!(settled && surfaceNode && settledWidth && settledHeight)) {
      return;
    }
    return watchGenieSurface(surfaceNode, {
      width: settledWidth,
      height: settledHeight,
    });
  }, [settled, surfaceNode, settledWidth, settledHeight]);

  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !ctx ||
    ctx.phase === "closed"
  ) {
    return null;
  }

  const restingBounds = ctx.restingBounds ?? ctx.getRestingBounds();
  const isClosing = ctx.phase === "closing";
  const isOpen = ctx.phase === "open";
  const transformOrigin =
    ctx.edge === "right"
      ? "100% 50%"
      : ctx.edge === "top"
        ? "50% 0%"
        : ctx.edge === "bottom"
          ? "50% 100%"
          : "0% 50%";

  return (
    <DialogPrimitive.Portal forceMount>
      {/* Backdrop */}
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-black/75 supports-backdrop-filter:backdrop-blur-xs",
          isClosing && "pointer-events-none",
          backdropClassName
        )}
        data-slot="genie-modal-overlay"
        forceMount
        ref={backdropRef}
        style={{
          opacity: ctx.phase === "opening" ? 0 : undefined,
        }}
      />

      {/* Genie Animation Surface */}
      <DialogPrimitive.Content
        {...restProps}
        className={cn(
          "fixed z-50 overflow-hidden outline-none",
          isClosing && "pointer-events-none",
          className
        )}
        data-slot="genie-modal-surface"
        forceMount
        inert={isClosing}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (!event.defaultPrevented) {
            event.preventDefault();
            ctx.restoreFocus();
          }
        }}
        onEscapeKeyDown={onEscapeKeyDown}
        onInteractOutside={(event) => {
          const originalTarget = (event.detail as { originalEvent?: Event })
            ?.originalEvent?.target as HTMLElement | null;
          const target = event.target as HTMLElement | null;
          const activeEl =
            typeof document === "undefined"
              ? null
              : (document.activeElement as HTMLElement | null);
          if (
            originalTarget?.closest?.(
              "[data-tour-element], [data-tour-id], [data-tour], [data-tour-surface]"
            ) ||
            target?.closest?.(
              "[data-tour-element], [data-tour-id], [data-tour], [data-tour-surface]"
            ) ||
            activeEl?.closest?.(
              "[data-tour-element], [data-tour-id], [data-tour], [data-tour-surface]"
            )
          ) {
            event.preventDefault();
            return;
          }
          onInteractOutside?.(event);
        }}
        onPointerDownOutside={(event) => {
          const originalTarget = (event.detail as { originalEvent?: Event })
            ?.originalEvent?.target as HTMLElement | null;
          const target = event.target as HTMLElement | null;
          if (
            originalTarget?.closest?.(
              "[data-tour-element], [data-tour-id], [data-tour], [data-tour-surface]"
            ) ||
            target?.closest?.(
              "[data-tour-element], [data-tour-id], [data-tour], [data-tour-surface]"
            )
          ) {
            event.preventDefault();
            return;
          }
          onPointerDownOutside?.(event);
        }}
        ref={setSurfaceRef}
        style={{
          left: `${restingBounds.left}px`,
          top: `${restingBounds.top}px`,
          width: `${restingBounds.width}px`,
          height: `${restingBounds.height}px`,
          transformOrigin,
          ...style,
        }}
      >
        {/* Content Container (Locked to resting dimensions during fluid morph) */}
        <div
          className="flex h-full w-full flex-col min-h-0 min-w-0"
          style={
            isOpen
              ? undefined
              : {
                  width: `${restingBounds.width}px`,
                  height: `${restingBounds.height}px`,
                }
          }
        >
          {renderedChildren}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export interface GenieModalCloseProps extends React.ComponentProps<"button"> {}

/**
 * Convenience button that triggers the smooth reverse Genie animation on click.
 */
export function GenieModalClose({
  children,
  onClick,
  ...props
}: GenieModalCloseProps) {
  const { closeModal } = useGenieModal();

  return (
    <button
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          closeModal();
        }
      }}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
