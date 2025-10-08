import { mkdirSync, writeFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, "..", "src-tauri");
const binDir = join(projectRoot, "bin");

try {
  mkdirSync(binDir, { recursive: true });
} catch (error) {
  if (error.code !== "EEXIST") {
    throw error;
  }
}

const extension = process.platform === "win32" ? ".exe" : "";
const baseBinaryName = `languagetool-proxy${extension}`;
const basePath = join(binDir, baseBinaryName);

const archTriple =
  process.env.TAURI_ENV_TARGET_TRIPLE ||
  process.env.RUST_TARGET ||
  process.env.CARGO_BUILD_TARGET ||
  (process.platform === "win32" ? "x86_64-pc-windows-msvc" : "");

const ensureFile = (filePath) => {
  try {
    const stats = statSync(filePath);
    if (stats.isFile()) {
      return;
    }
  } catch (_) {
    // Ignore missing file
  }

  writeFileSync(filePath, "");
};

ensureFile(basePath);

if (archTriple) {
  const suffixedName = `${baseBinaryName}-${archTriple}${extension}`;
  const suffixedPath = join(binDir, suffixedName);
  ensureFile(suffixedPath);
}
