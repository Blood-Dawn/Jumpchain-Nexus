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
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import KnowledgeBase from "./index";
import {
  collectKnowledgeBaseDraftsFromPaths,
  importKnowledgeBaseArticles,
} from "../../services/knowledgeBaseImporter";
import { createWebPlatform, getPlatform, setPlatform } from "../../services/platform";

vi.mock("../../db/dao", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../db/dao")>();
  const now = new Date().toISOString();
  return {
    ...actual,
    ensureKnowledgeBaseSeeded: vi.fn(async () => undefined),
    countKnowledgeArticles: vi.fn(async () => 1),
    fetchKnowledgeArticles: vi.fn(async () => [
      {
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
      },
    ]),
    upsertKnowledgeArticle: vi.fn(),
    deleteKnowledgeArticle: vi.fn(),
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
    importKnowledgeBaseArticles: vi.fn(async () => ({
      saved: [
        {
          id: "kb-2",
          title: "Draft Title",
          category: "Imported",
          summary: "Draft summary",
          content: "Draft body",
          tags: [],
          source: "draft.md",
          is_system: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      errors: [],
    })),
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
    jmhStore.setSelectedJump.mockReset();
    jmhStore.setActiveAssetType.mockReset();
    jmhStore.setSelectedAssetId.mockReset();
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
});
