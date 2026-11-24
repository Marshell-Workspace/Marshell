"use client";

import {
  type PopupControllerState,
  useGeniePopupAnimation,
  usePopupController,
} from "@workspace/ui/lib/popup-motion";
import {
  useControlledPopup,
  usePopupSurface,
} from "@workspace/ui/lib/popup-surface";
import { cn } from "@workspace/ui/lib/utils";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

const DropdownMenuMotionContext = createContext<PopupControllerState | null>(
  null
);

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

function DropdownMenu({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
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
    <DropdownMenuMotionContext.Provider value={controller}>
      <DropdownMenuPrimitive.Root
        data-slot="dropdown-menu"
        onOpenChange={handleOpenChange}
        open={resolvedOpen}
        {...props}
      />
    </DropdownMenuMotionContext.Provider>
  );
}

function DropdownMenuPortal({
  container,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  const resolvedContainer =
    container ?? (typeof document === "undefined" ? undefined : document.body);
  return (
    <DropdownMenuPrimitive.Portal
      container={resolvedContainer}
      data-slot="dropdown-menu-portal"
      {...props}
    />
  );
}

function DropdownMenuTrigger({
  onPointerDown,
  onClick,
  ref: externalRef,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  const controller = useContext(DropdownMenuMotionContext);

  const setTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      controller?.registerTriggerElement(node);
      assignRef(externalRef, node);
    },
    [controller, externalRef]
  );

  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
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

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 4,
  children,
  ref: externalRef,
  style,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  const controller = useContext(DropdownMenuMotionContext);
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
    <DropdownMenuPortal forceMount={true}>
      <DropdownMenuPrimitive.Content
        align={align}
        className={cn(
          "relative z-50 max-h-(--radix-dropdown-menu-content-available-height) w-(--radix-dropdown-menu-trigger-width) min-w-32 overflow-y-auto rounded-popover border border-border bg-popover p-1.5 text-popover-foreground shadow-lg data-[state=closed]:overflow-hidden",
          isClosing && "pointer-events-none",
          className
        )}
        data-genie-managed=""
        data-slot="dropdown-menu-content"
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
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPortal>
  );
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default select-none items-center gap-2 rounded-control px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-[variant=destructive]:text-destructive data-disabled:opacity-50 data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-control py-1.5 pr-8 pl-2 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-checkbox-item"
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-control py-1.5 pr-8 pl-2 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-radio-item"
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        "px-2 py-1.5 font-medium text-muted-foreground text-xs data-inset:pl-8",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-label"
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto text-muted-foreground text-xs tracking-widest group-focus/dropdown-menu-item:text-accent-foreground",
        className
      )}
      data-slot="dropdown-menu-shortcut"
      {...props}
    />
  );
}

function DropdownMenuSub({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  const { controller, change } = useControlledPopup(
    open,
    defaultOpen,
    onOpenChange
  );
  return (
    <DropdownMenuMotionContext.Provider value={controller}>
      <DropdownMenuPrimitive.Sub
        {...props}
        onOpenChange={change}
        open={controller.open}
      />
    </DropdownMenuMotionContext.Provider>
  );
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ref: externalRef,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  const controller = useContext(DropdownMenuMotionContext);
  const triggerRef = (node: HTMLDivElement | null) => {
    controller?.registerTriggerElement(node);
    if (typeof externalRef === "function") {
      externalRef(node);
    } else if (externalRef) {
      externalRef.current = node;
    }
  };
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-control px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-[state=open]:bg-accent data-inset:pl-8 data-[state=open]:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-sub-trigger"
      ref={triggerRef}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  sideOffset = 8,
  ref: externalRef,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  const controller = useContext(DropdownMenuMotionContext);
  const motion = usePopupSurface(controller, externalRef);
  if (!motion.rendered) {
    return null;
  }
  return (
    <DropdownMenuPrimitive.Portal forceMount>
      <DropdownMenuPrimitive.SubContent
        className={cn(
          "z-50 min-w-[96px] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-control bg-popover p-1 text-popover-foreground shadow-md border border-border",
          className
        )}
        data-genie-managed=""
        data-slot="dropdown-menu-sub-content"
        forceMount
        inert={motion.closing}
        ref={motion.ref}
        sideOffset={sideOffset}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
