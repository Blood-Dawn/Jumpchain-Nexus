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

export type ConfirmDialogKind = "info" | "warning" | "error";

export interface ConfirmDialogOptions {
  message: string;
  title?: string;
  okLabel?: string;
  cancelLabel?: string;
  kind?: ConfirmDialogKind;
}

export interface OpenFileDialogFilter {
  name: string;
  extensions: string[];
}

export interface OpenFileDialogOptions {
  title?: string;
  multiple?: boolean;
  directory?: boolean;
  filters?: OpenFileDialogFilter[];
  defaultPath?: string;
}

export interface SaveFileDialogOptions {
  title?: string;
  filters?: OpenFileDialogFilter[];
  defaultPath?: string;
}

export interface PlatformPathAdapter {
  appConfigDir(): Promise<string>;
  join(...parts: string[]): Promise<string>;
}

export interface PlatformFsAdapter {
  ensureDir(path: string, options?: { recursive?: boolean }): Promise<void>;
  exists(path: string): Promise<boolean>;
  readBinaryFile(path: string): Promise<Uint8Array>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, contents: string): Promise<void>;
}

export interface PlatformDialogAdapter {
  confirm(options: ConfirmDialogOptions): Promise<boolean>;
  openFile(options?: OpenFileDialogOptions): Promise<string[] | null>;
  saveFile(options?: SaveFileDialogOptions): Promise<string | null>;
}

export type PlatformDropEventType = "hover" | "drop" | "leave";

export interface PlatformDropEvent {
  type: PlatformDropEventType;
  paths: string[];
}

export interface PlatformDropTargetHandlers {
  onHover?: (paths: string[]) => void;
  onDrop?: (paths: string[]) => void;
  onLeave?: () => void;
}

export interface PlatformDropAdapter {
  registerDropTarget(target: HTMLElement, handlers: PlatformDropTargetHandlers): () => void;
  emitTestEvent?(target: HTMLElement, event: PlatformDropEvent): void;
}

export interface Platform {
  path: PlatformPathAdapter;
  fs: PlatformFsAdapter;
  dialog: PlatformDialogAdapter;
  drop: PlatformDropAdapter;
}

export interface WebPlatformOptions {
  files?: Record<string, string | Uint8Array>;
  configDir?: string;
  confirmHandler?: (options: ConfirmDialogOptions) => Promise<boolean>;
  openFileHandler?: (options?: OpenFileDialogOptions) => Promise<string[] | null>;
  saveFileHandler?: (options?: SaveFileDialogOptions) => Promise<string | null>;
}

let activePlatform: Platform | null = null;
let activePlatformPromise: Promise<Platform> | null = null;

function isTauriEnvironment(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const globalWindow = window as unknown as {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  };
  return Boolean(globalWindow.__TAURI_INTERNALS__ ?? globalWindow.__TAURI__);
}

function ensurePlatformPromise(): Promise<Platform> {
  if (activePlatformPromise) {
    return activePlatformPromise;
  }

  if (isTauriEnvironment()) {
    activePlatformPromise = import("../../src-tauri/platformAdapter").then(({ createTauriPlatform }) => {
      const platform = createTauriPlatform();
      activePlatform = platform;
      return platform;
    });
  } else {
    const platform = createWebPlatform();
    activePlatform = platform;
    activePlatformPromise = Promise.resolve(platform);
  }

  return activePlatformPromise;
}

export function setPlatform(platform: Platform): void {
  activePlatform = platform;
  activePlatformPromise = Promise.resolve(platform);
}

export async function getPlatform(): Promise<Platform> {
  if (activePlatform) {
    return activePlatform;
  }
  return ensurePlatformPromise();
}

export function createWebPlatform(options: WebPlatformOptions = {}): Platform {
  const files = new Map<string, string | Uint8Array>(
    Object.entries(options.files ?? {}).map(([path, value]) => [path, value]),
  );

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const dropTargets = new Map<HTMLElement, PlatformDropTargetHandlers>();

  return {
    path: {
      async appConfigDir() {
        return options.configDir ?? "/";
      },
      async join(...parts: string[]) {
        return parts
          .filter((segment, index) => segment || index === 0)
          .join("/")
          .replace(/\\/g, "/")
          .replace(/\/+/g, "/");
      },
    },
    fs: {
      async ensureDir() {
        // No-op in mock implementation.
      },
      async exists(path: string) {
        return files.has(path);
      },
      async readBinaryFile(path: string) {
        const payload = files.get(path);
        if (payload instanceof Uint8Array) {
          return payload;
        }
        if (typeof payload === "string") {
          return encoder.encode(payload);
        }
        throw new Error(`File not found: ${path}`);
      },
      async readTextFile(path: string) {
        const payload = files.get(path);
        if (typeof payload === "string") {
          return payload;
        }
        if (payload instanceof Uint8Array) {
          return decoder.decode(payload);
        }
        throw new Error(`File not found: ${path}`);
      },
      async writeTextFile(path: string, contents: string) {
        files.set(path, contents);
      },
    },
    dialog: {
      async confirm(confirmOptions: ConfirmDialogOptions) {
        if (options.confirmHandler) {
          return options.confirmHandler(confirmOptions);
        }
        if (typeof window !== "undefined" && typeof window.confirm === "function") {
          return window.confirm(confirmOptions.message);
        }
        return true;
      },
      async openFile(openOptions?: OpenFileDialogOptions) {
        if (options.openFileHandler) {
          return options.openFileHandler(openOptions);
        }
        console.warn("openFile called on web platform without handler", openOptions);
        return null;
      },
      async saveFile(saveOptions?: SaveFileDialogOptions) {
        if (options.saveFileHandler) {
          return options.saveFileHandler(saveOptions);
        }
        console.warn("saveFile called on web platform without handler", saveOptions);
        return null;
      },
    },
    drop: {
      registerDropTarget(target: HTMLElement, handlers: PlatformDropTargetHandlers) {
        dropTargets.set(target, handlers);
        return () => {
          const existing = dropTargets.get(target);
          if (existing === handlers) {
            dropTargets.delete(target);
          }
        };
      },
      emitTestEvent(target: HTMLElement, event: PlatformDropEvent) {
        const handlers = dropTargets.get(target);
        if (!handlers) {
          return;
        }
        switch (event.type) {
          case "hover":
            handlers.onHover?.(event.paths);
            break;
          case "drop":
            handlers.onDrop?.(event.paths);
            break;
          case "leave":
            handlers.onLeave?.();
            break;
          default:
            break;
        }
      },
    },
  };
}

export async function initializePlatform(): Promise<Platform> {
  const platform = await ensurePlatformPromise();
  return platform;
}
