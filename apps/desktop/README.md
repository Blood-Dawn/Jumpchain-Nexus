# Jumpchain Nexus Desktop

This package contains the new cross-platform desktop client built with Tauri 2, React, and TypeScript. It replaces the legacy WPF app and ships with a fully offline toolchain so contributors do not need a global Node installation.

> [!NOTE]
> The archived WPF solution now lives in `legacy/old-wpf/` and is excluded from npm publishing via `.npmignore`. None of the Vite, Tauri, or workspace scripts invoke that solution.

## Prerequisites

- Windows (or another OS supported by Tauri 2) with Rust toolchain installed
- The bundled Node.js runtime located at `tools/node/node-v22.12.0-win-x64`
- VS Code with the Tauri and rust-analyzer extensions is recommended

> The repository root exposes `node.cmd`, `npm.cmd`, and `npx.cmd` wrappers that automatically target the bundled Node 22 runtime. Use these instead of system-wide installs.

## Common scripts

```powershell
.\npm.cmd install           # install / update dependencies with the bundled Node
.\npm.cmd run dev          # start Vite + Tauri in watch mode
.\npm.cmd run build        # tsc project build followed by Vite production build
.\npm.cmd run tauri:dev    # launch the native shell with hot reload
.\npm.cmd run tauri:build  # produce a distributable bundle
```

When running `npm` or `npx` from PowerShell, always call these wrappers so the correct runtime is used. If you need raw `node`, invoke `.
ode.cmd`.

## Database migrations

The desktop client stores data in a SQLite database managed by Tauri's SQL plugin. Seed migrations live in `src/db/migrations/`. To rebuild the schema locally:

```powershell
.\npm.cmd run migrate
```

This uses `sql.js` to execute the migration scripts and writes the resulting database into the platform-specific app config directory.

## Tests

The project uses Vitest 3 for unit coverage and a mixture of WebdriverIO/Playwright for end-to-end safety nets.

```powershell
.\npm.cmd test                 # run the Vitest suite once
.\npm.cmd run test:smoke       # focused @smoke vitest specs for CI gating
.\npm.cmd run test:full        # chain unit, e2e, accessibility, and Rust checks
```

## Contributing tips

- The repository enforces strict TypeScript settings and uses project references; rely on `npm run build` to surface compiler errors.
- Keep documentation and MIT license headers in new files.
- If you upgrade Node, update the wrapper scripts and refresh this README so contributors know which version ships with the repo.
