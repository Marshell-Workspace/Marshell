"use client";

import { Button } from "@workspace/ui/components/button";
import { useJellyDrag } from "@workspace/ui/lib/jelly-motion";
import {
  type PopupControllerState,
  useGeniePopupAnimation,
  usePopupController,
} from "@workspace/ui/lib/popup-motion";
import { cn } from "@workspace/ui/lib/utils";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

const DialogMotionContext = createContext<PopupControllerState | null>(null);

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null): void {
  if (!ref) {
    return;
  }
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  (ref as React.MutableRefObject<T | null>).current = value;
}

function Dialog({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(
    defaultOpen ?? false
  );
  const isControlled = openProp !== undefined;
  const resolvedOpen = isControlled ? Boolean(openProp) : uncontrolledOpen;

  const controller = usePopupController(resolvedOpen);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <DialogMotionContext.Provider value={controller}>
      <DialogPrimitive.Root
        data-slot="dialog"
        onOpenChange={handleOpenChange}
        open={resolvedOpen}
        {...props}
      />
    </DialogMotionContext.Provider>
  );
}

function DialogTrigger({
  onPointerDown,
  onClick,
  ref: externalRef,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  const controller = useContext(DialogMotionContext);

  const setTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      controller?.registerTriggerElement(node);
      assignRef(externalRef, node);
    },
    [controller, externalRef]
  );

  return (
    <DialogPrimitive.Trigger
      data-slot="dialog-trigger"
      onClick={(e) => {
        controller?.recordTrigger(e.currentTarget);
        onClick?.(e);
      }}
      onPointerDown={(e) => {
        controller?.recordTrigger(e.currentTarget);
        onPointerDown?.(e);
      }}
      ref={setTriggerRef}
      {...props}
    />
  );
}

