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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CATEGORY_PRESETS_SETTING_KEY,
  DEFAULT_CATEGORY_PRESETS,
  DEFAULT_EXPORT_PREFERENCES,
  DEFAULT_JUMP_DEFAULTS,
  DEFAULT_SUPPLEMENT_SETTINGS,
  DEFAULT_WAREHOUSE_MODE,
  EXPORT_PREFERENCES_SETTING_KEY,
  JUMP_DEFAULTS_SETTING_KEY,
  SUPPLEMENT_SETTING_KEY,
  WAREHOUSE_MODE_SETTING_KEY,
  listAppSettings,
  listExportPresets,
  getAppSetting,
  setAppSetting,
  parseCategoryPresets,
  parseExportPreferences,
  parseJumpDefaults,
  parseSupplementSettings,
  parseWarehouseMode,
  type AppSettingRecord,
  type CategoryPresetSettings,
  type ExportPreferenceSettings,
  type JumpDefaultsSettings,
  type SupplementToggleSettings,
  type WarehouseModeOption,
} from "../../db/dao";

interface SettingPayload {
  key: string;
  value: unknown;
  section: SectionKey;
  successMessage: string;
}

type SectionKey =
  | "jump-defaults"
  | "supplements"
  | "warehouse-mode"
  | "export-preferences"
  | "category-presets";

type JumpDefaultField = keyof JumpDefaultsSettings;

type SectionStatusMap = Partial<Record<SectionKey, string | null>>;

const sectionLabels: Record<SectionKey, string> = {
  "jump-defaults": "Jump defaults saved.",
  supplements: "Supplement toggles updated.",
  "warehouse-mode": "Warehouse mode updated.",
  "export-preferences": "Export defaults saved.",
  "category-presets": "Categories updated.",
};

