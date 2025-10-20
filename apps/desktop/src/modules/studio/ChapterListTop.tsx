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

import React from "react";
import type { StoryWithChapters } from "../../db/dao";
import { confirmDialog } from "../../services/dialogService";

export interface ChapterListHandlers {
  onCreateStory: () => void;
  onRenameStory: (id: string, title: string) => void;
  onCreateChapter: (storyId: string) => void;
  onRenameChapter: (chapterId: string, title: string) => void;
  onDeleteChapter: (chapterId: string) => void;
  onMoveChapter: (chapterId: string, direction: "left" | "right") => void;
}

export interface ChapterListTopProps extends ChapterListHandlers {
  stories: StoryWithChapters[];
  selectedStoryId: string | null;
  selectedChapterId: string | null;
  onSelectStory: (id: string | null) => void;
  onSelectChapter: (id: string) => void;
}

export const ChapterListTop: React.FC<ChapterListTopProps> = ({
  stories,
  selectedStoryId,
  selectedChapterId,
  onSelectStory,
  onSelectChapter,
  onCreateStory,
  onRenameStory,
  onCreateChapter,
  onRenameChapter,
  onDeleteChapter,
  onMoveChapter,
}) => {
  const currentStory = selectedStoryId
    ? stories.find((story) => story.id === selectedStoryId) ?? null
    : stories[0] ?? null;

  const handleRenameStory = () => {
    if (!currentStory) return;
    const next = window.prompt("Rename story", currentStory.title);
    if (next && next.trim() && next.trim() !== currentStory.title) {
      onRenameStory(currentStory.id, next.trim());
    }
  };

  const handleCreateChapter = () => {
    if (!currentStory) return;
    onCreateChapter(currentStory.id);
  };

  return (
    <section className="studio-chapter-list">
      <header className="studio-chapter-list__stories">
        <select
          className="studio-chapter-list__story-select"
          value={currentStory?.id ?? ""}
          onChange={(event) => onSelectStory(event.target.value || null)}
        >
          {stories.map((story) => (
            <option key={story.id} value={story.id}>
              {story.title}
            </option>
          ))}
        </select>
        <button type="button" onClick={onCreateStory}>
          New Story
        </button>
        <button type="button" onClick={handleRenameStory} disabled={!currentStory}>
          Rename
        </button>
      </header>

      <div className="studio-chapter-list__chapter-grid">
        {(currentStory?.chapters ?? []).map((chapter, index, list) => {
          const isActive = chapter.id === selectedChapterId;
          return (
            <div key={chapter.id}>
              <button
                type="button"
                className={`studio-chapter-list__chapter-button${isActive ? " studio-chapter-list__chapter-button--active" : ""}`}
                onClick={() => onSelectChapter(chapter.id)}
              >
                <strong>{chapter.title}</strong>
                {chapter.synopsis && <p>{chapter.synopsis}</p>}
              </button>
              <div className="studio-settings__controls">
                <button
                  type="button"
                  className="studio-settings__action"
                  onClick={() => {
                    const next = promptRename(chapter.title);
                    if (next !== chapter.title) {
                      onRenameChapter(chapter.id, next);
                    }
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="studio-settings__action studio-settings__action--secondary"
                  onClick={() => onMoveChapter(chapter.id, "left")}
                  disabled={index === 0}
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="studio-settings__action studio-settings__action--secondary"
                  onClick={() => onMoveChapter(chapter.id, "right")}
                  disabled={index === list.length - 1}
                >
                  ▶
                </button>
                <button
                  type="button"
                  className="studio-settings__action studio-settings__action--danger"
                  onClick={async () => {
                    const confirmed = await confirmDialog({
                      message: `Delete chapter "${chapter.title}"?`,
                      title: "Delete chapter",
                      kind: "warning",
                      okLabel: "Delete",
                      cancelLabel: "Cancel",
                    });
                    if (confirmed) {
                      onDeleteChapter(chapter.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        <button type="button" className="studio-chapter-list__chapter-button" onClick={handleCreateChapter}>
          + New Chapter
        </button>
      </div>
    </section>
  );
};

function promptRename(current: string): string {
  const next = window.prompt("New chapter title", current) ?? current;
  return next.trim() || current;
}

export default ChapterListTop;
