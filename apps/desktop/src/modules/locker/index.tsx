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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SUPPLEMENT_SETTINGS,
  createInventoryItem,
  deleteInventoryItem,
  listInventoryItems,
  loadSupplementSettings,
  moveInventoryItem,
  updateInventoryItem,
  type InventoryScope,
} from "../../db/dao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FixedSizeList, type ListChildComponentProps } from "react-window";

import {
  type BodyModType,
  type LockerFilters,
  type LockerMetadata,
  type LockerPriority,
  type LockerWarning,
  collectLockerTags,
  computeLockerWarnings,
  filterLockerItems,
  mapLockerItems,
  parseLockerMetadata,
} from "./lockerUtils";

interface LockerFormState {
  id: string;
  name: string;
  category: string;
  quantity: number;
  slot: string;
  notes: string;
  tags: string[];
  packed: boolean;
  priority: LockerPriority;
  metadata: LockerMetadata;
  bodyModType: BodyModType | null;
}

const LOCKER_SCOPE_KEY = ["locker-items"] as const;

const LOCKER_ROW_HEIGHT = 148;

type LockerListItem = ReturnType<typeof mapLockerItems>[number];

interface LockerListItemData {
  items: LockerListItem[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  togglePacked: (id: string, packed: boolean) => void;
  supplements: typeof DEFAULT_SUPPLEMENT_SETTINGS;
  warningsById: Record<string, LockerWarning[]>;
}

const LockerListRow: React.FC<ListChildComponentProps<LockerListItemData>> = ({ index, style, data }) => {
  const entry = data.items[index];
  const isActive = entry.item.id === data.selectedId;
  const bodyModInactive =
    (entry.bodyModType === "essential" && !data.supplements.enableEssentialBodyMod) ||
    (entry.bodyModType === "universal" && !data.supplements.allowCompanionBodyMod);
  const bodyModClassName = [
    "locker__badge",
    "locker__badge--bodymod",
    `locker__badge--bodymod-${entry.bodyModType}`,
    bodyModInactive ? "locker__badge--inactive" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleSelect = () => {
    data.setSelectedId(entry.item.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar" || event.key === "Space") {
      event.preventDefault();
      handleSelect();
    }
  };

  return (
    <li style={{ ...style, width: "100%" }} className="locker__list-row">
      <div
        role="button"
        tabIndex={0}
        className={isActive ? "locker__item locker__item--active" : "locker__item"}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
      >
        <div className="locker__item-header">
          <strong>{entry.item.name}</strong>
          <label>
            <input
              type="checkbox"
              checked={entry.packed}
              onChange={(event) => data.togglePacked(entry.item.id, event.target.checked)}
            />
            Packed
          </label>
        </div>
        <div className="locker__item-meta">
          <span>{entry.item.category ?? "General"}</span>
          <span>Qty {entry.item.quantity ?? 1}</span>
          <span className={`locker__badge locker__badge--${entry.priority}`}>{entry.priority}</span>
          {entry.bodyModType && (
            <span className={bodyModClassName}>
              {entry.bodyModType === "essential" ? "Essential" : "Universal"}
            </span>
          )}
          {entry.hasBooster && <span className="locker__badge locker__badge--booster">Booster</span>}
          {(data.warningsById[entry.item.id]?.length ?? 0) > 0 && (
            <span className="locker__item-warning">Needs attention</span>
          )}
        </div>
        {entry.tags.length > 0 && (
          <div className="locker__item-tags">
            {entry.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
};

const CosmicLocker: React.FC = () => {
  const queryClient = useQueryClient();
  const itemsQuery = useQuery({ queryKey: LOCKER_SCOPE_KEY, queryFn: () => listInventoryItems("locker") });
  const supplementsQuery = useQuery({ queryKey: ["supplement-settings"], queryFn: loadSupplementSettings });
  const supplements = supplementsQuery.data ?? DEFAULT_SUPPLEMENT_SETTINGS;

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<LockerFilters>({
    packed: "all",
    priority: "all",
    bodyMod: "all",
    booster: "all",
  });
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createInventoryItem({
        scope: "locker",
        name: "New Locker Item",
        category: "General",
        quantity: 1,
      }),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: LOCKER_SCOPE_KEY }).catch(() => undefined);
      setSelectedId(item.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; updates: Parameters<typeof updateInventoryItem>[1] }) =>
      updateInventoryItem(payload.id, payload.updates),
    onSuccess: (item) => {
      setSelectedId(item.id);
      queryClient.invalidateQueries({ queryKey: LOCKER_SCOPE_KEY }).catch(() => undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInventoryItem(id),
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: LOCKER_SCOPE_KEY }).catch(() => undefined);
    },
  });

