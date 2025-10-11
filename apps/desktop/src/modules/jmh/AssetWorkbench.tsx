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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createJumpAsset,
  deleteEntity,
  deleteJumpAsset,
  lookupKnowledgeArticleSummaries,
  listJumpAssets,
  summarizeJumpBudget,
  updateJumpAsset,
  reorderJumpAssets,
  upsertEntity,
  loadFormatterSettings,
  type JumpAssetRecord,
  type JumpAssetType,
  type KnowledgeArticleReferenceSummary,
} from "../../db/dao";
import { formatBudget } from "../../services/formatter";
import { confirmDialog } from "../../services/dialogService";
import { useJmhStore } from "./store";
import {
  ASSET_TYPE_LABELS,
  assetToEntity,
  buildAssetMetadata,
  parseAssetMetadata,
  type AssetMetadata,
  type StipendFrequency,
  type StipendMetadata,
} from "./assetUtils";

const assetTypeOrder: JumpAssetType[] = ["origin", "perk", "item", "companion", "drawback"];

interface AssetFormState {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  cost: number;
  quantity: number;
  discounted: boolean;
  freebie: boolean;
  notes: string;
  traitTags: string[];
  stipendBase: number;
  stipendFrequency: StipendFrequency;
  stipendPeriods: number;
  stipendNotes: string;
}

const createFormState = (asset: JumpAssetRecord): AssetFormState => {
  const metadata = parseAssetMetadata(asset);
  return {
    id: asset.id,
    name: asset.name,
    category: asset.category ?? "",
    subcategory: asset.subcategory ?? "",
    cost: asset.cost ?? 0,
    quantity: asset.quantity ?? 1,
    discounted: asset.discounted === 1,
    freebie: asset.freebie === 1,
    notes: asset.notes ?? "",
    traitTags: metadata.traitTags,
    stipendBase: metadata.stipend?.base ?? 0,
    stipendFrequency: metadata.stipend?.frequency ?? "once",
    stipendPeriods: metadata.stipend?.periods ?? 1,
    stipendNotes: metadata.stipend?.notes ?? "",
  };
};

const shouldPersistStipend = (form: AssetFormState): boolean => {
  return (
    Math.abs(form.stipendBase) > 0 ||
    form.stipendNotes.trim().length > 0 ||
    (form.stipendFrequency !== "once" && form.stipendPeriods > 1)
  );
};

