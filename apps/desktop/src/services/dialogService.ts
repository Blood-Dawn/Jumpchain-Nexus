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

import { confirm as tauriConfirm, open as tauriOpen, save as tauriSave } from "@tauri-apps/plugin-dialog";
import type {
  ConfirmDialogOptions as NativeConfirmOptions,
  OpenDialogOptions as NativeOpenOptions,
  SaveDialogOptions as NativeSaveOptions,
} from "@tauri-apps/plugin-dialog";

export type ConfirmDialogKind = "info" | "warning" | "error";

export interface ConfirmDialogOptions {
  message: string;
  title?: string;
  okLabel?: string;
  cancelLabel?: string;
  kind?: ConfirmDialogKind;
}

export async function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  try {
    const tauriOptions: NativeConfirmOptions = {
      title: options.title,
      okLabel: options.okLabel,
      cancelLabel: options.cancelLabel,
      kind: options.kind,
    };
    return await tauriConfirm(options.message, tauriOptions);
  } catch (error) {
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      return window.confirm(options.message);
    }
    console.warn("confirmDialog fallback hit", error);
    return true;
  }
}

export interface OpenFileDialogOptions {
  title?: string;
  multiple?: boolean;
  directory?: boolean;
  filters?: NativeOpenOptions["filters"];
  defaultPath?: string;
}

export async function openFileDialog(options: OpenFileDialogOptions = {}): Promise<string[] | null> {
  try {
    const selection = await tauriOpen({
      multiple: options.multiple ?? false,
      directory: options.directory ?? false,
      filters: options.filters,
      defaultPath: options.defaultPath,
      title: options.title,
    });
    if (!selection) {
      return null;
    }
    if (Array.isArray(selection)) {
      return selection;
    }
    return [selection];
  } catch (error) {
    console.warn("openFileDialog fallback hit", error);
    return null;
  }
}

export interface SaveFileDialogOptions {
  title?: string;
  filters?: NativeSaveOptions["filters"];
  defaultPath?: string;
}

export async function saveFileDialog(options: SaveFileDialogOptions = {}): Promise<string | null> {
  try {
    return await tauriSave({
      title: options.title,
      filters: options.filters,
      defaultPath: options.defaultPath,
    });
  } catch (error) {
    console.warn("saveFileDialog fallback hit", error);
    return null;
  }
}
