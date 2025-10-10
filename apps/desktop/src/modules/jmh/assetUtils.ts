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

import type {
  EntityRecord,
  JumpAssetRecord,
  JumpAssetType,
} from "../../db/dao";

export const ASSET_TYPE_LABELS: Record<JumpAssetType, string> = {
  origin: "Origins",
  perk: "Perks",
  item: "Items",
  companion: "Companions",
  drawback: "Drawbacks",
};

export type StipendFrequency = "once" | "daily" | "weekly" | "monthly";

export interface StipendMetadata {
  base: number;
  frequency: StipendFrequency;
  periods: number;
  total: number;
  notes?: string;
}

export interface AssetMetadata {
  traitTags: string[];
  stipend: StipendMetadata | null;
}

export function parseAssetMetadata(asset: JumpAssetRecord | null | undefined): AssetMetadata {
  if (!asset?.metadata) {
    return { traitTags: [], stipend: null };
  }
  try {
    const parsed = JSON.parse(asset.metadata) as Partial<{
      traitTags?: unknown;
      stipend?: Partial<StipendMetadata> | null;
    }>;
    const rawTags = Array.isArray(parsed.traitTags)
      ? parsed.traitTags.map((tag) => String(tag)).filter((tag) => tag.trim().length > 0)
      : [];
    const normalizedTags = Array.from(new Set(rawTags.map((tag) => tag.trim())));
    const stipend = parsed.stipend ?? null;
    if (!stipend) {
      return { traitTags: normalizedTags, stipend: null };
    }
    const base = Number(stipend.base ?? 0);
    const periods = Number.isFinite(stipend.periods) ? Math.max(Number(stipend.periods), 1) : 1;
    const frequency = (stipend.frequency ?? "once") as StipendFrequency;
    const total = Number.isFinite(stipend.total) ? Number(stipend.total) : base * (frequency === "once" ? 1 : periods);
    return {
      traitTags: normalizedTags,
      stipend: {
        base,
        periods,
        frequency,
        total,
        notes: stipend.notes ? String(stipend.notes) : undefined,
      },
    };
  } catch (error) {
    console.warn("Failed to parse asset metadata", error);
    return { traitTags: [], stipend: null };
  }
}

export function buildAssetMetadata(metadata: AssetMetadata): Record<string, unknown> | null {
  const traitTags = metadata.traitTags
    .map((tag) => tag.trim())
    .filter((tag, index, arr) => tag.length > 0 && arr.indexOf(tag) === index);
  const stipend = metadata.stipend;
  if (!traitTags.length && (!stipend || (stipend.base === 0 && !stipend.notes))) {
    return null;
  }
  const payload: Record<string, unknown> = {};
  if (traitTags.length) {
    payload.traitTags = traitTags;
  }
  if (stipend) {
    payload.stipend = {
      base: stipend.base,
      periods: Math.max(stipend.periods, 1),
      frequency: stipend.frequency,
      total: computeStipendTotal(stipend),
      notes: stipend.notes ?? undefined,
    } satisfies StipendMetadata;
  }
  return payload;
}

export function computeStipendTotal(stipend: StipendMetadata | null | undefined): number {
  if (!stipend) {
    return 0;
  }
  if (stipend.frequency === "once") {
    return stipend.base;
  }
  return stipend.base * Math.max(stipend.periods, 1);
}

export function assetToEntity(asset: JumpAssetRecord): EntityRecord {
  const metadata = parseAssetMetadata(asset);
  const searchSegments = [asset.category, asset.subcategory, ...(metadata.traitTags ?? [])]
    .map((segment) => (segment ?? "").toString().trim())
    .filter(Boolean);
  searchSegments.push(asset.jump_id);
  const search_terms = searchSegments.join(" ");
  return {
    id: asset.id,
    type: asset.asset_type,
    name: asset.name,
    meta_json: asset.metadata,
    search_terms,
  } satisfies EntityRecord;
}

export function mergeEntitiesWithAssets(
  entities: EntityRecord[],
  assets: JumpAssetRecord[],
): EntityRecord[] {
  const merged = new Map<string, EntityRecord>();
  for (const entity of entities) {
    merged.set(entity.id, entity);
  }
  for (const asset of assets) {
    merged.set(asset.id, assetToEntity(asset));
  }
  return Array.from(merged.values());
}
