"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void): () => void {
  if (!window.matchMedia) {
    return () => {};
  }
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function snapshot(): boolean {
  return window.matchMedia?.(QUERY).matches ?? false;
}
const serverSnapshot = () => false;

/** Follow preference changes as well as the initial OS setting. */
export function useLiveReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
