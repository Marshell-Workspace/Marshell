import { cn } from "@workspace/ui/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "marshell-skeleton rounded-button bg-[#1c1c20] relative overflow-hidden",
        className
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
