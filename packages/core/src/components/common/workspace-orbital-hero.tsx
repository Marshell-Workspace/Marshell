"use client";

import { cn } from "@workspace/ui/lib/utils";
import {
  CodeXml,
  Image as ImageIcon,
  LayoutList,
  Terminal,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { memo, useId } from "react";

export const MarshellApexMark = memo(function MarshellApexMark({
  className,
}: {
  className?: string;
}) {
  const fillId = useId();
  return (
    <div className={cn("workspace-apex-mark", className)}>
      <div className="workspace-apex-glow" />
      <svg className="workspace-apex-body" fill="none" viewBox="0 0 120 100">
        <defs>
          <linearGradient id={fillId} x1="50%" x2="50%" y1="0%" y2="100%">
            <stop stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#fff9ef" />
            <stop offset="1" stopColor="#eed8bd" />
          </linearGradient>
        </defs>
        <path
          d="M49 12 C54 2 66 2 71 12 L111 72 C120 89 113 97 96 97 H24 C7 97 0 89 9 72 Z"
          fill={`url(#${fillId})`}
        />
        <g className="workspace-apex-eyes" fill="#39312c">
          <rect height="21" rx="4.5" width="9" x="45" y="47" />
          <rect height="21" rx="4.5" width="9" x="66" y="47" />
        </g>
      </svg>
    </div>
  );
});

const CARDS = [
  { kind: "code", icon: CodeXml, orbitDelay: -10 },
  { kind: "terminal", icon: Terminal, orbitDelay: -30 },
  { kind: "workflow", icon: LayoutList, orbitDelay: -70 },
  { kind: "preview", icon: ImageIcon, orbitDelay: -50 },
] as const;
const ORBIT_PATH = "M 120 220 A 380 48 0 1 1 880 220 A 380 48 0 1 1 120 220";
const LIGHT_PHASES = [-3, -14, -25, -36, -47];

export const WorkspaceOrbitalHero = memo(function WorkspaceOrbitalHero() {
  const reducedMotion = useReducedMotion();
  const animated = !reducedMotion;
  const orbitId = useId();
  const planetFillId = useId();
  const rimId = useId();
  const warmRimId = useId();
  const atmosphereId = useId();
  const bloomId = useId();

  return (
    <div
      aria-hidden="true"
      className="workspace-orbital-scene"
      data-motion={animated ? "animated" : "static"}
    >
      <div className="workspace-scene-haze" />
      <div className="workspace-distant-lights">
        <span />
        <span />
        <span />
      </div>
      <svg className="workspace-orbit" fill="none" viewBox="0 0 1000 300">
        <defs>
          <linearGradient id={orbitId} x1="0%" x2="100%">
            <stop stopColor="#a5a3a1" stopOpacity="0.18" />
            <stop offset="0.5" stopColor="#e6c9a3" stopOpacity="0.3" />
            <stop offset="1" stopColor="#a5a3a1" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <path d={ORBIT_PATH} stroke={`url(#${orbitId})`} strokeWidth="1" />
        {LIGHT_PHASES.map((phase, index) => (
          <g key={phase}>
            {animated ? (
              <animateMotion
                begin={`${phase}s`}
                dur="58s"
                path={ORBIT_PATH}
                repeatCount="indefinite"
                rotate="auto"
              />
            ) : null}
            <g
              transform={
                animated
                  ? undefined
                  : `translate(${[180, 280, 575, 750, 865][index]}, ${[246, 181, 173, 184, 233][index]})`
              }
            >
              <circle
                className="workspace-orbit-halo"
                fill="#e6bc8a"
                opacity="0.35"
                r="7"
              />
              <ellipse cx="-4" fill="#ebcba2" opacity="0.18" rx="5" ry="0.8" />
              <circle fill="#ffe9cc" r="1.7" />
            </g>
          </g>
        ))}
      </svg>
      {CARDS.map(({ kind, icon: Icon, orbitDelay }) => (
        <div
          className={`workspace-card-orbit workspace-card-orbit-${kind}`}
          key={kind}
          style={{ animationDelay: `${orbitDelay}s` }}
        >
          <div
            className={`workspace-orbital-card workspace-orbital-card-${kind}`}
          >
            <div className="workspace-card-surface">
              <Icon
                className={cn(
                  "workspace-card-icon",
                  kind === "code" && "workspace-card-icon-code"
                )}
                strokeWidth={1.5}
              />
              <div className="workspace-card-lines">
                <span />
                <span />
                <span />
                <span />
                {kind === "code" && <span />}
              </div>
            </div>
          </div>
        </div>
      ))}
      {/* Headroom above the crest keeps the SVG mask from cutting the bloom flat. */}
      <svg
        className="workspace-planet"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 -100 1560 2600"
      >
        <defs>
          <radialGradient cx="50%" cy="0%" id={planetFillId} r="65%">
            <stop stopColor="#191a20" />
            <stop offset="0.18" stopColor="#0c0d10" />
            <stop offset="0.55" stopColor="#08090b" />
          </radialGradient>
          <linearGradient id={rimId} x1="0%" x2="100%">
            <stop stopColor="#a8c6ed" stopOpacity="0" />
            <stop offset="0.22" stopColor="#b6d1f3" stopOpacity="0.12" />
            <stop offset="0.32" stopColor="#c7def8" stopOpacity="0.45" />
            <stop offset="0.42" stopColor="#dceaff" stopOpacity="0.9" />
            <stop offset="0.5" stopColor="#fff1df" />
            <stop offset="0.58" stopColor="#dceaff" stopOpacity="0.9" />
            <stop offset="0.68" stopColor="#c7def8" stopOpacity="0.45" />
            <stop offset="0.78" stopColor="#b6d1f3" stopOpacity="0.12" />
            <stop offset="1" stopColor="#a8c6ed" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={warmRimId} x1="0%" x2="100%">
            <stop offset="0.32" stopColor="#ecc69b" stopOpacity="0" />
            <stop offset="0.46" stopColor="#ecc69b" stopOpacity="0.35" />
            <stop offset="0.5" stopColor="#ffe5c5" stopOpacity="0.65" />
            <stop offset="0.54" stopColor="#ecc69b" stopOpacity="0.35" />
            <stop offset="0.68" stopColor="#ecc69b" stopOpacity="0" />
          </linearGradient>
          <filter
            height="120%"
            id={atmosphereId}
            width="120%"
            x="-10%"
            y="-10%"
          >
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter height="120%" id={bloomId} width="120%" x="-10%" y="-10%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>
        <ellipse
          cx="780"
          cy="1250"
          fill={`url(#${planetFillId})`}
          rx="780"
          ry="1250"
        />
        <ellipse
          cx="780"
          cy="1250"
          filter={`url(#${atmosphereId})`}
          opacity="0.42"
          rx="780"
          ry="1250"
          stroke={`url(#${rimId})`}
          strokeWidth="10"
        />
        <ellipse
          cx="780"
          cy="1250"
          filter={`url(#${bloomId})`}
          rx="780"
          ry="1250"
          stroke={`url(#${warmRimId})`}
          strokeWidth="22"
        />
        <ellipse
          cx="780"
          cy="1250"
          rx="780"
          ry="1250"
          stroke={`url(#${rimId})`}
          strokeWidth="1.4"
        />
      </svg>
      <MarshellApexMark />
    </div>
  );
});