  const moveMutation = useMutation({
    mutationFn: (payload: { id: string; scope: InventoryScope }) => moveInventoryItem(payload.id, payload.scope),
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: LOCKER_SCOPE_KEY }).catch(() => undefined);
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    itemsQuery.data?.forEach((item) => {
      if (item.category) {
        set.add(item.category);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [itemsQuery.data]);

  const analyzedItems = useMemo(() => mapLockerItems(itemsQuery.data ?? []), [itemsQuery.data]);
  const tagOptions = useMemo(() => collectLockerTags(analyzedItems), [analyzedItems]);
  const filteredItems = useMemo(
    () => filterLockerItems(analyzedItems, filters, search, activeTags),
    [analyzedItems, filters, search, activeTags]
  );

  useEffect(() => {
    setActiveTags((prev) => {
      if (!prev.length) {
        return prev;
      }
      const available = new Set(tagOptions.map((option) => option.value));
      const next = prev.filter((tag) => available.has(tag));
      if (next.length === prev.length && next.every((tag, index) => tag === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [tagOptions]);

  const toggleTagFilter = (tag: string) => {
    setActiveTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((value) => value !== tag);
      }
      return [...prev, tag];
    });
  };
  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredItems.some((entry) => entry.item.id === selectedId)) {
      setSelectedId(filteredItems[0].item.id);
    }
  }, [filteredItems, selectedId]);
  const warningsById = useMemo(
    () =>
      computeLockerWarnings(analyzedItems, {
        essentialEnabled: supplements.enableEssentialBodyMod,
        universalEnabled: supplements.allowCompanionBodyMod,
      }),
    [analyzedItems, supplements.enableEssentialBodyMod, supplements.allowCompanionBodyMod]
  );
  const selectedAnalysis = useMemo(
    () => analyzedItems.find((entry) => entry.item.id === selectedId) ?? null,
    [analyzedItems, selectedId]
  );
  const selectedWarnings = useMemo<LockerWarning[]>(
    () => (selectedId ? warningsById[selectedId] ?? [] : []),
    [selectedId, warningsById]
  );

  const [formState, setFormState] = useState<LockerFormState | null>(null);

  useEffect(() => {
    if (!selectedAnalysis) {
      setFormState(null);
      return;
    }
    setFormState({
      id: selectedAnalysis.item.id,
      name: selectedAnalysis.item.name,
      category: selectedAnalysis.item.category ?? "",
      quantity: selectedAnalysis.item.quantity ?? 1,
      slot: selectedAnalysis.item.slot ?? "",
      notes: selectedAnalysis.item.notes ?? "",
      tags: [...selectedAnalysis.tags],
      packed: selectedAnalysis.packed,
      priority: selectedAnalysis.priority,
      metadata: { ...selectedAnalysis.metadata },
      bodyModType: selectedAnalysis.bodyModType,
    });
  }, [selectedAnalysis]);

  const handleSave = () => {
    if (!formState) return;
    const nextMetadata: LockerMetadata = {
      ...formState.metadata,
      packed: formState.packed,
      priority: formState.priority,
    };
    if (formState.bodyModType) {
      nextMetadata.bodyMod = formState.bodyModType;
    } else if ("bodyMod" in nextMetadata) {
      delete nextMetadata.bodyMod;
    }
    updateMutation.mutate({
      id: formState.id,
      updates: {
        name: formState.name,
        category: formState.category,
        quantity: formState.quantity,
        slot: formState.slot,
        notes: formState.notes,
        tags: formState.tags,
        metadata: nextMetadata,
      },
    });
  };

  const togglePacked = useCallback(
    (id: string, packed: boolean) => {
      const existing = itemsQuery.data?.find((item) => item.id === id);
      if (!existing) return;
      const metadata = parseLockerMetadata(existing.metadata);
      metadata.packed = packed;
      updateMutation.mutate({ id, updates: { metadata } });
    },
    [itemsQuery.data, updateMutation]
  );

  const handleDelete = () => {
    if (selectedId) {
      deleteMutation.mutate(selectedId);
    }
  };

  const handleReturnToWarehouse = () => {
    if (selectedId) {
      moveMutation.mutate({ id: selectedId, scope: "warehouse" });
    }
  };

  const detailRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLElement | null>(null);
  const listHeaderRef = useRef<HTMLDivElement | null>(null);
  const [detailHeight, setDetailHeight] = useState(0);
  const [listPadding, setListPadding] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [headerMargin, setHeaderMargin] = useState(0);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const node = detailRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = Math.round(entry.contentRect.height);
      setDetailHeight(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = listContainerRef.current;
    if (!node || typeof window === "undefined") return;
    const computed = window.getComputedStyle(node);
    const paddingTop = Number.parseFloat(computed.paddingTop ?? "0");
    const paddingBottom = Number.parseFloat(computed.paddingBottom ?? "0");
    const totalPadding = Math.round(
      (Number.isFinite(paddingTop) ? paddingTop : 0) + (Number.isFinite(paddingBottom) ? paddingBottom : 0)
    );
    setListPadding((previous) => (previous === totalPadding ? previous : totalPadding));
  }, [detailHeight]);

