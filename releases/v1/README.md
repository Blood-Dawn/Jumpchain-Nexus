# Jumpchain Nexus v1 Release

This release packages the Jumpchain Nexus desktop application as a Windows executable produced via the Tauri workspace.

## Build Summary
- **App version:** 1.0.0
- **Target:** `x86_64-pc-windows-gnu`
- **Build command:**
  ```bash
  cargo build --manifest-path apps/desktop/src-tauri/Cargo.toml \
    --package appsdesktop \
    --target x86_64-pc-windows-gnu \
    --release
  ```
- **Build time (on GitHub Codespaces container):** ~3 minutes

## Output Artifacts
The command above writes the optimized binaries to:
`apps/desktop/src-tauri/target/x86_64-pc-windows-gnu/release/`

Key files to distribute:

| File | Purpose |
| --- | --- |
| `appsdesktop.exe` | Main Tauri application executable |
| `languagetool-proxy.exe` | Bundled LanguageTool sidecar stub (required at runtime) |
| `WebView2Loader.dll` | Microsoft WebView2 bootstrapper shipped by Tauri |

The `copy-sidecar.mjs` helper mirrors the `languagetool-proxy` binary so the bundler and installer logic can locate Windows-style filenames even when cross-compiling from Linux.

## Verification
After building, copy `appsdesktop.exe` and the accompanying sidecar into a Windows environment and launch the app. The stub sidecar prints a placeholder warning to stderr; replace it with a full implementation before shipping production builds.

## Rebuilding Instructions
1. Ensure the Windows GNU target and toolchain are installed:
   ```bash
   rustup target add x86_64-pc-windows-gnu
   sudo apt-get update && sudo apt-get install -y mingw-w64 wine nsis
   ```
2. Install JavaScript dependencies from the repository root:
   ```bash
   npm install
   ```
3. Execute the release build command shown above.
4. Collect the artifacts from `apps/desktop/src-tauri/target/x86_64-pc-windows-gnu/release/` and package them (e.g., ZIP) for distribution as release **v1**.

## Notes
- The LanguageTool proxy implementation is currently a stub that prints a message. Implement the actual proxy logic before releasing to end users.
- If additional target triples are required, extend `apps/desktop/scripts/copy-sidecar.mjs` with the necessary filename permutations.
- Prior Linux packaging attempts generated `.deb` and `.rpm` bundles successfully. AppImage bundling requires additional troubleshooting unrelated to this Windows release.
