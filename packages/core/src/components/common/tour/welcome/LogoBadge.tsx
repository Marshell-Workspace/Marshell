"use client";

import { motion } from "motion/react";
import Image from "next/image";
import {
  APP_NAME,
  EASINGS,
  LOGO_IMG_PX,
  LOGO_RADIUS_PX,
  LOGO_SIZE_PX,
  WELCOME_TIMINGS,
} from "./welcome.config";

interface LogoBadgeProps {
  imgDecoded: boolean;
  isReady: boolean;
  reduced: boolean;
}

/**
 * Marshell central logo badge.
 * Strictly pure blue (#2563eb) lighting, refined ground shadow, and top highlight.
 */
export function LogoBadge({ isReady, reduced, imgDecoded }: LogoBadgeProps) {
  const delay = WELCOME_TIMINGS.flightStartMs / 1000;
  const duration = WELCOME_TIMINGS.landingSettleDurationMs / 1000;

  return (
    <motion.div
      animate={{
        y: 0,
        opacity: imgDecoded ? 1 : 0,
        scale: 1,
      }}
      className="relative z-10 flex items-center justify-center select-none"
      initial={{
        y: 0,
        opacity: isReady && imgDecoded ? 1 : 0,
        scale: 1,
      }}
      style={{
        width: LOGO_SIZE_PX,
        height: LOGO_SIZE_PX,
      }}
      transition={{
        duration: isReady ? 0.15 : duration,
        delay: isReady ? 0 : delay,
        ease: EASINGS.decel,
      }}
    >
      {/* Outer ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: -32,
          background:
            "radial-gradient(circle, var(--tour-accent-glow) 0%, color-mix(in oklab, var(--tour-accent) 6%, transparent) 50%, transparent 72%)",
          animation:
            isReady && !reduced
              ? `welcome-logo-breathe ${EASINGS.ambientFloatDurationSec}s ease-in-out infinite`
              : "none",
        }}
      />

      {/* Inner core glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: -14,
          background:
            "radial-gradient(circle, var(--tour-accent-glow) 0%, color-mix(in oklab, var(--tour-accent) 8%, transparent) 60%, transparent 80%)",
        }}
      />

      {/* The logo tile */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          width: LOGO_SIZE_PX,
          height: LOGO_SIZE_PX,
          borderRadius: LOGO_RADIUS_PX,
          background: "var(--tour-surface-raised)",
          boxShadow: [
            "0 0 0 1px var(--tour-border)", // crisp perimeter
            "0 0 36px var(--tour-accent-glow)", // brand corona
            "0 14px 40px rgba(0,0,0,0.5)", // ground depth shadow
            "inset 0 1px 0 color-mix(in oklab, var(--tour-text) 18%, transparent)", // top-edge highlight
          ].join(", "),
          animation:
            isReady && !reduced
              ? `welcome-logo-float ${EASINGS.ambientFloatDurationSec}s ease-in-out infinite`
              : "none",
        }}
      >
        <Image
          alt={APP_NAME}
          className="select-none object-contain tour-welcome-logo"
          height={LOGO_IMG_PX}
          priority
          src="/main_logo_256.webp"
          style={{ width: LOGO_IMG_PX, height: LOGO_IMG_PX }}
          width={LOGO_IMG_PX}
        />
      </div>
    </motion.div>
  );
}
