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

/// <reference types="vitest" />

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

type DaoModule = typeof import("../../db/dao");
type ImporterModule = typeof import("../../services/knowledgeBaseImporter");
type KnowledgeArticleRecord = import("../../db/dao").KnowledgeArticleRecord;
type KnowledgeBaseImportErrorRecord = import("../../db/dao").KnowledgeBaseImportErrorRecord;
type UpsertKnowledgeArticleInput = import("../../db/dao").UpsertKnowledgeArticleInput;
type KnowledgeBaseArticleDraft = import("../../services/knowledgeBaseImportUtils").KnowledgeBaseArticleDraft;

const now = "2025-01-01T00:00:00.000Z";
const later = "2025-01-02T00:00:00.000Z";

const baseArticle: KnowledgeArticleRecord = {
  id: "article-1",
  title: "Sample Article",
  category: "Imported",
  summary: "Example summary",
  content: "Sample content body for knowledge base article.",
  tags: ["tag"],
  source: "sample.txt",
  is_system: false,
  created_at: now,
  updated_at: now,
};

let articlesData: KnowledgeArticleRecord[] = [];
let importErrorsData: KnowledgeBaseImportErrorRecord[] = [];

vi.mock("../../db/dao", async (): Promise<DaoModule> => {
  const actual = await vi.importActual<DaoModule>("../../db/dao");
  return {
    ...actual,
    ensureKnowledgeBaseSeeded: vi.fn(async () => undefined),
    fetchKnowledgeArticles: vi.fn(async () => articlesData),
    countKnowledgeArticles: vi.fn(async () => articlesData.length),
    upsertKnowledgeArticle: vi.fn(async (payload: UpsertKnowledgeArticleInput) => ({
      ...baseArticle,
      ...payload,
      id: baseArticle.id,
      category: payload.category ?? null,
      summary: payload.summary ?? null,
      tags: payload.tags ?? [],
      source: payload.source ?? null,
      content: payload.content ?? baseArticle.content,
    })),
    listKnowledgeBaseImportErrors: vi.fn(async () => importErrorsData),
    recordKnowledgeBaseImportErrors: vi.fn(async (errors) => {
      for (const entry of errors) {
        const existing = importErrorsData.find((item) => item.path === entry.path);
        if (existing) {
          existing.reason = entry.reason;
          existing.updated_at = later;
        } else {
          importErrorsData = [
            ...importErrorsData,
            {
              id: `err-${importErrorsData.length + 1}`,
              path: entry.path,
              reason: entry.reason,
              created_at: now,
              updated_at: now,
            },
          ];
        }
      }
    }),
    deleteKnowledgeBaseImportError: vi.fn(async (id: string) => {
      importErrorsData = importErrorsData.filter((item) => item.id !== id);
    }),
    clearKnowledgeBaseImportErrors: vi.fn(async () => {
      importErrorsData = [];
    }),
  } satisfies DaoModule;
});

vi.mock("../../services/knowledgeBaseImporter", async (): Promise<ImporterModule> => ({
  promptKnowledgeBaseImport: vi.fn(),
  importKnowledgeBaseArticles: vi.fn(),
  loadKnowledgeBaseDraft: vi.fn(),
}));

const dao = await import("../../db/dao");
const importer = await import("../../services/knowledgeBaseImporter");
const { default: KnowledgeBase } = await import("./index");

describe("KnowledgeBase import errors", () => {
  const renderKnowledgeBase = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const view = render(
      <QueryClientProvider client={queryClient}>
        <KnowledgeBase />
      </QueryClientProvider>
    );

    const user = userEvent.setup();
    return { queryClient, user, ...view };
  };

  beforeEach(() => {
    articlesData = [baseArticle];
    importErrorsData = [];
    vi.clearAllMocks();
  });

  it("renders persisted import errors inside the drawer", async () => {
    importErrorsData = [
      {
        id: "err-1",
        path: "/tmp/alpha.txt",
        reason: "Unsupported format",
        created_at: now,
        updated_at: now,
      },
    ];

    renderKnowledgeBase();

    const drawer = await screen.findByRole("complementary", {
      name: /failed knowledge base imports/i,
    });

    expect(within(drawer).getByText("/tmp/alpha.txt")).toBeInTheDocument();
    expect(within(drawer).getByText("Unsupported format")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("retries a failed import and removes it once saved", async () => {
    importErrorsData = [
      {
        id: "err-1",
        path: "/tmp/alpha.txt",
        reason: "Unsupported format",
        created_at: now,
        updated_at: now,
      },
    ];

    const draft: KnowledgeBaseArticleDraft = {
      path: "/tmp/alpha.txt",
      payload: {
        title: "Retried Article",
        category: null,
        summary: null,
        content: "Recovered content",
        tags: [],
        source: "alpha.txt",
      },
      meta: { fileName: "alpha.txt", wordCount: 2 },
    };

    vi.mocked(importer.loadKnowledgeBaseDraft).mockResolvedValue(draft);

    const { user } = renderKnowledgeBase();

    const retryButton = await screen.findByRole("button", { name: "Retry" });
    await user.click(retryButton);

    await waitFor(() => {
      expect(importer.loadKnowledgeBaseDraft).toHaveBeenCalledWith("/tmp/alpha.txt");
    });
    await waitFor(() => {
      expect(dao.upsertKnowledgeArticle).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(dao.deleteKnowledgeBaseImportError).toHaveBeenCalledWith("err-1");
    });

    await waitFor(() => {
      expect(screen.queryByText("/tmp/alpha.txt")).not.toBeInTheDocument();
    });
  });
});
