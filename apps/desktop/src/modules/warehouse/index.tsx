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

import React, { useEffect, useMemo, useState } from "react";
import {
  createInventoryItem,
  deleteInventoryItem,
  listInventoryItems,
  listJumps,
  moveInventoryItem,
  updateInventoryItem,
  type InventoryScope,
  type JumpRecord,
  loadWarehouseModeSetting,
  loadCategoryPresets,
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

const CosmicWarehouse: React.FC = () => {
  const queryClient = useQueryClient();
  const itemsQuery = useQuery({
    queryKey: scopeKey,
    queryFn: () => listInventoryItems("warehouse"),
  });
  const jumpsQuery = useQuery({ queryKey: ["jumps"], queryFn: listJumps });
  const warehouseModeQuery = useQuery({ queryKey: ["warehouse-mode"], queryFn: loadWarehouseModeSetting });
  const categoryPresetsQuery = useQuery({ queryKey: ["category-presets"], queryFn: loadCategoryPresets });

  const warehouseModeLabel = useMemo(() => {
    const mode = warehouseModeQuery.data?.mode ?? "generic";
    return mode === "personal-reality" ? "Personal Reality mode" : "Generic mode";
  }, [warehouseModeQuery.data?.mode]);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      setSelectedId(item.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdatePayload) => updateInventoryItem(payload.id, payload.updates),
    onSuccess: (item) => {
      setSelectedId(item.id);
      queryClient.invalidateQueries({ queryKey: scopeKey }).catch(() => undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInventoryItem(id),
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: scopeKey }).catch(() => undefined);
    },
  });

  const moveMutation = useMutation({
    mutationFn: (payload: { id: string; scope: InventoryScope }) => moveInventoryItem(payload.id, payload.scope),
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: scopeKey }).catch(() => undefined);
    },
  });

  useEffect(() => {
    if (!itemsQuery.data?.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !itemsQuery.data.some((item) => item.id === selectedId)) {
      setSelectedId(itemsQuery.data[0].id);
    }
  }, [itemsQuery.data, selectedId]);

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

  const filteredItems = useMemo(() => {
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

  const selectedItem = useMemo(
    () => itemsQuery.data?.find((item) => item.id === selectedId) ?? null,
    [itemsQuery.data, selectedId]
  );

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
          <ul>
            {filteredItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === selectedId ? "warehouse__item warehouse__item--active" : "warehouse__item"}
                  onClick={() => setSelectedId(item.id)}
                >
                  <strong>{item.name}</strong>
                  <span>
                    {item.category ?? "Unsorted"} • Qty {item.quantity}
                    {item.slot ? ` • ${item.slot}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
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
