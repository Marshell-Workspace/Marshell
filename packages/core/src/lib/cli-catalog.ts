export interface CliItemMeta {
  capabilities?: string[];
  category?: string;
  command: string;
  description: string;
  docsUrl?: string;
  execName: string;
  getCliUrl?: string;
  icon?: string;
  id: string;
  installCmd?: string;
  installMethod?:
    | "npm"
    | "pip"
    | "winget"
    | "powershell"
    | "wsl"
    | "unavailable";
  name: string;
  prerequisite?: string;
  prerequisiteName?: string;
  versionFlag?: string;
}

export const AI_AGENTS_CATALOG: CliItemMeta[] = [
  {
    id: "codex",
    name: "OpenAI Codex CLI",
    description: "OpenAI's coding agent for terminal.",
    docsUrl: "https://learn.chatgpt.com/docs/codex/cli",
    getCliUrl: "https://learn.chatgpt.com/docs/codex/cli",
    execName: "codex",
    command: "codex --yolo",
    installMethod: "npm",
    versionFlag: "--version",
    prerequisite: "node",
    prerequisiteName: "Node.js",
  },
  {
    id: "claude",
    name: "Claude Code",
    description: "Anthropic's official coding agent.",
    docsUrl: "https://code.claude.com/docs/en/setup",
    getCliUrl: "https://code.claude.com/docs/en/setup",
    execName: "claude",
    command: "claude --dangerously-skip-permissions",
    installMethod: "npm",
    versionFlag: "--version",
    prerequisite: "node",
    prerequisiteName: "Node.js",
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    description: "Google's coding agent for developers.",
    docsUrl: "https://geminicli.com/docs/get-started/installation/",
    getCliUrl: "https://geminicli.com/docs/get-started/installation/",
    execName: "gemini",
    command: "gemini --yolo",
    installMethod: "npm",
    versionFlag: "--version",
    prerequisite: "node",
    prerequisiteName: "Node.js",
  },
  {
    id: "opencode",
    name: "OpenCode CLI",
    description: "Open source coding agent.",
    docsUrl: "https://opencode.ai/docs/",
    getCliUrl: "https://opencode.ai/docs/",
    execName: "opencode",
    command: "opencode --auto",
    installMethod: "npm",
    versionFlag: "--version",
    prerequisite: "node",
    prerequisiteName: "Node.js",
  },
  {
    id: "q",
    name: "Amazon Q Developer CLI",
    description:
      "Command-line AI coding assistant from AWS (requires WSL on Windows).",
    docsUrl: "https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/",
    getCliUrl: "https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/",
    execName: "q",
    command: "q --trust-all-tools",
    installMethod: "wsl",
    versionFlag: "--version",
    prerequisite: "wsl",
    prerequisiteName: "WSL",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot CLI",
    description: "GitHub's official AI assistant for the terminal.",
    docsUrl:
      "https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli",
    getCliUrl:
      "https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli",
    execName: "copilot",
    command: "copilot --allow-all",
    installMethod: "npm",
    versionFlag: "--version",
    prerequisite: "node",
    prerequisiteName: "Node.js",
  },
  {
    id: "agy",
    name: "Antigravity CLI",
    description: "Google Antigravity autonomous AI agent CLI tool.",
    docsUrl: "https://antigravity.google/docs/cli/install/",
    getCliUrl: "https://antigravity.google/docs/cli/install/",
    execName: "agy",
    command: "agy --dangerously-skip-permissions",
    installMethod: "npm",
    versionFlag: "--version",
    prerequisite: "node",
    prerequisiteName: "Node.js",
  },
];

