import { describe, expect, it } from "vitest";

import { getCollapsedLogoVisualState } from "./app-sidebar";

describe("getCollapsedLogoVisualState", () => {
  it("shows the Marshell logo when the sidebar is closed and the pointer is not over the trigger", () => {
    expect(
      getCollapsedLogoVisualState({
        sidebarOpen: false,
        logoHovered: false,
      })
    ).toBe("marshell");
  });

  it("shows the expand icon when the sidebar is closed and the pointer is over the trigger", () => {
    expect(
      getCollapsedLogoVisualState({
        sidebarOpen: false,
        logoHovered: true,
      })
    ).toBe("expand");
  });

  it("keeps the expanded branding visible while the sidebar is open", () => {
    expect(
      getCollapsedLogoVisualState({
        sidebarOpen: true,
        logoHovered: false,
      })
    ).toBe("branding");
  });

  it("recomputes the trigger state immediately after a close", () => {
    expect(
      getCollapsedLogoVisualState({
        sidebarOpen: false,
        logoHovered: false,
      })
    ).toBe("marshell");

    expect(
      getCollapsedLogoVisualState({
        sidebarOpen: false,
        logoHovered: true,
      })
    ).toBe("expand");
  });
});
