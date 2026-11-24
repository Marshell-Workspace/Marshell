"use client";

import {
  type PopupControllerState,
  useGeniePopupAnimation,
  usePopupController,
} from "@workspace/ui/lib/popup-motion";
import { cn } from "@workspace/ui/lib/utils";
import { Popover as PopoverPrimitive } from "radix-ui";
import type * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

const PopoverMotionContext = createContext<PopupControllerState | null>(null);

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

function Popover({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
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
    <PopoverMotionContext.Provider value={controller}>
      <PopoverPrimitive.Root
        data-slot="popover"
        onOpenChange={handleOpenChange}
        open={resolvedOpen}
        {...props}
      />
    </PopoverMotionContext.Provider>
  );
}

function PopoverTrigger({
  onPointerDown,
  onClick,
  ref: externalRef,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  const controller = useContext(PopoverMotionContext);

  const setTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      controller?.registerTriggerElement(node);
      assignRef(externalRef, node);
    },
    [controller, externalRef]
  );

  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
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

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  collisionPadding = 12,
  avoidCollisions = true,
  children,
  triggerRef,
  ref: externalRef,
  style,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  triggerRef?: React.RefObject<HTMLElement | null>;
}) {
  const controller = useContext(PopoverMotionContext);
  const contentRef = useRef<HTMLDivElement | null>(null);

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
    triggerSnapshotRef,
    registeredTriggerRef: controller?.triggerElementRef,
    explicitTriggerRef: triggerRef,
    kind: "popover",
    completeClose,
  });

  const setContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      assignRef(externalRef, node);
    },
    [externalRef]
  );

  if (!isRendered) {
    return null;
  }

  return (
    <PopoverPrimitive.Portal
      container={typeof document === "undefined" ? undefined : document.body}
      forceMount={true}
    >
      <PopoverPrimitive.Content
        align={align}
        avoidCollisions={avoidCollisions}
        className={cn(
          "relative z-50 flex w-72 flex-col gap-4 rounded-popover border border-border bg-popover p-4 text-popover-foreground text-sm shadow-xl backdrop-blur-sm outline-hidden overflow-hidden",
          isClosing && "pointer-events-none",
          className
        )}
        collisionPadding={collisionPadding}
        data-genie-managed=""
        data-slot="popover-content"
        forceMount={true}
        inert={isClosing}
        ref={setContentRef}
        sideOffset={sideOffset}
        style={{
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          ...style,
        }}
        {...props}
      >
        {renderedChildren}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1 text-sm", className)}
      data-slot="popover-header"
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <div
      className={cn("font-medium", className)}
      data-slot="popover-title"
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground", className)}
      data-slot="popover-description"
      {...props}
    />
  );
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
