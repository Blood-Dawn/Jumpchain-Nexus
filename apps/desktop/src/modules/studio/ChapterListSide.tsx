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
import type { ChapterListHandlers } from "./ChapterListTop";
import { confirmDialog } from "../../services/dialogService";

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
            const synopsis = chapter.synopsis?.trim() ?? "";
            const hasSynopsis = synopsis.length > 0;
            const showSynopsisWarning = !hasSynopsis;
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  className={`studio-chapter-list__chapter-button${isActive ? " studio-chapter-list__chapter-button--active" : ""}`}
                  onClick={() => onSelectChapter(chapter.id)}
                >
                  <span className="studio-chapter-list__chapter-icons" aria-hidden="true">
                    <ChapterGlyph className="studio-chapter-list__icon studio-chapter-list__icon--chapter" />
                    <SynopsisGlyph
                      className={`studio-chapter-list__icon studio-chapter-list__icon--synopsis${hasSynopsis ? " is-active" : ""}`}
                    />
                    <WarningGlyph
                      className={`studio-chapter-list__icon studio-chapter-list__icon--warning${showSynopsisWarning ? " is-active" : ""}`}
                    />
                  </span>
                  <span className="studio-chapter-list__chapter-meta">
                    <strong>{chapter.title}</strong>
                    {hasSynopsis ? (
                      <span>{synopsis}</span>
                    ) : (
                      <span className="studio-chapter-list__chapter-warning">Synopsis pending</span>
                    )}
                  </span>
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
                    Up
                  </button>
                  <button
                    type="button"
                    className="studio-settings__action studio-settings__action--secondary"
                    onClick={() => onMoveChapter(chapter.id, "right")}
                    disabled={index === list.length - 1}
                  >
                    Down
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

interface IconProps {
  className?: string;
}

const ChapterGlyph: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    role="img"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    <path
      fill="currentColor"
      d="M4 6.5C4 4.015 6.015 2 8.5 2H12v17.5H8.75A2.75 2.75 0 0 0 6 22H4V6.5zm16 0C20 4.015 17.985 2 15.5 2H12v17.5h3.25A2.75 2.75 0 0 1 18 22h2V6.5z"
    />
    <path
      fill="currentColor"
      d="M12 6h6v1.5h-6z"
      opacity="0.8"
    />
  </svg>
);

const SynopsisGlyph: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    role="img"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    <rect x="5" y="3" width="14" height="18" rx="2.5" fill="currentColor" opacity="0.25" />
    <path
      fill="currentColor"
      d="M8 7.25A.75.75 0 0 1 8.75 6.5h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 8 7.25zm0 3.75a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 8 11zm0 3.75a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4A.75.75 0 0 1 8 14.75z"
    />
  </svg>
);

const WarningGlyph: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    role="img"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    <path
      fill="currentColor"
      d="M12.874 4.513a1.5 1.5 0 0 0-2.748 0L3.353 18.027A1.5 1.5 0 0 0 4.727 20.25h14.546a1.5 1.5 0 0 0 1.374-2.223zM12 10.25a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V11a.75.75 0 0 1 .75-.75zm0 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"
    />
  </svg>
);

export default ChapterListSide;
