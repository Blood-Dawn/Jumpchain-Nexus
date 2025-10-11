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
  FixedSizeList as List,
  type FixedSizeList,
  type ListChildComponentProps,
} from "react-window";
import {
  createInventoryItem,
  deleteInventoryItem,
  listInventoryItems,
  listJumps,
  moveInventoryItem,
  updateInventoryItem,
  type InventoryItemRecord,
  type InventoryScope,
  type JumpRecord,
  loadWarehouseModeSetting,
  loadCategoryPresets,
  loadWarehousePersonalRealitySummary,
} from "../../db/dao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface WarehouseFormState {
  id: string;
  name: string;
  category: string;
  quantity: number;
  slot: string;
  notes: string;
  tags: string[];
  jumpId: string | null;
}

interface UpdatePayload {
  id: string;
  updates: Parameters<typeof updateInventoryItem>[1];
}

const scopeKey = ["warehouse-items"] as const;
const personalRealityKey = ["warehouse-personal-reality"] as const;

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return numberFormatter.format(value);
};

const parseTags = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag));
    }
  } catch {
    // fall through to manual parsing
  }
  return raw
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const LIST_ROW_HEIGHT = 88;
const MAX_VISIBLE_ROWS = 8;
const LIST_OVERSCAN = 4;

interface WarehouseRowData {
  items: InventoryItemRecord[];
  onSelect: (id: string) => void;
  selectedId: string | null;
  focusId: string | null;
  setFocusId: (id: string) => void;
  moveFocus: (index: number, direction: -1 | 1) => void;
  pendingFocusId: string | null;
  clearPendingFocus: () => void;
}

const ListInnerElement = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, style, ...props }, ref) => (
    <ul
      {...props}
      ref={ref}
      className={className ? `warehouse__virtual-list ${className}` : "warehouse__virtual-list"}
      style={style}
      role="presentation"
    />
  )
);

const WarehouseItemRow: React.FC<ListChildComponentProps<WarehouseRowData>> = ({ index, style, data }) => {
  const item = data.items[index];
  const isActive = item.id === data.selectedId;
  const isFocused = item.id === data.focusId;
  const { pendingFocusId, clearPendingFocus } = data;
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (pendingFocusId === item.id && buttonRef.current) {
      buttonRef.current.focus();
      clearPendingFocus();
    }
  }, [pendingFocusId, item.id, clearPendingFocus]);

  if (!item) {
    return null;
  }

  const ariaLabelSegments = [item.name];
  ariaLabelSegments.push(`Category ${item.category ?? "Unsorted"}`);
  ariaLabelSegments.push(`Quantity ${formatNumber(item.quantity ?? 0)}`);
  if (item.slot) {
    ariaLabelSegments.push(`Slot ${item.slot}`);
  }

  const handleClick = () => {
    data.onSelect(item.id);
    data.setFocusId(item.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      data.moveFocus(index, 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      data.moveFocus(index, -1);
    }
  };

  return (
    <li
      style={{ ...style, width: "100%", padding: "0.35rem 0", boxSizing: "border-box" }}
      className="warehouse__item-row"
      role="presentation"
    >
      <button
        ref={buttonRef}
        type="button"
        id={`warehouse-item-${item.id}`}
        className={isActive ? "warehouse__item warehouse__item--active" : "warehouse__item"}
        onClick={handleClick}
        onFocus={() => data.setFocusId(item.id)}
        onKeyDown={handleKeyDown}
        tabIndex={isFocused ? 0 : -1}
        aria-label={ariaLabelSegments.join(". ")}
        aria-current={isActive ? "true" : undefined}
      >
        <strong>{item.name}</strong>
        <span>
          {item.category ?? "Unsorted"} • Qty {item.quantity}
          {item.slot ? ` • ${item.slot}` : ""}
        </span>
      </button>
    </li>
  );
};

