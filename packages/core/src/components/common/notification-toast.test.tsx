// @vitest-environment jsdom
import { Toaster } from "@workspace/ui/components/sonner";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Toaster />));
});

afterEach(async () => {
  await act(async () => {
    toast.dismiss();
    await vi.advanceTimersByTimeAsync(400);
    root.unmount();
  });
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("dismisses a single-surface toast with its accessible close button", async () => {
  await act(async () => {
    toast.info("Preview", { description: "A notification from Marshell." });
    await vi.advanceTimersByTimeAsync(50);
  });
  const notification = host.querySelector("[data-sonner-toast]");
  expect(notification?.getAttribute("data-styled")).toBe("false");
  expect(notification?.querySelector("[data-sonner-toast]")).toBeNull();
  const close = host.querySelector<HTMLButtonElement>("[data-close-button]");
  expect(close?.getAttribute("aria-label")).toBe("Dismiss notification");
  await act(async () => {
    close?.click();
    await vi.advanceTimersByTimeAsync(400);
  });
  expect(host.querySelector("[data-sonner-toast]")).toBeNull();
});

it("leaves time to read after the entrance, then automatically dismisses", async () => {
  await act(async () => {
    toast.error("Command failed");
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(host.querySelector("[data-sonner-toast]")).not.toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(3500));
  expect(host.querySelector("[data-sonner-toast]")).not.toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  expect(host.querySelector("[data-sonner-toast]")).toBeNull();
});

it("renders a status chip, a typed accent and an action without relying on blur effects", async () => {
  const onClick = vi.fn();
  await act(async () => {
    toast.success("Task completed", {
      description: "Marshell has finished your task.",
      action: { label: "View", onClick },
    });
    await vi.advanceTimersByTimeAsync(50);
  });
  const notification = host.querySelector("[data-sonner-toast]");
  expect(notification?.getAttribute("data-type")).toBe("success");
  expect(
    notification?.querySelector(".marshell-toast-status svg")
  ).not.toBeNull();
  const action = notification?.querySelector<HTMLButtonElement>(
    ".marshell-toast-action"
  );
  expect(action?.textContent).toBe("View");
  await act(async () => {
    action?.click();
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(onClick).toHaveBeenCalledOnce();
});

it("keeps the toast width within the window on every screen size", async () => {
  await act(async () => {
    toast.info("Width check");
    await vi.advanceTimersByTimeAsync(50);
  });
  const toaster = host.querySelector<HTMLElement>("[data-sonner-toaster]");
  expect(toaster?.style.getPropertyValue("--width")).toBe(
    "min(380px, calc(100vw - 24px))"
  );
});
