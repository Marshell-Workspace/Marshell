"use client";

import { motion, type Variants } from "motion/react";
import type React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface LiquidGlassCardProps {
  blurIntensity?: "sm" | "md" | "lg" | "xl";
  borderRadius?: string;
  children: React.ReactNode;
  className?: string;
  draggable?: boolean;
  expandable?: boolean;
  expandedHeight?: string;
  expandedWidth?: string;
  glowIntensity?: "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  height?: string;
  hoverScale?: boolean;
  shadowIntensity?: "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  width?: string;
}

export const LiquidGlassCard = ({
  children,
  className = "",
  draggable = true,
  expandable = false,
  width,
  height,
  expandedWidth,
  expandedHeight,
  blurIntensity = "xl",
  borderRadius = "32px",
  glowIntensity = "sm",
  shadowIntensity = "md",
  hoverScale,
  ...props
}: LiquidGlassCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldScale = hoverScale ?? (draggable || expandable);

  const handleToggleExpansion = (e: React.MouseEvent<HTMLElement>) => {
    if (!expandable) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea")) {
      return;
    }
    setIsExpanded(!isExpanded);
  };

  const blurClasses = {
    sm: "backdrop-blur-xs",
    md: "backdrop-blur-md",
    lg: "backdrop-blur-lg",
    xl: "backdrop-blur-xl",
  };

  // Lightened inner glass edge highlights for crystal transparency
  const shadowStyles = {
    none: "inset 0 0 0 0 rgba(255, 255, 255, 0)",
    xs: "inset 1px 1px 1px 0 rgba(255, 255, 255, 0.08), inset -1px -1px 1px 0 rgba(255, 255, 255, 0.08)",
    sm: "inset 1px 1px 1.5px 0 rgba(255, 255, 255, 0.1), inset -1px -1px 1.5px 0 rgba(255, 255, 255, 0.1)",
    md: "inset 1.5px 1.5px 2px 0 rgba(255, 255, 255, 0.12), inset -1.5px -1.5px 2px 0 rgba(255, 255, 255, 0.12)",
    lg: "inset 2px 2px 3px 0 rgba(255, 255, 255, 0.15), inset -2px -2px 3px 0 rgba(255, 255, 255, 0.15)",
    xl: "inset 3px 3px 4px 0 rgba(255, 255, 255, 0.18), inset -3px -3px 4px 0 rgba(255, 255, 255, 0.18)",
    "2xl":
      "inset 4px 4px 6px 0 rgba(255, 255, 255, 0.2), inset -4px -4px 6px 0 rgba(255, 255, 255, 0.2)",
  };

  // Lightened ambient drop shadows for maximum pass-through visibility
  const glowStyles = {
    none: "0 1px 2px rgba(0, 0, 0, 0.01)",
    xs: "0 2px 6px rgba(0, 0, 0, 0.04)",
    sm: "0 3px 12px rgba(0, 0, 0, 0.05)",
    md: "0 4px 16px rgba(0, 0, 0, 0.06)",
    lg: "0 6px 20px rgba(0, 0, 0, 0.08)",
    xl: "0 8px 24px rgba(0, 0, 0, 0.1)",
    "2xl": "0 10px 32px rgba(0, 0, 0, 0.12)",
  };

  const containerVariants: Variants = {
    collapsed: {
      width: width || "auto",
      height: height || "auto",
      transition: { duration: 0.4, ease: [0.5, 1.5, 0.5, 1] },
    },
    expanded: {
      width: expandedWidth || "auto",
      height: expandedHeight || "auto",
      transition: { duration: 0.4, ease: [0.5, 1.5, 0.5, 1] },
    },
  };

  return (
    <>
      {/* SVG Displacement Filter for Liquid Distortion */}
      <svg className="hidden">
        <defs>
          <filter
            filterUnits="objectBoundingBox"
            height="100%"
            id="glass-blur"
            width="100%"
            x="0"
            y="0"
          >
            <feTurbulence
              baseFrequency="0.003 0.007"
              numOctaves="1"
              result="turbulence"
              type="fractalNoise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale="200"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <motion.div
        animate={
          expandable ? (isExpanded ? "expanded" : "collapsed") : undefined
        }
        className={cn(
          `relative overflow-hidden ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${expandable ? "cursor-pointer" : ""}`,
          className
        )}
        drag={draggable}
        dragConstraints={
          draggable ? { left: 0, right: 0, top: 0, bottom: 0 } : undefined
        }
        dragElastic={draggable ? 0.3 : undefined}
        dragTransition={
          draggable
            ? { bounceStiffness: 300, bounceDamping: 10, power: 0.3 }
            : undefined
        }
        onClick={expandable ? handleToggleExpansion : undefined}
        style={{
          borderRadius,
          ...(width && !expandable && { width }),
          ...(height && !expandable && { height }),
        }}
        variants={expandable ? containerVariants : undefined}
        whileDrag={draggable ? { scale: 1.02 } : undefined}
        whileHover={shouldScale ? { scale: 1.01 } : undefined}
        whileTap={shouldScale ? { scale: 0.98 } : undefined}
        {...props}
      >
        {/* Layer 1: Backdrop blur with liquid refraction */}
        <div
          className={`absolute inset-0 ${blurClasses[blurIntensity]} z-0`}
          style={{ borderRadius, filter: "url(#glass-blur)" }}
        />
        {/* Layer 2: Ambient glow */}
        <div
          className="absolute inset-0 z-10"
          style={{ borderRadius, boxShadow: glowStyles[glowIntensity] }}
        />
        {/* Layer 3: Inner glass edge highlight */}
        <div
          className="absolute inset-0 z-20"
          style={{ borderRadius, boxShadow: shadowStyles[shadowIntensity] }}
        />
        {/* Children content layer */}
        <div className="relative z-30">{children}</div>
      </motion.div>
    </>
  );
};