const CosmicWarehouse: React.FC = () => {
  const queryClient = useQueryClient();
  const itemsQuery = useQuery({
    queryKey: scopeKey,
    queryFn: () => listInventoryItems("warehouse"),
  });
  const jumpsQuery = useQuery({ queryKey: ["jumps"], queryFn: listJumps });
  const warehouseModeQuery = useQuery({ queryKey: ["warehouse-mode"], queryFn: loadWarehouseModeSetting });
  const categoryPresetsQuery = useQuery({ queryKey: ["category-presets"], queryFn: loadCategoryPresets });

  const warehouseMode = warehouseModeQuery.data?.mode ?? "generic";
  const warehouseModeLabel = useMemo(() => {
    return warehouseMode === "personal-reality" ? "Personal Reality mode" : "Generic mode";
  }, [warehouseMode]);
  const isPersonalReality = warehouseMode === "personal-reality";

  const personalRealityQuery = useQuery({
    queryKey: personalRealityKey,
    queryFn: loadWarehousePersonalRealitySummary,
    enabled: isPersonalReality,
  });

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const listRef = useRef<FixedSizeList>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createInventoryItem({
        scope: "warehouse",
        name: "New Item",
        category: "Unsorted",
        quantity: 1,
      }),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: scopeKey }).catch(() => undefined);
      if (isPersonalReality) {
        queryClient.invalidateQueries({ queryKey: personalRealityKey }).catch(() => undefined);
      }
      setSelectedId(item.id);
      setFocusId(item.id);
      setPendingFocusId(item.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdatePayload) => updateInventoryItem(payload.id, payload.updates),
    onSuccess: (item) => {
      setSelectedId(item.id);
      setFocusId(item.id);
      setPendingFocusId(item.id);
      queryClient.invalidateQueries({ queryKey: scopeKey }).catch(() => undefined);
      if (isPersonalReality) {
        queryClient.invalidateQueries({ queryKey: personalRealityKey }).catch(() => undefined);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInventoryItem(id),
    onSuccess: () => {
      setSelectedId(null);
      setFocusId(null);
      setPendingFocusId(null);
      queryClient.invalidateQueries({ queryKey: scopeKey }).catch(() => undefined);
      if (isPersonalReality) {
        queryClient.invalidateQueries({ queryKey: personalRealityKey }).catch(() => undefined);
      }
    },
  });

  const moveMutation = useMutation({
    mutationFn: (payload: { id: string; scope: InventoryScope }) => moveInventoryItem(payload.id, payload.scope),
    onSuccess: () => {
      setSelectedId(null);
      setFocusId(null);
      setPendingFocusId(null);
      queryClient.invalidateQueries({ queryKey: scopeKey }).catch(() => undefined);
      if (isPersonalReality) {
        queryClient.invalidateQueries({ queryKey: personalRealityKey }).catch(() => undefined);
      }
    },
  });

  useEffect(() => {
    const items = itemsQuery.data ?? [];
    if (items.length === 0) {
      if (selectedId !== null) {
        setSelectedId(null);
      }
      if (focusId !== null) {
        setFocusId(null);
      }
      if (pendingFocusId !== null) {
        setPendingFocusId(null);
      }
      return;
    }

    const selectedExists = selectedId ? items.some((item) => item.id === selectedId) : false;
    if (!selectedExists) {
      const fallbackId = items[0].id;
      if (selectedId !== fallbackId) {
        setSelectedId(fallbackId);
      }
      if (focusId !== fallbackId) {
        setFocusId(fallbackId);
      }
      if (pendingFocusId !== null) {
        setPendingFocusId(null);
      }
      return;
    }

    if (focusId === null || !items.some((item) => item.id === focusId)) {
      if (focusId !== selectedId) {
        setFocusId(selectedId);
      }
      if (pendingFocusId !== null) {
        setPendingFocusId(null);
      }
    }
  }, [itemsQuery.data, selectedId, focusId, pendingFocusId]);

  const categories = useMemo(() => {
    const all = new Set<string>();
    (categoryPresetsQuery.data?.itemCategories ?? []).forEach((category) => {
      if (category) {
        all.add(category);
      }
    });
    itemsQuery.data?.forEach((item) => {
      if (item.category) {
        all.add(item.category);
      }
    });
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [categoryPresetsQuery.data, itemsQuery.data]);

  const filteredItems: InventoryItemRecord[] = useMemo(() => {
    const base = itemsQuery.data ?? [];
    return base.filter((item) => {
      const matchesCategory = !activeCategory || item.category === activeCategory;
      const matchesSearch = !search
        ? true
        : [item.name, item.category, item.slot, item.notes]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(search.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [itemsQuery.data, activeCategory, search]);

  useEffect(() => {
    if (!filteredItems.length) {
      if (focusId !== null) {
        setFocusId(null);
      }
      if (pendingFocusId !== null) {
        setPendingFocusId(null);
      }
      return;
    }

    const focusExists = focusId ? filteredItems.some((item) => item.id === focusId) : false;
    if (!focusExists) {
      const fallbackId =
        selectedId && filteredItems.some((item) => item.id === selectedId)
          ? selectedId
          : filteredItems[0].id;
      if (focusId !== fallbackId) {
        setFocusId(fallbackId);
      }
      if (pendingFocusId !== null) {
        setPendingFocusId(null);
      }
    }
  }, [filteredItems, focusId, selectedId, pendingFocusId]);

  useEffect(() => {
    if (!focusId) {
      return;
    }
    const index = filteredItems.findIndex((item) => item.id === focusId);
    if (index >= 0) {
      listRef.current?.scrollToItem(index, "smart");
    }
  }, [focusId, filteredItems]);

  useEffect(() => {
    if (selectedId && focusId !== selectedId && filteredItems.some((item) => item.id === selectedId)) {
      setFocusId(selectedId);
    }
  }, [selectedId, focusId, filteredItems]);

  const handleSelectItem = useCallback((id: string) => {
    setSelectedId(id);
    setFocusId(id);
    setPendingFocusId(id);
  }, []);

  const moveFocus = useCallback(
    (index: number, direction: -1 | 1) => {
      if (!filteredItems.length) {
        return;
      }
      const nextIndex = Math.min(Math.max(index + direction, 0), filteredItems.length - 1);
      const nextItem = filteredItems[nextIndex];
      if (!nextItem) {
        return;
      }
      if (focusId !== nextItem.id) {
        setFocusId(nextItem.id);
      }
      setPendingFocusId(nextItem.id);
      listRef.current?.scrollToItem(nextIndex, "smart");
    },
    [filteredItems, focusId, setPendingFocusId]
  );

  const clearPendingFocus = useCallback(() => {
    setPendingFocusId(null);
  }, []);

  const listHeight = filteredItems.length
    ? Math.min(filteredItems.length, MAX_VISIBLE_ROWS) * LIST_ROW_HEIGHT
    : 0;

  const itemData: WarehouseRowData = useMemo(
    () => ({
      items: filteredItems,
      onSelect: handleSelectItem,
      selectedId,
      focusId,
      setFocusId,
      moveFocus,
      pendingFocusId,
      clearPendingFocus,
    }),
    [
      filteredItems,
      handleSelectItem,
      selectedId,
      focusId,
      setFocusId,
      moveFocus,
      pendingFocusId,
      clearPendingFocus,
    ]
  );

  const selectedItem = useMemo(
    () => itemsQuery.data?.find((item) => item.id === selectedId) ?? null,
    [itemsQuery.data, selectedId]
  );

  const personalRealitySummary = personalRealityQuery.data;
  const personalRealityWarnings = useMemo(() => {
    if (!isPersonalReality || !personalRealitySummary) {
      return [] as string[];
    }
    const warnings: string[] = [];
    if (
      personalRealitySummary.wpCap !== null &&
      personalRealitySummary.wpCap !== undefined &&
      personalRealitySummary.wpTotal > personalRealitySummary.wpCap
    ) {
      const overage = personalRealitySummary.wpTotal - personalRealitySummary.wpCap;
      warnings.push(`Warehouse Points exceed stipend by ${formatNumber(overage)} WP.`);
    }
    personalRealitySummary.limits.forEach((limit) => {
      if (limit.used > limit.provided) {
        const overage = limit.used - limit.provided;
        warnings.push(`${limit.label} limit exceeded by ${formatNumber(overage)}.`);
      }
    });
    return warnings;
  }, [isPersonalReality, personalRealitySummary]);

  const [editState, setEditState] = useState<WarehouseFormState | null>(null);

  useEffect(() => {
    if (!selectedItem) {
      setEditState(null);
      return;
    }
    setEditState({
      id: selectedItem.id,
      name: selectedItem.name,
      category: selectedItem.category ?? "",
      quantity: selectedItem.quantity ?? 1,
      slot: selectedItem.slot ?? "",
      notes: selectedItem.notes ?? "",
      tags: parseTags(selectedItem.tags),
      jumpId: selectedItem.jump_id ?? null,
    });
  }, [selectedItem?.id, selectedItem?.updated_at]);

  const handleSave = () => {
    if (!editState) return;
    updateMutation.mutate({
      id: editState.id,
      updates: {
        name: editState.name,
        category: editState.category,
        quantity: editState.quantity,
        slot: editState.slot,
        notes: editState.notes,
        tags: editState.tags,
        jump_id: editState.jumpId,
      },
    });
  };

  const handleDelete = () => {
    if (selectedId) {
      deleteMutation.mutate(selectedId);
    }
  };

  const handleMoveToLocker = () => {
    if (selectedId) {
      moveMutation.mutate({ id: selectedId, scope: "locker" });
    }
  };

  return (
    <section className="warehouse">
      <header className="warehouse__header">
        <div>
          <h1>Cosmic Warehouse</h1>
          <p>
            Organize storage presets, addons, and staging items across your chain.
            <span className="warehouse__mode-badge">{warehouseModeLabel}</span>
          </p>
        </div>
        <div className="warehouse__actions">
          <button type="button" onClick={() => setActiveCategory(null)} disabled={!activeCategory}>
            Clear Filters
          </button>
          <button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Adding…" : "Add Item"}
          </button>
        </div>
      </header>

      {isPersonalReality && (
        <section className="warehouse__pr-panel">
          <header className="warehouse__pr-header">
            <h2>Personal Reality Limits</h2>
            <p>Track stipend usage and structure limits unlocked by Personal Reality mode.</p>
          </header>
          {personalRealityQuery.isLoading ? (
            <p className="warehouse__pr-empty">Loading Personal Reality counters…</p>
          ) : personalRealityQuery.isError ? (
            <p className="warehouse__pr-empty">Failed to load Personal Reality counters.</p>
          ) : personalRealitySummary ? (
            <>
              <dl className="warehouse__pr-summary">
                <div>
                  <dt>Warehouse Points</dt>
                  <dd>
                    {formatNumber(personalRealitySummary.wpTotal)}
                    {personalRealitySummary.wpCap !== null
                      ? ` / ${formatNumber(personalRealitySummary.wpCap)}`
                      : ""}
                  </dd>
                  {personalRealitySummary.wpCap !== null ? (
                    <span className="warehouse__pr-remaining">
                      {personalRealitySummary.wpTotal > personalRealitySummary.wpCap
                        ? `Over by ${formatNumber(personalRealitySummary.wpTotal - personalRealitySummary.wpCap)} WP`
                        : `Remaining ${formatNumber(personalRealitySummary.wpCap - personalRealitySummary.wpTotal)} WP`}
                    </span>
                  ) : (
                    <span className="warehouse__pr-remaining">No stipend cap recorded</span>
                  )}
                </div>
              </dl>
              {personalRealitySummary.limits.length ? (
                <div className="warehouse__pr-grid">
                  {personalRealitySummary.limits.map((limit) => {
                    const remaining = limit.provided - limit.used;
                    const overBudget = remaining < 0;
                    return (
                      <div key={limit.key} className="warehouse__pr-card">
                        <span className="warehouse__pr-label">{limit.label}</span>
                        <strong className="warehouse__pr-value">
                          {formatNumber(limit.used)} / {formatNumber(limit.provided)}
                        </strong>
                        <span
                          className={
                            overBudget
                              ? "warehouse__pr-remaining warehouse__pr-remaining--over"
                              : "warehouse__pr-remaining"
                          }
                        >
                          {overBudget
                            ? `Over by ${formatNumber(Math.abs(remaining))}`
                            : `Remaining ${formatNumber(remaining)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="warehouse__pr-empty">No Personal Reality limits have been recorded yet.</p>
              )}
              {personalRealityWarnings.length > 0 && (
                <ul className="warehouse__alerts">
                  {personalRealityWarnings.map((warning) => (
                    <li key={warning} className="warehouse__alert" role="alert">
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </section>
      )}

      <div className="warehouse__filters">
        <input
          type="search"
          placeholder="Search inventory"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="warehouse__categories">
          <button
            type="button"
            className={!activeCategory ? "warehouse__chip warehouse__chip--active" : "warehouse__chip"}
            onClick={() => setActiveCategory(null)}
          >
            All Categories
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={activeCategory === category ? "warehouse__chip warehouse__chip--active" : "warehouse__chip"}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="warehouse__layout">
        <aside className="warehouse__list">
          {itemsQuery.isLoading && <p className="warehouse__empty">Loading items…</p>}
          {itemsQuery.isError && <p className="warehouse__empty">Failed to load items.</p>}
          {!itemsQuery.isLoading && filteredItems.length === 0 && (
            <p className="warehouse__empty">No items match the current filters.</p>
          )}
          {filteredItems.length > 0 && listHeight > 0 ? (
            <div
              className="warehouse__list-viewport"
              role="listbox"
              aria-label="Warehouse items"
              aria-activedescendant={focusId ? `warehouse-item-${focusId}` : undefined}
            >
              <List
                ref={listRef}
                height={listHeight}
                itemCount={filteredItems.length}
                itemSize={LIST_ROW_HEIGHT}
                width="100%"
                overscanCount={LIST_OVERSCAN}
                itemData={itemData}
                innerElementType={ListInnerElement}
                itemKey={(index, data) => data.items[index]?.id ?? index}
              >
                {WarehouseItemRow}
              </List>
            </div>
          ) : null}
        </aside>

        <div className="warehouse__detail">
          {editState ? (
            <form
              className="warehouse__form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSave();
              }}
            >
              <div className="warehouse__grid">
                <label>
                  <span>Name</span>
                  <input
                    value={editState.name}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Category</span>
                  <input
                    value={editState.category}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, category: event.target.value } : prev))
                    }
                  />
                </label>
                <label>
                  <span>Quantity</span>
                  <input
                    type="number"
                    min={0}
                    value={editState.quantity}
                    onChange={(event) =>
                      setEditState((prev) =>
                        prev
                          ? { ...prev, quantity: Number(event.target.value) || 0 }
                          : prev
                      )
                    }
                  />
                </label>
                <label>
                  <span>Slot / Location</span>
                  <input
                    value={editState.slot}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, slot: event.target.value } : prev))
                    }
                  />
                </label>
              </div>

              <label>
                <span>Attached Jump</span>
                <select
                  value={editState.jumpId ?? ""}
                  onChange={(event) =>
                    setEditState((prev) =>
                      prev
                        ? { ...prev, jumpId: event.target.value ? event.target.value : null }
                        : prev
                    )
                  }
                >
                  <option value="">None</option>
                  {jumpsQuery.data?.map((jump: JumpRecord) => (
                    <option key={jump.id} value={jump.id}>
                      {jump.title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Tags</span>
                <input
                  value={editState.tags.join(", ")}
                  placeholder="Split with commas"
                  onChange={(event) =>
                    setEditState((prev) =>
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
                  value={editState.notes}
                  onChange={(event) =>
                    setEditState((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                  }
                />
              </label>

              <div className="warehouse__form-actions">
                <div className="warehouse__form-left">
                  <button type="button" onClick={handleMoveToLocker}>
                    Move to Locker
                  </button>
                  <button type="button" className="warehouse__danger" onClick={handleDelete}>
                    Delete Item
                  </button>
                </div>
                <button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          ) : (
            <div className="warehouse__empty">
              <p>Select an item to edit details.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CosmicWarehouse;
