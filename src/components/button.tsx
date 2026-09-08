import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-medium text-sm outline-none transition-all duration-200 ease-out hover:scale-[1.02] focus-visible:border-white/50 focus-visible:ring-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-b before:from-white/10 before:to-transparent before:opacity-40 hover:before:opacity-80 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-black text-white backdrop-blur-md border border-white/25 shadow-[0_4px_14px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] hover:bg-black/90 hover:text-white hover:border-white/35",
        outline:
          "border border-white/30 bg-black text-white backdrop-blur-md hover:bg-black/80 hover:border-white/45 hover:text-white shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)]",
        secondary:
          "bg-black/90 backdrop-blur-md border border-white/20 text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:bg-black hover:text-white aria-expanded:bg-black",
        ghost:
          "bg-transparent text-white backdrop-blur-xs hover:bg-black/80 hover:backdrop-blur-md hover:border hover:border-white/25 hover:text-white aria-expanded:bg-black/80",
        destructive:
          "bg-destructive text-white backdrop-blur-md border border-red-400/30 shadow-[0_4px_14px_rgba(239,68,68,0.2),inset_0_1px_1px_rgba(255,255,255,0.3)] hover:bg-destructive/90 hover:text-white focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-white underline-offset-4 hover:underline before:hidden shadow-none hover:scale-100 active:scale-100",
      },
      size: {
        default:
          "h-9 gap-1.5 in-data-[slot=button-group]:rounded-md px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 in-data-[slot=button-group]:rounded-md rounded-[min(var(--radius-md),8px)] px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 in-data-[slot=button-group]:rounded-md rounded-[min(var(--radius-md),10px)] px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-10 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9",
        "icon-xs":
          "size-6 in-data-[slot=button-group]:rounded-md rounded-[min(var(--radius-md),8px)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 in-data-[slot=button-group]:rounded-md rounded-[min(var(--radius-md),10px)]",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      {...props}
    />
  );
}

export { Button, buttonVariants };
