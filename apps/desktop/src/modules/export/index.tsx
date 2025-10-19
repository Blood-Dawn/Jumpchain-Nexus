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

import React, { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import TurndownService from "turndown";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  computeBudget,
  deleteExportPreset,
  loadExportSnapshot,
  loadExportPreferences,
  listExportPresets,
  upsertExportPreset,
  type CharacterProfileRecord,
  type ExportPresetRecord,
  type ExportSnapshot,
  type InventoryItemRecord,
  type JumpAssetRecord,
  type JumpAssetType,
  type JumpRecord,
  type NoteRecord,
  type RecapRecord,
} from "../../db/dao";
import { confirmDialog } from "../../services/dialogService";
import { sanitizeHtml } from "../../utils/sanitizeHtml";

type ExportFormat = "markdown" | "bbcode" | "text";

interface ExportPresetOptions {
  format: ExportFormat;
  includeTotals: boolean;
  includeJumpMetadata: boolean;
  includeAssets: Record<JumpAssetType, boolean>;
  includeInventory: boolean;
  includeProfiles: boolean;
  includeNotes: boolean;
  includeRecaps: boolean;
  sectionPreferences: SectionPreferences;
}

interface PresetFormState {
  id: string | null;
  name: string;
  description: string;
  options: ExportPresetOptions;
}

const PREVIEW_SECTION_ORDER = [
  { key: "header", title: "Jumpchain Export" },
  { key: "totals", title: "Chain Totals" },
  { key: "jumps", title: "Jump Breakdown" },
  { key: "inventory", title: "Inventory Snapshot" },
  { key: "profiles", title: "Character Profiles" },
  { key: "notes", title: "Notes Overview" },
  { key: "recaps", title: "Recap Highlights" },
] as const;

type ExportSectionKey = (typeof PREVIEW_SECTION_ORDER)[number]["key"];
type PreviewFormat = "markdown" | "bbcode";

interface SectionPreference {
  format: PreviewFormat;
  spoiler: boolean;
}

type SectionPreferences = Record<ExportSectionKey, SectionPreference>;

const SECTION_LABELS: Record<ExportSectionKey, string> = PREVIEW_SECTION_ORDER.reduce(
  (acc, item) => ({ ...acc, [item.key]: item.title }),
  {} as Record<ExportSectionKey, string>
);

export function createDefaultSectionPreferences(): SectionPreferences {
  return PREVIEW_SECTION_ORDER.reduce((acc, item) => {
    acc[item.key] = { format: "markdown", spoiler: false };
    return acc;
  }, {} as SectionPreferences);
}

const SECTION_PREFERENCE_FALLBACK: SectionPreference = Object.freeze({
  format: "markdown",
  spoiler: false,
});

function cloneSectionPreferences(preferences: SectionPreferences): SectionPreferences {
  return PREVIEW_SECTION_ORDER.reduce((acc, item) => {
    const source = preferences[item.key] ?? SECTION_PREFERENCE_FALLBACK;
    acc[item.key] = { ...source };
    return acc;
  }, {} as SectionPreferences);
}

function mergeSectionPreferences(
  base: SectionPreferences,
  partial: unknown
): SectionPreferences {
  const next = cloneSectionPreferences(base);
  if (!partial || typeof partial !== "object") {
    return next;
  }

  const overrides = partial as Partial<Record<ExportSectionKey, Partial<SectionPreference>>>;

  for (const { key } of PREVIEW_SECTION_ORDER) {
    const override = overrides[key];
    if (!override || typeof override !== "object") {
      continue;
    }

    const current = next[key] ?? SECTION_PREFERENCE_FALLBACK;
    const updated: SectionPreference = { ...current };

    if (override.format === "markdown" || override.format === "bbcode") {
      updated.format = override.format;
    }

    if (typeof override.spoiler === "boolean") {
      updated.spoiler = override.spoiler;
    }

    next[key] = updated;
  }

  return next;
}

type FormStateUpdater =
  | PresetFormState
  | null
  | ((prev: PresetFormState | null) => PresetFormState | null);

export interface ExportConfigState {
  selectedPresetId: string | null;
  formState: PresetFormState | null;
  sectionPreferences: SectionPreferences;
  setSelectedPresetId: (id: string | null) => void;
  setFormState: (updater: FormStateUpdater) => void;
  setSectionFormat: (key: ExportSectionKey, format: PreviewFormat) => void;
  setSectionSpoiler: (key: ExportSectionKey, spoiler: boolean) => void;
  setSectionPreferences: (preferences: SectionPreferences) => void;
  updateOption: <K extends keyof ExportPresetOptions>(key: K, value: ExportPresetOptions[K]) => void;
  toggleAsset: (type: JumpAssetType, enabled: boolean) => void;
  reset: () => void;
}

