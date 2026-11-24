"use client";

import { cn } from "@workspace/ui/lib/utils";

export interface StaticIconProps {
  alt?: string;
  className?: string;
  src: string;
}

/**
 * Plain, non-animated raster/SVG icon. Icons never play on hover; state is
 * expressed through colour and opacity only (see `.icon-ink`).
 */
export function StaticIcon({ src, alt = "", className }: StaticIconProps) {
  return (
    <img
      alt={alt}
      aria-hidden={!alt}
      className={cn("pointer-events-none select-none", className)}
      src={src}
    />
  );
}
