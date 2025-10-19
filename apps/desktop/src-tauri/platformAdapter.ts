import type {
  ConfirmDialogOptions,
  OpenFileDialogOptions,
  Platform,
  PlatformDropTargetHandlers,
  SaveFileDialogOptions,
} from "../src/services/platform";

import { appConfigDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readFile, readTextFile } from "@tauri-apps/plugin-fs";
import {
  confirm as tauriConfirm,
  open as tauriOpen,
  save as tauriSave,
} from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";

function joinPaths(first: string, ...rest: string[]): Promise<string> {
  return rest.reduce<Promise<string>>(async (accPromise, segment) => {
    const acc = await accPromise;
    return join(acc, segment);
  }, Promise.resolve(first));
}

export function createTauriPlatform(): Platform {
  const dropTargets = new Map<HTMLElement, PlatformDropTargetHandlers>();
  let dropListener: (() => void) | null = null;
  let dropListenerPromise: Promise<void> | null = null;
  let activeTarget: HTMLElement | null = null;
  let lastPaths: string[] = [];

  const resolveRegisteredTarget = (position?: { x: number; y: number }): HTMLElement | null => {
    if (typeof document === "undefined" || !position) {
      return null;
    }
    const ratio = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
    const x = position.x / ratio;
    const y = position.y / ratio;
    let node = document.elementFromPoint(x, y) as HTMLElement | null;
    while (node) {
      if (dropTargets.has(node)) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  };

  const leaveActiveTarget = () => {
    if (!activeTarget) {
      return;
    }
    dropTargets.get(activeTarget)?.onLeave?.();
    activeTarget = null;
    lastPaths = [];
  };

  const handleHover = (target: HTMLElement | null, paths: string[]) => {
    if (target === activeTarget) {
      if (target) {
        dropTargets.get(target)?.onHover?.(paths);
      }
      return;
    }
    if (activeTarget && activeTarget !== target) {
      dropTargets.get(activeTarget)?.onLeave?.();
    }
    activeTarget = target;
    if (target) {
      dropTargets.get(target)?.onHover?.(paths);
    }
  };

  const handleDrop = (target: HTMLElement | null, paths: string[]) => {
    if (!target) {
      leaveActiveTarget();
      return;
    }
    const handlers = dropTargets.get(target);
    if (!handlers) {
      leaveActiveTarget();
      return;
    }
    handlers.onDrop?.(paths);
    handlers.onLeave?.();
    activeTarget = null;
    lastPaths = [];
  };

  const ensureDropListener = async (): Promise<void> => {
    if (dropListenerPromise) {
      await dropListenerPromise;
      return;
    }
    dropListenerPromise = (async () => {
      try {
        const currentWindow = getCurrentWindow();
        dropListener = await currentWindow.onDragDropEvent((event) => {
          const payload = event.payload;
          if (!payload) {
            return;
          }
          switch (payload.type) {
            case "enter":
              lastPaths = payload.paths ?? [];
              handleHover(resolveRegisteredTarget(payload.position), lastPaths);
              break;
            case "over":
              handleHover(resolveRegisteredTarget(payload.position), lastPaths);
              break;
            case "drop":
              lastPaths = payload.paths ?? [];
              handleDrop(resolveRegisteredTarget(payload.position), lastPaths);
              break;
            case "leave":
              leaveActiveTarget();
              break;
            default:
              break;
          }
        });
      } catch (error) {
        console.error("Failed to register drag-and-drop listener", error);
      }
    })();
    await dropListenerPromise;
  };

  const unregisterDropListenerIfIdle = () => {
    if (dropTargets.size === 0 && dropListener) {
      dropListener();
      dropListener = null;
      dropListenerPromise = null;
      activeTarget = null;
      lastPaths = [];
    }
  };

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
    drop: {
      registerDropTarget(target: HTMLElement, handlers: PlatformDropTargetHandlers) {
        dropTargets.set(target, handlers);
        void ensureDropListener();
        return () => {
          const existing = dropTargets.get(target);
          if (existing === handlers) {
            if (activeTarget === target) {
              handlers.onLeave?.();
              activeTarget = null;
            }
            dropTargets.delete(target);
            unregisterDropListenerIfIdle();
          }
        };
      },
    },
  };
}
