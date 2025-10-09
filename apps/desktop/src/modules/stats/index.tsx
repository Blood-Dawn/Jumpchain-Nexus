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

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  loadExportSnapshot,
  type ExportSnapshot,
  type JumpRecord,
  type JumpAssetRecord,
  type JumpAssetType,
  type InventoryItemRecord,
} from "../../db/dao";

interface StatusBucket {
  label: string;
  count: number;
}

interface WorldBucket {
  world: string;
  count: number;
}

interface AssetMetric {
  type: JumpAssetType;
  label: string;
  count: number;
  gross: number;
  netCost: number;
  credit: number;
  discounted: number;
  freebies: number;
}

interface InventoryTotals {
  totalCount: number;
  totalQuantity: number;
  warehouseCount: number;
  lockerCount: number;
}

interface ComputedMetrics {
  totalJumps: number;
  totalBudget: number;
  totalSpent: number;
  totalCredit: number;
  netBalance: number;
  averageBudget: number;
  totalPurchases: number;
  statusBuckets: StatusBucket[];
  assetBreakdown: AssetMetric[];
  inventoryTotals: InventoryTotals;
  profileCount: number;
  topWorlds: WorldBucket[];
  recentJumps: JumpRecord[];
}

const EMPTY_METRICS: ComputedMetrics = {
  totalJumps: 0,
  totalBudget: 0,
  totalSpent: 0,
  totalCredit: 0,
  netBalance: 0,
  averageBudget: 0,
  totalPurchases: 0,
  statusBuckets: [],
  assetBreakdown: [],
  inventoryTotals: {
    totalCount: 0,
    totalQuantity: 0,
    warehouseCount: 0,
    lockerCount: 0,
  },
  profileCount: 0,
  topWorlds: [],
  recentJumps: [],
};

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});

const assetLabels: Record<JumpAssetType, string> = {
  origin: "Origins",
  perk: "Perks",
  item: "Items",
  companion: "Companions",
  drawback: "Drawbacks",
};

const formatCount = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  return numberFormatter.format(Math.round(value));
};

const formatCP = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  return numberFormatter.format(Math.round(value));
};

const formatDecimal = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  return decimalFormatter.format(value);
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

const normalizeWorld = (world: string | null): string => {
  if (!world || !world.trim()) {
    return "Unspecified";
  }
  return world.trim();
};

const parseDate = (value: string | null | undefined): number => {
  if (!value) return Number.NaN;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.NaN;
};

const jumpTimestamp = (jump: JumpRecord): number => {
  const candidates = [jump.end_date, jump.start_date, jump.created_at].map((value) => parseDate(value));
  const finite = candidates.filter(Number.isFinite);
  if (!finite.length) {
    return 0;
  }
  return Math.max(...finite);
};

const getMetadata = (raw: string | null): Record<string, unknown> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const computeMetrics = (snapshot: ExportSnapshot | undefined): ComputedMetrics => {
  if (!snapshot) {
    return EMPTY_METRICS;
  }

  const statusCounts = new Map<string, number>();
  const worldCounts = new Map<string, number>();
  let totalBudget = 0;
  let totalSpent = 0;
  let totalCredit = 0;

  snapshot.jumps.forEach((jump) => {
    totalBudget += jump.cp_budget ?? 0;
    totalSpent += jump.cp_spent ?? 0;
    totalCredit += jump.cp_income ?? 0;
    const status = normalizeStatus(jump.status ?? null);
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    const world = normalizeWorld(jump.world ?? null);
    worldCounts.set(world, (worldCounts.get(world) ?? 0) + 1);
  });

  const assetBreakdownMap = new Map<JumpAssetType, AssetMetric>();
  (Object.keys(assetLabels) as JumpAssetType[]).forEach((type) => {
    assetBreakdownMap.set(type, {
      type,
      label: assetLabels[type],
      count: 0,
      gross: 0,
      netCost: 0,
      credit: 0,
      discounted: 0,
      freebies: 0,
    });
  });

  snapshot.jumpAssets.forEach((asset: JumpAssetRecord) => {
    const entry = assetBreakdownMap.get(asset.asset_type);
    if (!entry) {
      return;
    }
    entry.count += 1;
    const quantity = Math.max(asset.quantity ?? 1, 1);
    const gross = Math.max(asset.cost ?? 0, 0) * quantity;
    entry.gross += gross;

    if (asset.freebie === 1) {
      entry.freebies += 1;
      if (asset.asset_type === "drawback") {
        entry.credit += gross;
      }
      return;
    }

    if (asset.discounted === 1 && asset.asset_type !== "drawback") {
      entry.discounted += 1;
      entry.netCost += gross / 2;
      return;
    }

    if (asset.asset_type === "drawback") {
      entry.credit += gross;
    } else {
      entry.netCost += gross;
    }
  });

  const inventoryTotals = snapshot.inventory.reduce<InventoryTotals>(
    (totals, item: InventoryItemRecord) => {
      totals.totalCount += 1;
      const quantity = Number.isFinite(item.quantity) ? Math.max(item.quantity ?? 0, 0) : 0;
      totals.totalQuantity += quantity;
      if (item.scope === "warehouse") {
        totals.warehouseCount += 1;
      }
      if (item.scope === "locker") {
        totals.lockerCount += 1;
      }
      return totals;
    },
    {
      totalCount: 0,
      totalQuantity: 0,
      warehouseCount: 0,
      lockerCount: 0,
    }
  );

  const topWorlds = Array.from(worldCounts.entries())
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([world, count]) => ({ world, count }));

  const recentJumps = [...snapshot.jumps]
    .sort((a, b) => jumpTimestamp(b) - jumpTimestamp(a))
    .slice(0, 5);

  const assetBreakdown = Array.from(assetBreakdownMap.values()).filter((entry) => entry.count > 0);

  return {
    totalJumps: snapshot.jumps.length,
    totalBudget,
    totalSpent,
    totalCredit,
    netBalance: totalCredit - totalSpent,
    averageBudget: snapshot.jumps.length ? totalBudget / snapshot.jumps.length : 0,
    totalPurchases: snapshot.jumpAssets.filter((asset) => asset.asset_type !== "drawback").length,
    statusBuckets: Array.from(statusCounts.entries())
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, count })),
    assetBreakdown,
    inventoryTotals,
    profileCount: snapshot.profiles.length,
    topWorlds,
    recentJumps,
  };
};

