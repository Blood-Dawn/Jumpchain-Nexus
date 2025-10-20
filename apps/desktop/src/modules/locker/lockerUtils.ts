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

import type { InventoryItemRecord } from "../../db/dao";

export type LockerPriority = "low" | "medium" | "high";
export type BodyModType = "universal" | "essential";

export interface LockerMetadata extends Record<string, unknown> {
  packed?: boolean;
  priority?: LockerPriority;
  bodyMod?: BodyModType | null;
}

export interface LockerDependency {
  id: string;
  raw: string;
  kind: "booster" | "tag";
}

export interface LockerItemAnalysis {
  item: InventoryItemRecord;
  metadata: LockerMetadata;
  packed: boolean;
  priority: LockerPriority;
  manualWarnings: LockerWarning[];
  tags: string[];
  tagSet: Set<string>;
  bodyModType: BodyModType | null;
  boosterIds: string[];
  dependencies: LockerDependency[];
  hasBooster: boolean;
  searchText: string;
}

export interface LockerFilters {
  packed: "all" | "packed" | "unpacked";
  priority: "all" | LockerPriority;
  bodyMod: "all" | BodyModType | "none";
  booster: "all" | "booster" | "non-booster";
}

export interface LockerTagOption {
  value: string;
  label: string;
}

export interface LockerAvailabilitySettings {
  essentialEnabled: boolean;
  universalEnabled: boolean;
}

export type LockerWarningType =
  | "missing-booster"
  | "body-mod-disabled"
  | "universal-disabled"
  | "priority-high";

export interface LockerWarning {
  type: LockerWarningType;
  message: string;
}

const BODY_MOD_KEYWORDS: Record<string, BodyModType> = {
  universal: "universal",
  essential: "essential",
};

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return undefined;
    }
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return undefined;
}

const LEGACY_PRIORITY_MAP: Record<string, LockerPriority> = {
  essential: "high",
  standard: "medium",
  luxury: "low",
};

function normalizePriority(value: unknown): LockerPriority | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  if (normalized in LEGACY_PRIORITY_MAP) {
    return LEGACY_PRIORITY_MAP[normalized];
  }
  return undefined;
}

function detectBodyMod(value: unknown): BodyModType | null | undefined {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized in BODY_MOD_KEYWORDS) {
      return BODY_MOD_KEYWORDS[normalized];
    }
  }
  if (typeof value === "object" && value) {
    if ("type" in (value as Record<string, unknown>)) {
      return detectBodyMod((value as Record<string, unknown>).type);
    }
    if ("category" in (value as Record<string, unknown>)) {
      return detectBodyMod((value as Record<string, unknown>).category);
    }
  }
  return undefined;
}

export function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag));
    }
  } catch {
    // fallback to manual parsing
  }
  return raw
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseLockerMetadata(raw: string | null): LockerMetadata {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const metadata: LockerMetadata = { ...parsed };
    const packed = normalizeBoolean(parsed.packed);
    if (packed !== undefined) {
      metadata.packed = packed;
    }
    const priority = normalizePriority(parsed.priority);
    if (priority) {
      metadata.priority = priority;
    }
    const bodyModFromMetadata =
      detectBodyMod(parsed.bodyMod) ??
      detectBodyMod((parsed as Record<string, unknown>).body_mod) ??
      detectBodyMod((parsed as Record<string, unknown>).bodyModType);
    if (bodyModFromMetadata !== undefined) {
      metadata.bodyMod = bodyModFromMetadata ?? null;
    }
    return metadata;
  } catch {
    return {};
  }
}

function normalizeTagValue(tag: string): string {
  return tag.trim().toLowerCase();
}

function formatTagLabel(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed.length) {
    return "";
  }
  const normalized = trimmed
    .replace(/[_/]+/g, " ")
    .replace(/-+/g, " ")
    .replace(/:+/g, ": ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const titled = normalized.replace(/\b\w/g, (char) => char.toUpperCase());
  return titled.length ? titled : trimmed;
}

function sanitizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseBoosterTag(tag: string): string | null {
  const normalized = normalizeTagValue(tag);
  const match = normalized.match(/^booster[\s:_-]*(.+)$/);
  if (!match) {
    return null;
  }
  const identifier = sanitizeIdentifier(match[1]);
  return identifier.length ? identifier : null;
}

function parseDependencyTag(tag: string): LockerDependency | null {
  const normalized = normalizeTagValue(tag);
  const match = normalized.match(/^(requires|prereq|needs)[\s:_-]*(?:booster[\s:_-]*)?(.+)$/);
  if (!match) {
    return null;
  }
  const identifier = sanitizeIdentifier(match[2]);
  if (!identifier.length) {
    return null;
  }
  const kind: LockerDependency["kind"] = normalized.includes("booster") ? "booster" : "tag";
  return { id: identifier, raw: tag, kind };
}

function detectBodyModFromTag(tag: string): BodyModType | null {
  const normalized = normalizeTagValue(tag);
  const match = normalized.match(/(body[\s-]*mod|bm)[\s:_-]*(universal|essential)/);
  if (match) {
    return BODY_MOD_KEYWORDS[match[2]];
  }
  if (normalized.includes("essential body")) {
    return "essential";
  }
  if (normalized.includes("universal body")) {
    return "universal";
  }
  return null;
}

function analyzeTags(tags: string[], metadata: LockerMetadata): {
  bodyModType: BodyModType | null;
  boosterIds: string[];
  dependencies: LockerDependency[];
} {
  const boosters: string[] = [];
  const dependencies: LockerDependency[] = [];
  let bodyModType: BodyModType | null = metadata.bodyMod ?? null;

  for (const tag of tags) {
    const boosterId = parseBoosterTag(tag);
    if (boosterId && !boosters.includes(boosterId)) {
      boosters.push(boosterId);
    }
    const dependency = parseDependencyTag(tag);
    if (dependency) {
      dependencies.push(dependency);
    }
    if (!bodyModType) {
      const detected = detectBodyModFromTag(tag);
      if (detected) {
        bodyModType = detected;
      }
    }
  }

  return { bodyModType, boosterIds: boosters, dependencies };
}

export function mapLockerItems(records: InventoryItemRecord[]): LockerItemAnalysis[] {
  return records.map((item) => {
    const metadata = parseLockerMetadata(item.metadata);
    const tags = parseTags(item.tags);
    const { bodyModType, boosterIds, dependencies } = analyzeTags(tags, metadata);
    const packed = typeof metadata.packed === "boolean" ? metadata.packed : false;
    const priority = metadata.priority ?? "medium";
    const manualWarnings: LockerWarning[] = [];
    if (priority === "high") {
      manualWarnings.push({ type: "priority-high", message: "Marked as high priority." });
    }
    const tagSet = new Set(tags.map((tag) => normalizeTagValue(tag)));
    const searchText = [item.name, item.category, item.slot, item.notes, ...tags]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
      .join(" ");
    return {
      item,
      metadata,
      packed,
      priority,
      manualWarnings,
      tags,
      tagSet,
      bodyModType,
      boosterIds,
      dependencies,
      hasBooster: boosterIds.length > 0,
      searchText,
    } satisfies LockerItemAnalysis;
  });
}

export function filterLockerItems(
  items: LockerItemAnalysis[],
  filters: LockerFilters,
  search: string,
  activeTags: string[] = []
): LockerItemAnalysis[] {
  const trimmedSearch = search.trim().toLowerCase();
  const requiredTags = activeTags
    .map((tag) => normalizeTagValue(tag))
    .filter((tag, index, array) => tag.length > 0 && array.indexOf(tag) === index);
  return items.filter((entry) => {
    if (filters.packed !== "all") {
      if (filters.packed === "packed" && !entry.packed) {
        return false;
      }
      if (filters.packed === "unpacked" && entry.packed) {
        return false;
      }
    }
    if (filters.priority !== "all" && entry.priority !== filters.priority) {
      return false;
    }
    if (filters.bodyMod !== "all") {
      if (filters.bodyMod === "none" && entry.bodyModType) {
        return false;
      }
      if (filters.bodyMod !== "none" && entry.bodyModType !== filters.bodyMod) {
        return false;
      }
    }
    if (filters.booster === "booster" && !entry.hasBooster) {
      return false;
    }
    if (filters.booster === "non-booster" && entry.hasBooster) {
      return false;
    }
    if (requiredTags.length > 0) {
      for (const tag of requiredTags) {
        if (!entry.tagSet.has(tag)) {
          return false;
        }
      }
    }
    if (!trimmedSearch.length) {
      return true;
    }
    return entry.searchText.includes(trimmedSearch);
  });
}

