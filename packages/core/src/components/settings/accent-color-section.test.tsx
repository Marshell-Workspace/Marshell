// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRESET_ACCENTS } from "../../lib/accent-colors";
import { useGeneralSettingsStore } from "../../stores/general-settings-store";
import { AccentColorSection } from "./accent-color-section";

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  if (typeof window.PointerEvent === "undefined") {
    class MockPointerEvent extends MouseEvent {
      pointerId = 1;
      pointerType = "mouse";
    }
    // @ts-expect-error jsdom polyfill
    window.PointerEvent = MockPointerEvent;
    // @ts-expect-error jsdom polyfill
    global.PointerEvent = MockPointerEvent;
  }
  localStorage.clear();
  useGeneralSettingsStore.getState().resetToDefaults();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("AccentColorSection Component", { timeout: 15_000 }, () => {
  it("renders 10 preset swatch buttons plus 1 custom swatch button in a single row", async () => {
    await act(async () => root.render(<AccentColorSection />));

    const radiogroup = host.querySelector('[role="radiogroup"]');
    expect(radiogroup).toBeTruthy();
    expect(radiogroup?.className).toContain(
      "sm:grid-cols-[repeat(11,minmax(0,1fr))]"
    );

    const radios = host.querySelectorAll('[role="radio"]');
    // Exactly 10 presets + 1 custom trigger = 11 tiles
    expect(radios).toHaveLength(11);

    // Initial default is mint
    const mintRadio = host.querySelector(
      'button[aria-label="Mint"]'
    ) as HTMLButtonElement | null;
    expect(mintRadio).toBeTruthy();
    expect(mintRadio?.getAttribute("aria-checked")).toBe("true");

    // Readout pill shows Mint and its hex
    expect(host.textContent).toContain("Mint");
    expect(host.textContent).toContain("#15BA81");
  });

  it("selects a different preset swatch when clicked and updates readout", async () => {
    await act(async () => root.render(<AccentColorSection />));

    const violetRadio = host.querySelector(
      'button[aria-label="Violet"]'
    ) as HTMLButtonElement | null;
    expect(violetRadio).toBeTruthy();

    await act(async () => {
      violetRadio?.click();
    });

    expect(useGeneralSettingsStore.getState().accent).toBe("violet");
    expect(violetRadio?.getAttribute("aria-checked")).toBe("true");
    expect(host.textContent).toContain("Violet");
    expect(host.textContent).toContain("#8F43D1");
    expect(document.documentElement.getAttribute("data-accent")).toBe("violet");
  });

  it("navigates swatches using arrow keys across the single row", async () => {
    await act(async () => root.render(<AccentColorSection />));

    const radiogroup = host.querySelector(
      '[role="radiogroup"]'
    ) as HTMLDivElement | null;
    expect(radiogroup).toBeTruthy();

    // Mint is the first preset
    expect(PRESET_ACCENTS.findIndex((p) => p.id === "mint")).toBe(0);

    const press = async (key: string) => {
      await act(async () => {
        radiogroup?.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true })
        );
      });
    };

    await press("ArrowRight");
    expect(useGeneralSettingsStore.getState().accent).toBe(
      PRESET_ACCENTS[1]?.id
    );

    await press("ArrowLeft");
    expect(useGeneralSettingsStore.getState().accent).toBe(
      PRESET_ACCENTS[0]?.id
    );

    await press("End");
    expect(useGeneralSettingsStore.getState().accent).toBe("custom");

    await press("Home");
    expect(useGeneralSettingsStore.getState().accent).toBe(
      PRESET_ACCENTS[0]?.id
    );
  });

  it("clicking Custom tile activates custom accent and opens the picker dialog", async () => {
    await act(async () => root.render(<AccentColorSection />));

    const customRadio = host.querySelector(
      'button[aria-label="Custom"]'
    ) as HTMLButtonElement | null;
    expect(customRadio).toBeTruthy();

    await act(async () => {
      customRadio?.click();
    });

    expect(useGeneralSettingsStore.getState().accent).toBe("custom");
    expect(customRadio?.getAttribute("aria-checked")).toBe("true");

    // Picker dialog is mounted into document.body
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("Custom color");
    expect(dialog?.textContent).toContain("Wheel");
    expect(dialog?.textContent).toContain("Square");
    expect(dialog?.textContent).toContain("HEX");
    expect(dialog?.textContent).toContain("Apply");
    expect(dialog?.textContent).toContain("Cancel");

    // Color wheel slider is rendered in Wheel mode
    const wheel = dialog?.querySelector(
      '[aria-label="Color wheel (Hue and Saturation)"]'
    );
    expect(wheel).toBeTruthy();

    // Switch to Square mode
    const squareBtn = Array.from(dialog?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent?.includes("Square")
    );
    expect(squareBtn).toBeTruthy();
    await act(async () => {
      squareBtn?.click();
    });

    const svSquare = dialog?.querySelector(
      '[aria-label="Saturation and brightness"]'
    );
    expect(svSquare).toBeTruthy();
    const hueSlider = dialog?.querySelector('[aria-label="Hue"]');
    expect(hueSlider).toBeTruthy();
  });

  it("clicking inside the popover (wheel, brightness slider, inputs, tabs) does NOT close it", async () => {
    await act(async () => root.render(<AccentColorSection />));

    const customRadio = host.querySelector(
      'button[aria-label="Custom"]'
    ) as HTMLButtonElement | null;
    await act(async () => {
      customRadio?.click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();

    // 1. Click on color wheel
    const wheel = dialog?.querySelector(
      '[aria-label="Color wheel (Hue and Saturation)"]'
    );
    expect(wheel).toBeTruthy();
    await act(async () => {
      wheel?.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 100,
          clientY: 100,
        })
      );
      wheel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    // 2. Click on brightness slider
    const brightnessSlider = dialog?.querySelector('[aria-label="Brightness"]');
    expect(brightnessSlider).toBeTruthy();
    await act(async () => {
      brightnessSlider?.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 50,
          clientY: 50,
        })
      );
      brightnessSlider?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    // 3. Click inside HEX input
    const hexInput = dialog?.querySelector(
      "#custom-hex-input"
    ) as HTMLInputElement | null;
    expect(hexInput).toBeTruthy();
    await act(async () => {
      hexInput?.focus();
      hexInput?.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true })
      );
      hexInput?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    // 4. Click mode switcher tab (Wheel / Square)
    const squareBtn = Array.from(dialog?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent?.includes("Square")
    );
    expect(squareBtn).toBeTruthy();
    await act(async () => {
      squareBtn?.click();
    });
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it("drag starting on the wheel and ending outside the popover does NOT close it", async () => {
    await act(async () => root.render(<AccentColorSection />));

    const customRadio = host.querySelector(
      'button[aria-label="Custom"]'
    ) as HTMLButtonElement | null;
    await act(async () => {
      customRadio?.click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();

    const wheel = dialog?.querySelector(
      '[aria-label="Color wheel (Hue and Saturation)"]'
    );
    expect(wheel).toBeTruthy();

    // Pointerdown inside wheel
    await act(async () => {
      wheel?.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 150,
          clientY: 150,
        })
      );
    });
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    // Move pointer outside popover and release pointerup outside
    await act(async () => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: 0,
          clientY: 0,
        })
      );
      window.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          clientX: 0,
          clientY: 0,
        })
      );
    });

    // Popover must remain open
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it("live accent changes while open keep the popover mounted without unmounting", async () => {
    await act(async () => root.render(<AccentColorSection />));

    const customRadio = host.querySelector(
      'button[aria-label="Custom"]'
    ) as HTMLButtonElement | null;
    await act(async () => {
      customRadio?.click();
    });

    const dialogBefore = document.querySelector('[role="dialog"]');
    expect(dialogBefore).toBeTruthy();

    // Trigger color change by typing a new HEX
    const hexInput = dialogBefore?.querySelector(
      "#custom-hex-input"
    ) as HTMLInputElement | null;
    expect(hexInput).toBeTruthy();
    await act(async () => {
      if (hexInput) {
        hexInput.value = "E5484D";
        hexInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const dialogAfter = document.querySelector('[role="dialog"]');
    expect(dialogAfter).toBeTruthy();
    expect(dialogAfter).toBe(dialogBefore);
  });

  it("click truly outside closes it and restores previous accent; Esc does the same", async () => {
    // Start with violet
    useGeneralSettingsStore.getState().setAccent("violet");
    await act(async () => root.render(<AccentColorSection />));

    const customRadio = host.querySelector(
      'button[aria-label="Custom"]'
    ) as HTMLButtonElement | null;
    await act(async () => {
      customRadio?.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    // Click truly outside on document.body
    await act(async () => {
      document.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 10,
          clientY: 10,
        })
      );
    });

    // Popover is closed and original accent is restored
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(useGeneralSettingsStore.getState().accent).toBe("violet");

    // Open again and test Esc key
    await act(async () => {
      customRadio?.click();
    });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();

    await act(async () => {
      dialog?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        })
      );
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(useGeneralSettingsStore.getState().accent).toBe("violet");
  });

  it("clicking Custom tile while open keeps it open without flickering", async () => {
    await act(async () => root.render(<AccentColorSection />));

    const customRadio = host.querySelector(
      'button[aria-label="Custom"]'
    ) as HTMLButtonElement | null;
    await act(async () => {
      customRadio?.click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();

    // Click Custom tile again
    await act(async () => {
      customRadio?.click();
    });

    // Popover stays open
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it("does not render the preview strip", async () => {
    await act(async () => root.render(<AccentColorSection />));

    expect(host.textContent).not.toContain("Accent Preview");
    const buttons = Array.from(host.querySelectorAll("button"));
    expect(buttons.some((b) => b.textContent?.trim() === "Button")).toBe(false);
  });
});
