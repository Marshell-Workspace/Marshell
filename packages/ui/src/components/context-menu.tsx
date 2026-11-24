"use client";

import {
  type PopupControllerState,
  recordPopupPoint,
  usePopupController,
} from "@workspace/ui/lib/popup-motion";
import {
  useControlledPopup,
  usePopupSurface,
} from "@workspace/ui/lib/popup-surface";
import { cn } from "@workspace/ui/lib/utils";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import type * as React from "react";
import { createContext, useContext, useState } from "react";

const ContextMenuMotionContext = createContext<PopupControllerState | null>(
  null
);

function ContextMenu({
  onOpenChange,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  const [open, setOpen] = useState(false);
  const controller = usePopupController(open);
  return (
    <ContextMenuMotionContext.Provider value={controller}>
      <ContextMenuPrimitive.Root
        {...props}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
      />
    </ContextMenuMotionContext.Provider>
  );
}

function ContextMenuTrigger({
  onContextMenu,
  onPointerDown,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return (
    <ContextMenuPrimitive.Trigger
      data-slot="context-menu-trigger"
      onContextMenu={(event) => {
        recordPopupPoint(event.clientX, event.clientY);
        onContextMenu?.(event);
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "touch") {
          recordPopupPoint(event.clientX, event.clientY);
        }
        onPointerDown?.(event);
      }}
      {...props}
    />
  );
}

function ContextMenuGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  );
}

function ContextMenuPortal({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return (
    <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
  );
}

function ContextMenuSub({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  const { controller, change } = useControlledPopup(
    open,
    defaultOpen,
    onOpenChange
  );
  return (
    <ContextMenuMotionContext.Provider value={controller}>
      <ContextMenuPrimitive.Sub
        {...props}
        onOpenChange={change}
        open={controller.open}
      />
    </ContextMenuMotionContext.Provider>
  );
}

function ContextMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {
  return (
    <ContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...props}
    />
  );
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ref: externalRef,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  const controller = useContext(ContextMenuMotionContext);
  const triggerRef = (node: HTMLDivElement | null) => {
    controller?.registerTriggerElement(node);
    if (typeof externalRef === "function") {
      externalRef(node);
    } else if (externalRef) {
      externalRef.current = node;
    }
  };
  return (
    <ContextMenuPrimitive.SubTrigger
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-control px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-open:bg-accent data-inset:pl-8 data-open:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-sub-trigger"
      ref={triggerRef}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </ContextMenuPrimitive.SubTrigger>
  );
}

function ContextMenuSubContent({
  className,
  ref: externalRef,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  const controller = useContext(ContextMenuMotionContext);
  const motion = usePopupSurface(controller, externalRef);
  if (!motion.rendered) {
    return null;
  }
  return (
    <ContextMenuPrimitive.Portal forceMount>
      <ContextMenuPrimitive.SubContent
        className={cn(
          "z-50 min-w-[96px] origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-control bg-popover p-1 text-popover-foreground shadow-md border border-border",
          className
        )}
        data-genie-managed=""
        data-slot="context-menu-sub-content"
        forceMount
        inert={motion.closing}
        ref={motion.ref}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuContent({
  className,
  ref: externalRef,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  const controller = useContext(ContextMenuMotionContext);
  const motion = usePopupSurface(controller, externalRef);
  if (!motion.rendered) {
    return null;
  }
  return (
    <ContextMenuPrimitive.Portal forceMount>
      <ContextMenuPrimitive.Content
        className={cn(
          "relative z-50 max-h-(--radix-context-menu-content-available-height) min-w-44 origin-(--radix-context-menu-content-transform-origin) overflow-y-auto rounded-popover border border-border bg-popover p-1.5 text-popover-foreground shadow-lg data-[state=closed]:overflow-hidden",
          className
        )}
        data-genie-managed=""
        data-slot="context-menu-content"
        forceMount
        inert={motion.closing}
        ref={motion.ref}
        style={{
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          ...props.style,
        }}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "group/context-menu-item relative flex cursor-default select-none items-center gap-2 rounded-control px-2 py-1.5 text-xs outline-hidden focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-[variant=destructive]:text-destructive data-disabled:opacity-50 data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-control py-1.5 pr-8 pl-2 text-xs outline-hidden focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-checkbox-item"
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="context-menu-checkbox-item-indicator"
      >
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

function ContextMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioItem> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-control py-1.5 pr-8 pl-2 text-xs outline-hidden focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-radio-item"
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="context-menu-radio-item-indicator"
      >
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.Label
      className={cn(
        "px-2 py-1.5 font-medium text-muted-foreground text-[11px] data-inset:pl-8",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-label"
      {...props}
    />
  );
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border/60", className)}
      data-slot="context-menu-separator"
      {...props}
    />
  );
}

function ContextMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto font-mono text-[10px] text-muted-foreground/60 tracking-wider group-focus/context-menu-item:text-accent-foreground",
        className
      )}
      data-slot="context-menu-shortcut"
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
