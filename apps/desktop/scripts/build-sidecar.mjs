#!/usr/bin/env node

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, ".." );

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: projectRoot,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

await import(new URL("./prepare-sidecar.mjs", import.meta.url));

run(
  "cargo",
  [
    "build",
    "--manifest-path",
    "./src-tauri/Cargo.toml",
    "--bin",
    "languagetool-proxy",
    "--release",
  ],
  {
    env: {
      ...process.env,
      TAURI_SKIP_EXTERNAL_BIN_CHECK: "1",
    },
  }
);

await import(new URL("./copy-sidecar.mjs", import.meta.url));
