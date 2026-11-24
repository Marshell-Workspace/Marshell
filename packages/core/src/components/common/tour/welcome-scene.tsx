"use client";

import dynamic from "next/dynamic";

// Keep the tour's public component contract while loading its Three.js renderer
// only when the welcome scene mounts, rather than before sign-in can initialize.
export const WelcomeScene = dynamic(
  () => import("./welcome/WelcomeScene").then((module) => module.WelcomeScene),
  { ssr: false }
);
