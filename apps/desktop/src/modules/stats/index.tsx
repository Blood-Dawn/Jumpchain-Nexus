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

import React, { useCallback, useId, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FixedSizeList as List, type ListChildComponentProps } from "react-window";
import { loadStatisticsSnapshot, type JumpAssetType, type StatisticsSnapshot } from "../../db/dao";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

const ROW_HEIGHT = 44;
const GAUNTLET_ROW_HEIGHT = 56;
const BOOSTER_ROW_HEIGHT = 56;

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });

const assetLabels: Record<JumpAssetType, string> = {
  origin: "Origins",
  perk: "Perks",
  item: "Items",
  companion: "Companions",
  drawback: "Drawbacks",
};

const assetColors: Record<JumpAssetType, string> = {
  origin: "#8A6BFF",
  perk: "#5AD1FF",
  item: "#FF7AD5",
  companion: "#B78CFF",
  drawback: "#FF8FA4",
};

const assetIcons: Record<JumpAssetType, React.ReactNode> = {
  origin: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4.5a7.5 7.5 0 1 1-6.708 4.125m2.566-4.33C8.73 3.81 10.314 3 12 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9c0-1.687.815-3.275 1.8-4.169"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  perk: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.5 9.5 9.5H3.5l5 3.6-2 6.4L12 16.5l5.5 3-2-6.4 5-3.6h-6L12 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  item: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.5 7.5 12 4l5.5 3.5v9L12 20l-5.5-3.5v-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 7.5 12 11m0 0 5.5-3.5M12 11v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  companion: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8.5 5.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Zm-2 13v-1a3.5 3.5 0 0 1 3.5-3.5h6a3.5 3.5 0 0 1 3.5 3.5v1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 10.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Zm0 8v-0.5a2.5 2.5 0 0 1 2.5-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  drawback: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3v4m0 10v4m7-7h-4m-6 0H5m10.95-7.95-2.83 2.83m-4.24 4.24-2.83 2.83m9.9 0-2.83-2.83m-4.24-4.24L6.05 6.05"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

const panelIcons = {
  cp: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8-8-3.582-8-8Zm0 0c2.5-1 5-1 8 0s5.5 1 8 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 6v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ledger: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.5 4.5h8.5L19.5 9v10.5h-13V4.5Zm0 4.5h13M10 12.5h5m-5 4h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  inventory: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 7.5 12 3l7.5 4.5v9L12 21l-7.5-4.5v-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4.5 7.5 12 12l7.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  gauntlet: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3 6 5v6c0 4.142 2.686 7.5 6 9 3.314-1.5 6-4.858 6-9V5l-6-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 9h6m-6 3h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  booster: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3v6m0 0a3 3 0 1 1-3 3m3-3a3 3 0 1 0 3 3m-3-3c-4.5 0-7.5 3.5-7.5 8 2.5-1.5 4-1.5 7.5 0 3.5-1.5 5-1.5 7.5 0 0-4.5-3-8-7.5-8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
} as const;

const EMPTY_STATS: StatisticsSnapshot = {
  cp: {
    totals: { budget: 0, spent: 0, earned: 0, net: 0 },
    byJump: [],
    byAssetType: [],
  },
  inventory: { totalItems: 0, totalQuantity: 0, categories: [] },
  gauntlet: { allowGauntlet: false, gauntletHalved: false, totalGauntlets: 0, completedGauntlets: 0, rows: [] },
  boosters: { totalCharacters: 0, charactersWithBoosters: 0, totalBoosters: 0, uniqueBoosters: 0, entries: [] },
};

const formatCount = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  return numberFormatter.format(Math.round(value));
};

const formatCP = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  return numberFormatter.format(Math.round(value));
};

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "0%";
  return percentFormatter.format(value);
};

const normalizeStatus = (status: string | null): string => {
  if (!status || !status.trim()) {
    return "Unassigned";
  }
  return status
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
};

