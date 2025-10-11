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

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "prosemirror-view";
import { Plugin, PluginKey } from "prosemirror-state";
import type {
  ChapterRecord,
  ChapterSnapshotRecord,
  StoryWithChapters,
  EntityRecord,
} from "../../db/dao";
import {
  getChapterText,
  listChapterSnapshots,
  loadFormatterSettings,
  recordChapterSnapshot,
  reorderChapters,
  saveChapterText,
} from "../../db/dao";
import { useJmhStore } from "../jmh/store";
import { useStudioStore } from "./store";
import { createEntityMentionExtensions } from "./mentionExtension";
import { checkGrammar, createGrammarDebouncer, type GrammarSuggestion } from "../../services/grammar";
import { syncChapterMetadata } from "./indexer";
import { exportChapter, exportStory, type StoryExportFormat } from "./exporters";
import { confirmDialog } from "../../services/dialogService";
import { studioTemplates, type StudioTemplate } from "./templates";
import { insertTemplateContent } from "./templates/utils";

interface StudioEditorProps {
  story: StoryWithChapters | null;
  chapter: ChapterRecord | null;
  onChapterRenamed: (chapterId: string, title: string) => Promise<void>;
  onStoryRenamed: (storyId: string, title: string) => Promise<void>;
  onRequestChapterCreate: (storyId: string | null) => Promise<void>;
}

interface DraftState {
  json: string;
  plain: string;
  offsetMap: number[];
}

interface GrammarDecoration {
  id: string;
  from: number;
  to: number;
}

interface GrammarSuggestionWithRange extends GrammarSuggestion {
  from: number;
  to: number;
}

const grammarKey = new PluginKey<DecorationSet>("studio-grammar");

const GrammarHighlightExtension = Extension.create({
  name: "grammarHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: grammarKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            let decorations = old.map(tr.mapping, tr.doc);
            const meta = tr.getMeta(grammarKey) as GrammarDecoration[] | undefined;
            if (meta) {
              decorations = DecorationSet.create(
                tr.doc,
                meta.map((item) =>
                  Decoration.inline(item.from, item.to, {
                    class: "studio-grammar__underline",
                    "data-grammar-id": item.id,
                  }),
                ),
              );
            }
            return decorations;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

function buildPlainText(editor: TiptapEditor): DraftState {
  const doc = editor.state.doc;
  let text = "";
  const map: number[] = [];

  function traverse(node: ProseMirrorNode, pos: number) {
    if (node.isText) {
      const value = node.text ?? "";
      for (let i = 0; i < value.length; i += 1) {
        map.push(pos + i + 1);
      }
      text += value;
      return;
    }
    if (node.type.name === "hardBreak") {
      text += "\n";
      map.push(pos + 1);
      return;
    }
    let startLength = text.length;
    node.forEach((child, offset) => {
      traverse(child, pos + offset + 1);
    });
    if (node.isBlock && text.length > startLength) {
      text += "\n";
      map.push(pos + node.nodeSize);
    }
  }

  traverse(doc, -1);
  const json = JSON.stringify(editor.getJSON());
  return {
    json,
    plain: text.trimEnd(),
    offsetMap: map,
  };
}

function collectMentions(editor: TiptapEditor): Array<{ entityId: string; start: number | null; end: number | null }> {
  const mentions: Array<{ entityId: string; start: number | null; end: number | null }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name.endsWith("Mention") && node.attrs.entityId) {
      mentions.push({
        entityId: node.attrs.entityId as string,
        start: pos,
        end: pos + node.nodeSize,
      });
    }
    return true;
  });
  return mentions;
}

