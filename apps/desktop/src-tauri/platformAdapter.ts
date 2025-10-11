import type {
  ConfirmDialogOptions,
  OpenFileDialogOptions,
  Platform,
  SaveFileDialogOptions,
} from "../src/services/platform";

import { appConfigDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readFile, readTextFile } from "@tauri-apps/plugin-fs";
import {
  confirm as tauriConfirm,
  open as tauriOpen,
  save as tauriSave,
} from "@tauri-apps/plugin-dialog";

function joinPaths(first: string, ...rest: string[]): Promise<string> {
  return rest.reduce<Promise<string>>(async (accPromise, segment) => {
    const acc = await accPromise;
    return join(acc, segment);
  }, Promise.resolve(first));
}

export function createTauriPlatform(): Platform {
  return {
    path: {
      appConfigDir,
      async join(...parts: string[]) {
        if (parts.length === 0) {
          return "";
        }
        const [first, ...rest] = parts;
        if (rest.length === 0) {
          return first;
        }
        return joinPaths(first, ...rest);
      },
    },
    fs: {
      async ensureDir(path: string, options?: { recursive?: boolean }) {
        await mkdir(path, { recursive: options?.recursive ?? true });
      },
      exists,
      readBinaryFile: readFile,
      readTextFile,
    },
    dialog: {
      async confirm(options: ConfirmDialogOptions) {
        return tauriConfirm(options.message, {
          title: options.title,
          okLabel: options.okLabel,
          cancelLabel: options.cancelLabel,
          kind: options.kind,
        });
      },
      async openFile(options?: OpenFileDialogOptions) {
        const selection = await tauriOpen({
          multiple: options?.multiple ?? false,
          directory: options?.directory ?? false,
          filters: options?.filters,
          defaultPath: options?.defaultPath,
          title: options?.title,
        });
        if (!selection) {
          return null;
        }
        if (Array.isArray(selection)) {
          return selection;
        }
        return [selection];
      },
      async saveFile(options?: SaveFileDialogOptions) {
        return tauriSave({
          title: options?.title,
          filters: options?.filters,
          defaultPath: options?.defaultPath,
        });
      },
    },
  };
}