const StatisticsHub: React.FC = () => {
  const statsQuery = useQuery({ queryKey: ["statistics-snapshot"], queryFn: loadStatisticsSnapshot });

  const snapshot = statsQuery.data ?? EMPTY_STATS;
  const cpTotals = snapshot.cp.totals;
  const cpRows = snapshot.cp.byJump;
  const assetBreakdown = snapshot.cp.byAssetType;
  const inventoryCategories = snapshot.inventory.categories;
  const gauntletSummary = snapshot.gauntlet;
  const boosterSummary = snapshot.boosters;
  const netCredit = Number.isFinite(cpTotals.net) ? cpTotals.net : 0;
  const creditSummaryClassName = [
    "stats__summary-card",
    netCredit > 0 ? "stats__summary-card--positive" : null,
    netCredit < 0 ? "stats__summary-card--negative" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const cpChartCaptionId = useId();
  const cpChartSummaryId = useId();
  const inventoryChartCaptionId = useId();
  const inventoryChartSummaryId = useId();
  const inventoryGradientUid = useId();
  const inventoryGradientId = useMemo(
    () => `inventory-gradient-${inventoryGradientUid.replace(/:/g, "")}`,
    [inventoryGradientUid],
  );

  const totalJumps = cpRows.length;
  const { totalPurchases, totalSpend, totalCredit } = useMemo(() => {
    let purchases = 0;
    let spend = 0;
    let credit = 0;

    for (const entry of assetBreakdown) {
      if (entry.assetType === "drawback") {
        credit += entry.credit;
        continue;
      }

      purchases += entry.itemCount;
      spend += entry.netCost;
    }

    return { totalPurchases: purchases, totalSpend: spend, totalCredit: credit };
  }, [assetBreakdown]);

  const cpChartData = useMemo(
    () =>
      assetBreakdown
        .map((asset) => ({
          name: assetLabels[asset.assetType] ?? asset.assetType,
          value: asset.assetType === "drawback" ? asset.credit : asset.netCost,
          assetType: asset.assetType,
        }))
        .filter((entry) => entry.value > 0),
    [assetBreakdown]
  );

  const totalChartedCP = useMemo(
    () => cpChartData.reduce((sum, entry) => sum + entry.value, 0),
    [cpChartData]
  );

  const cpChartSummary = useMemo(() => {
    if (!cpChartData.length || totalChartedCP <= 0) {
      return "No CP distribution data available.";
    }
    return cpChartData
      .map((entry) => {
        const percent = totalChartedCP > 0 ? Math.round((entry.value / totalChartedCP) * 100) : 0;
        const unit = entry.assetType === "drawback" ? "credit" : "spent";
        return `${entry.name} ${formatCP(entry.value)} CP ${unit} (${percent}%)`;
      })
      .join("; ");
  }, [cpChartData, totalChartedCP]);

  const inventoryChartData = useMemo(
    () =>
      inventoryCategories
        .map((category) => ({
          name: category.category,
          quantity: category.totalQuantity,
          entries: category.itemCount,
          warehouse: category.warehouseCount,
          locker: category.lockerCount,
        }))
        .filter((entry) => entry.quantity > 0 || entry.entries > 0),
    [inventoryCategories]
  );

  const totalTrackedQuantity = useMemo(
    () => inventoryChartData.reduce((sum, entry) => sum + entry.quantity, 0),
    [inventoryChartData]
  );

  const inventoryBarKey = totalTrackedQuantity > 0 ? "quantity" : "entries";
  const inventoryGradient = totalTrackedQuantity > 0
    ? { from: "#5AD1FF", to: "#8A6BFF" }
    : { from: "#B78CFF", to: "#FF7AD5" };
  const inventoryLegendLabel = inventoryBarKey === "quantity" ? "Total Quantity" : "Entry Count";
  const inventoryLegendDescription = inventoryBarKey === "quantity"
    ? "Quantity represented per category"
    : "Entries represented per category";

  const inventoryChartSummary = useMemo(() => {
    if (!inventoryChartData.length) {
      return "Warehouse and locker are currently empty.";
    }
    const fallbackTotal = totalTrackedQuantity || inventoryChartData.reduce((sum, entry) => sum + entry.entries, 0);
    return inventoryChartData
      .map((entry) => {
        const numerator = totalTrackedQuantity > 0 ? entry.quantity : entry.entries;
        const percent = fallbackTotal > 0 ? Math.round((numerator / fallbackTotal) * 100) : 0;
        const unitLabel = totalTrackedQuantity > 0 ? `${formatCount(entry.quantity)} total quantity` : `${formatCount(entry.entries)} entries`;
        return `${entry.name} ${unitLabel} (${percent}%)`;
      })
      .join("; ");
  }, [inventoryChartData, totalTrackedQuantity]);

  const renderCPTooltip = useCallback(
    ({ active, payload }: TooltipProps<number, string>) => {
      if (!active || !payload || payload.length === 0) {
        return null;
      }
      const data = payload[0];
      const chartEntry = data.payload as (typeof cpChartData)[number];
      const unit = chartEntry.assetType === "drawback" ? "credit" : "spent";
      const accent = assetColors[chartEntry.assetType];
      const percent = totalChartedCP > 0 ? Number(data.value ?? 0) / totalChartedCP : 0;
      return (
        <div className="stats__tooltip">
          <div className="stats__tooltip-header">
            <span
              className="stats__tooltip-badge"
              style={{
                background: `linear-gradient(135deg, ${accent} 0%, rgba(10, 16, 28, 0.65) 100%)`,
              }}
            >
              {assetIcons[chartEntry.assetType]}
            </span>
            <div className="stats__tooltip-meta">
              <strong>{chartEntry.name}</strong>
              <span>{formatCP(Number(data.value ?? 0))} CP {unit}</span>
              <span>{formatPercent(percent)}</span>
            </div>
          </div>
        </div>
      );
    },
    [cpChartData, totalChartedCP]
  );

  const renderInventoryTooltip = useCallback(
    ({ active, payload, label }: TooltipProps<number, string>) => {
      if (!active || !payload || payload.length === 0) {
        return null;
      }
      const data = payload[0];
      const chartEntry = data.payload as (typeof inventoryChartData)[number];
      return (
        <div className="stats__tooltip">
          <div className="stats__tooltip-header">
            <span
              className="stats__tooltip-badge"
              style={{
                background: `linear-gradient(135deg, ${inventoryGradient.from} 0%, ${inventoryGradient.to} 100%)`,
              }}
            >
              {panelIcons.inventory}
            </span>
            <div className="stats__tooltip-meta">
              <strong>{label}</strong>
              <span>{formatCount(chartEntry.quantity)} total quantity</span>
              <span>{formatCount(chartEntry.entries)} entries tracked</span>
            </div>
          </div>
          <div className="stats__tooltip-grid">
            <span>{formatCount(chartEntry.warehouse)} warehouse</span>
            <span>{formatCount(chartEntry.locker)} locker</span>
          </div>
        </div>
      );
    },
    [inventoryChartData, inventoryGradient.from, inventoryGradient.to]
  );

  const cpRowRenderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const row = filteredCpRows[index];
      if (!row) return null;
      return (
        <div style={style} className="stats__table-row stats__table-row--cp">
          <span className="stats__cell-primary">{row.title}</span>
          <span>{normalizeStatus(row.status)}</span>
          <span>{formatCP(row.budget)} CP</span>
          <span>{formatCP(row.spent)} CP</span>
          <span>{formatCP(row.earned)} CP</span>
          <span className={row.net >= 0 ? "stats__value-positive" : "stats__value-negative"}>{formatCP(row.net)} CP</span>
        </div>
      );
    },
    [filteredCpRows]
  );

  const inventoryRowRenderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const row = inventoryCategories[index];
      if (!row) return null;
      return (
        <div style={style} className="stats__table-row stats__table-row--inventory">
          <span className="stats__cell-primary">{row.category}</span>
          <span>{formatCount(row.itemCount)}</span>
          <span>{formatCount(row.totalQuantity)}</span>
          <span>{formatCount(row.warehouseCount)}</span>
          <span>{formatCount(row.lockerCount)}</span>
        </div>
      );
    },
    [inventoryCategories]
  );

  const gauntletRowRenderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const row = gauntletSummary.rows[index];
      if (!row) return null;
      const capped = Math.min(Math.max(row.progress, 0), 1);
      return (
        <div style={style} className="stats__table-row stats__table-row--gauntlet">
          <div className="stats__cell-primary stats__cell-primary--stacked">
            <strong>{row.title}</strong>
            <span>{normalizeStatus(row.status)}</span>
          </div>
          <span>{formatCP(row.budget)} CP</span>
          <span>{formatCP(row.spent)} CP</span>
          <span>{formatCP(row.earned)} CP</span>
          <div className="stats__progress-wrapper">
            <span className="stats__progress-label">{formatPercent(row.progress)}</span>
            <div className="stats__progress" aria-hidden="true">
              <div
                className={`stats__progress-bar${row.progress >= 1 ? " stats__progress-bar--complete" : ""}`}
                style={{ width: `${capped * 100}%` }}
              />
            </div>
          </div>
        </div>
      );
    },
    [gauntletSummary.rows]
  );

  const boosterRowRenderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const entry = boosterSummary.entries[index];
      if (!entry) return null;
      const characters = entry.characters.map((character) => character.name).join(", ");
      return (
        <div style={style} className="stats__table-row stats__table-row--booster">
          <span className="stats__cell-primary">{entry.booster}</span>
          <span>{formatCount(entry.count)}</span>
          <span title={characters || undefined}>{characters || "—"}</span>
        </div>
      );
    },
    [boosterSummary.entries]
  );

  const cpListHeight = Math.max(1, Math.min(filteredCpRows.length, 8)) * ROW_HEIGHT;
  const inventoryListHeight = Math.max(1, Math.min(inventoryCategories.length, 8)) * ROW_HEIGHT;
  const gauntletListHeight = Math.max(1, Math.min(gauntletSummary.rows.length, 6)) * GAUNTLET_ROW_HEIGHT;
  const boosterListHeight = Math.max(1, Math.min(boosterSummary.entries.length, 8)) * BOOSTER_ROW_HEIGHT;

  const gauntletStatusLabel = useMemo(() => {
    const parts: string[] = [];
    parts.push(gauntletSummary.allowGauntlet ? "Enabled" : "Disabled");
    parts.push(gauntletSummary.gauntletHalved ? "Halved" : "Full value");
    parts.push(`${formatCount(gauntletSummary.completedGauntlets)} complete`);
    return parts.join(" • ");
  }, [gauntletSummary.allowGauntlet, gauntletSummary.gauntletHalved, gauntletSummary.completedGauntlets]);

  return (
    <section className="stats">
      <header className="stats__header">
        <div>
          <h1>Chain Analytics</h1>
          <p>Aggregated jump performance, storage distribution, gauntlet pacing, and booster coverage.</p>
        </div>
        <button
          type="button"
          className="stats__refresh"
          onClick={() => statsQuery.refetch()}
          disabled={statsQuery.isFetching}
        >
          {statsQuery.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {statsQuery.isLoading && <p className="stats__empty">Loading analytics…</p>}
      {statsQuery.isError && (
        <p className="stats__empty stats__empty--error">Failed to load analytics snapshot.</p>
      )}

      {!statsQuery.isLoading && !statsQuery.isError && (
        <div className="stats__content">
          <div className="stats__summary">
            <article className="stats__summary-card">
              <h3>Jumps Logged</h3>
              <strong>{formatCount(totalJumps)}</strong>
              <span>{formatCount(totalPurchases)} purchases tracked</span>
            </article>
            <article className={creditSummaryClassName}>
              <h3>Drawback Credit</h3>
              <strong>{formatCP(cpTotals.earned)} CP</strong>
              <span>Net balance {formatCP(cpTotals.net)} CP</span>
            </article>
            <article className="stats__summary-card">
              <h3>Inventory Footprint</h3>
              <strong>{formatCount(snapshot.inventory.totalItems)} items</strong>
              <span>Total quantity {formatCount(snapshot.inventory.totalQuantity)}</span>
            </article>
            <article className="stats__summary-card">
              <h3>Booster Coverage</h3>
              <strong>{formatCount(boosterSummary.uniqueBoosters)} unique</strong>
              <span>{formatCount(boosterSummary.charactersWithBoosters)} boosted profiles</span>
            </article>
          </div>

          <div className="stats__grid">
            <section className="stats__panel stats__panel--cp">
              <header className="stats__panel-header">
                <div className="stats__panel-title">
                  <span className="stats__panel-icon" aria-hidden="true">{panelIcons.cp}</span>
                  <div className="stats__panel-heading">
                    <h2>CP Breakdown</h2>
                    <span>
                      {formatCP(filteredTotalSpend)} CP spent • {formatCP(filteredTotalCredit)} CP earned
                    </span>
                  </div>
                </div>
                <div className="stats__panel-controls">
                  <label>
                    <span>Asset Type</span>
                    <select
                      value={assetFilter}
                      onChange={(event) => setAssetFilter(event.target.value as JumpAssetType | "all")}
                      data-testid="asset-filter"
                    >
                      <option value="all">All asset types</option>
                      {assetTypeOrder.map((type) => (
                        <option key={type} value={type}>
                          {assetLabels[type] ?? type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </header>
              {assetBreakdown.length ? (
                <div className="stats__panel-stack">
                  {cpChartData.length > 0 && (
                    <figure
                      className="stats__chart"
                      aria-labelledby={cpChartCaptionId}
                      aria-describedby={cpChartSummaryId}
                    >
                      <div className="stats__chart-visual" aria-hidden="true">
                        <ResponsiveContainer width="100%" height={260}>
                          <PieChart>
                            <Pie
                              data={cpChartData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={60}
                              outerRadius={110}
                              paddingAngle={4}
                            >
                              {cpChartData.map((entry) => (
                                <Cell key={entry.assetType} fill={assetColors[entry.assetType]} />
                              ))}
                            </Pie>
                            <Tooltip content={renderCPTooltip} cursor={{ fill: "rgba(255, 255, 255, 0.05)" }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <figcaption id={cpChartCaptionId}>CP allocation by asset type</figcaption>
                      <p id={cpChartSummaryId} className="stats__chart-summary">
                        {cpChartSummary}
                      </p>
                    </figure>
                  )}
                  {cpChartData.length > 0 && (
                    <ul className="stats__legend" role="list">
                      {cpChartData.map((entry) => {
                        const unitLabel = entry.assetType === "drawback" ? "credit" : "spent";
                        const share = totalChartedCP > 0 ? entry.value / totalChartedCP : 0;
                        return (
                          <li key={entry.assetType} className="stats__legend-item" role="listitem">
                            <span
                              className="stats__legend-icon"
                              aria-hidden="true"
                              style={{
                                background: `linear-gradient(135deg, ${assetColors[entry.assetType]} 0%, rgba(255, 255, 255, 0.14) 100%)`,
                              }}
                            >
                              {assetIcons[entry.assetType]}
                            </span>
                            <div className="stats__legend-text">
                              <strong>{entry.name}</strong>
                              <span>
                                {formatCP(entry.value)} CP {unitLabel} • {formatPercent(share)}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="stats__asset-grid">
                    {assetBreakdown.map((asset) => {
                      const label = assetLabels[asset.assetType] ?? asset.assetType;
                      const share = asset.assetType === "drawback"
                        ? totalCredit > 0
                          ? asset.credit / totalCredit
                          : 0
                        : totalSpend > 0
                          ? asset.netCost / totalSpend
                          : 0;
                      return (
                        <article key={asset.assetType} className="stats__asset-card">
                          <header>
                            <h3>{label}</h3>
                            <span>{formatPercent(share)}</span>
                          </header>
                          <dl>
                            <div>
                              <dt>Entries</dt>
                              <dd>{formatCount(asset.itemCount)}</dd>
                            </div>
                            <div>
                              <dt>Gross</dt>
                              <dd>{formatCP(asset.gross)} CP</dd>
                            </div>
                            {asset.assetType === "drawback" ? (
                              <div>
                                <dt>Credit</dt>
                                <dd>{formatCP(asset.credit)} CP</dd>
                              </div>
                            ) : (
                              <div>
                                <dt>Net Cost</dt>
                                <dd>{formatCP(asset.netCost)} CP</dd>
                              </div>
                            )}
                            {asset.discounted > 0 && asset.assetType !== "drawback" && (
                              <div>
                                <dt>Discounted</dt>
                                <dd>{formatCount(asset.discounted)}</dd>
                              </div>
                            )}
                            {asset.freebies > 0 && (
                              <div>
                                <dt>Freebies</dt>
                                <dd>{formatCount(asset.freebies)}</dd>
                              </div>
                            )}
                          </dl>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="stats__empty">No purchases match the selected filters.</p>
              )}
            </section>

            <section className="stats__panel stats__panel--ledger">
              <header className="stats__panel-header">
                <div className="stats__panel-title">
                  <span className="stats__panel-icon" aria-hidden="true">{panelIcons.ledger}</span>
                  <div className="stats__panel-heading">
                    <h2>Spend &amp; Credit by Jump</h2>
                    <span>
                      {formatCount(filteredCpRows.length)} {filteredCpRows.length === 1 ? "jump" : "jumps"} •
                      {" "}
                      {formatCP(filteredJumpTotals.spent)} CP spent • {formatCP(filteredJumpTotals.earned)} CP earned
                    </span>
                  </div>
                </div>
                <div className="stats__panel-controls">
                  <label>
                    <span>Jump Status</span>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      data-testid="status-filter"
                    >
                      <option value="all">All statuses</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </header>
              {filteredCpRows.length ? (
                <div className="stats__table" data-testid="cp-table" data-row-count={filteredCpRows.length}>
                  <div className="stats__table-header stats__table-row--cp">
                    <span>Jump</span>
                    <span>Status</span>
                    <span>Budget</span>
                    <span>Spent</span>
                    <span>Earned</span>
                    <span>Net</span>
                  </div>
                  <List
                    className="stats__virtual-list stats__virtual-list--cp"
                    height={cpListHeight}
                    itemCount={filteredCpRows.length}
                    itemKey={(index) => filteredCpRows[index]?.jumpId ?? index}
                    itemSize={ROW_HEIGHT}
                    width="100%"
                  >
                    {cpRowRenderer}
                  </List>
                </div>
              ) : (
                <p className="stats__empty">No jump budgets match the selected filters.</p>
              )}
            </section>

            <section className="stats__panel stats__panel--inventory">
              <header className="stats__panel-header">
                <div className="stats__panel-title">
                  <span className="stats__panel-icon" aria-hidden="true">{panelIcons.inventory}</span>
                  <div className="stats__panel-heading">
                    <h2>Inventory by Category</h2>
                    <span>{formatCount(snapshot.inventory.totalItems)} items tracked</span>
                  </div>
                </div>
              </header>
              {inventoryCategories.length ? (
                <div className="stats__panel-stack">
                  <ul className="stats__legend" role="list">
                    <li className="stats__legend-item" role="listitem">
                      <span
                        className="stats__legend-icon"
                        aria-hidden="true"
                        style={{
                          background: `linear-gradient(135deg, ${inventoryGradient.from} 0%, ${inventoryGradient.to} 100%)`,
                        }}
                      >
                        {panelIcons.inventory}
                      </span>
                      <div className="stats__legend-text">
                        <strong>{inventoryLegendLabel}</strong>
                        <span>{inventoryLegendDescription}</span>
                      </div>
                    </li>
                  </ul>
                  {inventoryChartData.length > 0 && (
                    <figure
                      className="stats__chart"
                      aria-labelledby={inventoryChartCaptionId}
                      aria-describedby={inventoryChartSummaryId}
                    >
                      <div className="stats__chart-visual" aria-hidden="true">
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={inventoryChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                            <defs>
                              <linearGradient id={inventoryGradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={inventoryGradient.from} />
                                <stop offset="100%" stopColor={inventoryGradient.to} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(240, 247, 255, 0.12)" />
                            <XAxis dataKey="name" tick={{ fill: "rgba(240, 247, 255, 0.75)", fontSize: 12 }} angle={-20} textAnchor="end" height={50} interval={0} />
                            <YAxis tick={{ fill: "rgba(240, 247, 255, 0.75)", fontSize: 12 }} tickFormatter={formatCount} allowDecimals={false} width={60} />
                            <Tooltip content={renderInventoryTooltip} cursor={{ fill: "rgba(255, 255, 255, 0.05)" }} />
                            <Bar dataKey={inventoryBarKey} fill={`url(#${inventoryGradientId})`} radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <figcaption id={inventoryChartCaptionId}>Inventory quantity by category</figcaption>
                      <p id={inventoryChartSummaryId} className="stats__chart-summary">
                        {inventoryChartSummary}
                      </p>
                    </figure>
                  )}
                  <div className="stats__table">
                    <div className="stats__table-header stats__table-row--inventory">
                      <span>Category</span>
                      <span>Entries</span>
                      <span>Quantity</span>
                      <span>Warehouse</span>
                      <span>Locker</span>
                    </div>
                    <List
                      height={inventoryListHeight}
                      itemCount={inventoryCategories.length}
                      itemKey={(index) => inventoryCategories[index]?.category ?? index}
                      itemSize={ROW_HEIGHT}
                      width="100%"
                    >
                      {inventoryRowRenderer}
                    </List>
                  </div>
                </div>
              ) : (
                <p className="stats__empty">Warehouse and locker are currently empty.</p>
              )}
            </section>

            <section className="stats__panel stats__panel--gauntlet">
              <header className="stats__panel-header">
                <div className="stats__panel-title">
                  <span className="stats__panel-icon" aria-hidden="true">{panelIcons.gauntlet}</span>
                  <div className="stats__panel-heading">
                    <h2>Gauntlet Progress</h2>
                    <span>{gauntletSummary.totalGauntlets ? gauntletStatusLabel : "No gauntlet runs logged"}</span>
                  </div>
                </div>
              </header>
              {gauntletSummary.totalGauntlets ? (
                <div className="stats__table">
                  <div className="stats__table-header stats__table-row--gauntlet">
                    <span>Jump</span>
                    <span>Budget</span>
                    <span>Spent</span>
                    <span>Earned</span>
                    <span>Progress</span>
                  </div>
                  <List
                    height={gauntletListHeight}
                    itemCount={gauntletSummary.rows.length}
                    itemKey={(index) => gauntletSummary.rows[index]?.jumpId ?? index}
                    itemSize={GAUNTLET_ROW_HEIGHT}
                    width="100%"
                  >
                    {gauntletRowRenderer}
                  </List>
                </div>
              ) : (
                <p className="stats__empty">Tag jumps with a gauntlet status to monitor budget pacing.</p>
              )}
            </section>

            <section className="stats__panel stats__panel--booster">
              <header className="stats__panel-header">
                <div className="stats__panel-title">
                  <span className="stats__panel-icon" aria-hidden="true">{panelIcons.booster}</span>
                  <div className="stats__panel-heading">
                    <h2>Booster Usage</h2>
                    <span>{formatCount(boosterSummary.totalCharacters)} profiles analysed</span>
                  </div>
                </div>
              </header>
              {boosterSummary.entries.length ? (
                <div className="stats__table">
                  <div className="stats__table-header stats__table-row--booster">
                    <span>Booster</span>
                    <span>Characters</span>
                    <span>Roster</span>
                  </div>
                  <List
                    height={boosterListHeight}
                    itemCount={boosterSummary.entries.length}
                    itemKey={(index) => boosterSummary.entries[index]?.booster ?? index}
                    itemSize={BOOSTER_ROW_HEIGHT}
                    width="100%"
                  >
                    {boosterRowRenderer}
                  </List>
                </div>
              ) : (
                <p className="stats__empty">Boosters haven&apos;t been recorded in character profiles yet.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  );
};

export default StatisticsHub;
