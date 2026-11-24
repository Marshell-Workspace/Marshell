import { AI_AGENTS_CATALOG } from "@workspace/core/lib/cli-catalog";
import { describe, expect, it } from "vitest";

describe("native CLI detection catalog", () => {
  it("resolves the installed Antigravity result returned under the agy ID", () => {
    const nativeStatuses = {
      agy: { id: "agy", status: "installed", version: "1.2.11" },
    };
    const antigravity = AI_AGENTS_CATALOG.find(
      (agent) => agent.execName === "agy"
    );

    expect(antigravity).toBeDefined();
    expect(
      nativeStatuses[antigravity!.id as keyof typeof nativeStatuses]?.status
    ).toBe("installed");
  });

  it("provides official getCliUrl and docsUrl for AI agents", () => {
    const agy = AI_AGENTS_CATALOG.find((agent) => agent.id === "agy");
    expect(agy?.getCliUrl).toBe("https://antigravity.google/docs/cli/install/");
    expect(agy?.docsUrl).toBe("https://antigravity.google/docs/cli/install/");

    const codex = AI_AGENTS_CATALOG.find((agent) => agent.id === "codex");
    expect(codex?.getCliUrl).toBe("https://learn.chatgpt.com/docs/codex/cli");
    expect(codex?.docsUrl).toBe("https://learn.chatgpt.com/docs/codex/cli");

    const claude = AI_AGENTS_CATALOG.find((agent) => agent.id === "claude");
    expect(claude?.getCliUrl).toBe("https://code.claude.com/docs/en/setup");
    expect(claude?.docsUrl).toBe("https://code.claude.com/docs/en/setup");
  });
});
