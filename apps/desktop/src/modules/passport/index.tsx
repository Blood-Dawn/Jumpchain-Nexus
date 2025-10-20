/*
Bloodawn

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
  deleteCharacterProfile,
  DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS,
  listEssentialBodyModEssences,
  listCharacterProfiles,
  loadEssentialBodyModSettings,
  loadPassportDerivedSnapshot,
  type CharacterProfileRecord,
  type EssentialBodyModEssenceRecord,
  type EssentialBodyModSettings,
  type PassportDerivedSnapshot,
  type UpsertCharacterProfileInput,
  upsertCharacterProfile,
  upsertEntity,
} from "../../db/dao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  EntityRecord,
  JumpAssetType,
  PassportDerivedAsset,
  PassportDerivedAttributeEntry,
  PassportDerivedSource,
} from "../../db/dao";
import { useJmhStore } from "../jmh/store";

type PassportMetadataCategory = "perk" | "companion" | "trait" | "stipend";

interface IconDefinition {
  symbol: string;
  description: string;
  keywords: string[];
}

const ASSET_PILL_CLASS: Record<PassportMetadataCategory, string> = {
  perk: "passport__pill--perk",
  companion: "passport__pill--companion",
  trait: "passport__pill--trait",
  stipend: "passport__pill--stipend",
};

const TRAIT_ICON_DEFINITIONS: IconDefinition[] = [
  { symbol: "🛡️", description: "Defense or protection trait", keywords: ["defens", "resist", "guard", "shield", "durab", "ward"] },
  { symbol: "⚔️", description: "Offense or combat trait", keywords: ["combat", "battle", "attack", "weapon", "martial", "fight"] },
  { symbol: "✨", description: "Magic, arcane, or supernatural trait", keywords: ["magic", "arcane", "sorcery", "spell", "mystic", "supernatural", "divine"] },
  { symbol: "🧠", description: "Mental, psionic, or knowledge trait", keywords: ["mind", "psion", "mental", "intell", "cogni", "psy", "knowledge", "learn"] },
  { symbol: "⚙️", description: "Technology or engineering trait", keywords: ["tech", "engineer", "machine", "device", "gadget", "cyber", "mechan"] },
  { symbol: "🪽", description: "Mobility or travel trait", keywords: ["speed", "swift", "travel", "flight", "move", "mobility", "teleport"] },
  { symbol: "💖", description: "Support, healing, or empathy trait", keywords: ["heal", "support", "aid", "care", "empathy", "love", "charisma", "diplom"] },
  { symbol: "🕵️", description: "Stealth or subterfuge trait", keywords: ["stealth", "spy", "rogue", "sneak", "shadow", "infil"] },
  { symbol: "💰", description: "Wealth, resources, or stipend trait", keywords: ["wealth", "gold", "money", "stipend", "income", "econom", "resource"] },
];

const METRIC_ICON_DEFINITIONS: IconDefinition[] = [
  { symbol: "💪", description: "Physical strength metric", keywords: ["strength", "str", "might", "power"] },
  { symbol: "🎯", description: "Accuracy, dexterity, or precision metric", keywords: ["dex", "dexterity", "precision", "accuracy", "agility"] },
  { symbol: "🧬", description: "Resilience, vitality, or constitution metric", keywords: ["con", "vital", "stam", "endur", "constitution", "resilience"] },
  { symbol: "🧠", description: "Intelligence or knowledge metric", keywords: ["int", "intel", "knowledge", "logic", "reason", "science"] },
  { symbol: "👁️", description: "Wisdom, perception, or insight metric", keywords: ["wis", "percep", "insight", "sense", "awaren"] },
  { symbol: "🗣️", description: "Charisma, influence, or social metric", keywords: ["cha", "charisma", "social", "influence", "presence"] },
  { symbol: "🌟", description: "General power or rating metric", keywords: ["rating", "rank", "tier", "power", "level", "grade"] },
  { symbol: "📈", description: "Progress, score, or numerical metric", keywords: ["score", "value", "points", "progress", "total", "amount"] },
];

const DEFAULT_TRAIT_ICON: IconDefinition = {
  symbol: "🔖",
  description: "General trait tag",
  keywords: [],
};

const DEFAULT_METRIC_ICON: IconDefinition = {
  symbol: "📊",
  description: "General attribute metric",
  keywords: [],
};

const ICON_LEGEND_DEFINITIONS: IconDefinition[] = Array.from(
  new Map(
    [...TRAIT_ICON_DEFINITIONS, DEFAULT_TRAIT_ICON, ...METRIC_ICON_DEFINITIONS, DEFAULT_METRIC_ICON].map((definition) => [
      definition.description,
      definition,
    ])
  ).values()
);

function resolveIconDefinition(label: string, definitions: IconDefinition[], fallback: IconDefinition): IconDefinition {
  const normalized = label.trim().toLowerCase();
  if (!normalized.length) {
    return fallback;
  }
  const match = definitions.find((definition) =>
    definition.keywords.some((keyword) => normalized.includes(keyword))
  );
  return match ?? fallback;
}

function getTraitIcon(tag: string): IconDefinition {
  return resolveIconDefinition(tag, TRAIT_ICON_DEFINITIONS, DEFAULT_TRAIT_ICON);
}

function getMetricIcon(key: string): IconDefinition {
  return resolveIconDefinition(key, METRIC_ICON_DEFINITIONS, DEFAULT_METRIC_ICON);
}

const METADATA_COLOR_LEGEND: Array<{ label: string; category: PassportMetadataCategory }> = [
  { label: "Perk metadata", category: "perk" },
  { label: "Companion metadata", category: "companion" },
  { label: "Trait tallies", category: "trait" },
  { label: "Stipend details", category: "stipend" },
];

const PassportLegend: React.FC = () => {
  return (
    <section className="passport__legend" aria-label="Legend for derived passport metadata">
      <h4 className="passport__legend-title">Legend</h4>
      <div className="passport__legend-groups">
        <div className="passport__legend-group">
          <h5>Color coding</h5>
          <ul className="passport__legend-list">
            {METADATA_COLOR_LEGEND.map((entry) => (
              <li key={entry.category}>
                <span className={`passport__pill passport__pill--legend ${ASSET_PILL_CLASS[entry.category]}`}>
                  <span>{entry.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="passport__legend-group">
          <h5>Icon meanings</h5>
          <ul className="passport__legend-list passport__legend-list--icons">
            {ICON_LEGEND_DEFINITIONS.map((definition) => (
              <li key={definition.description}>
                <span className="passport__pill-icon" aria-hidden="true">{definition.symbol}</span>
                <span>{definition.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export interface AttributeMatrixRow {
  key: string;
  manualEntries: Array<AttributeEntry & { numericValue: number | null }>;
  derivedEntries: PassportDerivedAttributeEntry[];
  manualNumericTotal: number;
  manualNumericCount: number;
  derivedNumericTotal: number;
  derivedNumericCount: number;
  numericTotal: number;
  numericCount: number;
  average: number;
}

export interface SkillMatrixRow {
  name: string;
  manualEntries: TraitEntry[];
  derivedSources: PassportDerivedSource[];
  manualCount: number;
  derivedCount: number;
  totalCount: number;
}

export interface EssenceSummaryEntry {
  name: string;
  derivedCount: number;
  recorded: boolean;
  missing: boolean;
  trackedOnly: boolean;
}

interface AttributeMatrixOptions {
  enabledAssetTypes: Set<JumpAssetType>;
  includeBoosterEntries: boolean;
}

interface SkillMatrixOptions {
  enabledAssetTypes: Set<JumpAssetType>;
  includeBoosterEntries: boolean;
}

interface EssenceSummaryOptions {
  essenceMode: EssentialBodyModSettings["essenceMode"];
}

function coerceNumber(value: string): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getAttributeKeyLabel(sourceKey: string, fallback: string | null): string {
  const trimmed = sourceKey.trim();
  if (trimmed.length) {
    return trimmed;
  }
  return fallback ?? "Unknown";
}

function normalizeAttributeKey(key: string): string {
  return key.trim().toLowerCase();
}

function normalizeTraitName(name: string): string {
  return name.trim().toLowerCase();
}

function ensureAttributeRow(
  map: Map<string, AttributeMatrixRow>,
  label: string
): AttributeMatrixRow {
  const normalized = normalizeAttributeKey(label);
  const existing = map.get(normalized);
  if (existing) {
    if (!existing.key.trim().length) {
      existing.key = label.trim();
    }
    return existing;
  }
  const row: AttributeMatrixRow = {
    key: label.trim() || "Unknown",
    manualEntries: [],
    derivedEntries: [],
    manualNumericTotal: 0,
    manualNumericCount: 0,
    derivedNumericTotal: 0,
    derivedNumericCount: 0,
    numericTotal: 0,
    numericCount: 0,
    average: 0,
  };
  map.set(normalized, row);
  return row;
}

function ensureSkillRow(map: Map<string, SkillMatrixRow>, label: string): SkillMatrixRow {
  const normalized = normalizeTraitName(label);
  const existing = map.get(normalized);
  if (existing) {
    if (!existing.name.trim().length) {
      existing.name = label.trim();
    }
    return existing;
  }
  const row: SkillMatrixRow = {
    name: label.trim() || "Unknown",
    manualEntries: [],
    derivedSources: [],
    manualCount: 0,
    derivedCount: 0,
    totalCount: 0,
  };
  map.set(normalized, row);
  return row;
}

export function buildAttributeMatrix(
  form: ProfileFormState | null,
  derived: PassportDerivedSnapshot | undefined,
  options: AttributeMatrixOptions
): AttributeMatrixRow[] {
  const map = new Map<string, AttributeMatrixRow>();

  const manualEntries = form?.attributes ?? [];
  for (const entry of manualEntries) {
    const keyLabel = getAttributeKeyLabel(entry.key, null);
    if (!keyLabel.trim().length) {
      continue;
    }
    const row = ensureAttributeRow(map, keyLabel);
    const numericValue = coerceNumber(entry.value);
    row.manualEntries.push({ ...entry, numericValue });
    if (numericValue !== null) {
      row.manualNumericTotal += numericValue;
      row.manualNumericCount += 1;
    }
  }

  const derivedAttributes = derived?.attributes ?? [];
  for (const attribute of derivedAttributes) {
    const relevantEntries = attribute.entries.filter((entry) => {
      if (!options.enabledAssetTypes.has(entry.assetType)) {
        return false;
      }
      if (!options.includeBoosterEntries && BOOSTER_ASSET_TYPES.has(entry.assetType)) {
        return false;
      }
      return true;
    });
    if (!relevantEntries.length) {
      continue;
    }
    const row = ensureAttributeRow(map, attribute.key);
    row.derivedEntries.push(...relevantEntries);
    for (const entry of relevantEntries) {
      if (entry.numericValue !== null && Number.isFinite(entry.numericValue)) {
        row.derivedNumericTotal += entry.numericValue;
        row.derivedNumericCount += 1;
      }
    }
  }

  for (const row of map.values()) {
    row.numericTotal = row.manualNumericTotal + row.derivedNumericTotal;
    row.numericCount = row.manualNumericCount + row.derivedNumericCount;
    row.average = row.numericCount
      ? Math.round((row.numericTotal / row.numericCount) * 100) / 100
      : 0;
    // Prefer a display key from manual entries if present, otherwise keep derived label
    if (!row.key.trim().length) {
      const manualMatch = row.manualEntries.find((entry) => entry.key.trim().length);
      if (manualMatch) {
        row.key = manualMatch.key.trim();
      } else if (row.derivedEntries.length) {
        row.key = row.derivedEntries[0]?.value ?? "Unknown";
      } else {
        row.key = "Unknown";
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.key.localeCompare(b.key, undefined, { sensitivity: "base" })
  );
}

export function buildSkillMatrix(
  form: ProfileFormState | null,
  derived: PassportDerivedSnapshot | undefined,
  options: SkillMatrixOptions
): SkillMatrixRow[] {
  const map = new Map<string, SkillMatrixRow>();

  const manualTraits = form?.traits ?? [];
  for (const trait of manualTraits) {
    const label = trait.name.trim();
    if (!label.length) {
      continue;
    }
    const row = ensureSkillRow(map, label);
    row.manualEntries.push(trait);
  }

  const derivedTraits = derived?.traits ?? [];
  for (const trait of derivedTraits) {
    const filteredSources = trait.sources.filter((source) => {
      if (!options.enabledAssetTypes.has(source.assetType)) {
        return false;
      }
      if (!options.includeBoosterEntries && BOOSTER_ASSET_TYPES.has(source.assetType)) {
        return false;
      }
      return true;
    });
    if (!filteredSources.length) {
      continue;
    }
    const row = ensureSkillRow(map, trait.name);
    row.derivedSources.push(...filteredSources);
  }

  for (const row of map.values()) {
    row.manualCount = row.manualEntries.length;
    row.derivedCount = row.derivedSources.length;
    row.totalCount = row.manualCount + row.derivedCount;
    if (!row.name.trim().length) {
      if (row.manualEntries.length) {
        row.name = row.manualEntries[0]?.name.trim() ?? "Unknown";
      } else if (row.derivedSources.length) {
        row.name = row.derivedSources[0]?.assetName ?? "Unknown";
      } else {
        row.name = "Unknown";
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

function extractEssenceName(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed.length) {
    return null;
  }
  const colonMatch = /^essence\s*[:\-]\s*(.+)$/i.exec(trimmed);
  if (colonMatch) {
    return colonMatch[1]?.trim() ?? null;
  }
  const ofMatch = /^essence\s+of\s+(.+)$/i.exec(trimmed);
  if (ofMatch) {
    return ofMatch[1]?.trim() ?? null;
  }
  const suffixMatch = /^(.+?)\s+essence$/i.exec(trimmed);
  if (suffixMatch) {
    return suffixMatch[1]?.trim() ?? null;
  }
  if (/essence/i.test(trimmed)) {
    return trimmed.replace(/essence/i, "").trim() || trimmed;
  }
  return null;
}

export function buildEssenceSummary(
  skillMatrix: SkillMatrixRow[],
  essences: EssentialBodyModEssenceRecord[],
  options: EssenceSummaryOptions
): EssenceSummaryEntry[] {
  const map = new Map<string, EssenceSummaryEntry>();

  for (const row of skillMatrix) {
    const essenceName = extractEssenceName(row.name);
    if (!essenceName) {
      continue;
    }
    const normalized = essenceName.toLowerCase();
    const existing = map.get(normalized);
    if (existing) {
      existing.derivedCount += row.derivedCount;
    } else {
      map.set(normalized, {
        name: essenceName,
        derivedCount: row.derivedCount,
        recorded: false,
        missing: false,
        trackedOnly: false,
      });
    }
  }

  for (const essence of essences) {
    const normalized = essence.name.trim().toLowerCase();
    if (!normalized.length) {
      continue;
    }
    const existing = map.get(normalized);
    if (existing) {
      existing.recorded = true;
    } else {
      map.set(normalized, {
        name: essence.name.trim(),
        derivedCount: 0,
        recorded: true,
        missing: false,
        trackedOnly: true,
      });
    }
  }

  for (const entry of map.values()) {
    entry.missing = options.essenceMode !== "none" && entry.derivedCount > 0 && !entry.recorded;
    entry.trackedOnly = entry.recorded && entry.derivedCount === 0;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

interface CompanionStatusEntry {
  id: string;
  name: string;
  jumpTitle: string | null;
  synced: boolean;
}

interface PassportAggregationsProps {
  form: ProfileFormState | null;
  derived: PassportDerivedSnapshot | undefined;
  derivedLoading: boolean;
  essenceSettings: EssentialBodyModSettings;
  essences: EssentialBodyModEssenceRecord[];
  companionStatuses: CompanionStatusEntry[];
  pendingCompanionIds: string[];
  syncingCompanions: boolean;
  onSyncAltForms: () => void;
  onSyncCompanions: () => void;
  onAddCompanion: (entry: CompanionStatusEntry) => void;
}

type BoosterFilterKey = "perk" | "item" | "companion";

const BOOSTER_LABELS: Record<BoosterFilterKey, string> = {
  perk: "Perk Boosters",
  item: "Item Boosters",
  companion: "Companion Boosters",
};

const ALWAYS_INCLUDED_TYPES: JumpAssetType[] = ["origin", "drawback"];
const BOOSTER_ASSET_TYPES: ReadonlySet<JumpAssetType> = new Set([
  "perk",
  "item",
  "companion",
]);

export const PassportAggregations: React.FC<PassportAggregationsProps> = ({
  form,
  derived,
  derivedLoading,
  essenceSettings,
  essences,
  companionStatuses,
  pendingCompanionIds,
  syncingCompanions,
  onSyncAltForms,
  onSyncCompanions,
  onAddCompanion,
}) => {
  const [filters, setFilters] = useState<Record<BoosterFilterKey, boolean>>({
    perk: true,
    item: true,
    companion: true,
  });
  const [includeBoosterEntries, setIncludeBoosterEntries] = useState(true);

  const enabledAssetTypes = useMemo(() => {
    const set = new Set<JumpAssetType>();
    (Object.keys(filters) as BoosterFilterKey[]).forEach((key) => {
      if (filters[key]) {
        set.add(key);
      }
    });
    for (const type of ALWAYS_INCLUDED_TYPES) {
      set.add(type);
    }
    return set;
  }, [filters]);

  const attributeMatrix = useMemo(
    () =>
      buildAttributeMatrix(form, derived, {
        enabledAssetTypes,
        includeBoosterEntries,
      }),
    [form, derived, enabledAssetTypes, includeBoosterEntries]
  );

  const skillMatrix = useMemo(
    () =>
      buildSkillMatrix(form, derived, {
        enabledAssetTypes,
        includeBoosterEntries,
      }),
    [form, derived, enabledAssetTypes, includeBoosterEntries]
  );

  const essenceSummary = useMemo(
    () => buildEssenceSummary(skillMatrix, essences, { essenceMode: essenceSettings.essenceMode }),
    [skillMatrix, essences, essenceSettings.essenceMode]
  );

  const handleFilterToggle = (key: BoosterFilterKey) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const manualAltForms = form?.altForms ?? [];
  const derivedAltForms = derived?.altForms ?? [];
  const existingAltFormNames = new Set(
    manualAltForms
      .map((entry) => entry.name.trim().toLowerCase())
      .filter((name) => name.length)
  );
  const missingAltForms = derivedAltForms.filter(
    (entry) => !existingAltFormNames.has(entry.name.trim().toLowerCase())
  );

  const missingCompanions = companionStatuses.filter((entry) => !entry.synced);
  const pendingCompanionSet = useMemo(
    () => new Set(pendingCompanionIds),
    [pendingCompanionIds]
  );

  return (
    <div className="passport__aggregations">
      <section className="passport__section passport__section--readonly">
        <header>
          <h3>Booster Filters</h3>
        </header>
        <div className="passport__toggles" role="group" aria-label="Booster Filters">
          {(Object.keys(filters) as BoosterFilterKey[]).map((key) => (
            <label key={key} className="passport__toggle">
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={() => handleFilterToggle(key)}
              />
              <span>{BOOSTER_LABELS[key]}</span>
            </label>
          ))}
          <label className="passport__toggle">
            <input
              type="checkbox"
              checked={includeBoosterEntries}
              onChange={() => setIncludeBoosterEntries((prev) => !prev)}
              aria-label="Include Booster Entries"
              data-testid="toggle-include-boosters"
            />
            <span>Include Booster Entries</span>
          </label>
        </div>
      </section>

      <section className="passport__section passport__section--readonly">
        <header>
          <h3>Attribute Matrix</h3>
          <span>{attributeMatrix.length}</span>
        </header>
        {derivedLoading && !attributeMatrix.length ? (
          <p className="passport__empty">Loading attribute totals…</p>
        ) : attributeMatrix.length ? (
          <table className="passport__matrix" data-testid="attribute-matrix">
            <thead>
              <tr>
                <th scope="col">Attribute</th>
                <th scope="col">Manual</th>
                <th scope="col">Derived</th>
                <th scope="col">Totals</th>
              </tr>
            </thead>
            <tbody>
              {attributeMatrix.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.key}</th>
                  <td>
                    {row.manualEntries.length ? (
                      <ul>
                        {row.manualEntries.map((entry) => (
                          <li key={entry.id}>
                            <strong>{entry.value || "—"}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="passport__empty">None</span>
                    )}
                  </td>
                  <td>
                    {row.derivedEntries.length ? (
                      <ul>
                        {row.derivedEntries.map((entry) => (
                          <li key={`${entry.assetId}-${entry.value}`}>
                            <strong>{entry.value || "—"}</strong>
                            <span>
                              {entry.assetName}
                              {entry.jumpTitle ? ` (${entry.jumpTitle})` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="passport__empty">None</span>
                    )}
                  </td>
                  <td data-testid={`attribute-total-${row.key.toLowerCase()}`}>
                    <div className="passport__matrix-total">
                      <span>
                        Total: {Math.round(row.numericTotal * 100) / 100}
                      </span>
                      <span>
                        Average: {Math.round(row.average * 100) / 100}
                      </span>
                    </div>
                    {!!row.manualNumericCount && (
                      <div className="passport__matrix-subtotal">
                        Manual Σ {Math.round(row.manualNumericTotal * 100) / 100}
                      </div>
                    )}
                    {!!row.derivedNumericCount && (
                      <div className="passport__matrix-subtotal">
                        Derived Σ {Math.round(row.derivedNumericTotal * 100) / 100}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="passport__empty">No attributes recorded yet.</p>
        )}
      </section>

      <section className="passport__section passport__section--readonly">
        <header>
          <h3>Skill Matrix</h3>
          <span>{skillMatrix.length}</span>
        </header>
        {derivedLoading && !skillMatrix.length ? (
          <p className="passport__empty">Loading skill tallies…</p>
        ) : skillMatrix.length ? (
          <table className="passport__matrix" data-testid="skill-matrix">
            <thead>
              <tr>
                <th scope="col">Skill / Trait</th>
                <th scope="col">Manual</th>
                <th scope="col">Derived Sources</th>
                <th scope="col">Counts</th>
              </tr>
            </thead>
            <tbody>
              {skillMatrix.map((row) => (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  <td>
                    {row.manualEntries.length ? (
                      <ul>
                        {row.manualEntries.map((entry) => (
                          <li key={entry.id}>
                            <strong>{entry.name || "—"}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="passport__empty">None</span>
                    )}
                  </td>
                  <td>
                    {row.derivedSources.length ? (
                      <ul>
                        {row.derivedSources.map((entry) => (
                          <li key={`${entry.assetId}-${entry.assetName}`}>
                            <strong>{entry.assetName}</strong>
                            <span>
                              {entry.jumpTitle ? ` (${entry.jumpTitle})` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="passport__empty">None</span>
                    )}
                  </td>
                  <td data-testid={`skill-total-${row.name.toLowerCase()}`}>
                    <div className="passport__matrix-total">
                      <span>Total: {row.totalCount}</span>
                      {!!row.manualCount && <span>Manual: {row.manualCount}</span>}
                      {!!row.derivedCount && (
                        <span>Derived: {row.derivedCount}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="passport__empty">No skills or traits captured yet.</p>
        )}
      </section>

      <section className="passport__section passport__section--readonly">
        <header>
          <h3>Essential Essence Tracker</h3>
          <span>{essenceSummary.length}</span>
        </header>
        {essenceSettings.essenceMode === "none" && !essenceSummary.length ? (
          <p className="passport__empty">Essence tracking disabled in Essential Body Mod defaults.</p>
        ) : essenceSummary.length ? (
          <ul className="passport__essence-list">
            {essenceSummary.map((entry) => (
              <li key={entry.name}>
                <div className="passport__essence-row">
                  <strong>{entry.name}</strong>
                  <span>
                    Derived: {entry.derivedCount} · {entry.recorded ? "Recorded" : "Untracked"}
                  </span>
                </div>
                {entry.missing ? (
                  <span className="passport__essence-warning">Add this essence to Essential Body Mod records.</span>
                ) : null}
                {entry.trackedOnly ? (
                  <span className="passport__essence-note">Tracked manually with no matching perk metadata.</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="passport__empty">No essences detected yet.</p>
        )}
      </section>

      <section className="passport__section passport__section--readonly">
        <header>
          <h3>Alt-Form Synchronization</h3>
          <button
            type="button"
            onClick={onSyncAltForms}
            disabled={!missingAltForms.length}
          >
            {missingAltForms.length ? `Add ${missingAltForms.length} form(s)` : "All forms synced"}
          </button>
        </header>
        <p>
          Manual forms: {manualAltForms.length} · Derived forms: {derivedAltForms.length}
        </p>
        {!missingAltForms.length ? (
          <p className="passport__hint">Manual alt-form list includes every detected form.</p>
        ) : (
          <p className="passport__hint">
            Sync to copy missing derived forms into the manual profile for exports.
          </p>
        )}
      </section>

      <section className="passport__section passport__section--readonly">
        <header>
          <h3>Companion Synchronization</h3>
          <button
            type="button"
            onClick={onSyncCompanions}
            disabled={!missingCompanions.length || syncingCompanions}
          >
            {missingCompanions.length
              ? `Sync ${missingCompanions.length} companion(s)`
              : "Roster in sync"}
          </button>
        </header>
        {companionStatuses.length ? (
          <ul className="passport__companion-list">
            {companionStatuses.map((entry) => (
              <li key={entry.id} className={entry.synced ? "passport__companion passport__companion--synced" : "passport__companion passport__companion--missing"}>
                <div className="passport__companion-row">
                  {entry.synced ? (
                    <strong>{entry.name}</strong>
                  ) : (
                    <label className="passport__companion-toggle">
                      <input
                        type="checkbox"
                        aria-label={`Add ${entry.name} to manual companions`}
                        checked={pendingCompanionSet.has(entry.id)}
                        disabled={pendingCompanionSet.has(entry.id) || syncingCompanions}
                        onChange={(event) => {
                          if (event.target.checked) {
                            onAddCompanion(entry);
                          }
                        }}
                      />
                      <strong>{entry.name}</strong>
                    </label>
                  )}
                  {entry.jumpTitle ? <span>{entry.jumpTitle}</span> : null}
                </div>
                <span className="passport__companion-status">
                  {entry.synced
                    ? "Synced"
                    : pendingCompanionSet.has(entry.id)
                    ? "Adding…"
                    : "Missing"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="passport__empty">No companions detected yet.</p>
        )}
      </section>
    </div>
  );
};

export interface AttributeEntry {
  id: string;
  key: string;
  value: string;
}

export interface TraitEntry {
  id: string;
  name: string;
  description: string;
}

export interface AltFormEntry {
  id: string;
  name: string;
  summary: string;
}

export interface ProfileFormState {
  id: string | null;
  name: string;
  alias: string;
  species: string;
  homeland: string;
  biography: string;
  notes: string;
  attributes: AttributeEntry[];
  traits: TraitEntry[];
  altForms: AltFormEntry[];
}

const createLocalId = () => Math.random().toString(36).slice(2, 10);

function createCompanionEntity(companion: PassportDerivedAsset): EntityRecord {
  const searchTerms = companion.traitTags.join(" ").trim();
  return {
    id: `passport-${companion.id}`,
    type: "companion",
    name: companion.name,
    meta_json: JSON.stringify({
      source: "passport",
      assetId: companion.id,
      jumpId: companion.jumpId,
    }),
    search_terms: searchTerms.length ? searchTerms : null,
  } satisfies EntityRecord;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch (error) {
    console.warn("Failed to parse JSON column", error);
    return fallback;
  }
}

function toFormState(record: CharacterProfileRecord): ProfileFormState {
  const attributesMap = safeParse<Record<string, string | number>>(record.attributes_json, {});
  const traitsArray = safeParse<Array<{ name: string; description?: string }>>(record.traits_json, []);
  const altFormsArray = safeParse<Array<{ name: string; summary?: string }>>(record.alt_forms_json, []);
  return {
    id: record.id,
    name: record.name ?? "",
    alias: record.alias ?? "",
    species: record.species ?? "",
    homeland: record.homeland ?? "",
    biography: record.biography ?? "",
    notes: record.notes ?? "",
    attributes: Object.entries(attributesMap).map(([key, value]) => ({
      id: createLocalId(),
      key,
      value: String(value ?? ""),
    })),
    traits: traitsArray.map((trait) => ({
      id: createLocalId(),
      name: trait.name ?? "",
      description: trait.description ?? "",
    })),
    altForms: altFormsArray.map((alt) => ({
      id: createLocalId(),
      name: alt.name ?? "",
      summary: alt.summary ?? "",
    })),
  };
}

const DerivedSummary: React.FC<{ form: ProfileFormState | null; derived: PassportDerivedSnapshot | undefined }> = ({
  form,
  derived,
}) => {
  const summary = useMemo(() => {
    const manualAttributes = form
      ? form.attributes.filter((entry) => entry.key.trim().length > 0)
      : [];
    const manualNumericValues = manualAttributes
      .map((entry) => Number(entry.value))
      .filter((value) => Number.isFinite(value));
    const manualAltFormCount = form
      ? form.altForms.filter((entry) => entry.name.trim().length > 0).length
      : 0;
    const manualTraitCount = form ? form.traits.filter((entry) => entry.name.trim().length > 0).length : 0;
    const manualAttributeCount = manualAttributes.length;
    const manualNumericTotal = manualNumericValues.reduce((acc, value) => acc + value, 0);

    const derivedAttributes = derived?.attributes ?? [];
    const derivedAttributeCount = derivedAttributes.length;
    const derivedNumericTotal = derivedAttributes.reduce((acc, entry) => acc + entry.total, 0);
    const derivedNumericCount = derivedAttributes.reduce((acc, entry) => acc + entry.numericCount, 0);
    const derivedTraitCount = derived?.traits.length ?? 0;
    const derivedAltFormCount = derived?.altForms.length ?? 0;

    const totalNumeric = manualNumericTotal + derivedNumericTotal;
    const totalNumericCount = manualNumericValues.length + derivedNumericCount;

    const attributeTotal = Math.round(totalNumeric * 100) / 100;
    const attributeAverage = totalNumericCount
      ? Math.round((totalNumeric / totalNumericCount) * 100) / 100
      : 0;
    const stipendTotal = Math.round((derived?.stipendTotal ?? 0) * 100) / 100;

    return {
      attributeTotal,
      attributeAverage,
      manualAttributeCount,
      derivedAttributeCount,
      manualTraitCount,
      derivedTraitCount,
      manualAltFormCount,
      derivedAltFormCount,
      stipendTotal,
    };
  }, [form, derived]);

  return (
    <div className="passport__summary">
      <div>
        <strong>Attribute Score</strong>
        <span>{summary.attributeTotal}</span>
      </div>
      <div>
        <strong>Average Score</strong>
        <span>{summary.attributeAverage}</span>
      </div>
      <div>
        <strong>Attributes (M / Auto)</strong>
        <span>
          {summary.manualAttributeCount} / {summary.derivedAttributeCount}
        </span>
      </div>
      <div>
        <strong>Traits (M / Auto)</strong>
        <span>
          {summary.manualTraitCount} / {summary.derivedTraitCount}
        </span>
      </div>
      <div>
        <strong>Alt Forms (M / Auto)</strong>
        <span>
          {summary.manualAltFormCount} / {summary.derivedAltFormCount}
        </span>
      </div>
      <div>
        <strong>Stipend Income</strong>
        <span>{summary.stipendTotal}</span>
      </div>
    </div>
  );
};

const DerivedCollections: React.FC<{ derived: PassportDerivedSnapshot | undefined; isLoading: boolean }> = ({
  derived,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <section className="passport__section passport__section--readonly">
        <p className="passport__empty">Loading derived jump assets…</p>
      </section>
    );
  }

  if (!derived) {
    return (
      <section className="passport__section passport__section--readonly">
        <p className="passport__empty">No jump assets available yet.</p>
      </section>
    );
  }

  const renderAssetList = (
    assets: PassportDerivedSnapshot["perks"],
    emptyMessage: string,
    category: Extract<PassportMetadataCategory, "perk" | "companion">
  ) => {
    if (!assets.length) {
      return <p className="passport__empty">{emptyMessage}</p>;
    }
    const categoryClass = ASSET_PILL_CLASS[category];
    const categoryLabel = category === "perk" ? "Perk" : "Companion";
    return (
      <ul className="passport__derived-list">
        {assets.map((asset) => (
          <li key={asset.id} className="passport__derived-item">
            <div className="passport__derived-item-header">
              <strong>{asset.name}</strong>
              {asset.jumpTitle ? <span>{asset.jumpTitle}</span> : null}
            </div>
            {asset.traitTags.length ? (
              <div className="passport__derived-tags">
                {asset.traitTags.map((tag) => {
                  const traitIcon = getTraitIcon(tag);
                  return (
                    <span
                      key={`${asset.id}-${tag}`}
                      className={`passport__pill passport__pill--tag ${categoryClass}`}
                      title={`${categoryLabel} trait tag: ${tag}`}
                      aria-label={`${categoryLabel} trait tag ${tag}. ${traitIcon.description}.`}
                    >
                      <span className="passport__pill-icon" aria-hidden="true">
                        {traitIcon.symbol}
                      </span>
                      <span>{tag}</span>
                    </span>
                  );
                })}
              </div>
            ) : null}
            {asset.attributes.length ? (
              <div className="passport__derived-tags passport__derived-tags--metrics">
                {asset.attributes.map((attribute, index) => {
                  const metricIcon = getMetricIcon(attribute.key);
                  return (
                    <span
                      key={`${asset.id}-attr-${index}`}
                      className={`passport__pill passport__pill--metric ${categoryClass}`}
                      title={`${categoryLabel} metric ${attribute.key}: ${attribute.value}`}
                      aria-label={`${categoryLabel} metric ${attribute.key} ${attribute.value}. ${metricIcon.description}.`}
                    >
                      <span className="passport__pill-icon" aria-hidden="true">
                        {metricIcon.symbol}
                      </span>
                      <span>{attribute.key}</span>
                      <span>{attribute.value}</span>
                    </span>
                  );
                })}
              </div>
            ) : null}
            {asset.notes ? <p className="passport__derived-notes">{asset.notes}</p> : null}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="passport__derived">
      <PassportLegend />
      <section className="passport__section passport__section--readonly">
        <header>
          <h3>Auto Perks</h3>
          <span>{derived.perks.length}</span>
        </header>
        {renderAssetList(derived.perks, "No perks captured from jumps yet.", "perk")}
      </section>

      <section className="passport__section passport__section--readonly">
        <header>
          <h3>Auto Companions</h3>
          <span>{derived.companions.length}</span>
        </header>
        {renderAssetList(derived.companions, "No companions recruited from jumps yet.", "companion")}
      </section>

      <section className="passport__section passport__section--readonly">
        <header>
          <h3>Auto Traits</h3>
          <span>{derived.traits.length}</span>
        </header>
        {derived.traits.length ? (
          <div className="passport__derived-tags">
            {derived.traits.map((trait) => (
              <span key={trait.name.toLowerCase()} className="passport__pill passport__pill--tally passport__pill--trait" title={`Trait tally for ${trait.name}`} aria-label={`Trait tally for ${trait.name} with ${trait.sources.length} sources.`}>
                <span>{trait.name}</span>
                <span className="passport__pill-count">{trait.sources.length}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="passport__empty">No trait metadata detected yet.</p>
        )}
      </section>

      <section className="passport__section passport__section--readonly">
        <header>
          <h3>Auto Alt-Forms</h3>
          <span>{derived.altForms.length}</span>
        </header>
        {derived.altForms.length ? (
          <ul className="passport__derived-list passport__derived-list--compact">
            {derived.altForms.map((altForm, index) => (
              <li key={`${altForm.name.toLowerCase()}-${index}`} className="passport__derived-item passport__derived-item--compact">
                <div className="passport__derived-item-header">
                  <strong>{altForm.name}</strong>
                  <span>{altForm.sources.length} sources</span>
                </div>
                {altForm.summary ? <p className="passport__derived-notes">{altForm.summary}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="passport__empty">No alternate forms recorded yet.</p>
        )}
      </section>

      {derived.stipends.length ? (
        <section className="passport__section passport__section--readonly">
          <header>
            <h3>Auto Stipends</h3>
            <span>{derived.stipends.length}</span>
          </header>
          <ul className="passport__derived-list passport__derived-list--compact">
            {derived.stipends.map((entry) => {
              const stipendIcon = getMetricIcon(entry.amount);
              return (
                <li key={`${entry.assetId}-stipend`} className="passport__derived-item passport__derived-item--compact">
                  <div className="passport__derived-item-header">
                    <strong>{entry.assetName}</strong>
                    {entry.jumpTitle ? <span>{entry.jumpTitle}</span> : null}
                  </div>
                  <div className="passport__derived-stipend">
                    <span
                      className="passport__pill passport__pill--metric passport__pill--stipend"
                      title={`Stipend paid ${entry.frequency} for ${entry.amount}`}
                      aria-label={`Stipend frequency ${entry.frequency} amount ${entry.amount}. ${stipendIcon.description}.`}
                    >
                      <span className="passport__pill-icon" aria-hidden="true">
                        {stipendIcon.symbol}
                      </span>
                      <span>{entry.frequency}</span>
                      <span>{entry.amount}</span>
                    </span>
                    {entry.notes ? <p className="passport__derived-notes">{entry.notes}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
const CosmicPassport: React.FC = () => {
  const queryClient = useQueryClient();
  const profilesQuery = useQuery({ queryKey: ["passport-profiles"], queryFn: listCharacterProfiles });
  const derivedQuery = useQuery({ queryKey: ["passport-derived"], queryFn: loadPassportDerivedSnapshot });
  const essentialSettingsQuery = useQuery({
    queryKey: ["essential-body-mod-settings"],
    queryFn: loadEssentialBodyModSettings,
  });
  const essenceListQuery = useQuery({
    queryKey: ["essential-body-mod-essences"],
    queryFn: listEssentialBodyModEssences,
  });
  const essentialSettings = essentialSettingsQuery.data ?? DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS;
  const essenceList = essenceListQuery.data ?? [];
  const derivedLoading = derivedQuery.isPending || derivedQuery.isFetching;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProfileFormState | null>(null);
  const companionEntities = useJmhStore((state) => state.entities);
  const setEntities = useJmhStore((state) => state.setEntities);
  const [pendingCompanionIds, setPendingCompanionIds] = useState<string[]>([]);
  const derivedCompanions = derivedQuery.data?.companions ?? [];
  const derivedCompanionMap = useMemo(() => {
    return new Map(derivedCompanions.map((companion) => [companion.id, companion] as const));
  }, [derivedCompanions]);
  const companionStatuses = useMemo(() => {
    if (!derivedCompanions.length) {
      return [] as CompanionStatusEntry[];
    }
    const existingNames = new Set(
      companionEntities
        .filter((entity) => entity.type === "companion")
        .map((entity) => entity.name.trim().toLowerCase())
    );
    return derivedCompanions.map((companion) => ({
      id: companion.id,
      name: companion.name,
      jumpTitle: companion.jumpTitle ?? null,
      synced: existingNames.has(companion.name.trim().toLowerCase()),
    }));
  }, [companionEntities, derivedCompanions]);

  useEffect(() => {
    if (!profilesQuery.data?.length) {
      setSelectedId(null);
      setFormState(null);
      return;
    }
    if (!selectedId || !profilesQuery.data.some((profile) => profile.id === selectedId)) {
      setSelectedId(profilesQuery.data[0].id);
    }
  }, [profilesQuery.data, selectedId]);

  const selectedProfile = useMemo(
    () => profilesQuery.data?.find((profile) => profile.id === selectedId) ?? null,
    [profilesQuery.data, selectedId]
  );

  useEffect(() => {
    if (selectedProfile) {
      setFormState(toFormState(selectedProfile));
    }
  }, [selectedProfile?.id, selectedProfile?.updated_at]);

  const upsertMutation = useMutation({
    mutationFn: (input: UpsertCharacterProfileInput) => upsertCharacterProfile(input),
    onSuccess: (profile) => {
      setSelectedId(profile.id);
      setFormState(toFormState(profile));
      queryClient.invalidateQueries({ queryKey: ["passport-profiles"] }).catch(() => undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCharacterProfile(id),
    onSuccess: () => {
      setSelectedId(null);
      setFormState(null);
      queryClient.invalidateQueries({ queryKey: ["passport-profiles"] }).catch(() => undefined);
    },
  });

  const handleCreate = async () => {
    const label = `Traveler ${profilesQuery.data ? profilesQuery.data.length + 1 : 1}`;
    await upsertMutation.mutateAsync({
      name: label,
      alias: null,
      species: null,
      homeland: null,
      biography: "",
      notes: "",
      attributes: {},
      traits: JSON.stringify([]),
      alt_forms: JSON.stringify([]),
    });
  };

  const handleSave = () => {
    if (!formState) return;
    const attributesObject = Object.fromEntries(
      formState.attributes
        .filter((entry) => entry.key.trim().length > 0)
        .map((entry) => [entry.key.trim(), entry.value])
    );
    const traitsArray = formState.traits
      .filter((entry) => entry.name.trim().length > 0)
      .map((entry) => ({ name: entry.name.trim(), description: entry.description.trim() }));
    const altFormsArray = formState.altForms
      .filter((entry) => entry.name.trim().length > 0)
      .map((entry) => ({ name: entry.name.trim(), summary: entry.summary.trim() }));

    const payload: UpsertCharacterProfileInput = {
      id: formState.id ?? undefined,
      name: formState.name.trim() || "Unnamed Traveler",
      alias: formState.alias.trim() || null,
      species: formState.species.trim() || null,
      homeland: formState.homeland.trim() || null,
      biography: formState.biography.trim() || null,
      notes: formState.notes.trim() || null,
      attributes: attributesObject,
      traits: JSON.stringify(traitsArray),
      alt_forms: JSON.stringify(altFormsArray),
    };
    upsertMutation.mutate(payload);
  };

  const handleDelete = () => {
    if (selectedId) {
      deleteMutation.mutate(selectedId);
    }
  };

  const mutateAttributes = (updater: (current: AttributeEntry[]) => AttributeEntry[]) => {
    setFormState((prev) => (prev ? { ...prev, attributes: updater(prev.attributes) } : prev));
  };

  const mutateTraits = (updater: (current: TraitEntry[]) => TraitEntry[]) => {
    setFormState((prev) => (prev ? { ...prev, traits: updater(prev.traits) } : prev));
  };

  const mutateAltForms = (updater: (current: AltFormEntry[]) => AltFormEntry[]) => {
    setFormState((prev) => (prev ? { ...prev, altForms: updater(prev.altForms) } : prev));
  };

  const handleSyncAltForms = useCallback(() => {
    if (!derivedQuery.data) {
      return;
    }
    setFormState((prev) => {
      if (!prev) {
        return prev;
      }
      const derivedAltForms = derivedQuery.data?.altForms ?? [];
      if (!derivedAltForms.length) {
        return prev;
      }
      const existing = new Set(
        prev.altForms
          .map((entry) => entry.name.trim().toLowerCase())
          .filter((name) => name.length)
      );
      const additions = derivedAltForms
        .filter((alt) => alt.name.trim().length)
        .filter((alt) => !existing.has(alt.name.trim().toLowerCase()))
        .map((alt) => ({ id: createLocalId(), name: alt.name, summary: alt.summary ?? "" }));
      if (!additions.length) {
        return prev;
      }
      return { ...prev, altForms: [...prev.altForms, ...additions] };
    });
  }, [derivedQuery.data]);

  const addCompanionMutation = useMutation({
    mutationFn: async (entries: CompanionStatusEntry[]) => {
      if (!entries.length) {
        return [] as EntityRecord[];
      }
      const currentEntities = useJmhStore.getState().entities;
      const existingNames = new Set(
        currentEntities
          .filter((entity) => entity.type === "companion")
          .map((entity) => entity.name.trim().toLowerCase())
      );
      const additions: EntityRecord[] = [];
      for (const entry of entries) {
        const derivedCompanion = derivedCompanionMap.get(entry.id);
        if (!derivedCompanion) {
          continue;
        }
        const normalizedName = derivedCompanion.name.trim().toLowerCase();
        if (!normalizedName.length || existingNames.has(normalizedName)) {
          continue;
        }
        existingNames.add(normalizedName);
        additions.push(createCompanionEntity(derivedCompanion));
      }
      await Promise.all(additions.map((entity) => upsertEntity(entity)));
      return additions;
    },
    onSuccess: (additions) => {
      if (!additions.length) {
        return;
      }
      const additionIds = new Set(additions.map((entity) => entity.id));
      const current = useJmhStore.getState().entities;
      const remaining = current.filter((entity) => !additionIds.has(entity.id));
      setEntities([...remaining, ...additions]);
    },
  });

  const handleAddCompanion = useCallback(
    async (entry: CompanionStatusEntry) => {
      if (entry.synced || addCompanionMutation.isPending) {
        return;
      }
      setPendingCompanionIds((prev) => (prev.includes(entry.id) ? prev : [...prev, entry.id]));
      try {
        await addCompanionMutation.mutateAsync([entry]);
      } catch (error) {
        console.error("Failed to add companion", error);
      } finally {
        setPendingCompanionIds((prev) => prev.filter((id) => id !== entry.id));
      }
    },
    [addCompanionMutation]
  );

  const handleSyncCompanions = useCallback(async () => {
    const missing = companionStatuses.filter((entry) => !entry.synced);
    if (!missing.length || addCompanionMutation.isPending) {
      return;
    }
    setPendingCompanionIds((prev) => {
      const next = new Set(prev);
      for (const entry of missing) {
        next.add(entry.id);
      }
      return Array.from(next);
    });
    try {
      await addCompanionMutation.mutateAsync(missing);
    } catch (error) {
      console.error("Failed to sync companions", error);
    } finally {
      setPendingCompanionIds((prev) => prev.filter((id) => !missing.some((entry) => entry.id === id)));
    }
  }, [companionStatuses, addCompanionMutation]);

  return (
    <section className="passport">
      <header className="passport__header">
        <div>
          <h1>Cosmic Passport</h1>
          <p>Capture every traveler, alternate form, and computed stat for your chain.</p>
        </div>
        <div className="passport__header-actions">
          <button type="button" onClick={handleCreate} disabled={upsertMutation.isPending}>
            {upsertMutation.isPending ? "Saving…" : "New Profile"}
          </button>
          <button
            type="button"
            className="passport__danger"
            onClick={handleDelete}
            disabled={!selectedId || deleteMutation.isPending}
          >
            Delete
          </button>
        </div>
      </header>

      <div className="passport__body">
        <aside className="passport__list">
          <h2>Profiles</h2>
          {profilesQuery.isLoading && <p className="passport__empty">Loading…</p>}
          {profilesQuery.isError && <p className="passport__empty">Failed to load profiles.</p>}
          {!profilesQuery.isLoading && !(profilesQuery.data?.length ?? 0) && (
            <p className="passport__empty">Create a profile to begin.</p>
          )}
          <ul>
            {profilesQuery.data?.map((profile) => (
              <li key={profile.id}>
                <button
                  type="button"
                  className={profile.id === selectedId ? "passport__list-item passport__list-item--active" : "passport__list-item"}
                  onClick={() => setSelectedId(profile.id)}
                >
                  <strong>{profile.name || "Unnamed Traveler"}</strong>
                  {(profile.alias || profile.species) && (
                    <span>{[profile.alias, profile.species].filter(Boolean).join(" • ")}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="passport__detail">
          {formState ? (
            <>
              <form
                className="passport__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSave();
                }}
              >
                <div className="passport__grid">
                  <label>
                    <span>Name</span>
                    <input
                      value={formState.name}
                      onChange={(event) =>
                        setFormState((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Alias</span>
                    <input
                      value={formState.alias}
                      onChange={(event) =>
                        setFormState((prev) => (prev ? { ...prev, alias: event.target.value } : prev))
                      }
                    />
                  </label>
                  <label>
                    <span>Species</span>
                    <input
                      value={formState.species}
                      onChange={(event) =>
                        setFormState((prev) => (prev ? { ...prev, species: event.target.value } : prev))
                      }
                    />
                  </label>
                  <label>
                    <span>Homeland</span>
                    <input
                      value={formState.homeland}
                      onChange={(event) =>
                        setFormState((prev) => (prev ? { ...prev, homeland: event.target.value } : prev))
                      }
                    />
                  </label>
                </div>

                <label>
                  <span>Biography</span>
                  <textarea
                    rows={4}
                    value={formState.biography}
                    onChange={(event) =>
                      setFormState((prev) => (prev ? { ...prev, biography: event.target.value } : prev))
                    }
                  />
                </label>

                <label>
                  <span>Personal Notes</span>
                  <textarea
                    rows={3}
                    value={formState.notes}
                    onChange={(event) =>
                      setFormState((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                    }
                  />
                </label>

                <section className="passport__section">
                  <header>
                    <h3>Attributes</h3>
                    <button type="button" onClick={() => mutateAttributes((entries) => [...entries, { id: createLocalId(), key: "", value: "" }])}>
                      Add Attribute
                    </button>
                  </header>
                  <div className="passport__repeat">
                    {formState.attributes.map((entry) => (
                      <div key={entry.id} className="passport__repeat-row">
                        <input
                          placeholder="Attribute"
                          value={entry.key}
                          onChange={(event) =>
                            mutateAttributes((entries) =>
                              entries.map((item) =>
                                item.id === entry.id ? { ...item, key: event.target.value } : item
                              )
                            )
                          }
                        />
                        <input
                          placeholder="Value"
                          value={entry.value}
                          onChange={(event) =>
                            mutateAttributes((entries) =>
                              entries.map((item) =>
                                item.id === entry.id ? { ...item, value: event.target.value } : item
                              )
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() => mutateAttributes((entries) => entries.filter((item) => item.id !== entry.id))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="passport__section">
                  <header>
                    <h3>Traits & Abilities</h3>
                    <button type="button" onClick={() => mutateTraits((entries) => [...entries, { id: createLocalId(), name: "", description: "" }])}>
                      Add Trait
                    </button>
                  </header>
                  <div className="passport__repeat">
                    {formState.traits.map((entry) => (
                      <div key={entry.id} className="passport__repeat-row passport__repeat-row--stacked">
                        <div className="passport__repeat-stack">
                          <input
                            placeholder="Trait"
                            value={entry.name}
                            onChange={(event) =>
                              mutateTraits((entries) =>
                                entries.map((item) =>
                                  item.id === entry.id ? { ...item, name: event.target.value } : item
                                )
                              )
                            }
                          />
                          <textarea
                            rows={2}
                            placeholder="Description"
                            value={entry.description}
                            onChange={(event) =>
                              mutateTraits((entries) =>
                                entries.map((item) =>
                                  item.id === entry.id
                                    ? { ...item, description: event.target.value }
                                    : item
                                )
                              )
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => mutateTraits((entries) => entries.filter((item) => item.id !== entry.id))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="passport__section">
                  <header>
                    <h3>Alternate Forms</h3>
                    <button type="button" onClick={() => mutateAltForms((entries) => [...entries, { id: createLocalId(), name: "", summary: "" }])}>
                      Add Form
                    </button>
                  </header>
                  <div className="passport__repeat">
                    {formState.altForms.map((entry) => (
                      <div key={entry.id} className="passport__repeat-row passport__repeat-row--stacked">
                        <div className="passport__repeat-stack">
                          <input
                            placeholder="Form Name"
                            value={entry.name}
                            onChange={(event) =>
                              mutateAltForms((entries) =>
                                entries.map((item) =>
                                  item.id === entry.id ? { ...item, name: event.target.value } : item
                                )
                              )
                            }
                          />
                          <textarea
                            rows={2}
                            placeholder="Summary"
                            value={entry.summary}
                            onChange={(event) =>
                              mutateAltForms((entries) =>
                                entries.map((item) =>
                                  item.id === entry.id
                                    ? { ...item, summary: event.target.value }
                                    : item
                                )
                              )
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => mutateAltForms((entries) => entries.filter((item) => item.id !== entry.id))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="passport__form-actions">
                  <button type="submit" disabled={upsertMutation.isPending}>
                    {upsertMutation.isPending ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>

              <DerivedSummary form={formState} derived={derivedQuery.data} />
              <PassportAggregations
                form={formState}
                derived={derivedQuery.data}
                derivedLoading={derivedLoading}
                essenceSettings={essentialSettings}
                essences={essenceList}
                companionStatuses={companionStatuses}
                pendingCompanionIds={pendingCompanionIds}
                syncingCompanions={addCompanionMutation.isPending}
                onSyncAltForms={handleSyncAltForms}
                onSyncCompanions={handleSyncCompanions}
                onAddCompanion={handleAddCompanion}
              />
              <DerivedCollections derived={derivedQuery.data} isLoading={derivedLoading} />
            </>
          ) : (
            <div className="passport__empty-state">
              <p>Select or create a profile to begin editing.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CosmicPassport;
