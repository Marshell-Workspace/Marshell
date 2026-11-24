/**
 * Provider-specific configuration definitions and structured command builder for AI Agent CLIs.
 */

export interface CliExecutionMode {
  args: string[];
  description: string;
  id: string;
  label: string;
}

export interface CliPermissionOption {
  dangerousWarning?: string;
  description: string;
  flag: string;
  id: string;
  isDangerous?: boolean;
  label: string;
}

export interface CliAdvancedFlag {
  defaultValue?: boolean | string;
  description: string;
  flag: string;
  id: string;
  label: string;
  options?: string[];
  placeholder?: string;
  type: "boolean" | "string" | "select";
}

export interface CliProviderConfigDef {
  advancedFlags: CliAdvancedFlag[];
  customArgsAllowed?: boolean;
  defaultModeId?: string;
  description: string;
  docsUrl?: string;
  executable: string;
  executionModes: CliExecutionMode[];
  id: string;
  name: string;
  permissionOptions: CliPermissionOption[];
}

export interface CliUserRuntimeConfig {
  advancedFlagValues?: Record<string, boolean | string>;
  customArgs?: string;
  enabledPermissions?: string[]; // IDs of enabled permissions
  modeId?: string;
}

export interface BuiltCliCommand {
  args: string[];
  commandString: string;
  executable: string;
}

