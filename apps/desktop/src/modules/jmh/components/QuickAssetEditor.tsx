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

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createJumpAsset,
  deleteJumpAsset,
  listJumpAssets,
  reorderJumpAssets,
  updateJumpAsset,
  type JumpAssetRecord,
  type JumpAssetType,
} from "../../../db/dao";
import {
  ASSET_TYPE_LABELS,
  buildAssetMetadata,
  computeStipendTotal,
  parseAssetMetadata,
  type AssetMetadata,
  type StipendFrequency,
} from "../assetUtils";

interface QuickAssetEditorProps {
  jumpId: string | null;
  title: string;
  assetTypes: JumpAssetType[];
  allowTypeSelection?: boolean;
  enabled?: boolean;
  formatCurrency?: (value: number) => string;
}

type AutosaveState = "idle" | "saving" | "saved" | "error";

type AssetFormState = {
  id: string;
  name: string;
  type: JumpAssetType;
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
  attributes: AssetMetadata["attributes"];
  altForms: AssetMetadata["altForms"];
};

const buildFormState = (asset: JumpAssetRecord): AssetFormState => {
  const metadata = parseAssetMetadata(asset);
  return {
    id: asset.id,
    name: asset.name,
    type: asset.asset_type,
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
    attributes: metadata.attributes.map((attribute) => ({ ...attribute })),
    altForms: metadata.altForms.map((form) => ({ ...form })),
  };
};