export const useExportConfigStore = create<ExportConfigState>()(
  persist(
    (set) => ({
      selectedPresetId: null,
      formState: null,
      sectionPreferences: createDefaultSectionPreferences(),
      setSelectedPresetId: (selectedPresetId) => set({ selectedPresetId }),
      setFormState: (updater) =>
        set((state) => {
          if (typeof updater === "function") {
            const nextFormState = (updater as (
              prev: PresetFormState | null
            ) => PresetFormState | null)(state.formState);
            if (!nextFormState) {
              return {
                formState: null,
                sectionPreferences: createDefaultSectionPreferences(),
              };
            }
            return { formState: nextFormState };
          }

          const nextFormState = updater;
          return {
            formState: nextFormState,
            sectionPreferences: nextFormState
              ? cloneSectionPreferences(nextFormState.options.sectionPreferences)
              : createDefaultSectionPreferences(),
          };
        }),
      setSectionFormat: (key, format) =>
        set((state) => {
          const nextSectionPreferences: SectionPreferences = {
            ...state.sectionPreferences,
            [key]: {
              ...(state.sectionPreferences[key] ?? SECTION_PREFERENCE_FALLBACK),
              format,
            },
          };

          if (!state.formState) {
            return { sectionPreferences: nextSectionPreferences };
          }

          const currentFormPreferences =
            state.formState.options.sectionPreferences ?? createDefaultSectionPreferences();

          return {
            sectionPreferences: nextSectionPreferences,
            formState: {
              ...state.formState,
              options: {
                ...state.formState.options,
                sectionPreferences: {
                  ...currentFormPreferences,
                  [key]: {
                    ...(currentFormPreferences[key] ?? SECTION_PREFERENCE_FALLBACK),
                    format,
                  },
                },
              },
            },
          };
        }),
      setSectionSpoiler: (key, spoiler) =>
        set((state) => {
          const nextSectionPreferences: SectionPreferences = {
            ...state.sectionPreferences,
            [key]: {
              ...(state.sectionPreferences[key] ?? SECTION_PREFERENCE_FALLBACK),
              spoiler,
            },
          };

          if (!state.formState) {
            return { sectionPreferences: nextSectionPreferences };
          }

          const currentFormPreferences =
            state.formState.options.sectionPreferences ?? createDefaultSectionPreferences();

          return {
            sectionPreferences: nextSectionPreferences,
            formState: {
              ...state.formState,
              options: {
                ...state.formState.options,
                sectionPreferences: {
                  ...currentFormPreferences,
                  [key]: {
                    ...(currentFormPreferences[key] ?? SECTION_PREFERENCE_FALLBACK),
                    spoiler,
                  },
                },
              },
            },
          };
        }),
      setSectionPreferences: (preferences) =>
        set((state) => {
          const cloned = cloneSectionPreferences(preferences);
          if (!state.formState) {
            return { sectionPreferences: cloned };
          }

          return {
            sectionPreferences: cloned,
            formState: {
              ...state.formState,
              options: {
                ...state.formState.options,
                sectionPreferences: cloneSectionPreferences(preferences),
              },
            },
          };
        }),
      updateOption: (key, value) =>
        set((state) =>
          state.formState
            ? {
                formState: {
                  ...state.formState,
                  options: {
                    ...state.formState.options,
                    [key]: value,
                  },
                },
              }
            : state
        ),
      toggleAsset: (type, enabled) =>
        set((state) =>
          state.formState
            ? {
                formState: {
                  ...state.formState,
                  options: {
                    ...state.formState.options,
                    includeAssets: {
                      ...state.formState.options.includeAssets,
                      [type]: enabled,
                    },
                  },
                },
              }
            : state
        ),
      reset: () =>
        set({
          selectedPresetId: null,
          formState: null,
          sectionPreferences: createDefaultSectionPreferences(),
        }),
    }),
    {
      name: "export-config",
      partialize: ({ selectedPresetId, formState, sectionPreferences }) => ({
        selectedPresetId,
        formState,
        sectionPreferences,
      }),
      ...(typeof window !== "undefined"
        ? { storage: createJSONStorage(() => window.localStorage) }
        : {}),
    }
  )
);

marked.use({ mangle: false, headerIds: false, breaks: false });

const bbcodeTurndown = createBbcodeService();

const ASSET_ORDER: JumpAssetType[] = ["origin", "perk", "item", "companion", "drawback"];
const ASSET_LABELS: Record<JumpAssetType, string> = {
  origin: "Origins",
  perk: "Perks",
  item: "Items",
  companion: "Companions",
  drawback: "Drawbacks",
};

const FORMAT_METADATA: Record<ExportFormat, { label: string; mime: string; extension: string }> = {
  markdown: { label: "Markdown", mime: "text/markdown", extension: "md" },
  bbcode: { label: "BBCode", mime: "text/plain", extension: "bbcode" },
  text: { label: "Plain Text", mime: "text/plain", extension: "txt" },
};

type SectionToggleOption =
  | "includeTotals"
  | "includeJumpMetadata"
  | "includeInventory"
  | "includeProfiles"
  | "includeNotes"
  | "includeRecaps";

const SECTION_TOGGLE_CONFIG: Array<{
  option: SectionToggleOption;
  label: string;
  sectionKey: Exclude<ExportSectionKey, "header">;
}> = [
  { option: "includeTotals", label: "Chain totals", sectionKey: "totals" },
  { option: "includeJumpMetadata", label: "Jump metadata", sectionKey: "jumps" },
  { option: "includeInventory", label: "Inventory snapshot", sectionKey: "inventory" },
  { option: "includeProfiles", label: "Character profiles", sectionKey: "profiles" },
  { option: "includeNotes", label: "Notes overview", sectionKey: "notes" },
  { option: "includeRecaps", label: "Recap summaries", sectionKey: "recaps" },
];

