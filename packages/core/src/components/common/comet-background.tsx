"use client";

import { cn } from "@workspace/ui/lib/utils";
import type * as React from "react";
import { memo } from "react";

interface CometBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  showOrbitalArcs?: boolean;
  variant?: "full" | "subtle" | "sidebar";
}

export const CometBackground = memo(function CometBackground({
  children,
  className,
  variant: _variant = "full",
  showOrbitalArcs: _showOrbitalArcs = true,
  ...props
}: CometBackgroundProps) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden bg-[#0a0a0c]",
        className
      )}
      {...props}
    >
      {/* Content wrapper */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center min-w-0 min-h-0">
        {children}
      </div>
    </div>
  );
});
