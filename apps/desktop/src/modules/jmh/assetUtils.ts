/*
MIT License

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

import type { EntityRecord, JumpAssetRecord, JumpAssetType } from "../../db/dao";
import {
  buildAssetMetadata,
  computeStipendTotal,
  parseAssetMetadata as parseRawAssetMetadata,
  type AssetMetadata,
  type StipendFrequency,
  type StipendMetadata,
} from "../../assetMetadata";

export { buildAssetMetadata, computeStipendTotal };
export type { AssetMetadata, StipendFrequency, StipendMetadata };

export const ASSET_TYPE_LABELS: Record<JumpAssetType, string> = {
  origin: "Origins",
  perk: "Perks",
  item: "Items",
  companion: "Companions",
  drawback: "Drawbacks",
};

export function parseAssetMetadata(asset: JumpAssetRecord | null | undefined): AssetMetadata {
  return parseRawAssetMetadata(asset?.metadata ?? null);
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