export function collectLockerTags(items: LockerItemAnalysis[]): LockerTagOption[] {
  const labelMap = new Map<string, string>();
  items.forEach((entry) => {
    entry.tags.forEach((tag) => {
      const normalized = normalizeTagValue(tag);
      if (!normalized.length) {
        return;
      }
      if (!labelMap.has(normalized)) {
        const label = formatTagLabel(tag);
        labelMap.set(normalized, label);
      }
    });
  });
  return Array.from(labelMap.entries())
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([value, label]) => ({ value, label }));
}

function formatDependencyLabel(dependency: LockerDependency): string {
  if (dependency.raw.trim().length) {
    return dependency.raw.trim();
  }
  if (dependency.kind === "booster") {
    return `booster ${dependency.id}`;
  }
  return dependency.id;
}

export function computeLockerWarnings(
  items: LockerItemAnalysis[],
  availability: LockerAvailabilitySettings
): Record<string, LockerWarning[]> {
  const warnings: Record<string, LockerWarning[]> = {};
  const availableBoosters = new Set<string>();
  const availableTagIds = new Set<string>();

  items.forEach((entry) => {
    entry.boosterIds.forEach((id) => {
      availableBoosters.add(id);
      availableBoosters.add(`booster:${id}`);
    });
    entry.tags.forEach((tag) => {
      const normalized = normalizeTagValue(tag);
      if (normalized.startsWith("requires") || normalized.startsWith("prereq") || normalized.startsWith("needs")) {
        return;
      }
      availableTagIds.add(normalized);
      const sanitized = sanitizeIdentifier(normalized);
      if (sanitized.length) {
        availableTagIds.add(sanitized);
      }
      const segments = normalized.split(/[:/_-]+/).filter(Boolean);
      segments.forEach((segment) => {
        if (segment.length) {
          availableTagIds.add(segment);
        }
      });
    });
  });

  items.forEach((entry) => {
    const entryWarnings: LockerWarning[] = [...entry.manualWarnings];
    entry.dependencies.forEach((dependency) => {
      const normalizedId = dependency.id;
      let satisfied = false;
      if (dependency.kind === "booster") {
        const boosterKey = `booster:${normalizedId}`;
        satisfied =
          availableBoosters.has(normalizedId) ||
          availableBoosters.has(boosterKey) ||
          availableTagIds.has(normalizedId) ||
          availableTagIds.has(boosterKey);
      } else {
        const normalizedRaw = normalizeTagValue(dependency.raw);
        satisfied = availableTagIds.has(normalizedId) || availableTagIds.has(normalizedRaw);
      }
      if (!satisfied) {
        entryWarnings.push({
          type: "missing-booster",
          message: `Missing prerequisite: ${formatDependencyLabel(dependency)}`,
        });
      }
    });

    if (entry.bodyModType === "essential" && !availability.essentialEnabled) {
      entryWarnings.push({
        type: "body-mod-disabled",
        message: "Essential Body Mod options are disabled in Options.",
      });
    }
    if (entry.bodyModType === "universal" && !availability.universalEnabled) {
      entryWarnings.push({
        type: "universal-disabled",
        message: "Universal Body Mod sharing is disabled in Options.",
      });
    }

    if (entryWarnings.length) {
      warnings[entry.item.id] = entryWarnings;
    }
  });

  return warnings;
}

