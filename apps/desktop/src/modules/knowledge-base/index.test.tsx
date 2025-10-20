import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

type KnowledgeArticleRecord = import("../../db/dao").KnowledgeArticleRecord;
type KnowledgeBaseImportOptions = import("../../services/knowledgeBaseImporter").KnowledgeBaseImportOptions;
type KnowledgeBaseImportProgress = import("../../services/knowledgeBaseImporter").KnowledgeBaseImportProgress;
type KnowledgeBaseImportError = import("../../services/knowledgeBaseImporter").KnowledgeBaseImportError;
type KnowledgeBaseArticleDraft = import("../../services/knowledgeBaseImportUtils").KnowledgeBaseArticleDraft;

type DaoModule = typeof import("../../db/dao");
type ImporterModule = typeof import("../../services/knowledgeBaseImporter");

type ImporterControl = {
  resolve: (value: {
    saved: KnowledgeArticleRecord[];
    errors: KnowledgeBaseImportError[];
    cancelled: boolean;
  }) => void;
  options: KnowledgeBaseImportOptions;
  drafts: KnowledgeBaseArticleDraft[];
};

const now = new Date().toISOString();

const existingArticle: KnowledgeArticleRecord = {
  id: "article-1",
  title: "Existing Article",
  category: "General",
  summary: "A handy summary",
  content: "Existing article content",
  tags: ["guide"],
  source: "seeded.txt",
  is_system: false,
  created_at: now,
  updated_at: now,
};

const assetOption = {
  asset_id: "asset-1",
  asset_name: "Asset One",
  asset_type: "perk" as const,
  jump_id: "jump-1",
  jump_title: "Jump One",
};

const selectionDrafts: KnowledgeBaseArticleDraft[] = [
  {
    path: "/imports/article-one.txt",
    payload: {
      title: "Article One",
      category: "Imported",
      summary: "First",
      content: "First imported article",
      tags: [],
      source: "article-one.txt",
    },
    meta: {
      fileName: "article-one.txt",
      wordCount: 3,
    },
  },
  {
    path: "/imports/article-two.txt",
    payload: {
      title: "Article Two",
      category: "Imported",
      summary: "Second",
      content: "Second imported article",
      tags: [],
      source: "article-two.txt",
    },
    meta: {
      fileName: "article-two.txt",
      wordCount: 3,
    },
  },
];

let importerControl: ImporterControl | null = null;

vi.mock("../../db/dao", (): DaoModule => {
  const articles = [existingArticle];

  return {
    clearKnowledgeBaseImportErrors: vi.fn(async () => undefined),
    countKnowledgeArticles: vi.fn(async () => articles.length),
    deleteKnowledgeArticle: vi.fn(async () => undefined),
    deleteKnowledgeBaseImportError: vi.fn(async () => undefined),
    ensureKnowledgeBaseSeeded: vi.fn(async () => undefined),
    fetchKnowledgeArticles: vi.fn(async () => articles),
    listAssetReferenceSummaries: vi.fn(async () => [assetOption]),
    listKnowledgeBaseImportErrors: vi.fn(async () => []),
    lookupAssetReferenceSummaries: vi.fn(async () => []),
    recordKnowledgeBaseImportErrors: vi.fn(async () => undefined),
    upsertKnowledgeArticle: vi.fn(async (payload) => ({
      id: `imported-${payload.title}`,
      title: payload.title,
      category: payload.category ?? null,
      summary: payload.summary ?? null,
      content: payload.content,
      tags: payload.tags ?? [],
      source: payload.source ?? null,
      is_system: false,
      created_at: now,
      updated_at: now,
    })),
  } satisfies Partial<DaoModule> as DaoModule;
});

const jmhStore = {
  setSelectedJump: vi.fn(),
  setActiveAssetType: vi.fn(),
  setSelectedAssetId: vi.fn(),
};

vi.mock("../jmh/store", () => ({
  useJmhStore: (selector: (state: typeof jmhStore) => unknown) => selector(jmhStore),
}));

vi.mock("../../services/dialogService", () => ({
  confirmDialog: vi.fn(async () => false),
}));

vi.mock("../../services/knowledgeBaseImporter", (): ImporterModule => {
  return {
    promptKnowledgeBaseImport: vi.fn(async () => ({ drafts: selectionDrafts, errors: [] })),
    importKnowledgeBaseArticles: vi.fn((drafts, _save, options: KnowledgeBaseImportOptions = {}) => {
      return new Promise((resolve) => {
        importerControl = {
          resolve: (result) => {
            importerControl = null;
            resolve(result);
          },
          options,
          drafts,
        };

        options.onProgress?.({
          processed: 0,
          total: drafts.length,
          saved: 0,
          failed: 0,
          currentPath: drafts[0]?.path ?? null,
        });

        options.signal?.addEventListener(
          "abort",
          () => {
            resolve({ saved: [], errors: [], cancelled: true });
            importerControl = null;
          },
          { once: true }
        );
      });
    }),
  } satisfies Partial<ImporterModule> as ImporterModule;
});

const { default: KnowledgeBase } = await import("./index");
const { promptKnowledgeBaseImport, importKnowledgeBaseArticles } = await import(
  "../../services/knowledgeBaseImporter"
);
const promptKnowledgeBaseImportMock = vi.mocked(promptKnowledgeBaseImport);
const importKnowledgeBaseArticlesMock = vi.mocked(importKnowledgeBaseArticles);

const renderWithClient = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  client.setQueryData(["knowledge-base", "asset-options"], [assetOption]);
  client.setQueryData(["knowledge-base", "import-errors"], []);

  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <KnowledgeBase />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe("KnowledgeBase import progress", () => {
  beforeEach(() => {
    importerControl = null;
    promptKnowledgeBaseImportMock.mockClear();
    importKnowledgeBaseArticlesMock.mockClear();
    jmhStore.setSelectedJump.mockReset();
    jmhStore.setActiveAssetType.mockReset();
    jmhStore.setSelectedAssetId.mockReset();
  });

  afterEach(() => {
    importerControl = null;
  });

  it("shows a progress modal and responds to pause, resume, and cancel actions", async () => {
    const user = userEvent.setup();

    renderWithClient();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Import from file" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Import from file" }));

    await waitFor(() => {
      expect(promptKnowledgeBaseImportMock).toHaveBeenCalledTimes(1);
    });

    const progressDialog = await screen.findByRole("dialog", { name: "Importing articles" });
    expect(progressDialog).toBeInTheDocument();
    expect(progressDialog).toHaveTextContent("Import in progress");
    expect(progressDialog).toHaveTextContent("Processed 0 of 2");
    expect(progressDialog).toHaveTextContent("Working on /imports/article-one.txt");

    expect(importerControl).not.toBeNull();
    const options = importerControl?.options;
    expect(options?.signal).toBeDefined();

    await act(async () => {
      const progress: KnowledgeBaseImportProgress = {
        processed: 1,
        total: importerControl?.drafts.length ?? 2,
        saved: 1,
        failed: 0,
        currentPath: "/imports/article-two.txt",
      };
      importerControl?.options.onProgress?.(progress);
    });

    expect(progressDialog).toHaveTextContent("Processed 1 of 2");
    expect(progressDialog).toHaveTextContent("Working on /imports/article-two.txt");

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(progressDialog).toHaveTextContent("Import paused");
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Resume" }));
    await waitFor(() => {
      expect(progressDialog).toHaveTextContent("Import in progress");
    });
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(importKnowledgeBaseArticlesMock).toHaveBeenCalledTimes(1);
    });
  
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Importing articles" })).not.toBeInTheDocument();
    });
  });
});
