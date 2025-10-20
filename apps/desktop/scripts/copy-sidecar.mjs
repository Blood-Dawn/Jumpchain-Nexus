#!/usr/bin/env node
/*
Bloodawn

Copyright (c) 2025 Bloodawn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const tauriDir = join(projectRoot, "src-tauri");
const targetDir = process.env.CARGO_TARGET_DIR
  ? join(process.env.CARGO_TARGET_DIR)
  : join(tauriDir, "target");
const releaseDir = join(targetDir, "release");
const extension = process.platform === "win32" ? ".exe" : "";
const baseBinaryName = `languagetool-proxy${extension}`;
const sourcePath = join(releaseDir, baseBinaryName);

if (!existsSync(sourcePath)) {
  console.error(`Expected sidecar at ${sourcePath}. Did cargo build --bin languagetool-proxy --release succeed?`);
  process.exit(1);
}

const binDir = join(tauriDir, "bin");
mkdirSync(binDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeCopy(src, dst, attempts = 5, delay = 200) {
  for (let i = 0; i < attempts; i++) {
    try {
      cpSync(src, dst);
      console.log(`Copied ${src} -> ${dst}`);
      return;
    } catch (err) {
      if (err && err.code === "EBUSY" && i < attempts - 1) {
        console.warn(`File busy, retrying copy (${i + 1}/${attempts})...`);
        // eslint-disable-next-line no-await-in-loop
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
        continue;
      }
      // Re-throw for unexpected errors or if out of retries
      throw err;
    }
  }
}

const destinationPath = join(binDir, baseBinaryName);
safeCopy(sourcePath, destinationPath);

const archTriple =
  process.env.TAURI_ENV_TARGET_TRIPLE ||
  process.env.RUST_TARGET ||
  process.env.CARGO_BUILD_TARGET ||
  (process.platform === "win32" ? "x86_64-pc-windows-msvc" : "");

if (archTriple) {
  const suffixedName = `${baseBinaryName}-${archTriple}${extension}`;
  const suffixedPath = join(binDir, suffixedName);
  cpSync(sourcePath, suffixedPath);
  console.log(`Copied ${sourcePath} -> ${suffixedPath}`);
}
