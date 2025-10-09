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
  updateJumpAsset,
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
    enabled: Boolean(selectedJumpId),
  });

  const budgetQuery = useQuery({
    queryKey: ["jump-budget", selectedJumpId],
    queryFn: () => (selectedJumpId ? summarizeJumpBudget(selectedJumpId) : Promise.resolve(null)),
    enabled: Boolean(selectedJumpId),
  });

  const [selectedDrawbackId, setSelectedDrawbackId] = useState<string | null>(null);
  const [formState, setFormState] = useState<DrawbackFormState | null>(null);

  useEffect(() => {
    if (!drawbacksQuery.data?.length) {
      setSelectedDrawbackId(null);
      setFormState(null);
      return;
    }
    if (!selectedDrawbackId || !drawbacksQuery.data.some((asset) => asset.id === selectedDrawbackId)) {
      setSelectedDrawbackId(drawbacksQuery.data[0].id);
    }
  }, [drawbacksQuery.data, selectedDrawbackId]);

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

  const totalCredit = useMemo(() => {
    return (drawbacksQuery.data ?? []).reduce((sum, entry) => sum + (entry.cost ?? 0) * (entry.quantity ?? 1), 0);
  }, [drawbacksQuery.data]);

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
          <ul>
            {drawbacksQuery.data?.map((asset) => {
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
                </li>
              );
            })}
          </ul>
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
