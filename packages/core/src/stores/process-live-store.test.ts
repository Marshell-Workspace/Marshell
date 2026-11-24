import type { ProcessInfo } from "@workspace/core/lib/process-client";
import {
  refreshProcesses,
  subscribeProcesses,
  useProcessLiveStore,
} from "@workspace/core/stores/process-live-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@workspace/core/lib/process-client", () => ({
  processClient: client,
}));

const proc = (id: string) => ({ id }) as ProcessInfo;

describe("process live store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    client.list.mockReset();
    client.list.mockResolvedValue([proc("a")]);
    useProcessLiveStore.setState({ byWorkspace: {} });
  });
  afterEach(() => vi.useRealTimers());

  it("shares one poller between subscribers and stops after the last leaves", async () => {
    const off1 = subscribeProcesses("w", 1000);
    const off2 = subscribeProcesses("w", 1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(client.list).toHaveBeenCalledTimes(1);
    expect(useProcessLiveStore.getState().byWorkspace.w).toEqual([proc("a")]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(client.list).toHaveBeenCalledTimes(2);

    off1();
    await vi.advanceTimersByTimeAsync(1000);
    expect(client.list).toHaveBeenCalledTimes(3);
    off2();
    await vi.advanceTimersByTimeAsync(5000);
    expect(client.list).toHaveBeenCalledTimes(3);
  });

  it("collapses overlapping refreshes and keeps the last list on failure", async () => {
    let release: (v: ProcessInfo[]) => void = () => undefined;
    client.list.mockReturnValueOnce(
      new Promise<ProcessInfo[]>((r) => {
        release = r;
      })
    );
    const first = refreshProcesses("x");
    await refreshProcesses("x");
    expect(client.list).toHaveBeenCalledTimes(1);
    release([proc("b")]);
    await first;
    expect(useProcessLiveStore.getState().byWorkspace.x).toEqual([proc("b")]);

    client.list.mockRejectedValueOnce(new Error("backend busy"));
    await refreshProcesses("x");
    expect(useProcessLiveStore.getState().byWorkspace.x).toEqual([proc("b")]);
  });
});
