import { describe, expect, it } from "vitest";
import { Editor as CoreEditor } from "@tiptap/core";
import type { Editor as TiptapEditor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

import {
  computeDraftState,
  extractPlainTextFromJson,
  restoreSnapshotContent,
  type DraftState,
} from "./snapshotUtils";

function createEditor(content: string): CoreEditor {
  return new CoreEditor({
    extensions: [StarterKit],
    content,
  });
}

const asTiptap = (editor: CoreEditor): TiptapEditor => editor as unknown as TiptapEditor;

describe("snapshotUtils", () => {
  it("extracts plain text from snapshot JSON", () => {
    const editor = createEditor("<p>Line one<br />Line two</p><p>Second paragraph</p>");
    const json = JSON.stringify(editor.getJSON());
    const plain = extractPlainTextFromJson(asTiptap(editor), json);
    expect(plain).toBe("Line one\nLine two\nSecond paragraph");
  });

  it("returns a backup when restoring a dirty draft", () => {
    const editor = createEditor("<p>Unsaved draft</p>");
    const currentDraft = computeDraftState(asTiptap(editor));

    const snapshotEditor = createEditor("<p>Snapshot content</p>");
    const snapshotJson = JSON.stringify(snapshotEditor.getJSON());

    const { nextDraft, backup } = restoreSnapshotContent(
      asTiptap(editor),
      snapshotJson,
      currentDraft,
      true,
    );

    expect(nextDraft.plain).toBe("Snapshot content");
    expect(nextDraft.json).toBe(snapshotJson);
    expect(backup?.plain).toBe("Unsaved draft");
    expect(backup?.json).toBe(currentDraft.json);
    expect(backup?.offsetMap).not.toBe(currentDraft.offsetMap);
  });

  it("skips backup when restoring a clean draft", () => {
    const editor = createEditor("<p>Clean text</p>");
    const currentDraft: DraftState = computeDraftState(asTiptap(editor));

    const snapshotEditor = createEditor("<p>Replacement</p>");
    const snapshotJson = JSON.stringify(snapshotEditor.getJSON());

    const { nextDraft, backup } = restoreSnapshotContent(
      asTiptap(editor),
      snapshotJson,
      currentDraft,
      false,
    );

    expect(backup).toBeNull();
    expect(nextDraft.plain).toBe("Replacement");
  });
});
