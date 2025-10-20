/*
Bloodawn

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

import {
  getPlatform,
  type ConfirmDialogOptions,
  type OpenFileDialogOptions,
  type SaveFileDialogOptions,
} from "./platform";

export type {
  ConfirmDialogKind,
  ConfirmDialogOptions,
  OpenFileDialogOptions,
  SaveFileDialogOptions,
} from "./platform";

export async function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  const platform = await getPlatform();
  return platform.dialog.confirm(options);
}

export async function openFileDialog(options: OpenFileDialogOptions = {}): Promise<string[] | null> {
  const platform = await getPlatform();
  return platform.dialog.openFile(options);
}

export async function saveFileDialog(options: SaveFileDialogOptions = {}): Promise<string | null> {
  const platform = await getPlatform();
  return platform.dialog.saveFile(options);
}
