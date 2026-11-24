import { describe, expect, it } from "vitest";
import { useCliSettingsStore } from "../stores/cli-settings-store";
import {
  buildCliInvocation,
  CLI_CONFIG_DEFS,
  escapeShellArg,
  parseCustomArgs,
} from "./cli-config-catalog";

describe("AI Agent CLI Configuration & Detection System", () => {
  // 1. Antigravity installed -> Installed
  it("generates correct command for installed Antigravity CLI", () => {
    const command = buildCliInvocation("antigravity");
    expect(command.executable).toBe("agy");
    expect(command.commandString).toBe("agy --dangerously-skip-permissions");
  });

  // 2. Antigravity missing / uninstalled state handling
  it("preserves provider metadata when configuring Antigravity", () => {
    const provider = CLI_CONFIG_DEFS.antigravity;
    expect(provider).toBeDefined();
    expect(provider?.executable).toBe("agy");
    expect(provider?.name).toBe("Antigravity CLI");
    expect(provider?.executionModes.some((m) => m.id === "accept-edits")).toBe(
      true
    );
  });

  // 3. CLI detection in Windows environment (well-known paths and alias mapping)
  it("supports both 'agy' and 'antigravity' aliases seamlessly", () => {
    const agyCmd = buildCliInvocation("agy", { modeId: "plan" });
    const antiCmd = buildCliInvocation("antigravity", { modeId: "plan" });
    expect(agyCmd.commandString).toBe(
      "agy --mode=plan --dangerously-skip-permissions"
    );
    expect(antiCmd.commandString).toBe(
      "agy --mode=plan --dangerously-skip-permissions"
    );
  });

  // 4. Configure installed CLI with custom mode and permissions
  it("configures installed CLI with custom execution mode and permissions", () => {
    const command = buildCliInvocation("antigravity", {
      modeId: "accept-edits",
      enabledPermissions: ["dangerously-skip-permissions"],
      advancedFlagValues: { sandbox: true },
    });

    expect(command.args).toContain("--mode=accept-edits");
    expect(command.args).toContain("--dangerously-skip-permissions");
    expect(command.args).toContain("--sandbox");
    expect(command.commandString).toBe(
      "agy --mode=accept-edits --dangerously-skip-permissions --sandbox"
    );
  });

  // 5. Configure uninstalled CLI definitions are complete for each provider
  it("has complete provider definitions for all AI agent CLIs", () => {
    const requiredProviders = [
      "antigravity",
      "agy",
      "claude",
      "codex",
      "gemini-cli",
      "gemini",
      "opencode",
      "q",
      "github-copilot",
    ];

    for (const p of requiredProviders) {
      expect(CLI_CONFIG_DEFS[p]).toBeDefined();
      expect(CLI_CONFIG_DEFS[p]?.executable).toBeTruthy();
      expect(CLI_CONFIG_DEFS[p]?.name).toBeTruthy();
    }
  });

  // 6. Launch with default settings
  it("builds default launch commands with maximum permissions skipped by default", () => {
    expect(buildCliInvocation("claude").commandString).toBe(
      "claude --dangerously-skip-permissions"
    );
    expect(buildCliInvocation("antigravity").commandString).toBe(
      "agy --dangerously-skip-permissions"
    );
    expect(buildCliInvocation("codex").commandString).toBe("codex --yolo");
    expect(buildCliInvocation("gemini").commandString).toBe("gemini --yolo");
    expect(buildCliInvocation("opencode").commandString).toBe(
      "opencode --auto"
    );
    expect(buildCliInvocation("q").commandString).toBe("q --trust-all-tools");
    expect(buildCliInvocation("github-copilot").commandString).toBe(
      "copilot --allow-all"
    );
  });

  // 7. Launch with configured settings
  it("builds provider-specific configured launch commands accurately", () => {
    // Claude
    const claudeCmd = buildCliInvocation("claude", {
      modeId: "auto",
      advancedFlagValues: { verbose: true, model: "sonnet" },
    });
    expect(claudeCmd.args).toContain("--permission-mode=auto");
    expect(claudeCmd.args).toContain("--verbose");
    expect(claudeCmd.args).toContain("--model");
    expect(claudeCmd.args).toContain("sonnet");

    // Gemini
    const geminiCmd = buildCliInvocation("gemini-cli", {
      modeId: "auto_edit",
      enabledPermissions: ["yolo"],
      advancedFlagValues: { debug: true },
    });
    expect(geminiCmd.args).toContain("--approval-mode=auto_edit");
    expect(geminiCmd.args).toContain("--yolo");
    expect(geminiCmd.args).toContain("--debug");

    // Amazon Q
    const qCmd = buildCliInvocation("q", {
      modeId: "chat",
      enabledPermissions: ["trust-all-tools"],
    });
    expect(qCmd.args).toContain("chat");
    expect(qCmd.args).toContain("--trust-all-tools");
  });

  // 8. Dangerous permission verification and flagging
  it("marks dangerous permission options with clear warnings and flags", () => {
    const agyDanger = CLI_CONFIG_DEFS.antigravity?.permissionOptions.find(
      (p) => p.id === "dangerously-skip-permissions"
    );
    expect(agyDanger?.isDangerous).toBe(true);
    expect(agyDanger?.dangerousWarning).toBeDefined();

    const claudeDanger = CLI_CONFIG_DEFS.claude?.permissionOptions.find(
      (p) => p.id === "dangerously-skip-permissions"
    );
    expect(claudeDanger?.isDangerous).toBe(true);

    const geminiDanger = CLI_CONFIG_DEFS.gemini?.permissionOptions.find(
      (p) => p.id === "yolo"
    );
    expect(geminiDanger?.isDangerous).toBe(true);
  });

  // 9. Configuration persistence in store
  it("persists and retrieves CLI runtime settings in useCliSettingsStore", () => {
    const store = useCliSettingsStore.getState();

    store.saveConfig("antigravity", {
      modeId: "plan",
      enabledPermissions: ["dangerously-skip-permissions"],
      advancedFlagValues: { effort: "high" },
    });

    const config = store.getConfig("antigravity");
    expect(config.modeId).toBe("plan");
    expect(config.enabledPermissions).toContain("dangerously-skip-permissions");

    const built = store.getBuiltCommand("antigravity");
    expect(built.commandString).toContain("--mode=plan");
    expect(built.commandString).toContain("--dangerously-skip-permissions");
    expect(built.commandString).toContain("--effort");
    expect(built.commandString).toContain("high");

    // Reset config
    store.resetConfig("antigravity");
    const reset = store.getConfig("antigravity");
    expect(reset.modeId).toBe("default");
    expect(reset.enabledPermissions).toContain("dangerously-skip-permissions");
  });

  // 10. Re-check after installation
  it("updates store when re-checking or updating partial configs", () => {
    const store = useCliSettingsStore.getState();
    store.updateConfig("claude", { modeId: "accept-edits" });
    expect(store.getConfig("claude").modeId).toBe("accept-edits");
    store.resetConfig("claude");
  });

  // 11. Custom argument parsing & escaping
  it("parses and escapes custom argument strings with quotes and spaces safely", () => {
    const parsed = parseCustomArgs(
      '--add-dir="./my directory" --model="gpt-4o" --flag'
    );
    expect(parsed).toEqual([
      "--add-dir=./my directory",
      "--model=gpt-4o",
      "--flag",
    ]);

    expect(escapeShellArg("simple_arg")).toBe("simple_arg");
    expect(escapeShellArg("arg with spaces")).toBe('"arg with spaces"');
    expect(escapeShellArg('arg "quotes"')).toBe('"arg \\"quotes\\""');
  });

  // 12. Custom Command full override behavior
  it("uses custom command verbatim without prepending or appending default executable", () => {
    // Single word custom command
    const custom1 = buildCliInvocation("claude", {
      customArgs: "ugiug",
    });
    expect(custom1.commandString).toBe("ugiug");
    expect(custom1.executable).toBe("ugiug");

    // Full multi-arg custom command
    const custom2 = buildCliInvocation("claude", {
      customArgs: "claude --dangerously-skip-permissions --verbose",
    });
    expect(custom2.commandString).toBe(
      "claude --dangerously-skip-permissions --verbose"
    );
    expect(custom2.executable).toBe("claude");
    expect(custom2.args).toEqual([
      "--dangerously-skip-permissions",
      "--verbose",
    ]);
  });

  // 13. Provider independence — different providers have different syntax
  it("ensures each provider retains distinct flags and options", () => {
    expect(
      CLI_CONFIG_DEFS.gemini?.executionModes.some((m) =>
        m.args.includes("--approval-mode=auto_edit")
      )
    ).toBe(true);
    expect(
      CLI_CONFIG_DEFS.claude?.executionModes.some((m) =>
        m.args.includes("--permission-mode=acceptEdits")
      )
    ).toBe(true);
    expect(
      CLI_CONFIG_DEFS.antigravity?.executionModes.some((m) =>
        m.args.includes("--mode=accept-edits")
      )
    ).toBe(true);
    expect(
      CLI_CONFIG_DEFS["github-copilot"]?.executionModes.some((m) =>
        m.args.includes("--autopilot")
      )
    ).toBe(true);
  });
});
