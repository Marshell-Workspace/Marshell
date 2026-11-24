"use client";

import { cn } from "@workspace/ui/lib/utils";

interface AiCliLogoProps {
  className?: string;
  id: string;
}

export function CodexLogo({ className }: { className?: string }) {
  return (
    <img
      alt="OpenAI Codex"
      className={cn("size-5 object-contain", className)}
      src="/codex-logo.png"
    />
  );
}

export function OpenAiLogo({ className }: { className?: string }) {
  return <CodexLogo className={className} />;
}

export function ClaudeLogo({ className }: { className?: string }) {
  return (
    <img
      alt="Claude Code"
      className={cn("size-5 object-contain", className)}
      src="/claude-logo.png"
    />
  );
}

export function GoogleGLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-5", className)}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function OpenCodeLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-5 stroke-current text-foreground", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function AmazonQLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-5", className)}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="11"
        cy="11"
        fill="none"
        r="7"
        stroke="#FF9900"
        strokeWidth="2.8"
      />
      <path
        d="M16 16L20.5 20.5"
        stroke="#FF9900"
        strokeLinecap="round"
        strokeWidth="3.2"
      />
    </svg>
  );
}

export function GitHubCopilotLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-5 fill-current text-foreground", className)}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function AntigravityLogo({ className }: { className?: string }) {
  return (
    <img
      alt="Antigravity CLI"
      className={cn("size-5 object-contain", className)}
      src="/antigravity-logo.png"
    />
  );
}

export function AiCliLogo({ id, className }: AiCliLogoProps) {
  switch (id) {
    case "codex":
      return <CodexLogo className={className} />;
    case "claude":
      return <ClaudeLogo className={className} />;
    case "gemini-cli":
      return <GoogleGLogo className={className} />;
    case "opencode":
      return <OpenCodeLogo className={className} />;
    case "q":
      return <AmazonQLogo className={className} />;
    case "github-copilot":
      return <GitHubCopilotLogo className={className} />;
    case "antigravity":
    case "agy":
      return <AntigravityLogo className={className} />;
    default:
      return <CodexLogo className={className} />;
  }
}
