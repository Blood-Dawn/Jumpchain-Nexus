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
  createJumpAsset,
  deleteJumpAsset,
  duplicateJump,
  listJumpAssets,
  listJumps,
  summarizeJumpBudget,
  loadSupplementSettings,
  DEFAULT_SUPPLEMENT_SETTINGS,
  updateJumpAsset,
  reorderJumpAssets,
  type JumpAssetRecord,
  type JumpRecord,
} from "../../db/dao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Severity = "minor" | "moderate" | "severe";

interface DrawbackFormState {
  id: string;
  name: string;
  category: string;
  notes: string;
  severity: Severity;
  houseRule: boolean;
  cpValue: number;
  quantity: number;
}

const parseMetadata = (raw: string | null): { severity?: Severity; houseRule?: boolean } => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { severity?: Severity; houseRule?: boolean };
    return parsed ?? {};
  } catch {
    return {};
  }
};

const DrawbackSupplement: React.FC = () => {
  const queryClient = useQueryClient();
  const supplementsQuery = useQuery({ queryKey: ["supplement-settings"], queryFn: loadSupplementSettings });
  const supplements = supplementsQuery.data ?? DEFAULT_SUPPLEMENT_SETTINGS;
  const drawbackSupplementEnabled = supplements.enableDrawbackSupplement;
  const jumpsQuery = useQuery({ queryKey: ["jumps"], queryFn: listJumps });
  const [selectedJumpId, setSelectedJumpId] = useState<string | null>(null);

  useEffect(() => {
    if (!jumpsQuery.data?.length) {
      setSelectedJumpId(null);
      return;
    }
    if (!selectedJumpId || !jumpsQuery.data.some((jump) => jump.id === selectedJumpId)) {
      setSelectedJumpId(jumpsQuery.data[0].id);
    }
  }, [jumpsQuery.data, selectedJumpId]);

  const drawbacksQuery = useQuery({
    queryKey: ["jump-drawbacks", selectedJumpId],
    queryFn: () =>
      selectedJumpId ? listJumpAssets(selectedJumpId, "drawback") : Promise.resolve([] as JumpAssetRecord[]),
    enabled: Boolean(selectedJumpId && drawbackSupplementEnabled),
  });

  const budgetQuery = useQuery({
    queryKey: ["jump-budget", selectedJumpId],
    queryFn: () => (selectedJumpId ? summarizeJumpBudget(selectedJumpId) : Promise.resolve(null)),
    enabled: Boolean(selectedJumpId && drawbackSupplementEnabled),
  });

  const [selectedDrawbackId, setSelectedDrawbackId] = useState<string | null>(null);
  const [formState, setFormState] = useState<DrawbackFormState | null>(null);
  const [orderedDrawbacks, setOrderedDrawbacks] = useState<JumpAssetRecord[]>([]);

  useEffect(() => {
    if (!drawbacksQuery.data?.length) {
      setSelectedDrawbackId(null);
      setFormState(null);
      setOrderedDrawbacks([]);
      return;
    }
    if (!selectedDrawbackId || !drawbacksQuery.data.some((asset) => asset.id === selectedDrawbackId)) {
      setSelectedDrawbackId(drawbacksQuery.data[0].id);
    }
  }, [drawbacksQuery.data, selectedDrawbackId]);

  useEffect(() => {
    if (!drawbacksQuery.data) {
      setOrderedDrawbacks([]);
      return;
    }
    setOrderedDrawbacks([...drawbacksQuery.data]);
  }, [drawbacksQuery.data]);

  useEffect(() => {
    if (!orderedDrawbacks.length) {
      return;
    }
    if (!selectedDrawbackId || !orderedDrawbacks.some((asset) => asset.id === selectedDrawbackId)) {
      setSelectedDrawbackId(orderedDrawbacks[0]?.id ?? null);
    }
  }, [orderedDrawbacks, selectedDrawbackId]);

  const selectedDrawback = useMemo(
    () => drawbacksQuery.data?.find((asset) => asset.id === selectedDrawbackId) ?? null,
    [drawbacksQuery.data, selectedDrawbackId]
  );

  useEffect(() => {
    if (!selectedDrawback) {
      setFormState(null);
      return;
    }
    const meta = parseMetadata(selectedDrawback.metadata);
    setFormState({
      id: selectedDrawback.id,
      name: selectedDrawback.name,
      category: selectedDrawback.category ?? "",
      notes: selectedDrawback.notes ?? "",
      severity: meta.severity ?? "moderate",
      houseRule: meta.houseRule ?? false,
      cpValue: selectedDrawback.cost ?? 0,
      quantity: selectedDrawback.quantity ?? 1,
    });
  }, [selectedDrawback?.id, selectedDrawback?.updated_at]);

  useEffect(() => {
    if (!drawbackSupplementEnabled) {
      setSelectedDrawbackId(null);
      setFormState(null);
    }
  }, [drawbackSupplementEnabled]);

  const totalCredit = useMemo(() => {
    return (orderedDrawbacks ?? []).reduce(
      (sum, entry) => sum + (entry.cost ?? 0) * (entry.quantity ?? 1),
      0
    );
  }, [orderedDrawbacks]);

  const hasOrderChanges = useMemo(() => {
    if (!drawbacksQuery.data?.length) {
      return false;
    }
    if (!orderedDrawbacks.length) {
      return false;
    }
    if (orderedDrawbacks.length !== drawbacksQuery.data.length) {
      return true;
    }
    return orderedDrawbacks.some((asset, index) => asset.id !== drawbacksQuery.data[index].id);
  }, [drawbacksQuery.data, orderedDrawbacks]);

  const moveDrawback = (fromIndex: number, toIndex: number) => {
    setOrderedDrawbacks((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const resetOrder = () => {
    if (drawbacksQuery.data) {
      setOrderedDrawbacks([...drawbacksQuery.data]);
    } else {
      setOrderedDrawbacks([]);
    }
  };

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedJumpId) {
        throw new Error("Jump not selected");
      }
      return createJumpAsset({
        jump_id: selectedJumpId,
        asset_type: "drawback",
        name: "New Drawback",
        cost: 100,
        notes: "",
      });
    },
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ["jump-drawbacks", selectedJumpId] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["jump-budget", selectedJumpId] }).catch(() => undefined);
      setSelectedDrawbackId(asset.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; updates: Parameters<typeof updateJumpAsset>[1] }) =>
      updateJumpAsset(payload.id, payload.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jump-drawbacks", selectedJumpId] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["jump-budget", selectedJumpId] }).catch(() => undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJumpAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jump-drawbacks", selectedJumpId] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["jump-budget", selectedJumpId] }).catch(() => undefined);
      setSelectedDrawbackId(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (jumpId: string) => duplicateJump(jumpId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jumps"] }).catch(() => undefined);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (payload: { jumpId: string; orderedIds: string[] }) =>
      reorderJumpAssets(payload.jumpId, "drawback", payload.orderedIds),
    onSuccess: (_, variables) => {
      const { jumpId, orderedIds } = variables;
      queryClient.setQueryData<JumpAssetRecord[] | undefined>(
        ["jump-drawbacks", jumpId],
        (existing) => {
          if (!existing) {
            return existing;
          }
          const lookup = new Map(existing.map((asset) => [asset.id, asset]));
          return orderedIds
            .map((id) => lookup.get(id))
            .filter((asset): asset is JumpAssetRecord => Boolean(asset));
        }
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["jump-drawbacks", selectedJumpId] }).catch(() => undefined);
    },
  });

  const confirmOrder = () => {
    if (!selectedJumpId || !orderedDrawbacks.length) {
      return;
    }
    reorderMutation.mutate({
      jumpId: selectedJumpId,
      orderedIds: orderedDrawbacks.map((asset) => asset.id),
    });
  };

  if (supplementsQuery.isLoading) {
    return (
      <section className="drawbacks">
        <header className="drawbacks__header">
          <h1>Drawback Supplement</h1>
          <p>Track drawback purchases, house rules, and bonus CP.</p>
        </header>
        <p className="drawbacks__summary">Loading supplement preferences...</p>
      </section>
    );
  }

  if (supplementsQuery.isError) {
    return (
      <section className="drawbacks">
        <header className="drawbacks__header">
          <h1>Drawback Supplement</h1>
          <p>Track drawback purchases, house rules, and bonus CP.</p>
        </header>
        <p className="drawbacks__summary">
          Unable to load supplement preferences. Try reopening the Options module.
        </p>
      </section>
    );
  }

  if (!drawbackSupplementEnabled) {
    return (
      <section className="drawbacks">
        <header className="drawbacks__header">
          <h1>Drawback Supplement</h1>
          <p>Track drawback purchases, house rules, and bonus CP.</p>
        </header>
        <p className="drawbacks__summary">
          The Drawback Supplement is disabled. Enable it from Options &gt; Supplements to resume editing.
        </p>
      </section>
    );
  }

  const handleSave = () => {
    if (!formState) return;
    updateMutation.mutate({
      id: formState.id,
      updates: {
        name: formState.name,
        category: formState.category,
        notes: formState.notes,
        cost: Math.max(formState.cpValue, 0),
        quantity: Math.max(formState.quantity, 1),
        metadata: {
          severity: formState.severity,
          houseRule: formState.houseRule,
        },
      },
    });
  };

  const handleDelete = () => {
    if (selectedDrawbackId) {
      deleteMutation.mutate(selectedDrawbackId);
    }
  };

  return (
    <section className="drawbacks">
      <header className="drawbacks__header">
        <div>
          <h1>Drawback Supplement</h1>
          <p>Balance chains by tracking drawback credit, severity, and house rules per jump.</p>
        </div>
        <div className="drawbacks__header-actions">
          <label>
            <span>Active Jump</span>
            <select
              value={selectedJumpId ?? ""}
              onChange={(event) => setSelectedJumpId(event.target.value || null)}
            >
              {jumpsQuery.data?.map((jump: JumpRecord) => (
                <option key={jump.id} value={jump.id}>
                  {jump.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => createMutation.mutate()} disabled={!selectedJumpId || createMutation.isPending}>
            {createMutation.isPending ? "Adding…" : "Add Drawback"}
          </button>
        </div>
      </header>

      <div className="drawbacks__summary">
        <div>
          <strong>Total Credit</strong>
          <span>{totalCredit}</span>
        </div>
        <div>
          <strong>Budget Balance</strong>
          <span>{budgetQuery.data?.balance ?? "—"}</span>
        </div>
        <div>
          <strong>Drawback Count</strong>
          <span>{drawbacksQuery.data?.length ?? 0}</span>
        </div>
      </div>

      <div className="drawbacks__layout">
        <aside className="drawbacks__list">
          {drawbacksQuery.isLoading && <p className="drawbacks__empty">Loading drawbacks…</p>}
          {drawbacksQuery.isError && <p className="drawbacks__empty">Failed to load drawbacks.</p>}
          {!drawbacksQuery.isLoading && (drawbacksQuery.data?.length ?? 0) === 0 && (
            <p className="drawbacks__empty">No drawbacks recorded for this jump.</p>
          )}
          <ul aria-label="Drawback order">
            {orderedDrawbacks.map((asset, index) => {
              const metadata = parseMetadata(asset.metadata);
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    className={asset.id === selectedDrawbackId ? "drawbacks__item drawbacks__item--active" : "drawbacks__item"}
                    onClick={() => setSelectedDrawbackId(asset.id)}
                  >
                    <div className="drawbacks__item-title">
                      <strong>{asset.name}</strong>
                      <span className={`drawbacks__badge drawbacks__badge--${metadata.severity ?? "moderate"}`}>
                        {metadata.severity ?? "moderate"}
                      </span>
                    </div>
                    <div className="drawbacks__item-meta">
                      <span>{asset.category ?? "Uncategorized"}</span>
                      <span>Credit {asset.cost ?? 0}</span>
                      {metadata.houseRule ? <span className="drawbacks__pill">House Rule</span> : null}
                    </div>
                  </button>
                  <div className="drawbacks__order-buttons" role="group" aria-label={`Reorder ${asset.name}`}>
                    <button
                      type="button"
                      aria-label={`Move ${asset.name} earlier`}
                      onClick={() => moveDrawback(index, index - 1)}
                      disabled={index === 0 || reorderMutation.isPending}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${asset.name} later`}
                      onClick={() => moveDrawback(index, index + 1)}
                      disabled={index === orderedDrawbacks.length - 1 || reorderMutation.isPending}
                    >
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="drawbacks__order-controls" aria-live="polite">
            <button
              type="button"
              onClick={confirmOrder}
              disabled={!hasOrderChanges || reorderMutation.isPending || !selectedJumpId}
            >
              {reorderMutation.isPending ? "Saving Order…" : "Save Order"}
            </button>
            <button
              type="button"
              onClick={resetOrder}
              disabled={!hasOrderChanges || reorderMutation.isPending}
            >
              Reset Order
            </button>
            {reorderMutation.isError ? (
              <p role="alert" className="drawbacks__order-feedback">
                Unable to update drawback order. Please try again.
              </p>
            ) : null}
          </div>
        </aside>

        <div className="drawbacks__detail">
          {formState ? (
            <form
              className="drawbacks__form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSave();
              }}
            >
              <label>
                <span>Drawback Name</span>
                <input
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                  }
                  required
                />
              </label>

              <div className="drawbacks__grid">
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
                  <span>Severity</span>
                  <select
                    value={formState.severity}
                    onChange={(event) =>
                      setFormState((prev) =>
                        prev ? { ...prev, severity: event.target.value as Severity } : prev
                      )
                    }
                  >
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </label>
                <label>
                  <span>Credit (CP)</span>
                  <input
                    type="number"
                    min={0}
                    value={formState.cpValue}
                    onChange={(event) =>
                      setFormState((prev) =>
                        prev ? { ...prev, cpValue: Number(event.target.value) || 0 } : prev
                      )
                    }
                  />
                </label>
                <label>
                  <span>Quantity</span>
                  <input
                    type="number"
                    min={1}
                    value={formState.quantity}
                    onChange={(event) =>
                      setFormState((prev) =>
                        prev ? { ...prev, quantity: Number(event.target.value) || 1 } : prev
                      )
                    }
                  />
                </label>
              </div>

              <label className="drawbacks__toggle">
                <input
                  type="checkbox"
                  checked={formState.houseRule}
                  onChange={(event) =>
                    setFormState((prev) => (prev ? { ...prev, houseRule: event.target.checked } : prev))
                  }
                />
                Counts as a house rule adjustment
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

              <div className="drawbacks__form-actions">
                <div className="drawbacks__form-left">
                  <button
                    type="button"
                    onClick={() => selectedJumpId && duplicateMutation.mutate(selectedJumpId)}
                  >
                    Clone Jump
                  </button>
                  <button type="button" className="drawbacks__danger" onClick={handleDelete}>
                    Delete Drawback
                  </button>
                </div>
                <button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          ) : (
            <div className="drawbacks__empty">
              <p>Select a drawback to edit its details.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DrawbackSupplement;
