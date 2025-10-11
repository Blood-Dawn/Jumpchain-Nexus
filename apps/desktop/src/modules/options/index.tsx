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
  DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS,
  DEFAULT_SUPPLEMENT_SETTINGS,
  DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS,
  DEFAULT_WAREHOUSE_MODE,
  EXPORT_PREFERENCES_SETTING_KEY,
  JUMP_DEFAULTS_SETTING_KEY,
  SUPPLEMENT_SETTING_KEY,
  WAREHOUSE_MODE_SETTING_KEY,
  listAppSettings,
  listExportPresets,
  listEssentialBodyModEssences,
  getAppSetting,
  setAppSetting,
  loadEssentialBodyModSettings,
  loadUniversalDrawbackSettings,
  parseCategoryPresets,
  parseExportPreferences,
  parseJumpDefaults,
  parseSupplementSettings,
  parseWarehouseMode,
  saveEssentialBodyModSettings,
  saveUniversalDrawbackSettings,
  loadFormatterSettings,
  saveFormatterSpellcheck,
  upsertEssentialBodyModEssence,
  deleteEssentialBodyModEssence,
  type AppSettingRecord,
  type CategoryPresetSettings,
  type EssentialBodyModEssenceRecord,
  type EssentialBodyModSettings,
  type EssentialAdvancementMode,
  type EssentialEssenceMode,
  type EssentialLimiter,
  type EssentialStartingMode,
  type EssentialUnbalancedMode,
  type EssentialEpAccessMode,
  type EssentialEpAccessModifier,
  type ExportPreferenceSettings,
  type JumpDefaultsSettings,
  type SupplementToggleSettings,
  type UniversalDrawbackSettings,
  type WarehouseModeOption,
  type FormatterSettings,
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
  | "essential-body-mod"
  | "universal-drawbacks"
  | "warehouse-mode"
  | "export-preferences"
  | "category-presets"
  | "formatter";

type JumpDefaultField = keyof JumpDefaultsSettings;

type SectionStatusMap = Partial<Record<SectionKey, string | null>>;

const sectionLabels: Record<SectionKey, string> = {
  "jump-defaults": "Jump defaults saved.",
  supplements: "Supplement toggles updated.",
  "essential-body-mod": "Essential Body Mod settings saved.",
  "universal-drawbacks": "Universal Drawback defaults saved.",
  "warehouse-mode": "Warehouse mode updated.",
  "export-preferences": "Export defaults saved.",
  "category-presets": "Categories updated.",
  formatter: "Formatter preferences saved.",
};

const FALLBACK_FORMATTER_SETTINGS: FormatterSettings = {
  removeAllLineBreaks: false,
  leaveDoubleLineBreaks: false,
  thousandsSeparator: "none",
  spellcheckEnabled: true,
};

const STARTING_MODE_OPTIONS: Array<{ value: EssentialStartingMode; label: string }> = [
  { value: "hardcore", label: "Hardcore" },
  { value: "standard", label: "Standard" },
  { value: "heroic", label: "Heroic" },
];

const ESSENCE_MODE_OPTIONS: Array<{ value: EssentialEssenceMode; label: string }> = [
  { value: "none", label: "No Essence" },
  { value: "single", label: "Single Essence" },
  { value: "dual", label: "Dual Essence" },
  { value: "multi", label: "Multi Essence" },
];

const ADVANCEMENT_MODE_OPTIONS: Array<{ value: EssentialAdvancementMode; label: string }> = [
  { value: "standard", label: "Standard" },
  { value: "meteoric", label: "Meteoric" },
  { value: "heroic", label: "Heroic" },
  { value: "questing", label: "Questing" },
];

const EP_ACCESS_MODE_OPTIONS: Array<{ value: EssentialEpAccessMode; label: string }> = [
  { value: "none", label: "No Access" },
  { value: "lesser", label: "Lesser Access" },
  { value: "standard", label: "Standard Access" },
];

const EP_ACCESS_MODIFIER_OPTIONS: Array<{ value: EssentialEpAccessModifier; label: string }> = [
  { value: "none", label: "No Modifier" },
  { value: "cumulative", label: "Cumulative" },
  { value: "retro-cumulative", label: "Retro-Cumulative" },
];

