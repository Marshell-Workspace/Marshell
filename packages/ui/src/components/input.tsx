import { cn } from "@workspace/ui/lib/utils";
import type * as React from "react";

function Input({
  className,
  type,
  ref,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-subtle transition-colors motion-fast ease-out file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm hover:border-foreground/20 outline-none focus:outline-none focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive md:text-sm",
        className
      )}
      data-slot="input"
      ref={ref}
      type={type}
      {...props}
    />
  );
}

export { Input };