  useEffect(() => {
    const node = listHeaderRef.current;
    if (!node || typeof window === "undefined") {
      setHeaderMargin(0);
      return;
    }
    const computed = window.getComputedStyle(node);
    const margin = Number.parseFloat(computed.marginBottom ?? "0");
    const nextMargin = Number.isFinite(margin) ? Math.round(margin) : 0;
    setHeaderMargin((previous) => (previous === nextMargin ? previous : nextMargin));
  }, [categories.length, itemsQuery.isLoading, itemsQuery.isError, filteredItems.length]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const node = listHeaderRef.current;
    if (!node) {
      setHeaderHeight(0);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = Math.round(entry.contentRect.height);
      setHeaderHeight((previous) => (previous === next ? previous : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [categories.length, itemsQuery.isLoading, itemsQuery.isError, filteredItems.length]);

  const fallbackHeight = Math.min(Math.max(filteredItems.length, 1), 6) * LOCKER_ROW_HEIGHT;
  const availableFromDetail = detailHeight - listPadding - headerHeight - headerMargin;
  const resolvedListHeight = Math.max(
    LOCKER_ROW_HEIGHT,
    Math.min(
      filteredItems.length * LOCKER_ROW_HEIGHT || LOCKER_ROW_HEIGHT,
      availableFromDetail > 0 ? availableFromDetail : fallbackHeight
    )
  );

  const rowData = useMemo<LockerListItemData>(
    () => ({ items: filteredItems, selectedId, setSelectedId, togglePacked, supplements, warningsById }),
    [filteredItems, selectedId, togglePacked, supplements, warningsById]
  );

  return (
    <section className="locker">
      <header className="locker__header">
        <div>
          <h1>Cosmic Locker</h1>
          <p>Track what&apos;s packed, what needs attention, and keep your deployment ready.</p>
        </div>
        <button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          {createMutation.isPending ? "Adding…" : "Add Locker Item"}
        </button>
      </header>

      <div className="locker__controls">
        <input
          type="search"
          placeholder="Search locker"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="locker__filters">
          <div className="locker__filter-group">
            <span>Status</span>
            <div>
              {[
                { label: "All", value: "all" },
                { label: "Packed", value: "packed" },
                { label: "Unpacked", value: "unpacked" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={filters.packed === option.value ? "locker__chip locker__chip--active" : "locker__chip"}
                  onClick={() => setFilters((prev) => ({ ...prev, packed: option.value as LockerFilters["packed"] }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="locker__filter-group">
            <span>Priority</span>
            <div>
              {[
                { label: "All", value: "all" },
                { label: "High", value: "high" },
                { label: "Medium", value: "medium" },
                { label: "Low", value: "low" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={filters.priority === option.value ? "locker__chip locker__chip--active" : "locker__chip"}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      priority: option.value as LockerFilters["priority"],
                    }))
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="locker__filter-group">
            <span>Body Mod</span>
            <div>
              {[
                { label: "All", value: "all" },
                { label: "Universal", value: "universal" },
                { label: "Essential", value: "essential" },
                { label: "Unflagged", value: "none" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={filters.bodyMod === option.value ? "locker__chip locker__chip--active" : "locker__chip"}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      bodyMod: option.value as LockerFilters["bodyMod"],
                    }))
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="locker__filter-group">
            <span>Item Type</span>
            <div>
              {[
                { label: "All", value: "all" },
                { label: "Boosters", value: "booster" },
                { label: "Non-boosters", value: "non-booster" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={filters.booster === option.value ? "locker__chip locker__chip--active" : "locker__chip"}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      booster: option.value as LockerFilters["booster"],
                    }))
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {tagOptions.length > 0 && (
            <div className="locker__filter-group">
              <span>Tags</span>
              <div>
                <button
                  type="button"
                  className={
                    activeTags.length === 0
                      ? "locker__chip locker__chip--active"
                      : "locker__chip"
                  }
                  onClick={() => setActiveTags([])}
                >
                  All
                </button>
                {tagOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      activeTags.includes(option.value)
                        ? "locker__chip locker__chip--active"
                        : "locker__chip"
                    }
                    onClick={() => toggleTagFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="locker__supplement-status">
        <span className={supplements.enableEssentialBodyMod ? "locker__status locker__status--ok" : "locker__status locker__status--warning"}>
          Essential Body Mod {supplements.enableEssentialBodyMod ? "enabled" : "disabled"}
        </span>
        <span className={supplements.allowCompanionBodyMod ? "locker__status locker__status--ok" : "locker__status locker__status--warning"}>
          Universal sharing {supplements.allowCompanionBodyMod ? "enabled" : "disabled"}
        </span>
        {supplementsQuery.isError ? (
          <span className="locker__status locker__status--warning">Unable to load supplement settings. Defaults applied.</span>
        ) : null}
      </div>

      <div className="locker__layout">
        <aside className="locker__list">
          {categories.length > 0 && (
            <div className="locker__categories">
              {categories.map((category) => (
                <span key={category}>{category}</span>
              ))}
            </div>
          )}
          {itemsQuery.isLoading && <p className="locker__empty">Loading locker inventory…</p>}
          {itemsQuery.isError && <p className="locker__empty">Failed to load locker inventory.</p>}
          {!itemsQuery.isLoading && filteredItems.length === 0 && (
            <p className="locker__empty">No items match the active filters.</p>
          )}
          <ul aria-label="Locker items">
            {filteredItems.map((entry) => (
              <li key={entry.item.id}>
                <button
                  type="button"
                  className={entry.item.id === selectedId ? "locker__item locker__item--active" : "locker__item"}
                  onClick={() => setSelectedId(entry.item.id)}
                >
                  <div className="locker__item-header">
                    <strong>{entry.item.name}</strong>
                    <label>
                      <input
                        type="checkbox"
                        checked={entry.packed}
                        onChange={(event) => togglePacked(entry.item.id, event.target.checked)}
                      />
                      Packed
                    </label>
                  </div>
                  <div className="locker__item-meta">
                    <span>{entry.item.category ?? "General"}</span>
                    <span>Qty {entry.item.quantity ?? 1}</span>
                    <span className={`locker__badge locker__badge--${entry.priority}`}>{entry.priority}</span>
                    {entry.bodyModType && (
                      <span
                        className={`locker__badge locker__badge--bodymod locker__badge--bodymod-${entry.bodyModType}${
                          (entry.bodyModType === "essential" && !supplements.enableEssentialBodyMod) ||
                          (entry.bodyModType === "universal" && !supplements.allowCompanionBodyMod)
                            ? " locker__badge--inactive"
                            : ""
                        }`}
                      >
                        {entry.bodyModType === "essential" ? "Essential" : "Universal"}
                      </span>
                    )}
                    {entry.hasBooster && <span className="locker__badge locker__badge--booster">Booster</span>}
                    {(warningsById[entry.item.id]?.length ?? 0) > 0 && (
                      <span className="locker__item-warning">Needs attention</span>
                    )}
                  </div>
                  {entry.tags.length > 0 && (
                    <div className="locker__item-tags">
                      {entry.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="locker__detail" ref={detailRef}>
          {formState ? (
            <form
              className="locker__form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSave();
              }}
            >
              {selectedWarnings.length > 0 && (
                <div className="locker__warnings">
                  <strong>Needs attention</strong>
                  <ul>
                    {selectedWarnings.map((warning, index) => (
                      <li key={`${warning.type}-${index}`}>{warning.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="locker__grid">
                <label>
                  <span>Name</span>
                  <input
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Category</span>
                  <input
                    value={formState.category}
                    onChange={(event) =>
                      setFormState((prev) => (prev ? { ...prev, category: event.target.value } : prev))
                    }
                  />
                </label>
                <label>
                  <span>Quantity</span>
                  <input
                    type="number"
                    min={0}
                    value={formState.quantity}
                    onChange={(event) =>
                      setFormState((prev) =>
                        prev ? { ...prev, quantity: Number(event.target.value) || 0 } : prev
                      )
                    }
                  />
                </label>
                <label>
                  <span>Slot / Storage</span>
                  <input
                    value={formState.slot}
                    onChange={(event) =>
                      setFormState((prev) => (prev ? { ...prev, slot: event.target.value } : prev))
                    }
                  />
                </label>
              </div>

              <label className="locker__toggle">
                <input
                  type="checkbox"
                  checked={formState.packed}
                  onChange={(event) =>
                    setFormState((prev) => (prev ? { ...prev, packed: event.target.checked } : prev))
                  }
                />
                Mark as packed and ready to deploy
              </label>

              <label>
                <span>Priority</span>
                <select
                  value={formState.priority}
                  onChange={(event) =>
                    setFormState((prev) =>
                      prev
                        ? { ...prev, priority: event.target.value as LockerPriority }
                        : prev
                    )
                  }
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label>
                <span>Tags</span>
                <input
                  value={formState.tags.join(", ")}
                  placeholder="e.g. medical, emergency"
                  onChange={(event) =>
                    setFormState((prev) =>
                      prev
                        ? {
                            ...prev,
                            tags: event.target.value
                              .split(/[,;]+/)
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          }
                        : prev
                    )
                  }
                />
              </label>

              <label>
                <span>Notes</span>
                <textarea
                  rows={4}
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                  }
                />
              </label>

              <div className="locker__form-actions">
                <div className="locker__form-left">
                  <button type="button" onClick={handleReturnToWarehouse}>
                    Return to Warehouse
                  </button>
                  <button type="button" className="locker__danger" onClick={handleDelete}>
                    Delete Item
                  </button>
                </div>
                <button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          ) : (
            <div className="locker__empty">
              <p>Select an item to view and edit details.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CosmicLocker;
