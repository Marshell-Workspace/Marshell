# Contributing to Marshell

Describe the user-visible problem in a GitHub issue or pull request. For bugs, include your operating system, Marshell version, agent, reproduction steps, and expected result. Remove credentials and private project data from logs.

Use pnpm from the repository root. Follow the architecture and coding rules in [AGENTS.md](AGENTS.md). Keep shared logic in `packages/core`, UI primitives in `packages/ui`, and new translations in all ten message files.

Before submitting a change, run:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

For native changes, also run `cargo test --manifest-path src-tauri/Cargo.toml`. Some native integration tests need localhost sockets and normal process inspection permissions.

Use Conventional Commit titles, such as `fix: report failed terminal assignments`. Pull requests are squash merged. Explain the behavior changed and how you verified it. Do not edit generated directories or release workflows as part of unrelated changes.
