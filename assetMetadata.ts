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

export type StipendFrequency = "once" | "daily" | "weekly" | "monthly";

export interface StipendMetadata {
  base: number;
  frequency: StipendFrequency;
  periods: number;
  total: number;
  notes?: string;
}

export interface AssetAttributeBonus {
  key: string;
  value: string;
  numericValue: number | null;
}

export interface AssetAltFormMetadata {
  name: string;
  summary: string;
}

export interface AssetMetadata {
  traitTags: string[];
  stipend: StipendMetadata | null;
  attributes: AssetAttributeBonus[];
  altForms: AssetAltFormMetadata[];
}

interface RawAssetMetadata {
  traitTags?: unknown;
  stipend?: unknown;
  attributes?: unknown;
  altForms?: unknown;
}

function normalizeTraitTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry : String(entry ?? "")).trim())
    .filter((entry) => entry.length > 0);
  return Array.from(new Set(normalized));
}

function normalizeStipend(value: unknown): StipendMetadata | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Partial<Record<string, unknown>>;
  const base = Number(raw.base ?? 0);
  const periodsRaw = Number(raw.periods ?? 1);
  const periods = Number.isFinite(periodsRaw) && periodsRaw > 0 ? Math.floor(periodsRaw) : 1;
  const frequency = (raw.frequency ?? "once") as StipendFrequency;
  const totalRaw = Number(raw.total ?? Number.NaN);
  const total =
    Number.isFinite(totalRaw) && totalRaw !== 0
      ? totalRaw
      : frequency === "once"
        ? base
        : base * periods;
  const notes =
    typeof raw.notes === "string"
      ? raw.notes.trim()
      : raw.notes == null
        ? undefined
        : String(raw.notes).trim();
  return {
    base,
    frequency,
    periods,
    total,
    notes: notes && notes.length ? notes : undefined,
  };
}

function normalizeAttributes(value: unknown): AssetAttributeBonus[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const keyRaw = record.name ?? record.key ?? record.label;
        if (keyRaw === undefined || keyRaw === null) {
          return null;
        }
        const key = String(keyRaw).trim();
        if (!key.length) {
          return null;
        }
        const valueRaw = record.value ?? record.amount ?? record.score ?? record.rank ?? "";
        const valueString = typeof valueRaw === "string" ? valueRaw : String(valueRaw ?? "");
        const numericCandidate = Number(valueString);
        const numericValue = Number.isFinite(numericCandidate) ? numericCandidate : null;
        return {
          key,
          value: valueString,
          numericValue,
        } satisfies AssetAttributeBonus;
      })
      .filter((entry): entry is AssetAttributeBonus => Boolean(entry));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => {
        const trimmed = key.trim();
        if (!trimmed.length) {
          return null;
        }
        const valueString = typeof raw === "string" ? raw : String(raw ?? "");
        const numericCandidate = Number(valueString);
        const numericValue = Number.isFinite(numericCandidate) ? numericCandidate : null;
        return {
          key: trimmed,
          value: valueString,
          numericValue,
        } satisfies AssetAttributeBonus;
      })
      .filter((entry): entry is AssetAttributeBonus => Boolean(entry));
  }
  return [];
}

function normalizeAltForms(value: unknown): AssetAltFormMetadata[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const nameRaw = record.name ?? record.title ?? record.label;
        if (!nameRaw) {
          return null;
        }
        const name = String(nameRaw).trim();
        if (!name.length) {
          return null;
        }
        const summaryRaw = record.summary ?? record.description ?? record.notes ?? "";
        const summary =
          typeof summaryRaw === "string"
            ? summaryRaw.trim()
            : summaryRaw == null
              ? ""
              : String(summaryRaw).trim();
        return { name, summary };
      })
      .filter((entry): entry is AssetAltFormMetadata => Boolean(entry));
  }
  return [];
}

export function parseAssetMetadata(metadata: string | null | undefined): AssetMetadata {
  if (!metadata) {
    return {
      traitTags: [],
      stipend: null,
      attributes: [],
      altForms: [],
    };
  }
  try {
    const parsed = JSON.parse(metadata) as RawAssetMetadata;
    return {
      traitTags: normalizeTraitTags(parsed.traitTags),
      stipend: normalizeStipend(parsed.stipend),
      attributes: normalizeAttributes(parsed.attributes),
      altForms: normalizeAltForms(parsed.altForms),
    };
  } catch (error) {
    console.warn("Failed to parse asset metadata", error);
    return {
      traitTags: [],
      stipend: null,
      attributes: [],
      altForms: [],
    };
  }
}

export function buildAssetMetadata(metadata: AssetMetadata): Record<string, unknown> | null {
  const traitTags = metadata.traitTags
    .map((tag) => tag.trim())
    .filter((tag, index, array) => tag.length > 0 && array.indexOf(tag) === index);

  const stipend = metadata.stipend;
  const attributes = metadata.attributes.filter((entry) => entry.key.trim().length > 0);
  const altForms = metadata.altForms.filter((entry) => entry.name.trim().length > 0);

  if (!traitTags.length && !stipend && !attributes.length && !altForms.length) {
    return null;
  }

  const payload: Record<string, unknown> = {};
  if (traitTags.length) {
    payload.traitTags = traitTags;
  }
  if (stipend) {
    payload.stipend = {
      base: stipend.base,
      frequency: stipend.frequency,
      periods: Math.max(stipend.periods, 1),
      total: stipend.frequency === "once" ? stipend.base : stipend.total,
      notes: stipend.notes,
    };
  }
  if (attributes.length) {
    payload.attributes = attributes.map((entry) => ({
      key: entry.key,
      value: entry.value,
    }));
  }
  if (altForms.length) {
    payload.altForms = altForms.map((entry) => ({
      name: entry.name,
      summary: entry.summary,
    }));
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
