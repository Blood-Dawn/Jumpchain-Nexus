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

import { useMutation } from "@tanstack/react-query";
import Mention from "@tiptap/extension-mention";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./NotesEditor.css";
import { clearMentionsForNote, recordMention, upsertNote, type EntityRecord } from "../../db/dao";
import { useJmhStore } from "./store";
import type { Editor } from "@tiptap/core";

interface MentionOption {
  id: string;
  type: EntityRecord["type"];
  name: string;
}

const typeAliases: Record<string, EntityRecord["type"]> = {
  perk: "perk",
  per: "perk",
  item: "item",
  ite: "item",
  companion: "companion",
  comp: "companion",
  origin: "origin",
  ori: "origin",
};

function parseMentionQuery(raw: string): { kind: EntityRecord["type"] | null; term: string } {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return { kind: null, term: "" };
  }
  const [first, ...restParts] = normalized.split(/[:\s]/);
  const remaining = restParts.join(" ").trim();
  const kind = typeAliases[first] ?? null;
  if (kind) {
    return { kind, term: remaining };
  }
  return { kind: null, term: normalized };
}

function extractSummary(metaJson?: string | null): string | null {
  if (!metaJson) return null;
  try {
    const parsed = JSON.parse(metaJson);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.summary === "string") return parsed.summary;
      if (typeof parsed.description === "string") return parsed.description;
    }
  } catch {
    return metaJson;
  }
  return null;
}

function createMentionExtension(options: { getEntities: () => EntityRecord[] }) {
  return Mention.extend({
    name: "entityMention",
    addAttributes() {
      return {
        entityId: {
          default: "",
        },
        entityType: {
          default: "",
        },
        label: {
          default: "",
        },
      };
    },
  }).configure({
    HTMLAttributes: {
      class: "mention",
    },
    suggestion: {
      char: "@",
      items: ({ query }) => {
        const { kind, term } = parseMentionQuery(query);
        const entities = options.getEntities();
        const pool = kind ? entities.filter((entity) => entity.type === kind) : entities;
        const filterTerm = term.toLowerCase();
        return pool
          .filter((entity) => entity.name.toLowerCase().includes(filterTerm))
          .slice(0, 8)
          .map<MentionOption>((entity) => ({
            id: entity.id,
            type: entity.type,
            name: entity.name,
          }));
      },
      command: ({ editor, range, props }) => {
        const option = props as MentionOption;
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            {
              type: "entityMention",
              attrs: {
                id: option.id,
                entityId: option.id,
                entityType: option.type,
                label: option.name,
              },
            },
          ])
          .run();
      },
    },
    renderHTML({ node }) {
      const attrs = node.attrs as {
        entityId?: string;
        entityType?: string;
        label?: string;
        id?: string;
      };
      return [
        "span",
        {
          "data-entity-id": attrs.entityId ?? attrs.id,
          "data-entity-type": attrs.entityType,
        },
        `@${attrs.label ?? attrs.id}`,
      ];
    },
  });
}

function collectMentions(editor: Editor): Array<{
  entityId: string;
  start: number;
  end: number;
}> {
  const result: Array<{ entityId: string; start: number; end: number }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "entityMention" && node.attrs.entityId) {
      result.push({
        entityId: node.attrs.entityId as string,
        start: pos,
        end: pos + node.nodeSize,
      });
    }
    return true;
  });
  return result;
}

