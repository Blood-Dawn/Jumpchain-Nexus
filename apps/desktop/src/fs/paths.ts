/*
MIT License

Copyright (c) 2025 Age-Of-Ages

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

import { getPlatform } from "../services/platform";

let cachedConfigDir: string | null = null;

export async function ensureConfigDir(): Promise<string> {
  if (cachedConfigDir) {
    return cachedConfigDir;
  }
  const platform = await getPlatform();
  const base = await platform.path.appConfigDir();
  const target = await platform.path.join(base, "jumpchain-nexus");
  const present = await platform.fs.exists(target);
  if (!present) {
    await platform.fs.ensureDir(target, { recursive: true });
  }
  cachedConfigDir = target;
  return target;
}

export async function resolveDbPath(fileName: string): Promise<string> {
  const platform = await getPlatform();
  const dir = await ensureConfigDir();
  return platform.path.join(dir, fileName);
}
