# Marshell

**Your terminals, live previews, and project tasks in one workspace.**

Marshell is a cross-platform open-source desktop application built with Next.js and Tauri 2. Keep multi-terminal project workspaces, a responsive live preview browser, running background processes, and a Kanban task board together in a fast native window.

[Website](https://marshell.bond) · [Quick start](docs/quickstart.md) · [Issues](https://github.com/BhagirathsinhRana378/marshell/issues) · [Security](SECURITY.md)

## Features

- Organize projects in isolated workspaces with resizable multi-terminal grids powered by a native Rust PTY backend.
- Preview running local web apps side-by-side with responsive viewport presets, element inspection, and console diagnostics.
- Monitor and control local development processes directly inside the workspace.
- Track tasks across customizable Kanban boards and list views with priorities, subtasks, labels, and dependencies.
- Customize the interface with 40+ OKLCh color themes, light/dark modes, keyboard shortcuts, and 10 languages.
- Sign in through the Marshell web portal (`https://marshell.bond`) or use the workspace offline with local storage persistence.

## Develop locally

Requirements: Node.js 20+, pnpm 10+, stable Rust, and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
pnpm install
pnpm tauri dev
```

For frontend-only development on port 3010:

```bash
pnpm dev
```

Run quality checks:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

## Project layout

- `src/`: Next.js App Router entry points and static export routes.
- `src-tauri/`: Native Rust Tauri 2 backend (PTY management, preview proxy, process supervisor, filesystem & keychain helpers).
- `packages/core/`: Shared application UI, workspace state, terminal grid, preview browser, and Kanban board.
- `packages/ui/`: Design system primitives (shadcn/ui + Tailwind CSS v4 + themes).
- `packages/i18n/`: Type-safe translations across 10 locales.

## Security and license

Report security vulnerabilities via [SECURITY.md](SECURITY.md).

Licensed under the [MIT License](LICENSE).
