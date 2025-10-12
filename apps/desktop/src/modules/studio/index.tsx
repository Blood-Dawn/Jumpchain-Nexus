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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import "./Studio.css";
import {
  createChapter,
  createStory,
  deleteChapter,
  listStories,
  reorderChapters,
  saveChapterText,
  updateChapter,
  updateStory,
} from "../../db/dao";
import type { ChapterRecord, StoryWithChapters } from "../../db/dao";
import { useStudioStore } from "./store";
import ChapterListTop from "./ChapterListTop";
import ChapterListSide from "./ChapterListSide";
import StudioSettings from "./StudioSettings";
import StudioEditor from "./Editor";
import { loadSnapshot } from "../jmh/data";
import { NotesEditor } from "../jmh/NotesEditor";
import { useJmhStore } from "../jmh/store";
import {
  collectStoryChapterDraftsFromPaths,
  type StoryChapterImportError,
} from "../../services/storyStudioImporter";
import { getPlatform } from "../../services/platform";

const StoryComposerShell: React.FC = () => {
  const queryClient = useQueryClient();
  const setStories = useStudioStore((state) => state.setStories);
  const stories = useStudioStore((state) => state.stories);
  const layout = useStudioStore((state) => state.layout);
  const focusMode = useStudioStore((state) => state.focusMode);
  const selectedStoryId = useStudioStore((state) => state.selectedStoryId);
  const selectStory = useStudioStore((state) => state.selectStory);
  const selectedChapterId = useStudioStore((state) => state.selectedChapterId);
  const selectChapter = useStudioStore((state) => state.selectChapter);
  const [dropActive, setDropActive] = useState(false);
  const [dropFeedback, setDropFeedback] = useState<string | null>(null);
  const [dropIssues, setDropIssues] = useState<StoryChapterImportError[] | null>(null);
  const dropContainerRef = useRef<HTMLElement | null>(null);

  const storiesQuery = useQuery<StoryWithChapters[], Error>({
    queryKey: ["stories"],
    queryFn: listStories,
  });

  useEffect(() => {
    if (storiesQuery.data) {
      setStories(storiesQuery.data);
    }
  }, [storiesQuery.data, setStories]);

  const isInitialLoading = storiesQuery.isLoading && !stories.length;
  const rawError = storiesQuery.error as unknown;
  const errorMessage =
    rawError instanceof Error
      ? rawError.message
      : typeof rawError === "string"
        ? rawError
        : "Unknown error";

  const currentStory = useMemo(() => {
    if (!stories.length) {
      return null;
    }
    if (selectedStoryId) {
      const story = stories.find((item) => item.id === selectedStoryId);
      if (story) {
        return story;
      }
    }
    return stories[0];
  }, [stories, selectedStoryId]);

  const currentChapter = useMemo(() => {
    if (!currentStory) {
      return null;
    }
    if (selectedChapterId) {
      const chapter = currentStory.chapters.find((item) => item.id === selectedChapterId);
      if (chapter) {
        return chapter;
      }
    }
    return currentStory.chapters[0] ?? null;
  }, [currentStory, selectedChapterId]);

  const handleSelectChapter = (id: string) => {
    selectChapter(id);
  };

  const patchStories = (mutator: (list: typeof stories) => typeof stories) => {
    const state = useStudioStore.getState();
    state.setStories(mutator(state.stories));
  };

  const refreshStories = async () => {
    await queryClient.invalidateQueries({ queryKey: ["stories"] });
  };

  const handleDroppedChapters = useCallback(
    async (paths: string[]) => {
      if (!paths.length) {
        return;
      }
      if (!currentStory) {
        setDropFeedback("Create a story before importing chapters.");
        return;
      }

      try {
        setDropFeedback(null);
        setDropIssues(null);
        const selection = await collectStoryChapterDraftsFromPaths(paths);
        const combinedErrors: StoryChapterImportError[] = [...selection.errors];
        const createdChapters: ChapterRecord[] = [];

        for (const draft of selection.drafts) {
          try {
            const chapter = await createChapter({
              story_id: currentStory.id,
              title: draft.title,
              synopsis: draft.synopsis ?? undefined,
            });
            await saveChapterText({ chapter_id: chapter.id, json: draft.json, plain: draft.plain });
            createdChapters.push(chapter);
          } catch (error) {
            combinedErrors.push({
              path: draft.path,
              reason: error instanceof Error ? error.message : "Failed to import chapter",
            });
          }
        }

        if (createdChapters.length > 0) {
          patchStories((list) =>
            list.map((story) =>
              story.id === currentStory.id
                ? { ...story, chapters: [...story.chapters, ...createdChapters] }
                : story,
            ),
          );
          await refreshStories();
          selectStory(currentStory.id);
          const lastChapter = createdChapters[createdChapters.length - 1] ?? null;
          if (lastChapter) {
            selectChapter(lastChapter.id);
          }
          setDropFeedback(
            `Imported ${createdChapters.length} chapter${createdChapters.length === 1 ? "" : "s"}`,
          );
        } else if (combinedErrors.length === 0) {
          setDropFeedback("No supported files found.");
        }

        if (combinedErrors.length > 0) {
          console.warn("Story Studio drop issues", combinedErrors);
          setDropIssues(combinedErrors);
        } else {
          setDropIssues(null);
        }
      } catch (error) {
        console.error("Story Studio drop import failed", error);
        setDropFeedback(error instanceof Error ? error.message : "Failed to import dropped files");
      }
    },
    [currentStory, patchStories, refreshStories, selectChapter, selectStory]
  );

  useEffect(() => {
    const element = dropContainerRef.current;
    if (!element) {
      return undefined;
    }

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      try {
        const platform = await getPlatform();
        if (disposed) {
          return;
        }
        cleanup = platform.drop.registerDropTarget(element, {
          onHover: () => setDropActive(true),
          onLeave: () => setDropActive(false),
          onDrop: (paths) => {
            setDropActive(false);
            void handleDroppedChapters(paths);
          },
        });
      } catch (error) {
        console.error("Failed to register Story Studio drop target", error);
      }
    })();

    return () => {
      disposed = true;
      setDropActive(false);
      cleanup?.();
    };
  }, [handleDroppedChapters]);

  const handleCreateStory = async () => {
    const title = window.prompt("Story title", "Untitled Story");
    if (!title || !title.trim()) {
      return;
    }
    const record = await createStory({ title: title.trim() });
    await refreshStories();
    selectStory(record.id);
    selectChapter(null);
  };

  const handleCreateChapter = async (storyId: string) => {
    const title = window.prompt("Chapter title", "New Chapter");
    if (!title || !title.trim()) {
      return;
    }
    const chapter = await createChapter({ story_id: storyId, title: title.trim() });
    await refreshStories();
    selectStory(storyId);
    selectChapter(chapter.id);
  };

  const handleRenameStory = async (id: string, title: string) => {
    await updateStory(id, { title });
    patchStories((list) =>
      list.map((story) => (story.id === id ? { ...story, title } : story)),
    );
    await refreshStories();
  };

  const handleRenameChapter = async (id: string, title: string) => {
    await updateChapter(id, { title });
    patchStories((list) =>
      list.map((story) => ({
        ...story,
        chapters: story.chapters.map((chapter) => (chapter.id === id ? { ...chapter, title } : chapter)),
      })),
    );
    await refreshStories();
  };

  const handleDeleteChapter = async (chapterId: string) => {
    await deleteChapter(chapterId);
    patchStories((list) =>
      list.map((story) => ({
        ...story,
        chapters: story.chapters.filter((chapter) => chapter.id !== chapterId),
      })),
    );
    await refreshStories();
  };

  const handleMoveChapter = async (chapterId: string, direction: "left" | "right") => {
    const story = stories.find((item) => item.chapters.some((chapter) => chapter.id === chapterId));
    if (!story) return;
    const list = [...story.chapters];
    const index = list.findIndex((item) => item.id === chapterId);
    if (index < 0) return;
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const [entry] = list.splice(index, 1);
    list.splice(targetIndex, 0, entry);
    patchStories((existing) =>
      existing.map((storyItem) =>
        storyItem.id === story.id
          ? {
              ...storyItem,
              chapters: list,
            }
          : storyItem,
      ),
    );
    await reorderChapters(
      story.id,
      list.map((item) => item.id),
    );
    await refreshStories();
  };

  const handleChapterRenamed = async (chapterId: string, title: string) => {
    await handleRenameChapter(chapterId, title);
  };

  const handleStoryRenamed = async (storyId: string, title: string) => {
    await handleRenameStory(storyId, title);
  };

  const handleRequestChapterCreate = async (storyId: string | null) => {
    if (!storyId) {
      const storyTitle = window.prompt("Story title", "Untitled Story");
      if (!storyTitle || !storyTitle.trim()) {
        return;
      }
      const story = await createStory({ title: storyTitle.trim() });
      await refreshStories();
      selectStory(story.id);
      selectChapter(null);
      await handleCreateChapter(story.id);
      return;
    }
    await handleCreateChapter(storyId);
  };

  let shellContent: React.ReactNode = null;
  let showSettings = false;

  if (isInitialLoading) {
    shellContent = (
      <div className="studio-empty-state">
        <div>
          <h2>Loading Story Studio…</h2>
          <p>Bootstrapping stories, chapters, and grammar tools.</p>
        </div>
      </div>
    );
  } else if (storiesQuery.isError) {
    console.error("Story Studio failed to load", rawError);
    shellContent = (
      <div className="studio-empty-state">
        <div>
          <h2>Story Studio failed to load</h2>
          <p>{errorMessage}</p>
        </div>
      </div>
    );
  } else {
    showSettings = true;
    shellContent = (
      <div className={layout === "top" ? "studio-shell__chrome studio-shell__chrome--top" : "studio-shell__chrome"}>
        {layout === "top" ? (
          <>
            <ChapterListTop
              stories={stories}
              selectedStoryId={currentStory?.id ?? null}
              selectedChapterId={currentChapter?.id ?? null}
              onSelectStory={selectStory}
              onSelectChapter={handleSelectChapter}
              onCreateStory={handleCreateStory}
              onRenameStory={handleRenameStory}
              onCreateChapter={handleCreateChapter}
              onRenameChapter={handleRenameChapter}
              onDeleteChapter={handleDeleteChapter}
              onMoveChapter={handleMoveChapter}
            />
            <StudioEditor
              story={currentStory}
              chapter={currentChapter}
              onChapterRenamed={handleChapterRenamed}
              onStoryRenamed={handleStoryRenamed}
              onRequestChapterCreate={handleRequestChapterCreate}
            />
          </>
        ) : (
          <>
            <ChapterListSide
              stories={stories}
              selectedStoryId={currentStory?.id ?? null}
              selectedChapterId={currentChapter?.id ?? null}
              onSelectStory={selectStory}
              onSelectChapter={handleSelectChapter}
              onCreateStory={handleCreateStory}
              onRenameStory={handleRenameStory}
              onCreateChapter={handleCreateChapter}
              onRenameChapter={handleRenameChapter}
              onDeleteChapter={handleDeleteChapter}
              onMoveChapter={handleMoveChapter}
            />
            <StudioEditor
              story={currentStory}
              chapter={currentChapter}
              onChapterRenamed={handleChapterRenamed}
              onStoryRenamed={handleStoryRenamed}
              onRequestChapterCreate={handleRequestChapterCreate}
            />
          </>
        )}
      </div>
    );
  }

  const stageClassName = dropActive
    ? "studio-shell__stage studio-shell__stage--drop"
    : "studio-shell__stage";

  return (
    <div className={`studio-shell${focusMode ? " studio-shell--focus" : ""}`}>
      <div ref={dropContainerRef} className={stageClassName}>
        {dropActive && (
          <div className="studio-shell__drop-indicator" role="status" aria-live="polite">
            <strong>Drop text or markdown files to create chapters</strong>
          </div>
        )}
        {dropFeedback && (
          <div className="studio-shell__drop-feedback" role="status" aria-live="polite">
            {dropFeedback}
          </div>
        )}
        {dropIssues && (
          <div className="studio-shell__drop-issues" role="status" aria-live="polite">
            <header>
              <h3>Skipped files</h3>
              <p>We couldn't import the following chapters. Fix the issues and try again.</p>
            </header>
            <ul>
              {dropIssues.map((issue) => (
                <li key={issue.path}>
                  <code title={issue.path}>{issue.path}</code>
                  <span>{issue.reason}</span>
                </li>
              ))}
            </ul>
            <footer>
              <button type="button" className="ghost" onClick={() => setDropIssues(null)}>
                Dismiss
              </button>
            </footer>
          </div>
        )}
        {shellContent}
      </div>
      {showSettings ? <StudioSettings /> : null}
    </div>
  );
};

