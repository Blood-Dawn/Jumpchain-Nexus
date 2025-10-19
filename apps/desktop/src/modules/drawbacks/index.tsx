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

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  createJumpAsset,
  deleteJumpAsset,
  duplicateJump,
  listJumpAssets,
  listJumps,
  summarizeJumpBudget,
  loadSupplementSettings,
  DEFAULT_SUPPLEMENT_SETTINGS,
  loadUniversalDrawbackSettings,
  DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS,
  loadFormatterSettings,
  updateJumpAsset,
  reorderJumpAssets,
  type JumpAssetRecord,
  type JumpRecord,
} from "../../db/dao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBudget } from "../../services/formatter";

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

  const formatterQuery = useQuery({
    queryKey: ["app-settings", "formatter"],
    queryFn: loadFormatterSettings,
    enabled: drawbackSupplementEnabled,
  });

  const universalQuery = useQuery({
    queryKey: ["universal-drawbacks"],
    queryFn: loadUniversalDrawbackSettings,
    enabled: drawbackSupplementEnabled && supplements.enableUniversalDrawbacks,
  });

  const [selectedDrawbackId, setSelectedDrawbackId] = useState<string | null>(null);
  const [formState, setFormState] = useState<DrawbackFormState | null>(null);
  const [orderedDrawbacks, setOrderedDrawbacks] = useState<JumpAssetRecord[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    if (!drawbacksQuery.data?.length) {
      setSelectedDrawbackId(null);
      setFormState(null);
      setOrderedDrawbacks([]);
      return;
    }
  }, [drawbacksQuery.data]);

  const selectedJump = useMemo(
    () => jumpsQuery.data?.find((jump) => jump.id === selectedJumpId) ?? null,
    [jumpsQuery.data, selectedJumpId],
  );

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

  const thousandsSeparator = formatterQuery.data?.thousandsSeparator ?? "none";

  const formatValue = useCallback(
    (value: number) => formatBudget(Number.isFinite(value) ? value : 0, thousandsSeparator),
    [thousandsSeparator]
  );

  const formatNullable = useCallback(
    (value: number | null | undefined) => (value === null || value === undefined ? "—" : formatValue(value)),
    [formatValue]
  );

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    let hasHouseRules = false;

    for (const asset of drawbacksQuery.data ?? []) {
      const trimmed = asset.category?.trim();
      const normalized = trimmed && trimmed.length > 0 ? trimmed : "Uncategorized";
      categories.add(normalized);
      const metadata = parseMetadata(asset.metadata);
      if (metadata.houseRule) {
        hasHouseRules = true;
      }
    }

    const options: Array<{ value: string; label: string }> = [
      { value: "all", label: "All categories" },
    ];

    const sorted = Array.from(categories).sort((a, b) => a.localeCompare(b));
    for (const category of sorted) {
      options.push({ value: category, label: category });
    }

    if (hasHouseRules) {
      options.push({ value: "house", label: "House rules" });
    }

    return options;
  }, [drawbacksQuery.data]);

  useEffect(() => {
    if (!categoryOptions.some((option) => option.value === categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categoryOptions, categoryFilter]);

  const filteredDrawbacks = useMemo(() => {
    const source = orderedDrawbacks.length
      ? orderedDrawbacks
      : (drawbacksQuery.data ?? []);

    if (categoryFilter === "all") {
      return source;
    }

    return source.filter((asset) => {
      const metadata = parseMetadata(asset.metadata);
      if (categoryFilter === "house") {
        return metadata.houseRule === true;
      }
      const trimmed = asset.category?.trim();
      const normalized = trimmed && trimmed.length > 0 ? trimmed : "Uncategorized";
      return normalized === categoryFilter;
    });
  }, [categoryFilter, drawbacksQuery.data, orderedDrawbacks]);

  useEffect(() => {
    if (!filteredDrawbacks.length) {
      if (selectedDrawbackId !== null) {
        setSelectedDrawbackId(null);
      }
      return;
    }

    if (!selectedDrawbackId || !filteredDrawbacks.some((asset) => asset.id === selectedDrawbackId)) {
      setSelectedDrawbackId(filteredDrawbacks[0].id);
    }
  }, [filteredDrawbacks, selectedDrawbackId]);

  const universalSettings = universalQuery.data ?? DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS;

  const universalRewardState = useMemo(() => {
    const empty = { jumper: 0, companion: 0, item: 0, warehouse: 0 };

    if (!supplements.enableUniversalDrawbacks) {
      return {
        stipend: empty,
        eligible: false,
        halved: false,
        message: "Universal Drawback supplement disabled in Options.",
      } as const;
    }

    if (universalQuery.isLoading) {
      return {
        stipend: empty,
        eligible: false,
        halved: false,
        message: "Loading Universal Drawback defaults…",
      } as const;
    }

    if (universalQuery.isError) {
      return {
        stipend: empty,
        eligible: false,
        halved: false,
        message: "Failed to load Universal Drawback settings.",
      } as const;
    }

    if (!selectedJump) {
      return {
        stipend: empty,
        eligible: false,
        halved: false,
        message: "Select a jump to apply Universal Drawback stipends.",
      } as const;
    }

    const isGauntlet = Boolean(selectedJump.status && /gauntlet/i.test(selectedJump.status));
    if (isGauntlet && !universalSettings.allowGauntlet) {
      return {
        stipend: empty,
        eligible: false,
        halved: false,
        message: "Gauntlet stipends disabled by Universal Drawback options.",
      } as const;
    }

    const halved = isGauntlet && universalSettings.gauntletHalved;
    const multiplier = halved ? 0.5 : 1;
    const apply = (value: number) => Math.max(0, Math.floor((value ?? 0) * multiplier));
    const stipend = {
      jumper: apply(universalSettings.totalCP),
      companion: apply(universalSettings.companionCP),
      item: apply(universalSettings.itemCP),
      warehouse: apply(universalSettings.warehouseWP),
    };

    const totalReward = stipend.jumper + stipend.companion + stipend.item + stipend.warehouse;
    if (totalReward === 0) {
      return {
        stipend,
        eligible: false,
        halved,
        message: "No Universal Drawback stipends configured.",
      } as const;
    }

    return {
      stipend,
      eligible: true,
      halved,
      message: halved ? "Gauntlet stipends halved per Universal Drawback options." : null,
    } as const;
  }, [
    supplements.enableUniversalDrawbacks,
    universalQuery.isError,
    universalQuery.isLoading,
    universalSettings,
    selectedJump,
  ]);

  const manualCredit = budgetQuery.data?.drawbackCredit ?? 0;
  const universalJumperCredit = universalRewardState.stipend.jumper;
  const totalCredit = useMemo(
    () => manualCredit + universalJumperCredit,
    [manualCredit, universalJumperCredit],
  );

  const balanceWithGrants = useMemo(() => {
    const baseBalance = budgetQuery.data?.balance;
    if (baseBalance === null || baseBalance === undefined) {
      return null;
    }
    return baseBalance + universalJumperCredit;
  }, [budgetQuery.data?.balance, universalJumperCredit]);

  const totalCount = drawbacksQuery.data?.length ?? 0;
  const visibleCount = filteredDrawbacks.length;

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
          <span data-testid="total-credit">{formatValue(totalCredit)}</span>
        </div>
        <div>
          <strong>Manual Drawbacks</strong>
          <span data-testid="manual-credit">{formatValue(manualCredit)}</span>
        </div>
        <div>
          <strong>Balance w/ Grants</strong>
          <span data-testid="balance-with-grants">{formatNullable(balanceWithGrants)}</span>
        </div>
        <div>
          <strong>Visible Drawbacks</strong>
          <span>
            {visibleCount} / {totalCount}
          </span>
        </div>
      </div>

      <div className="drawbacks__rewards">
        <strong>Universal Rewards</strong>
        <dl data-testid="universal-rewards">
          <div>
            <dt>Jumper CP</dt>
            <dd data-testid="reward-jumper">{formatValue(universalRewardState.stipend.jumper)}</dd>
          </div>
          <div>
            <dt>Companion CP</dt>
            <dd data-testid="reward-companion">{formatValue(universalRewardState.stipend.companion)}</dd>
          </div>
          <div>
            <dt>Item CP</dt>
            <dd data-testid="reward-item">{formatValue(universalRewardState.stipend.item)}</dd>
          </div>
          <div>
            <dt>Warehouse WP</dt>
            <dd data-testid="reward-warehouse">{formatValue(universalRewardState.stipend.warehouse)}</dd>
          </div>
        </dl>
        {universalRewardState.message ? (
          <p className="drawbacks__summary-note">{universalRewardState.message}</p>
        ) : null}
      </div>

      <div className="drawbacks__controls">
        <label>
          <span>Filter by category</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="drawbacks__layout">
        <aside className="drawbacks__list">
          {drawbacksQuery.isLoading && <p className="drawbacks__empty">Loading drawbacks…</p>}
          {drawbacksQuery.isError && <p className="drawbacks__empty">Failed to load drawbacks.</p>}
          {!drawbacksQuery.isLoading && totalCount === 0 && (
            <p className="drawbacks__empty">No drawbacks recorded for this jump.</p>
          )}
          <ul aria-label="Drawback order">
            {filteredDrawbacks.map((asset) => {
              const metadata = parseMetadata(asset.metadata);
              const orderedIndex = orderedDrawbacks.findIndex((candidate) => candidate.id === asset.id);
              if (orderedIndex === -1) {
                return null;
              }
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
                      <span>
                        Credit {formatValue((asset.cost ?? 0) * (asset.quantity ?? 1))}
                        {asset.quantity && asset.quantity > 1 ? ` (×${asset.quantity})` : null}
                      </span>
                      {metadata.houseRule ? <span className="drawbacks__pill">House Rule</span> : null}
                    </div>
                  </button>
                  <div className="drawbacks__order-buttons" role="group" aria-label={`Reorder ${asset.name}`}>
                    <button
                      type="button"
                      aria-label={`Move ${asset.name} earlier`}
                      onClick={() => moveDrawback(orderedIndex, orderedIndex - 1)}
                      disabled={orderedIndex === 0 || reorderMutation.isPending}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${asset.name} later`}
                      onClick={() => moveDrawback(orderedIndex, orderedIndex + 1)}
                      disabled={orderedIndex === orderedDrawbacks.length - 1 || reorderMutation.isPending}
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
