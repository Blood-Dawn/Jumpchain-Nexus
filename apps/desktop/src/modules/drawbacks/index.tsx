/*
Bloodawn

Copyright (c) 2025 Bloodawn

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

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
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
  updateJumpAsset,
  reorderJumpAssets,
  type JumpAssetRecord,
  type JumpRecord,
  type JumpBudgetSummary,
  type UniversalDrawbackSettings,
} from "../../db/dao";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { formatBudget } from "../../services/formatter";
import { useFormatterPreferences } from "../../hooks/useFormatterPreferences";

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

type SupplementSettings = typeof DEFAULT_SUPPLEMENT_SETTINGS;
type UniversalDrawbackDefaults = UniversalDrawbackSettings;

interface SupplementSettingsState {
  supplementsQuery: UseQueryResult<SupplementSettings>;
  supplements: SupplementSettings;
  drawbackSupplementEnabled: boolean;
}

const useSupplementSettingsState = (): SupplementSettingsState => {
  const supplementsQuery = useQuery<SupplementSettings>({
    queryKey: ["supplement-settings"],
    queryFn: loadSupplementSettings,
  });
  const supplements = supplementsQuery.data ?? DEFAULT_SUPPLEMENT_SETTINGS;

  return {
    supplementsQuery,
    supplements,
    drawbackSupplementEnabled: supplements.enableDrawbackSupplement,
  };
};

interface JumpSelectionState {
  jumpsQuery: UseQueryResult<JumpRecord[]>;
  selectedJumpId: string | null;
  setSelectedJumpId: Dispatch<SetStateAction<string | null>>;
  selectedJump: JumpRecord | null;
}

const useJumpSelection = (drawbackSupplementEnabled: boolean): JumpSelectionState => {
  const jumpsQuery = useQuery<JumpRecord[]>({ queryKey: ["jumps"], queryFn: listJumps });
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

  useEffect(() => {
    if (!drawbackSupplementEnabled) {
      setSelectedJumpId(null);
    }
  }, [drawbackSupplementEnabled]);

  const selectedJump = useMemo(
    () => (selectedJumpId ? jumpsQuery.data?.find((jump) => jump.id === selectedJumpId) ?? null : null),
    [jumpsQuery.data, selectedJumpId],
  );

  return { jumpsQuery, selectedJumpId, setSelectedJumpId, selectedJump };
};

interface DrawbackQueriesState {
  drawbacksQuery: UseQueryResult<JumpAssetRecord[]>;
  budgetQuery: UseQueryResult<JumpBudgetSummary | null>;
  formatterQuery: ReturnType<typeof useFormatterPreferences>;
  universalQuery: UseQueryResult<UniversalDrawbackDefaults>;
}

const useDrawbackQueries = (
  selectedJumpId: string | null,
  drawbackSupplementEnabled: boolean,
  supplements: SupplementSettings,
): DrawbackQueriesState => {
  const drawbacksQuery = useQuery<JumpAssetRecord[]>({
    queryKey: ["jump-drawbacks", selectedJumpId],
    queryFn: () =>
      selectedJumpId ? listJumpAssets(selectedJumpId, "drawback") : Promise.resolve([] as JumpAssetRecord[]),
    enabled: Boolean(selectedJumpId && drawbackSupplementEnabled),
  });

  const budgetQuery = useQuery<JumpBudgetSummary | null>({
    queryKey: ["jump-budget", selectedJumpId],
    queryFn: () => (selectedJumpId ? summarizeJumpBudget(selectedJumpId) : Promise.resolve(null)),
    enabled: Boolean(selectedJumpId && drawbackSupplementEnabled),
  });

  const formatterQuery = useFormatterPreferences({ enabled: drawbackSupplementEnabled });

  const universalQuery = useQuery<UniversalDrawbackDefaults>({
    queryKey: ["universal-drawbacks"],
    queryFn: loadUniversalDrawbackSettings,
    enabled: drawbackSupplementEnabled && supplements.enableUniversalDrawbacks,
  });

  return { drawbacksQuery, budgetQuery, formatterQuery, universalQuery };
};

interface OrderedDrawbacksState {
  orderedDrawbacks: JumpAssetRecord[];
  hasOrderChanges: boolean;
  moveDrawback: (fromIndex: number, toIndex: number) => void;
  resetOrder: () => void;
}

const useOrderedDrawbacks = (drawbacks: JumpAssetRecord[] | undefined): OrderedDrawbacksState => {
  const [orderedDrawbacks, setOrderedDrawbacks] = useState<JumpAssetRecord[]>([]);

  useEffect(() => {
    if (!drawbacks) {
      setOrderedDrawbacks([]);
      return;
    }
    setOrderedDrawbacks([...drawbacks]);
  }, [drawbacks]);

  const hasOrderChanges = useMemo(() => {
    if (!drawbacks?.length) {
      return false;
    }
    if (!orderedDrawbacks.length) {
      return false;
    }
    if (orderedDrawbacks.length !== drawbacks.length) {
      return true;
    }
    return orderedDrawbacks.some((asset, index) => asset.id !== drawbacks[index].id);
  }, [drawbacks, orderedDrawbacks]);

  const moveDrawback = useCallback((fromIndex: number, toIndex: number) => {
    setOrderedDrawbacks((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const resetOrder = useCallback(() => {
    if (drawbacks) {
      setOrderedDrawbacks([...drawbacks]);
    } else {
      setOrderedDrawbacks([]);
    }
  }, [drawbacks]);

  return { orderedDrawbacks, hasOrderChanges, moveDrawback, resetOrder };
};

interface DrawbackFiltersState {
  categoryFilter: string;
  setCategoryFilter: Dispatch<SetStateAction<string>>;
  severityFilter: string;
  setSeverityFilter: Dispatch<SetStateAction<string>>;
  categoryOptions: Array<{ value: string; label: string }>;
  filteredDrawbacks: JumpAssetRecord[];
  filteredDrawbackIds: Set<string>;
}

const useDrawbackFilters = (drawbacks: JumpAssetRecord[] | undefined): DrawbackFiltersState => {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    let hasHouseRules = false;

    for (const asset of drawbacks ?? []) {
      const trimmed = asset.category?.trim();
      const normalized = trimmed && trimmed.length > 0 ? trimmed : "Uncategorized";
      categories.add(normalized);
      const metadata = parseMetadata(asset.metadata);
      if (metadata.houseRule) {
        hasHouseRules = true;
      }
    }

    const options: Array<{ value: string; label: string }> = [{ value: "all", label: "All categories" }];
    const sorted = Array.from(categories).sort((a, b) => a.localeCompare(b));

    for (const category of sorted) {
      options.push({ value: category, label: category });
    }

    if (hasHouseRules) {
      options.push({ value: "house", label: "House rules" });
    }

    return options;
  }, [drawbacks]);

  useEffect(() => {
    if (!categoryOptions.some((option) => option.value === categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categoryOptions, categoryFilter]);

  const filteredDrawbacks = useMemo(() => {
    const all = drawbacks ?? [];

    return all.filter((asset) => {
      const metadata = parseMetadata(asset.metadata);
      const matchesCategory = (() => {
        if (categoryFilter === "all") {
          return true;
        }
        if (categoryFilter === "house") {
          return metadata.houseRule === true;
        }
        const trimmed = asset.category?.trim();
        const normalized = trimmed && trimmed.length > 0 ? trimmed : "Uncategorized";
        return normalized === categoryFilter;
      })();

      if (!matchesCategory) {
        return false;
      }

      if (severityFilter === "all") {
        return true;
      }

      const severity = metadata.severity ?? "moderate";
      return severity === severityFilter;
    });
  }, [drawbacks, categoryFilter, severityFilter]);

  const filteredDrawbackIds = useMemo(
    () => new Set(filteredDrawbacks.map((asset) => asset.id)),
    [filteredDrawbacks],
  );

  return {
    categoryFilter,
    setCategoryFilter,
    severityFilter,
    setSeverityFilter,
    categoryOptions,
    filteredDrawbacks,
    filteredDrawbackIds,
  };
};

interface SelectedDrawbackState {
  selectedDrawbackId: string | null;
  setSelectedDrawbackId: Dispatch<SetStateAction<string | null>>;
  selectedDrawback: JumpAssetRecord | null;
}

const useSelectedDrawback = (
  orderedDrawbacks: JumpAssetRecord[],
  filteredDrawbacks: JumpAssetRecord[],
  allDrawbacks: JumpAssetRecord[] | undefined,
  drawbackSupplementEnabled: boolean,
): SelectedDrawbackState => {
  const [selectedDrawbackId, setSelectedDrawbackId] = useState<string | null>(null);

  useEffect(() => {
    if (!allDrawbacks?.length) {
      setSelectedDrawbackId(null);
    }
  }, [allDrawbacks]);

  useEffect(() => {
    if (!orderedDrawbacks.length) {
      return;
    }
    if (!selectedDrawbackId || !orderedDrawbacks.some((asset) => asset.id === selectedDrawbackId)) {
      setSelectedDrawbackId(orderedDrawbacks[0]?.id ?? null);
    }
  }, [orderedDrawbacks, selectedDrawbackId]);

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

  useEffect(() => {
    if (!drawbackSupplementEnabled) {
      setSelectedDrawbackId(null);
    }
  }, [drawbackSupplementEnabled]);

  const selectedDrawback = useMemo(
    () => allDrawbacks?.find((asset) => asset.id === selectedDrawbackId) ?? null,
    [allDrawbacks, selectedDrawbackId],
  );

  return { selectedDrawbackId, setSelectedDrawbackId, selectedDrawback };
};

const useDrawbackFormState = (
  selectedDrawback: JumpAssetRecord | null,
  drawbackSupplementEnabled: boolean,
): {
  formState: DrawbackFormState | null;
  setFormState: Dispatch<SetStateAction<DrawbackFormState | null>>;
} => {
  const [formState, setFormState] = useState<DrawbackFormState | null>(null);

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
      setFormState(null);
    }
  }, [drawbackSupplementEnabled]);

  return { formState, setFormState };
};

interface BudgetFormatter {
  formatValue: (value: number) => string;
  formatNullable: (value: number | null | undefined) => string;
}

const useBudgetFormatter = (thousandsSeparator: string | undefined): BudgetFormatter => {
  const separator = thousandsSeparator ?? "none";

  const formatValue = useCallback(
    (value: number) => formatBudget(Number.isFinite(value) ? value : 0, separator),
    [separator],
  );

  const formatNullable = useCallback(
    (value: number | null | undefined) => (value === null || value === undefined ? "—" : formatValue(value)),
    [formatValue],
  );

  return { formatValue, formatNullable };
};

interface UniversalRewardState {
  stipend: {
    jumper: number;
    companion: number;
    item: number;
    warehouse: number;
  };
  eligible: boolean;
  halved: boolean;
  message: string | null;
}

const useUniversalRewardState = (
  supplements: SupplementSettings,
  universalQuery: UseQueryResult<UniversalDrawbackDefaults>,
  selectedJump: JumpRecord | null,
): UniversalRewardState => {
  const empty = useMemo(() => ({ jumper: 0, companion: 0, item: 0, warehouse: 0 }), []);

  return useMemo(() => {
    if (!supplements.enableUniversalDrawbacks) {
      return {
        stipend: empty,
        eligible: false,
        halved: false,
        message: "Universal Drawback supplement disabled in Options.",
      };
    }

    if (universalQuery.isLoading) {
      return {
        stipend: empty,
        eligible: false,
        halved: false,
        message: "Loading Universal Drawback defaults…",
      };
    }

    if (universalQuery.isError) {
      return {
        stipend: empty,
        eligible: false,
        halved: false,
        message: "Failed to load Universal Drawback settings.",
      };
    }

    if (!selectedJump) {
      return {
        stipend: empty,
        eligible: false,
        halved: false,
        message: "Select a jump to apply Universal Drawback stipends.",
      };
    }

    const settings = universalQuery.data ?? DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS;
    const isGauntlet = Boolean(selectedJump.status && /gauntlet/i.test(selectedJump.status));
    if (isGauntlet && !settings.allowGauntlet) {
      return {
        stipend: empty,
        eligible: false,
        halved: false,
        message: "Gauntlet stipends disabled by Universal Drawback options.",
      };
    }

    const halved = isGauntlet && settings.gauntletHalved;
    const multiplier = halved ? 0.5 : 1;
    const apply = (value: number) => Math.max(0, Math.floor((value ?? 0) * multiplier));
    const stipend = {
      jumper: apply(settings.totalCP),
      companion: apply(settings.companionCP),
      item: apply(settings.itemCP),
      warehouse: apply(settings.warehouseWP),
    };

    const totalReward = stipend.jumper + stipend.companion + stipend.item + stipend.warehouse;
    if (totalReward === 0) {
      return {
        stipend,
        eligible: false,
        halved,
        message: "No Universal Drawback stipends configured.",
      };
    }

    return {
      stipend,
      eligible: true,
      halved,
      message: halved ? "Gauntlet stipends halved per Universal Drawback options." : null,
    };
  }, [empty, selectedJump, supplements.enableUniversalDrawbacks, universalQuery.data, universalQuery.isError, universalQuery.isLoading]);
};

interface BudgetSummary {
  manualCredit: number;
  totalCredit: number;
  balanceWithGrants: number | null;
}

const useBudgetSummary = (
  budget: JumpBudgetSummary | null | undefined,
  universalJumperCredit: number,
): BudgetSummary => {
  const manualCredit = budget?.drawbackCredit ?? 0;
  const balance = budget?.balance;

  const totalCredit = useMemo(
    () => manualCredit + universalJumperCredit,
    [manualCredit, universalJumperCredit],
  );

  const balanceWithGrants = useMemo(() => {
    if (balance === null || balance === undefined) {
      return null;
    }
    return balance + universalJumperCredit;
  }, [balance, universalJumperCredit]);

  return { manualCredit, totalCredit, balanceWithGrants };
};

const useDrawbackMutations = (
  queryClient: ReturnType<typeof useQueryClient>,
  selectedJumpId: string | null,
  setSelectedDrawbackId: Dispatch<SetStateAction<string | null>>,
) => {
  const createMutation = useMutation({
    mutationFn: async () => {
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
      if (!selectedJumpId) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["jump-drawbacks", selectedJumpId] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["jump-budget", selectedJumpId] }).catch(() => undefined);
      setSelectedDrawbackId(asset.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; updates: Parameters<typeof updateJumpAsset>[1] }) =>
      updateJumpAsset(payload.id, payload.updates),
    onSuccess: () => {
      if (!selectedJumpId) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["jump-drawbacks", selectedJumpId] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["jump-budget", selectedJumpId] }).catch(() => undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJumpAsset(id),
    onSuccess: () => {
      if (!selectedJumpId) {
        return;
      }
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
      queryClient.setQueryData<JumpAssetRecord[] | undefined>(["jump-drawbacks", jumpId], (existing) => {
        if (!existing) {
          return existing;
        }
        const lookup = new Map(existing.map((asset) => [asset.id, asset]));
        return orderedIds
          .map((id) => lookup.get(id))
          .filter((asset): asset is JumpAssetRecord => Boolean(asset));
      });
      queryClient.invalidateQueries({ queryKey: ["jump-budget", jumpId] }).catch(() => undefined);
    },
    onError: () => {
      if (!selectedJumpId) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["jump-drawbacks", selectedJumpId] }).catch(() => undefined);
    },
  });

  return { createMutation, updateMutation, deleteMutation, duplicateMutation, reorderMutation };
};

const LoadingView = () => (
  <section className="drawbacks">
    <header className="drawbacks__header">
      <h1>Drawback Supplement</h1>
      <p>Track drawback purchases, house rules, and bonus CP.</p>
    </header>
    <p className="drawbacks__summary">Loading supplement preferences...</p>
  </section>
);

const ErrorView = () => (
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

const DisabledView = () => (
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

interface DrawbackSupplementHeaderProps {
  jumps: JumpRecord[] | undefined;
  selectedJumpId: string | null;
  onSelectJump: (jumpId: string | null) => void;
  onAddDrawback: () => void;
  createPending: boolean;
}

const DrawbackSupplementHeader = ({
  jumps,
  selectedJumpId,
  onSelectJump,
  onAddDrawback,
  createPending,
}: DrawbackSupplementHeaderProps) => (
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
          onChange={(event) => onSelectJump(event.target.value || null)}
        >
          {jumps?.map((jump) => (
            <option key={jump.id} value={jump.id}>
              {jump.title}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onAddDrawback}
        disabled={!selectedJumpId || createPending}
      >
        {createPending ? "Adding…" : "Add Drawback"}
      </button>
    </div>
  </header>
);

interface DrawbackSummaryProps {
  formatValue: (value: number) => string;
  formatNullable: (value: number | null | undefined) => string;
  totalCredit: number;
  manualCredit: number;
  balanceWithGrants: number | null;
  visibleCount: number;
  totalCount: number;
}

const DrawbackSummary = ({
  formatValue,
  formatNullable,
  totalCredit,
  manualCredit,
  balanceWithGrants,
  visibleCount,
  totalCount,
}: DrawbackSummaryProps) => (
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
);

interface UniversalRewardsProps {
  universalRewardState: UniversalRewardState;
  formatValue: (value: number) => string;
}

const UniversalRewards = ({ universalRewardState, formatValue }: UniversalRewardsProps) => (
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
);

interface DrawbackFiltersProps {
  categoryFilter: string;
  setCategoryFilter: Dispatch<SetStateAction<string>>;
  categoryOptions: Array<{ value: string; label: string }>;
  severityFilter: string;
  setSeverityFilter: Dispatch<SetStateAction<string>>;
}

const DrawbackFilters = ({
  categoryFilter,
  setCategoryFilter,
  categoryOptions,
  severityFilter,
  setSeverityFilter,
}: DrawbackFiltersProps) => (
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
    <div className="drawbacks__segmented" role="group" aria-label="Filter by severity">
      {[
        { value: "all" as const, label: "All" },
        { value: "minor" as const, label: "Minor" },
        { value: "moderate" as const, label: "Moderate" },
        { value: "severe" as const, label: "Severe" },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          className={
            severityFilter === option.value
              ? "drawbacks__segmented-button drawbacks__segmented-button--active"
              : "drawbacks__segmented-button"
          }
          aria-pressed={severityFilter === option.value}
          onClick={() => setSeverityFilter(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

interface DrawbackListProps {
  isLoading: boolean;
  isError: boolean;
  totalCount: number;
  orderedDrawbacks: JumpAssetRecord[];
  filteredDrawbackIds: Set<string>;
  selectedDrawbackId: string | null;
  onSelectDrawback: (id: string) => void;
  formatValue: (value: number) => string;
  moveDrawback: (fromIndex: number, toIndex: number) => void;
  reorderPending: boolean;
  hasOrderChanges: boolean;
  confirmOrder: () => void;
  resetOrder: () => void;
  reorderError: boolean;
}

const DrawbackList = ({
  isLoading,
  isError,
  totalCount,
  orderedDrawbacks,
  filteredDrawbackIds,
  selectedDrawbackId,
  onSelectDrawback,
  formatValue,
  moveDrawback,
  reorderPending,
  hasOrderChanges,
  confirmOrder,
  resetOrder,
  reorderError,
}: DrawbackListProps) => (
  <aside className="drawbacks__list">
    {isLoading && <p className="drawbacks__empty">Loading drawbacks…</p>}
    {isError && <p className="drawbacks__empty">Failed to load drawbacks.</p>}
    {!isLoading && totalCount === 0 && (
      <p className="drawbacks__empty">No drawbacks recorded for this jump.</p>
    )}
    <ul aria-label="Drawback order">
      {orderedDrawbacks.map((asset, index) => {
        if (!filteredDrawbackIds.has(asset.id)) {
          return null;
        }
        const metadata = parseMetadata(asset.metadata);
        const severity =
          metadata.severity === "minor" || metadata.severity === "moderate" || metadata.severity === "severe"
            ? metadata.severity
            : "moderate";
        const severityLabel = `${severity.charAt(0).toUpperCase()}${severity.slice(1)}`;
        const itemClassName = [
          "drawbacks__item",
          `drawbacks__item--${severity}`,
          asset.id === selectedDrawbackId ? "drawbacks__item--active" : null,
        ]
          .filter(Boolean)
          .join(" ");
        const badgeClassName = `drawbacks__badge drawbacks__badge--${severity}`;
        return (
          <li key={asset.id}>
            <button type="button" className={itemClassName} onClick={() => onSelectDrawback(asset.id)}>
              <div className="drawbacks__item-title">
                <strong>{asset.name}</strong>
                <span className={badgeClassName}>
                  <span className="drawbacks__badge-icon" aria-hidden="true" />
                  <span className="drawbacks__badge-label">{severityLabel}</span>
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
                onClick={() => moveDrawback(index, index - 1)}
                disabled={index === 0 || reorderPending}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${asset.name} later`}
                onClick={() => moveDrawback(index, index + 1)}
                disabled={index === orderedDrawbacks.length - 1 || reorderPending}
              >
                ↓
              </button>
            </div>
          </li>
        );
      })}
    </ul>
    <div className="drawbacks__order-controls" aria-live="polite">
      <button type="button" onClick={confirmOrder} disabled={!hasOrderChanges || reorderPending}>
        {reorderPending ? "Saving Order…" : "Save Order"}
      </button>
      <button type="button" onClick={resetOrder} disabled={!hasOrderChanges || reorderPending}>
        Reset Order
      </button>
      {reorderError ? (
        <p role="alert" className="drawbacks__order-feedback">
          Unable to update drawback order. Please try again.
        </p>
      ) : null}
    </div>
  </aside>
);

interface DrawbackDetailProps {
  formState: DrawbackFormState | null;
  setFormState: Dispatch<SetStateAction<DrawbackFormState | null>>;
  onSave: () => void;
  onDelete: () => void;
  onCloneJump: () => void;
  savePending: boolean;
  clonePending: boolean;
  selectedJumpId: string | null;
}

const DrawbackDetail = ({
  formState,
  setFormState,
  onSave,
  onDelete,
  onCloneJump,
  savePending,
  clonePending,
  selectedJumpId,
}: DrawbackDetailProps) => {
  if (!formState) {
    return (
      <div className="drawbacks__empty">
        <p>Select a drawback to edit its details.</p>
      </div>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };

  return (
    <form className="drawbacks__form" onSubmit={handleSubmit}>
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
                prev ? { ...prev, severity: event.target.value as Severity } : prev,
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
                prev ? { ...prev, cpValue: Number(event.target.value) || 0 } : prev,
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
                prev ? { ...prev, quantity: Number(event.target.value) || 1 } : prev,
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
          <button type="button" onClick={onCloneJump} disabled={!selectedJumpId || clonePending}>
            {clonePending ? "Cloning…" : "Clone Jump"}
          </button>
          <button type="button" className="drawbacks__danger" onClick={onDelete}>
            Delete Drawback
          </button>
        </div>
        <button type="submit" disabled={savePending}>
          {savePending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
};

const DrawbackSupplement: React.FC = () => {
  const queryClient = useQueryClient();
  const { supplementsQuery, supplements, drawbackSupplementEnabled } = useSupplementSettingsState();
  const { jumpsQuery, selectedJumpId, setSelectedJumpId, selectedJump } = useJumpSelection(drawbackSupplementEnabled);
  const { drawbacksQuery, budgetQuery, formatterQuery, universalQuery } = useDrawbackQueries(
    selectedJumpId,
    drawbackSupplementEnabled,
    supplements,
  );
  const { orderedDrawbacks, hasOrderChanges, moveDrawback, resetOrder } = useOrderedDrawbacks(drawbacksQuery.data);
  const filters = useDrawbackFilters(drawbacksQuery.data);
  const { selectedDrawbackId, setSelectedDrawbackId, selectedDrawback } = useSelectedDrawback(
    orderedDrawbacks,
    filters.filteredDrawbacks,
    drawbacksQuery.data,
    drawbackSupplementEnabled,
  );
  const { formState, setFormState } = useDrawbackFormState(selectedDrawback, drawbackSupplementEnabled);
  const { formatValue, formatNullable } = useBudgetFormatter(formatterQuery.data?.thousandsSeparator);
  const universalRewardState = useUniversalRewardState(supplements, universalQuery, selectedJump);
  const { manualCredit, totalCredit, balanceWithGrants } = useBudgetSummary(
    budgetQuery.data,
    universalRewardState.stipend.jumper,
  );
  const { createMutation, updateMutation, deleteMutation, duplicateMutation, reorderMutation } = useDrawbackMutations(
    queryClient,
    selectedJumpId,
    setSelectedDrawbackId,
  );

  const totalCount = drawbacksQuery.data?.length ?? 0;
  const visibleCount = filters.filteredDrawbacks.length;

  const confirmOrder = useCallback(() => {
    if (!selectedJumpId || !orderedDrawbacks.length) {
      return;
    }
    reorderMutation.mutate({
      jumpId: selectedJumpId,
      orderedIds: orderedDrawbacks.map((asset) => asset.id),
    });
  }, [orderedDrawbacks, reorderMutation, selectedJumpId]);

  const handleSave = useCallback(() => {
    if (!formState) {
      return;
    }
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
  }, [formState, updateMutation]);

  const handleDelete = useCallback(() => {
    if (selectedDrawbackId) {
      deleteMutation.mutate(selectedDrawbackId);
    }
  }, [deleteMutation, selectedDrawbackId]);

  const handleCloneJump = useCallback(() => {
    if (selectedJumpId) {
      duplicateMutation.mutate(selectedJumpId);
    }
  }, [duplicateMutation, selectedJumpId]);

  if (supplementsQuery.isLoading) {
    return <LoadingView />;
  }

  if (supplementsQuery.isError) {
    return <ErrorView />;
  }

  if (!drawbackSupplementEnabled) {
    return <DisabledView />;
  }

  return (
    <section className="drawbacks">
      <DrawbackSupplementHeader
        jumps={jumpsQuery.data}
        selectedJumpId={selectedJumpId}
        onSelectJump={setSelectedJumpId}
        onAddDrawback={() => createMutation.mutate()}
        createPending={createMutation.isPending}
      />

      <DrawbackSummary
        formatValue={formatValue}
        formatNullable={formatNullable}
        totalCredit={totalCredit}
        manualCredit={manualCredit}
        balanceWithGrants={balanceWithGrants}
        visibleCount={visibleCount}
        totalCount={totalCount}
      />

      <UniversalRewards universalRewardState={universalRewardState} formatValue={formatValue} />

      <DrawbackFilters
        categoryFilter={filters.categoryFilter}
        setCategoryFilter={filters.setCategoryFilter}
        categoryOptions={filters.categoryOptions}
        severityFilter={filters.severityFilter}
        setSeverityFilter={filters.setSeverityFilter}
      />

      <div className="drawbacks__layout">
        <DrawbackList
          isLoading={drawbacksQuery.isLoading}
          isError={drawbacksQuery.isError}
          totalCount={totalCount}
          orderedDrawbacks={orderedDrawbacks}
          filteredDrawbackIds={filters.filteredDrawbackIds}
          selectedDrawbackId={selectedDrawbackId}
          onSelectDrawback={(id) => setSelectedDrawbackId(id)}
          formatValue={formatValue}
          moveDrawback={moveDrawback}
          reorderPending={reorderMutation.isPending}
          hasOrderChanges={hasOrderChanges}
          confirmOrder={confirmOrder}
          resetOrder={resetOrder}
          reorderError={Boolean(reorderMutation.isError)}
        />
        <div className="drawbacks__detail">
          <DrawbackDetail
            formState={formState}
            setFormState={setFormState}
            onSave={handleSave}
            onDelete={handleDelete}
            onCloneJump={handleCloneJump}
            savePending={updateMutation.isPending}
            clonePending={duplicateMutation.isPending}
            selectedJumpId={selectedJumpId}
          />
        </div>
      </div>
    </section>
  );
};

export default DrawbackSupplement;
