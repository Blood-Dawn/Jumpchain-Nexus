/*
MIT License

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

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Decoration, DecorationSet } from "prosemirror-view";
import { Plugin, PluginKey } from "prosemirror-state";
import type {
  ChapterRecord,
  ChapterSnapshotRecord,
  StoryWithChapters,
  EntityRecord,
  ChapterTextRecord,
} from "../../db/dao";
import {
  getChapterText,
  listChapterSnapshots,
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
import {
  computeDraftState,
  extractPlainTextFromJson,
  restoreSnapshotContent,
  type DraftState,
} from "./snapshotUtils";

interface StudioEditorProps {
  story: StoryWithChapters | null;
  chapter: ChapterRecord | null;
  onChapterRenamed: (chapterId: string, title: string) => Promise<void>;
  onStoryRenamed: (storyId: string, title: string) => Promise<void>;
  onRequestChapterCreate: (storyId: string | null) => Promise<void>;
}

interface GrammarDecoration {
  id: string;
  from: number;
  to: number;
}

type GrammarDecorationMeta =
  | { type: "set"; decorations: GrammarDecoration[] }
  | { type: "remove"; id: string }
  | { type: "clear" };

export interface GrammarSuggestionWithRange extends GrammarSuggestion {
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
            const meta = tr.getMeta(grammarKey) as GrammarDecorationMeta | undefined;
            if (meta) {
              if (meta.type === "set") {
                decorations = DecorationSet.create(
                  tr.doc,
                  meta.decorations.map((item) =>
                    Decoration.inline(item.from, item.to, {
                      class: "studio-grammar__underline",
                      "data-grammar-id": item.id,
                    }),
                  ),
                );
              } else if (meta.type === "remove") {
                const toRemove = decorations.find(
                  undefined,
                  undefined,
                  (spec) => spec.spec["data-grammar-id"] === meta.id,
                );
                decorations = decorations.remove(toRemove);
              } else if (meta.type === "clear") {
                decorations = DecorationSet.empty;
              }
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

const SNAPSHOT_CURRENT_DRAFT = "current-draft";
const SNAPSHOT_PREVIOUS_DRAFT = "previous-draft";
const SNAPSHOT_LAST_SAVE = "current-save";

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
  const grammarEnabled = useStudioStore((state) => state.grammarEnabled);
  const grammarMode = useStudioStore((state) => state.grammarMode);
  const setGrammarEnabled = useStudioStore((state) => state.setGrammarEnabled);
  const lastAutosaveAt = useStudioStore((state) => state.lastAutosaveAt);
  const setLastAutosave = useStudioStore((state) => state.setLastAutosave);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [draftBackup, setDraftBackup] = useState<DraftState | null>(null);
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
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>(SNAPSHOT_CURRENT_DRAFT);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewLabel, setPreviewLabel] = useState<string>("Current Draft");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

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
      const payload = computeDraftState(instance);
      setDraft(payload);
      setDraftBackup(null);
      setDirty(true);
    },
  });

  const chapterId = chapter?.id;

  const formatterSettingsQuery = useFormatterPreferences();

  const spellcheckEnabled = formatterSettingsQuery.data?.spellcheckEnabled ?? true;

  const chapterTextQuery = useQuery({
    queryKey: ["chapterText", chapterId],
    queryFn: async () => (chapterId ? await getChapterText(chapterId) : null),
    enabled: Boolean(chapterId),
  });

  const snapshotsQuery = useQuery({
    queryKey: ["chapterSnapshots", chapterId],
    queryFn: () => (chapterId ? listChapterSnapshots(chapterId) : Promise.resolve([] as ChapterSnapshotRecord[])),
    enabled: Boolean(chapterId),
  });
  const snapshots = snapshotsQuery.data ?? [];
  const canRestoreSnapshot =
    selectedSnapshotId !== SNAPSHOT_CURRENT_DRAFT &&
    !(selectedSnapshotId === SNAPSHOT_PREVIOUS_DRAFT && !draftBackup) &&
    !previewLoading;

  const debouncedGrammarRef = useRef<(value: string) => void | undefined>(undefined);

  useEffect(() => {
    if (selectedSnapshotId === SNAPSHOT_PREVIOUS_DRAFT && !draftBackup) {
      setSelectedSnapshotId(SNAPSHOT_CURRENT_DRAFT);
    }
  }, [draftBackup, selectedSnapshotId]);

  useEffect(() => {
    setSelectedSnapshotId(SNAPSHOT_CURRENT_DRAFT);
    setPreviewLabel("Current Draft");
    setPreviewError(null);
  }, [chapterId]);

  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    const updatePreview = async () => {
      setPreviewError(null);
      if (selectedSnapshotId === SNAPSHOT_CURRENT_DRAFT) {
        setPreviewLoading(false);
        setPreviewLabel("Current Draft");
        setPreviewContent(draft?.plain ?? "");
        return;
      }
      if (selectedSnapshotId === SNAPSHOT_PREVIOUS_DRAFT) {
        setPreviewLoading(false);
        setPreviewLabel("Previous Draft (unsaved)");
        setPreviewContent(draftBackup?.plain ?? "");
        return;
      }
      setPreviewLoading(true);
      try {
        if (selectedSnapshotId === SNAPSHOT_LAST_SAVE) {
          const data = chapterId ? chapterTextQuery.data ?? (await getChapterText(chapterId)) : null;
          if (cancelled) return;
          const plain = data?.json ? extractPlainTextFromJson(editor, data.json) : "";
          setPreviewLabel("Last Saved Chapter");
          setPreviewContent(plain);
        } else {
          const snapshot = snapshots.find((item) => item.id === selectedSnapshotId);
          if (!snapshot) {
            setPreviewError("Snapshot unavailable");
            setPreviewContent("");
            return;
          }
          const plain = extractPlainTextFromJson(editor, snapshot.json);
          setPreviewLabel(`Snapshot from ${new Date(snapshot.created_at).toLocaleString()}`);
          setPreviewContent(plain);
        }
      } catch (error) {
        console.error("Failed to preview snapshot", error);
        if (!cancelled) {
          setPreviewError("Unable to render snapshot preview");
          setPreviewContent("");
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    };
    void updatePreview();
    return () => {
      cancelled = true;
    };
  }, [chapterId, chapterTextQuery.data, draft?.plain, draftBackup, editor, selectedSnapshotId, snapshots]);

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
            const tr = editor.state.tr.setMeta(grammarKey, { type: "set", decorations });
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
        const tr = editor.state.tr.setMeta(grammarKey, { type: "clear" });
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
        const payload = computeDraftState(editor);
        setDraft(payload);
        setDirty(false);
        setDraftBackup(null);
      } catch (error) {
        console.error("Failed to parse chapter content", error);
        editor.commands.setContent("<p>Start crafting your next chronicle…</p>", false);
      }
    } else if (chapter) {
      editor.commands.setContent(`<h2>${chapter.title}</h2><p>Begin your narrative…</p>`, false);
      const payload = computeDraftState(editor);
      setDraft(payload);
      setDirty(false);
      setDraftBackup(null);
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
    setHoveredGrammar((current) => {
      if (!current) return current;
      const updated = grammarMatches.find((item) => item.id === current.suggestion.id);
      if (!updated) return null;
      return { suggestion: updated, rect: current.rect };
    });
  }, [grammarMatches]);

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
      const savedText: ChapterTextRecord = await saveChapterText({
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
      setDraftBackup(null);
      setLastAutosave(new Date().toISOString());
      queryClient.setQueryData(["chapterText", chapter.id], savedText);
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

  const clearGrammarSuggestion = useCallback(
    (id: string) => {
      setGrammarMatches((previous) => previous.filter((item) => item.id !== id));
      setHoveredGrammar((current) => {
        if (!current || current.suggestion.id !== id) return current;
        return null;
      });
      if (editor) {
        const tr = editor.state.tr.setMeta(grammarKey, { type: "remove", id });
        editor.view.dispatch(tr);
      }
    },
    [editor],
  );

  const applyReplacement = useCallback(
    (suggestion: GrammarSuggestionWithRange, replacement: string) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContentAt({ from: suggestion.from, to: suggestion.to }, replacement)
        .run();
      clearGrammarSuggestion(suggestion.id);
    },
    [clearGrammarSuggestion, editor],
  );

  const handleAcceptGrammar = useCallback(
    (suggestion: GrammarSuggestionWithRange, replacement?: string) => {
      const value = replacement ?? suggestion.replacements[0]?.value;
      if (value === undefined) {
        clearGrammarSuggestion(suggestion.id);
        return;
      }
      applyReplacement(suggestion, value);
    },
    [applyReplacement, clearGrammarSuggestion],
  );

  const handleDismissGrammar = useCallback(
    (suggestion: GrammarSuggestionWithRange) => {
      clearGrammarSuggestion(suggestion.id);
    },
    [clearGrammarSuggestion],
  );

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

  const handleSnapshotSelectionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedSnapshotId(event.target.value);
    setPreviewError(null);
  };

  const handleRestoreSelectedSnapshot = async () => {
    if (!editor || !chapterId) return;
    if (selectedSnapshotId === SNAPSHOT_CURRENT_DRAFT) return;

    if (selectedSnapshotId === SNAPSHOT_PREVIOUS_DRAFT) {
      if (!draftBackup) {
        setPreviewError("No previous draft available");
        return;
      }
      const confirm = await confirmDialog({
        title: "Restore previous draft",
        message: "Revert to the unsaved draft captured before your last snapshot restore?",
        kind: "warning",
        okLabel: "Restore",
        cancelLabel: "Cancel",
      });
      if (!confirm) return;
      try {
        const { nextDraft } = restoreSnapshotContent(editor, draftBackup.json, draft, false);
        setDraft(nextDraft);
        setDirty(true);
        setDraftBackup(null);
        setSelectedSnapshotId(SNAPSHOT_CURRENT_DRAFT);
        setPreviewContent(nextDraft.plain);
        setPreviewLabel("Current Draft");
        setPreviewError(null);
      } catch (error) {
        console.error("Failed to restore previous draft", error);
        setPreviewError("Failed to restore previous draft");
      }
      return;
    }

    let sourceJson: string | null = null;
    let description = "the selected snapshot";

    if (selectedSnapshotId === SNAPSHOT_LAST_SAVE) {
      const data = chapterId ? chapterTextQuery.data ?? (await getChapterText(chapterId)) : null;
      sourceJson = data?.json ?? null;
      description = "the last saved version";
    } else {
      const snapshot = snapshots.find((item) => item.id === selectedSnapshotId);
      if (!snapshot) {
        setPreviewError("Snapshot unavailable");
        return;
      }
      sourceJson = snapshot.json;
      description = `snapshot from ${new Date(snapshot.created_at).toLocaleString()}`;
    }

    if (!sourceJson) {
      setPreviewError("Snapshot data unavailable");
      return;
    }

    const confirm = await confirmDialog({
      title: "Restore snapshot",
      message: `Restore ${description}? Your current draft will move to Previous Draft for safekeeping.`,
      kind: "warning",
      okLabel: "Restore",
      cancelLabel: "Cancel",
    });
    if (!confirm) return;

    try {
      const { nextDraft, backup } = restoreSnapshotContent(editor, sourceJson, draft, dirty);
      setDraft(nextDraft);
      setDirty(true);
      if (backup) {
        setDraftBackup(backup);
      }
      setSelectedSnapshotId(SNAPSHOT_CURRENT_DRAFT);
      setPreviewContent(nextDraft.plain);
      setPreviewLabel("Current Draft");
      setPreviewError(null);
    } catch (error) {
      console.error("Failed to restore snapshot", error);
      setPreviewError("Failed to restore snapshot");
    }
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

  const shellContentRect = shellContentRef.current?.getBoundingClientRect();
  const hoveredMentionStyle = hoveredMention
    ? {
        top: hoveredMention.rect.bottom + 8 - (shellContentRect?.top ?? 0),
        left: hoveredMention.rect.left - (shellContentRect?.left ?? 0),
      }
    : null;
  const hoveredGrammarStyle = hoveredGrammar
    ? {
        top: hoveredGrammar.rect.bottom + 8 - (shellContentRect?.top ?? 0),
        left: hoveredGrammar.rect.left - (shellContentRect?.left ?? 0),
      }
    : null;

  return (
    <div className="studio-shell__editor-container">
      <header className="studio-shell__editor-header">
        <div className="studio-shell__editor-meta">
          <h2>{chapter.title}</h2>
          <span className="studio-shell__summary">
            {story.title} • Autosave every {Math.round(autosaveInterval / 1000)}s
          </span>
        </div>
        <div className="studio-shell__editor-actions">
          <span className="studio-shell__autosave">Last autosave: {formatTimestamp(lastAutosaveAt)}</span>
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
          <label className="studio-snapshot-select">
            Snapshots
            <select value={selectedSnapshotId} onChange={handleSnapshotSelectionChange}>
              <option value={SNAPSHOT_CURRENT_DRAFT}>Current Draft</option>
              {draftBackup && <option value={SNAPSHOT_PREVIOUS_DRAFT}>Previous Draft (unsaved)</option>}
              <option value={SNAPSHOT_LAST_SAVE}>Last Save</option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {new Date(snapshot.created_at).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleRestoreSelectedSnapshot} disabled={!canRestoreSnapshot}>
            Restore Selection
          </button>
          <button type="button" onClick={() => saveChapter(true)} disabled={saving || !dirty}>
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </header>

      <section className="studio-shell__content" ref={shellContentRef}>
        <div className="studio-editor__content" data-grammar-state={grammarLoading ? "checking" : "idle"}>
          <EditorContent editor={editor} />
        </div>
        <GrammarMatchesSidebar
          enabled={grammarEnabled}
          loading={grammarLoading}
          matches={grammarMatches}
          onAccept={handleAcceptGrammar}
          onDismiss={handleDismissGrammar}
          onToggle={() => setGrammarEnabled(!grammarEnabled)}
        />
        {hoveredMention && hoveredMentionStyle && (
          <div className="notes-editor__hover-card" style={hoveredMentionStyle}>
            <strong>{hoveredMention.entity.name}</strong>
            <span className="notes-editor__hover-type">{hoveredMention.entity.type}</span>
            {hoveredMention.entity.meta_json && <p>{hoveredMention.entity.meta_json}</p>}
          </div>
        )}
        {hoveredGrammar && hoveredGrammarStyle && (
          <div className="studio-grammar__popover" style={hoveredGrammarStyle}>
            <h3>{hoveredGrammar.suggestion.message}</h3>
            <p>{hoveredGrammar.suggestion.shortMessage || hoveredGrammar.suggestion.rule.description}</p>
            <div className="studio-settings__controls">
              {hoveredGrammar.suggestion.replacements.slice(0, 4).map((replacement) => (
                <button
                  type="button"
                  key={replacement.value}
                  onClick={() => handleAcceptGrammar(hoveredGrammar.suggestion, replacement.value)}
                >
                  {replacement.value}
                </button>
              ))}
              <button type="button" onClick={() => handleDismissGrammar(hoveredGrammar.suggestion)}>Ignore</button>
            </div>
          </div>
        )}
      </section>

      {grammarError && <p className="studio-shell__summary">{grammarError}</p>}

      <section className="studio-snapshot-panel" aria-live="polite">
        <div className="studio-snapshot-panel__header">
          <h3>Snapshot Preview</h3>
          <span className="studio-snapshot-panel__label">{previewLabel}</span>
        </div>
        <div className="studio-snapshot-panel__preview">
          {previewLoading ? (
            <p>Loading snapshot preview…</p>
          ) : previewError ? (
            <p className="studio-snapshot-panel__error">{previewError}</p>
          ) : (
            <pre>{previewContent || "This snapshot is empty."}</pre>
          )}
        </div>
        {draftBackup && (
          <p className="studio-snapshot-panel__note">Your previous draft is stored as "Previous Draft (unsaved)" in the dropdown.</p>
        )}
      </section>

    </div>
  );
};

export default StudioEditor;