const JumpchainOptions: React.FC = () => {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["app-settings"], queryFn: listAppSettings });
  const exportPresetsQuery = useQuery({ queryKey: ["export-presets"], queryFn: listExportPresets });

  const [jumpDefaults, setJumpDefaults] = useState<JumpDefaultsSettings>(DEFAULT_JUMP_DEFAULTS);
  const [jumpDefaultInputs, setJumpDefaultInputs] = useState<Record<JumpDefaultField, string>>({
    standardBudget: String(DEFAULT_JUMP_DEFAULTS.standardBudget),
    gauntletBudget: String(DEFAULT_JUMP_DEFAULTS.gauntletBudget),
    companionStipend: String(DEFAULT_JUMP_DEFAULTS.companionStipend),
  });
  const [jumpDefaultErrors, setJumpDefaultErrors] = useState<Partial<Record<JumpDefaultField, string | null>>>({});

  const [supplements, setSupplements] = useState<SupplementToggleSettings>(DEFAULT_SUPPLEMENT_SETTINGS);
  const [warehouseMode, setWarehouseMode] = useState<WarehouseModeOption>(DEFAULT_WAREHOUSE_MODE.mode);
  const [categoryPresets, setCategoryPresets] = useState<CategoryPresetSettings>(DEFAULT_CATEGORY_PRESETS);
  const [categoryErrors, setCategoryErrors] = useState<{ perk: string | null; item: string | null }>({
    perk: null,
    item: null,
  });
  const [perkInput, setPerkInput] = useState("");
  const [itemInput, setItemInput] = useState("");
  const [defaultPresetId, setDefaultPresetId] = useState<string | null>(DEFAULT_EXPORT_PREFERENCES.defaultPresetId);
  const [sectionStatus, setSectionStatus] = useState<SectionStatusMap>({});

  const statusTimers = useRef<Record<SectionKey, number>>({});

  const settingsMap = useMemo(() => {
    if (!settingsQuery.data) {
      return new Map<string, AppSettingRecord>();
    }
    return new Map(settingsQuery.data.map((record) => [record.key, record]));
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }
    const defaults = parseJumpDefaults(settingsMap.get(JUMP_DEFAULTS_SETTING_KEY) ?? null);
    setJumpDefaults(defaults);
    setJumpDefaultInputs({
      standardBudget: String(defaults.standardBudget),
      gauntletBudget: String(defaults.gauntletBudget),
      companionStipend: String(defaults.companionStipend),
    });
    setJumpDefaultErrors({});

    const supplementSettings = parseSupplementSettings(settingsMap.get(SUPPLEMENT_SETTING_KEY) ?? null);
    setSupplements(supplementSettings);

    const warehouseSettings = parseWarehouseMode(settingsMap.get(WAREHOUSE_MODE_SETTING_KEY) ?? null);
    setWarehouseMode(warehouseSettings.mode);

    const categories = parseCategoryPresets(settingsMap.get(CATEGORY_PRESETS_SETTING_KEY) ?? null);
    setCategoryPresets(categories);

    const exportPreferences = parseExportPreferences(settingsMap.get(EXPORT_PREFERENCES_SETTING_KEY) ?? null);
    setDefaultPresetId(exportPreferences.defaultPresetId);
    setCategoryErrors({ perk: null, item: null });
    setPerkInput("");
    setItemInput("");
  }, [settingsMap, settingsQuery.data]);

  useEffect(() => {
    return () => {
      Object.values(statusTimers.current).forEach((timerId) => window.clearTimeout(timerId));
      statusTimers.current = {};
    };
  }, []);

  const showStatus = (section: SectionKey, message: string) => {
    setSectionStatus((prev) => ({ ...prev, [section]: message }));
    if (statusTimers.current[section]) {
      window.clearTimeout(statusTimers.current[section]);
    }
    statusTimers.current[section] = window.setTimeout(() => {
      setSectionStatus((prev) => ({ ...prev, [section]: null }));
      delete statusTimers.current[section];
    }, 2600);
  };

  const updateSettingMutation = useMutation({
    mutationFn: (payload: SettingPayload) => setAppSetting(payload.key, payload.value),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["app-settings"] });
      const previous = queryClient.getQueryData<AppSettingRecord[]>(["app-settings"]);
      const serialized =
        payload.value === null || payload.value === undefined
          ? null
          : typeof payload.value === "string"
            ? payload.value
            : JSON.stringify(payload.value);
      queryClient.setQueryData<AppSettingRecord[]>(["app-settings"], (current = []) => {
        const nextRecord: AppSettingRecord = {
          key: payload.key,
          value: serialized,
          updated_at: new Date().toISOString(),
        };
        const filtered = current.filter((record) => record.key !== payload.key);
        filtered.push(nextRecord);
        return filtered.sort((a, b) => a.key.localeCompare(b.key));
      });
      return { previous };
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["app-settings"], context.previous);
      }
      showStatus(variables.section, "Failed to save setting.");
    },
    onSuccess: async (_result, variables) => {
      const fresh = await getAppSetting(variables.key);
      queryClient.setQueryData<AppSettingRecord[]>(["app-settings"], (current = []) => {
        if (!fresh) {
          return current.filter((record) => record.key !== variables.key);
        }
        const next = current.filter((record) => record.key !== variables.key);
        next.push(fresh);
        return next.sort((a, b) => a.key.localeCompare(b.key));
      });

      switch (variables.key) {
        case JUMP_DEFAULTS_SETTING_KEY: {
          await queryClient.invalidateQueries({ queryKey: ["jump-defaults"] }).catch(() => undefined);
          break;
        }
        case SUPPLEMENT_SETTING_KEY: {
          await queryClient.invalidateQueries({ queryKey: ["supplement-settings"] }).catch(() => undefined);
          break;
        }
        case WAREHOUSE_MODE_SETTING_KEY: {
          await queryClient.invalidateQueries({ queryKey: ["warehouse-mode"] }).catch(() => undefined);
          break;
        }
        case CATEGORY_PRESETS_SETTING_KEY: {
          await queryClient.invalidateQueries({ queryKey: ["category-presets"] }).catch(() => undefined);
          break;
        }
        case EXPORT_PREFERENCES_SETTING_KEY: {
          await queryClient.invalidateQueries({ queryKey: ["export-preferences"] }).catch(() => undefined);
          break;
        }
        default:
          break;
      }

      showStatus(variables.section, variables.successMessage || sectionLabels[variables.section]);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] }).catch(() => undefined);
    },
  });

  const persistSetting = (payload: SettingPayload) => {
    updateSettingMutation.mutate(payload);
  };

  const handleJumpDefaultChange = (field: JumpDefaultField, raw: string) => {
    setJumpDefaultInputs((prev) => ({ ...prev, [field]: raw }));
    if (!raw.trim()) {
      setJumpDefaultErrors((prev) => ({ ...prev, [field]: "Enter a value." }));
      return;
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric < 0) {
      setJumpDefaultErrors((prev) => ({ ...prev, [field]: "Must be zero or greater." }));
      return;
    }

    const rounded = Math.round(numeric);
    const next = { ...jumpDefaults, [field]: rounded } as JumpDefaultsSettings;
    setJumpDefaults(next);
    setJumpDefaultErrors((prev) => ({ ...prev, [field]: null }));

    persistSetting({
      key: JUMP_DEFAULTS_SETTING_KEY,
      value: next,
      section: "jump-defaults",
      successMessage: sectionLabels["jump-defaults"],
    });
  };

  const handleSupplementToggle = (field: keyof SupplementToggleSettings, enabled: boolean) => {
    const next = { ...supplements, [field]: enabled };
    setSupplements(next);
    persistSetting({
      key: SUPPLEMENT_SETTING_KEY,
      value: next,
      section: "supplements",
      successMessage: sectionLabels.supplements,
    });
  };

  const handleWarehouseModeChange = (mode: WarehouseModeOption) => {
    setWarehouseMode(mode);
    persistSetting({
      key: WAREHOUSE_MODE_SETTING_KEY,
      value: { mode },
      section: "warehouse-mode",
      successMessage: sectionLabels["warehouse-mode"],
    });
  };

  const handleDefaultPresetChange = (value: string) => {
    const nextId = value.trim() ? value : null;
    setDefaultPresetId(nextId);
    const payload: ExportPreferenceSettings = { defaultPresetId: nextId };
    persistSetting({
      key: EXPORT_PREFERENCES_SETTING_KEY,
      value: payload,
      section: "export-preferences",
      successMessage: sectionLabels["export-preferences"],
    });
  };

  const updateCategoryPresets = (next: CategoryPresetSettings) => {
    setCategoryPresets(next);
    persistSetting({
      key: CATEGORY_PRESETS_SETTING_KEY,
      value: next,
      section: "category-presets",
      successMessage: sectionLabels["category-presets"],
    });
  };

  const handleAddCategory = (kind: "perk" | "item") => {
    const raw = (kind === "perk" ? perkInput : itemInput).trim();
    if (!raw) {
      setCategoryErrors((prev) => ({ ...prev, [kind]: "Enter a category name." }));
      return;
    }

    const existing = kind === "perk" ? categoryPresets.perkCategories : categoryPresets.itemCategories;
    const normalized = raw.replace(/\s+/g, " ");
    const alreadyExists = existing.some((entry) => entry.toLowerCase() === normalized.toLowerCase());
    if (alreadyExists) {
      setCategoryErrors((prev) => ({ ...prev, [kind]: "Category already exists." }));
      return;
    }

    const nextList = [...existing, normalized].sort((a, b) => a.localeCompare(b));
    const nextPresets: CategoryPresetSettings =
      kind === "perk"
        ? { ...categoryPresets, perkCategories: nextList }
        : { ...categoryPresets, itemCategories: nextList };

    setCategoryErrors((prev) => ({ ...prev, [kind]: null }));
    if (kind === "perk") {
      setPerkInput("");
    } else {
      setItemInput("");
    }

    updateCategoryPresets(nextPresets);
  };

  const handleRemoveCategory = (kind: "perk" | "item", value: string) => {
    const target = kind === "perk" ? categoryPresets.perkCategories : categoryPresets.itemCategories;
    const nextList = target.filter((entry) => entry !== value);
    const nextPresets: CategoryPresetSettings =
      kind === "perk"
        ? { ...categoryPresets, perkCategories: nextList }
        : { ...categoryPresets, itemCategories: nextList };
    updateCategoryPresets(nextPresets);
  };

  if (settingsQuery.isLoading) {
    return (
      <section className="options">
        <header className="options__header">
          <h1>Jumpchain Options</h1>
          <p>Set defaults, supplements, and custom categories.</p>
        </header>
        <p className="options__summary">Loading settings…</p>
      </section>
    );
  }

  if (settingsQuery.isError) {
    return (
      <section className="options">
        <header className="options__header">
          <h1>Jumpchain Options</h1>
          <p>Set defaults, supplements, and custom categories.</p>
        </header>
        <p className="options__summary options__summary--error">Failed to load settings.</p>
      </section>
    );
  }

  const sectionMessage = (section: SectionKey) =>
    sectionStatus[section] ? <p className="options__status">{sectionStatus[section]}</p> : null;

  return (
    <section className="options">
      <header className="options__header">
        <h1>Jumpchain Options</h1>
        <p>Set defaults, supplements, and custom categories.</p>
      </header>

      <div className="options__grid">
        <section className="options__card">
          <header className="options__card-header">
            <h2>Default Jump Budgets</h2>
            <p>Control the CP pools applied when creating new jumps.</p>
          </header>
          <div className="options__fields">
            <label className="options__field">
              <span>Standard Jump (CP)</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={jumpDefaultInputs.standardBudget}
                onChange={(event) => handleJumpDefaultChange("standardBudget", event.target.value)}
              />
            </label>
            {jumpDefaultErrors.standardBudget && (
              <p className="options__error">{jumpDefaultErrors.standardBudget}</p>
            )}
            <label className="options__field">
              <span>Gauntlet Jump (CP)</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={jumpDefaultInputs.gauntletBudget}
                onChange={(event) => handleJumpDefaultChange("gauntletBudget", event.target.value)}
              />
            </label>
            {jumpDefaultErrors.gauntletBudget && (
              <p className="options__error">{jumpDefaultErrors.gauntletBudget}</p>
            )}
            <label className="options__field">
              <span>Companion Stipend (CP)</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={jumpDefaultInputs.companionStipend}
                onChange={(event) => handleJumpDefaultChange("companionStipend", event.target.value)}
              />
            </label>
            {jumpDefaultErrors.companionStipend && (
              <p className="options__error">{jumpDefaultErrors.companionStipend}</p>
            )}
          </div>
          {sectionMessage("jump-defaults")}
        </section>

        <section className="options__card">
          <header className="options__card-header">
            <h2>Supplements & Body Mods</h2>
            <p>Toggle supplement layers used across Warehouse, Locker, and Drawback tools.</p>
          </header>
          <div className="options__list">
            <label>
              <input
                type="checkbox"
                checked={supplements.enableDrawbackSupplement}
                onChange={(event) => handleSupplementToggle("enableDrawbackSupplement", event.target.checked)}
              />
              Enable Drawback Supplement
            </label>
            <label>
              <input
                type="checkbox"
                checked={supplements.enableUniversalDrawbacks}
                onChange={(event) => handleSupplementToggle("enableUniversalDrawbacks", event.target.checked)}
              />
              Unlock Universal Drawback options
            </label>
            <label>
              <input
                type="checkbox"
                checked={supplements.enableEssentialBodyMod}
                onChange={(event) => handleSupplementToggle("enableEssentialBodyMod", event.target.checked)}
              />
              Include Essential Body Mod upgrades
            </label>
            <label>
              <input
                type="checkbox"
                checked={supplements.allowCompanionBodyMod}
                onChange={(event) => handleSupplementToggle("allowCompanionBodyMod", event.target.checked)}
              />
              Allow companions to share body-mod perks
            </label>
          </div>
          {sectionMessage("supplements")}
        </section>

        <section className="options__card">
          <header className="options__card-header">
            <h2>Warehouse Mode</h2>
            <p>Adjust the analytics profile used in Cosmic Warehouse.</p>
          </header>
          <div className="options__list options__list--radio">
            <label>
              <input
                type="radio"
                name="warehouse-mode"
                value="generic"
                checked={warehouseMode === "generic"}
                onChange={() => handleWarehouseModeChange("generic")}
              />
              Generic Storage
            </label>
            <label>
              <input
                type="radio"
                name="warehouse-mode"
                value="personal-reality"
                checked={warehouseMode === "personal-reality"}
                onChange={() => handleWarehouseModeChange("personal-reality")}
              />
              Personal Reality Focus
            </label>
          </div>
          {sectionMessage("warehouse-mode")}
        </section>

        <section className="options__card">
          <header className="options__card-header">
            <h2>Export Presets</h2>
            <p>Select the preset that should load by default in the Export Center.</p>
          </header>
          <div className="options__fields">
            <label className="options__field">
              <span>Default preset</span>
              <select
                value={defaultPresetId ?? ""}
                onChange={(event) => handleDefaultPresetChange(event.target.value)}
              >
                <option value="">None — start from last session</option>
                {exportPresetsQuery.data?.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            {exportPresetsQuery.isLoading && <p className="options__hint">Loading presets…</p>}
            {exportPresetsQuery.isError && (
              <p className="options__error">Failed to load export presets.</p>
            )}
            {!exportPresetsQuery.isLoading && !exportPresetsQuery.isError && !exportPresetsQuery.data?.length && (
              <p className="options__hint">Create presets in the Export module to enable quick switching.</p>
            )}
          </div>
          {sectionMessage("export-preferences")}
        </section>

        <section className="options__card options__card--wide">
          <header className="options__card-header">
            <h2>Custom Categories</h2>
            <p>Maintain reusable perk and item categories for jump builds and warehouse stock.</p>
          </header>
          <div className="options__categories">
            <div className="options__category-column">
              <h3>Perk Categories</h3>
              <div className="options__chips">
                {categoryPresets.perkCategories.length === 0 && (
                  <span className="options__chip options__chip--empty">No perk categories yet.</span>
                )}
                {categoryPresets.perkCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className="options__chip"
                    onClick={() => handleRemoveCategory("perk", category)}
                    title="Remove category"
                  >
                    {category}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
              <div className="options__add-row">
                <input
                  type="text"
                  placeholder="Add perk category"
                  value={perkInput}
                  onChange={(event) => setPerkInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddCategory("perk");
                    }
                  }}
                />
                <button type="button" onClick={() => handleAddCategory("perk")}>Add</button>
              </div>
              {categoryErrors.perk && <p className="options__error">{categoryErrors.perk}</p>}
            </div>

            <div className="options__category-column">
              <h3>Item Categories</h3>
              <div className="options__chips">
                {categoryPresets.itemCategories.length === 0 && (
                  <span className="options__chip options__chip--empty">No item categories yet.</span>
                )}
                {categoryPresets.itemCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className="options__chip"
                    onClick={() => handleRemoveCategory("item", category)}
                    title="Remove category"
                  >
                    {category}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
              <div className="options__add-row">
                <input
                  type="text"
                  placeholder="Add item category"
                  value={itemInput}
                  onChange={(event) => setItemInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddCategory("item");
                    }
                  }}
                />
                <button type="button" onClick={() => handleAddCategory("item")}>Add</button>
              </div>
              {categoryErrors.item && <p className="options__error">{categoryErrors.item}</p>}
            </div>
          </div>
          {sectionMessage("category-presets")}
          <p className="options__hint">Saved categories appear in Warehouse filters and future perk editors.</p>
        </section>
      </div>
    </section>
  );
};

export default JumpchainOptions;
