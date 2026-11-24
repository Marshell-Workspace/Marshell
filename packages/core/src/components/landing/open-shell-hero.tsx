"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
export type UpdaterUiState =
  | "checking"
  | "found"
  | "downloading"
  | "verifying"
  | "installing"
  | "restarting"
  | "retrying"
  | "error";

interface OpenShellHeroProps {
  className?: string;
  progress?: number; // 0 to 1
  state: UpdaterUiState;
}

export function OpenShellHero({
  state,
  progress = 0,
  className,
}: OpenShellHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Pointer parallax: rAF-throttled, only active when pointer moves
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined") {
      return;
    }

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let isMoving = false;
    let timeout: NodeJS.Timeout | null = null;

    const onPointerMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const px = (e.clientX / innerWidth) * 2 - 1; // -1 to 1
      const py = (e.clientY / innerHeight) * 2 - 1; // -1 to 1
      targetX = Math.max(-1, Math.min(1, px));
      targetY = Math.max(-1, Math.min(1, py));

      if (!isMoving) {
        isMoving = true;
        loop();
      }

      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        isMoving = false;
      }, 500);
    };

    const loop = () => {
      // 450ms ease-out lag (~0.1 interpolation factor per frame at 60fps)
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      if (el) {
        el.style.setProperty("--pointer-x", currentX.toFixed(4));
        el.style.setProperty("--pointer-y", currentY.toFixed(4));
      }

      if (
        isMoving ||
        Math.abs(targetX - currentX) > 0.001 ||
        Math.abs(targetY - currentY) > 0.001
      ) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, []);

  // Compute seam warmth and intensity from progress in downloading state
  const seamIntensity =
    state === "checking" || state === "retrying"
      ? 0.35
      : state === "found"
        ? 0.75
        : state === "downloading"
          ? 0.3 + 0.7 * Math.min(1, Math.max(0, progress))
          : state === "verifying"
            ? 0.7
            : state === "installing"
              ? 0.65
              : state === "restarting"
                ? 0.9
                : 0.8; // error

  const warmProgress =
    state === "downloading" ? Math.min(1, Math.max(0, progress)) : 0;

  return (
    <div
      aria-hidden="true"
      className={className}
      data-state={state}
      ref={containerRef}
      style={
        {
          "--pointer-x": "0",
          "--pointer-y": "0",
          "--p": progress.toString(),
          "--seam-intensity": seamIntensity.toString(),
          "--warm-p": warmProgress.toString(),
          position: "relative",
          width: "140px",
          height: "128px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          perspective: "900px",
          userSelect: "none",
        } as CSSProperties
      }
    >
      <style>{`
        /* =================== MOTION SYSTEM =================== */
        :root {
          --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
          --ease-sine: cubic-bezier(0.45, 0, 0.55, 1);
          --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* Ambient 520px glow hue breathing (two-layer opacity crossfade over 9s) */
        @keyframes marshell-glow-cool {
          0%, 100% { opacity: 0.08; }
          50% { opacity: 0.02; }
        }
        @keyframes marshell-glow-warm {
          0%, 100% { opacity: 0.01; }
          50% { opacity: 0.07; }
        }
        .shell-ambient-cool {
          animation: marshell-glow-cool 9s var(--ease-sine) infinite;
        }
        .shell-ambient-warm {
          animation: marshell-glow-warm 9s var(--ease-sine) infinite;
        }

        /* Hero vertical float +/-3px over 4.8s */
        @keyframes marshell-float {
          0%, 100% { transform: translateY(-3px); }
          50% { transform: translateY(3px); }
        }
        /* Contact shadow scales oppositely to float */
        @keyframes marshell-shadow {
          0%, 100% { transform: scale(0.95); opacity: 0.42; }
          50% { transform: scale(1.04); opacity: 0.58; }
        }

        .shell-floating-rig {
          animation: marshell-float 4.8s var(--ease-sine) infinite;
          will-change: transform;
        }
        .shell-contact-shadow {
          animation: marshell-shadow 4.8s var(--ease-sine) infinite;
          will-change: transform, opacity;
        }

        /* Specular Glint sweep: 1.1s sweep every 4.2s */
        @keyframes marshell-glint-left {
          0%, 73% { transform: translateX(-120%); opacity: 0; }
          74% { opacity: 0.85; }
          86% { transform: translateX(140%); opacity: 0.85; }
          87%, 100% { transform: translateX(140%); opacity: 0; }
        }
        @keyframes marshell-glint-right {
          0%, 75% { transform: translateX(-120%); opacity: 0; }
          76% { opacity: 0.85; }
          88% { transform: translateX(140%); opacity: 0.85; }
          89%, 100% { transform: translateX(140%); opacity: 0; }
        }
        .shell-glint-left {
          animation: marshell-glint-left 4.2s var(--ease-out) infinite;
        }
        .shell-glint-right {
          animation: marshell-glint-right 4.2s var(--ease-out) infinite;
        }

        /* Seam breath (checking / retrying) */
        @keyframes marshell-seam-breath {
          0%, 100% { opacity: 0.28; transform: scaleY(0.92); }
          50% { opacity: 0.52; transform: scaleY(1.02); }
        }

        /* Verification scan line */
        @keyframes marshell-scanline {
          0% { transform: translateY(-20px); opacity: 0; }
          15% { opacity: 0.75; }
          85% { opacity: 0.75; }
          100% { transform: translateY(140px); opacity: 0; }
        }
        .shell-scanline {
          animation: marshell-scanline 2.2s var(--ease-out) infinite;
        }

        /* Turntable slow tilt during install */
        @keyframes marshell-turntable {
          0%, 100% { transform: rotateY(-10deg); }
          50% { transform: rotateY(10deg); }
        }

        /* Restart bloom */
        @keyframes marshell-restart-bloom {
          0% { opacity: 0; transform: scale(0.85); }
          100% { opacity: 0.55; transform: scale(1.35); }
        }

        /* Error nudge */
        @keyframes marshell-nudge {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }

        /* Hinge breathing (checking / retrying) 4 deg to 9 deg */
        @keyframes marshell-hinge-left-breathe {
          0%, 100% { transform: rotateY(4deg) translateZ(3px); }
          50% { transform: rotateY(9deg) translateZ(6px); }
        }
        @keyframes marshell-hinge-right-breathe {
          0%, 100% { transform: rotateY(-4deg) translateZ(3px); }
          50% { transform: rotateY(-9deg) translateZ(6px); }
        }

        /* =================== STATE STYLING =================== */
        /* CHECKING / RETRYING */
        [data-state="checking"] .shell-wing-left,
        [data-state="retrying"] .shell-wing-left {
          animation: marshell-hinge-left-breathe 3.6s var(--ease-sine) infinite;
          transform-origin: 100% 50%;
        }
        [data-state="checking"] .shell-wing-right,
        [data-state="retrying"] .shell-wing-right {
          animation: marshell-hinge-right-breathe 3.6s var(--ease-sine) infinite;
          transform-origin: 0% 50%;
        }
        [data-state="checking"] .shell-seam-thread,
        [data-state="retrying"] .shell-seam-thread {
          animation: marshell-seam-breath 3.6s var(--ease-sine) infinite;
        }

        /* FOUND: opens to 16 deg, settles 8 deg */
        [data-state="found"] .shell-wing-left {
          transform: rotateY(8deg) translateZ(6px);
          transform-origin: 100% 50%;
          transition: transform 500ms var(--ease-out);
        }
        [data-state="found"] .shell-wing-right {
          transform: rotateY(-8deg) translateZ(6px);
          transform-origin: 0% 50%;
          transition: transform 500ms var(--ease-out);
        }

        /* DOWNLOADING: steady 8 deg */
        [data-state="downloading"] .shell-wing-left {
          transform: rotateY(8deg) translateZ(6px);
          transform-origin: 100% 50%;
        }
        [data-state="downloading"] .shell-wing-right {
          transform: rotateY(-8deg) translateZ(6px);
          transform-origin: 0% 50%;
        }

        /* VERIFYING: closes to 3 deg */
        [data-state="verifying"] .shell-wing-left {
          transform: rotateY(3deg) translateZ(2px);
          transform-origin: 100% 50%;
          transition: transform 450ms var(--ease-out);
        }
        [data-state="verifying"] .shell-wing-right {
          transform: rotateY(-3deg) translateZ(2px);
          transform-origin: 0% 50%;
          transition: transform 450ms var(--ease-out);
        }

        /* INSTALLING: snaps to 0 deg with spring overshoot */
        [data-state="installing"] .shell-wing-left {
          transform: rotateY(0deg) translateZ(0px);
          transform-origin: 100% 50%;
          transition: transform 520ms var(--spring);
        }
        [data-state="installing"] .shell-wing-right {
          transform: rotateY(0deg) translateZ(0px);
          transform-origin: 0% 50%;
          transition: transform 520ms var(--spring);
        }
        [data-state="installing"] .shell-hero-stage {
          animation: marshell-turntable 5s var(--ease-sine) infinite;
        }

        /* RESTARTING: 0 deg + radial bloom */
        [data-state="restarting"] .shell-wing-left,
        [data-state="restarting"] .shell-wing-right {
          transform: rotateY(0deg) translateZ(0px);
        }
        [data-state="restarting"] .shell-bloom {
          animation: marshell-restart-bloom 500ms var(--ease-out) forwards;
        }

        /* ERROR: opens wide to 22 deg, slightly desaturated, amber seam, horizontal nudge */
        [data-state="error"] .shell-wing-left {
          transform: rotateY(22deg) translateZ(10px);
          transform-origin: 100% 50%;
          transition: transform 400ms var(--ease-out);
        }
        [data-state="error"] .shell-wing-right {
          transform: rotateY(-22deg) translateZ(10px);
          transform-origin: 0% 50%;
          transition: transform 400ms var(--ease-out);
        }
        [data-state="error"] .shell-hero-stage {
          animation: marshell-nudge 360ms var(--ease-out);
          opacity: 0.76;
        }

        /* REDUCED MOTION */
        @media (prefers-reduced-motion: reduce) {
          .shell-ambient-cool,
          .shell-ambient-warm,
          .shell-floating-rig,
          .shell-contact-shadow,
          .shell-glint-left,
          .shell-glint-right,
          .shell-scanline,
          .shell-hero-stage,
          .shell-bloom {
            animation: none !important;
          }
          .shell-wing-left,
          .shell-wing-right {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {/* 520px Ambient Background Glow (Opacity cross-fade over 9s) */}
      <div
        className="shell-ambient-cool pointer-events-none absolute -top-48 -left-48 h-[520px] w-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(127,167,255,0.08) 0%, transparent 65%)",
        }}
      />
      <div
        className="shell-ambient-warm pointer-events-none absolute -top-48 -left-48 h-[520px] w-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,201,139,0.07) 0%, transparent 65%)",
        }}
      />

      {/* Restart Bloom */}
      {state === "restarting" && (
        <div
          className="shell-bloom pointer-events-none absolute -top-16 -left-16 h-64 w-64 rounded-full opacity-0"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(200,225,255,0.15) 45%, transparent 70%)",
          }}
        />
      )}

      {/* Floating Rig with Contact Shadow */}
      <div
        className="shell-floating-rig relative flex flex-col items-center justify-center"
        style={{
          transform:
            "rotateX(calc(var(--pointer-y) * -5deg)) rotateY(calc(var(--pointer-x) * 7deg))",
          transformStyle: "preserve-3d",
          transition: "transform 450ms var(--ease-out)",
        }}
      >
        {/* Verification Scan Line overlay */}
        {state === "verifying" && (
          <div
            className="shell-scanline pointer-events-none absolute -top-4 z-30 h-6 w-36 overflow-hidden"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(255,255,255,0.7) 85%, transparent)",
            }}
          />
        )}

        {/* Hero Stage containing Left Wing, Seam Thread, and Right Wing */}
        <div
          className="shell-hero-stage relative flex items-center justify-center"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* ================= LEFT WING ================= */}
          <div
            className="shell-wing-left relative"
            style={{
              width: "72px",
              height: "120px",
              marginRight: "-1px",
              transformStyle: "preserve-3d",
            }}
          >
            <svg
              className="overflow-visible"
              height="120"
              viewBox="0 0 72 120"
              width="72"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* 5-stop Base Metal Gradient along long axis */}
                <linearGradient
                  id="metalLeftBase"
                  x1="12%"
                  x2="88%"
                  y1="8%"
                  y2="92%"
                >
                  <stop offset="0%" stopColor="#F7F9FC" />
                  <stop offset="25%" stopColor="#D9DEE5" />
                  <stop offset="50%" stopColor="#AAB2BD" />
                  <stop offset="75%" stopColor="#6A7280" />
                  <stop offset="100%" stopColor="#C9CFD8" />
                </linearGradient>

                {/* Top Facet Gradient (+8% lightness) */}
                <linearGradient
                  id="metalLeftTopFacet"
                  x1="0%"
                  x2="100%"
                  y1="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="40%" stopColor="#E5EAF0" />
                  <stop offset="100%" stopColor="#BCC4CE" />
                </linearGradient>

                {/* Bottom Facet Gradient (-8% lightness) */}
                <linearGradient
                  id="metalLeftBottomFacet"
                  x1="0%"
                  x2="100%"
                  y1="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#969EA9" />
                  <stop offset="60%" stopColor="#58606D" />
                  <stop offset="100%" stopColor="#7E8793" />
                </linearGradient>

                {/* Bevel inner stroke gradient */}
                <linearGradient
                  id="metalBevelLeft"
                  x1="0%"
                  x2="100%"
                  y1="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                  <stop offset="45%" stopColor="rgba(255,255,255,0.35)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
                </linearGradient>

                {/* Left Wing Silhouette Clip for Glint */}
                <clipPath id="leftWingClip">
                  <path d="M 8,8 Q 0,10 0,20 L 0,100 Q 0,110 8,112 L 64,80 Q 72,76 72,68 L 72,52 Q 72,44 64,40 Z" />
                </clipPath>
              </defs>

              {/* Base Metal Silhouette */}
              <path
                d="M 8,8 Q 0,10 0,20 L 0,100 Q 0,110 8,112 L 64,80 Q 72,76 72,68 L 72,52 Q 72,44 64,40 Z"
                fill="url(#metalLeftBase)"
              />

              {/* Facet Plane Top */}
              <polygon
                fill="url(#metalLeftTopFacet)"
                opacity="0.85"
                points="8,8 64,40 72,52 38,58 0,20"
              />

              {/* Facet Plane Bottom */}
              <polygon
                fill="url(#metalLeftBottomFacet)"
                opacity="0.8"
                points="0,100 38,62 72,68 64,80 8,112"
              />

              {/* Environment Tint: Cool #9CC3FF (14%) on upper facets */}
              <polygon
                fill="#9CC3FF"
                opacity="0.14"
                points="8,8 64,40 72,52 0,20"
              />

              {/* Environment Tint: Warm #FFD9A8 (10%) on lower facets */}
              <polygon
                fill="#FFD9A8"
                opacity="0.10"
                points="0,100 38,62 64,80 8,112"
              />

              {/* Engraved Prompt Inlay: >_ in dark glass #14161A */}
              {/* 0.5px light bounce edge on lower/right side */}
              <g transform="translate(0.5, 0.5)">
                <path
                  d="M 20 48 L 32 60 L 20 72"
                  fill="none"
                  stroke="rgba(255,255,255,0.45)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="4.5"
                />
                <line
                  stroke="rgba(255,255,255,0.45)"
                  strokeLinecap="round"
                  strokeWidth="4.5"
                  x1="38"
                  x2="50"
                  y1="72"
                  y2="72"
                />
              </g>

              {/* Main Dark Glass Inlay */}
              <path
                d="M 20 48 L 32 60 L 20 72"
                fill="none"
                stroke="#14161A"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4.2"
              />
              <line
                stroke="#14161A"
                strokeLinecap="round"
                strokeWidth="4.2"
                x1="38"
                x2="50"
                y1="72"
                y2="72"
              />

              {/* Inner Edge Bevel (0.75px) */}
              <path
                d="M 8,8 Q 0,10 0,20 L 0,100 Q 0,110 8,112 L 64,80 Q 72,76 72,68 L 72,52 Q 72,44 64,40 Z"
                fill="none"
                stroke="url(#metalBevelLeft)"
                strokeWidth="0.75"
              />

              {/* Clipped Hinge Shading Overlay on inner seam edge */}
              <g clipPath="url(#leftWingClip)">
                <rect
                  fill="url(#leftHingeShadow)"
                  height="120"
                  opacity="0.4"
                  width="20"
                  x="52"
                  y="0"
                />
              </g>
              <defs>
                <linearGradient
                  id="leftHingeShadow"
                  x1="0%"
                  x2="100%"
                  y1="0%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
                </linearGradient>
              </defs>

              {/* Clipped Specular Glint Band */}
              <g clipPath="url(#leftWingClip)">
                <rect
                  className="shell-glint-left"
                  height="160"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.85) 50%, transparent 62%)",
                    transform: "translateX(-120%)",
                  }}
                  width="120"
                  x="-20"
                  y="-20"
                />
              </g>
            </svg>
          </div>

          {/* ================= VERTICAL SEAM LIGHT ================= */}
          <div
            className="shell-seam-thread pointer-events-none relative z-30 flex flex-col items-center justify-center"
            style={{
              width: "20px",
              height: "56px",
              marginLeft: "-10px",
              marginRight: "-10px",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Soft Halo Gradient fading smoothly to 0 at top and bottom */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  state === "error"
                    ? "radial-gradient(ellipse 16px 100% at 50% 50%, rgba(255,180,84,0.4) 0%, transparent 75%)"
                    : "radial-gradient(ellipse 16px 100% at 50% 50%, rgba(195,215,255,0.4) 0%, transparent 75%)",
                opacity: seamIntensity,
                transition: "opacity 300ms var(--ease-out)",
              }}
            />
            {/* 1.5px Pure Core Thread fading smoothly to nothing at both ends */}
            <div
              className="h-full w-[1.5px]"
              style={{
                background:
                  state === "error"
                    ? "linear-gradient(to bottom, transparent 0%, rgba(255,180,84,0.7) 20%, #FFB454 50%, rgba(255,180,84,0.7) 80%, transparent 100%)"
                    : "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.7) 20%, #FFFFFF 50%, rgba(255,255,255,0.7) 80%, transparent 100%)",
                boxShadow:
                  state === "error"
                    ? "0 0 6px 1px rgba(255,180,84,0.75)"
                    : "0 0 6px 1px rgba(255,255,255,0.75)",
                opacity: Math.max(0.4, seamIntensity),
                transition: "opacity 300ms var(--ease-out), background 300ms",
              }}
            />
          </div>

          {/* ================= RIGHT WING ================= */}
          <div
            className="shell-wing-right relative"
            style={{
              width: "52px",
              height: "104px",
              marginLeft: "-1px",
              transformStyle: "preserve-3d",
            }}
          >
            <svg
              className="overflow-visible"
              height="104"
              viewBox="0 0 52 104"
              width="52"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* 5-stop Base Metal Gradient */}
                <linearGradient
                  id="metalRightBase"
                  x1="88%"
                  x2="12%"
                  y1="12%"
                  y2="88%"
                >
                  <stop offset="0%" stopColor="#F7F9FC" />
                  <stop offset="25%" stopColor="#D9DEE5" />
                  <stop offset="50%" stopColor="#AAB2BD" />
                  <stop offset="75%" stopColor="#6A7280" />
                  <stop offset="100%" stopColor="#C9CFD8" />
                </linearGradient>

                {/* Right Top Facet */}
                <linearGradient
                  id="metalRightTopFacet"
                  x1="0%"
                  x2="100%"
                  y1="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#E5EAF0" />
                  <stop offset="60%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#A8B0BC" />
                </linearGradient>

                {/* Right Bottom Facet */}
                <linearGradient
                  id="metalRightBottomFacet"
                  x1="0%"
                  x2="100%"
                  y1="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#7E8793" />
                  <stop offset="50%" stopColor="#58606D" />
                  <stop offset="100%" stopColor="#969EA9" />
                </linearGradient>

                {/* Right Bevel */}
                <linearGradient
                  id="metalBevelRight"
                  x1="0%"
                  x2="100%"
                  y1="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
                  <stop offset="60%" stopColor="rgba(255,255,255,0.3)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
                </linearGradient>

                {/* Right Wing Silhouette Clip for Glint */}
                <clipPath id="rightWingClip">
                  <path d="M 0,44 Q 0,36 8,32 L 44,14 Q 52,10 52,20 L 52,84 Q 52,94 44,90 L 8,72 Q 0,68 0,60 Z" />
                </clipPath>
              </defs>

              {/* Base Metal Silhouette */}
              <path
                d="M 0,44 Q 0,36 8,32 L 44,14 Q 52,10 52,20 L 52,84 Q 52,94 44,90 L 8,72 Q 0,68 0,60 Z"
                fill="url(#metalRightBase)"
              />

              {/* Facet Plane Top */}
              <polygon
                fill="url(#metalRightTopFacet)"
                opacity="0.85"
                points="0,44 8,32 44,14 52,20 26,52"
              />

              {/* Facet Plane Bottom */}
              <polygon
                fill="url(#metalRightBottomFacet)"
                opacity="0.8"
                points="26,52 52,84 44,90 8,72 0,60"
              />

              {/* Environment Tint: Cool #9CC3FF (14%) on upper facets */}
              <polygon
                fill="#9CC3FF"
                opacity="0.14"
                points="8,32 44,14 52,20 26,52"
              />

              {/* Environment Tint: Warm #FFD9A8 (10%) on lower facets */}
              <polygon
                fill="#FFD9A8"
                opacity="0.10"
                points="26,52 52,84 44,90 8,72"
              />

              {/* Inner Edge Bevel (0.75px) */}
              <path
                d="M 0,44 Q 0,36 8,32 L 44,14 Q 52,10 52,20 L 52,84 Q 52,94 44,90 L 8,72 Q 0,68 0,60 Z"
                fill="none"
                stroke="url(#metalBevelRight)"
                strokeWidth="0.75"
              />

              {/* Clipped Hinge Shading Overlay on inner seam edge */}
              <g clipPath="url(#rightWingClip)">
                <rect
                  fill="url(#rightHingeShadow)"
                  height="104"
                  opacity="0.4"
                  width="16"
                  x="0"
                  y="0"
                />
              </g>
              <defs>
                <linearGradient
                  id="rightHingeShadow"
                  x1="0%"
                  x2="100%"
                  y1="0%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="rgba(0,0,0,0.35)" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>

              {/* Clipped Specular Glint Band (delayed by 80ms) */}
              <g clipPath="url(#rightWingClip)">
                <rect
                  className="shell-glint-right"
                  height="140"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.85) 50%, transparent 62%)",
                    transform: "translateX(-120%)",
                  }}
                  width="100"
                  x="-20"
                  y="-20"
                />
              </g>
            </svg>
          </div>
        </div>

        {/* Contact Shadow ~90px below hero, shifts opposite to pointer */}
        <div
          className="shell-contact-shadow pointer-events-none mt-7 h-3 w-28 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,0.55) 0%, transparent 80%)",
            transform: "translateX(calc(var(--pointer-x) * -6px))",
            transition: "transform 450ms var(--ease-out)",
          }}
        />
      </div>
    </div>
  );
}
