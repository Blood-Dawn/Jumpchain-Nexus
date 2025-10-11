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

import React, { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FixedSizeList as List, type ListChildComponentProps } from "react-window";
import { loadStatisticsSnapshot, type JumpAssetType, type StatisticsSnapshot } from "../../db/dao";

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

  const totalJumps = cpRows.length;
  const totalPurchases = useMemo(
    () => assetBreakdown.filter((entry) => entry.assetType !== "drawback").reduce((sum, entry) => sum + entry.itemCount, 0),
    [assetBreakdown]
  );
  const totalSpend = useMemo(
    () => assetBreakdown.filter((entry) => entry.assetType !== "drawback").reduce((sum, entry) => sum + entry.netCost, 0),
    [assetBreakdown]
  );
  const totalCredit = useMemo(
    () => assetBreakdown.find((entry) => entry.assetType === "drawback")?.credit ?? 0,
    [assetBreakdown]
  );

  const cpRowRenderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const row = cpRows[index];
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
    [cpRows]
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

  const cpListHeight = Math.max(1, Math.min(cpRows.length, 8)) * ROW_HEIGHT;
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
            <article className="stats__summary-card">
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
            <section className="stats__panel">
              <header className="stats__panel-header">
                <h2>CP Breakdown</h2>
                <span>{formatCP(cpTotals.spent)} CP spent • {formatCP(totalCredit)} CP earned</span>
              </header>
              {assetBreakdown.length ? (
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
              ) : (
                <p className="stats__empty">No purchases recorded yet.</p>
              )}
            </section>

            <section className="stats__panel">
              <header className="stats__panel-header">
                <h2>Spend &amp; Credit by Jump</h2>
                <span>{formatCount(totalJumps)} jumps</span>
              </header>
              {cpRows.length ? (
                <div className="stats__table">
                  <div className="stats__table-header stats__table-row--cp">
                    <span>Jump</span>
                    <span>Status</span>
                    <span>Budget</span>
                    <span>Spent</span>
                    <span>Earned</span>
                    <span>Net</span>
                  </div>
                  <List
                    height={cpListHeight}
                    itemCount={cpRows.length}
                    itemKey={(index) => cpRows[index]?.jumpId ?? index}
                    itemSize={ROW_HEIGHT}
                    width="100%"
                  >
                    {cpRowRenderer}
                  </List>
                </div>
              ) : (
                <p className="stats__empty">No jump budgets available yet.</p>
              )}
            </section>

            <section className="stats__panel">
              <header className="stats__panel-header">
                <h2>Inventory by Category</h2>
                <span>{formatCount(snapshot.inventory.totalItems)} items tracked</span>
              </header>
              {inventoryCategories.length ? (
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
              ) : (
                <p className="stats__empty">Warehouse and locker are currently empty.</p>
              )}
            </section>

            <section className="stats__panel">
              <header className="stats__panel-header">
                <h2>Gauntlet Progress</h2>
                <span>{gauntletSummary.totalGauntlets ? gauntletStatusLabel : "No gauntlet runs logged"}</span>
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

            <section className="stats__panel">
              <header className="stats__panel-header">
                <h2>Booster Usage</h2>
                <span>{formatCount(boosterSummary.totalCharacters)} profiles analysed</span>
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
