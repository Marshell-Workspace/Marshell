"use client";

import { motion } from "motion/react";
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
  glowIntensity?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  height?: string;
  hoverScale?: boolean;
  shadowIntensity?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  width?: string;
}

export const LiquidGlassCard = ({
  children,
  className = "",
  draggable = false,
  expandable = false,
  width,
  height,
  expandedWidth,
  expandedHeight,
  blurIntensity = "xl",
  borderRadius = "28px",
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

  const shadowStyles = {
    none: "inset 0 0 0 0 rgba(255, 255, 255, 0)",
    xs: "inset 1px 1px 1px 0 rgba(255, 255, 255, 0.3), inset -1px -1px 1px 0 rgba(255, 255, 255, 0.3)",
    sm: "inset 2px 2px 2px 0 rgba(255, 255, 255, 0.35), inset -2px -2px 2px 0 rgba(255, 255, 255, 0.35)",
    md: "inset 3px 3px 3px 0 rgba(255, 255, 255, 0.45), inset -3px -3px 3px 0 rgba(255, 255, 255, 0.45)",
    lg: "inset 4px 4px 4px 0 rgba(255, 255, 255, 0.5), inset -4px -4px 4px 0 rgba(255, 255, 255, 0.5)",
    xl: "inset 6px 6px 6px 0 rgba(255, 255, 255, 0.55), inset -6px -6px 6px 0 rgba(255, 255, 255, 0.55)",
  };

  const glowStyles = {
    none: "0 4px 4px rgba(0, 0, 0, 0.05), 0 0 12px rgba(0, 0, 0, 0.05)",
    xs: "0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08), 0 0 16px rgba(255, 255, 255, 0.05)",
    sm: "0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08), 0 0 24px rgba(255, 255, 255, 0.1)",
    md: "0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08), 0 0 32px rgba(255, 255, 255, 0.15)",
    lg: "0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08), 0 0 40px rgba(255, 255, 255, 0.2)",
    xl: "0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08), 0 0 48px rgba(255, 255, 255, 0.25)",
  };

  const containerVariants = expandable
    ? {
        collapsed: {
          width: width || "auto",
          height: height || "auto",
          transition: {
            duration: 0.4,
            ease: [0.5, 1.5, 0.5, 1] as [number, number, number, number],
          },
        },
        expanded: {
          width: expandedWidth || "auto",
          height: expandedHeight || "auto",
          transition: {
            duration: 0.4,
            ease: [0.5, 1.5, 0.5, 1] as [number, number, number, number],
          },
        },
      }
    : undefined;

  const MotionComponent = draggable || expandable ? motion.div : "div";
  const motionProps =
    draggable || expandable
      ? {
          variants: expandable ? containerVariants : undefined,
          animate: expandable
            ? isExpanded
              ? "expanded"
              : "collapsed"
            : undefined,
          onClick: expandable ? handleToggleExpansion : undefined,
          drag: draggable,
          dragConstraints: draggable
            ? { left: 0, right: 0, top: 0, bottom: 0 }
            : undefined,
          dragElastic: draggable ? 0.3 : undefined,
          dragTransition: draggable
            ? { bounceStiffness: 300, bounceDamping: 10, power: 0.3 }
            : undefined,
          whileDrag: draggable ? { scale: 1.02 } : undefined,
          whileHover: shouldScale ? { scale: 1.01 } : undefined,
          whileTap: shouldScale ? { scale: 0.98 } : undefined,
        }
      : {};

  return (
    <>
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
      <MotionComponent
        className={cn(
          `relative overflow-hidden ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${expandable ? "cursor-pointer" : ""}`,
          className
        )}
        style={{
          borderRadius,
          ...(width && !expandable && { width }),
          ...(height && !expandable && { height }),
        }}
        {...motionProps}
        {...props}
      >
        <div
          className={`absolute inset-0 ${blurClasses[blurIntensity]} z-0`}
          style={{ borderRadius, filter: "url(#glass-blur)" }}
        />
        <div
          className="absolute inset-0 z-10"
          style={{ borderRadius, boxShadow: glowStyles[glowIntensity] }}
        />
        <div
          className="absolute inset-0 z-20"
          style={{ borderRadius, boxShadow: shadowStyles[shadowIntensity] }}
        />
        <div className="relative z-30">{children}</div>
      </MotionComponent>
    </>
  );
};
