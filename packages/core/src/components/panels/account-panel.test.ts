import { getDisplayInitials } from "@workspace/core/components/navigation/user-nav";
import {
  buildAccountProfile,
  buildGoogleAuthState,
  deriveFirstName,
  getInitials,
} from "@workspace/core/components/panels/account-panel";
import { describe, expect, it } from "vitest";

describe("account profile data source", () => {
  it("computes 2-letter uppercase initials from name or email prefix", () => {
    expect(getDisplayInitials("meghrajravani", "meghrajravani@gmail.com")).toBe(
      "ME"
    );
    expect(getDisplayInitials("megradhawan", "")).toBe("ME");
    expect(
      getDisplayInitials("meghrajravani111", "meghrajravani111@gmail.com")
    ).toBe("ME");
    expect(getDisplayInitials("User", "meghrajravani@gmail.com")).toBe("ME");
    expect(getDisplayInitials(null, "meghrajravani@gmail.com")).toBe("ME");
    expect(
      getDisplayInitials("Meghraj Ravani", "meghrajravani@gmail.com")
    ).toBe("MR");
    expect(getInitials("Meghraj", "meghrajravani@gmail.com")).toBe("ME");
    expect(getInitials("megradhawan")).toBe("ME");
  });

  it("derives first name accurately from session name or email fallback", () => {
    expect(deriveFirstName("Meghraj Ravani", "meghrajravani@gmail.com")).toBe(
      "Meghraj"
    );
    expect(deriveFirstName(null, "meghraj.ravani@gmail.com")).toBe("Meghraj");
    expect(deriveFirstName(null, "rahul-sharma@gmail.com")).toBe("Rahul");

    const profile = buildAccountProfile(
      {
        avatar: "https://example.com/avatar.png",
        email: "meghrajravani@gmail.com",
        name: "Meghraj Ravani",
      },
      {
        avatar: "",
        email: "",
        name: "User",
      }
    );

    expect(profile.displayName).toBe("Meghraj");
    expect(profile.username).toBe("meghraj");
    expect(profile.email).toBe("meghrajravani@gmail.com");
    expect(profile.avatarUrl).toBe("https://example.com/avatar.png");
    expect(profile.initials).toBe("ME");
  });

  it("builds Google auth state from session", () => {
    const state = buildGoogleAuthState(
      {
        email: "meghrajravani@gmail.com",
        name: "Meghraj Ravani",
        session_id: "s1",
        user_id: "u1",
      },
      true
    );

    expect(state.connected).toBe(true);
    expect(state.email).toBe("meghrajravani@gmail.com");
    expect(state.status).toBe("connected");
    expect(state.label).toBe("Google Account");
    expect(state.showGitHub).toBe(false);
  });
});
