"use client";

import {
  type ProcessInfo,
  processClient,
} from "@workspace/core/lib/process-client";
import { startResourcePolling } from "@workspace/core/lib/resource-polling";
import { useEffect } from "react";
import { create } from "zustand";

const DEFAULT_INTERVAL_MS = 2500;

interface LiveState {
  byWorkspace: Record<string, ProcessInfo[]>;
}

export const useProcessLiveStore = create<LiveState>(() => ({
  byWorkspace: {},
}));

interface Poller {
  inFlight: boolean;
  subscribers: number;
  timer: (() => void) | null;
}

const pollers = new Map<string, Poller>();

/** Fetches once now; overlapping calls for a workspace are collapsed. */
export async function refreshProcesses(workspaceId: string): Promise<void> {
  const poller = pollers.get(workspaceId) ?? {
    inFlight: false,
    subscribers: 0,
    timer: null,
  };
  pollers.set(workspaceId, poller);
  if (poller.inFlight) {
    return;
  }
  poller.inFlight = true;
  try {
    const list = await processClient.list(workspaceId);
    useProcessLiveStore.setState((s) => ({
      byWorkspace: { ...s.byWorkspace, [workspaceId]: list },
    }));
  } catch {
    // Not in the desktop app (or the backend is busy): keep the last known list.
  } finally {
    poller.inFlight = false;
  }
}

/** Starts polling while at least one component is subscribed; returns the unsubscribe. */
export function subscribeProcesses(
  workspaceId: string,
  intervalMs = DEFAULT_INTERVAL_MS
): () => void {
  const poller = pollers.get(workspaceId) ?? {
    inFlight: false,
    subscribers: 0,
    timer: null,
  };
  pollers.set(workspaceId, poller);
  poller.subscribers += 1;
  if (poller.subscribers === 1) {
    poller.timer = startResourcePolling(
      () => refreshProcesses(workspaceId),
      intervalMs
    );
  }
  return () => {
    poller.subscribers -= 1;
    if (poller.subscribers <= 0 && poller.timer) {
      poller.timer();
      pollers.delete(workspaceId);
    }
  };
}

const NONE: ProcessInfo[] = [];

/** Live process list for a workspace; several components can share one poller. */
export function useProcessLive(workspaceId: string | undefined): ProcessInfo[] {
  useEffect(
    () => (workspaceId ? subscribeProcesses(workspaceId) : undefined),
    [workspaceId]
  );
  return useProcessLiveStore((s) =>
    workspaceId ? (s.byWorkspace[workspaceId] ?? NONE) : NONE
  );
}

/** Polls several workspaces at once (e.g. every workspace that has a task run). */
export function useProcessPolling(workspaceIds: string[]): void {
  const key = [...new Set(workspaceIds)].sort().join("\u0000");
  useEffect(() => {
    const unsubscribe = key
      .split("\u0000")
      .filter(Boolean)
      .map((id) => subscribeProcesses(id));
    return () => {
      for (const off of unsubscribe) {
        off();
      }
    };
  }, [key]);
}