export const NotesEditor: React.FC = () => {
  const entities = useJmhStore((state) => state.entities);
  const notes = useJmhStore((state) => state.notes);
  const setNotes = useJmhStore((state) => state.setNotes);
  const selectedNoteId = useJmhStore((state) => state.selectedNoteId);
  const setSelectedNote = useJmhStore((state) => state.setSelectedNote);
  const selectedJumpId = useJmhStore((state) => state.selectedJumpId);
  const setSelectedJump = useJmhStore((state) => state.setSelectedJump);

  const currentNote = useMemo(() => {
    if (selectedNoteId) {
      return notes.find((note) => note.id === selectedNoteId) ?? null;
    }
    if (selectedJumpId) {
      return notes.find((note) => note.jump_id === selectedJumpId) ?? null;
    }
    return notes[0] ?? null;
  }, [notes, selectedNoteId, selectedJumpId]);

  useEffect(() => {
    if (!currentNote && notes.length > 0) {
      setSelectedNote(notes[0].id);
      setSelectedJump(notes[0].jump_id ?? null);
    }
  }, [currentNote, notes, setSelectedJump, setSelectedNote]);

  const [pendingHtml, setPendingHtml] = useState(currentNote?.md ?? "");
  const [dirty, setDirty] = useState(false);

  const entitiesRef = useRef<EntityRecord[]>(entities);
  useEffect(() => {
    entitiesRef.current = entities;
  }, [entities]);

  const extensions = useMemo(
    () => [StarterKit, createMentionExtension({ getEntities: () => entitiesRef.current })],
    [],
  );

  const editor = useEditor({
    extensions,
    content: currentNote?.md ?? "<p>Start chronicling your journey…</p>",
    onUpdate: ({ editor: instance }) => {
      setPendingHtml(instance.getHTML());
      setDirty(true);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (currentNote) {
      if (editor.getHTML() !== currentNote.md) {
        editor.commands.setContent(currentNote.md, false);
      }
    } else {
      editor.commands.setContent("<p>Start chronicling your journey…</p>", false);
    }
    setPendingHtml(currentNote?.md ?? "");
    setDirty(false);
  }, [editor, currentNote]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editor || !currentNote) return;
      const html = pendingHtml;
      const updated = await upsertNote({
        id: currentNote.id,
        md: html,
        jump_id: currentNote.jump_id,
      });
      const mentions = collectMentions(editor);
      await clearMentionsForNote(updated.id);
      if (mentions.length) {
        await Promise.all(
          mentions.map((mention) =>
            recordMention(updated.id, mention.entityId, mention.start, mention.end),
          ),
        );
      }
      const latestNotes = useJmhStore.getState().notes;
      setNotes(latestNotes.map((note) => (note.id === updated.id ? updated : note)));
      setDirty(false);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJumpId) return;
      const newNote = await upsertNote({
        id: crypto.randomUUID(),
        jump_id: selectedJumpId,
        md: `<h2>${new Date().toLocaleDateString()}</h2><p>New entry.</p>`,
      });
      const latestNotes = useJmhStore.getState().notes;
      setNotes([...latestNotes, newNote]);
      setSelectedNote(newNote.id);
      setSelectedJump(newNote.jump_id ?? null);
      setDirty(false);
    },
  });

  const [hover, setHover] = useState<{ entity: EntityRecord; rect: DOMRect } | null>(null);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;

    const onPointerEnter = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.dataset.entityId) return;
      const entity = entities.find((item) => item.id === target.dataset.entityId);
      if (!entity) return;
      const rect = target.getBoundingClientRect();
      setHover({ entity, rect });
    };

    const onPointerLeave = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.dataset.entityId) {
        setHover(null);
      }
    };

    dom.addEventListener("pointerenter", onPointerEnter, true);
    dom.addEventListener("pointerleave", onPointerLeave, true);
    return () => {
      dom.removeEventListener("pointerenter", onPointerEnter, true);
      dom.removeEventListener("pointerleave", onPointerLeave, true);
    };
  }, [editor, entities]);

  if (!editor) {
    return <div className="notes-editor__loading">Loading editor…</div>;
  }

  const hoverSummary = hover ? extractSummary(hover.entity.meta_json) : null;

  return (
    <section className="notes-editor">
      <header className="notes-editor__header">
        <div>
          <h2>Story Studio</h2>
          <span className="notes-editor__hint">Try @perk, @item, or @companion to link entities.</span>
          {currentNote?.jump_id && (
            <span className="notes-editor__badge">Jump-linked</span>
          )}
        </div>
        <div className="notes-editor__actions">
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !selectedJumpId}
          >
            New Note
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending || !currentNote}
          >
            {saveMutation.isPending ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </header>
      <EditorContent editor={editor} className="notes-editor__content" />
      {hover && (
        <div
          className="notes-editor__hover-card"
          style={{
            top: hover.rect.bottom + 8,
            left: hover.rect.left,
          }}
        >
          <strong>{hover.entity.name}</strong>
          <span className="notes-editor__hover-type">{hover.entity.type}</span>
          {hoverSummary && <p>{hoverSummary}</p>}
        </div>
      )}
    </section>
  );
};

export default NotesEditor;
