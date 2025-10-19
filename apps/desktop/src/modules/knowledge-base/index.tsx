/*
MIT License

Copyright (c) 2025 Age-Of-Ages

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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEventHandler } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import "./knowledgeBase.css";
import {
  countKnowledgeArticles,
  deleteKnowledgeArticle,
  ensureKnowledgeBaseSeeded,
  fetchKnowledgeArticles,
  listKnowledgeBaseImportErrors,
  recordKnowledgeBaseImportErrors,
  deleteKnowledgeBaseImportError,
  clearKnowledgeBaseImportErrors,
  upsertKnowledgeArticle,
  type KnowledgeArticleQuery,
  type KnowledgeArticleRecord,
  type KnowledgeBaseImportError,
  type KnowledgeBaseImportErrorRecord,
  type UpsertKnowledgeArticleInput,
} from "../../db/dao";
import {
  collectKnowledgeBaseDraftsFromPaths,
  importKnowledgeBaseArticles,
  promptKnowledgeBaseImport,
  type KnowledgeBaseImportError,
  type KnowledgeBaseImportProgress,
} from "../../services/knowledgeBaseImporter";
import { confirmDialog } from "../../services/dialogService";
import { getPlatform } from "../../services/platform";

interface EditorState {
  open: boolean;
  draft: UpsertKnowledgeArticleInput;
  editingId?: string;
}

interface KnowledgeBaseLocationState {
  articleId?: string;
}

interface ImportMutationResult {
  cancelled: boolean;
  saved: KnowledgeArticleRecord[];
  errors: KnowledgeBaseImportError[];
}

interface ImportProgressState {
  status: "running" | "paused";
  processed: number;
  total: number;
  saved: number;
  failed: number;
  currentPath: string | null;
}

const emptyDraft: UpsertKnowledgeArticleInput = {
  title: "",
  category: "",
  summary: "",
  content: "",
  tags: [],
  source: "",
  relatedAssetIds: [],
};

function parseTags(input: string): string[] {
  return input
    .split(/[,;\n]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 20);
}

function toTagInput(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) {
    return "";
  }
  return tags.join(", ");
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const FilterIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M2 3.25C2 2.56 2.56 2 3.25 2h9.5c.69 0 1.25.56 1.25 1.25 0 .29-.1.57-.29.79l-3.71 4.29a1.25 1.25 0 0 0-.3.81v2.61c0 .32-.13.63-.35.86l-1.12 1.12A.75.75 0 0 1 7.5 14v-5.11a1.25 1.25 0 0 0-.3-.81L3.5 4.04A1.25 1.25 0 0 1 3.25 3.25Z"
    />
  </svg>
);

const TagIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M8.63 2H3.75C2.78 2 2 2.78 2 3.75v4.88c0 .33.13.65.36.88l4.88 4.88c.49.49 1.28.49 1.77 0l4.88-4.88a1.25 1.25 0 0 0 0-1.77L9.51 2.36A1.25 1.25 0 0 0 8.63 2Zm-3.88 3a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z"
    />
  </svg>
);

const KnowledgeBase = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const setSelectedJump = useJmhStore((state) => state.setSelectedJump);
  const setActiveAssetType = useJmhStore((state) => state.setActiveAssetType);
  const setSelectedAssetId = useJmhStore((state) => state.setSelectedAssetId);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState>({
    open: false,
    draft: { ...emptyDraft },
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [importIssues, setImportIssues] = useState<KnowledgeBaseImportError[] | null>(null);
  const [isDropActive, setDropActive] = useState(false);
  const stageElementRef = useRef<HTMLElement | null>(null);

  const filters = useMemo<KnowledgeArticleQuery>(
    () => ({
      ...(search.trim().length ? { search: search.trim() } : undefined),
      ...(categoryFilter ? { category: categoryFilter } : undefined),
      ...(tagFilter ? { tag: tagFilter } : undefined),
    }),
    [search, categoryFilter, tagFilter]
  );

  useEffect(() => {
    let active = true;
    ensureKnowledgeBaseSeeded().catch((error) => {
      if (!active) {
        return;
      }
      console.error("Failed to seed knowledge base", error);
      setFeedback("Failed to initialize knowledge base. Check logs for details.");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const state = location.state as KnowledgeBaseLocationState | null;
    if (state?.articleId) {
      setSelectedId(state.articleId);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const articleQuery = useQuery({
    queryKey: ["knowledge-base", filters],
    queryFn: () => fetchKnowledgeArticles(filters),
    staleTime: 5 * 60 * 1000,
  });

  const totalsQuery = useQuery({
    queryKey: ["knowledge-base", "count"],
    queryFn: countKnowledgeArticles,
    staleTime: 5 * 60 * 1000,
  });

  const waitIfPaused = async () => {
    if (!pausedRef.current) {
      return;
    }

    await new Promise<void>((resolve) => {
      pauseResolverRef.current = () => {
        pauseResolverRef.current = null;
        resolve();
      };
    });
  };

  const handlePauseImport = () => {
    if (!importProgress || importProgress.status !== "running") {
      return;
    }
    pausedRef.current = true;
    setImportProgress((prev) => (prev ? { ...prev, status: "paused" } : prev));
  };

  const handleResumeImport = () => {
    if (!importProgress || importProgress.status !== "paused") {
      return;
    }
    pausedRef.current = false;
    const resolver = pauseResolverRef.current;
    pauseResolverRef.current = null;
    resolver?.();
    setImportProgress((prev) => (prev ? { ...prev, status: "running" } : prev));
  };

  const handleCancelImport = () => {
    if (!abortControllerRef.current) {
      return;
    }

    abortControllerRef.current.abort();

    const resolver = pauseResolverRef.current;
    pauseResolverRef.current = null;
    resolver?.();

    pausedRef.current = false;
    setImportProgress(null);
  };

  const saveArticle = useMutation({
    mutationFn: (payload: UpsertKnowledgeArticleInput) => upsertKnowledgeArticle(payload),
    onSuccess: (article) => {
      setFeedback(`Saved “${article.title}”`);
      setEditorState({ open: false, draft: { ...emptyDraft } });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      setSelectedId(article.id);
    },
    onError: (error) => {
      console.error("Failed to save article", error);
      setFeedback(error instanceof Error ? error.message : "Failed to save article");
    },
  });

  const removeArticle = useMutation({
    mutationFn: deleteKnowledgeArticle,
    onSuccess: () => {
      setFeedback("Article removed");
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      setSelectedId(null);
    },
    onError: (error) => {
      console.error("Failed to delete article", error);
      setFeedback(error instanceof Error ? error.message : "Failed to delete article");
    },
  });

  const processImportResult = useCallback(
    async (result: ImportMutationResult | null) => {
      if (!result || result.cancelled) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["knowledge-base"] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-base", "count"] }),
      ]);

      if (result.errors.length) {
        await recordKnowledgeBaseImportErrors(result.errors);
        await queryClient.invalidateQueries({ queryKey: ["knowledge-base", "import-errors"] });
      }

      const importedCount = result.saved.length;
      const skippedCount = result.errors.length;

      const parts: string[] = [];
      if (importedCount > 0) {
        parts.push(`Imported ${importedCount} article${importedCount === 1 ? "" : "s"}`);
      }
      if (skippedCount > 0) {
        parts.push(`${skippedCount} file${skippedCount === 1 ? "" : "s"} skipped`);
        console.warn("Knowledge base import issues", result.errors);
        setImportIssues(result.errors);
      } else {
        setImportIssues(null);
      }
      if (parts.length === 0) {
        parts.push("No articles imported");
      }

      setFeedback(parts.join(" · "));
      if (importedCount > 0) {
        setSelectedId(result.saved[0]?.id ?? null);
      }
    },
    [queryClient]
  );

  const importArticles = useMutation<ImportMutationResult>({
    mutationFn: async () => {
      const selection = await promptKnowledgeBaseImport();
      if (!selection) {
        return { cancelled: true, saved: [], errors: [] };
      }

      const { saved, errors } = await importKnowledgeBaseArticles(selection.drafts, upsertKnowledgeArticle);

      return {
        cancelled: false,
        saved,
        errors: [...selection.errors, ...errors],
      };
    },
    onSuccess: async (result) => {
      await processImportResult(result);
    },
    onError: (error) => {
      console.error("Failed to import articles", error);
      setFeedback(error instanceof Error ? error.message : "Failed to import articles");
    },
  });

  const retryImport = useMutation<KnowledgeArticleRecord, unknown, KnowledgeBaseImportErrorRecord>({
    mutationFn: async (issue) => {
      const draft = await loadKnowledgeBaseDraft(issue.path);
      const article = await upsertKnowledgeArticle(draft.payload);
      await deleteKnowledgeBaseImportError(issue.id);
      return article;
    },
    onSuccess: async (article) => {
      setFeedback(`Imported “${article.title}”`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["knowledge-base"] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-base", "count"] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-base", "import-errors"] }),
      ]);
      setSelectedId(article.id);
    },
    onError: async (error, issue) => {
      const reason = error instanceof Error ? error.message : "Failed to import file";
      await recordKnowledgeBaseImportErrors([{ path: issue.path, reason }]);
      await queryClient.invalidateQueries({ queryKey: ["knowledge-base", "import-errors"] });
      setFeedback(reason);
    },
    onSettled: () => {
      setRetryingId(null);
    },
  });

  const clearImportErrorsMutation = useMutation({
    mutationFn: clearKnowledgeBaseImportErrors,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge-base", "import-errors"] });
    },
    onSettled: () => {
      abortControllerRef.current = null;
      pausedRef.current = false;
      const resolver = pauseResolverRef.current;
      pauseResolverRef.current = null;
      resolver?.();
      setImportProgress(null);
    },
  });

  const handleDroppedPaths = useCallback(
    async (paths: string[]) => {
      if (!paths.length) {
        return;
      }
      try {
        const selection = await collectKnowledgeBaseDraftsFromPaths(paths);
        const combinedErrors = [...selection.errors];
        let savedArticles: KnowledgeArticleRecord[] = [];
        if (selection.drafts.length > 0) {
          const result = await importKnowledgeBaseArticles(selection.drafts, upsertKnowledgeArticle);
          savedArticles = result.saved;
          combinedErrors.push(...result.errors);
        }

        await processImportResult({
          cancelled: false,
          saved: savedArticles,
          errors: combinedErrors,
        });
      } catch (error) {
        console.error("Knowledge base drop import failed", error);
        setFeedback(error instanceof Error ? error.message : "Failed to import dropped files");
      }
    },
    [processImportResult, upsertKnowledgeArticle]
  );

  useEffect(() => {
    const element = stageElementRef.current;
    if (!element) {
      return undefined;
    }

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      try {
        const platform = await getPlatform();
        if (disposed) {
          return;
        }
        cleanup = platform.drop.registerDropTarget(element, {
          onHover: () => setDropActive(true),
          onLeave: () => setDropActive(false),
          onDrop: (paths) => {
            setDropActive(false);
            void handleDroppedPaths(paths);
          },
        });
      } catch (error) {
        console.error("Failed to register knowledge base drop target", error);
      }
    })();

    return () => {
      disposed = true;
      setDropActive(false);
      cleanup?.();
    };
  }, [handleDroppedPaths]);

  const handleImport = () => {
    setFeedback(null);
    importArticles.mutate();
  };

  const articles = articleQuery.data ?? [];

  useEffect(() => {
    if (!articles.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && articles.some((article) => article.id === selectedId)) {
      return;
    }
    setSelectedId(articles[0]?.id ?? null);
  }, [articles, selectedId]);

  const activeArticle = useMemo<KnowledgeArticleRecord | null>(() => {
    if (!articles.length) {
      return null;
    }
    if (!selectedId) {
      return articles[0];
    }
    return articles.find((article) => article.id === selectedId) ?? articles[0];
  }, [articles, selectedId]);

  const relatedAssetsQuery = useQuery({
    queryKey: [
      "knowledge-base",
      "article-assets",
      activeArticle?.id ?? "none",
      activeArticle?.related_asset_ids.join(",") ?? "",
    ],
    queryFn: () =>
      activeArticle && activeArticle.related_asset_ids.length
        ? lookupAssetReferenceSummaries(activeArticle.related_asset_ids)
        : Promise.resolve([] as AssetReferenceSummary[]),
    enabled: Boolean(activeArticle && activeArticle.related_asset_ids.length),
    staleTime: 5 * 60 * 1000,
  });

  const relatedAssets = relatedAssetsQuery.data ?? [];
  const relatedAssetError = relatedAssetsQuery.isError
    ? (relatedAssetsQuery.error as Error)
    : null;

  const categories = useMemo(() => {
    const tally = new Map<string, number>();
    for (const article of articles) {
      const key = article.category ?? "Uncategorized";
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    return Array.from(tally.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
    );
  }, [articles]);

  const availableTags = useMemo(() => {
    const tally = new Map<string, number>();
    for (const article of articles) {
      for (const tag of article.tags) {
        tally.set(tag, (tally.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
      .slice(0, 30);
  }, [articles]);

  const assetOptions = assetOptionsQuery.data ?? [];
  const assetOptionMap = useMemo(() => {
    return new Map(assetOptions.map((option) => [option.asset_id, option] as const));
  }, [assetOptions]);
  const selectedAssetIds = editorState.draft.relatedAssetIds ?? [];

  const updateDraft = (update: Partial<UpsertKnowledgeArticleInput>) => {
    setEditorState((prev) => ({
      ...prev,
      draft: {
        ...prev.draft,
        ...update,
      },
    }));
  };

  const handleRetry = (issue: KnowledgeBaseImportErrorRecord) => {
    setRetryingId(issue.id);
    retryImport.mutate(issue);
  };

  const handleDismissAll = () => {
    clearImportErrorsMutation.mutate(undefined, {
      onSuccess: () => setImportDrawerOpen(false),
    });
  };

  const openCreate = () => {
    setEditorState({ open: true, draft: { ...emptyDraft } });
    setFeedback(null);
  };

  const openEdit = (article: KnowledgeArticleRecord) => {
    setEditorState({
      open: true,
      editingId: article.id,
      draft: {
        id: article.id,
        title: article.title,
        category: article.category ?? "",
        summary: article.summary ?? "",
        content: article.content,
        tags: [...article.tags],
        source: article.source ?? "",
        relatedAssetIds: [...article.related_asset_ids],
      },
    });
    setFeedback(null);
  };

  const closeEditor = () => {
    if (saveArticle.isPending) {
      return;
    }
    setEditorState({ open: false, draft: { ...emptyDraft } });
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const trimmedTitle = editorState.draft.title?.trim() ?? "";
    const trimmedContent = editorState.draft.content?.trim() ?? "";
    const trimmedCategory = editorState.draft.category?.trim() ?? "";
    const trimmedSummary = editorState.draft.summary?.trim() ?? "";
    const trimmedSource = editorState.draft.source?.trim() ?? "";

    if (!trimmedTitle.length) {
      setFeedback("Title is required");
      return;
    }

    if (!trimmedContent.length) {
      setFeedback("Content cannot be empty");
      return;
    }

    const payload: UpsertKnowledgeArticleInput = {
      id: editorState.editingId,
      title: trimmedTitle,
      category: trimmedCategory.length ? trimmedCategory : null,
      summary: trimmedSummary.length ? trimmedSummary : null,
      content: trimmedContent,
      tags: editorState.draft.tags ?? [],
      source: trimmedSource.length ? trimmedSource : null,
      relatedAssetIds: editorState.draft.relatedAssetIds ?? [],
    };

    saveArticle.mutate(payload);
  };

  const handleDelete = async (article: KnowledgeArticleRecord) => {
    if (article.is_system) {
      return;
    }
    const confirmed = await confirmDialog({
      message: `Delete “${article.title}”? This cannot be undone.`,
      title: "Remove article",
      kind: "warning",
      okLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!confirmed) {
      return;
    }
    removeArticle.mutate(article.id);
  };

  const renderArticle = (
    article: KnowledgeArticleRecord | null,
    references: AssetReferenceSummary[],
    referencesLoading: boolean,
    referencesError: Error | null
  ) => {
    if (!article) {
      return (
        <div className="knowledge-base__empty">
          <h2>No article selected</h2>
          <p>Use the list on the left to browse knowledge base entries or create a new article.</p>
        </div>
      );
    }

    const paragraphs = article.content
      .split(/\r?\n\r?\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0);

    return (
      <article className="knowledge-base__article">
        <header className="knowledge-base__article-header">
          <div>
            <h1>{article.title}</h1>
            <div className="knowledge-base__pill-group">
              {(article.category ?? "") && <span className="knowledge-base__pill">{article.category}</span>}
              {(article.source ?? "") && (
                <span className="knowledge-base__pill knowledge-base__pill--muted">{article.source}</span>
              )}
              {article.is_system && <span className="knowledge-base__pill knowledge-base__pill--system">System</span>}
            </div>
          </div>
          <div className="knowledge-base__header-actions">
            {!article.is_system && (
              <>
                <button type="button" onClick={() => openEdit(article)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={removeArticle.isPending}
                  onClick={() => handleDelete(article)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </header>

        {article.summary && <p className="knowledge-base__summary">{article.summary}</p>}

        {referencesLoading && (
          <section className="knowledge-base__references knowledge-base__references--loading">
            <p>Loading jump references…</p>
          </section>
        )}

        {referencesError && (
          <section className="knowledge-base__references knowledge-base__references--error">
            <p>Failed to load jump references. {referencesError.message}</p>
          </section>
        )}

        {!referencesLoading && !referencesError && references.length > 0 && (
          <section className="knowledge-base__references">
            <h2>Referenced in Jump Hub</h2>
            <div className="knowledge-base__reference-list">
              {references.map((reference) => (
                <button
                  key={reference.asset_id}
                  type="button"
                  className="knowledge-base__reference-chip"
                  onClick={() => handleNavigateToAsset(reference)}
                >
                  <span>{reference.asset_name}</span>
                  <small>{reference.jump_title}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {article.tags.length > 0 && (
          <ul className="knowledge-base__tag-list">
            {article.tags.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  className={
                    tagFilter === tag
                      ? "knowledge-base__tag knowledge-base__tag--active"
                      : "knowledge-base__tag"
                  }
                  onClick={() => setTagFilter((prev) => (prev === tag ? null : tag))}
                >
                  <span className="knowledge-base__tag-icon" aria-hidden="true">
                    <TagIcon />
                  </span>
                  <span>#{tag}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <section className="knowledge-base__content">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>

        <footer className="knowledge-base__footer">
          <small>
            Created {formatDate(article.created_at)} · Updated {formatDate(article.updated_at)}
          </small>
        </footer>
      </article>
    );
  };

  return (
    <div className="knowledge-base">
      <aside className="knowledge-base__sidebar">
        <div className="knowledge-base__sidebar-header">
          <h2>Knowledge Base</h2>
          <p>{totalsQuery.data ?? 0} articles</p>
        </div>

        <div className="knowledge-base__search">
          <input
            type="search"
            placeholder="Search by title, content, or tags"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search.length > 0 && (
            <button type="button" className="ghost" onClick={() => setSearch("")}>
              Clear
            </button>
          )}
        </div>

        <section className="knowledge-base__filters">
          <div className="knowledge-base__filter-group">
            <header>
              <h3>Categories</h3>
              {categoryFilter && (
                <button type="button" className="link" onClick={() => setCategoryFilter(null)}>
                  Reset
                </button>
              )}
            </header>
            <ul>
              {categories.map(([category, total]) => (
                <li key={category}>
                  <button
                    type="button"
                    className={categoryFilter === category ? "active" : undefined}
                    onClick={() => setCategoryFilter((prev) => (prev === category ? null : category))}
                  >
                    <span className="knowledge-base__filter-icon" aria-hidden="true">
                      <FilterIcon />
                    </span>
                    <span className="knowledge-base__filter-label">{category}</span>
                    <span className="knowledge-base__badge">{total}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="knowledge-base__filter-group">
            <header>
              <h3>Tags</h3>
              {tagFilter && (
                <button type="button" className="link" onClick={() => setTagFilter(null)}>
                  Reset
                </button>
              )}
            </header>
            <ul className="knowledge-base__tag-cloud">
              {availableTags.map(([tag, total]) => (
                <li key={tag}>
                  <button
                    type="button"
                    className={tagFilter === tag ? "active" : undefined}
                    onClick={() => setTagFilter((prev) => (prev === tag ? null : tag))}
                  >
                    <span className="knowledge-base__filter-icon" aria-hidden="true">
                      <TagIcon />
                    </span>
                    <span className="knowledge-base__filter-label">#{tag}</span>
                    <span className="knowledge-base__badge">{total}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="knowledge-base__sidebar-actions">
          <button type="button" onClick={openCreate}>
            Add article
          </button>
          <button type="button" onClick={handleImport} disabled={importArticles.isPending}>
            {importArticles.isPending ? "Importing…" : "Import from file"}
          </button>
        </div>

        <div className="knowledge-base__list">
          {articleQuery.isLoading && <p>Loading knowledge base…</p>}
          {articleQuery.isError && (
            <p className="error">
              Failed to load knowledge base. {(articleQuery.error as Error)?.message ?? "Please try again."}
            </p>
          )}
          {!articleQuery.isLoading && !articles.length && <p>No articles match the current filters.</p>}
          <ul>
            {articles.map((article) => (
              <li key={article.id}>
                <button
                  type="button"
                  className={selectedId === article.id ? "active" : undefined}
                  onClick={() => setSelectedId(article.id)}
                >
                  <h4>{article.title}</h4>
                  <div className="knowledge-base__list-meta">
                    <span>{article.category ?? "Uncategorized"}</span>
                    <span>{article.tags.slice(0, 3).map((tag) => `#${tag}`).join(" ")}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section
        ref={stageElementRef}
        className={
          isDropActive ? "knowledge-base__stage knowledge-base__stage--drop" : "knowledge-base__stage"
        }
      >
        {isDropActive && (
          <div className="knowledge-base__drop-indicator" role="status" aria-live="polite">
            <strong>Drop PDFs or text files to import articles</strong>
          </div>
        )}
        {feedback && <div className="knowledge-base__feedback">{feedback}</div>}
        {hasImportErrors && (
          <>
            {!importDrawerOpen && (
              <button
                type="button"
                className="knowledge-base__import-toggle"
                onClick={() => setImportDrawerOpen(true)}
              >
                Show failed imports ({importErrors.length})
              </button>
            )}
            <aside
              className="knowledge-base__import-drawer"
              data-open={importDrawerOpen ? "true" : "false"}
              role="complementary"
              aria-label="Failed knowledge base imports"
              aria-live="polite"
            >
              <header>
                <div>
                  <h3>Failed imports</h3>
                  <p>We couldn't import these files. Resolve each issue and retry.</p>
                </div>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setImportDrawerOpen(false)}
                  aria-label="Hide failed imports"
                >
                  Hide
                </button>
              </header>
              <ul>
                {importErrors.map((issue) => {
                  const isRetrying = retryImport.isPending && retryingId === issue.id;
                  return (
                    <li key={issue.id}>
                      <div className="knowledge-base__import-details">
                        <code title={issue.path}>{issue.path}</code>
                        <span>{issue.reason}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRetry(issue)}
                        disabled={retryImport.isPending}
                      >
                        {isRetrying ? "Retrying…" : "Retry"}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <footer>
                <button
                  type="button"
                  className="ghost"
                  onClick={handleDismissAll}
                  disabled={clearImportErrorsMutation.isPending}
                >
                  Dismiss all
                </button>
              </footer>
            </aside>
          </>
        )}
        {articleQuery.isLoading && <p>Loading knowledge base…</p>}
        {!articleQuery.isLoading && renderArticle(activeArticle)}
      </section>

      {importProgress && importArticles.isPending && (
        <div className="knowledge-base__progress-backdrop" role="presentation">
          <div
            className="knowledge-base__progress-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="knowledge-base-import-progress-title"
          >
            <header>
              <h3 id="knowledge-base-import-progress-title">Importing articles</h3>
              <p>{importProgress.status === "paused" ? "Import paused" : "Import in progress"}</p>
            </header>

            <div className="knowledge-base__progress-status">
              <div
                className="knowledge-base__progress-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={importProgress.total}
                aria-valuenow={importProgress.processed}
              >
                <div
                  className="knowledge-base__progress-bar-fill"
                  style={{
                    width:
                      importProgress.total === 0
                        ? "0%"
                        : `${Math.min(100, Math.round((importProgress.processed / importProgress.total) * 100))}%`,
                  }}
                />
              </div>

              <p className="knowledge-base__progress-counts">
                Processed {importProgress.processed} of {importProgress.total}
                {importProgress.failed > 0 && ` · ${importProgress.failed} failed`}
              </p>

              {importProgress.currentPath && (
                <p className="knowledge-base__progress-path">
                  Working on <code title={importProgress.currentPath}>{importProgress.currentPath}</code>
                </p>
              )}
            </div>

            <footer>
              {importProgress.status === "paused" ? (
                <button type="button" onClick={handleResumeImport}>
                  Resume
                </button>
              ) : (
                <button type="button" onClick={handlePauseImport}>
                  Pause
                </button>
              )}
              <button type="button" className="ghost" onClick={handleCancelImport}>
                Cancel
              </button>
            </footer>
          </div>
        </div>
      )}

      {editorState.open && (
        <div className="knowledge-base__editor-backdrop" role="presentation" onClick={closeEditor}>
          <div
            className="knowledge-base__editor"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h3>{editorState.editingId ? "Edit article" : "New article"}</h3>
            </header>

            <form onSubmit={handleSubmit}>
              <label>
                Title
                <input
                  required
                  name="title"
                  value={editorState.draft.title ?? ""}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                />
              </label>

              <label>
                Category
                <input
                  name="category"
                  value={editorState.draft.category ?? ""}
                  onChange={(event) => updateDraft({ category: event.target.value })}
                />
              </label>

              <label>
                Summary
                <textarea
                  name="summary"
                  rows={2}
                  value={editorState.draft.summary ?? ""}
                  onChange={(event) => updateDraft({ summary: event.target.value })}
                />
              </label>

              <label>
                Content
                <textarea
                  required
                  name="content"
                  rows={10}
                  value={editorState.draft.content ?? ""}
                  onChange={(event) => updateDraft({ content: event.target.value })}
                />
              </label>

              <label>
                Tags (comma separated)
                <input
                  name="tags"
                  value={toTagInput(editorState.draft.tags)}
                  onChange={(event) => updateDraft({ tags: parseTags(event.target.value) })}
                />
              </label>

              <label>
                Source
                <input
                  name="source"
                  value={editorState.draft.source ?? ""}
                  onChange={(event) => updateDraft({ source: event.target.value })}
                />
              </label>

              <section className="knowledge-base__editor-references">
                <header>
                  <h4>Jump Hub assets</h4>
                  <p>Link this article to specific perks, items, or drawbacks.</p>
                </header>
                {assetOptionsQuery.isLoading ? (
                  <p className="knowledge-base__editor-references-status">Loading assets…</p>
                ) : assetOptionsQuery.isError ? (
                  <p className="knowledge-base__editor-references-status">
                    Failed to load assets. {(assetOptionsQuery.error as Error).message}
                  </p>
                ) : assetOptions.length === 0 ? (
                  <p className="knowledge-base__editor-references-status">
                    Add jump assets in the Jump Hub to enable cross-links.
                  </p>
                ) : (
                  <>
                    <div className="knowledge-base__editor-reference-chips">
                      {selectedAssetIds.map((assetId) => {
                        const summary = assetOptionMap.get(assetId);
                        return (
                          <span key={assetId} className="knowledge-base__editor-reference-chip">
                            <strong>{summary?.asset_name ?? "Unknown asset"}</strong>
                            <small>{summary?.jump_title ?? "Unavailable"}</small>
                            <button
                              type="button"
                              aria-label={`Remove ${summary?.asset_name ?? assetId}`}
                              onClick={() => removeAssetReference(assetId)}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                      {selectedAssetIds.length === 0 && (
                        <p className="knowledge-base__editor-references-status">
                          No assets linked yet.
                        </p>
                      )}
                    </div>
                    {assetOptions.length > selectedAssetIds.length && (
                      <label className="knowledge-base__editor-reference-select">
                        <span>Add reference</span>
                        <select
                          value=""
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            if (value) {
                              addAssetReference(value);
                              event.currentTarget.value = "";
                            }
                          }}
                        >
                          <option value="">Select an asset…</option>
                          {assetOptions
                            .filter((option) => !selectedAssetIds.includes(option.asset_id))
                            .map((option) => (
                              <option key={option.asset_id} value={option.asset_id}>
                                {option.asset_name} · {option.jump_title}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </>
                )}
              </section>

              <footer>
                <button type="button" className="ghost" onClick={closeEditor} disabled={saveArticle.isPending}>
                  Cancel
                </button>
                <button type="submit" disabled={saveArticle.isPending}>
                  {saveArticle.isPending ? "Saving…" : "Save"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;