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

import type { Editor as TiptapEditor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface DraftState {
  json: string;
  plain: string;
  offsetMap: number[];
}

function traversePlainText(
  node: ProseMirrorNode,
  options: { map?: number[]; text?: { value: string } },
  pos: number,
): void {
  const textRef = options.text ?? { value: "" };
  const map = options.map;
  if (node.isText) {
    const value = node.text ?? "";
    for (let index = 0; index < value.length; index += 1) {
      map?.push(pos + index + 1);
    }
    textRef.value += value;
    return;
  }
  if (node.type.name === "hardBreak") {
    textRef.value += "\n";
    map?.push(pos + 1);
    return;
  }
  const startLength = textRef.value.length;
  node.forEach((child, offset) => {
    traversePlainText(child, options, pos + offset + 1);
  });
  if (node.isBlock && textRef.value.length > startLength) {
    textRef.value += "\n";
    map?.push(pos + node.nodeSize);
  }
}

export function computeDraftState(editor: TiptapEditor): DraftState {
  const doc = editor.state.doc;
  const accumulator = { value: "" };
  const offsetMap: number[] = [];
  traversePlainText(doc, { map: offsetMap, text: accumulator }, -1);
  return {
    json: JSON.stringify(editor.getJSON()),
    plain: accumulator.value.trimEnd(),
    offsetMap,
  };
}

export function extractPlainTextFromDoc(doc: ProseMirrorNode): string {
  const accumulator = { value: "" };
  traversePlainText(doc, { text: accumulator }, -1);
  return accumulator.value.trimEnd();
}

export function extractPlainTextFromJson(editor: TiptapEditor, json: string): string {
  const doc = editor.schema.nodeFromJSON(JSON.parse(json));
  return extractPlainTextFromDoc(doc);
}

export function restoreSnapshotContent(
  editor: TiptapEditor,
  json: string,
  currentDraft: DraftState | null,
  isDirty: boolean,
): { nextDraft: DraftState; backup: DraftState | null } {
  const backup = isDirty && currentDraft
    ? { ...currentDraft, offsetMap: [...currentDraft.offsetMap] }
    : null;
  editor.commands.setContent(JSON.parse(json), false);
  const nextDraft = computeDraftState(editor);
  return { nextDraft, backup };
}