const UNBALANCED_MODE_OPTIONS: Array<{ value: EssentialUnbalancedMode; label: string }> = [
  { value: "none", label: "Balanced" },
  { value: "harmonized", label: "Harmonized" },
  { value: "very-harmonized", label: "Very Harmonized" },
  { value: "perfectly-harmonized", label: "Perfectly Harmonized" },
];

const LIMITER_OPTIONS: Array<{ value: EssentialLimiter; label: string }> = [
  { value: "none", label: "No Limiter" },
  { value: "everyday-hero", label: "Everyday Hero" },
  { value: "street-level", label: "Street Level" },
  { value: "mid-level", label: "Mid Level" },
  { value: "body-mod", label: "Body Mod" },
  { value: "scaling-i", label: "Scaling I" },
  { value: "scaling-ii", label: "Scaling II" },
  { value: "vanishing", label: "Vanishing" },
];

const SUPPLEMENT_TOGGLE_FIELDS: Array<{ key: keyof SupplementToggleSettings; label: string }> = [
  { key: "enableDrawbackSupplement", label: "Enable Drawback Supplement" },
  { key: "enableUniversalDrawbacks", label: "Unlock Universal Drawback options" },
  { key: "enableEssentialBodyMod", label: "Include Essential Body Mod upgrades" },
  { key: "allowCompanionBodyMod", label: "Allow companions to share body-mod perks" },
];

const WAREHOUSE_MODE_OPTIONS: Array<{ value: WarehouseModeOption; label: string }> = [
  { value: "generic", label: "Generic Storage" },
  { value: "personal-reality", label: "Personal Reality Focus" },
];