export const QuickAssetEditor: React.FC<QuickAssetEditorProps> = ({
  jumpId,
  title,
  assetTypes,
  allowTypeSelection = false,
  enabled = true,
  formatCurrency,
}) => {
  const queryClient = useQueryClient();
  const primaryType = assetTypes[0];
  const pluralLabel = primaryType ? ASSET_TYPE_LABELS[primaryType] ?? title : title;
  const singularLabel = pluralLabel.endsWith("s") ? pluralLabel.slice(0, -1) : pluralLabel;
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [formState, setFormState] = useState<AssetFormState | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");

  const assetsQuery = useQuery({
    queryKey: ["jump-assets", jumpId],
    queryFn: () => (jumpId ? listJumpAssets(jumpId) : Promise.resolve([] as JumpAssetRecord[])),
    enabled: Boolean(jumpId && enabled),
  });

  const filteredAssets = useMemo(() => {
    return (assetsQuery.data ?? []).filter((asset) => assetTypes.includes(asset.asset_type));
  }, [assetsQuery.data, assetTypes]);

  useEffect(() => {
    if (!jumpId || filteredAssets.length === 0) {
      setSelectedAssetId(null);
      setFormState(null);
      return;
    }
    if (!selectedAssetId || !filteredAssets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(filteredAssets[0]?.id ?? null);
    }
  }, [filteredAssets, jumpId, selectedAssetId]);

  useEffect(() => {
    if (!selectedAssetId) {
      setFormState(null);
      return;
    }
    const asset = filteredAssets.find((entry) => entry.id === selectedAssetId) ?? null;
    if (!asset) {
      setFormState(null);
      return;
    }
    setFormState(buildFormState(asset));
    setTagDraft("");
  }, [filteredAssets, selectedAssetId]);

  useEffect(() => {
    if (autosaveState !== "saved") {
      return;
    }
    const timer = window.setTimeout(() => setAutosaveState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [autosaveState]);

  const invalidateBudget = (jump: string | null | undefined, assetType?: JumpAssetType) => {
    if (!jump) return;
    queryClient.invalidateQueries({ queryKey: ["jump-budget", jump] }).catch(() => undefined);
    if (assetType === "drawback") {
      queryClient.invalidateQueries({ queryKey: ["jump-drawbacks", jump] }).catch(() => undefined);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (type: JumpAssetType) => {
      if (!type) {
        throw new Error("Asset type not configured");
      }
      if (!jumpId) {
        throw new Error("Jump not selected");
      }
      const label = ASSET_TYPE_LABELS[type] ?? "Asset";
      const singular = label.endsWith("s") ? label.slice(0, -1) : label;
      return createJumpAsset({
        jump_id: jumpId,
        asset_type: type,
        name: `New ${singular || "Asset"}`,
        cost: 0,
        quantity: 1,
      });
    },
    onSuccess: (asset) => {
      setSelectedAssetId(asset.id);
      invalidateBudget(jumpId, asset.asset_type);
      queryClient.invalidateQueries({ queryKey: ["jump-assets", jumpId] }).catch(() => undefined);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; updates: Parameters<typeof updateJumpAsset>[1] }) => {
      return updateJumpAsset(payload.id, payload.updates);
    },
    onMutate: async (payload) => {
      if (!jumpId) return undefined;
      setAutosaveState("saving");
      await queryClient.cancelQueries({ queryKey: ["jump-assets", jumpId] });
      const previous = queryClient.getQueryData<JumpAssetRecord[]>(["jump-assets", jumpId]);
      const previousAsset = previous?.find((asset) => asset.id === payload.id) ?? null;
      const optimisticTimestamp = new Date().toISOString();
      if (previous) {
        const optimistic = previous.map((asset) => {
          if (asset.id !== payload.id) {
            return asset;
          }
          const metadataUpdate =
            payload.updates.metadata === undefined
              ? asset.metadata
              : payload.updates.metadata === null
                ? null
                : JSON.stringify(payload.updates.metadata);
          return {
            ...asset,
            ...payload.updates,
            metadata: metadataUpdate,
            updated_at: optimisticTimestamp,
          };
        });
        queryClient.setQueryData(["jump-assets", jumpId], optimistic);
      }
      return { previous, previousAsset };
    },
    onSuccess: (asset, _variables, context) => {
      if (jumpId) {
        queryClient.setQueryData<JumpAssetRecord[]>(["jump-assets", jumpId], (current) => {
          if (!current) return current;
          return current.map((entry) => (entry.id === asset.id ? asset : entry));
        });
      }
      setFormState(buildFormState(asset));
      setAutosaveState("saved");
      if (context?.previousAsset && context.previousAsset.asset_type !== asset.asset_type) {
        invalidateBudget(jumpId, context.previousAsset.asset_type);
      }
      invalidateBudget(jumpId, asset.asset_type);
    },
    onError: (_error, _payload, context) => {
      if (jumpId && context?.previous) {
        queryClient.setQueryData(["jump-assets", jumpId], context.previous);
      }
      setAutosaveState("error");
    },
    onSettled: () => {
      if (jumpId) {
        queryClient.invalidateQueries({ queryKey: ["jump-assets", jumpId] }).catch(() => undefined);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const current = queryClient.getQueryData<JumpAssetRecord[]>(["jump-assets", jumpId]);
      const target = current?.find((entry) => entry.id === assetId) ?? null;
      await deleteJumpAsset(assetId);
      return target;
    },
    onSuccess: (asset, assetId) => {
      if (jumpId) {
        queryClient.invalidateQueries({ queryKey: ["jump-assets", jumpId] }).catch(() => undefined);
      }
      if (asset) {
        invalidateBudget(jumpId, asset.asset_type);
      }
      if (formState?.id === assetId) {
        setFormState(null);
        setSelectedAssetId(null);
      }
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: -1 | 1 }) => {
      if (!jumpId) {
        return;
      }
      const assets = queryClient.getQueryData<JumpAssetRecord[]>(["jump-assets", jumpId]) ?? [];
      const scoped = assets.filter((asset) => assetTypes.includes(asset.asset_type));
      const targetAsset = scoped.find((asset) => asset.id === id);
      if (!targetAsset) {
        return;
      }
      const orderedIds = scoped
        .filter((asset) => asset.asset_type === targetAsset.asset_type)
        .map((asset) => asset.id);
      const index = orderedIds.indexOf(id);
      if (index < 0) {
        return;
      }
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= orderedIds.length) {
        return;
      }
      const nextOrder = [...orderedIds];
      const [removed] = nextOrder.splice(index, 1);
      nextOrder.splice(nextIndex, 0, removed);
      await reorderJumpAssets(jumpId, targetAsset.asset_type, nextOrder);
    },
    onSuccess: () => {
      if (jumpId) {
        queryClient.invalidateQueries({ queryKey: ["jump-assets", jumpId] }).catch(() => undefined);
      }
    },
  });

  const stipendTotal = useMemo(() => {
    if (!formState) return 0;
    const normalizedPeriods = Math.max(1, formState.stipendPeriods);
    return computeStipendTotal({
      base: formState.stipendBase,
      frequency: formState.stipendFrequency,
      periods: normalizedPeriods,
      total:
        formState.stipendFrequency === "once"
          ? formState.stipendBase
          : formState.stipendBase * normalizedPeriods,
      notes: formState.stipendNotes.trim() ? formState.stipendNotes : undefined,
    });
  }, [formState]);

  const handleSave = () => {
    if (!formState) return;
    const trimmedName = formState.name.trim() || "Unnamed Asset";
    const metadata: AssetMetadata = {
      traitTags: Array.from(new Set(formState.traitTags.map((tag) => tag.trim()).filter(Boolean))),
      stipend:
        Math.abs(formState.stipendBase) > 0 || formState.stipendFrequency !== "once" || formState.stipendNotes.trim()
          ? {
              base: formState.stipendBase,
              frequency: formState.stipendFrequency,
              periods: Math.max(1, Math.floor(formState.stipendPeriods)),
              total: stipendTotal,
              notes: formState.stipendNotes.trim() || undefined,
            }
          : null,
      attributes: formState.attributes.map((attribute) => ({ ...attribute })),
      altForms: formState.altForms.map((form) => ({
        name: form.name.trim(),
        summary: form.summary.trim(),
      })),
    };

    const updates: Parameters<typeof updateJumpAsset>[1] = {
      name: trimmedName,
      category: formState.category.trim() || null,
      subcategory: formState.subcategory.trim() || null,
      cost: Number.isFinite(formState.cost) ? formState.cost : 0,
      quantity: Number.isFinite(formState.quantity) ? Math.max(1, formState.quantity) : 1,
      discounted: formState.discounted,
      freebie: formState.freebie,
      notes: formState.notes.trim() || null,
      metadata: buildAssetMetadata(metadata),
    };

    if (allowTypeSelection) {
      updates.asset_type = formState.type;
    }

    updateMutation.mutate({
      id: formState.id,
      updates,
    });
  };

  const handleTagCommit = () => {
    if (!formState) return;
    const tag = tagDraft.trim();
    if (!tag.length) return;
    setFormState({
      ...formState,
      traitTags: Array.from(new Set([...formState.traitTags, tag])),
    });
    setTagDraft("");
  };

  const handleTagRemove = (tag: string) => {
    if (!formState) return;
    setFormState({
      ...formState,
      traitTags: formState.traitTags.filter((entry) => entry !== tag),
    });
  };

  const mutateAltForms = (
    updater: (current: AssetFormState["altForms"]) => AssetFormState["altForms"],
  ) => {
    setFormState((prev) => (prev ? { ...prev, altForms: updater(prev.altForms) } : prev));
  };

  const handleAltFormAdd = () => {
    mutateAltForms((current) => [...current, { name: "", summary: "" }]);
  };

  const handleAltFormRemove = (index: number) => {
    mutateAltForms((current) => current.filter((_, entryIndex) => entryIndex !== index));
  };

  const handleAltFormChange = (
    index: number,
    updates: Partial<AssetFormState["altForms"][number]>,
  ) => {
    mutateAltForms((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...updates } : entry,
      ),
    );
  };

  const renderAutosave = () => {
    switch (autosaveState) {
      case "saving":
        return <span className="quick-asset__status">Saving…</span>;
      case "saved":
        return <span className="quick-asset__status quick-asset__status--success">Saved.</span>;
      case "error":
        return <span className="quick-asset__status quick-asset__status--error">Failed to save.</span>;
      default:
        return null;
    }
  };

  return (
    <section className="quick-asset">
      <header className="quick-asset__header">
        <h3>{title}</h3>
        <div>
          <button
            type="button"
            data-testid="quick-asset-add"
            onClick={() => primaryType && createMutation.mutate(primaryType)}
            disabled={!jumpId || createMutation.isPending || !primaryType}
          >
            {createMutation.isPending ? "Adding…" : `Add ${singularLabel}`}
          </button>
          {renderAutosave()}
        </div>
      </header>

      {!jumpId ? (
        <p className="quick-asset__empty">Select a jump to edit {title.toLowerCase()}.</p>
      ) : assetsQuery.isLoading ? (
        <p className="quick-asset__empty">Loading {title.toLowerCase()}…</p>
      ) : filteredAssets.length === 0 ? (
        <div className="quick-asset__empty">
          <p>No {title.toLowerCase()} yet.</p>
        </div>
      ) : (
        <div className="quick-asset__layout">
          <ul className="quick-asset__list">
            {filteredAssets.map((asset, index) => {
              const isSelected = formState?.id === asset.id;
              return (
                <li key={asset.id} className={isSelected ? "selected" : undefined}>
                  <button type="button" onClick={() => setSelectedAssetId(asset.id)}>
                    <span>{asset.name}</span>
                    <small>
                      {formatCurrency
                        ? formatCurrency((asset.cost ?? 0) * Math.max(1, asset.quantity ?? 1))
                        : (asset.cost ?? 0) * Math.max(1, asset.quantity ?? 1)}
                    </small>
                  </button>
                  <div className="quick-asset__row-actions">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0 || reorderMutation.isPending}
                      onClick={() => reorderMutation.mutate({ id: asset.id, delta: -1 })}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === filteredAssets.length - 1 || reorderMutation.isPending}
                      onClick={() => reorderMutation.mutate({ id: asset.id, delta: 1 })}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="quick-asset__danger"
                      onClick={() => deleteMutation.mutate(asset.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <form
            className="quick-asset__form"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
          >
            {!formState ? (
              <p>Select an asset to edit its details.</p>
            ) : (
              <>
                <label>
                  <span>Name</span>
                  <input
                    value={formState.name}
                    onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                  />
                </label>

                {allowTypeSelection && (
                  <label>
                    <span>Type</span>
                    <select
                      value={formState.type}
                      onChange={(event) =>
                        setFormState({ ...formState, type: event.target.value as JumpAssetType })
                      }
                    >
                      {assetTypes.map((type) => (
                        <option key={type} value={type}>
                          {ASSET_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  <span>Category</span>
                  <input
                    value={formState.category}
                    onChange={(event) => setFormState({ ...formState, category: event.target.value })}
                  />
                </label>

                <label>
                  <span>Slot / Location</span>
                  <input
                    value={formState.subcategory}
                    onChange={(event) => setFormState({ ...formState, subcategory: event.target.value })}
                  />
                </label>

                <label>
                  <span>Cost</span>
                  <input
                    type="number"
                    value={formState.cost}
                    onChange={(event) =>
                      setFormState({ ...formState, cost: Number(event.target.value) || 0 })
                    }
                  />
                </label>

                <label>
                  <span>Quantity</span>
                  <input
                    type="number"
                    value={formState.quantity}
                    onChange={(event) =>
                      setFormState({ ...formState, quantity: Number(event.target.value) || 1 })
                    }
                  />
                </label>

                <label className="quick-asset__checkbox">
                  <input
                    type="checkbox"
                    checked={formState.discounted}
                    onChange={(event) =>
                      setFormState({ ...formState, discounted: event.target.checked })
                    }
                  />
                  <span>Discounted</span>
                </label>

                <label className="quick-asset__checkbox">
                  <input
                    type="checkbox"
                    checked={formState.freebie}
                    onChange={(event) => setFormState({ ...formState, freebie: event.target.checked })}
                  />
                  <span>Freebie</span>
                </label>

                <fieldset className="quick-asset__fieldset">
                  <legend>Trait Tags</legend>
                  <div className="quick-asset__tags">
                    {formState.traitTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="quick-asset__tag"
                        onClick={() => handleTagRemove(tag)}
                      >
                        {tag} ×
                      </button>
                    ))}
                  </div>
                  <div className="quick-asset__tag-input">
                    <input
                      value={tagDraft}
                      data-testid="quick-asset-tag-input"
                      onChange={(event) => setTagDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === ",") {
                          event.preventDefault();
                          handleTagCommit();
                        }
                      }}
                      placeholder="Add tag"
                    />
                    <button type="button" onClick={handleTagCommit}>
                      Add
                    </button>
                  </div>
                </fieldset>

                <fieldset className="quick-asset__fieldset">
                  <legend>Alternate Forms</legend>
                  {formState.altForms.length === 0 ? (
                    <p className="quick-asset__empty">No alternate forms yet.</p>
                  ) : (
                    formState.altForms.map((altForm, index) => (
                      <div key={`${index}-${formState.id}`} className="quick-asset__alt-form">
                        <label>
                          <span>{`Alt Form ${index + 1} Name`}</span>
                          <input
                            value={altForm.name}
                            onChange={(event) =>
                              handleAltFormChange(index, { name: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          <span>{`Alt Form ${index + 1} Summary`}</span>
                          <textarea
                            value={altForm.summary}
                            onChange={(event) =>
                              handleAltFormChange(index, { summary: event.target.value })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="quick-asset__danger"
                          onClick={() => handleAltFormRemove(index)}
                          aria-label={`Remove Alt Form ${index + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                  <button type="button" onClick={handleAltFormAdd} data-testid="quick-asset-alt-form-add">
                    Add Alternate Form
                  </button>
                </fieldset>

                <fieldset className="quick-asset__fieldset">
                  <legend>Stipend</legend>
                  <label>
                    <span>Base CP</span>
                    <input
                      type="number"
                      value={formState.stipendBase}
                      onChange={(event) =>
                        setFormState({ ...formState, stipendBase: Number(event.target.value) || 0 })
                      }
                    />
                  </label>
                  <label>
                    <span>Frequency</span>
                    <select
                      value={formState.stipendFrequency}
                      onChange={(event) =>
                        setFormState({
                          ...formState,
                          stipendFrequency: event.target.value as StipendFrequency,
                        })
                      }
                    >
                      <option value="once">Once</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>
                  <label>
                    <span>Periods</span>
                    <input
                      type="number"
                      value={formState.stipendPeriods}
                      onChange={(event) =>
                        setFormState({
                          ...formState,
                          stipendPeriods: Number(event.target.value) || 1,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Notes</span>
                    <textarea
                      value={formState.stipendNotes}
                      onChange={(event) => setFormState({ ...formState, stipendNotes: event.target.value })}
                    />
                  </label>
                  <p className="quick-asset__stipend-total">
                    Total stipend: {formatCurrency ? formatCurrency(stipendTotal) : stipendTotal}
                  </p>
                </fieldset>

                <label>
                  <span>Notes</span>
                  <textarea
                    value={formState.notes}
                    onChange={(event) => setFormState({ ...formState, notes: event.target.value })}
                  />
                </label>

                <footer className="quick-asset__footer">
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    data-testid="quick-asset-save"
                  >
                    {updateMutation.isPending ? "Saving…" : "Save Changes"}
                  </button>
                </footer>
              </>
            )}
          </form>
        </div>
      )}
    </section>
  );
};

export default QuickAssetEditor;
