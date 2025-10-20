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

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
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
import { useFormatterPreferences } from "../../hooks/useFormatterPreferences";

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

interface AssetContextFlags {
  discounted: boolean;
  imported: boolean;
  stipend: boolean;
}

interface AssetListRowProps {
  asset: JumpAssetRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  formatValue: (value: number) => string;
  reorderDisabled: boolean;
  flags: AssetContextFlags;
}

const AssetListRow: React.FC<AssetListRowProps> = ({
  asset,
  isSelected,
  onSelect,
  formatValue,
  reorderDisabled,
  flags,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: asset.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const displayName = asset.name?.trim().length ? asset.name : "asset";

  const className = [isSelected ? "selected" : "", isDragging ? "dragging" : ""]
    .filter(Boolean)
    .join(" ")
    .trim();

  const badges: Array<{ key: string; label: string; className: string; description: string }> = [];

  if (flags.discounted) {
    badges.push({
      key: "discounted",
      label: "Discounted",
      className: "asset-board__badge--discounted",
      description: "Discount applied — costs half the listed CP.",
    });
  }

  if (flags.imported) {
    badges.push({
      key: "imported",
      label: "Import",
      className: "asset-board__badge--import",
      description: "Active companion import slot with an applied cost.",
    });
  }

  if (flags.stipend) {
    badges.push({
      key: "stipend",
      label: "Stipend",
      className: "asset-board__badge--stipend",
      description: "Grants a stipend or recurring credit.",
    });
  }

  const badgeAriaLabel = badges.length
    ? `Status badges for ${displayName}: ${badges.map((badge) => badge.description).join("; ")}`
    : undefined;

  return (
    <li ref={setNodeRef} style={style} className={className || undefined}>
      <button
        type="button"
        className="asset-board__drag-handle"
        aria-label={`Reorder ${displayName}`}
        title={`Drag to reorder ${displayName}`}
        disabled={reorderDisabled}
        {...(reorderDisabled ? {} : attributes)}
        {...(reorderDisabled ? {} : listeners)}
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>
      <button type="button" className="asset-board__select" onClick={() => onSelect(asset.id)}>
        <span className="asset-board__title">{displayName}</span>
        <div className="asset-board__meta">
          <small>{formatValue((asset.cost ?? 0) * Math.max(asset.quantity ?? 1, 1))}</small>
          {badges.length > 0 && (
            <div className="asset-board__badges" aria-label={badgeAriaLabel} role="list">
              {badges.map((badge) => (
                <span
                  key={badge.key}
                  role="listitem"
                  className={`asset-board__badge ${badge.className}`}
                  title={badge.description}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>
    </li>
  );
};

const useWorkbenchStoreBindings = () => {
  const jumps = useJmhStore((state) => state.jumps);
  const selectedJumpId = useJmhStore((state) => state.selectedJumpId);
  const setSelectedJump = useJmhStore((state) => state.setSelectedJump);
  const setEntities = useJmhStore((state) => state.setEntities);
  const activeType = useJmhStore((state) => state.activeAssetType);
  const setActiveType = useJmhStore((state) => state.setActiveAssetType);
  const selectedAssetId = useJmhStore((state) => state.selectedAssetId);
  const setSelectedAssetId = useJmhStore((state) => state.setSelectedAssetId);

  return {
    jumps,
    selectedJumpId,
    setSelectedJump,
    setEntities,
    activeType,
    setActiveType,
    selectedAssetId,
    setSelectedAssetId,
  };
};

type WorkbenchStoreBindings = ReturnType<typeof useWorkbenchStoreBindings>;
type JumpSummary = WorkbenchStoreBindings["jumps"][number];

const useWorkbenchLocalState = () => {
  const [orderedIds, setOrderedIds] = useState<Record<JumpAssetType, string[]>>({});
  const [formState, setFormState] = useState<AssetFormState | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const badgeLegendId = useId();

  return { orderedIds, setOrderedIds, formState, setFormState, tagDraft, setTagDraft, badgeLegendId };
};

const useJumpBudgetQuery = (selectedJumpId: string | null) => {
  return useQuery({
    queryKey: ["jump-budget", selectedJumpId],
    queryFn: async () => {
      if (!selectedJumpId) {
        return null;
      }
      return summarizeJumpBudget(selectedJumpId);
    },
    enabled: Boolean(selectedJumpId),
  });
};

const useJumpAssetsQuery = (selectedJumpId: string | null) => {
  return useQuery({
    queryKey: ["jump-assets", selectedJumpId],
    queryFn: () => (selectedJumpId ? listJumpAssets(selectedJumpId) : Promise.resolve([] as JumpAssetRecord[])),
    enabled: Boolean(selectedJumpId),
  });
};

const useAssetsByType = (assets: JumpAssetRecord[] | undefined) => {
  return useMemo(() => {
    const map = new Map<JumpAssetType, JumpAssetRecord[]>();
    for (const type of assetTypeOrder) {
      map.set(type, []);
    }
    for (const asset of assets ?? []) {
      const bucket = map.get(asset.asset_type) ?? [];
      bucket.push(asset);
      map.set(asset.asset_type, bucket);
    }
    return map;
  }, [assets]);
};

const useDisplayAssets = (
  activeType: JumpAssetType,
  currentAssets: JumpAssetRecord[],
  orderedIds: Record<JumpAssetType, string[]>,
) => {
  return useMemo(() => {
    const ids = orderedIds[activeType];
    if (!ids) {
      return currentAssets;
    }
    const map = new Map(currentAssets.map((asset) => [asset.id, asset]));
    const ordered = ids
      .map((id) => map.get(id))
      .filter((asset): asset is JumpAssetRecord => Boolean(asset));
    if (ordered.length === currentAssets.length) {
      return ordered;
    }
    const missing = currentAssets.filter((asset) => !ids.includes(asset.id));
    return [...ordered, ...missing];
  }, [activeType, currentAssets, orderedIds]);
};

const useSelectedAsset = (displayAssets: JumpAssetRecord[], selectedAssetId: string | null) => {
  return useMemo(
    () => displayAssets.find((asset) => asset.id === selectedAssetId) ?? null,
    [displayAssets, selectedAssetId],
  );
};

const useAssetMetadataMap = (displayAssets: JumpAssetRecord[]) => {
  return useMemo(() => {
    const map = new Map<string, AssetMetadata>();
    for (const asset of displayAssets) {
      map.set(asset.id, parseAssetMetadata(asset));
    }
    return map;
  }, [displayAssets]);
};

const useImportedAssetIds = (selections: { assetId: string; selected: boolean }[] | undefined) => {
  return useMemo(() => {
    const set = new Set<string>();
    for (const entry of selections ?? []) {
      if (entry.selected) {
        set.add(entry.assetId);
      }
    }
    return set;
  }, [selections]);
};

const useKnowledgeReferences = (selectedAsset: JumpAssetRecord | null) => {
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

  return { knowledgeReferencesQuery, knowledgeReferences, knowledgeReferenceError };
};

const useFormatValue = (separator: string | undefined) => {
  return useCallback(
    (value: number) => {
      const resolved = separator ?? "none";
      return formatBudget(value, resolved);
    },
    [separator],
  );
};

const useInvalidateAfterMutation = (queryClient: ReturnType<typeof useQueryClient>) => {
  return useCallback(
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
};

type EntityCollection = ReturnType<typeof useJmhStore.getState>["entities"];

const useEntityStoreHelpers = (setEntities: (entities: EntityCollection) => void) => {
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

  return { mergeEntityIntoStore, removeEntityFromStore };
};

const useActiveTypeAlignment = (
  activeType: JumpAssetType,
  assets: JumpAssetRecord[] | undefined,
  selectedAssetId: string | null,
  setActiveType: (type: JumpAssetType) => void,
) => {
  useEffect(() => {
    if (!selectedAssetId) {
      return;
    }
    const match = assets?.find((asset) => asset.id === selectedAssetId);
    if (match && match.asset_type !== activeType) {
      setActiveType(match.asset_type);
    }
  }, [activeType, assets, selectedAssetId, setActiveType]);
};

const useOrderedIdsSync = (
  assetsByType: Map<JumpAssetType, JumpAssetRecord[]>,
  setOrderedIds: React.Dispatch<React.SetStateAction<Record<JumpAssetType, string[]>>>,
) => {
  useEffect(() => {
    setOrderedIds((prev) => {
      let changed = false;
      const next: Record<JumpAssetType, string[]> = { ...prev };
      for (const type of assetTypeOrder) {
        const assets = assetsByType.get(type) ?? [];
        const ids = assets.map((asset) => asset.id);
        const previous = prev[type];
        if (!previous || previous.length !== ids.length || previous.some((id, index) => id !== ids[index])) {
          next[type] = ids;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [assetsByType, setOrderedIds]);
};

const useSelectedJumpFallback = (
  jumps: Array<{ id: string }>,
  selectedJumpId: string | null,
  setSelectedJump: (id: string | null) => void,
) => {
  useEffect(() => {
    if (!selectedJumpId && jumps.length > 0) {
      setSelectedJump(jumps[0].id);
    }
  }, [jumps, selectedJumpId, setSelectedJump]);
};

const useSelectionAvailability = (
  displayAssets: JumpAssetRecord[],
  selectedAssetId: string | null,
  setSelectedAssetId: (id: string | null) => void,
  setFormState: (state: AssetFormState | null) => void,
) => {
  useEffect(() => {
    if (!displayAssets.length) {
      setSelectedAssetId(null);
      setFormState(null);
      return;
    }
    if (!selectedAssetId || !displayAssets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(displayAssets[0].id);
    }
  }, [displayAssets, selectedAssetId, setFormState, setSelectedAssetId]);
};

const useFormStateSync = (
  selectedAsset: JumpAssetRecord | null,
  setFormState: (state: AssetFormState | null) => void,
  setTagDraft: (draft: string) => void,
) => {
  useEffect(() => {
    if (!selectedAsset) {
      setFormState(null);
      setTagDraft("");
      return;
    }
    setFormState(createFormState(selectedAsset));
    setTagDraft("");
  }, [selectedAsset?.id, selectedAsset?.updated_at, selectedAsset, setFormState, setTagDraft]);
};

const useMutateForm = (
  setFormState: React.Dispatch<React.SetStateAction<AssetFormState | null>>,
) => {
  return useCallback(<K extends keyof AssetFormState>(key: K, value: AssetFormState[K]) => {
    setFormState((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, [setFormState]);
};

const useStipendTotal = (formState: AssetFormState | null) => {
  return useMemo(() => {
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
};

interface MutationBundle {
  createMutation: UseMutationResult<JumpAssetRecord, Error, JumpAssetType, unknown>;
  updateMutation: UseMutationResult<
    JumpAssetRecord,
    Error,
    { id: string; updates: Parameters<typeof updateJumpAsset>[1] },
    unknown
  >;
  deleteMutation: UseMutationResult<void, Error, { id: string; type: JumpAssetType }, unknown>;
  reorderMutation: UseMutationResult<
    void,
    Error,
    { jumpId: string; type: JumpAssetType; orderedIds: string[] },
    unknown
  >;
}

const useAssetMutations = (
  selectedJumpId: string | null,
  invalidateAfterMutation: (jumpId: string, assetType?: JumpAssetType) => void,
  mergeEntityIntoStore: (asset: JumpAssetRecord) => void,
  removeEntityFromStore: (id: string) => void,
  setActiveType: (type: JumpAssetType) => void,
  setSelectedAssetId: (id: string | null) => void,
  setFormState: (state: AssetFormState | null) => void,
): MutationBundle => {
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
    onSuccess: (payload) => {
      if (selectedJumpId) {
        invalidateAfterMutation(selectedJumpId, payload.type);
      }
      removeEntityFromStore(payload.id);
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

  return { createMutation, updateMutation, deleteMutation, reorderMutation };
};

const useAssetSensors = () => {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
};

const useDragEndHandler = (
  activeType: JumpAssetType,
  currentAssets: JumpAssetRecord[],
  orderedIds: Record<JumpAssetType, string[]>,
  setOrderedIds: React.Dispatch<React.SetStateAction<Record<JumpAssetType, string[]>>>,
  reorderMutation: MutationBundle["reorderMutation"],
  selectedJumpId: string | null,
  setSelectedAssetId: (id: string | null) => void,
) => {
  return useCallback(
    (event: DragEndEvent) => {
      if (!selectedJumpId) return;
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const ids = orderedIds[activeType] ?? currentAssets.map((asset) => asset.id);
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }
      const reordered = arrayMove(ids, oldIndex, newIndex);
      setOrderedIds((prev) => ({ ...prev, [activeType]: reordered }));
      reorderMutation.mutate({
        jumpId: selectedJumpId,
        type: activeType,
        orderedIds: reordered,
      });
      setSelectedAssetId(String(active.id));
    },
    [activeType, currentAssets, orderedIds, reorderMutation, selectedJumpId, setOrderedIds, setSelectedAssetId],
  );
};

const useDeleteHandler = (
  formState: AssetFormState | null,
  activeType: JumpAssetType,
  deleteMutation: MutationBundle["deleteMutation"],
) => {
  return useCallback(async () => {
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
  }, [activeType, deleteMutation, formState]);
};

const useHandleSave = (
  formState: AssetFormState | null,
  updateMutation: MutationBundle["updateMutation"],
) => {
  return useCallback(() => {
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
  }, [formState, updateMutation]);
};

interface AssetWorkbenchController {
  jumps: WorkbenchStoreBindings["jumps"];
  selectedJumpId: string | null;
  selectedJump: JumpSummary | null;
  onJumpChange: (value: string) => void;
  budgetQuery: ReturnType<typeof useJumpBudgetQuery>;
  assetsQuery: ReturnType<typeof useJumpAssetsQuery>;
  activeType: JumpAssetType;
  setActiveType: (type: JumpAssetType) => void;
  createMutation: MutationBundle["createMutation"];
  reorderMutation: MutationBundle["reorderMutation"];
  displayAssets: JumpAssetRecord[];
  assetMetadataMap: Map<string, AssetMetadata>;
  importedAssetIds: Set<string>;
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;
  sensors: ReturnType<typeof useAssetSensors>;
  handleDragEnd: (event: DragEndEvent) => void;
  badgeLegendId: string;
  formState: AssetFormState | null;
  mutateForm: ReturnType<typeof useMutateForm>;
  handleSave: () => void;
  handleDelete: () => Promise<void> | void;
  tagDraft: string;
  setTagDraft: (value: string) => void;
  formatValue: (value: number) => string;
  knowledgeReferencesQuery: ReturnType<typeof useKnowledgeReferences>["knowledgeReferencesQuery"];
  knowledgeReferences: KnowledgeArticleReferenceSummary[];
  knowledgeReferenceError: Error | null;
  openKnowledgeArticle: (reference: KnowledgeArticleReferenceSummary) => void;
  updateMutation: MutationBundle["updateMutation"];
  deleteMutation: MutationBundle["deleteMutation"];
  stipendTotal: number;
}

const useAssetWorkbenchController = (): AssetWorkbenchController => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const store = useWorkbenchStoreBindings();
  const local = useWorkbenchLocalState();
  const {
    jumps,
    selectedJumpId,
    setSelectedJump,
    setEntities,
    activeType,
    setActiveType,
    selectedAssetId,
    setSelectedAssetId,
  } = store;
  const { orderedIds, setOrderedIds, formState, setFormState, tagDraft, setTagDraft, badgeLegendId } = local;

  const formatterSettingsQuery = useFormatterPreferences();
  const budgetQuery = useJumpBudgetQuery(selectedJumpId);
  const assetsQuery = useJumpAssetsQuery(selectedJumpId);
  const assetsByType = useAssetsByType(assetsQuery.data);
  const currentAssets = assetsByType.get(activeType) ?? [];
  const displayAssets = useDisplayAssets(activeType, currentAssets, orderedIds);
  const selectedAsset = useSelectedAsset(displayAssets, selectedAssetId);
  const assetMetadataMap = useAssetMetadataMap(displayAssets);
  const importedAssetIds = useImportedAssetIds(budgetQuery.data?.companionImportSelections);
  const { knowledgeReferencesQuery, knowledgeReferences, knowledgeReferenceError } =
    useKnowledgeReferences(selectedAsset);

  const selectedJump = useMemo(
    () => jumps.find((jump) => jump.id === selectedJumpId) ?? null,
    [jumps, selectedJumpId],
  );

  const invalidateAfterMutation = useInvalidateAfterMutation(queryClient);
  const { mergeEntityIntoStore, removeEntityFromStore } = useEntityStoreHelpers(setEntities);

  useActiveTypeAlignment(activeType, assetsQuery.data, selectedAssetId, setActiveType);
  useOrderedIdsSync(assetsByType, setOrderedIds);
  useSelectedJumpFallback(jumps, selectedJumpId, setSelectedJump);
  useSelectionAvailability(displayAssets, selectedAssetId, setSelectedAssetId, setFormState);
  useFormStateSync(selectedAsset, setFormState, setTagDraft);

  const mutateForm = useMutateForm(setFormState);
  const formatValue = useFormatValue(formatterSettingsQuery.data?.thousandsSeparator);
  const mutations = useAssetMutations(
    selectedJumpId,
    invalidateAfterMutation,
    mergeEntityIntoStore,
    removeEntityFromStore,
    setActiveType,
    setSelectedAssetId,
    setFormState,
  );
  const sensors = useAssetSensors();
  const handleDragEnd = useDragEndHandler(
    activeType,
    currentAssets,
    orderedIds,
    setOrderedIds,
    mutations.reorderMutation,
    selectedJumpId,
    setSelectedAssetId,
  );
  const handleDelete = useDeleteHandler(formState, activeType, mutations.deleteMutation);
  const handleSave = useHandleSave(formState, mutations.updateMutation);
  const stipendTotal = useStipendTotal(formState);

  const openKnowledgeArticle = useCallback(
    (reference: KnowledgeArticleReferenceSummary) => {
      navigate("/knowledge", { state: { articleId: reference.id } });
    },
    [navigate],
  );

  const onJumpChange = useCallback(
    (value: string) => {
      setSelectedAssetId(null);
      setFormState(null);
      setSelectedJump(value || null);
    },
    [setFormState, setSelectedAssetId, setSelectedJump],
  );

  return {
    jumps,
    selectedJumpId,
    selectedJump,
    onJumpChange,
    budgetQuery,
    assetsQuery,
    activeType,
    setActiveType,
    createMutation: mutations.createMutation,
    reorderMutation: mutations.reorderMutation,
    displayAssets,
    assetMetadataMap,
    importedAssetIds,
    selectedAssetId,
    setSelectedAssetId,
    sensors,
    handleDragEnd,
    badgeLegendId,
    formState,
    mutateForm,
    handleSave,
    handleDelete,
    tagDraft,
    setTagDraft,
    formatValue,
    knowledgeReferencesQuery,
    knowledgeReferences,
    knowledgeReferenceError,
    openKnowledgeArticle,
    updateMutation: mutations.updateMutation,
    deleteMutation: mutations.deleteMutation,
    stipendTotal,
  };
};

interface AssetWorkbenchHeaderProps {
  jumps: AssetWorkbenchController["jumps"];
  selectedJumpId: string | null;
  selectedJump: JumpSummary | null;
  onJumpChange: (value: string) => void;
  formatValue: (value: number) => string;
  budgetQuery: ReturnType<typeof useJumpBudgetQuery>;
}

const AssetWorkbenchHeader: React.FC<AssetWorkbenchHeaderProps> = ({
  jumps,
  selectedJumpId,
  selectedJump,
  onJumpChange,
  formatValue,
  budgetQuery,
}) => {
  return (
    <header className="hub-build__header">
      <div>
        <h2>Build Ledger</h2>
        <p>Track origins, purchases, and drawbacks for the active jump.</p>
      </div>
      <div className="hub-build__controls">
        <label className="hub-build__jump-select">
          <span>Active Jump</span>
          <select value={selectedJumpId ?? ""} onChange={(event) => onJumpChange(event.target.value)}>
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
  );
};

interface AssetTypeTabsProps {
  activeType: JumpAssetType;
  onSelectType: (type: JumpAssetType) => void;
  onResetSelection: () => void;
  createMutation: MutationBundle["createMutation"];
}

const AssetTypeTabs: React.FC<AssetTypeTabsProps> = ({
  activeType,
  onSelectType,
  onResetSelection,
  createMutation,
}) => {
  return (
    <div className="asset-tabs">
      <nav>
        {assetTypeOrder.map((type) => (
          <button
            key={type}
            type="button"
            className={type === activeType ? "active" : ""}
            onClick={() => {
              onSelectType(type);
              onResetSelection();
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
  );
};

interface AssetListPanelProps {
  assetsQuery: ReturnType<typeof useJumpAssetsQuery>;
  activeType: JumpAssetType;
  displayAssets: JumpAssetRecord[];
  createMutation: MutationBundle["createMutation"];
  formatValue: (value: number) => string;
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;
  reorderMutation: MutationBundle["reorderMutation"];
  assetMetadataMap: Map<string, AssetMetadata>;
  importedAssetIds: Set<string>;
  sensors: ReturnType<typeof useAssetSensors>;
  handleDragEnd: (event: DragEndEvent) => void;
}

const AssetListPanel: React.FC<AssetListPanelProps> = ({
  assetsQuery,
  activeType,
  displayAssets,
  createMutation,
  formatValue,
  selectedAssetId,
  setSelectedAssetId,
  reorderMutation,
  assetMetadataMap,
  importedAssetIds,
  sensors,
  handleDragEnd,
}) => {
  let content: React.ReactNode;
  if (assetsQuery.isLoading) {
    content = <p className="asset-board__empty">Loading assets…</p>;
  } else if (displayAssets.length === 0) {
    content = (
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
    );
  } else {
    content = (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayAssets.map((asset) => asset.id)} strategy={verticalListSortingStrategy}>
          <ul aria-label={`${ASSET_TYPE_LABELS[activeType]} order`} aria-roledescription="Sortable list">
            {displayAssets.map((asset) => {
              const metadata = assetMetadataMap.get(asset.id);
              const flags: AssetContextFlags = {
                discounted: asset.discounted === 1,
                imported: asset.asset_type === "companion" && importedAssetIds.has(asset.id),
                stipend: Boolean(metadata?.stipend),
              };
              return (
                <AssetListRow
                  key={asset.id}
                  asset={asset}
                  formatValue={formatValue}
                  isSelected={asset.id === selectedAssetId}
                  onSelect={setSelectedAssetId}
                  reorderDisabled={reorderMutation.isPending}
                  flags={flags}
                />
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
    );
  }

  return <div className="asset-board__list">{content}</div>;
};

const AssetBadgeLegend: React.FC<{ badgeLegendId: string; hasAssets: boolean }> = ({
  badgeLegendId,
  hasAssets,
}) => {
  if (!hasAssets) {
    return null;
  }
  return (
    <div className="asset-board__legend" role="group" aria-labelledby={badgeLegendId}>
      <p id={badgeLegendId}>Badge legend</p>
      <ul>
        <li>
          <span className="asset-board__badge asset-board__badge--discounted" aria-hidden="true">
            Discounted
          </span>
          <small>Half-cost purchases using a qualifying discount.</small>
        </li>
        <li>
          <span className="asset-board__badge asset-board__badge--import" aria-hidden="true">
            Import
          </span>
          <small>Indicates a companion import slot with an applied fee.</small>
        </li>
        <li>
          <span className="asset-board__badge asset-board__badge--stipend" aria-hidden="true">
            Stipend
          </span>
          <small>Highlights assets that grant recurring credit.</small>
        </li>
      </ul>
    </div>
  );
};

interface AssetIdentityFieldsProps {
  formState: AssetFormState;
  mutateForm: ReturnType<typeof useMutateForm>;
}

const AssetIdentityFields: React.FC<AssetIdentityFieldsProps> = ({ formState, mutateForm }) => (
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
);

const AssetNotesField: React.FC<AssetIdentityFieldsProps> = ({ formState, mutateForm }) => (
  <label className="asset-form__notes">
    <span>Notes</span>
    <textarea
      value={formState.notes}
      onChange={(event) => mutateForm("notes", event.target.value)}
      rows={3}
    />
  </label>
);

interface AssetKnowledgeSectionProps {
  knowledgeReferencesQuery: ReturnType<typeof useKnowledgeReferences>["knowledgeReferencesQuery"];
  knowledgeReferences: KnowledgeArticleReferenceSummary[];
  knowledgeReferenceError: Error | null;
  openKnowledgeArticle: (reference: KnowledgeArticleReferenceSummary) => void;
}

const AssetKnowledgeSection: React.FC<AssetKnowledgeSectionProps> = ({
  knowledgeReferencesQuery,
  knowledgeReferences,
  knowledgeReferenceError,
  openKnowledgeArticle,
}) => {
  let content: React.ReactNode;
  if (knowledgeReferencesQuery.isLoading) {
    content = <p className="asset-form__references-status">Loading references…</p>;
  } else if (knowledgeReferenceError) {
    content = (
      <p className="asset-form__references-status">
        Failed to load knowledge base links. {knowledgeReferenceError.message}
      </p>
    );
  } else if (knowledgeReferences.length === 0) {
    content = (
      <p className="asset-form__references-status">
        This asset isn't linked to any knowledge base articles yet.
      </p>
    );
  } else {
    content = (
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
    );
  }

  return (
    <section className="asset-form__references">
      <header>
        <h3>Referenced in Knowledge Base</h3>
        <p>Jump to related guidance articles for this asset.</p>
      </header>
      {content}
    </section>
  );
};

interface AssetTagEditorProps {
  formState: AssetFormState;
  mutateForm: ReturnType<typeof useMutateForm>;
  tagDraft: string;
  setTagDraft: (value: string) => void;
}

const AssetTagEditor: React.FC<AssetTagEditorProps> = ({ formState, mutateForm, tagDraft, setTagDraft }) => (
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
);

interface AssetStipendSectionProps {
  formState: AssetFormState;
  mutateForm: ReturnType<typeof useMutateForm>;
  formatValue: (value: number) => string;
  stipendTotal: number;
}

const AssetStipendSection: React.FC<AssetStipendSectionProps> = ({
  formState,
  mutateForm,
  formatValue,
  stipendTotal,
}) => (
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
          onChange={(event) => mutateForm("stipendFrequency", event.target.value as StipendFrequency)}
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
          onChange={(event) => mutateForm("stipendPeriods", Math.max(Number(event.target.value), 1))}
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
);

interface AssetFormActionsProps {
  handleDelete: () => Promise<void> | void;
  updatePending: boolean;
  deletePending: boolean;
}

const AssetFormActions: React.FC<AssetFormActionsProps> = ({ handleDelete, updatePending, deletePending }) => (
  <div className="asset-form__actions">
    <button type="submit" disabled={updatePending}>
      {updatePending ? "Saving…" : "Save Changes"}
    </button>
    <button type="button" className="danger" onClick={() => void handleDelete()} disabled={deletePending}>
      {deletePending ? "Removing…" : "Delete"}
    </button>
  </div>
);

interface AssetDetailsPanelProps {
  formState: AssetFormState | null;
  mutateForm: ReturnType<typeof useMutateForm>;
  handleSave: () => void;
  handleDelete: () => Promise<void> | void;
  updateMutation: MutationBundle["updateMutation"];
  deleteMutation: MutationBundle["deleteMutation"];
  knowledgeReferencesQuery: ReturnType<typeof useKnowledgeReferences>["knowledgeReferencesQuery"];
  knowledgeReferences: KnowledgeArticleReferenceSummary[];
  knowledgeReferenceError: Error | null;
  openKnowledgeArticle: (reference: KnowledgeArticleReferenceSummary) => void;
  tagDraft: string;
  setTagDraft: (value: string) => void;
  formatValue: (value: number) => string;
  stipendTotal: number;
}

const AssetDetailsPanel: React.FC<AssetDetailsPanelProps> = ({
  formState,
  mutateForm,
  handleSave,
  handleDelete,
  updateMutation,
  deleteMutation,
  knowledgeReferencesQuery,
  knowledgeReferences,
  knowledgeReferenceError,
  openKnowledgeArticle,
  tagDraft,
  setTagDraft,
  formatValue,
  stipendTotal,
}) => {
  if (!formState) {
    return <p className="asset-board__empty">Select an asset to edit its details.</p>;
  }
  return (
    <form
      className="asset-form"
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
    >
      <AssetIdentityFields formState={formState} mutateForm={mutateForm} />
      <AssetNotesField formState={formState} mutateForm={mutateForm} />
      <AssetKnowledgeSection
        knowledgeReferencesQuery={knowledgeReferencesQuery}
        knowledgeReferences={knowledgeReferences}
        knowledgeReferenceError={knowledgeReferenceError}
        openKnowledgeArticle={openKnowledgeArticle}
      />
      <AssetTagEditor
        formState={formState}
        mutateForm={mutateForm}
        tagDraft={tagDraft}
        setTagDraft={setTagDraft}
      />
      <AssetStipendSection
        formState={formState}
        mutateForm={mutateForm}
        formatValue={formatValue}
        stipendTotal={stipendTotal}
      />
      <AssetFormActions
        handleDelete={handleDelete}
        updatePending={updateMutation.isPending}
        deletePending={deleteMutation.isPending}
      />
    </form>
  );
};

const AssetWorkbenchBody: React.FC<{ controller: AssetWorkbenchController }> = ({ controller }) => {
  const {
    activeType,
    setActiveType,
    createMutation,
    reorderMutation,
    assetsQuery,
    displayAssets,
    formatValue,
    selectedAssetId,
    setSelectedAssetId,
    assetMetadataMap,
    importedAssetIds,
    sensors,
    handleDragEnd,
    badgeLegendId,
    formState,
    mutateForm,
    handleSave,
    handleDelete,
    tagDraft,
    setTagDraft,
    knowledgeReferencesQuery,
    knowledgeReferences,
    knowledgeReferenceError,
    openKnowledgeArticle,
    updateMutation,
    deleteMutation,
    stipendTotal,
  } = controller;

  const hasAssets = displayAssets.length > 0;

  return (
    <>
      <AssetTypeTabs
        activeType={activeType}
        onSelectType={setActiveType}
        onResetSelection={() => setSelectedAssetId(null)}
        createMutation={createMutation}
      />
      <div className="asset-board">
        <AssetListPanel
          assetsQuery={assetsQuery}
          activeType={activeType}
          displayAssets={displayAssets}
          createMutation={createMutation}
          formatValue={formatValue}
          selectedAssetId={selectedAssetId}
          setSelectedAssetId={setSelectedAssetId}
          reorderMutation={reorderMutation}
          assetMetadataMap={assetMetadataMap}
          importedAssetIds={importedAssetIds}
          sensors={sensors}
          handleDragEnd={handleDragEnd}
        />
        <AssetBadgeLegend badgeLegendId={badgeLegendId} hasAssets={hasAssets} />
        <div className="asset-board__details">
          <AssetDetailsPanel
            formState={formState}
            mutateForm={mutateForm}
            handleSave={handleSave}
            handleDelete={handleDelete}
            updateMutation={updateMutation}
            deleteMutation={deleteMutation}
            knowledgeReferencesQuery={knowledgeReferencesQuery}
            knowledgeReferences={knowledgeReferences}
            knowledgeReferenceError={knowledgeReferenceError}
            openKnowledgeArticle={openKnowledgeArticle}
            tagDraft={tagDraft}
            setTagDraft={setTagDraft}
            formatValue={formatValue}
            stipendTotal={stipendTotal}
          />
        </div>
      </div>
    </>
  );
};

export const AssetWorkbench: React.FC = () => {
  const controller = useAssetWorkbenchController();
  return (
    <section className="hub-build">
      <AssetWorkbenchHeader
        jumps={controller.jumps}
        selectedJumpId={controller.selectedJumpId}
        selectedJump={controller.selectedJump}
        onJumpChange={controller.onJumpChange}
        formatValue={controller.formatValue}
        budgetQuery={controller.budgetQuery}
      />
      {!controller.selectedJumpId ? (
        <p className="hub-build__empty">Select a jump to begin managing its assets.</p>
      ) : (
        <AssetWorkbenchBody controller={controller} />
      )}
    </section>
  );
};

export default AssetWorkbench;
