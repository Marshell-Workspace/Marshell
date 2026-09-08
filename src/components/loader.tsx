"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface LoaderOneProps {
  className?: string;
  dotClassName?: string;
}

export function LoaderOne({ className, dotClassName }: LoaderOneProps) {
  return (
    <div
      aria-label="Loading"
      className={cn("flex items-center gap-1.5 py-0.5", className)}
      role="status"
    >
      {[0, 1, 2].map((index) => (
        <motion.span
          animate={{
            y: [0, -3.5, 0],
            opacity: [0.35, 1, 0.35],
            scale: [0.9, 1.1, 0.9],
          }}
          className={cn(
            "size-1.5 rounded-full bg-foreground/75 shadow-xs",
            dotClassName
          )}
          key={index}
          transition={{
            duration: 1.2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: index * 0.18,
          }}
        />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}
