/*
Bloodawn

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
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import KnowledgeBase from "./index";
import {
  collectKnowledgeBaseDraftsFromPaths,
  importKnowledgeBaseArticles,
} from "../../services/knowledgeBaseImporter";
import { createWebPlatform, getPlatform, setPlatform } from "../../services/platform";
import type { KnowledgeBaseArticleDraft } from "../../services/knowledgeBaseImportUtils";
import {
  countKnowledgeArticles,
  fetchKnowledgeArticles,
  upsertKnowledgeArticle,
  type KnowledgeArticleRecord,
  type UpsertKnowledgeArticleInput,
} from "../../db/dao";

const knowledgeArticlesStore: KnowledgeArticleRecord[] = [];
let knowledgeArticleIdCounter = 2;

function getStableKeyFromArticle(
  title: string,
  source: string | null | undefined
): string | null {
  if (source && source.trim().length) {
    return source.trim().toLowerCase();
  }
  if (title.trim().length) {
    return title.trim().toLowerCase();
  }
  return null;
}

function resetKnowledgeArticlesStore(): void {
  knowledgeArticlesStore.length = 0;
  knowledgeArticleIdCounter = 2;
  const now = new Date().toISOString();
  knowledgeArticlesStore.push({
    id: "kb-1",
    title: "Reference Article",
    category: "Imported",
    summary: "Summary",
    content: "Body",
    tags: ["jump"],
    source: "reference.md",
    is_system: false,
    created_at: now,
    updated_at: now,
    related_asset_ids: [],
  });
}

resetKnowledgeArticlesStore();

vi.mock("../../db/dao", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../db/dao")>();
  return {
    ...actual,
    ensureKnowledgeBaseSeeded: vi.fn(async () => undefined),
    countKnowledgeArticles: vi.fn(async () => knowledgeArticlesStore.length),
    fetchKnowledgeArticles: vi.fn(async () => [...knowledgeArticlesStore]),
    upsertKnowledgeArticle: vi.fn(async (input: UpsertKnowledgeArticleInput) => {
      const stableKey = getStableKeyFromArticle(input.title, input.source ?? null);
      const now = new Date().toISOString();
      const existingById = input.id
        ? knowledgeArticlesStore.find((article) => article.id === input.id)
        : undefined;
      const existingByKey = !existingById && stableKey
        ? knowledgeArticlesStore.find(
            (article) => getStableKeyFromArticle(article.title, article.source) === stableKey
          )
        : undefined;
      const existing = existingById ?? existingByKey;
      const id = existing?.id ?? input.id ?? `kb-${knowledgeArticleIdCounter++}`;
      const createdAt = existing?.created_at ?? now;
      const record: KnowledgeArticleRecord = {
        id,
        title: input.title,
        category: input.category ?? null,
        summary: input.summary ?? null,
        content: input.content,
        tags: input.tags ?? [],
        source: input.source ?? null,
        is_system: existing?.is_system ?? false,
        created_at: createdAt,
        updated_at: now,
        related_asset_ids: input.relatedAssetIds ?? [],
      };
      if (existing) {
        const index = knowledgeArticlesStore.findIndex((article) => article.id === existing.id);
        knowledgeArticlesStore[index] = record;
      } else {
        knowledgeArticlesStore.push(record);
      }
      return record;
    }),
    deleteKnowledgeArticle: vi.fn(async (id: string) => {
      const index = knowledgeArticlesStore.findIndex((article) => article.id === id);
      if (index !== -1) {
        knowledgeArticlesStore.splice(index, 1);
      }
    }),
    listAssetReferenceSummaries: vi.fn(async () => [
      {
        asset_id: "asset-1",
        asset_name: "Asset One",
        asset_type: "perk",
        jump_id: "jump-1",
        jump_title: "Jump One",
      },
    ]),
  } satisfies Partial<typeof actual>;
});

vi.mock("../../services/knowledgeBaseImporter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/knowledgeBaseImporter")>();
  return {
    ...actual,
    collectKnowledgeBaseDraftsFromPaths: vi.fn(async () => ({
      drafts: [
        {
          path: "/draft.md",
          payload: {
            title: "Draft Title",
            category: "Imported",
            summary: "Draft summary",
            content: "Draft body",
            tags: [],
            source: "draft.md",
          },
          meta: { fileName: "draft.md", wordCount: 3 },
        },
      ],
      errors: [],
    })),
    importKnowledgeBaseArticles: vi.fn(actual.importKnowledgeBaseArticles),
  } satisfies Partial<typeof actual>;
});

const jmhStore = {
  setSelectedJump: vi.fn(),
  setActiveAssetType: vi.fn(),
  setSelectedAssetId: vi.fn(),
};

vi.mock("../jmh/store", () => ({
  useJmhStore: (selector: (state: typeof jmhStore) => unknown) => selector(jmhStore),
}));

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe("KnowledgeBase drop integration", () => {
  beforeEach(() => {
    setPlatform(createWebPlatform());
    resetKnowledgeArticlesStore();
    jmhStore.setSelectedJump.mockReset();
    jmhStore.setActiveAssetType.mockReset();
    jmhStore.setSelectedAssetId.mockReset();
    vi.mocked(importKnowledgeBaseArticles).mockClear();
    vi.mocked(collectKnowledgeBaseDraftsFromPaths).mockClear();
    vi.mocked(upsertKnowledgeArticle).mockClear();
    vi.mocked(fetchKnowledgeArticles).mockClear();
    vi.mocked(countKnowledgeArticles).mockClear();
  });

  afterEach(() => {
    setPlatform(createWebPlatform());
  });

  it("imports dropped files via the platform drop adapter", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["knowledge-base", "asset-options"], [
      {
        asset_id: "asset-1",
        asset_name: "Asset One",
        asset_type: "perk",
        jump_id: "jump-1",
        jump_title: "Jump One",
      },
    ]);
    queryClient.setQueryData(["knowledge-base", "import-errors"], []);

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <KnowledgeBase />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await screen.findByText(/Knowledge Base/i);

    const stage = document.querySelector(".knowledge-base__stage") as HTMLElement;
    expect(stage).toBeTruthy();

    const platform = await getPlatform();
    await act(async () => {
      platform.drop.emitTestEvent?.(stage, { type: "drop", paths: ["/draft.md"] });
    });

    await waitFor(() => {
      expect(collectKnowledgeBaseDraftsFromPaths).toHaveBeenCalledWith(["/draft.md"]);
      expect(importKnowledgeBaseArticles).toHaveBeenCalled();
    });

    await screen.findByText(/Imported 1 article/);

    queryClient.clear();
  });

  it("deduplicates duplicate imports so only one article appears", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["knowledge-base", "asset-options"], [
      {
        asset_id: "asset-1",
        asset_name: "Asset One",
        asset_type: "perk",
        jump_id: "jump-1",
        jump_title: "Jump One",
      },
    ]);
    queryClient.setQueryData(["knowledge-base", "import-errors"], []);

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <KnowledgeBase />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await screen.findByText(/Knowledge Base/i);

    const duplicateDraft: KnowledgeBaseArticleDraft = {
      path: "/duplicate.md",
      payload: {
        title: "Duplicate Title",
        category: "Imported",
        summary: "Duplicate summary",
        content: "Duplicate body",
        tags: [],
        source: "duplicate.md",
      },
      meta: { fileName: "duplicate.md", wordCount: 3 },
    };

    vi.mocked(collectKnowledgeBaseDraftsFromPaths).mockResolvedValueOnce({
      drafts: [
        { ...duplicateDraft },
        { ...duplicateDraft },
      ],
      errors: [],
    });

    const stage = document.querySelector(".knowledge-base__stage") as HTMLElement;
    const platform = await getPlatform();

    await act(async () => {
      platform.drop.emitTestEvent?.(stage, {
        type: "drop",
        paths: ["/duplicate.md", "/duplicate.md"],
      });
    });

    await waitFor(() => {
      expect(importKnowledgeBaseArticles).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(upsertKnowledgeArticle).toHaveBeenCalledTimes(1);
    });

    await screen.findByText(/Imported 1 article/);

    const list = document.querySelector(".knowledge-base__list ul") as HTMLElement | null;
    expect(list).toBeTruthy();
    await waitFor(() => {
      const occurrences = within(list as HTMLElement).getAllByText("Duplicate Title");
      expect(occurrences).toHaveLength(1);
    });

    queryClient.clear();
  });
});
