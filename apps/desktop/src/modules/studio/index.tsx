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

import React, { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import "./Studio.css";
import {
  createChapter,
  createStory,
  deleteChapter,
  listStories,
  reorderChapters,
  updateChapter,
  updateStory,
} from "../../db/dao";
import type { StoryWithChapters } from "../../db/dao";
import { useStudioStore } from "./store";
import ChapterListTop from "./ChapterListTop";
import ChapterListSide from "./ChapterListSide";
import StudioSettings from "./StudioSettings";
import StudioEditor from "./Editor";

const StoryStudio: React.FC = () => {
  const queryClient = useQueryClient();
  const setStories = useStudioStore((state) => state.setStories);
  const stories = useStudioStore((state) => state.stories);
  const layout = useStudioStore((state) => state.layout);
  const focusMode = useStudioStore((state) => state.focusMode);
  const selectedStoryId = useStudioStore((state) => state.selectedStoryId);
  const selectStory = useStudioStore((state) => state.selectStory);
  const selectedChapterId = useStudioStore((state) => state.selectedChapterId);
  const selectChapter = useStudioStore((state) => state.selectChapter);

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

  return (
    <main className={`studio-shell${focusMode ? " studio-shell--focus" : ""}`}>
      {shellContent}
      {showSettings ? <StudioSettings /> : null}
    </main>
  );
};

export default StoryStudio;