const JumpchainOptions: React.FC = () => {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["app-settings"], queryFn: listAppSettings });
  const exportPresetsQuery = useQuery({ queryKey: ["export-presets"], queryFn: listExportPresets });
  const essentialSettingsQuery = useQuery({
    queryKey: ["essential-body-mod-settings"],
    queryFn: loadEssentialBodyModSettings,
  });
  const essencesQuery = useQuery({
    queryKey: ["essential-body-mod-essences"],
    queryFn: listEssentialBodyModEssences,
  });
  const universalSettingsQuery = useQuery({
    queryKey: ["universal-drawback-settings"],
    queryFn: loadUniversalDrawbackSettings,
  });
  const formatterSettingsQuery = useQuery({
    queryKey: ["app-settings", "formatter"],
    queryFn: loadFormatterSettings,
  });

  const [jumpDefaults, setJumpDefaults] = useState<JumpDefaultsSettings>(DEFAULT_JUMP_DEFAULTS);
  const [jumpDefaultInputs, setJumpDefaultInputs] = useState<Record<JumpDefaultField, string>>({
    standardBudget: String(DEFAULT_JUMP_DEFAULTS.standardBudget),
    gauntletBudget: String(DEFAULT_JUMP_DEFAULTS.gauntletBudget),
    companionStipend: String(DEFAULT_JUMP_DEFAULTS.companionStipend),
  });
  const [jumpDefaultErrors, setJumpDefaultErrors] = useState<Partial<Record<JumpDefaultField, string | null>>>({});

  const [supplements, setSupplements] = useState<SupplementToggleSettings>(DEFAULT_SUPPLEMENT_SETTINGS);
  type EssentialNumberField = "budget" | "investmentRatio" | "incrementalBudget" | "incrementalInterval";
  type EssentialBooleanField =
    | "unlockableEssence"
    | "limitInvestment"
    | "investmentAllowed"
    | "trainingAllowance"
    | "temperedBySuffering";
  type EssentialSelectField =
    | "startingMode"
    | "essenceMode"
    | "advancementMode"
    | "epAccessMode"
    | "epAccessModifier"
    | "unbalancedMode"
    | "limiter";
  type EssentialTextField = "unbalancedDescription" | "limiterDescription";
  const [essentialSettings, setEssentialSettings] = useState<EssentialBodyModSettings>(DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS);
  const [essentialNumbers, setEssentialNumbers] = useState<Record<EssentialNumberField, string>>({
    budget: String(DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.budget),
    investmentRatio: String(DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.investmentRatio),
    incrementalBudget: String(DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.incrementalBudget),
    incrementalInterval: String(DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.incrementalInterval),
  });
  const [essenceDrafts, setEssenceDrafts] = useState<Record<string, { name: string; description: string }>>({});
  const [newEssence, setNewEssence] = useState<{ name: string; description: string }>({ name: "", description: "" });
  const [essenceError, setEssenceError] = useState<string | null>(null);
  const [essenceList, setEssenceList] = useState<EssentialBodyModEssenceRecord[]>([]);

  type UniversalNumberField = "totalCP" | "companionCP" | "itemCP" | "warehouseWP";
  const [universalSettings, setUniversalSettings] = useState<UniversalDrawbackSettings>(
    DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS
  );
  const [universalNumbers, setUniversalNumbers] = useState<Record<UniversalNumberField, string>>({
    totalCP: String(DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS.totalCP),
    companionCP: String(DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS.companionCP),
    itemCP: String(DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS.itemCP),
    warehouseWP: String(DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS.warehouseWP),
  });
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

  const spellcheckEnabled =
    formatterSettingsQuery.data?.spellcheckEnabled ?? FALLBACK_FORMATTER_SETTINGS.spellcheckEnabled;
  const spellcheckProps = { spellCheck: spellcheckEnabled } as const;

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
    if (!essentialSettingsQuery.data) {
      return;
    }
    const data = essentialSettingsQuery.data;
    setEssentialSettings(data);
    setEssentialNumbers({
      budget: String(data.budget),
      investmentRatio: String(data.investmentRatio),
      incrementalBudget: String(data.incrementalBudget),
      incrementalInterval: String(data.incrementalInterval),
    });
  }, [essentialSettingsQuery.data]);

  useEffect(() => {
    if (!essencesQuery.data) {
      return;
    }
    setEssenceList(essencesQuery.data);
    setEssenceDrafts(
      Object.fromEntries(
        essencesQuery.data.map((essence) => [
          essence.id,
          {
            name: essence.name,
            description: essence.description ?? "",
          },
        ])
      )
    );
  }, [essencesQuery.data]);

  useEffect(() => {
    if (!universalSettingsQuery.data) {
      return;
    }
    const data = universalSettingsQuery.data;
    setUniversalSettings(data);
    setUniversalNumbers({
      totalCP: String(data.totalCP),
      companionCP: String(data.companionCP),
      itemCP: String(data.itemCP),
      warehouseWP: String(data.warehouseWP),
    });
  }, [universalSettingsQuery.data]);

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

  const saveEssentialMutation = useMutation({
    mutationFn: (overrides: Partial<EssentialBodyModSettings>) =>
      saveEssentialBodyModSettings(overrides),
    onSuccess: async (data) => {
      setEssentialSettings(data);
      setEssentialNumbers({
        budget: String(data.budget),
        investmentRatio: String(data.investmentRatio),
        incrementalBudget: String(data.incrementalBudget),
        incrementalInterval: String(data.incrementalInterval),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["essential-body-mod-settings"] }).catch(() => undefined),
        queryClient.invalidateQueries({ queryKey: ["essential-body-mod-essences"] }).catch(() => undefined),
      ]);
      showStatus("essential-body-mod", sectionLabels["essential-body-mod"]);
    },
    onError: () => {
      showStatus("essential-body-mod", "Failed to save Essential Body Mod settings.");
    },
  });

  const saveUniversalMutation = useMutation({
    mutationFn: (overrides: Partial<UniversalDrawbackSettings>) =>
      saveUniversalDrawbackSettings(overrides),
    onSuccess: async (data) => {
      setUniversalSettings(data);
      setUniversalNumbers({
        totalCP: String(data.totalCP),
        companionCP: String(data.companionCP),
        itemCP: String(data.itemCP),
        warehouseWP: String(data.warehouseWP),
      });
      await queryClient.invalidateQueries({ queryKey: ["universal-drawback-settings"] }).catch(() => undefined);
      showStatus("universal-drawbacks", sectionLabels["universal-drawbacks"]);
    },
    onError: () => {
      showStatus("universal-drawbacks", "Failed to save Universal Drawback defaults.");
    },
  });

  const saveFormatterSpellcheckMutation = useMutation<
    FormatterSettings,
    unknown,
    boolean,
    { previous?: FormatterSettings }
  >({
    mutationFn: (enabled: boolean) => saveFormatterSpellcheck(enabled),
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ["app-settings", "formatter"] });
      const previous = queryClient.getQueryData<FormatterSettings>(["app-settings", "formatter"]);
      queryClient.setQueryData<FormatterSettings>(["app-settings", "formatter"], (current) => {
        const base = current ?? formatterSettingsQuery.data ?? FALLBACK_FORMATTER_SETTINGS;
        return { ...base, spellcheckEnabled: enabled };
      });
      return { previous };
    },
    onError: (_error, _value, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["app-settings", "formatter"], context.previous);
      }
      showStatus("formatter", "Failed to save formatter preferences.");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["app-settings", "formatter"], data);
      showStatus("formatter", sectionLabels.formatter);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings", "formatter"] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["app-settings"] }).catch(() => undefined);
    },
  });

  const upsertEssenceMutation = useMutation({
    mutationFn: (payload: { id?: string; name: string; description?: string | null; sort_order?: number }) =>
      upsertEssentialBodyModEssence(payload),
    onSuccess: async () => {
      setEssenceError(null);
      await queryClient.invalidateQueries({ queryKey: ["essential-body-mod-essences"] }).catch(() => undefined);
      showStatus("essential-body-mod", "Essence saved.");
    },
    onError: () => {
      showStatus("essential-body-mod", "Failed to save Essence.");
    },
  });

  const deleteEssenceMutation = useMutation({
    mutationFn: (id: string) => deleteEssentialBodyModEssence(id),
    onSuccess: async () => {
      setEssenceError(null);
      await queryClient.invalidateQueries({ queryKey: ["essential-body-mod-essences"] }).catch(() => undefined);
      showStatus("essential-body-mod", "Essence removed.");
    },
    onError: () => {
      showStatus("essential-body-mod", "Failed to remove Essence.");
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

  const handleEssentialNumberChange = (field: EssentialNumberField, raw: string) => {
    setEssentialNumbers((prev) => ({ ...prev, [field]: raw }));
    const parsed = Number(raw);
    const min = field === "investmentRatio" || field === "incrementalInterval" ? 1 : 0;
    const sanitized =
      Number.isFinite(parsed) && raw.trim().length ? Math.max(min, Math.round(parsed)) : min;
    setEssentialSettings((prev) => ({ ...prev, [field]: sanitized } as EssentialBodyModSettings));
  };

  const handleUniversalNumberChange = (field: UniversalNumberField, raw: string) => {
    setUniversalNumbers((prev) => ({ ...prev, [field]: raw }));
    const parsed = Number(raw);
    const sanitized =
      Number.isFinite(parsed) && raw.trim().length ? Math.max(0, Math.round(parsed)) : 0;
    setUniversalSettings((prev) => ({ ...prev, [field]: sanitized } as UniversalDrawbackSettings));
  };

  const handleEssentialBooleanToggle = (field: EssentialBooleanField, value: boolean) => {
    setEssentialSettings((prev) => {
      const next: EssentialBodyModSettings = { ...prev, [field]: value };
      if (field === "investmentAllowed" && !value) {
        next.limitInvestment = false;
      }
      return next;
    });
  };

  const handleEssentialTextChange = (field: EssentialTextField, value: string) => {
    const trimmed = value.trim();
    setEssentialSettings((prev) => ({ ...prev, [field]: trimmed.length ? value : null }));
  };

  const handleEssenceDraftChange = (id: string, field: "name" | "description", value: string) => {
    setEssenceDrafts((prev) => {
      const current = prev[id] ?? { name: "", description: "" };
      return {
        ...prev,
        [id]: { ...current, [field]: value },
      };
    });
  };

  const handlePersistEssence = (essence: EssentialBodyModEssenceRecord) => {
    const draft = essenceDrafts[essence.id] ?? {
      name: essence.name,
      description: essence.description ?? "",
    };
    const trimmedName = draft.name.trim();
    if (!trimmedName.length) {
      setEssenceError("Essence name is required.");
      return;
    }
    upsertEssenceMutation.mutate({
      id: essence.id,
      name: trimmedName,
      description: draft.description.trim().length ? draft.description : null,
      sort_order: essence.sort_order,
    });
  };

  const handleRemoveEssence = (id: string) => {
    deleteEssenceMutation.mutate(id);
  };

  const handleAddEssence = () => {
    const trimmedName = newEssence.name.trim();
    if (!trimmedName.length) {
      setEssenceError("Essence name is required.");
      return;
    }
    upsertEssenceMutation.mutate(
      {
        name: trimmedName,
        description: newEssence.description.trim().length ? newEssence.description : null,
        sort_order: essenceList.length,
      },
      {
        onSuccess: () => {
          setNewEssence({ name: "", description: "" });
        },
      }
    );
  };

  const handleSaveEssential = () => {
    saveEssentialMutation.mutate(essentialSettings);
  };

  const handleSaveUniversal = () => {
    saveUniversalMutation.mutate(universalSettings);
  };

  const handleSpellcheckPreferenceToggle = (value: boolean) => {
    saveFormatterSpellcheckMutation.mutate(value);
  };

  const handleUniversalToggle = (field: "allowGauntlet" | "gauntletHalved", value: boolean) => {
    setUniversalSettings((prev) => {
      const next: UniversalDrawbackSettings = { ...prev, [field]: value };
      if (field === "allowGauntlet" && !value) {
        next.gauntletHalved = false;
      }
      return next;
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

  const essenceUnlockEnabled = essentialSettings.essenceMode !== "none";
  const investmentControlsDisabled = essentialSettings.epAccessMode === "none";
  const trainingAllowanceEnabled =
    essentialSettings.advancementMode === "standard" && essentialSettings.epAccessMode === "none";
  const temperedDisabled = essentialSettings.epAccessModifier === "retro-cumulative";

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
            {SUPPLEMENT_TOGGLE_FIELDS.map(({ key, label }) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={supplements[key]}
                  onChange={(event) => handleSupplementToggle(key, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
          {sectionMessage("supplements")}
        </section>

        <section className="options__card">
          <header className="options__card-header">
            <h2>Formatter Preferences</h2>
            <p>Choose editor defaults shared across Formatter, Options, and Warehouse tools.</p>
          </header>
          <div className="options__list">
            <label>
              <input
                type="checkbox"
                checked={spellcheckEnabled}
                onChange={(event) => handleSpellcheckPreferenceToggle(event.target.checked)}
                disabled={formatterSettingsQuery.isLoading || saveFormatterSpellcheckMutation.isPending}
              />
              Enable spellcheck in editors
            </label>
          </div>
          {formatterSettingsQuery.isError && (
            <p className="options__error">Failed to load formatter preferences.</p>
          )}
          {sectionMessage("formatter")}
        </section>

        <section className="options__card">
          <header className="options__card-header">
            <h2>Essential Body Mod Defaults</h2>
            <p>Configure the baseline rules applied when the Essential Body Mod supplement is active.</p>
          </header>
          {essentialSettingsQuery.isLoading && <p className="options__hint">Loading defaults...</p>}
          {essentialSettingsQuery.isError && (
            <p className="options__error">Failed to load Essential Body Mod settings.</p>
          )}
          <div className="options__fields">
            <label className="options__field">
              <span>Starting Budget (BP)</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={essentialNumbers.budget}
                onChange={(event) => handleEssentialNumberChange("budget", event.target.value)}
                disabled={saveEssentialMutation.isPending}
              />
            </label>
            <label className="options__field">
              <span>Starting Mode</span>
              <select
                value={essentialSettings.startingMode}
                onChange={(event) =>
                  setEssentialSettings((prev) => ({
                    ...prev,
                    startingMode: event.target.value as EssentialStartingMode,
                  }))
                }
                disabled={saveEssentialMutation.isPending}
              >
                {STARTING_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="options__field">
              <span>Essence Mode</span>
              <select
                value={essentialSettings.essenceMode}
                onChange={(event) => {
                  const value = event.target.value as EssentialEssenceMode;
                  setEssentialSettings((prev) => {
                    const next: EssentialBodyModSettings = { ...prev, essenceMode: value };
                    if (value === "none") {
                      next.unlockableEssence = false;
                    }
                    return next;
                  });
                }}
                disabled={saveEssentialMutation.isPending}
              >
                {ESSENCE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="options__fields">
            <label className="options__field">
              <span>Advancement Mode</span>
              <select
                value={essentialSettings.advancementMode}
                onChange={(event) => {
                  const value = event.target.value as EssentialAdvancementMode;
                  setEssentialSettings((prev) => {
                    const next: EssentialBodyModSettings = { ...prev, advancementMode: value };
                    if (!(value === "standard" && prev.epAccessMode === "none")) {
                      next.trainingAllowance = false;
                    }
                    return next;
                  });
                }}
                disabled={saveEssentialMutation.isPending}
              >
                {ADVANCEMENT_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="options__field">
              <span>EP Access Mode</span>
              <select
                value={essentialSettings.epAccessMode}
                onChange={(event) => {
                  const value = event.target.value as EssentialEpAccessMode;
                  setEssentialSettings((prev) => {
                    const next: EssentialBodyModSettings = { ...prev, epAccessMode: value };
                    if (value === "none") {
                      next.investmentAllowed = false;
                      next.limitInvestment = false;
                      next.epAccessModifier = "none";
                      next.temperedBySuffering = false;
                    }
                    return next;
                  });
                }}
                disabled={saveEssentialMutation.isPending}
              >
                {EP_ACCESS_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="options__field">
              <span>EP Access Modifier</span>
              <select
                value={essentialSettings.epAccessModifier}
                onChange={(event) => {
                  const value = event.target.value as EssentialEpAccessModifier;
                  setEssentialSettings((prev) => {
                    const next: EssentialBodyModSettings = { ...prev, epAccessModifier: value };
                    if (value === "retro-cumulative") {
                      next.temperedBySuffering = false;
                    }
                    return next;
                  });
                }}
                disabled={saveEssentialMutation.isPending || investmentControlsDisabled}
              >
                {EP_ACCESS_MODIFIER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="options__field">
              <span>Investment Ratio (CP : BP)</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={essentialNumbers.investmentRatio}
                onChange={(event) => handleEssentialNumberChange("investmentRatio", event.target.value)}
                disabled={saveEssentialMutation.isPending || !essentialSettings.investmentAllowed}
              />
            </label>
          </div>
          <div className="options__fields">
            <label className="options__field">
              <span>Incremental Budget (BP)</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={essentialNumbers.incrementalBudget}
                onChange={(event) => handleEssentialNumberChange("incrementalBudget", event.target.value)}
                disabled={saveEssentialMutation.isPending}
              />
            </label>
            <label className="options__field">
              <span>Increment Interval (Jumps)</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={essentialNumbers.incrementalInterval}
                onChange={(event) => handleEssentialNumberChange("incrementalInterval", event.target.value)}
                disabled={saveEssentialMutation.isPending}
              />
            </label>
            <label className="options__field">
              <span>Limiter</span>
              <select
                value={essentialSettings.limiter}
                onChange={(event) =>
                  setEssentialSettings((prev) => ({
                    ...prev,
                    limiter: event.target.value as EssentialLimiter,
                  }))
                }
                disabled={saveEssentialMutation.isPending}
              >
                {LIMITER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="options__list">
            <label>
              <input
                type="checkbox"
                checked={essentialSettings.unlockableEssence}
                onChange={(event) => handleEssentialBooleanToggle("unlockableEssence", event.target.checked)}
                disabled={saveEssentialMutation.isPending || !essenceUnlockEnabled}
              />
              Unlockable Essence modifier
            </label>
            <label>
              <input
                type="checkbox"
                checked={essentialSettings.investmentAllowed}
                onChange={(event) => handleEssentialBooleanToggle("investmentAllowed", event.target.checked)}
                disabled={saveEssentialMutation.isPending || investmentControlsDisabled}
              />
              Allow CP investment into the body mod
            </label>
            <label>
              <input
                type="checkbox"
                checked={essentialSettings.limitInvestment}
                onChange={(event) => handleEssentialBooleanToggle("limitInvestment", event.target.checked)}
                disabled={saveEssentialMutation.isPending || investmentControlsDisabled || !essentialSettings.investmentAllowed}
              />
              Respect access-mode investment limits
            </label>
            <label>
              <input
                type="checkbox"
                checked={essentialSettings.trainingAllowance}
                onChange={(event) => handleEssentialBooleanToggle("trainingAllowance", event.target.checked)}
                disabled={saveEssentialMutation.isPending || !trainingAllowanceEnabled}
              />
              Training allowance enabled
            </label>
            <label>
              <input
                type="checkbox"
                checked={essentialSettings.temperedBySuffering}
                onChange={(event) => handleEssentialBooleanToggle("temperedBySuffering", event.target.checked)}
                disabled={saveEssentialMutation.isPending || temperedDisabled}
              />
              Tempered by Suffering variant
            </label>
          </div>
          <div className="options__fields">
            <label className="options__field">
              <span>Unbalanced Mode</span>
              <select
                value={essentialSettings.unbalancedMode}
                onChange={(event) =>
                  setEssentialSettings((prev) => ({
                    ...prev,
                    unbalancedMode: event.target.value as EssentialUnbalancedMode,
                  }))
                }
                disabled={saveEssentialMutation.isPending}
              >
                {UNBALANCED_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="options__field">
              <span>Unbalanced Notes</span>
              <textarea
                rows={2}
                value={essentialSettings.unbalancedDescription ?? ""}
                onChange={(event) => handleEssentialTextChange("unbalancedDescription", event.target.value)}
                disabled={saveEssentialMutation.isPending}
                {...spellcheckProps}
              />
            </label>
            <label className="options__field">
              <span>Limiter Notes</span>
              <textarea
                rows={2}
                value={essentialSettings.limiterDescription ?? ""}
                onChange={(event) => handleEssentialTextChange("limiterDescription", event.target.value)}
                disabled={saveEssentialMutation.isPending}
                {...spellcheckProps}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleSaveEssential}
            disabled={saveEssentialMutation.isPending}
          >
            {saveEssentialMutation.isPending ? "Saving..." : "Save Essential Defaults"}
          </button>
          {sectionMessage("essential-body-mod")}

          <div className="options__card-header">
            <h3>Essence Library</h3>
            <p>Catalogue essences you plan to integrate into the build for quick export references.</p>
          </div>
          {essenceError && <p className="options__error">{essenceError}</p>}
          <div className="options__fields">
            {essenceList.length === 0 && (
              <p className="options__hint">No essences recorded yet. Add one below to get started.</p>
            )}
            {essenceList.map((essence) => {
              const draft = essenceDrafts[essence.id] ?? {
                name: essence.name,
                description: essence.description ?? "",
              };
              return (
                <div key={essence.id} className="options__field">
                  <label>
                    <span>Essence Name</span>
                    <input
                      value={draft.name}
                      onChange={(event) => handleEssenceDraftChange(essence.id, "name", event.target.value)}
                      disabled={upsertEssenceMutation.isPending}
                    />
                  </label>
                  <label>
                    <span>Description</span>
                    <textarea
                      rows={2}
                      value={draft.description}
                      onChange={(event) =>
                        handleEssenceDraftChange(essence.id, "description", event.target.value)
                      }
                      disabled={upsertEssenceMutation.isPending}
                      {...spellcheckProps}
                    />
                  </label>
                  <div>
                    <button
                      type="button"
                      onClick={() => handlePersistEssence(essence)}
                      disabled={upsertEssenceMutation.isPending}
                    >
                      {upsertEssenceMutation.isPending ? "Saving..." : "Save Essence"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveEssence(essence.id)}
                      disabled={deleteEssenceMutation.isPending}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="options__fields">
            <label className="options__field">
              <span>New Essence Name</span>
              <input
                value={newEssence.name}
                onChange={(event) => setNewEssence((prev) => ({ ...prev, name: event.target.value }))}
                disabled={upsertEssenceMutation.isPending}
              />
            </label>
            <label className="options__field">
              <span>New Essence Description</span>
              <textarea
                rows={2}
                value={newEssence.description}
                onChange={(event) =>
                  setNewEssence((prev) => ({ ...prev, description: event.target.value }))
                }
                disabled={upsertEssenceMutation.isPending}
                {...spellcheckProps}
              />
            </label>
            <div>
              <button type="button" onClick={handleAddEssence} disabled={upsertEssenceMutation.isPending}>
                {upsertEssenceMutation.isPending ? "Adding..." : "Add Essence"}
              </button>
            </div>
          </div>
        </section>

        <section className="options__card">
          <header className="options__card-header">
            <h2>Universal Drawback Stipends</h2>
            <p>Set baseline stipends granted by the Universal Drawback Supplement.</p>
          </header>
          {universalSettingsQuery.isLoading && <p className="options__hint">Loading stipend defaults...</p>}
          {universalSettingsQuery.isError && (
            <p className="options__error">Failed to load Universal Drawback settings.</p>
          )}
          <div className="options__fields">
            <label className="options__field">
              <span>Jumper Stipend (CP)</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={universalNumbers.totalCP}
                onChange={(event) => handleUniversalNumberChange("totalCP", event.target.value)}
                disabled={saveUniversalMutation.isPending}
              />
            </label>
            <label className="options__field">
              <span>Companion Stipend (CP)</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={universalNumbers.companionCP}
                onChange={(event) => handleUniversalNumberChange("companionCP", event.target.value)}
                disabled={saveUniversalMutation.isPending}
              />
            </label>
            <label className="options__field">
              <span>Item-Only Stipend (CP)</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={universalNumbers.itemCP}
                onChange={(event) => handleUniversalNumberChange("itemCP", event.target.value)}
                disabled={saveUniversalMutation.isPending}
              />
            </label>
            <label className="options__field">
              <span>Warehouse Stipend (WP)</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={universalNumbers.warehouseWP}
                onChange={(event) => handleUniversalNumberChange("warehouseWP", event.target.value)}
                disabled={saveUniversalMutation.isPending}
              />
            </label>
          </div>
          <div className="options__list">
            <label>
              <input
                type="checkbox"
                checked={universalSettings.allowGauntlet}
                onChange={(event) => handleUniversalToggle("allowGauntlet", event.target.checked)}
                disabled={saveUniversalMutation.isPending}
              />
              Allow stipends during gauntlets
            </label>
            <label>
              <input
                type="checkbox"
                checked={universalSettings.gauntletHalved}
                onChange={(event) => handleUniversalToggle("gauntletHalved", event.target.checked)}
                disabled={saveUniversalMutation.isPending || !universalSettings.allowGauntlet}
              />
              Halve stipends earned during gauntlets
            </label>
          </div>
          <button type="button" onClick={handleSaveUniversal} disabled={saveUniversalMutation.isPending}>
            {saveUniversalMutation.isPending ? "Saving..." : "Save Stipend Defaults"}
          </button>
          {sectionMessage("universal-drawbacks")}
        </section>

        <section className="options__card">
          <header className="options__card-header">
            <h2>Warehouse Mode</h2>
            <p>Adjust the analytics profile used in Cosmic Warehouse.</p>
          </header>
          <div className="options__list options__list--radio">
            {WAREHOUSE_MODE_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="warehouse-mode"
                  value={option.value}
                  checked={warehouseMode === option.value}
                  onChange={() => handleWarehouseModeChange(option.value)}
                />
                {option.label}
              </label>
            ))}
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
