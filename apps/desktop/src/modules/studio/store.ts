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

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChapterRecord, StoryWithChapters } from "../../db/dao";

type StudioLayoutMode = "top" | "side";
type GrammarMode = "remote" | "sidecar";

export interface StudioState {
  stories: StoryWithChapters[];
  setStories: (stories: StoryWithChapters[]) => void;
  selectedStoryId: string | null;
  selectStory: (id: string | null) => void;
  selectedChapterId: string | null;
  selectChapter: (id: string | null) => void;
  layout: StudioLayoutMode;
  setLayout: (mode: StudioLayoutMode) => void;
  focusMode: boolean;
  setFocusMode: (value: boolean) => void;
  grammarMode: GrammarMode;
  grammarEnabled: boolean;
  setGrammarMode: (mode: GrammarMode) => void;
  setGrammarEnabled: (enabled: boolean) => void;
  autosaveIntervalMs: number;
  setAutosaveInterval: (ms: number) => void;
  lastAutosaveAt: string | null;
  setLastAutosave: (timestamp: string | null) => void;
}

interface StudioPersistedState {
  layout: StudioLayoutMode;
  focusMode: boolean;
  grammarMode: GrammarMode;
  grammarEnabled: boolean;
  autosaveIntervalMs: number;
}

const DEFAULT_AUTOSAVE_MS = 5000;

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      stories: [],
      setStories: (stories) => {
        set({ stories });
        const currentStoryId = get().selectedStoryId;
        if (!currentStoryId || !stories.some((story) => story.id === currentStoryId)) {
          const first = stories[0] ?? null;
          set({
            selectedStoryId: first ? first.id : null,
            selectedChapterId: first?.chapters[0]?.id ?? null,
          });
        } else {
          const currentChapterId = get().selectedChapterId;
          const story = stories.find((item) => item.id === currentStoryId);
          if (story && (!currentChapterId || !story.chapters.some((chapter) => chapter.id === currentChapterId))) {
            set({ selectedChapterId: story.chapters[0]?.id ?? null });
          }
        }
      },
      selectedStoryId: null,
      selectStory: (id) => {
        const stories = get().stories;
        const story = id ? stories.find((item) => item.id === id) ?? null : null;
        set({
          selectedStoryId: id,
          selectedChapterId: story?.chapters[0]?.id ?? null,
        });
      },
      selectedChapterId: null,
      selectChapter: (id) => set({ selectedChapterId: id }),
      layout: "top",
      setLayout: (layout) => set({ layout }),
      focusMode: false,
      setFocusMode: (focusMode) => set({ focusMode }),
      grammarMode: "remote",
      grammarEnabled: true,
      setGrammarMode: (grammarMode) => set({ grammarMode }),
      setGrammarEnabled: (grammarEnabled) => set({ grammarEnabled }),
      autosaveIntervalMs: DEFAULT_AUTOSAVE_MS,
      setAutosaveInterval: (autosaveIntervalMs) => set({ autosaveIntervalMs }),
      lastAutosaveAt: null,
      setLastAutosave: (lastAutosaveAt) => set({ lastAutosaveAt }),
    }),
    {
      name: "studio-settings",
      partialize: ({ layout, focusMode, grammarMode, grammarEnabled, autosaveIntervalMs }) => ({
        layout,
        focusMode,
        grammarMode,
        grammarEnabled,
        autosaveIntervalMs,
      }) satisfies StudioPersistedState,
    }
  )
);

export function getCurrentStory(): StoryWithChapters | null {
  const state = useStudioStore.getState();
  if (!state.selectedStoryId) return null;
  return state.stories.find((story) => story.id === state.selectedStoryId) ?? null;
}

export function getCurrentChapter(): ChapterRecord | null {
  const story = getCurrentStory();
  if (!story) return null;
  const chapterId = useStudioStore.getState().selectedChapterId;
  if (!chapterId) return story.chapters[0] ?? null;
  return story.chapters.find((chapter) => chapter.id === chapterId) ?? story.chapters[0] ?? null;
}
