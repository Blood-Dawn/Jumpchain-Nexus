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

declare module "@tauri-apps/plugin-fs" {
  export interface ReadFileOptions {
    baseDir?: import("@tauri-apps/api/path").BaseDirectory;
  }

  export interface WriteFileOptions {
    append?: boolean;
    create?: boolean;
    createNew?: boolean;
    mode?: number;
    baseDir?: import("@tauri-apps/api/path").BaseDirectory;
  }

  export interface MkdirOptions {
    recursive?: boolean;
    mode?: number;
    baseDir?: import("@tauri-apps/api/path").BaseDirectory;
  }

  export function readFile(path: string, options?: ReadFileOptions): Promise<Uint8Array>;
  export function readTextFile(path: string, options?: ReadFileOptions): Promise<string>;
  export function writeFile(
    path: string,
    data: Uint8Array | ReadableStream<Uint8Array>,
    options?: WriteFileOptions
  ): Promise<void>;
  export function writeTextFile(path: string, data: string, options?: WriteFileOptions): Promise<void>;
  export function exists(path: string, options?: ReadFileOptions): Promise<boolean>;
  export function mkdir(path: string, options?: MkdirOptions): Promise<void>;
}