function mapGrammarMatches(
  matches: GrammarSuggestion[],
  offsetMap: number[],
): GrammarSuggestionWithRange[] {
  const result: GrammarSuggestionWithRange[] = [];
  for (const match of matches) {
    const start = offsetMap[match.offset];
    const end = offsetMap[match.offset + match.length - 1];
    if (start === undefined || end === undefined) {
      continue;
    }
    result.push({
      ...match,
      from: start,
      to: end + 1,
    });
  }
  return result;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export const StudioEditor: React.FC<StudioEditorProps> = ({
  story,
  chapter,
  onChapterRenamed,
  onStoryRenamed,
  onRequestChapterCreate,
}) => {
  const queryClient = useQueryClient();
  const entities = useJmhStore((state) => state.entities);
  const autosaveInterval = useStudioStore((state) => state.autosaveIntervalMs);
  const snapshotsOpen = useStudioStore((state) => state.snapshotsOpen);
  const setSnapshotsOpen = useStudioStore((state) => state.setSnapshotsOpen);
  const grammarEnabled = useStudioStore((state) => state.grammarEnabled);
  const grammarMode = useStudioStore((state) => state.grammarMode);
  const lastAutosaveAt = useStudioStore((state) => state.lastAutosaveAt);
  const setLastAutosave = useStudioStore((state) => state.setLastAutosave);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportFormat, setExportFormat] = useState<StoryExportFormat>("markdown");
  const [exportScope, setExportScope] = useState<"chapter" | "story">("chapter");
  const [exporting, setExporting] = useState(false);
  const [grammarMatches, setGrammarMatches] = useState<GrammarSuggestionWithRange[]>([]);
  const [grammarError, setGrammarError] = useState<string | null>(null);
  const [grammarLoading, setGrammarLoading] = useState(false);
  const [hoveredMention, setHoveredMention] = useState<{ entity: EntityRecord; rect: DOMRect } | null>(null);
  const [hoveredGrammar, setHoveredGrammar] = useState<{ suggestion: GrammarSuggestionWithRange; rect: DOMRect } | null>(
    null,
  );
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [templateQuery, setTemplateQuery] = useState("");

  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    if (!query) {
      return studioTemplates;
    }
    return studioTemplates.filter((template) => {
      const haystack = `${template.title} ${template.description}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [templateQuery]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Draft your next chapter — try @perk, #item, or &companion to link the roster",
      }),
      ...createEntityMentionExtensions({ getEntities: () => entities }),
      GrammarHighlightExtension,
    ],
    content: "<p>Start crafting your next chronicle…</p>",
    onUpdate: ({ editor: instance }) => {
      const payload = buildPlainText(instance);
      setDraft(payload);
      setDirty(true);
    },
  });

  const chapterId = chapter?.id;

  const formatterSettingsQuery = useQuery({
    queryKey: ["app-settings", "formatter"],
    queryFn: loadFormatterSettings,
  });

  const spellcheckEnabled = formatterSettingsQuery.data?.spellcheckEnabled ?? true;

  const chapterTextQuery = useQuery({
    queryKey: ["chapterText", chapterId],
    queryFn: async () => (chapterId ? await getChapterText(chapterId) : null),
    enabled: Boolean(chapterId),
  });

  const snapshotsQuery = useQuery({
    queryKey: ["chapterSnapshots", chapterId],
    queryFn: () => (chapterId ? listChapterSnapshots(chapterId) : Promise.resolve([] as ChapterSnapshotRecord[])),
    enabled: Boolean(chapterId) && snapshotsOpen,
  });

  const debouncedGrammarRef = useRef<(value: string) => void | undefined>(undefined);

  useEffect(() => {
    debouncedGrammarRef.current = createGrammarDebouncer(1200, (value: string) => {
      void (async () => {
        if (!chapterId || !grammarEnabled) return;
        if (!draft) return;
        try {
          setGrammarLoading(true);
          const result = await checkGrammar(value, {
            language: "en-US",
            mode: grammarMode,
          });
          const mapped = mapGrammarMatches(result.matches, draft.offsetMap);
          setGrammarMatches(mapped);
          setGrammarError(null);
          if (editor) {
            const decorations: GrammarDecoration[] = mapped.map((item) => ({
              id: item.id,
              from: item.from,
              to: item.to,
            }));
            const tr = editor.state.tr.setMeta(grammarKey, decorations);
            editor.view.dispatch(tr);
          }
        } catch (error) {
          console.error("Grammar check failed", error);
          setGrammarError("Grammar service unavailable");
        } finally {
          setGrammarLoading(false);
        }
      })();
    });
  }, [chapterId, draft, grammarEnabled, grammarMode, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const dom = editor.view.dom as HTMLElement;
    dom.setAttribute("spellcheck", spellcheckEnabled ? "true" : "false");
  }, [editor, spellcheckEnabled]);

  useEffect(() => {
    if (!grammarEnabled || !draft) {
      setGrammarMatches([]);
      if (editor) {
        const tr = editor.state.tr.setMeta(grammarKey, []);
        editor.view.dispatch(tr);
      }
      return;
    }
    debouncedGrammarRef.current?.(draft.plain);
  }, [draft?.plain, grammarEnabled, grammarMode, editor]);

  useEffect(() => {
    if (!editor) return;
    const data = chapterTextQuery.data;
    if (chapter && data?.json) {
      try {
        editor.commands.setContent(JSON.parse(data.json), false);
        const payload = buildPlainText(editor);
        setDraft(payload);
        setDirty(false);
      } catch (error) {
        console.error("Failed to parse chapter content", error);
        editor.commands.setContent("<p>Start crafting your next chronicle…</p>", false);
      }
    } else if (chapter) {
      editor.commands.setContent(`<h2>${chapter.title}</h2><p>Begin your narrative…</p>`, false);
      const payload = buildPlainText(editor);
      setDraft(payload);
      setDirty(false);
    }
  }, [editor, chapterId, chapterTextQuery.data, chapter]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onMentionEnter = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.dataset.entityId) return;
      const entity = entities.find((item) => item.id === target.dataset.entityId);
      if (!entity) return;
      const rect = target.getBoundingClientRect();
      setHoveredMention({ entity, rect });
    };
    const onMentionLeave = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.dataset.entityId) {
        setHoveredMention(null);
      }
    };
    const onGrammarEnter = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const grammarId = target?.dataset.grammarId;
      if (!grammarId) return;
      const suggestion = grammarMatches.find((item) => item.id === grammarId);
      if (!suggestion) return;
      const rect = target.getBoundingClientRect();
      setHoveredGrammar({ suggestion, rect });
    };
    const onGrammarLeave = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.dataset.grammarId) {
        setHoveredGrammar(null);
      }
    };
    dom.addEventListener("pointerenter", onMentionEnter, true);
    dom.addEventListener("pointerleave", onMentionLeave, true);
    dom.addEventListener("pointerenter", onGrammarEnter, true);
    dom.addEventListener("pointerleave", onGrammarLeave, true);
    return () => {
      dom.removeEventListener("pointerenter", onMentionEnter, true);
      dom.removeEventListener("pointerleave", onMentionLeave, true);
      dom.removeEventListener("pointerenter", onGrammarEnter, true);
      dom.removeEventListener("pointerleave", onGrammarLeave, true);
    };
  }, [editor, entities, grammarMatches]);

  useEffect(() => {
    if (!dirty || !chapterId || !draft) return;
    const timer = window.setTimeout(() => {
      void saveChapter(false);
    }, autosaveInterval);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, autosaveInterval, chapterId, draft?.json]);

  const saveChapter = async (snapshot: boolean) => {
    if (!chapter || !draft) return;
    setSaving(true);
    try {
      await saveChapterText({
        chapter_id: chapter.id,
        json: draft.json,
        plain: draft.plain,
      });
      const mentions = editor ? collectMentions(editor) : [];
      await syncChapterMetadata(chapter, mentions, draft.plain);
      if (snapshot) {
        await recordChapterSnapshot(chapter.id, draft.json);
        await snapshotsQuery.refetch();
      }
      setDirty(false);
      setLastAutosave(new Date().toISOString());
      await queryClient.invalidateQueries({ queryKey: ["stories"] });
    } catch (error) {
      console.error("Failed to save chapter", error);
    } finally {
      setSaving(false);
    }
  };

  const handleInsertTemplate = (template: StudioTemplate) => {
    if (!editor) return;
    insertTemplateContent(editor, template);
  };

  const handleExport = async () => {
    if (!story) return;
    setExporting(true);
    try {
      const payload =
        exportScope === "chapter" && chapter
          ? await exportChapter(story, chapter, exportFormat)
          : await exportStory(story, exportFormat);
      const blob = new Blob([payload.content], { type: `${payload.mime};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = payload.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
    } finally {
      setExporting(false);
    }
  };

  const applyReplacement = (suggestion: GrammarSuggestionWithRange, replacement: string) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContentAt({ from: suggestion.from, to: suggestion.to }, replacement)
      .run();
    setHoveredGrammar(null);
  };

  const handleRenameChapter = async () => {
    if (!chapter) return;
    const next = window.prompt("Rename chapter", chapter.title);
    if (!next || !next.trim() || next.trim() === chapter.title) {
      return;
    }
    await onChapterRenamed(chapter.id, next.trim());
  };

  const handleRenameStory = async () => {
    if (!story) return;
    const next = window.prompt("Rename story", story.title);
    if (!next || !next.trim() || next.trim() === story.title) {
      return;
    }
    await onStoryRenamed(story.id, next.trim());
  };

  const handleReorder = async (direction: "prev" | "next") => {
    if (!story || !chapter) return;
    const chapters = [...story.chapters];
    const index = chapters.findIndex((item) => item.id === chapter.id);
    if (index < 0) return;
    const targetIndex = direction === "prev" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;
    const [removed] = chapters.splice(index, 1);
    chapters.splice(targetIndex, 0, removed);
    await reorderChapters(
      story.id,
      chapters.map((item) => item.id),
    );
    await queryClient.invalidateQueries({ queryKey: ["stories"] });
  };

  if (!story) {
    return (
      <div className="studio-empty-state">
        <div>
          <h2>Create your first story</h2>
          <p>Stories bundle chapters and feed summaries into the Jump Memory Hub.</p>
          <button type="button" onClick={() => void onRequestChapterCreate(null)}>Create Story</button>
        </div>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="studio-empty-state">
        <div>
          <h2>No chapter selected</h2>
          <p>Begin with a prologue chapter to unlock autosave, snapshots, and exports.</p>
          <button type="button" onClick={() => void onRequestChapterCreate(story.id)}>Add Chapter</button>
        </div>
      </div>
    );
  }

  return (
  <div className="studio-shell__editor-container">
      <header className="studio-shell__editor-header">
        <div className="studio-shell__editor-meta">
          <h2>{chapter.title}</h2>
          <span className="studio-shell__summary">
            {story.title} • Autosave every {Math.round(autosaveInterval / 1000)}s • Last autosave: {formatTimestamp(lastAutosaveAt)}
          </span>
        </div>
        <div className="studio-shell__editor-actions">
          <button type="button" onClick={handleRenameStory}>Rename Story</button>
          <button type="button" onClick={handleRenameChapter}>Rename Chapter</button>
          <button type="button" onClick={() => handleReorder("prev")}>◀</button>
          <button type="button" onClick={() => handleReorder("next")}>▶</button>
          <button type="button" onClick={() => setTemplatesOpen(!templatesOpen)} aria-pressed={templatesOpen}>
            {templatesOpen ? "Hide Templates" : "Show Templates"}
          </button>
          <label className="studio-export-menu">
            Scope
            <select value={exportScope} onChange={(event) => setExportScope(event.target.value as "chapter" | "story")}>
              <option value="chapter">This Chapter</option>
              <option value="story">Full Story</option>
            </select>
          </label>
          <label className="studio-export-menu">
            Format
            <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as StoryExportFormat)}>
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
              <option value="bbcode">BBCode</option>
            </select>
          </label>
          <button type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Export"}
          </button>
          <button type="button" onClick={() => setSnapshotsOpen(!snapshotsOpen)}>
            {snapshotsOpen ? "Hide Snapshots" : "Show Snapshots"}
          </button>
          <button type="button" onClick={() => saveChapter(true)} disabled={saving || !dirty}>
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </header>

      <section className="studio-shell__content">
        {templatesOpen && (
          <aside className="studio-templates" aria-label="Templates sidebar">
            <div className="studio-templates__header">
              <h3>Templates</h3>
              <input
                type="search"
                className="studio-templates__search"
                placeholder="Search templates"
                value={templateQuery}
                onChange={(event) => setTemplateQuery(event.target.value)}
                aria-label="Search templates"
              />
            </div>
            <div className="studio-templates__body">
              {filteredTemplates.length === 0 ? (
                <p className="studio-templates__empty">No templates match that search.</p>
              ) : (
                <ul className="studio-templates__list">
                  {filteredTemplates.map((template) => (
                    <li key={template.id} className="studio-templates__item">
                      <button
                        type="button"
                        className="studio-templates__button"
                        onClick={() => handleInsertTemplate(template)}
                      >
                        <span className="studio-templates__title">{template.title}</span>
                        <span className="studio-templates__description">{template.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
        <div className="studio-editor__content" data-grammar-state={grammarLoading ? "checking" : "idle"}>
          <EditorContent editor={editor} />
        </div>
        {hoveredMention && (
          <div
            className="notes-editor__hover-card"
            style={{
              top: hoveredMention.rect.bottom + 8,
              left: hoveredMention.rect.left,
            }}
          >
            <strong>{hoveredMention.entity.name}</strong>
            <span className="notes-editor__hover-type">{hoveredMention.entity.type}</span>
            {hoveredMention.entity.meta_json && <p>{hoveredMention.entity.meta_json}</p>}
          </div>
        )}
        {hoveredGrammar && (
          <div
            className="studio-grammar__popover"
            style={{
              top: hoveredGrammar.rect.bottom + 8,
              left: hoveredGrammar.rect.left,
            }}
          >
            <h3>{hoveredGrammar.suggestion.message}</h3>
            <p>{hoveredGrammar.suggestion.shortMessage || hoveredGrammar.suggestion.rule.description}</p>
            <div className="studio-settings__controls">
              {hoveredGrammar.suggestion.replacements.slice(0, 4).map((replacement) => (
                <button
                  type="button"
                  key={replacement.value}
                  onClick={() => applyReplacement(hoveredGrammar.suggestion, replacement.value)}
                >
                  {replacement.value}
                </button>
              ))}
              <button type="button" onClick={() => applyReplacement(hoveredGrammar.suggestion, "")}>Ignore</button>
            </div>
          </div>
        )}
      </section>

      {grammarError && <p className="studio-shell__summary">{grammarError}</p>}

      {snapshotsOpen && snapshotsQuery.data && (
        <aside className="studio-snapshot-list">
          <h3>Snapshots</h3>
          {snapshotsQuery.data.length === 0 && <span>No snapshots yet.</span>}
          {snapshotsQuery.data.map((snapshot, index) => (
            <button
              type="button"
              key={snapshot.id}
              onClick={async () => {
                if (!editor) return;
                const restore = await confirmDialog({
                  message: `Restore snapshot #${index + 1}? Unsaved changes will be lost.`,
                  title: "Restore snapshot",
                  kind: "warning",
                  okLabel: "Restore",
                  cancelLabel: "Cancel",
                });
                if (!restore) return;
                try {
                  editor.commands.setContent(JSON.parse(snapshot.json), false);
                  const payload = buildPlainText(editor);
                  setDraft(payload);
                  setDirty(true);
                } catch (error) {
                  console.error("Failed to restore snapshot", error);
                }
              }}
            >
              {new Date(snapshot.created_at).toLocaleString()}
            </button>
          ))}
        </aside>
      )}
    </div>
  );
};

export default StudioEditor;