function createBbcodeService(): TurndownService {
  const service = new TurndownService({ bulletListMarker: "-" });
  service.escape = (input) => input;

  service.addRule("paragraph", {
    filter: "p",
    replacement: (content) => (content ? `${content}\n\n` : "\n\n"),
  });

  service.addRule("lineBreak", {
    filter: "br",
    replacement: () => "\n",
  });

  service.addRule("strong", {
    filter: ["strong", "b"],
    replacement: (content) => `[b]${content}[/b]`,
  });

  service.addRule("emphasis", {
    filter: ["em", "i"],
    replacement: (content) => `[i]${content}[/i]`,
  });

  service.addRule("heading", {
    filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
    replacement: (content, node) => {
      const level = Number(node.nodeName.substring(1));
      const size = level === 1 ? 155 : level === 2 ? 135 : level === 3 ? 120 : 110;
      const trimmed = content.trim();
      return trimmed ? `[size=${size}][b]${trimmed}[/b][/size]\n\n` : "";
    },
  });

  service.addRule("unorderedList", {
    filter: "ul",
    replacement: (content) => {
      const inner = content.trim();
      return inner ? `[list]\n${inner}\n[/list]\n` : "";
    },
  });

  service.addRule("orderedList", {
    filter: "ol",
    replacement: (content) => {
      const inner = content.trim();
      return inner ? `[list=1]\n${inner}\n[/list]\n` : "";
    },
  });

  service.addRule("listItem", {
    filter: "li",
    replacement: (content) => {
      const normalized = content.replace(/\n+/g, " ").trim();
      return normalized ? `[*]${normalized}\n` : "";
    },
  });

  return service;
}

function markdownToHtml(markdown: string): string {
  return (marked.parse(markdown, { async: false }) as string).trim();
}

function markdownToSanitizedHtml(markdown: string): string {
  return sanitizeHtml(markdownToHtml(markdown));
}

function convertHtmlToBbcode(html: string): string {
  const bbcode = bbcodeTurndown.turndown(html);
  return bbcode.replace(/\n{3,}/g, "\n\n").trim();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]|'/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function wrapHtmlWithSpoiler(title: string, html: string, enabled: boolean): string {
  if (!enabled) {
    return html;
  }
  return `<details class="exports__spoiler" open><summary>${escapeHtml(title)}</summary>${html}</details>`;
}

function wrapBbcodeWithSpoiler(title: string, content: string, enabled: boolean): string {
  if (!enabled) {
    return content;
  }
  const safeTitle = title.replace(/\[/g, "(").replace(/\]/g, ")");
  return `[spoiler=${safeTitle}]${content}[/spoiler]`;
}

export interface ExportSectionContent {
  key: ExportSectionKey;
  title: string;
  markdown: string;
  text: string;
}

export interface ExportSectionPreview extends ExportSectionContent {
  html: string;
  htmlPreview: string;
  bbcode: string;
  preference: SectionPreference;
}

export function createPreviewSections(
  sections: ExportSectionContent[],
  preferences: SectionPreferences
): ExportSectionPreview[] {
  if (!sections.length) {
    return [];
  }

  return sections.map((section) => {
    const preference = preferences[section.key] ?? SECTION_PREFERENCE_FALLBACK;
    const html = markdownToSanitizedHtml(section.markdown);

    return {
      ...section,
      html,
      htmlPreview: wrapHtmlWithSpoiler(section.title, html, preference.spoiler),
      bbcode: wrapBbcodeWithSpoiler(
        section.title,
        convertHtmlToBbcode(html),
        preference.spoiler
      ),
      preference,
    };
  });
}

export function generateSections(
  snapshot: ExportSnapshot,
  options: ExportPresetOptions
): ExportSectionContent[] {
  const { assetsByJump, notesByJump, recapsByJump } = indexSnapshot(snapshot);
  const jumpMap = new Map(snapshot.jumps.map((jump) => [jump.id, jump] as const));
  const sections: ExportSectionContent[] = [
    {
      key: "header",
      title: SECTION_LABELS.header,
      markdown: formatHeading("markdown", 1, "Jumpchain Export"),
      text: formatHeading("text", 1, "Jumpchain Export"),
    },
  ];

  if (options.includeTotals) {
    const markdown = renderTotals("markdown", snapshot.jumps);
    const text = renderTotals("text", snapshot.jumps);
    if (markdown.trim()) {
      sections.push({
        key: "totals",
        title: SECTION_LABELS.totals,
        markdown,
        text,
      });
    }
  }

  const sortedJumps = snapshot.jumps
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

  const jumpMarkdownBlocks = sortedJumps
    .map((jump) => {
      const assets = assetsByJump.get(jump.id) ?? [];
      return renderJumpSection("markdown", jump, assets, options);
    })
    .filter(Boolean);

  const jumpTextBlocks = sortedJumps
    .map((jump) => {
      const assets = assetsByJump.get(jump.id) ?? [];
      return renderJumpSection("text", jump, assets, options);
    })
    .filter(Boolean);

  if (jumpMarkdownBlocks.length) {
    sections.push({
      key: "jumps",
      title: SECTION_LABELS.jumps,
      markdown: jumpMarkdownBlocks.join("\n\n"),
      text: jumpTextBlocks.join("\n\n"),
    });
  }

  if (options.includeInventory) {
    sections.push({
      key: "inventory",
      title: SECTION_LABELS.inventory,
      markdown: renderInventorySection("markdown", snapshot.inventory),
      text: renderInventorySection("text", snapshot.inventory),
    });
  }

  if (options.includeProfiles) {
    sections.push({
      key: "profiles",
      title: SECTION_LABELS.profiles,
      markdown: renderProfilesSection("markdown", snapshot.profiles),
      text: renderProfilesSection("text", snapshot.profiles),
    });
  }

  if (options.includeNotes) {
    sections.push({
      key: "notes",
      title: SECTION_LABELS.notes,
      markdown: renderNotesSection("markdown", notesByJump, jumpMap),
      text: renderNotesSection("text", notesByJump, jumpMap),
    });
  }

  if (options.includeRecaps) {
    sections.push({
      key: "recaps",
      title: SECTION_LABELS.recaps,
      markdown: renderRecapsSection("markdown", recapsByJump, jumpMap),
      text: renderRecapsSection("text", recapsByJump, jumpMap),
    });
  }

  return sections.filter((section) => section.markdown.trim() || section.text.trim());
}

