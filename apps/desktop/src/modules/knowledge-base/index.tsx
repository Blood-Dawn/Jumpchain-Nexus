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

import { useEffect, useMemo, useState } from "react";
import type { FormEventHandler } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import "./knowledgeBase.css";
import {
  countKnowledgeArticles,
  deleteKnowledgeArticle,
  ensureKnowledgeBaseSeeded,
  fetchKnowledgeArticles,
  listAssetReferenceSummaries,
  lookupAssetReferenceSummaries,
  upsertKnowledgeArticle,
  type KnowledgeArticleQuery,
  type KnowledgeArticleRecord,
  type AssetReferenceSummary,
  type UpsertKnowledgeArticleInput,
} from "../../db/dao";
import {
  importKnowledgeBaseArticles,
  promptKnowledgeBaseImport,
  type KnowledgeBaseImportError,
} from "../../services/knowledgeBaseImporter";
import { confirmDialog } from "../../services/dialogService";
import { useJmhStore } from "../jmh/store";

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

  const assetOptionsQuery = useQuery({
    queryKey: ["knowledge-base", "asset-options"],
    queryFn: listAssetReferenceSummaries,
    staleTime: 5 * 60 * 1000,
    enabled: editorState.open,
  });

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
      if (!result || result.cancelled) {
        setImportIssues(null);
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["knowledge-base"] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-base", "count"] }),
      ]);

      const importedCount = result.saved.length;
      const skippedCount = result.errors.length;

      const parts: string[] = [];
      if (importedCount > 0) {
        parts.push(`Imported ${importedCount} article${importedCount === 1 ? "" : "s"}`);
      }
      if (skippedCount > 0) {
        parts.push(`${skippedCount} file${skippedCount === 1 ? "" : "s"} skipped`);
        console.warn("Knowledge base import issues", result.errors);
      }
      if (parts.length === 0) {
        parts.push("No articles imported");
      }

      setFeedback(parts.join(" · "));
      setImportIssues(result.errors.length ? result.errors : null);

      if (importedCount > 0) {
        setSelectedId(result.saved[0]?.id ?? null);
      }
    },
    onError: (error) => {
      console.error("Failed to import articles", error);
      setFeedback(error instanceof Error ? error.message : "Failed to import articles");
      setImportIssues(null);
    },
  });

  const handleImport = () => {
    setFeedback(null);
    setImportIssues(null);
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

  const addAssetReference = (assetId: string) => {
    setEditorState((prev) => {
      const current = prev.draft.relatedAssetIds ?? [];
      if (current.includes(assetId)) {
        return prev;
      }
      return {
        ...prev,
        draft: {
          ...prev.draft,
          relatedAssetIds: [...current, assetId],
        },
      };
    });
  };

  const removeAssetReference = (assetId: string) => {
    setEditorState((prev) => {
      const current = prev.draft.relatedAssetIds ?? [];
      if (!current.includes(assetId)) {
        return prev;
      }
      return {
        ...prev,
        draft: {
          ...prev.draft,
          relatedAssetIds: current.filter((id) => id !== assetId),
        },
      };
    });
  };

  const handleNavigateToAsset = (summary: AssetReferenceSummary) => {
    setSelectedJump(summary.jump_id);
    setActiveAssetType(summary.asset_type);
    setSelectedAssetId(summary.asset_id);
    navigate("/hub");
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
                  #{tag}
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
                    {category}
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
                    #{tag}
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

      <section className="knowledge-base__stage">
        {feedback && <div className="knowledge-base__feedback">{feedback}</div>}
        {importIssues && (
          <div className="knowledge-base__import-issues" role="status" aria-live="polite">
            <header>
              <h3>Skipped files</h3>
              <p>We couldn't import the following resources. Resolve the issues and try again.</p>
            </header>
            <ul>
              {importIssues.map((issue) => (
                <li key={issue.path}>
                  <code title={issue.path}>{issue.path}</code>
                  <span>{issue.reason}</span>
                </li>
              ))}
            </ul>
            <footer>
              <button type="button" className="ghost" onClick={() => setImportIssues(null)}>
                Dismiss
              </button>
            </footer>
          </div>
        )}
        {articleQuery.isLoading && <p>Loading knowledge base…</p>}
        {!articleQuery.isLoading &&
          renderArticle(activeArticle, relatedAssets, relatedAssetsQuery.isLoading, relatedAssetError)}
      </section>

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