export const CLI_CONFIG_DEFS: Record<string, CliProviderConfigDef> = {
  antigravity: {
    id: "antigravity",
    name: "Antigravity CLI",
    executable: "agy",
    description: "Google Antigravity autonomous AI agent CLI tool.",
    docsUrl: "https://github.com/google/antigravity",
    defaultModeId: "default",
    executionModes: [
      {
        id: "default",
        label: "Default Mode",
        description:
          "Standard interactive coding session with interactive approvals.",
        args: [],
      },
      {
        id: "accept-edits",
        label: "Accept Edits",
        description:
          "Automatically accepts non-breaking code edits during tasks.",
        args: ["--mode=accept-edits"],
      },
      {
        id: "plan",
        label: "Plan Mode",
        description:
          "Plan-first reasoning mode before executing any file changes.",
        args: ["--mode=plan"],
      },
    ],
    permissionOptions: [
      {
        id: "dangerously-skip-permissions",
        label: "Full Tool Access",
        description:
          "Auto-approve all tool permission requests without prompting.",
        flag: "--dangerously-skip-permissions",
        isDangerous: true,
        dangerousWarning:
          "Allows Antigravity CLI to run bash commands, edit files, and execute tools without prompting for confirmation.",
      },
    ],
    advancedFlags: [
      {
        id: "sandbox",
        label: "Terminal Sandbox",
        description: "Run in a sandbox with terminal restrictions enabled.",
        flag: "--sandbox",
        type: "boolean",
      },
      {
        id: "effort",
        label: "Reasoning Effort",
        description: "Reasoning effort for the current CLI session.",
        flag: "--effort",
        type: "select",
        options: ["low", "medium", "high", "max"],
      },
      {
        id: "continue",
        label: "Continue Recent Session",
        description: "Continue the most recent conversation.",
        flag: "--continue",
        type: "boolean",
      },
      {
        id: "model",
        label: "Model Override",
        description: "Specify AI model for this session.",
        flag: "--model",
        type: "string",
        placeholder: "e.g. gemini-2.5-pro",
      },
    ],
    customArgsAllowed: true,
  },
  agy: {
    id: "agy",
    name: "Antigravity CLI",
    executable: "agy",
    description: "Google Antigravity autonomous AI agent CLI tool.",
    docsUrl: "https://github.com/google/antigravity",
    defaultModeId: "default",
    executionModes: [
      {
        id: "default",
        label: "Default Mode",
        description:
          "Standard interactive coding session with interactive approvals.",
        args: [],
      },
      {
        id: "accept-edits",
        label: "Accept Edits",
        description:
          "Automatically accepts non-breaking code edits during tasks.",
        args: ["--mode=accept-edits"],
      },
      {
        id: "plan",
        label: "Plan Mode",
        description:
          "Plan-first reasoning mode before executing any file changes.",
        args: ["--mode=plan"],
      },
    ],
    permissionOptions: [
      {
        id: "dangerously-skip-permissions",
        label: "Full Tool Access",
        description:
          "Auto-approve all tool permission requests without prompting.",
        flag: "--dangerously-skip-permissions",
        isDangerous: true,
        dangerousWarning:
          "Allows Antigravity CLI to run bash commands, edit files, and execute tools without prompting for confirmation.",
      },
    ],
    advancedFlags: [
      {
        id: "sandbox",
        label: "Terminal Sandbox",
        description: "Run in a sandbox with terminal restrictions enabled.",
        flag: "--sandbox",
        type: "boolean",
      },
      {
        id: "effort",
        label: "Reasoning Effort",
        description: "Reasoning effort for the current CLI session.",
        flag: "--effort",
        type: "select",
        options: ["low", "medium", "high", "max"],
      },
      {
        id: "continue",
        label: "Continue Recent Session",
        description: "Continue the most recent conversation.",
        flag: "--continue",
        type: "boolean",
      },
      {
        id: "model",
        label: "Model Override",
        description: "Specify AI model for this session.",
        flag: "--model",
        type: "string",
        placeholder: "e.g. gemini-2.5-pro",
      },
    ],
    customArgsAllowed: true,
  },
  claude: {
    id: "claude",
    name: "Claude Code",
    executable: "claude",
    description: "Anthropic's official coding agent.",
    docsUrl: "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code",
    defaultModeId: "default",
    executionModes: [
      {
        id: "default",
        label: "Default (Manual)",
        description: "Prompts for confirmation before significant actions.",
        args: [],
      },
      {
        id: "accept-edits",
        label: "Accept Edits",
        description: "Automatically accepts file edits during tasks.",
        args: ["--permission-mode=acceptEdits"],
      },
      {
        id: "auto",
        label: "Auto Mode",
        description: "Autonomous mode with classifier-based permissions.",
        args: ["--permission-mode=auto"],
      },
      {
        id: "plan",
        label: "Plan Mode",
        description:
          "Plan-first reasoning without writing changes immediately.",
        args: ["--permission-mode=plan"],
      },
    ],
    permissionOptions: [
      {
        id: "dangerously-skip-permissions",
        label: "Skip Permissions",
        description: "Bypass all tool execution and confirmation prompts.",
        flag: "--dangerously-skip-permissions",
        isDangerous: true,
        dangerousWarning:
          "Allows Claude Code to run commands and edit files without asking for confirmation.",
      },
    ],
    advancedFlags: [
      {
        id: "verbose",
        label: "Verbose Output",
        description: "Override verbose mode setting to show diagnostics.",
        flag: "--verbose",
        type: "boolean",
      },
      {
        id: "safe-mode",
        label: "Safe Mode",
        description:
          "Start with all external customizations disabled for troubleshooting.",
        flag: "--safe-mode",
        type: "boolean",
      },
      {
        id: "model",
        label: "Model Override",
        description: "Specify model alias or full model name.",
        flag: "--model",
        type: "string",
        placeholder: "e.g. sonnet",
      },
      {
        id: "max-turns",
        label: "Max Turns",
        description: "Limit the number of conversational agent turns.",
        flag: "--max-turns",
        type: "string",
        placeholder: "e.g. 25",
      },
    ],
    customArgsAllowed: true,
  },
  codex: {
    id: "codex",
    name: "OpenAI Codex CLI",
    executable: "codex",
    description: "OpenAI's coding agent for terminal.",
    docsUrl: "https://github.com/openai/codex-cli",
    defaultModeId: "default",
    executionModes: [
      {
        id: "default",
        label: "Default Mode",
        description: "Standard interactive session.",
        args: [],
      },
      {
        id: "full-auto",
        label: "Full Auto",
        description: "Autonomous run with automatic step progression.",
        args: ["--full-auto"],
      },
      {
        id: "suggest",
        label: "Suggest Mode",
        description: "Provides recommendations without direct modifications.",
        args: ["--suggest"],
      },
    ],
    permissionOptions: [
      {
        id: "yolo",
        label: "Auto Approval (YOLO)",
        description: "Automatically approves command execution.",
        flag: "--yolo",
        isDangerous: true,
        dangerousWarning:
          "Allows Codex to execute terminal commands without interactive confirmation.",
      },
    ],
    advancedFlags: [
      {
        id: "sandbox",
        label: "Sandbox Isolation",
        description: "Enable sandbox isolation for commands.",
        flag: "--sandbox",
        type: "boolean",
      },
      {
        id: "model",
        label: "Model Override",
        description: "Specify OpenAI Codex model.",
        flag: "--model",
        type: "string",
        placeholder: "e.g. codex-mini",
      },
    ],
    customArgsAllowed: true,
  },
  "gemini-cli": {
    id: "gemini-cli",
    name: "Gemini CLI",
    executable: "gemini",
    description: "Google's coding agent for developers.",
    docsUrl: "https://github.com/google-gemini/gemini-cli",
    defaultModeId: "default",
    executionModes: [
      {
        id: "default",
        label: "Default Mode",
        description: "Standard interactive approvals.",
        args: [],
      },
      {
        id: "auto_edit",
        label: "Auto Edit",
        description: "Automatically approves file modifications.",
        args: ["--approval-mode=auto_edit"],
      },
      {
        id: "plan",
        label: "Plan Mode",
        description: "Generates structured execution plan first.",
        args: ["--approval-mode=plan"],
      },
    ],
    permissionOptions: [
      {
        id: "yolo",
        label: "Full Tool Access (YOLO)",
        description: "Unrestricted tool and command execution.",
        flag: "--yolo",
        isDangerous: true,
        dangerousWarning:
          "Allows Gemini CLI to run tools and bash commands without individual confirmation.",
      },
    ],
    advancedFlags: [
      {
        id: "sandbox",
        label: "Sandbox Mode",
        description: "Run in restricted environment.",
        flag: "--sandbox",
        type: "boolean",
      },
      {
        id: "debug",
        label: "Debug Output",
        description: "Print verbose diagnostic logs.",
        flag: "--debug",
        type: "boolean",
      },
      {
        id: "model",
        label: "Model Override",
        description: "Specify Gemini model.",
        flag: "--model",
        type: "string",
        placeholder: "e.g. gemini-2.5-pro",
      },
    ],
    customArgsAllowed: true,
  },
  gemini: {
    id: "gemini",
    name: "Gemini CLI",
    executable: "gemini",
    description: "Google's coding agent for developers.",
    docsUrl: "https://github.com/google-gemini/gemini-cli",
    defaultModeId: "default",
    executionModes: [
      {
        id: "default",
        label: "Default Mode",
        description: "Standard interactive approvals.",
        args: [],
      },
      {
        id: "auto_edit",
        label: "Auto Edit",
        description: "Automatically approves file modifications.",
        args: ["--approval-mode=auto_edit"],
      },
      {
        id: "plan",
        label: "Plan Mode",
        description: "Generates structured execution plan first.",
        args: ["--approval-mode=plan"],
      },
    ],
    permissionOptions: [
      {
        id: "yolo",
        label: "Full Tool Access (YOLO)",
        description: "Unrestricted tool and command execution.",
        flag: "--yolo",
        isDangerous: true,
        dangerousWarning:
          "Allows Gemini CLI to run tools and bash commands without individual confirmation.",
      },
    ],
    advancedFlags: [
      {
        id: "sandbox",
        label: "Sandbox Mode",
        description: "Run in restricted environment.",
        flag: "--sandbox",
        type: "boolean",
      },
      {
        id: "debug",
        label: "Debug Output",
        description: "Print verbose diagnostic logs.",
        flag: "--debug",
        type: "boolean",
      },
      {
        id: "model",
        label: "Model Override",
        description: "Specify Gemini model.",
        flag: "--model",
        type: "string",
        placeholder: "e.g. gemini-2.5-pro",
      },
    ],
    customArgsAllowed: true,
  },
  opencode: {
    id: "opencode",
    name: "OpenCode CLI",
    executable: "opencode",
    description: "Open source coding agent.",
    docsUrl: "https://github.com/sst/opencode",
    defaultModeId: "default",
    executionModes: [
      {
        id: "default",
        label: "Default Mode",
        description: "Interactive session with standard confirmations.",
        args: [],
      },
      {
        id: "auto",
        label: "Autonomous Mode",
        description: "Executes coding workflows automatically.",
        args: ["--auto"],
      },
    ],
    permissionOptions: [
      {
        id: "auto",
        label: "Auto Execution",
        description: "Automatically approves agent actions.",
        flag: "--auto",
        isDangerous: true,
        dangerousWarning:
          "Allows OpenCode to execute file edits and commands autonomously without confirmation.",
      },
    ],
    advancedFlags: [
      {
        id: "continue",
        label: "Continue Session",
        description: "Continue previous session.",
        flag: "--continue",
        type: "boolean",
      },
      {
        id: "model",
        label: "Model Override",
        description: "Specify model name.",
        flag: "--model",
        type: "string",
        placeholder: "e.g. claude-3-7-sonnet",
      },
    ],
    customArgsAllowed: true,
  },
  q: {
    id: "q",
    name: "Amazon Q Developer CLI",
    executable: "q",
    description:
      "Command-line AI coding assistant from AWS (requires WSL on Windows).",
    docsUrl: "https://aws.amazon.com/q/developer/",
    defaultModeId: "default",
    executionModes: [
      {
        id: "default",
        label: "Default Mode",
        description: "Interactive coding session.",
        args: [],
      },
      {
        id: "chat",
        label: "Chat Mode",
        description: "Opens interactive developer chat.",
        args: ["chat"],
      },
    ],
    permissionOptions: [
      {
        id: "trust-all-tools",
        label: "Trust All Tools",
        description: "Trusts and executes all tool calls without prompting.",
        flag: "--trust-all-tools",
        isDangerous: true,
        dangerousWarning:
          "Allows Amazon Q to execute tools and terminal commands without interactive confirmation.",
      },
    ],
    advancedFlags: [
      {
        id: "no-interactive",
        label: "Non-Interactive",
        description: "Execute commands non-interactively.",
        flag: "--no-interactive",
        type: "boolean",
      },
      {
        id: "resume",
        label: "Resume Session",
        description: "Resume previous session.",
        flag: "--resume",
        type: "boolean",
      },
    ],
    customArgsAllowed: true,
  },
  "github-copilot": {
    id: "github-copilot",
    name: "GitHub Copilot CLI",
    executable: "copilot",
    description: "GitHub's official AI assistant for the terminal.",
    docsUrl: "https://github.com/features/copilot",
    defaultModeId: "default",
    executionModes: [
      {
        id: "default",
        label: "Default Mode",
        description: "Standard interactive copilot assistant.",
        args: [],
      },
      {
        id: "autopilot",
        label: "Autopilot",
        description: "Autonomous multi-step task execution.",
        args: ["--autopilot"],
      },
    ],
    permissionOptions: [
      {
        id: "allow-all",
        label: "Allow All Permissions",
        description: "Allows all tools, paths, and URLs without confirmation.",
        flag: "--allow-all",
        isDangerous: true,
        dangerousWarning:
          "Allows GitHub Copilot to execute tools and access resources without individual approval.",
      },
    ],
    advancedFlags: [
      {
        id: "model",
        label: "Model Override",
        description: "Specify AI model.",
        flag: "--model",
        type: "string",
        placeholder: "e.g. gpt-4o",
      },
    ],
    customArgsAllowed: true,
  },
  copilot: {
    id: "copilot",
    name: "GitHub Copilot CLI",
    executable: "copilot",
    description: "GitHub's official AI assistant for the terminal.",
    docsUrl: "https://github.com/features/copilot",
    defaultModeId: "default",
    executionModes: [
      {
        id: "default",
        label: "Default Mode",
        description: "Standard interactive copilot assistant.",
        args: [],
      },
      {
        id: "autopilot",
        label: "Autopilot",
        description: "Autonomous multi-step task execution.",
        args: ["--autopilot"],
      },
    ],
    permissionOptions: [
      {
        id: "allow-all",
        label: "Allow All Permissions",
        description: "Allows all tools, paths, and URLs without confirmation.",
        flag: "--allow-all",
        isDangerous: true,
        dangerousWarning:
          "Allows GitHub Copilot to execute tools and access resources without individual approval.",
      },
    ],
    advancedFlags: [
      {
        id: "model",
        label: "Model Override",
        description: "Specify AI model.",
        flag: "--model",
        type: "string",
        placeholder: "e.g. gpt-4o",
      },
    ],
    customArgsAllowed: true,
  },
};

