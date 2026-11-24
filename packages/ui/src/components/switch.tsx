"use client";

import { cn } from "@workspace/ui/lib/utils";
import { Check } from "lucide-react";
import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

function Switch({
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
  variant?: "default" | "state" | "check";
}) {
  if (variant === "check") {
    return (
      <SwitchPrimitive.Root
        className={cn(
          "peer group/switch relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border p-[2px] transition-ui motion-normal outline-none select-none focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 active:scale-[0.96]",
          // Track styling
          "bg-neutral-900/90 border-white/20 shadow-inner",
          "data-checked:border-white/30 data-checked:bg-neutral-900/95",
          className
        )}
        data-slot="switch-check"
        {...props}
      >
        <SwitchPrimitive.Thumb
          className="pointer-events-none flex size-[18px] items-center justify-center rounded-full transition-ui motion-normal data-unchecked:bg-[#1c1f24] data-unchecked:border-[2px] data-unchecked:border-neutral-400/90 data-unchecked:translate-x-0 data-checked:bg-white data-checked:border-[1.5px] data-checked:border-white data-checked:translate-x-[20px] data-checked:shadow-sm"
          data-slot="switch-thumb"
        >
          <Check className="size-2.5 text-black stroke-[3.5] transition-ui motion-normal group-data-unchecked/switch:opacity-0 group-data-unchecked/switch:scale-50 group-data-checked/switch:opacity-100 group-data-checked/switch:scale-100" />
        </SwitchPrimitive.Thumb>
      </SwitchPrimitive.Root>
    );
  }

  if (variant === "state") {
    const isSm = size === "sm";

    return (
      <SwitchPrimitive.Root
        className={cn(
          "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-border/80 p-0.5 shadow-xs transition-colors motion-normal outline-none select-none focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-not-allowed data-disabled:opacity-50",
          isSm ? "h-5 w-9" : "h-6 w-11",
          "data-checked:bg-primary data-[state=checked]:bg-primary data-checked:border-primary data-[state=checked]:border-primary",
          "data-unchecked:bg-muted/80 data-[state=unchecked]:bg-muted/80",
          className
        )}
        data-size={size}
        data-slot="switch-state"
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "pointer-events-none block rounded-full bg-background shadow-xs ring-0 transition-transform motion-normal",
            isSm
              ? "size-4 data-checked:translate-x-4 data-[state=checked]:translate-x-4 data-unchecked:translate-x-0 data-[state=unchecked]:translate-x-0"
              : "size-5 data-checked:translate-x-5 data-[state=checked]:translate-x-5 data-unchecked:translate-x-0 data-[state=unchecked]:translate-x-0",
            "dark:data-checked:bg-primary-foreground dark:data-[state=checked]:bg-primary-foreground dark:data-unchecked:bg-foreground dark:data-[state=unchecked]:bg-foreground"
          )}
          data-slot="switch-thumb"
        />
      </SwitchPrimitive.Root>
    );
  }

  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7",
        "data-checked:bg-primary data-[state=checked]:bg-primary",
        "data-unchecked:bg-input/80 data-[state=unchecked]:bg-input/80 dark:data-unchecked:bg-muted/80 dark:data-[state=unchecked]:bg-muted/80",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50 cursor-pointer",
        className
      )}
      data-size={size}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-background shadow-xs ring-0 transition-transform",
          "group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3",
          "group-data-[size=default]/switch:data-checked:translate-x-4 group-data-[size=default]/switch:data-[state=checked]:translate-x-4",
          "group-data-[size=sm]/switch:data-checked:translate-x-3 group-data-[size=sm]/switch:data-[state=checked]:translate-x-3",
          "group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=default]/switch:data-[state=unchecked]:translate-x-0",
          "group-data-[size=sm]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-0",
          "dark:data-checked:bg-primary-foreground dark:data-[state=checked]:bg-primary-foreground dark:data-unchecked:bg-foreground dark:data-[state=unchecked]:bg-foreground"
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