export const INSTALLER_TOOLS_CATALOG: CliItemMeta[] = [
  {
    id: "node",
    name: "Node.js (LTS)",
    category: "JavaScript",
    description: "JavaScript runtime environment.",
    docsUrl: "https://nodejs.org",
    execName: "node",
    command: "node",
    installMethod: "winget",
    installCmd:
      "winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements",
    versionFlag: "-v",
  },
  {
    id: "pnpm",
    name: "pnpm",
    category: "JavaScript",
    description: "Fast, disk space efficient package manager.",
    docsUrl: "https://pnpm.io",
    execName: "pnpm",
    command: "pnpm",
    installMethod: "npm",
    installCmd: "npm install -g pnpm --no-fund --no-audit",
    versionFlag: "-v",
    prerequisite: "node",
    prerequisiteName: "Node.js",
  },
  {
    id: "bun",
    name: "Bun",
    category: "JavaScript",
    description: "All-in-one JavaScript runtime and toolkit.",
    docsUrl: "https://bun.sh",
    execName: "bun",
    command: "bun",
    installMethod: "powershell",
    installCmd:
      'powershell -ExecutionPolicy Bypass -Command "iwr -useb https://bun.sh/install.ps1 | iex"',
    versionFlag: "-v",
  },
  {
    id: "python",
    name: "Python",
    category: "Python",
    description: "Versatile programming language for script/AI.",
    docsUrl: "https://python.org",
    execName: "python",
    command: "python",
    installMethod: "winget",
    installCmd:
      "winget install --id Python.Python.3.12 -e --silent --accept-source-agreements --accept-package-agreements",
    versionFlag: "--version",
  },
  {
    id: "uv",
    name: "uv",
    category: "Python",
    description: "Extremely fast Python package installer.",
    docsUrl: "https://astral.sh/uv",
    execName: "uv",
    command: "uv",
    installMethod: "winget",
    installCmd:
      "winget install --id astral-sh.uv -e --silent --accept-source-agreements --accept-package-agreements",
    versionFlag: "--version",
  },
  {
    id: "rustup",
    name: "Rust",
    category: "Rust",
    description: "Systems programming language focused on safety.",
    docsUrl: "https://rust-lang.org",
    execName: "rustc",
    command: "rustc",
    installMethod: "winget",
    installCmd:
      "winget install --id Rustlang.Rustup -e --silent --accept-source-agreements --accept-package-agreements",
    versionFlag: "--version",
  },
  {
    id: "git",
    name: "Git",
    category: "Git",
    description: "Distributed version control system.",
    docsUrl: "https://git-scm.com",
    execName: "git",
    command: "git",
    installMethod: "winget",
    installCmd:
      "winget install --id Git.Git -e --silent --accept-source-agreements --accept-package-agreements",
    versionFlag: "--version",
  },
  {
    id: "gh",
    name: "GitHub CLI",
    category: "Git",
    description: "GitHub command line tool.",
    docsUrl: "https://cli.github.com",
    execName: "gh",
    command: "gh",
    installMethod: "winget",
    installCmd:
      "winget install --id GitHub.cli -e --silent --accept-source-agreements --accept-package-agreements",
    versionFlag: "--version",
  },
  {
    id: "docker",
    name: "Docker Desktop",
    category: "Containers",
    description: "Containerization developer platform.",
    docsUrl: "https://docker.com",
    execName: "docker",
    command: "docker",
    installMethod: "winget",
    installCmd:
      "winget install --id Docker.DockerDesktop -e --silent --accept-source-agreements --accept-package-agreements",
    versionFlag: "--version",
  },
  {
    id: "psql",
    name: "PostgreSQL",
    category: "Database",
    description: "Powerful open-source relational database.",
    docsUrl: "https://postgresql.org",
    execName: "psql",
    command: "psql",
    installMethod: "winget",
    installCmd:
      "winget install --id PostgreSQL.PostgreSQL -e --silent --accept-source-agreements --accept-package-agreements",
    versionFlag: "--version",
  },
  {
    id: "mongosh",
    name: "MongoDB",
    category: "Database",
    description: "NoSQL document-based database.",
    docsUrl: "https://mongodb.com",
    execName: "mongosh",
    command: "mongosh",
    installMethod: "winget",
    installCmd:
      "winget install --id MongoDB.Mongosh -e --silent --accept-source-agreements --accept-package-agreements",
    versionFlag: "--version",
  },
  {
    id: "firebase",
    name: "Firebase CLI",
    category: "Cloud",
    description: "Firebase command-line tools.",
    docsUrl: "https://firebase.google.com",
    execName: "firebase",
    command: "firebase",
    installMethod: "npm",
    installCmd: "npm install -g firebase-tools --no-fund --no-audit",
    versionFlag: "--version",
    prerequisite: "node",
    prerequisiteName: "Node.js",
  },
  {
    id: "supabase",
    name: "Supabase CLI",
    category: "Cloud",
    description: "Supabase local development toolset.",
    docsUrl: "https://supabase.com",
    execName: "supabase",
    command: "supabase",
    installMethod: "winget",
    installCmd:
      "winget install --id Supabase.CLI -e --silent --accept-source-agreements --accept-package-agreements",
    versionFlag: "--version",
  },
  {
    id: "vercel",
    name: "Vercel CLI",
    category: "Cloud",
    description: "Vercel cloud deployment interface.",
    docsUrl: "https://vercel.com",
    execName: "vercel",
    command: "vercel",
    installMethod: "npm",
    installCmd: "npm install -g vercel --no-fund --no-audit",
    versionFlag: "--version",
    prerequisite: "node",
    prerequisiteName: "Node.js",
  },
  {
    id: "ollama",
    name: "Ollama",
    category: "AI",
    description: "Run large language models locally.",
    docsUrl: "https://ollama.com",
    execName: "ollama",
    command: "ollama",
    installMethod: "winget",
    installCmd:
      "winget install --id Ollama.Ollama -e --silent --accept-source-agreements --accept-package-agreements",
    versionFlag: "--version",
  },
  {
    id: "wsl",
    name: "WSL",
    category: "Terminal",
    description: "Windows Subsystem for Linux.",
    docsUrl: "https://learn.microsoft.com/windows/wsl/",
    execName: "wsl",
    command: "wsl",
    installMethod: "wsl",
    installCmd: "wsl --install",
    versionFlag: "--version",
  },
  {
    id: "pwsh",
    name: "PowerShell 7",
    category: "Terminal",
    description: "Modern cross-platform command-line shell.",
    docsUrl: "https://microsoft.com/powershell",
    execName: "pwsh",
    command: "pwsh",
    installMethod: "winget",
    installCmd:
      "winget install --id Microsoft.PowerShell -e --silent --accept-source-agreements --accept-package-agreements",
    versionFlag: "--version",
  },
];

