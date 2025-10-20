/*
Bloodawn

Copyright (c) 2025 Bloodawn

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

import type {
  InventoryItemRecord,
  WarehousePersonalRealityLimitCounter,
  WarehousePersonalRealitySummary,
} from "./dao";

interface PersonalRealityContribution {
  wpCost: number;
  provides: Record<string, number>;
  consumes: Record<string, number>;
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeLimitEntries = (value: unknown): Record<string, number> => {
  const result: Record<string, number> = {};
  if (!value) {
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const record = entry as Record<string, unknown>;
      const keyRaw = record.key ?? record.name ?? record.type ?? record.label;
      if (keyRaw == null) {
        return;
      }
      const key = String(keyRaw).trim();
      if (!key.length) {
        return;
      }
      const numberValue =
        toFiniteNumber(record.value ?? record.amount ?? record.count ?? record.quantity ?? record.capacity) ?? 0;
      if (!numberValue) {
        return;
      }
      result[key] = (result[key] ?? 0) + numberValue;
    });
    return result;
  }
  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([rawKey, rawValue]) => {
      const key = rawKey.trim();
      if (!key.length) {
        return;
      }
      if (typeof rawValue === "object" && rawValue !== null) {
        const nested = rawValue as Record<string, unknown>;
        const numberValue = toFiniteNumber(nested.value ?? nested.amount ?? nested.count ?? nested.quantity);
        if (numberValue !== null && numberValue !== 0) {
          result[key] = (result[key] ?? 0) + numberValue;
        }
        return;
      }
      const numberValue = toFiniteNumber(rawValue);
      if (numberValue !== null && numberValue !== 0) {
        result[key] = (result[key] ?? 0) + numberValue;
      }
    });
  }
  return result;
};

const parsePersonalRealityContribution = (raw: string | null): PersonalRealityContribution | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const personalRealityRaw =
      (record.personalReality as Record<string, unknown> | undefined) ??
      (record.personal_reality as Record<string, unknown> | undefined) ??
      (record.pr as Record<string, unknown> | undefined) ??
      null;
    const container = personalRealityRaw ?? record;

    const wpValue =
      toFiniteNumber(container.wp ?? container.wpCost ?? record.wp ?? record.warehouseWp ?? record.wp_cost) ?? 0;

    const providesRaw = container.provides ?? container.capacity ?? container.slots ?? record.provides;
    const consumesRaw = container.consumes ?? container.uses ?? container.requirements ?? record.consumes;
    const capsRaw = container.caps ?? container.cap ?? container.limits;

    const provides = normalizeLimitEntries(providesRaw);
    const consumes = normalizeLimitEntries(consumesRaw);
    const caps = normalizeLimitEntries(capsRaw);

    Object.entries(caps).forEach(([key, value]) => {
      provides[key] = (provides[key] ?? 0) + value;
    });

    if (!wpValue && !Object.keys(provides).length && !Object.keys(consumes).length) {
      return null;
    }

    return {
      wpCost: wpValue,
      provides,
      consumes,
    };
  } catch {
    return null;
  }
};

const formatLimitLabel = (key: string): string => {
  return key
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export const aggregatePersonalReality = (
  items: InventoryItemRecord[],
): { wpTotal: number; limits: WarehousePersonalRealityLimitCounter[] } => {
  let wpTotal = 0;
  const limitMap = new Map<string, WarehousePersonalRealityLimitCounter>();

  const ensureEntry = (key: string): WarehousePersonalRealityLimitCounter => {
    const normalizedKey = key.trim().toLowerCase();
    const existing = limitMap.get(normalizedKey);
    if (existing) {
      return existing;
    }
    const entry: WarehousePersonalRealityLimitCounter = {
      key: normalizedKey,
      label: formatLimitLabel(key),
      provided: 0,
      used: 0,
    };
    limitMap.set(normalizedKey, entry);
    return entry;
  };

  items.forEach((item) => {
    const contribution = parsePersonalRealityContribution(item.metadata ?? null);
    if (!contribution) {
      return;
    }
    const quantityRaw = typeof item.quantity === "number" ? item.quantity : 1;
    const normalizedQuantity = Number.isFinite(quantityRaw) ? (quantityRaw as number) : 1;
    const multiplier = normalizedQuantity > 0 ? normalizedQuantity : 0;
    if (contribution.wpCost && multiplier > 0) {
      wpTotal += contribution.wpCost * multiplier;
    }

    Object.entries(contribution.provides).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value === 0 || multiplier === 0) {
        return;
      }
      const entry = ensureEntry(key);
      entry.provided += value * multiplier;
    });

    Object.entries(contribution.consumes).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value === 0 || multiplier === 0) {
        return;
      }
      const entry = ensureEntry(key);
      entry.used += value * multiplier;
    });
  });

  const limits = Array.from(limitMap.values())
    .filter((entry) => entry.provided !== 0 || entry.used !== 0)
    .map((entry) => ({
      ...entry,
      provided: Number.isFinite(entry.provided) ? entry.provided : 0,
      used: Number.isFinite(entry.used) ? entry.used : 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  return { wpTotal, limits };
};

export const derivePersonalRealitySummary = (
  items: InventoryItemRecord[],
  wpCap: number | null,
): WarehousePersonalRealitySummary => {
  const { wpTotal, limits } = aggregatePersonalReality(items);
  return {
    wpTotal,
    wpCap,
    limits,
  };
};
