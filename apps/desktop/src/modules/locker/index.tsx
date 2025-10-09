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
  moveInventoryItem,
  updateInventoryItem,
  type InventoryScope,
} from "../../db/dao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type LockerPriority = "essential" | "standard" | "luxury";

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
}

interface ReadinessFilter {
  packed: "all" | "packed" | "unpacked";
  priority: "all" | LockerPriority;
}

const LOCKER_SCOPE_KEY = ["locker-items"] as const;

const parseTags = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag));
    }
  } catch {
    // fallback
  }
  return raw
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseMetadata = (raw: string | null): { packed?: boolean; priority?: LockerPriority } => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? {}) as { packed?: boolean; priority?: LockerPriority };
  } catch {
    return {};
  }
};

const CosmicLocker: React.FC = () => {
  const queryClient = useQueryClient();
  const itemsQuery = useQuery({ queryKey: LOCKER_SCOPE_KEY, queryFn: () => listInventoryItems("locker") });

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ReadinessFilter>({ packed: "all", priority: "all" });
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

  useEffect(() => {
    if (!itemsQuery.data?.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !itemsQuery.data.some((item) => item.id === selectedId)) {
      setSelectedId(itemsQuery.data[0].id);
    }
  }, [itemsQuery.data, selectedId]);

  const selectedItem = useMemo(
    () => itemsQuery.data?.find((item) => item.id === selectedId) ?? null,
    [itemsQuery.data, selectedId]
  );

  const [formState, setFormState] = useState<LockerFormState | null>(null);

  useEffect(() => {
    if (!selectedItem) {
      setFormState(null);
      return;
    }
    const metadata = parseMetadata(selectedItem.metadata);
    setFormState({
      id: selectedItem.id,
      name: selectedItem.name,
      category: selectedItem.category ?? "",
      quantity: selectedItem.quantity ?? 1,
      slot: selectedItem.slot ?? "",
      notes: selectedItem.notes ?? "",
      tags: parseTags(selectedItem.tags),
      packed: metadata.packed ?? false,
      priority: metadata.priority ?? "standard",
    });
  }, [selectedItem?.id, selectedItem?.updated_at]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    itemsQuery.data?.forEach((item) => {
      if (item.category) {
        set.add(item.category);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [itemsQuery.data]);

  const readinessBuckets = useMemo(() => {
    const base = (itemsQuery.data ?? []).map((item) => {
      const metadata = parseMetadata(item.metadata);
      const priorityValue = metadata.priority;
      const priority: LockerPriority = priorityValue === "essential" || priorityValue === "luxury"
        ? priorityValue
        : "standard";
      return {
        item,
        packed: metadata.packed ?? false,
        priority,
      };
    });
    return base.filter(({ item, packed, priority }) => {
      const matchesSearch = !search
        ? true
        : [item.name, item.category, item.slot, item.notes]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(search.toLowerCase()));
      const matchesPacked =
        filters.packed === "all" || (filters.packed === "packed" ? packed : !packed);
      const matchesPriority = filters.priority === "all" || filters.priority === priority;
      return matchesSearch && matchesPacked && matchesPriority;
    });
  }, [itemsQuery.data, search, filters]);

  const handleSave = () => {
    if (!formState) return;
    updateMutation.mutate({
      id: formState.id,
      updates: {
        name: formState.name,
        category: formState.category,
        quantity: formState.quantity,
        slot: formState.slot,
        notes: formState.notes,
        tags: formState.tags,
        metadata: {
          packed: formState.packed,
          priority: formState.priority,
        },
      },
    });
  };

  const togglePacked = (id: string, packed: boolean) => {
    const existing = itemsQuery.data?.find((item) => item.id === id);
    if (!existing) return;
    const metadata = { ...parseMetadata(existing.metadata), packed };
    updateMutation.mutate({ id, updates: { metadata } });
  };

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
                  onClick={() => setFilters((prev) => ({ ...prev, packed: option.value as ReadinessFilter["packed"] }))}
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
                { label: "Essential", value: "essential" },
                { label: "Standard", value: "standard" },
                { label: "Luxury", value: "luxury" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={filters.priority === option.value ? "locker__chip locker__chip--active" : "locker__chip"}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      priority: option.value as ReadinessFilter["priority"],
                    }))
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
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
          {!itemsQuery.isLoading && readinessBuckets.length === 0 && (
            <p className="locker__empty">No items match the active filters.</p>
          )}
          <ul>
            {readinessBuckets.map(({ item, packed, priority }) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === selectedId ? "locker__item locker__item--active" : "locker__item"}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="locker__item-header">
                    <strong>{item.name}</strong>
                    <label>
                      <input
                        type="checkbox"
                        checked={packed}
                        onChange={(event) => togglePacked(item.id, event.target.checked)}
                      />
                      Packed
                    </label>
                  </div>
                  <div className="locker__item-meta">
                    <span>{item.category ?? "General"}</span>
                    <span>Qty {item.quantity ?? 1}</span>
                    <span className={`locker__badge locker__badge--${priority}`}>{priority}</span>
                  </div>
                  {item.tags && (
                    <div className="locker__item-tags">
                      {parseTags(item.tags).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="locker__detail">
          {formState ? (
            <form
              className="locker__form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSave();
              }}
            >
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
                  <option value="essential">Essential</option>
                  <option value="standard">Standard</option>
                  <option value="luxury">Luxury</option>
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