export const ALL_CLI_CATALOG: CliItemMeta[] = [
  ...AI_AGENTS_CATALOG,
  ...INSTALLER_TOOLS_CATALOG,
];

export type RunnerId =
  | "agy"
  | "claude"
  | "codex"
  | "cursor"
  | "gemini"
  | "opencode"
  | "qwen";

export interface HeadlessRunner {
  id: RunnerId;
  label: string;
  modelHint: string;
  /** Suggestions only; any model name the CLI accepts can be typed. */
  models: string[];
}

export const HEADLESS_RUNNERS: HeadlessRunner[] = [
  {
    id: "claude",
    label: "Claude Code",
    modelHint: "sonnet, opus, haiku, or a full model id",
    models: ["sonnet", "opus", "haiku"],
  },
  {
    id: "agy",
    label: "Antigravity CLI",
    modelHint: "a model id from your Antigravity setup",
    models: [],
  },
  {
    id: "codex",
    label: "Codex CLI",
    modelHint: "a model id from your Codex config",
    models: [],
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    modelHint: "e.g. gemini-2.5-pro",
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
  {
    id: "opencode",
    label: "OpenCode",
    modelHint: "provider/model, e.g. ollama/llama3 for a local model",
    models: [],
  },
  {
    id: "cursor",
    label: "Cursor Agent",
    modelHint: "a Cursor model name",
    models: [],
  },
  {
    id: "qwen",
    label: "Qwen Code",
    modelHint: "a Qwen model name",
    models: [],
  },
];

/** `readonly` is for reviews; only Claude, Codex and Gemini enforce it. */
export type Autonomy = "edits" | "readonly" | "yolo";

export interface RunnerConfig {
  autonomy: Autonomy;
  cli: "native" | RunnerId;
  model?: string;
  systemPrompt?: string;
}

export const DEFAULT_RUNNER: RunnerConfig = {
  autonomy: "yolo",
  cli: "native",
};