const describeInventory = (item: InventoryItemRecord): string => {
  const metadata = getMetadata(item.metadata);
  const packed = typeof metadata.packed === "boolean" ? metadata.packed : null;
  const priority = typeof metadata.priority === "string" ? metadata.priority : null;
  const bits = [item.category, priority ? `priority: ${String(priority)}` : null];
  if (packed !== null) {
    bits.push(packed ? "packed" : "unpacked");
  }
  return bits.filter(Boolean).join(" • ");
};

const formatDate = (value: string | null): string => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
};

const StatisticsHub: React.FC = () => {
  const analyticsQuery = useQuery({ queryKey: ["analytics-snapshot"], queryFn: loadExportSnapshot });

  const metrics = useMemo(() => computeMetrics(analyticsQuery.data), [analyticsQuery.data]);

  const purchaseNetTotal = metrics.assetBreakdown
    .filter((entry) => entry.type !== "drawback")
    .reduce((sum, entry) => sum + entry.netCost, 0);
  const drawbackTotal = metrics.assetBreakdown.find((entry) => entry.type === "drawback")?.credit ?? 0;

  const newestInventory = useMemo(() => {
    if (!analyticsQuery.data?.inventory.length) {
      return [] as InventoryItemRecord[];
    }
    return [...analyticsQuery.data.inventory]
      .sort((a, b) => {
        const left = parseDate(b.updated_at ?? b.created_at);
        const right = parseDate(a.updated_at ?? a.created_at);
        return left - right;
      })
      .slice(0, 4);
  }, [analyticsQuery.data?.inventory]);

  return (
    <section className="stats">
      <header className="stats__header">
        <div>
          <h1>Chain Analytics</h1>
          <p>High-level insights across jumps, purchases, characters, and storage.</p>
        </div>
        <button
          type="button"
          className="stats__refresh"
          onClick={() => analyticsQuery.refetch()}
          disabled={analyticsQuery.isFetching}
        >
          {analyticsQuery.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {analyticsQuery.isLoading && <p className="stats__empty">Loading analytics…</p>}
      {analyticsQuery.isError && (
        <p className="stats__empty stats__empty--error">Failed to load analytics snapshot.</p>
      )}

      {!analyticsQuery.isLoading && !analyticsQuery.isError && (
        <div className="stats__content">
          <div className="stats__summary">
            <article className="stats__summary-card">
              <h3>Total Jumps</h3>
              <strong>{formatCount(metrics.totalJumps)}</strong>
              <span>{formatCount(metrics.totalPurchases)} purchases logged</span>
            </article>
            <article className="stats__summary-card">
              <h3>Budget Allocated</h3>
              <strong>{formatCP(metrics.totalBudget)} CP</strong>
              <span>Avg {formatDecimal(metrics.averageBudget || 0)} CP per jump</span>
            </article>
            <article className="stats__summary-card">
              <h3>Net Balance</h3>
              <strong>{formatCP(metrics.netBalance)} CP</strong>
              <span>{formatCP(metrics.totalCredit)} CP earned from drawbacks</span>
            </article>
            <article className="stats__summary-card">
              <h3>Characters &amp; Inventory</h3>
              <strong>{formatCount(metrics.profileCount)} profiles</strong>
              <span>{formatCount(metrics.inventoryTotals.totalCount)} items tracked</span>
            </article>
          </div>

          <div className="stats__grid">
            <section className="stats__panel">
              <header className="stats__panel-header">
                <h2>Status Distribution</h2>
                <span>Total {formatCount(metrics.totalJumps)}</span>
              </header>
              {metrics.statusBuckets.length ? (
                <ul className="stats__distribution">
                  {metrics.statusBuckets.map((bucket) => (
                    <li key={bucket.label}>
                      <span className="stats__chip">{bucket.label}</span>
                      <span>{formatCount(bucket.count)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="stats__empty">No jumps yet to categorize.</p>
              )}
            </section>

            <section className="stats__panel">
              <header className="stats__panel-header">
                <h2>Purchase Breakdown</h2>
                <span>{formatCount(metrics.totalPurchases)} entries</span>
              </header>
              {metrics.assetBreakdown.length ? (
                <div className="stats__asset-grid">
                  {metrics.assetBreakdown.map((asset) => {
                    const share =
                      asset.type === "drawback"
                        ? drawbackTotal > 0
                          ? asset.credit / Math.max(drawbackTotal, 1)
                          : 0
                        : purchaseNetTotal > 0
                          ? asset.netCost / Math.max(purchaseNetTotal, 1)
                          : 0;
                    return (
                      <article key={asset.type} className="stats__asset-card">
                        <header>
                          <h3>{asset.label}</h3>
                          <span>{formatPercent(share)}</span>
                        </header>
                        <dl>
                          <div>
                            <dt>Entries</dt>
                            <dd>{formatCount(asset.count)}</dd>
                          </div>
                          <div>
                            <dt>Gross</dt>
                            <dd>{formatCP(asset.gross)} CP</dd>
                          </div>
                          {asset.type === "drawback" ? (
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
                          {asset.discounted > 0 && asset.type !== "drawback" && (
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
                <h2>Top Worlds</h2>
                <span>Most visited settings</span>
              </header>
              {metrics.topWorlds.length ? (
                <ol className="stats__ranking">
                  {metrics.topWorlds.map((world) => (
                    <li key={world.world}>
                      <span>{world.world}</span>
                      <strong>{formatCount(world.count)}</strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="stats__empty">World metadata hasn&apos;t been entered yet.</p>
              )}
            </section>

            <section className="stats__panel">
              <header className="stats__panel-header">
                <h2>Recent Jumps</h2>
                <span>Latest five entries</span>
              </header>
              {metrics.recentJumps.length ? (
                <ul className="stats__recent">
                  {metrics.recentJumps.map((jump) => (
                    <li key={jump.id}>
                      <div>
                        <strong>{jump.title}</strong>
                        <span>{normalizeWorld(jump.world ?? null)}</span>
                      </div>
                      <div className="stats__recent-meta">
                        <span>{formatDate(jump.start_date)}</span>
                        <span>{formatCP(jump.cp_spent ?? 0)} CP spent</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="stats__empty">No jump history logged yet.</p>
              )}
            </section>

            <section className="stats__panel">
              <header className="stats__panel-header">
                <h2>Inventory Snapshot</h2>
                <span>{formatCount(metrics.inventoryTotals.totalCount)} items</span>
              </header>
              {metrics.inventoryTotals.totalCount ? (
                <>
                  <dl className="stats__inventory-summary">
                    <div>
                      <dt>Warehouse</dt>
                      <dd>{formatCount(metrics.inventoryTotals.warehouseCount)}</dd>
                    </div>
                    <div>
                      <dt>Locker</dt>
                      <dd>{formatCount(metrics.inventoryTotals.lockerCount)}</dd>
                    </div>
                    <div>
                      <dt>Total Qty</dt>
                      <dd>{formatCount(metrics.inventoryTotals.totalQuantity)}</dd>
                    </div>
                  </dl>
                  {newestInventory.length > 0 && (
                    <ul className="stats__inventory-list">
                      {newestInventory.map((item) => (
                        <li key={item.id}>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{describeInventory(item)}</span>
                          </div>
                          <div className="stats__inventory-meta">
                            <span>{formatDate(item.updated_at)}</span>
                            <span>Qty {formatCount(item.quantity ?? 0)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="stats__empty">Warehouse and locker are currently empty.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  );
};

export default StatisticsHub;
