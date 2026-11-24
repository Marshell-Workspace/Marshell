// @vitest-environment jsdom
import {
  GenieModal,
  GenieModalClose,
  GenieModalContent,
  useGenieModal,
} from "@workspace/ui/components/genie-modal";
import { resolveGenieOrigin } from "@workspace/ui/lib/genie-motion";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

const SETTLE_MS = 60;

function settle() {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  });
}

function surface() {
  return document.querySelector<HTMLElement>(
    '[data-slot="genie-modal-surface"]'
  );
}

function render(node: ReactNode) {
  return act(async () => root.render(node));
}

function Body() {
  return (
    <GenieModalContent aria-describedby={undefined} aria-label="Test modal">
      <GenieModalClose data-testid="close">Close</GenieModalClose>
    </GenieModalContent>
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // jsdom does not implement pseudo-element styles.
  const getStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    getStyle(element)
  );
  window.innerWidth = 800;
  window.innerHeight = 600;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function click(selector: string) {
  return act(async () => {
    document
      .querySelector<HTMLElement>(selector)
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("GenieModal lifecycle", () => {
  it("stays open and reopenable when a controlled parent declines the close", async () => {
    const onOpenChange = vi.fn();
    await render(
      <GenieModal onOpenChange={onOpenChange} open={true}>
        <Body />
      </GenieModal>
    );
    await settle();
    expect(surface()).not.toBeNull();

    await click('[data-testid="close"]');
    await settle();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(surface()).not.toBeNull();
    expect(surface()?.hasAttribute("inert")).toBe(false);
  });

  it("closes once a controlled parent accepts, then reopens", async () => {
    const tree = (open: boolean) => (
      <GenieModal onOpenChange={() => undefined} open={open}>
        <Body />
      </GenieModal>
    );
    await render(tree(true));
    await settle();
    await render(tree(false));
    await settle();
    expect(surface()).toBeNull();
    await render(tree(true));
    await settle();
    expect(surface()).not.toBeNull();
  });

  it("opens and closes in uncontrolled mode", async () => {
    function Opener() {
      const { openModal } = useGenieModal();
      return (
        <button data-testid="open" onClick={openModal} type="button">
          Open
        </button>
      );
    }
    await render(
      <GenieModal>
        <Opener />
        <Body />
      </GenieModal>
    );
    await settle();
    expect(surface()).toBeNull();

    await click('[data-testid="open"]');
    await settle();
    expect(surface()).not.toBeNull();

    await click('[data-testid="close"]');
    await settle();
    expect(surface()).toBeNull();
  });

  it("keeps resting geometry when the caller passes a style prop", async () => {
    await render(
      <GenieModal open={true}>
        <GenieModalContent aria-label="Styled" style={{ color: "red" }}>
          content
        </GenieModalContent>
      </GenieModal>
    );
    await settle();
    expect(surface()?.style.width).toBe("776px");
    expect(surface()?.style.color).toBe("red");
  });
});

describe("resolveGenieOrigin", () => {
  function trigger(left: number) {
    const button = document.createElement("button");
    button.dataset.genieTrigger = "";
    button.className = "t";
    button.getBoundingClientRect = () =>
      ({ left, top: 10, width: 40, height: 40 }) as DOMRect;
    document.body.append(button);
    return button;
  }

  it("follows the live trigger instead of the rect locked at open", () => {
    const button = trigger(300);
    const locked = { left: 10, top: 10, width: 40, height: 40 };
    expect(resolveGenieOrigin(button, ".t", locked).rect.left).toBe(300);
    button.remove();
  });

  it("finds a visible selector match when the first one is hidden", () => {
    const hidden = trigger(0);
    hidden.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect;
    const visible = trigger(120);
    expect(resolveGenieOrigin(null, ".t", null).element).toBe(visible);
    hidden.remove();
    visible.remove();
  });

  it("falls back to the locked rect when the trigger is gone", () => {
    const locked = { left: 10, top: 10, width: 40, height: 40 };
    expect(resolveGenieOrigin(null, ".missing", locked).rect).toBe(locked);
  });

  it("does not send selector-based dialogs to the New Workspace button", () => {
    const newWorkspace = document.createElement("button");
    newWorkspace.dataset.workspaceTrigger = "new-workspace";
    newWorkspace.getBoundingClientRect = () =>
      ({
        left: 5,
        top: 5,
        width: 100,
        height: 30,
        bottom: 35,
        right: 105,
      }) as DOMRect;
    document.body.append(newWorkspace);
    const result = resolveGenieOrigin(null, ".missing", null);
    expect(result.element).not.toBe(newWorkspace);
    newWorkspace.remove();
  });
});
