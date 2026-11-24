# Security Policy

Thank you for helping keep Marshell and its users safe. We take security seriously and appreciate responsible disclosure from security researchers and community members.

## Supported Versions

We release security fixes for the latest minor release on the current major branch.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues or pull requests.**

Instead, report them privately via GitHub Private Vulnerability Reporting on this repository's **Security** tab (**Report a vulnerability**).

### What to Include

- A clear description of the vulnerability and its potential impact
- Steps to reproduce or a minimal proof-of-concept
- Affected component (desktop shell, PTY/terminal layer, preview proxy, filesystem commands, or web frontend)
- Version or commit hash tested

## Scope

This policy covers the open-source **Marshell** desktop and web codebase in this repository (`src/`, `src-tauri/`, `packages/`).

### Out of Scope

- Third-party dependencies (please report upstream and let maintainers know if an upgrade is needed)
- Issues requiring physical access to a user's machine or social engineering

## Security Best Practices

- Review workspace startup commands before opening untrusted repositories.
- Avoid committing `.env` files, credentials, or private keys into tracked workspaces.
