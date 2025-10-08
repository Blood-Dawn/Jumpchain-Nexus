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

import React from "react";
import type { StoryWithChapters } from "../../db/dao";
import type { ChapterListHandlers } from "./ChapterListTop";

export interface ChapterListSideProps extends ChapterListHandlers {
  stories: StoryWithChapters[];
  selectedStoryId: string | null;
  selectedChapterId: string | null;
  onSelectStory: (id: string | null) => void;
  onSelectChapter: (id: string) => void;
}

export const ChapterListSide: React.FC<ChapterListSideProps> = ({
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

  return (
    <aside className="studio-chapter-list__side">
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
          New
        </button>
        <button type="button" onClick={handleRenameStory} disabled={!currentStory}>
          Rename
        </button>
      </header>

      <div className="studio-chapter-list__side-scroll">
        <ul>
          {(currentStory?.chapters ?? []).map((chapter, index, list) => {
            const isActive = chapter.id === selectedChapterId;
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  className={`studio-chapter-list__chapter-button${isActive ? " studio-chapter-list__chapter-button--active" : ""}`}
                  onClick={() => onSelectChapter(chapter.id)}
                >
                  <strong>{chapter.title}</strong>
                  {chapter.synopsis && <span>{chapter.synopsis}</span>}
                </button>
                <div className="studio-settings__controls">
                  <button
                    type="button"
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
                    onClick={() => onMoveChapter(chapter.id, "left")}
                    disabled={index === 0}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveChapter(chapter.id, "right")}
                    disabled={index === list.length - 1}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete chapter "${chapter.title}"?`)) {
                        onDeleteChapter(chapter.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <button type="button" onClick={() => currentStory && onCreateChapter(currentStory.id)}>
        + Add Chapter
      </button>
    </aside>
  );
};

function promptRename(current: string): string {
  const next = window.prompt("New chapter title", current) ?? current;
  return next.trim() || current;
}

export default ChapterListSide;