const StudioNotesWorkbench: React.FC = () => {
  const setJumps = useJmhStore((state) => state.setJumps);
  const setEntities = useJmhStore((state) => state.setEntities);
  const setNotes = useJmhStore((state) => state.setNotes);
  const setRecaps = useJmhStore((state) => state.setRecaps);
  const setNextActions = useJmhStore((state) => state.setNextActions);
  const snapshotQuery = useQuery({
    queryKey: ["story-studio-notes"],
    queryFn: loadSnapshot,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!snapshotQuery.data) {
      return;
    }
    const { jumps, entities, notes, recaps, nextActions } = snapshotQuery.data;
    setJumps(jumps);
    setEntities(entities);
    setNotes(notes);
    setRecaps(recaps);
    setNextActions(nextActions);

    const state = useJmhStore.getState();
    if (notes.length === 0) {
      state.setSelectedNote(null);
      state.setSelectedJump(null);
    } else if (!state.selectedNoteId) {
      state.setSelectedNote(notes[0].id);
      state.setSelectedJump(notes[0].jump_id ?? null);
    }
  }, [snapshotQuery.data, setEntities, setJumps, setNextActions, setNotes, setRecaps]);

  if (snapshotQuery.isLoading) {
    return (
      <div className="studio-notes-state">
        <h2>Loading Story Studio…</h2>
        <p>Fetching notes, mentions, and jump context.</p>
      </div>
    );
  }

  if (snapshotQuery.isError) {
    const rawError = snapshotQuery.error as unknown;
    const errorMessage =
      rawError instanceof Error
        ? rawError.message
        : typeof rawError === "string"
          ? rawError
          : "Unknown error";
    return (
      <div className="studio-notes-state">
        <div>
          <h2>Story Studio failed to load</h2>
          <p>{errorMessage}</p>
        </div>
        <button type="button" onClick={() => snapshotQuery.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="studio-notes-shell">
      <NotesEditor />
    </div>
  );
};

const StoryStudio: React.FC = () => {
  const [mode, setMode] = useState<"chapters" | "notes">("notes");

  return (
    <div className="story-studio">
      <div className="story-studio__tabs">
        <button
          type="button"
          className={mode === "notes" ? "story-studio__tab story-studio__tab--active" : "story-studio__tab"}
          onClick={() => setMode("notes")}
        >
          Session Notes
        </button>
        <button
          type="button"
          className={mode === "chapters" ? "story-studio__tab story-studio__tab--active" : "story-studio__tab"}
          onClick={() => setMode("chapters")}
        >
          Chapters & Recaps
        </button>
      </div>
      <div className="story-studio__content">
        {mode === "notes" ? <StudioNotesWorkbench /> : <StoryComposerShell />}
      </div>
    </div>
  );
};

export default StoryStudio;
