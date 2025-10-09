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

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  computeBudget,
  deleteExportPreset,
  loadExportSnapshot,
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
}

interface PresetFormState {
  id: string | null;
  name: string;
  description: string;
  options: ExportPresetOptions;
}

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

function createDefaultOptions(): ExportPresetOptions {
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
  };
}

function mergeOptions(partial: unknown): ExportPresetOptions {
  const base = createDefaultOptions();
  if (!partial || typeof partial !== "object") {
    return base;
  }
  const options = partial as Partial<ExportPresetOptions>;
  return {
    ...base,
    ...options,
    includeAssets: {
      ...base.includeAssets,
      ...(options.includeAssets ?? {}),
    },
    format: options.format ?? base.format,
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

function formatHeading(format: ExportFormat, level: 1 | 2 | 3, text: string): string {
  if (format === "markdown") {
    return `${"#".repeat(level)} ${text}`;
  }
  if (format === "bbcode") {
    const size = level === 1 ? 155 : level === 2 ? 135 : 120;
    return `[size=${size}][b]${text}[/b][/size]`;
  }
  if (level === 1) {
    return `${text.toUpperCase()}\n${"=".repeat(Math.min(text.length, 60))}`;
  }
  if (level === 2) {
    return `${text}\n${"-".repeat(Math.min(text.length, 60))}`;
  }
  return text;
}

function renderList(format: ExportFormat, items: string[]): string {
  if (!items.length) {
    return "";
  }
  if (format === "markdown") {
    return items.map((item) => `- ${item}`).join("\n");
  }
  if (format === "bbcode") {
    const rows = items.map((item) => `[*]${item}`).join("\n");
    return `[list]\n${rows}\n[/list]`;
  }
  return items.map((item) => `• ${item}`).join("\n");
}

function renderKeyValues(
  format: ExportFormat,
  entries: Array<{ key: string; value: string }>
): string {
  if (!entries.length) {
    return "";
  }
  if (format === "markdown") {
    return entries.map((entry) => `- **${entry.key}:** ${entry.value}`).join("\n");
  }
  if (format === "bbcode") {
    const rows = entries.map((entry) => `[*][b]${entry.key}:[/b] ${entry.value}`).join("\n");
    return `[list]\n${rows}\n[/list]`;
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

function renderTotals(format: ExportFormat, jumps: JumpRecord[]): string {
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
  format: ExportFormat,
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
  format: ExportFormat,
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
  format: ExportFormat,
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
  format: ExportFormat,
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
  format: ExportFormat,
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

function generateDocument(snapshot: ExportSnapshot, options: ExportPresetOptions): string {
  const { assetsByJump, notesByJump, recapsByJump } = indexSnapshot(snapshot);
  const format = options.format;
  const jumpMap = new Map(snapshot.jumps.map((jump) => [jump.id, jump] as const));
  const sections: string[] = [formatHeading(format, 1, "Jumpchain Export")];

  if (options.includeTotals) {
    sections.push(renderTotals(format, snapshot.jumps));
  }

  snapshot.jumps
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .forEach((jump) => {
      const assets = assetsByJump.get(jump.id) ?? [];
      sections.push(renderJumpSection(format, jump, assets, options));
    });

  if (options.includeInventory) {
    sections.push(renderInventorySection(format, snapshot.inventory));
  }

  if (options.includeProfiles) {
    sections.push(renderProfilesSection(format, snapshot.profiles));
  }

  if (options.includeNotes) {
    sections.push(renderNotesSection(format, notesByJump, jumpMap));
  }

  if (options.includeRecaps) {
    sections.push(renderRecapsSection(format, recapsByJump, jumpMap));
  }

  return sections.filter(Boolean).join("\n\n");
}

const ExportCenter: React.FC = () => {
  const queryClient = useQueryClient();
  const presetsQuery = useQuery({ queryKey: ["export-presets"], queryFn: listExportPresets });
  const snapshotQuery = useQuery({ queryKey: ["export-snapshot"], queryFn: loadExportSnapshot });

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [formState, setFormState] = useState<PresetFormState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedPreset = useMemo(() => {
    if (!presetsQuery.data) {
      return null;
    }
    return presetsQuery.data.find((preset) => preset.id === selectedPresetId) ?? null;
  }, [presetsQuery.data, selectedPresetId]);

  useEffect(() => {
    if (presetsQuery.data?.length && !selectedPresetId) {
      setSelectedPresetId(presetsQuery.data[0].id);
    }
  }, [presetsQuery.data, selectedPresetId]);

  useEffect(() => {
    if (!selectedPreset) {
      setFormState(null);
      return;
    }
    setFormState({
      id: selectedPreset.id,
      name: selectedPreset.name,
      description: selectedPreset.description ?? "",
      options: parsePresetOptions(selectedPreset),
    });
  }, [selectedPreset]);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }
    const timer = window.setTimeout(() => setStatusMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

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
      setSelectedPresetId((current) => (current === deletedId ? null : current));
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
    if (!window.confirm(`Delete preset "${selectedPreset.name}"?`)) {
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
    setFormState((prev) => (prev ? { ...prev, options: { ...prev.options, [key]: value } } : prev));
  };

  const handleAssetToggle = (type: JumpAssetType, checked: boolean) => {
    setFormState((prev) =>
      prev
        ? {
            ...prev,
            options: {
              ...prev.options,
              includeAssets: {
                ...prev.options.includeAssets,
                [type]: checked,
              },
            },
          }
        : prev,
    );
  };

  const previewContent = useMemo(() => {
    if (!formState || !snapshotQuery.data) {
      return "";
    }
    return generateDocument(snapshotQuery.data, formState.options);
  }, [formState?.options, snapshotQuery.data]);

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
                    <label>
                      <input
                        type="checkbox"
                        checked={formState.options.includeTotals}
                        onChange={(event) => handleOptionChange("includeTotals", event.target.checked)}
                      />
                      Chain totals
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={formState.options.includeJumpMetadata}
                        onChange={(event) =>
                          handleOptionChange("includeJumpMetadata", event.target.checked)
                        }
                      />
                      Jump metadata
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={formState.options.includeInventory}
                        onChange={(event) => handleOptionChange("includeInventory", event.target.checked)}
                      />
                      Inventory snapshot
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={formState.options.includeProfiles}
                        onChange={(event) => handleOptionChange("includeProfiles", event.target.checked)}
                      />
                      Character profiles
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={formState.options.includeNotes}
                        onChange={(event) => handleOptionChange("includeNotes", event.target.checked)}
                      />
                      Notes overview
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={formState.options.includeRecaps}
                        onChange={(event) => handleOptionChange("includeRecaps", event.target.checked)}
                      />
                      Recap summaries
                    </label>
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
                          : "Live preview reflects unsaved changes."}
                    </p>
                  </div>
                  <div className="exports__preview-actions">
                    <button type="button" onClick={handleCopyPreview} disabled={!previewContent}>
                      Copy
                    </button>
                    <button type="button" onClick={handleDownloadPreview} disabled={!previewContent}>
                      Download
                    </button>
                  </div>
                </header>
                <pre className="exports__preview-content">{previewContent || ""}</pre>
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default ExportCenter;