function DialogPortal({
  container,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  const resolvedContainer =
    container ?? (typeof document === "undefined" ? undefined : document.body);
  return (
    <DialogPrimitive.Portal
      container={resolvedContainer}
      data-slot="dialog-portal"
      {...props}
    />
  );
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/75 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  jellyDrag = false,
  jellyIntensity,
  triggerRef,
  ref: externalRef,
  onPointerDown,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  jellyDrag?: boolean;
  jellyIntensity?: number;
  showCloseButton?: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
}) {
  const controller = useContext(DialogMotionContext);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const open = controller?.open ?? true;
  const isRendered = controller?.isRendered ?? true;
  const isClosing = controller?.isClosing ?? false;
  const fallbackSnapshotRef = useRef(null);
  const triggerSnapshotRef =
    controller?.triggerSnapshotRef ?? fallbackSnapshotRef;
  const noopCompleteClose = useCallback(() => undefined, []);
  const completeClose = controller?.completeClose ?? noopCompleteClose;

  // Preserve last non-empty children while closing so content remains visible during Genie exit
  const cachedChildrenRef = useRef<React.ReactNode>(children);
  if (
    open &&
    children !== null &&
    children !== undefined &&
    children !== false
  ) {
    cachedChildrenRef.current = children;
  }
  const renderedChildren = isClosing ? cachedChildrenRef.current : children;

  const {
    dragOffsetRef,
    handlePointerDown,
    resetDragOffset,
    cancelActiveJelly,
  } = useJellyDrag({
    enabled: jellyDrag,
    intensity: jellyIntensity,
    open,
    isClosing,
    contentRef,
  });

  useGeniePopupAnimation({
    open,
    isRendered,
    isClosing,
    contentRef,
    overlayRef,
    triggerSnapshotRef,
    registeredTriggerRef: controller?.triggerElementRef,
    explicitTriggerRef: triggerRef,
    dragOffsetRef: jellyDrag ? dragOffsetRef : undefined,
    kind: "dialog",
    completeClose,
    onBeforeClose: jellyDrag ? cancelActiveJelly : undefined,
    onAfterClose: jellyDrag ? resetDragOffset : undefined,
  });

  const setContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      assignRef(externalRef, node);
    },
    [externalRef]
  );

  const setOverlayRef = useCallback((node: HTMLDivElement | null) => {
    overlayRef.current = node;
  }, []);

  if (!isRendered) {
    return null;
  }

  return (
    <DialogPortal forceMount={true}>
      <DialogOverlay
        className={cn(isClosing && "pointer-events-none")}
        forceMount={true}
        ref={setOverlayRef}
      />
      <DialogPrimitive.Content
        className={cn(
          "relative fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-modal border border-border bg-popover p-6 text-popover-foreground text-sm shadow-xl backdrop-blur-sm outline-none max-w-lg overflow-y-auto no-scrollbar",
          jellyDrag &&
            "[&_[data-jelly-handle]]:cursor-grab [&_[data-jelly-handle]]:active:cursor-grabbing",
          isClosing && "pointer-events-none",
          className
        )}
        data-genie-managed=""
        data-slot="dialog-content"
        forceMount={true}
        inert={isClosing}
        onPointerDown={(e) => {
          if (jellyDrag) {
            handlePointerDown(e);
          }
          onPointerDown?.(e);
        }}
        ref={setContentRef}
        style={{
          backdropFilter: jellyDrag ? "none" : "blur(4px)",
          WebkitBackdropFilter: jellyDrag ? "none" : "blur(4px)",
          ...style,
        }}
        {...props}
      >
        {renderedChildren}
        {showCloseButton && (
          <DialogPrimitive.Close asChild={true} data-slot="dialog-close">
            <Button
              className="absolute top-4 right-4"
              size="icon-sm"
              variant="ghost"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      data-slot="dialog-footer"
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild={true}>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-heading font-medium leading-none", className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn(
        "text-muted-foreground text-sm *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      data-slot="dialog-description"
      {...props}
    />
  );
}

/**
 * Wide panel variant of DialogContent.
 * Uses Dialog.Portal → hoisted to document.body.
 * Provides sticky header + internally scrollable body.
 * Backdrop class is passed in from the caller for performance-tier adaptation.
 */
function DialogContentLarge({
  className,
  children,
  title,
  onClose,
  backdropClassName,
  maxWidthClassName = "max-w-4xl",
  ref: externalRef,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  onClose: () => void;
  backdropClassName?: string;
  maxWidthClassName?: string;
}) {
  const controller = useContext(DialogMotionContext);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const open = controller?.open ?? true;
  const isRendered = controller?.isRendered ?? true;
  const isClosing = controller?.isClosing ?? false;
  const fallbackSnapshotRef = useRef(null);
  const triggerSnapshotRef =
    controller?.triggerSnapshotRef ?? fallbackSnapshotRef;
  const noopCompleteClose = useCallback(() => undefined, []);
  const completeClose = controller?.completeClose ?? noopCompleteClose;

  const cachedChildrenRef = useRef<React.ReactNode>(children);
  const cachedTitleRef = useRef<string>(title);
  const cachedWidthRef = useRef(maxWidthClassName);
  if (open) {
    cachedWidthRef.current = maxWidthClassName;
  }
  if (
    open &&
    children !== null &&
    children !== undefined &&
    children !== false
  ) {
    cachedChildrenRef.current = children;
  }
  if (open && title) {
    cachedTitleRef.current = title;
  }
  const renderedChildren = isClosing ? cachedChildrenRef.current : children;
  const renderedTitle = isClosing ? cachedTitleRef.current : title;

  useGeniePopupAnimation({
    open,
    isRendered,
    isClosing,
    contentRef,
    overlayRef,
    triggerSnapshotRef,
    registeredTriggerRef: controller?.triggerElementRef,
    kind: "dialog",
    completeClose,
  });

  const setContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      assignRef(externalRef, node);
    },
    [externalRef]
  );

  const setOverlayRef = useCallback((node: HTMLDivElement | null) => {
    overlayRef.current = node;
  }, []);

  if (!isRendered) {
    return null;
  }

  return (
    <DialogPortal forceMount={true}>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50",
          backdropClassName ?? "bg-black/65",
          isClosing && "pointer-events-none"
        )}
        data-slot="dialog-overlay-large"
        forceMount={true}
        ref={setOverlayRef}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "flex w-[calc(100vw-2rem)] flex-col",
          "max-h-[calc(100svh-3rem)]",
          isClosing ? cachedWidthRef.current : maxWidthClassName,
          "overflow-hidden rounded-modal border border-zinc-800 bg-zinc-950 text-foreground",
          "shadow-[0_32px_80px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.04)]",
          "outline-none",
          isClosing && "pointer-events-none",
          className
        )}
        data-genie-managed=""
        data-slot="dialog-content-large"
        forceMount={true}
        inert={isClosing}
        onEscapeKeyDown={onClose}
        ref={setContentRef}
        {...props}
      >
        {/* Sticky header */}
        <header className="z-10 flex h-[52px] shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0c0d0e] px-[18px] sm:px-5">
          <DialogPrimitive.Title
            className="font-medium text-xs text-zinc-200 tracking-tight sm:text-sm"
            data-slot="dialog-title-large"
          >
            {renderedTitle}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close asChild={true}>
            <Button
              aria-label="Close dialog"
              className="size-7 rounded-[6px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 cursor-pointer"
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <XIcon className="size-3.5" />
            </Button>
          </DialogPrimitive.Close>
        </header>

        {/* Internally scrollable body */}
        <div className="no-scrollbar flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-7">
          {renderedChildren}
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

// biome-ignore lint/performance/noBarrelFile: re-export DialogPrimitive for nested dialog support
export { Dialog as DialogPrimitive } from "radix-ui";
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogContentLarge,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