export const AssetWorkbench: React.FC = () => {
  const queryClient = useQueryClient();
  const jumps = useJmhStore((state) => state.jumps);
  const selectedJumpId = useJmhStore((state) => state.selectedJumpId);
  const setSelectedJump = useJmhStore((state) => state.setSelectedJump);
  const setEntities = useJmhStore((state) => state.setEntities);
  const activeType = useJmhStore((state) => state.activeAssetType);
  const setActiveType = useJmhStore((state) => state.setActiveAssetType);
  const selectedAssetId = useJmhStore((state) => state.selectedAssetId);
  const setSelectedAssetId = useJmhStore((state) => state.setSelectedAssetId);

  const [formState, setFormState] = useState<AssetFormState | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const navigate = useNavigate();

  const selectedJump = useMemo(
    () => jumps.find((jump) => jump.id === selectedJumpId) ?? null,
    [jumps, selectedJumpId],
  );

  const formatterSettingsQuery = useQuery({
    queryKey: ["app-settings", "formatter"],
    queryFn: loadFormatterSettings,
  });

  const budgetQuery = useQuery({
    queryKey: ["jump-budget", selectedJumpId],
    queryFn: async () => {
      if (!selectedJumpId) {
        return null;
      }
      return summarizeJumpBudget(selectedJumpId);
    },
    enabled: Boolean(selectedJumpId),
  });

  const assetsQuery = useQuery({
    queryKey: ["jump-assets", selectedJumpId],
    queryFn: () => (selectedJumpId ? listJumpAssets(selectedJumpId) : Promise.resolve([] as JumpAssetRecord[])),
    enabled: Boolean(selectedJumpId),
  });

  const assetsByType = useMemo(() => {
    const map = new Map<JumpAssetType, JumpAssetRecord[]>();
    for (const type of assetTypeOrder) {
      map.set(type, []);
    }
    for (const asset of assetsQuery.data ?? []) {
      const bucket = map.get(asset.asset_type) ?? [];
      bucket.push(asset);
      map.set(asset.asset_type, bucket);
    }
    return map;
  }, [assetsQuery.data]);

  const currentAssets = assetsByType.get(activeType) ?? [];
  const selectedAsset = useMemo(
    () => currentAssets.find((asset) => asset.id === selectedAssetId) ?? null,
    [currentAssets, selectedAssetId],
  );

  const knowledgeReferencesQuery = useQuery({
    queryKey: [
      "jump-assets",
      "knowledge-links",
      selectedAsset?.id ?? "none",
      selectedAsset?.knowledge_article_ids.join(",") ?? "",
    ],
    queryFn: () =>
      selectedAsset && selectedAsset.knowledge_article_ids.length
        ? lookupKnowledgeArticleSummaries(selectedAsset.knowledge_article_ids)
        : Promise.resolve([] as KnowledgeArticleReferenceSummary[]),
    enabled: Boolean(selectedAsset && selectedAsset.knowledge_article_ids.length),
    staleTime: 5 * 60 * 1000,
  });
  const knowledgeReferences = knowledgeReferencesQuery.data ?? [];
  const knowledgeReferenceError = knowledgeReferencesQuery.isError
    ? (knowledgeReferencesQuery.error as Error)
    : null;

  const openKnowledgeArticle = (reference: KnowledgeArticleReferenceSummary) => {
    navigate("/knowledge", { state: { articleId: reference.id } });
  };

  useEffect(() => {
    if (!selectedAssetId) {
      return;
    }
    const allAssets = assetsQuery.data ?? [];
    const match = allAssets.find((asset) => asset.id === selectedAssetId);
    if (match && match.asset_type !== activeType) {
      setActiveType(match.asset_type);
    }
  }, [activeType, assetsQuery.data, selectedAssetId, setActiveType]);

  useEffect(() => {
    if (!selectedJumpId && jumps.length > 0) {
      setSelectedJump(jumps[0].id);
    }
  }, [jumps, selectedJumpId, setSelectedJump]);

  useEffect(() => {
    if (assetsQuery.isLoading) {
      return;
    }
    if (!currentAssets.length) {
      const pendingMatch = (assetsQuery.data ?? []).find((asset) => asset.id === selectedAssetId);
      if (pendingMatch && pendingMatch.asset_type !== activeType) {
        return;
      }
      setSelectedAssetId(null);
      setFormState(null);
      return;
    }
    if (!selectedAssetId || !currentAssets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(currentAssets[0].id);
    }
  }, [activeType, assetsQuery.data, assetsQuery.isLoading, currentAssets, selectedAssetId, setSelectedAssetId]);

  useEffect(() => {
    if (!selectedAsset) {
      setFormState(null);
      setTagDraft("");
      return;
    }
    setFormState(createFormState(selectedAsset));
    setTagDraft("");
  }, [selectedAsset?.id, selectedAsset?.updated_at]);

  const formatValue = useCallback(
    (value: number) => {
      const separator = formatterSettingsQuery.data?.thousandsSeparator ?? "none";
      return formatBudget(value, separator);
    },
    [formatterSettingsQuery.data?.thousandsSeparator],
  );

  const invalidateAfterMutation = useCallback(
    (jumpId: string, assetType?: JumpAssetType) => {
      queryClient.invalidateQueries({ queryKey: ["jump-assets", jumpId] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["jump-budget", jumpId] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["export-snapshot"] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["analytics-snapshot"] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["jmh-snapshot"] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["passport-derived"] }).catch(() => undefined);
      if (assetType === "drawback") {
        queryClient.invalidateQueries({ queryKey: ["jump-drawbacks", jumpId] }).catch(() => undefined);
      }
    },
    [queryClient],
  );

  const mergeEntityIntoStore = useCallback(
    (asset: JumpAssetRecord) => {
      const entity = assetToEntity(asset);
      const current = useJmhStore.getState().entities;
      const next = current.filter((item) => item.id !== entity.id);
      next.push(entity);
      setEntities(next);
    },
    [setEntities],
  );

  const removeEntityFromStore = useCallback(
    (id: string) => {
      const current = useJmhStore.getState().entities;
      const next = current.filter((item) => item.id !== id);
      if (next.length !== current.length) {
        setEntities(next);
      }
    },
    [setEntities],
  );

  const createMutation = useMutation({
    mutationFn: async (type: JumpAssetType) => {
      if (!selectedJumpId) {
        throw new Error("Select a jump before adding assets");
      }
      const label = ASSET_TYPE_LABELS[type];
      return createJumpAsset({
        jump_id: selectedJumpId,
        asset_type: type,
        name: `New ${label.slice(0, -1)}`,
        cost: 0,
        quantity: 1,
      });
    },
    onSuccess: (asset) => {
      if (selectedJumpId) {
        invalidateAfterMutation(selectedJumpId, asset.asset_type);
      }
      mergeEntityIntoStore(asset);
      void upsertEntity(assetToEntity(asset));
      setActiveType(asset.asset_type);
      setSelectedAssetId(asset.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; updates: Parameters<typeof updateJumpAsset>[1] }) => {
      const updated = await updateJumpAsset(payload.id, payload.updates);
      await upsertEntity(assetToEntity(updated));
      return updated;
    },
    onSuccess: (asset) => {
      if (selectedJumpId) {
        invalidateAfterMutation(selectedJumpId, asset.asset_type);
      }
      mergeEntityIntoStore(asset);
      setActiveType(asset.asset_type);
      setSelectedAssetId(asset.id);
      setFormState(createFormState(asset));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payload: { id: string; type: JumpAssetType }) => {
      await deleteJumpAsset(payload.id);
      await deleteEntity(payload.id).catch(() => undefined);
      return payload;
    },
    onSuccess: ({ id, type }) => {
      if (selectedJumpId) {
        invalidateAfterMutation(selectedJumpId, type);
      }
      removeEntityFromStore(id);
      setSelectedAssetId(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (payload: { jumpId: string; type: JumpAssetType; orderedIds: string[] }) =>
      reorderJumpAssets(payload.jumpId, payload.type, payload.orderedIds),
    onSuccess: (_, payload) => {
      invalidateAfterMutation(payload.jumpId, payload.type);
    },
  });

  const mutateForm = useCallback(<K extends keyof AssetFormState>(key: K, value: AssetFormState[K]) => {
    setFormState((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const handleSave = () => {
    if (!formState) return;
    const periods = Math.max(formState.stipendPeriods, 1);
    const stipendTotalValue =
      formState.stipendFrequency === "once"
        ? formState.stipendBase
        : formState.stipendBase * periods;

    const stipend: StipendMetadata | null = shouldPersistStipend(formState)
      ? {
          base: formState.stipendBase,
          frequency: formState.stipendFrequency,
          periods,
          total: stipendTotalValue,
          notes: formState.stipendNotes ? formState.stipendNotes.trim() : undefined,
        }
      : null;

    const metadata: AssetMetadata = {
      traitTags: formState.traitTags,
      stipend,
    };

    updateMutation.mutate({
      id: formState.id,
      updates: {
        name: formState.name.trim() || "Unnamed Asset",
        category: formState.category.trim() || null,
        subcategory: formState.subcategory.trim() || null,
        cost: Number.isFinite(formState.cost) ? formState.cost : 0,
        quantity: Number.isFinite(formState.quantity) ? Math.max(formState.quantity, 1) : 1,
        discounted: formState.discounted,
        freebie: formState.freebie,
        notes: formState.notes.trim() || null,
        metadata: buildAssetMetadata(metadata),
      },
    });
  };

  const handleReorder = (assetId: string, direction: -1 | 1) => {
    if (!selectedJumpId) return;
    const list = [...currentAssets];
    const index = list.findIndex((asset) => asset.id === assetId);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const [entry] = list.splice(index, 1);
    list.splice(target, 0, entry);
    reorderMutation.mutate({
      jumpId: selectedJumpId,
      type: activeType,
      orderedIds: list.map((asset) => asset.id),
    });
    setSelectedAssetId(entry.id);
  };

  const handleDelete = async () => {
    if (!formState) return;
    const confirmed = await confirmDialog({
      title: "Remove Asset",
      message: "This will delete the selected asset and its stipend metadata. Continue?",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate({ id: formState.id, type: activeType });
  };

  const stipendTotal = useMemo(() => {
    if (!formState) return 0;
    const base = formState.stipendBase;
    if (!Number.isFinite(base)) {
      return 0;
    }
    if (formState.stipendFrequency === "once") {
      return base;
    }
    return base * Math.max(formState.stipendPeriods, 1);
  }, [formState]);

  return (
    <section className="hub-build">
      <header className="hub-build__header">
        <div>
          <h2>Build Ledger</h2>
          <p>Track origins, purchases, and drawbacks for the active jump.</p>
        </div>
        <div className="hub-build__controls">
          <label className="hub-build__jump-select">
            <span>Active Jump</span>
            <select
              value={selectedJumpId ?? ""}
              onChange={(event) => {
                setSelectedAssetId(null);
                setFormState(null);
                setSelectedJump(event.target.value || null);
              }}
            >
              {jumps.length === 0 && <option value="">No jumps available</option>}
              {jumps.length > 0 && <option value="">Select a jump…</option>}
              {jumps.map((jump) => (
                <option key={jump.id} value={jump.id}>
                  {jump.title}
                </option>
              ))}
            </select>
          </label>
          {selectedJump && (
            <div className="hub-build__budget">
              <div>
                <span>Budget</span>
                <strong>{formatValue(selectedJump.cp_budget ?? 0)}</strong>
              </div>
              <div>
                <span>Spent</span>
                <strong>{formatValue(selectedJump.cp_spent ?? 0)}</strong>
              </div>
              <div>
                <span>Credit</span>
                <strong>{formatValue(selectedJump.cp_income ?? 0)}</strong>
              </div>
              {budgetQuery.data && (
                <div>
                  <span>Balance</span>
                  <strong className={budgetQuery.data.balance < 0 ? "negative" : undefined}>
                    {formatValue(budgetQuery.data.balance)}
                  </strong>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {!selectedJumpId ? (
        <p className="hub-build__empty">Select a jump to begin managing its assets.</p>
      ) : (
        <>
          <div className="asset-tabs">
            <nav>
              {assetTypeOrder.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={type === activeType ? "active" : ""}
                  onClick={() => {
                    setActiveType(type);
                    setSelectedAssetId(null);
                  }}
                >
                  {ASSET_TYPE_LABELS[type]}
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => createMutation.mutate(activeType)}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Adding…" : `Add ${ASSET_TYPE_LABELS[activeType].slice(0, -1)}`}
            </button>
          </div>

          <div className="asset-board">
            <div className="asset-board__list">
              {assetsQuery.isLoading ? (
                <p className="asset-board__empty">Loading assets…</p>
              ) : currentAssets.length === 0 ? (
                <div className="asset-board__empty">
                  <p>No {ASSET_TYPE_LABELS[activeType].toLowerCase()} recorded yet.</p>
                  <button
                    type="button"
                    onClick={() => createMutation.mutate(activeType)}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Adding…" : `Add ${ASSET_TYPE_LABELS[activeType].slice(0, -1)}`}
                  </button>
                </div>
              ) : (
                <ul>
                  {currentAssets.map((asset, index) => {
                    const isSelected = asset.id === selectedAssetId;
                    return (
                      <li key={asset.id} className={isSelected ? "selected" : undefined}>
                        <button type="button" onClick={() => setSelectedAssetId(asset.id)}>
                          <span>{asset.name}</span>
                          <small>
                            {formatValue((asset.cost ?? 0) * Math.max(asset.quantity ?? 1, 1))}
                          </small>
                        </button>
                        <div className="asset-board__row-actions">
                          <button
                            type="button"
                            onClick={() => handleReorder(asset.id, -1)}
                            disabled={index === 0 || reorderMutation.isPending}
                            aria-label="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReorder(asset.id, 1)}
                            disabled={index === currentAssets.length - 1 || reorderMutation.isPending}
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="asset-board__details">
              {!formState ? (
                <p className="asset-board__empty">Select an asset to edit its details.</p>
              ) : (
                <form
                  className="asset-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSave();
                  }}
                >
                  <div className="asset-form__grid">
                    <label>
                      <span>Name</span>
                      <input
                        type="text"
                        value={formState.name}
                        onChange={(event) => mutateForm("name", event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      <span>Category</span>
                      <input
                        type="text"
                        value={formState.category}
                        onChange={(event) => mutateForm("category", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Subcategory</span>
                      <input
                        type="text"
                        value={formState.subcategory}
                        onChange={(event) => mutateForm("subcategory", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Cost</span>
                      <input
                        type="number"
                        value={formState.cost}
                        onChange={(event) => mutateForm("cost", Number(event.target.value))}
                      />
                    </label>
                    <label>
                      <span>Quantity</span>
                      <input
                        type="number"
                        min={1}
                        value={formState.quantity}
                        onChange={(event) => mutateForm("quantity", Math.max(Number(event.target.value), 1))}
                      />
                    </label>
                    <label className="asset-form__checkbox">
                      <input
                        type="checkbox"
                        checked={formState.discounted}
                        onChange={(event) => mutateForm("discounted", event.target.checked)}
                      />
                      <span>Discounted</span>
                    </label>
                    <label className="asset-form__checkbox">
                      <input
                        type="checkbox"
                        checked={formState.freebie}
                        onChange={(event) => mutateForm("freebie", event.target.checked)}
                      />
                      <span>Freebie</span>
                    </label>
                  </div>

                  <label className="asset-form__notes">
                    <span>Notes</span>
                    <textarea
                      value={formState.notes}
                      onChange={(event) => mutateForm("notes", event.target.value)}
                      rows={3}
                    />
                  </label>

                  <section className="asset-form__references">
                    <header>
                      <h3>Referenced in Knowledge Base</h3>
                      <p>Jump to related guidance articles for this asset.</p>
                    </header>
                    {knowledgeReferencesQuery.isLoading ? (
                      <p className="asset-form__references-status">Loading references…</p>
                    ) : knowledgeReferenceError ? (
                      <p className="asset-form__references-status">
                        Failed to load knowledge base links. {knowledgeReferenceError.message}
                      </p>
                    ) : knowledgeReferences.length === 0 ? (
                      <p className="asset-form__references-status">
                        This asset isn't linked to any knowledge base articles yet.
                      </p>
                    ) : (
                      <div className="asset-form__reference-chips">
                        {knowledgeReferences.map((reference) => (
                          <button
                            key={reference.id}
                            type="button"
                            className="asset-form__reference-chip"
                            onClick={() => openKnowledgeArticle(reference)}
                          >
                            <span>{reference.title}</span>
                            {reference.summary && <small>{reference.summary}</small>}
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="asset-form__tags">
                    <header>
                      <h3>Trait Tags</h3>
                      <p>Organize perks and items for search and stipend routing.</p>
                    </header>
                    <div className="asset-form__tag-list">
                      {formState.traitTags.map((tag) => (
                        <span key={tag} className="asset-tag">
                          {tag}
                          <button
                            type="button"
                            onClick={() =>
                              mutateForm(
                                "traitTags",
                                formState.traitTags.filter((entry) => entry !== tag),
                              )
                            }
                            aria-label={`Remove ${tag}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={tagDraft}
                        placeholder="Add tag"
                        onChange={(event) => setTagDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === ",") {
                            event.preventDefault();
                            const value = tagDraft.trim();
                            if (value && !formState.traitTags.includes(value)) {
                              mutateForm("traitTags", [...formState.traitTags, value]);
                            }
                            setTagDraft("");
                          }
                          if (event.key === "Backspace" && !tagDraft && formState.traitTags.length) {
                            mutateForm("traitTags", formState.traitTags.slice(0, -1));
                          }
                        }}
                      />
                    </div>
                  </section>

                  <section className="asset-form__stipend">
                    <header>
                      <h3>Stipend Calculator</h3>
                      <p>Estimate recurring income or refunds tied to this asset.</p>
                    </header>
                    <div className="asset-form__grid">
                      <label>
                        <span>Amount</span>
                        <input
                          type="number"
                          value={formState.stipendBase}
                          onChange={(event) => mutateForm("stipendBase", Number(event.target.value))}
                        />
                      </label>
                      <label>
                        <span>Frequency</span>
                        <select
                          value={formState.stipendFrequency}
                          onChange={(event) =>
                            mutateForm("stipendFrequency", event.target.value as StipendFrequency)
                          }
                        >
                          <option value="once">One-time</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </label>
                      <label>
                        <span>Periods</span>
                        <input
                          type="number"
                          min={1}
                          value={formState.stipendPeriods}
                          onChange={(event) =>
                            mutateForm("stipendPeriods", Math.max(Number(event.target.value), 1))
                          }
                          disabled={formState.stipendFrequency === "once"}
                        />
                      </label>
                    </div>
                    <label className="asset-form__notes">
                      <span>Stipend Notes</span>
                      <textarea
                        value={formState.stipendNotes}
                        onChange={(event) => mutateForm("stipendNotes", event.target.value)}
                        rows={2}
                        placeholder="Describe how this stipend accrues or who receives it."
                      />
                    </label>
                    <p className="asset-form__stipend-total">
                      Estimated total credit: <strong>{formatValue(stipendTotal)}</strong>
                    </p>
                  </section>

                  <div className="asset-form__actions">
                    <button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? "Saving…" : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void handleDelete()}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? "Removing…" : "Delete"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default AssetWorkbench;