export function composeDocument(
  format: ExportFormat,
  sections: ExportSectionContent[],
  preferences: SectionPreferences
): string {
  if (format === "markdown") {
    return sections
      .map((section) => section.markdown.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  if (format === "bbcode") {
    return sections
      .map((section) => {
        const html = markdownToSanitizedHtml(section.markdown);
        const bbcode = convertHtmlToBbcode(html);
        const preference = preferences[section.key] ?? SECTION_PREFERENCE_FALLBACK;
        return wrapBbcodeWithSpoiler(section.title, bbcode, preference.spoiler).trim();
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return sections
    .map((section) => section.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function createDefaultOptions(): ExportPresetOptions {
  return {
    format: "markdown",
    includeTotals: true,
    includeJumpMetadata: true,
    includeAssets: {
      origin: true,
      perk: true,
      item: true,
      companion: true,
      drawback: true,
    },
    includeInventory: true,
    includeProfiles: true,
    includeNotes: false,
    includeRecaps: false,
    sectionPreferences: createDefaultSectionPreferences(),
  };
}

function mergeOptions(partial: unknown): ExportPresetOptions {
  const base = createDefaultOptions();
  if (!partial || typeof partial !== "object") {
    return base;
  }
  const options = partial as Partial<ExportPresetOptions>;
  const rawSectionPreferences = (options as { sectionPreferences?: unknown }).sectionPreferences;
  return {
    ...base,
    ...options,
    includeAssets: {
      ...base.includeAssets,
      ...(options.includeAssets ?? {}),
    },
    format: options.format ?? base.format,
    sectionPreferences: mergeSectionPreferences(base.sectionPreferences, rawSectionPreferences),
  };
}

function parsePresetOptions(record: ExportPresetRecord | null): ExportPresetOptions {
  if (!record?.options_json) {
    return createDefaultOptions();
  }
  try {
    const parsed = JSON.parse(record.options_json);
    return mergeOptions(parsed);
  } catch (error) {
    console.warn("Failed to parse export preset options", error);
    return createDefaultOptions();
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch (error) {
    console.warn("Failed to format date", error);
    return value.slice(0, 10);
  }
}

function truncate(value: string, max = 160): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, max - 1))}…`;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag));
    }
  } catch (error) {
    // fallthrough
  }
  return raw
    .split(/[,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function formatHeading(format: "markdown" | "text", level: 1 | 2 | 3, text: string): string {
  if (format === "markdown") {
    return `${"#".repeat(level)} ${text}`;
  }
  if (level === 1) {
    return `${text.toUpperCase()}\n${"=".repeat(Math.min(text.length, 60))}`;
  }
  if (level === 2) {
    return `${text}\n${"-".repeat(Math.min(text.length, 60))}`;
  }
  return text;
}

function renderList(format: "markdown" | "text", items: string[]): string {
  if (!items.length) {
    return "";
  }
  if (format === "markdown") {
    return items.map((item) => `- ${item}`).join("\n");
  }
  return items.map((item) => `• ${item}`).join("\n");
}

function renderKeyValues(
  format: "markdown" | "text",
  entries: Array<{ key: string; value: string }>
): string {
  if (!entries.length) {
    return "";
  }
  if (format === "markdown") {
    return entries.map((entry) => `- **${entry.key}:** ${entry.value}`).join("\n");
  }
  return entries.map((entry) => `${entry.key}: ${entry.value}`).join("\n");
}

function formatCost(value: number): string {
  return `${Math.round(value)} CP`;
}

function formatAssetLine(asset: JumpAssetRecord): string {
  const quantity = Math.max(asset.quantity ?? 1, 1);
  const baseCost = Math.max(asset.cost ?? 0, 0);
  const gross = baseCost * quantity;
  const parts: string[] = [];
  const suffix: string[] = [];
  const name = asset.category ? `${asset.name} (${asset.category})` : asset.name;
  parts.push(name);
  if (quantity > 1) {
    suffix.push(`${quantity}×${baseCost}`);
  }
  if (asset.freebie === 1) {
    suffix.push("freebie");
  }
  if (asset.discounted === 1 && asset.asset_type !== "drawback") {
    suffix.push(`discounted ⇒ ${Math.round(gross / 2)} CP net`);
  }
  if (asset.asset_type === "drawback") {
    suffix.push(`credit ${Math.round(gross)} CP`);
  } else if (asset.freebie !== 1) {
    suffix.unshift(formatCost(gross));
  }
  const note = asset.notes?.replace(/\s+/g, " ").trim();
  if (note) {
    suffix.push(note);
  }
  return suffix.length ? `${parts.join(" ")} — ${suffix.join(" • ")}` : parts.join(" ");
}

function formatInventoryLine(item: InventoryItemRecord): string {
  const quantity = Math.max(item.quantity ?? 0, 0);
  const tags = parseTags(item.tags).join(", ");
  const note = item.notes?.replace(/\s+/g, " ").trim();
  const parts: string[] = [item.name];
  const suffix: string[] = [];
  if (item.category) {
    suffix.push(item.category);
  }
  if (quantity) {
    suffix.push(`qty ${quantity}`);
  }
  if (tags) {
    suffix.push(`tags: ${tags}`);
  }
  if (note) {
    suffix.push(note);
  }
  return suffix.length ? `${parts.join(" ")} — ${suffix.join(" • ")}` : parts.join(" ");
}

function getJumpLabel(jump: JumpRecord): string {
  return jump.world ? `${jump.title} (${jump.world})` : jump.title;
}

interface SnapshotMaps {
  assetsByJump: Map<string, JumpAssetRecord[]>;
  notesByJump: Map<string | null, NoteRecord[]>;
  recapsByJump: Map<string, RecapRecord[]>;
}

function indexSnapshot(snapshot: ExportSnapshot): SnapshotMaps {
  const assetsByJump = new Map<string, JumpAssetRecord[]>();
  snapshot.jumpAssets.forEach((asset) => {
    const list = assetsByJump.get(asset.jump_id) ?? [];
    list.push(asset);
    assetsByJump.set(asset.jump_id, list);
  });

  const notesByJump = new Map<string | null, NoteRecord[]>();
  snapshot.notes.forEach((note) => {
    const key = note.jump_id ?? null;
    const list = notesByJump.get(key) ?? [];
    list.push(note);
    notesByJump.set(key, list);
  });

  const recapsByJump = new Map<string, RecapRecord[]>();
  snapshot.recaps.forEach((recap) => {
    const list = recapsByJump.get(recap.jump_id) ?? [];
    list.push(recap);
    recapsByJump.set(recap.jump_id, list);
  });

  return { assetsByJump, notesByJump, recapsByJump };
}

function renderTotals(format: "markdown" | "text", jumps: JumpRecord[]): string {
  if (!jumps.length) {
    return renderKeyValues(format, [
      { key: "Total Budget", value: "0 CP" },
      { key: "Total Spent", value: "0 CP" },
      { key: "Drawback Credit", value: "0 CP" },
      { key: "Balance", value: "0 CP" },
    ]);
  }
  const totalBudget = jumps.reduce((sum, jump) => sum + (jump.cp_budget ?? 0), 0);
  const totalSpent = jumps.reduce((sum, jump) => sum + (jump.cp_spent ?? 0), 0);
  const totalCredit = jumps.reduce((sum, jump) => sum + (jump.cp_income ?? 0), 0);
  const balance = totalCredit - totalSpent;
  return renderKeyValues(format, [
    { key: "Total Budget", value: formatCost(totalBudget) },
    { key: "Total Spent", value: formatCost(totalSpent) },
    { key: "Drawback Credit", value: formatCost(totalCredit) },
    { key: "Balance", value: formatCost(balance) },
  ]);
}

function renderJumpSection(
  format: "markdown" | "text",
  jump: JumpRecord,
  assets: JumpAssetRecord[],
  options: ExportPresetOptions
): string {
  const section: string[] = [];
  const enabledTypes = ASSET_ORDER.filter((type) => options.includeAssets[type]);
  const purchases = assets
    .filter((asset) => asset.asset_type !== "drawback")
    .map((asset) => ({
      cost: Math.max(asset.cost ?? 0, 0) * Math.max(asset.quantity ?? 1, 1),
      discount: asset.discounted === 1,
      freebie: asset.freebie === 1,
    }));
  const budget = computeBudget(purchases);
  const drawbackCredit = assets
    .filter((asset) => asset.asset_type === "drawback")
    .reduce((sum, asset) => sum + Math.max(asset.cost ?? 0, 0) * Math.max(asset.quantity ?? 1, 1), 0);
  const balance = drawbackCredit - budget.netCost;

  section.push(formatHeading(format, 2, getJumpLabel(jump)));

  if (options.includeJumpMetadata) {
    const entries = [
      { key: "Status", value: jump.status ?? "planned" },
      {
        key: "Dates",
        value: `${formatDate(jump.start_date)} → ${formatDate(jump.end_date)}`,
      },
      { key: "Budget", value: formatCost(jump.cp_budget ?? 0) },
      { key: "Spent", value: formatCost(budget.netCost) },
      { key: "Drawbacks", value: formatCost(drawbackCredit) },
      { key: "Balance", value: formatCost(balance) },
    ];
    section.push(renderKeyValues(format, entries));
  }

  enabledTypes.forEach((type) => {
    const subset = assets.filter((asset) => asset.asset_type === type);
    if (!subset.length) {
      return;
    }
    section.push(formatHeading(format, 3, ASSET_LABELS[type]));
    section.push(renderList(format, subset.map((asset) => formatAssetLine(asset))));
  });

  return section.filter(Boolean).join("\n\n");
}

function renderInventorySection(
  format: "markdown" | "text",
  inventory: InventoryItemRecord[]
): string {
  if (!inventory.length) {
    return renderKeyValues(format, [{ key: "Inventory", value: "No items recorded" }]);
  }
  const warehouse = inventory.filter((item) => item.scope === "warehouse");
  const locker = inventory.filter((item) => item.scope === "locker");
  const blocks: string[] = [formatHeading(format, 2, "Inventory Snapshot")];
  if (warehouse.length) {
    blocks.push(formatHeading(format, 3, "Warehouse"));
    blocks.push(renderList(format, warehouse.map((item) => formatInventoryLine(item))));
  }
  if (locker.length) {
    blocks.push(formatHeading(format, 3, "Locker"));
    blocks.push(renderList(format, locker.map((item) => formatInventoryLine(item))));
  }
  if (!warehouse.length && !locker.length) {
    blocks.push(renderKeyValues(format, [{ key: "Status", value: "Empty" }]));
  }
  return blocks.filter(Boolean).join("\n\n");
}

function renderProfilesSection(
  format: "markdown" | "text",
  profiles: CharacterProfileRecord[]
): string {
  if (!profiles.length) {
    return "";
  }
  const blocks: string[] = [formatHeading(format, 2, "Character Profiles")];
  profiles.forEach((profile) => {
    blocks.push(formatHeading(format, 3, profile.name));
    const entries = [
      profile.alias ? { key: "Alias", value: profile.alias } : null,
      profile.species ? { key: "Species", value: profile.species } : null,
      profile.homeland ? { key: "Homeland", value: profile.homeland } : null,
    ].filter(Boolean) as Array<{ key: string; value: string }>;
    if (profile.biography) {
      entries.push({ key: "Bio", value: truncate(profile.biography, 220) });
    }
    if (!entries.length) {
      entries.push({ key: "Details", value: "No metadata recorded." });
    }
    blocks.push(renderKeyValues(format, entries));
  });
  return blocks.filter(Boolean).join("\n\n");
}

function renderNotesSection(
  format: "markdown" | "text",
  notesByJump: Map<string | null, NoteRecord[]>,
  jumps: Map<string, JumpRecord>
): string {
  if (!notesByJump.size) {
    return renderKeyValues(format, [{ key: "Notes", value: "No notes captured." }]);
  }
  const blocks: string[] = [formatHeading(format, 2, "Notes Overview")];
  const entries: string[] = [];
  for (const [jumpId, list] of notesByJump.entries()) {
    const jump = jumpId ? jumps.get(jumpId) : null;
    const label = jump ? getJumpLabel(jump) : "Global";
    const snippet = truncate(list[0]?.md ?? "", 180);
    entries.push(`${label} — ${list.length} note${list.length === 1 ? "" : "s"}${snippet ? ` • ${snippet}` : ""}`);
  }
  blocks.push(renderList(format, entries));
  return blocks.filter(Boolean).join("\n\n");
}

function renderRecapsSection(
  format: "markdown" | "text",
  recapsByJump: Map<string, RecapRecord[]>,
  jumps: Map<string, JumpRecord>
): string {
  if (!recapsByJump.size) {
    return "";
  }
  const blocks: string[] = [formatHeading(format, 2, "Recap Highlights")];
  const entries: string[] = [];
  for (const [jumpId, list] of recapsByJump.entries()) {
    const jump = jumps.get(jumpId);
    const label = jump ? getJumpLabel(jump) : "Unknown Jump";
    const snippet = truncate(list[0]?.md ?? "", 160);
    entries.push(`${label} — ${list.length} recap${list.length === 1 ? "" : "s"} • ${snippet}`);
  }
  blocks.push(renderList(format, entries));
  return blocks.filter(Boolean).join("\n\n");
}

const ExportCenter: React.FC = () => {
  const queryClient = useQueryClient();
  const presetsQuery = useQuery({ queryKey: ["export-presets"], queryFn: listExportPresets });
  const snapshotQuery = useQuery({ queryKey: ["export-snapshot"], queryFn: loadExportSnapshot });
  const exportPreferencesQuery = useQuery({
    queryKey: ["export-preferences"],
    queryFn: loadExportPreferences,
  });

  const selectedPresetId = useExportConfigStore((state) => state.selectedPresetId);
  const setSelectedPresetId = useExportConfigStore((state) => state.setSelectedPresetId);
  const formState = useExportConfigStore((state) => state.formState);
  const setFormState = useExportConfigStore((state) => state.setFormState);
  const sectionPreferences = useExportConfigStore((state) => state.sectionPreferences);
  const setSectionFormat = useExportConfigStore((state) => state.setSectionFormat);
  const setSectionSpoiler = useExportConfigStore((state) => state.setSectionSpoiler);
  const updateOption = useExportConfigStore((state) => state.updateOption);
  const toggleAsset = useExportConfigStore((state) => state.toggleAsset);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const defaultAppliedRef = useRef<string | null>(null);

  const selectedPreset = useMemo(() => {
    if (!presetsQuery.data) {
      return null;
    }
    return presetsQuery.data.find((preset) => preset.id === selectedPresetId) ?? null;
  }, [presetsQuery.data, selectedPresetId]);

  useEffect(() => {
    const presets = presetsQuery.data ?? [];
    const defaultPresetId = exportPreferencesQuery.data?.defaultPresetId ?? null;
    const hasPresets = presets.length > 0;

    if (!hasPresets) {
      if (selectedPresetId !== null) {
        setSelectedPresetId(null);
      }
      defaultAppliedRef.current = null;
      return;
    }

    const presetExists = selectedPresetId
      ? presets.some((preset) => preset.id === selectedPresetId)
      : false;
    const defaultExists = defaultPresetId
      ? presets.some((preset) => preset.id === defaultPresetId)
      : false;

    if (!presetExists) {
      if (defaultExists) {
        setSelectedPresetId(defaultPresetId);
        defaultAppliedRef.current = defaultPresetId;
      } else {
        setSelectedPresetId(presets[0].id);
        defaultAppliedRef.current = null;
      }
      return;
    }

    if (defaultExists && defaultAppliedRef.current !== defaultPresetId) {
      setSelectedPresetId(defaultPresetId);
      defaultAppliedRef.current = defaultPresetId;
    }
  }, [exportPreferencesQuery.data?.defaultPresetId, presetsQuery.data, selectedPresetId]);

  useEffect(() => {
    if (!selectedPreset) {
      setFormState(null);
      return;
    }

    const options = parsePresetOptions(selectedPreset);
    setFormState({
      id: selectedPreset.id,
      name: selectedPreset.name,
      description: selectedPreset.description ?? "",
      options,
    });
  }, [selectedPreset, setFormState]);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }
    const timer = window.setTimeout(() => setStatusMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const sections = useMemo(() => {
    if (!formState || !snapshotQuery.data) {
      return [] as ExportSectionContent[];
    }
    return generateSections(snapshotQuery.data, formState.options);
  }, [formState?.options, snapshotQuery.data]);

  const previewSections = useMemo(
    () => createPreviewSections(sections, sectionPreferences),
    [sections, sectionPreferences]
  );

  const previewContent = useMemo(() => {
    if (!formState || !sections.length) {
      return "";
    }
    return composeDocument(formState.options.format, sections, sectionPreferences);
  }, [formState?.options.format, sections, sectionPreferences]);

  const upsertMutation = useMutation({
    mutationFn: upsertExportPreset,
    onSuccess: async (record) => {
      await queryClient.invalidateQueries({ queryKey: ["export-presets"] });
      setSelectedPresetId(record.id);
      setStatusMessage("Preset saved.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExportPreset,
    onSuccess: async (_, deletedId) => {
      await queryClient.invalidateQueries({ queryKey: ["export-presets"] });
      setStatusMessage("Preset deleted.");
      if (useExportConfigStore.getState().selectedPresetId === deletedId) {
        setSelectedPresetId(null);
      }
    },
  });

  const handleCreatePreset = async () => {
    const name = window.prompt("Preset name", "New Export Preset");
    if (!name || !name.trim()) {
      return;
    }
    await upsertMutation.mutateAsync({
      name: name.trim(),
      description: "",
      options: JSON.stringify(createDefaultOptions()),
    });
  };

  const handleDuplicatePreset = async () => {
    if (!formState) return;
    const cloneName = `${formState.name.trim()} Copy`;
    await upsertMutation.mutateAsync({
      name: cloneName,
      description: formState.description,
      options: JSON.stringify(formState.options),
    });
  };

  const handleDeletePreset = async () => {
    if (!selectedPreset) return;
    const confirmed = await confirmDialog({
      message: `Delete preset "${selectedPreset.name}"?`,
      title: "Delete export preset",
      kind: "warning",
      okLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(selectedPreset.id);
  };

  const handleSavePreset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState) return;
    await upsertMutation.mutateAsync({
      id: formState.id ?? undefined,
      name: formState.name.trim() || "Untitled Preset",
      description: formState.description.trim(),
      options: JSON.stringify(formState.options),
    });
  };

  const handleCopyPreview = async () => {
    if (!previewContent) return;
    try {
      await navigator.clipboard.writeText(previewContent);
      setStatusMessage("Copied export to clipboard.");
    } catch (error) {
      console.error("Clipboard copy failed", error);
      setStatusMessage("Clipboard copy failed.");
    }
  };

  const handleDownloadPreview = () => {
    if (!formState || !previewContent) return;
    const meta = FORMAT_METADATA[formState.options.format];
    const filename = `${formState.name.trim().replace(/\s+/g, "-") || "jumpchain-export"}.${meta.extension}`;
    const blob = new Blob([previewContent], { type: `${meta.mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Download started.");
  };

  const handleOptionChange = <K extends keyof ExportPresetOptions>(key: K, value: ExportPresetOptions[K]) => {
    updateOption(key, value);
  };

  const handleAssetToggle = (type: JumpAssetType, checked: boolean) => {
    toggleAsset(type, checked);
  };

  return (
    <section className="exports">
      <header className="exports__header">
        <div>
          <h1>Export Suite</h1>
          <p>Generate BBCode, Markdown, or plaintext briefs for your entire chain.</p>
        </div>
        <div className="exports__header-actions">
          <button type="button" onClick={handleCreatePreset} disabled={upsertMutation.isPending}>
            New Preset
          </button>
          <button
            type="button"
            onClick={handleDuplicatePreset}
            disabled={!formState || upsertMutation.isPending}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="exports__danger"
            onClick={handleDeletePreset}
            disabled={!selectedPreset || deleteMutation.isPending}
          >
            Delete
          </button>
        </div>
      </header>

      <div className="exports__layout">
        <aside className="exports__presets">
          <h2>Presets</h2>
          {presetsQuery.isLoading && <p>Loading presets…</p>}
          {presetsQuery.isError && <p className="exports__empty">Failed to load presets.</p>}
          {!presetsQuery.isLoading && !(presetsQuery.data?.length ?? 0) && (
            <p className="exports__empty">No presets yet. Create one to get started.</p>
          )}
          <ul>
            {presetsQuery.data?.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  className={preset.id === selectedPresetId ? "exports__preset exports__preset--active" : "exports__preset"}
                  onClick={() => setSelectedPresetId(preset.id)}
                >
                  <strong>{preset.name}</strong>
                  {preset.description && <span>{preset.description}</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="exports__main">
          {!formState && (
            <p className="exports__empty">Select or create a preset to configure export options.</p>
          )}

          {formState && (
            <>
              <form className="exports__form" onSubmit={handleSavePreset}>
                <div className="exports__field">
                  <label>
                    <span>Preset Name</span>
                    <input
                      type="text"
                      value={formState.name}
                      onChange={(event) =>
                        setFormState((prev) =>
                          prev
                            ? {
                                ...prev,
                                name: event.target.value,
                              }
                            : prev,
                        )
                      }
                    />
                  </label>
                </div>
                <div className="exports__field">
                  <label>
                    <span>Description</span>
                    <input
                      type="text"
                      value={formState.description}
                      onChange={(event) =>
                        setFormState((prev) =>
                          prev
                            ? {
                                ...prev,
                                description: event.target.value,
                              }
                            : prev,
                        )
                      }
                    />
                  </label>
                </div>

                <fieldset className="exports__fieldset">
                  <legend>Output Format</legend>
                  <div className="exports__options-row">
                    {(Object.keys(FORMAT_METADATA) as ExportFormat[]).map((format) => (
                      <label key={format}>
                        <input
                          type="radio"
                          name="format"
                          value={format}
                          checked={formState.options.format === format}
                          onChange={() => handleOptionChange("format", format)}
                        />
                        {FORMAT_METADATA[format].label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="exports__fieldset">
                  <legend>Sections</legend>
                  <div className="exports__options-grid">
                    {SECTION_TOGGLE_CONFIG.map(({ option, label, sectionKey }) => (
                      <div key={option} className="exports__section-card">
                        <label>
                          <input
                            type="checkbox"
                            checked={formState.options[option] as boolean}
                            onChange={(event) => handleOptionChange(option, event.target.checked)}
                          />
                          {label}
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={sectionPreferences[sectionKey]?.spoiler ?? false}
                            onChange={(event) =>
                              setSectionSpoiler(sectionKey, event.target.checked)
                            }
                          />
                          Spoiler
                        </label>
                      </div>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="exports__fieldset">
                  <legend>Asset Types</legend>
                  <div className="exports__options-row">
                    {ASSET_ORDER.map((type) => (
                      <label key={type}>
                        <input
                          type="checkbox"
                          checked={formState.options.includeAssets[type]}
                          onChange={(event) => handleAssetToggle(type, event.target.checked)}
                        />
                        {ASSET_LABELS[type]}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="exports__form-actions">
                  <button type="submit" disabled={upsertMutation.isPending}>
                    {upsertMutation.isPending ? "Saving…" : "Save Preset"}
                  </button>
                  {statusMessage && <span>{statusMessage}</span>}
                </div>
              </form>

              <section className="exports__preview">
                <header>
                  <div>
                    <h2>Preview</h2>
                    <p>
                      {snapshotQuery.isLoading
                        ? "Loading snapshot…"
                        : snapshotQuery.isError
                          ? "Snapshot unavailable."
                          : "Previews honor format and spoiler preferences."}
                    </p>
                  </div>
                </header>
                <div className="exports__preview-grid">
                  {previewSections.length ? (
                    previewSections.map((section) => (
                      <article key={section.key} className="exports__preview-card">
                        <header className="exports__preview-card-header">
                          <h3>{section.title}</h3>
                          <div className="exports__preview-card-controls">
                            <div className="exports__preview-format" role="group" aria-label="Preview format">
                              <button
                                type="button"
                                className={
                                  section.preference.format === "markdown"
                                    ? "exports__preview-format-btn exports__preview-format-btn--active"
                                    : "exports__preview-format-btn"
                                }
                                onClick={() => setSectionFormat(section.key, "markdown")}
                                aria-pressed={section.preference.format === "markdown"}
                              >
                                Markdown
                              </button>
                              <button
                                type="button"
                                className={
                                  section.preference.format === "bbcode"
                                    ? "exports__preview-format-btn exports__preview-format-btn--active"
                                    : "exports__preview-format-btn"
                                }
                                onClick={() => setSectionFormat(section.key, "bbcode")}
                                aria-pressed={section.preference.format === "bbcode"}
                              >
                                BBCode
                              </button>
                            </div>
                            <label className="exports__preview-spoiler">
                              <input
                                type="checkbox"
                                checked={section.preference.spoiler}
                                onChange={(event) => setSectionSpoiler(section.key, event.target.checked)}
                              />
                              Spoiler
                            </label>
                          </div>
                        </header>
                        <div className="exports__preview-pane">
                          {section.preference.format === "markdown" ? (
                            <div
                              className="exports__preview-markdown"
                              dangerouslySetInnerHTML={{ __html: section.htmlPreview }}
                            />
                          ) : (
                            <pre className="exports__preview-code">{section.bbcode}</pre>
                          )}
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="exports__empty">No preview available. Adjust export options to enable sections.</p>
                  )}
                </div>
                <div className="exports__preview-actions">
                  <button type="button" onClick={handleCopyPreview} disabled={!previewContent}>
                    Copy
                  </button>
                  <button type="button" onClick={handleDownloadPreview} disabled={!previewContent}>
                    Download
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default ExportCenter;
