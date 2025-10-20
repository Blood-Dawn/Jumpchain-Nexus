/*
MIT License

Copyright (c) 2025 Bloodawn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StoryStudio from "./index";
import { useStudioStore } from "./store";
import {
  collectStoryChapterDraftsFromPaths,
} from "../../services/storyStudioImporter";
import { createWebPlatform, getPlatform, setPlatform } from "../../services/platform";

const now = new Date().toISOString();
const baseStory = {
  id: "story-1",
  title: "Existing Story",
  summary: null,
  jump_id: null,
  created_at: now,
  updated_at: now,
};

const storedStories = [
  {
    ...baseStory,
    chapters: [],
  },
];

let chapterCounter = 0;

vi.mock("../../db/dao", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../db/dao")>();
  return {
    ...actual,
    listStories: vi.fn(async () =>
      storedStories.map((story) => ({
        ...story,
        chapters: [...story.chapters],
      })),
    ),
    createChapter: vi.fn(async ({ story_id, title, synopsis }) => {
      chapterCounter += 1;
      const chapter = {
        id: `chapter-${chapterCounter}`,
        story_id,
        title,
        synopsis: synopsis ?? null,
        sort_order: storedStories[0].chapters.length,
        created_at: now,
        updated_at: now,
      };
      storedStories[0].chapters.push(chapter);
      return chapter;
    }),
    saveChapterText: vi.fn(async () => ({
      chapter_id: "chapter-temp",
      json: "{}",
      plain: "",
      updated_at: now,
    })),
    createStory: vi.fn(async ({ title }) => ({
      ...baseStory,
      id: `story-${Date.now()}`,
      title,
    })),
    deleteChapter: vi.fn(),
    updateChapter: vi.fn(async () => storedStories[0].chapters[0] ?? null),
    updateStory: vi.fn(async () => ({ ...baseStory })),
    reorderChapters: vi.fn(async () => undefined),
  } satisfies Partial<typeof actual>;
});

vi.mock("../../services/storyStudioImporter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/storyStudioImporter")>();
  return {
    ...actual,
    collectStoryChapterDraftsFromPaths: vi.fn(async () => ({
      drafts: [
        {
          path: "/chapter.md",
          title: "Imported Chapter",
          synopsis: "Imported summary",
          plain: "Imported chapter body",
          json: JSON.stringify({ type: "doc", content: [] }),
        },
      ],
      errors: [],
    })),
  } satisfies Partial<typeof actual>;
});

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe("StoryStudio drop integration", () => {
  beforeEach(() => {
    chapterCounter = 0;
    storedStories[0].chapters = [];
    useStudioStore.setState((state) => ({
      ...state,
      stories: [],
      selectedStoryId: null,
      selectedChapterId: null,
    }));
    setPlatform(createWebPlatform());
  });

  afterEach(() => {
    setPlatform(createWebPlatform());
  });

  it("imports dropped chapters using the platform drop adapter", async () => {
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <StoryStudio />
      </QueryClientProvider>,
    );

    const chaptersTab = await screen.findByRole("button", { name: /Chapters & Recaps/i });
    fireEvent.click(chaptersTab);

    await screen.findByText(/Existing Story/i);

    const stage = document.querySelector(".studio-shell__stage") as HTMLElement;
    expect(stage).toBeTruthy();

    const platform = await getPlatform();
    await act(async () => {
      platform.drop.emitTestEvent?.(stage, { type: "drop", paths: ["/chapter.md"] });
    });

    await waitFor(() => {
      expect(collectStoryChapterDraftsFromPaths).toHaveBeenCalledWith(["/chapter.md"]);
    });

    await screen.findByText(/Imported 1 chapter/);

    queryClient.clear();
  });
});
