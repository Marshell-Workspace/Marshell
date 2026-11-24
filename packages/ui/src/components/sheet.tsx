"use client";

import { Button } from "@workspace/ui/components/button";
import {
  type PopupControllerState,
  useGeniePopupAnimation,
  usePopupController,
} from "@workspace/ui/lib/popup-motion";
import { cn } from "@workspace/ui/lib/utils";
import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

const SheetMotionContext = createContext<PopupControllerState | null>(null);

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

function Sheet({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
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
    <SheetMotionContext.Provider value={controller}>
      <SheetPrimitive.Root
        data-slot="sheet"
        onOpenChange={handleOpenChange}
        open={resolvedOpen}
        {...props}
      />
    </SheetMotionContext.Provider>
  );
}

function SheetTrigger({
  onPointerDown,
  onClick,
  ref: externalRef,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  const controller = useContext(SheetMotionContext);

  const setTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      controller?.registerTriggerElement(node);
      assignRef(externalRef, node);
    },
    [controller, externalRef]
  );

  return (
    <SheetPrimitive.Trigger
      data-slot="sheet-trigger"
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

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  container,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  const resolvedContainer =
    container ?? (typeof document === "undefined" ? undefined : document.body);
  return (
    <SheetPrimitive.Portal
      container={resolvedContainer}
      data-slot="sheet-portal"
      {...props}
    />
  );
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-background/80 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      data-slot="sheet-overlay"
      {...props}
    />
  );
}

const SHEET_SIZES = {
  sm: "data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
  md: "data-[side=left]:sm:max-w-md data-[side=right]:sm:max-w-md",
  lg: "data-[side=left]:sm:max-w-lg data-[side=right]:sm:max-w-lg",
  xl: "data-[side=left]:sm:max-w-xl data-[side=right]:sm:max-w-xl",
  "2xl": "data-[side=left]:sm:max-w-2xl data-[side=right]:sm:max-w-2xl",
  "3xl": "data-[side=left]:sm:max-w-3xl data-[side=right]:sm:max-w-3xl",
  "4xl": "data-[side=left]:sm:max-w-4xl data-[side=right]:sm:max-w-4xl",
  full: "data-[side=left]:sm:max-w-full data-[side=right]:sm:max-w-full data-[side=left]:w-full data-[side=right]:w-full",
};

function SheetContent({
  className,
  children,
  side = "right",
  size = "sm",
  showCloseButton = true,
  ref: externalRef,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  size?: keyof typeof SHEET_SIZES;
  showCloseButton?: boolean;
}) {
  const controller = useContext(SheetMotionContext);
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
  if (
    open &&
    children !== null &&
    children !== undefined &&
    children !== false
  ) {
    cachedChildrenRef.current = children;
  }
  const renderedChildren = isClosing ? cachedChildrenRef.current : children;

  useGeniePopupAnimation({
    open,
    isRendered,
    isClosing,
    contentRef,
    overlayRef,
    triggerSnapshotRef,
    registeredTriggerRef: controller?.triggerElementRef,
    kind: "sheet",
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
    <SheetPortal forceMount={true}>
      <SheetOverlay
        className={cn(isClosing && "pointer-events-none")}
        forceMount={true}
        ref={setOverlayRef}
      />
      <SheetPrimitive.Content
        className={cn(
          "relative fixed z-50 flex flex-col gap-4 bg-popover/85 bg-clip-padding text-popover-foreground text-sm shadow-[0_32px_80px_rgba(0,0,0,0.8),inset_0_1.5px_2px_rgba(255,255,255,0.06)] backdrop-blur-[32px] data-[side=bottom]:inset-x-0 data-[side=top]:inset-x-0 data-[side=left]:inset-y-0 data-[side=right]:inset-y-0 data-[side=top]:top-0 data-[side=right]:right-0 data-[side=bottom]:bottom-0 data-[side=left]:left-0 data-[side=bottom]:h-auto data-[side=left]:h-full data-[side=right]:h-full data-[side=top]:h-auto data-[side=left]:w-3/4 data-[side=right]:w-3/4 data-[side=bottom]:border-t data-[side=left]:border-r data-[side=top]:border-b data-[side=right]:border-l border-border/80 overflow-hidden",
          SHEET_SIZES[size || "sm"],
          isClosing && "pointer-events-none",
          className
        )}
        data-genie-managed=""
        data-side={side}
        data-slot="sheet-content"
        forceMount={true}
        inert={isClosing}
        ref={setContentRef}
        style={{
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          ...props.style,
        }}
        {...props}
      >
        {renderedChildren}
        {showCloseButton && (
          <SheetPrimitive.Close asChild={true} data-slot="sheet-close">
            <Button
              className="absolute top-4 right-4"
              size="icon-sm"
              variant="ghost"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-4", className)}
      data-slot="sheet-header"
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      data-slot="sheet-footer"
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn("font-heading font-medium text-foreground", className)}
      data-slot="sheet-title"
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="sheet-description"
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
