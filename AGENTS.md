# Marshell

Marshell is a cross-platform native application built with Next.js and Tauri 2. The native app exports as a static site loaded by Tauri into a Rust-backed system webview across desktop (Windows, macOS, Linux) and mobile (Android, iOS). The application logic, design system primitives, and translations live in modular workspace packages (`packages/core`, `packages/ui`, `packages/i18n`).

The project includes 40+ OKLCh color themes with light/dark variants, type-safe i18n for 10 languages via next-intl, a command palette (Cmd+K), keyboard shortcuts, and an AI agent dashboard workspace. State management uses Zustand with localStorage persistence. Styling uses Tailwind CSS v4 with shadcn/ui components built on Radix UI.

CI/CD runs through GitHub Actions with Release Please for Conventional Commits-based versioning and automated changelogs.

## Setup and commands

```bash
# Install: always use pnpm, never npm/yarn
pnpm install

# Development
pnpm dev                   # Next.js dev server (http://localhost:3010)
pnpm tauri dev             # Desktop app with live reload
pnpm tauri android dev     # Android
pnpm tauri ios dev         # iOS

# Quality gates (CI runs these on PRs)
pnpm check                 # Biome/Ultracite check
pnpm typecheck             # tsc across packages and root app
pnpm test                  # Vitest unit tests
pnpm build                 # Next.js static export build

# Utilities
pnpm fix                   # Auto-format and fix lint issues
pnpm clean                 # Remove build artifacts
pnpm shadcn add <name>     # Add shadcn/ui component to packages/ui
pnpm deps:check            # Check for outdated deps
pnpm deps:update           # Interactive update
```

Run from the repo root; never `cd` into a package to run scripts.

## Architecture

```
src/                  Root Next.js App Router (entry points, pages, layouts)
src-tauri/            Tauri 2 backend (Rust, windowing, native APIs, PTY)
public/               Static assets (icons, images)

packages/
  core/               Business logic: pages, components, hooks, stores, providers, config
  ui/                 Design system: shadcn/ui primitives, 40+ themes, global styles (Tailwind v4)
  i18n/               10-language type-safe translations (next-intl)
  typescript-config/  Shared tsconfig presets (base, nextjs, react-library)
```

### Dependency flow

```
Root App (src / src-tauri)
  └─ @workspace/core
       ├─ @workspace/ui
       └─ @workspace/i18n
```

Root app imports pages, layouts, and state from `packages/core`. Do not put platform-specific UI logic in `packages/core`; use the `@tauri-apps/api` guard pattern already in place.

## Coding standards

### TypeScript

- Strict mode is on globally (`strict: true`, `noUncheckedIndexedAccess: true`).
- Target: `ES2022`. Module: `NodeNext`.
- All new code must be TypeScript. No `.js` files in `packages/` or `apps/` source directories.

### Formatting and Linting (Biome/Ultracite)

- This project uses **Ultracite** as a zero-config preset over Biome.
- Formatting is strictly enforced (double quotes, 2-space indent).
- Linting catches issues but favors warnings or auto-fixing over failing builds locally.
- Tailwind class sorting is handled natively by Biome (`npx @biomejs/biome check`).
- Stylesheet reference: `packages/ui/src/styles/globals.css`.
- Run `pnpm fix` to automatically resolve formatting and lint issues.

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/). Release Please parses these to auto-generate changelogs.

| Prefix      | Purpose                             |
| ----------- | ----------------------------------- |
| `feat:`     | New feature                         |
| `fix:`      | Bug fix                             |
| `docs:`     | Documentation only                  |
| `style:`    | Formatting, no logic                |
| `refactor:` | Refactor, no behavior change        |
| `perf:`     | Performance improvement             |
| `test:`     | Adding/fixing tests                 |
| `deps:`     | Dependency updates                  |
| `ci:`       | CI config changes                   |
| `chore:`    | Maintenance (hidden from changelog) |

## Architecture boundaries

### Do

- Add new UI primitives to `packages/ui/src/components/`. Use shadcn/ui patterns.
- Add shared pages to `packages/core/src/pages/`, hooks to `hooks/`, stores to `stores/`.
- Add new translations to all 10 JSON files in `packages/i18n/src/messages/` (de, en, es, fr, it, ja, pt, ru, tr, zh).
- Use `@workspace/ui`, `@workspace/core`, `@workspace/i18n` workspace imports, never relative paths across package boundaries.
- Export new modules via the `exports` field in the respective `package.json`.

### Do not

- Do not modify `packages/typescript-config/` without explicit approval.
- Do not add app-specific dependencies to shared packages (`core`, `ui`, `i18n`).
- Do not modify `release-please-config.json`, `.release-please-manifest.json`, or GitHub workflow files without explicit approval.
- Do not use `npm` or `yarn`. This repo uses pnpm exclusively (v10+, corepack-managed).
- Do not add `"use server"` directives in `packages/core`. It must stay runtime-agnostic for static export.
- Do not edit auto-generated directories: `.next/`, `.source/`, `.turbo/`, `dist/`, `gen/`, `node_modules/`.

## Config locations

| What                  | Where                                              |
| --------------------- | -------------------------------------------------- |
| Site metadata         | `packages/core/src/config/site.ts`                 |
| Navigation config     | `packages/core/src/config/navigation.ts`           |
| Global CSS + themes   | `packages/ui/src/styles/globals.css`               |
| Tauri config          | `src-tauri/tauri.conf.json`                        |
| Next.js config        | `next.config.ts`                                   |

## Gotchas

- The root app sets `output: "export"` in Next.js config for static export to Tauri. API routes, server components, and `revalidate` will not work there.
- This project uses Tailwind CSS v4 with `@tailwindcss/postcss`. Configuration lives in `packages/ui/src/styles/globals.css`.
- `packages/i18n` static routing config is set in `src/i18n/request.ts`.
- Always add shadcn/ui components via `pnpm shadcn add <name>` from root. They land in `packages/ui/src/components/`.
- The repo requires squash merging with PR title as commit message. This keeps a linear history for Release Please.

## Testing

- All release uploads must go through `scripts/publish-release.ts`. Keep its 8 GB account-wide storage preflight, Standard storage class, and current-release-only R2 retention. Never bypass these checks with a manual upload script. Older installers remain archived on GitHub; do not retain their R2 copies.
- Run `pnpm test:release-storage` when changing release publishing or retention. `RELEASE_STORAGE_CHECK_ONLY=1` performs a read-only publishing preflight.

- Unit tests use Vitest (`packages/core`). Run with `pnpm test`. Co-locate test files next to source (`*.test.ts`).

## Prerequisites

- Node.js >= 20
- pnpm >= 10 (via corepack: `corepack enable`)
- Rust (latest stable), required only for native/desktop/mobile builds
- Platform-specific tools for native builds: see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)


# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm dlx ultracite fix`
- **Check for issues**: `pnpm dlx ultracite check`
- **Diagnose setup**: `pnpm dlx ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm dlx ultracite fix` before committing to ensure compliance.