/**
 * Parses space-delimited arguments while respecting single and double quotes.
 */
export function parseCustomArgs(raw: string): string[] {
  const result: string[] = [];
  let current = "";
  let inDouble = false;
  let inSingle = false;

  for (const char of raw) {
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (char === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (char === " " && !inDouble && !inSingle) {
      if (current.trim().length > 0) {
        result.push(current.trim());
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current.trim().length > 0) {
    result.push(current.trim());
  }

  return result;
}

/**
 * Escapes a single argument for shell execution if it contains spaces or special characters.
 */
export function escapeShellArg(arg: string): string {
  if (/^[a-zA-Z0-9_\-./:=]+$/.test(arg)) {
    return arg;
  }
  // Escape inner double quotes
  return `"${arg.replace(/"/g, '\\"')}"`;
}

/**
 * Returns default runtime configuration for a CLI agent, enabling maximum
 * dangerous/skip-permissions options by default.
 */
export function getDefaultCliRuntimeConfig(
  cliId: string
): CliUserRuntimeConfig {
  const provider =
    CLI_CONFIG_DEFS[cliId] || CLI_CONFIG_DEFS[cliId.toLowerCase()];
  const defaultPermissions = provider
    ? provider.permissionOptions.map((p) => p.id)
    : [];
  return {
    modeId: provider?.defaultModeId || "default",
    enabledPermissions: defaultPermissions,
    advancedFlagValues: {},
    customArgs: "",
  };
}

/**
 * Builds structured invocation and serialized command string from provider def and user config.
 */
export function buildCliInvocation(
  cliId: string,
  userConfig?: CliUserRuntimeConfig
): BuiltCliCommand {
  const provider = CLI_CONFIG_DEFS[cliId] ||
    CLI_CONFIG_DEFS[cliId.toLowerCase()] || {
      id: cliId,
      name: cliId,
      executable: cliId,
      description: "",
      executionModes: [],
      permissionOptions: [],
      advancedFlags: [],
    };

  const defaultConfig = getDefaultCliRuntimeConfig(cliId);
  const activeModeId =
    userConfig?.modeId ||
    defaultConfig.modeId ||
    provider.defaultModeId ||
    "default";

  const effectivePermissions =
    userConfig?.enabledPermissions === undefined
      ? defaultConfig.enabledPermissions
      : userConfig.enabledPermissions;

  const args: string[] = [];

  // 1. Add Execution Mode arguments
  const selectedMode = provider.executionModes.find(
    (m) => m.id === activeModeId
  );
  if (selectedMode?.args) {
    for (const a of selectedMode.args) {
      if (a && !args.includes(a)) {
        args.push(a);
      }
    }
  }

  // 2. Add Enabled Permissions
  if (effectivePermissions && effectivePermissions.length > 0) {
    for (const permId of effectivePermissions) {
      const permDef = provider.permissionOptions.find((p) => p.id === permId);
      if (permDef?.flag && !args.includes(permDef.flag)) {
        args.push(permDef.flag);
      }
    }
  }

  // 3. Add Advanced Flags
  if (userConfig?.advancedFlagValues) {
    for (const [flagId, val] of Object.entries(userConfig.advancedFlagValues)) {
      const flagDef = provider.advancedFlags.find((f) => f.id === flagId);
      if (!flagDef) {
        continue;
      }

      if (flagDef.type === "boolean" && val === true) {
        if (!args.includes(flagDef.flag)) {
          args.push(flagDef.flag);
        }
      } else if (
        (flagDef.type === "string" || flagDef.type === "select") &&
        typeof val === "string" &&
        val.trim().length > 0
      ) {
        const strVal = val.trim();
        // Check if flag already includes '=' or separate
        if (flagDef.flag.includes("=")) {
          args.push(`${flagDef.flag}${strVal}`);
        } else {
          args.push(flagDef.flag, strVal);
        }
      }
    }
  }

  // If the user specified a custom command, use it directly as the entire command
  if (userConfig?.customArgs && userConfig.customArgs.trim().length > 0) {
    const trimmedCustom = userConfig.customArgs.trim();
    const customParsed = parseCustomArgs(trimmedCustom);
    const customExec = customParsed[0] || provider.executable;
    const customArgsList = customParsed.slice(1);

    return {
      executable: customExec,
      args: customArgsList,
      commandString: trimmedCustom,
    };
  }

  // Build safe serialized command string from structured configuration
  const commandParts = [provider.executable, ...args.map(escapeShellArg)];
  const commandString = commandParts.join(" ");

  return {
    executable: provider.executable,
    args,
    commandString,
  };
}
