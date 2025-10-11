# Contributing to Jumpchain Nexus

Thank you for your interest in helping modernize Jumpchain Nexus! This document captures the workflows and expectations that keep the project healthy across the legacy WPF codebase and the modern Tauri + React desktop rewrite.

## Table of contents
- [Project values](#project-values)
- [Code of Conduct](#code-of-conduct)
- [Repository structure](#repository-structure)
- [Development toolchains](#development-toolchains)
  - [Portable Node runtime](#portable-node-runtime)
  - [Rust + Tauri stack](#rust--tauri-stack)
  - [.NET WPF legacy app](#net-wpf-legacy-app)
- [Issue triage & planning](#issue-triage--planning)
- [Branching and pull requests](#branching-and-pull-requests)
- [Testing expectations](#testing-expectations)
- [Database migrations](#database-migrations)
- [Documentation](#documentation)
- [Security disclosures](#security-disclosures)

## Project values
Jumpchain Nexus exists to make building and narrating Jumpchains easier while remaining accessible to the community. We favour:

- **Offline-first workflows** — the entire toolchain should work without internet access.
- **Deterministic builds** — contributors should be able to reproduce builds from a clean checkout using the vendored toolchains.
- **Progressive modernization** — the Tauri desktop rewrite is the primary target, but we keep the WPF project operational for migration support.
- **Empathetic collaboration** — discussions stay respectful, assume positive intent, and focus on solving the problem together.

## Code of Conduct
Participation in this project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By contributing you agree to uphold those standards.

## Repository structure

- `apps/desktop/` — the active cross-platform desktop application written in React, TypeScript, and Rust (Tauri).
- `JumpchainCharacterBuilder/` — legacy WPF application retained for migration parity.
- `content/` — curated data and configuration assets.
- `DEV_NOTES/` — design notes, audits, and modernization plans.
- `tools/` — vendored toolchains (currently a portable Node.js runtime).

When in doubt, search for an existing pattern before introducing a new approach.

## Development toolchains

### Portable Node runtime
A portable Node.js 22 toolchain lives under `tools/node/`. Wrapper scripts at the repository root (`node.cmd`, `npm.cmd`, `npx.cmd`) guarantee everyone uses the same runtime. **Always call these wrappers** instead of relying on a global Node installation. This keeps dependencies consistent across Windows and CI.

For non-Windows environments, use `corepack` or invoke the binaries directly (e.g., `./tools/node/node-v22.12.0-linux-x64/bin/npm`) while keeping the same Node version.

### Rust + Tauri stack
- Install Rust via `rustup`. The default stable toolchain is expected.
- Install the Tauri prerequisites for your OS (see [Tauri's platform guide](https://tauri.app/start/prerequisites/)).
- Run `./npm.cmd run dev` or `./npm.cmd run tauri:dev` to work on the desktop app.

### .NET WPF legacy app
The classic builder targets .NET 8. Install the SDK and run `dotnet restore` + `dotnet build` inside the repository. While new features focus on the desktop rewrite, fixes that unblock migration are welcome.

## Issue triage & planning
1. **Search existing issues** and discussions before filing a new one.
2. Clearly describe the problem, reproduction steps, and desired outcome.
3. For large features, propose a design outline (`DEV_NOTES/` style) to gather feedback.
4. Maintainers label issues for scope, priority, and area (`desktop`, `legacy`, `docs`, etc.).

## Branching and pull requests
- Use feature branches named `feature/<summary>` or `fix/<summary>`.
- Keep commits focused and include descriptive messages (imperative mood, e.g., `Add migration helper script`).
- Ensure your branch is up to date with `main` before requesting review.
- Fill out the pull request template; link to relevant issues and include screenshots for UI-affecting changes.
- Contributions must include automated test coverage or justification for why tests were not added.

## Testing expectations
Before opening a pull request:

- **Desktop app**: run `./npm.cmd run build`, `./npm.cmd test`, and any affected end-to-end suites (`test:smoke`, `test:full`).
- **Rust commands**: run `./npm.cmd run tauri:check` or `cargo check` inside `apps/desktop/src-tauri` if you touched Rust code.
- **WPF**: run `dotnet test` for any impacted projects.
- Document the commands you executed in the PR description.

CI will re-run these checks. Fix failures or clearly explain transient issues in the PR.

## Database migrations
Schema changes live under `apps/desktop/src/db/migrations/` and are executed via `./npm.cmd run migrate`. When adding a migration:

1. Create a new timestamped SQL file in the migrations directory.
2. Update the migration runner if new behaviors are required.
3. Include backfill scripts or data transformations when necessary.
4. Document the change in the [CHANGELOG](CHANGELOG.md).

## Documentation
- Update relevant READMEs when tooling or workflows change.
- Keep the [CHANGELOG](CHANGELOG.md) current (use Keep a Changelog format).
- For major feature proposals, add or update files in `DEV_NOTES/` to capture rationale.

## Security disclosures
If you discover a vulnerability, do **not** open a public issue. Email the maintainers (see `SECURITY.md` if present or contact listed in repository metadata) with a description and reproduction steps. We will coordinate a fix and disclosure timeline.

We appreciate your help in keeping Jumpchain Nexus healthy and welcoming!
