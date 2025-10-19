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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import JumpchainOptions from "./index";
import InputFormatter from "../formatter";
import {
  CATEGORY_PRESETS_SETTING_KEY,
  DEFAULT_SUPPLEMENT_SETTINGS,
  DEFAULT_WAREHOUSE_MODE,
  getAppSetting,
  loadSupplementSettings,
  loadWarehouseModeSetting,
  loadFormatterSettings,
  setAppSetting,
  SUPPLEMENT_SETTING_KEY,
  WAREHOUSE_MODE_SETTING_KEY,
} from "../../db/dao";
import { FORMATTER_PREFERENCES_QUERY_KEY } from "../../hooks/useFormatterPreferences";
import type {
  AppSettingRecord,
  EssentialBodyModEssenceRecord,
  UpsertEssentialBodyModEssenceInput,
} from "../../db/dao";

vi.mock("../../db/dao", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../db/dao")>();

  const memory = new Map<string, AppSettingRecord>();
  const defaultFormatterSettings: actual.FormatterSettings = {
    removeAllLineBreaks: false,
    leaveDoubleLineBreaks: false,
    thousandsSeparator: "none",
    spellcheckEnabled: true,
  };
  let formatterSettings: actual.FormatterSettings = { ...defaultFormatterSettings };
  const toSerialized = (value: unknown) =>
    value === null || value === undefined
      ? null
      : typeof value === "string"
        ? value
        : JSON.stringify(value);

  const setRecord = (key: string, value: unknown): AppSettingRecord => {
    const record: AppSettingRecord = {
      key,
      value: toSerialized(value),
      updated_at: new Date().toISOString(),
    };
    memory.set(key, record);
    return record;
  };

  const reset = () => {
    memory.clear();
    setRecord(actual.JUMP_DEFAULTS_SETTING_KEY, actual.DEFAULT_JUMP_DEFAULTS);
    setRecord(actual.SUPPLEMENT_SETTING_KEY, actual.DEFAULT_SUPPLEMENT_SETTINGS);
    setRecord(actual.WAREHOUSE_MODE_SETTING_KEY, actual.DEFAULT_WAREHOUSE_MODE);
    setRecord(actual.CATEGORY_PRESETS_SETTING_KEY, actual.DEFAULT_CATEGORY_PRESETS);
    setRecord(actual.EXPORT_PREFERENCES_SETTING_KEY, actual.DEFAULT_EXPORT_PREFERENCES);
    formatterSettings = { ...defaultFormatterSettings };
  };

  reset();
  (globalThis as unknown as { __resetAppSettings?: () => void }).__resetAppSettings = reset;

  return {
    ...actual,
    listAppSettings: vi.fn(async () => Array.from(memory.values()).sort((a, b) => a.key.localeCompare(b.key))),
    getAppSetting: vi.fn(async (key: string) => memory.get(key) ?? null),
    setAppSetting: vi.fn(async (key: string, value: unknown) => {
      if (key === "formatter.spellcheck") {
        formatterSettings = {
          ...formatterSettings,
          spellcheckEnabled: Boolean(value),
        };
      }
      return setRecord(key, value);
    }),
    listExportPresets: vi.fn(async () => []),
    listEssentialBodyModEssences: vi.fn(async () => []),
    loadEssentialBodyModSettings: vi.fn(async () => actual.DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS),
    loadUniversalDrawbackSettings: vi.fn(async () => actual.DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS),
    loadSupplementSettings: vi.fn(async () =>
      actual.parseSupplementSettings(memory.get(actual.SUPPLEMENT_SETTING_KEY) ?? null)
    ),
    loadWarehouseModeSetting: vi.fn(async () =>
      actual.parseWarehouseMode(memory.get(actual.WAREHOUSE_MODE_SETTING_KEY) ?? null)
    ),
    loadFormatterSettings: vi.fn(async () => ({ ...formatterSettings })),
    updateFormatterSettings: vi.fn(async (overrides: Partial<actual.FormatterSettings>) => {
      formatterSettings = { ...formatterSettings, ...overrides };
      return { ...formatterSettings };
    }),
    saveFormatterSpellcheck: vi.fn(async (spellcheckEnabled: boolean) => {
      formatterSettings = { ...formatterSettings, spellcheckEnabled };
      return { ...formatterSettings };
    }),
    saveEssentialBodyModSettings: vi.fn(async (overrides) => ({
      ...actual.DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS,
      ...overrides,
    })),
    saveUniversalDrawbackSettings: vi.fn(async (overrides) => ({
      ...actual.DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS,
      ...overrides,
    })),
    upsertEssentialBodyModEssence: vi.fn(async (input: UpsertEssentialBodyModEssenceInput) => ({
      id: input.id ?? `mock-essence-${Math.random().toString(36).slice(2)}`,
      setting_id: actual.ESSENTIAL_BODY_MOD_SETTING_ID,
      name: input.name,
      description: input.description ?? null,
      sort_order: input.sort_order ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } satisfies EssentialBodyModEssenceRecord)),
    deleteEssentialBodyModEssence: vi.fn(async () => undefined),
  } satisfies typeof actual;
});

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
}

describe("JumpchainOptions", () => {
  beforeEach(async () => {
    (globalThis as { __resetAppSettings?: () => void }).__resetAppSettings?.();
    await setAppSetting(SUPPLEMENT_SETTING_KEY, DEFAULT_SUPPLEMENT_SETTINGS);
    await setAppSetting(WAREHOUSE_MODE_SETTING_KEY, DEFAULT_WAREHOUSE_MODE);
  });

  it("@smoke highlights the planned configuration surface", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["app-settings"], []);
    queryClient.setQueryData(["export-presets"], []);
    queryClient.setQueryData(FORMATTER_PREFERENCES_QUERY_KEY, {
      removeAllLineBreaks: false,
      leaveDoubleLineBreaks: false,
      thousandsSeparator: "none",
      spellcheckEnabled: true,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JumpchainOptions />
      </QueryClientProvider>
    );
    expect(screen.getByRole("heading", { level: 1, name: /jumpchain options/i })).toBeInTheDocument();
    expect(screen.getByText(/set defaults, supplements, and custom categories/i)).toBeInTheDocument();
    queryClient.clear();
  });

  it("persists supplement defaults and exposes them to other modules", async () => {
    const queryClient = createTestQueryClient();
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <JumpchainOptions />
      </QueryClientProvider>
    );

    const universalToggle = await screen.findByLabelText(/unlock universal drawback options/i);
    const essentialToggle = await screen.findByLabelText(/include essential body mod upgrades/i);

    expect(universalToggle).not.toBeChecked();
    expect(essentialToggle).toBeChecked();

    await user.click(universalToggle);
    await user.click(essentialToggle);

    expect(universalToggle).toBeChecked();
    expect(essentialToggle).not.toBeChecked();

    await waitFor(async () => {
      const settings = await loadSupplementSettings();
      expect(settings).toMatchObject({
        enableUniversalDrawbacks: true,
        enableEssentialBodyMod: false,
      });
    });

    const firstRender = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <JumpchainOptions />
      </QueryClientProvider>
    );

    expect(await screen.findByLabelText(/unlock universal drawback options/i)).toBeChecked();
    expect(await screen.findByLabelText(/include essential body mod upgrades/i)).not.toBeChecked();

    firstRender.unmount();
    queryClient.clear();
  });

  it("saves the selected warehouse mode for subsequent sessions", async () => {
    const queryClient = createTestQueryClient();
    const user = userEvent.setup();

    const initial = render(
      <QueryClientProvider client={queryClient}>
        <JumpchainOptions />
      </QueryClientProvider>
    );

    const personalReality = await screen.findByLabelText(/personal reality focus/i);
    expect(personalReality).not.toBeChecked();

    await user.click(personalReality);
    expect(personalReality).toBeChecked();

    await waitFor(async () => {
      const settings = await loadWarehouseModeSetting();
      expect(settings.mode).toBe("personal-reality");
    });

    initial.unmount();
    queryClient.clear();

    const secondClient = createTestQueryClient();
    const second = render(
      <QueryClientProvider client={secondClient}>
        <JumpchainOptions />
      </QueryClientProvider>
    );

    expect(await screen.findByLabelText(/personal reality focus/i)).toBeChecked();
    second.unmount();
    secondClient.clear();
  });

  it("persists formatter spellcheck preferences for other modules", async () => {
    const queryClient = createTestQueryClient();
    const user = userEvent.setup();

    const initial = render(
      <QueryClientProvider client={queryClient}>
        <JumpchainOptions />
      </QueryClientProvider>
    );

    const spellcheckToggle = await screen.findByLabelText(/enable spellcheck in editors/i);
    expect(spellcheckToggle).toBeChecked();

    await user.click(spellcheckToggle);
    expect(spellcheckToggle).not.toBeChecked();

    await waitFor(async () => {
      const formatterSettings = await loadFormatterSettings();
      expect(formatterSettings.spellcheckEnabled).toBe(false);
    });

    initial.unmount();

    const secondClient = createTestQueryClient();
    const second = render(
      <QueryClientProvider client={secondClient}>
        <JumpchainOptions />
      </QueryClientProvider>
    );

    const persistedToggle = await screen.findByLabelText(/enable spellcheck in editors/i);
    await waitFor(() => expect(persistedToggle).not.toBeChecked());
    second.unmount();

    const formatterClient = createTestQueryClient();
    const formatterRender = render(
      <QueryClientProvider client={formatterClient}>
        <InputFormatter />
      </QueryClientProvider>
    );

    const formatterToggle = await screen.findByLabelText(/enable spellcheck in editors/i);
    await waitFor(() => expect(formatterToggle).not.toBeChecked());
    formatterRender.unmount();
    formatterClient.clear();
  });

  it("allows reordering categories and keeps the order after reload", async () => {
    const queryClient = createTestQueryClient();
    const user = userEvent.setup();

    const first = render(
      <QueryClientProvider client={queryClient}>
        <JumpchainOptions />
      </QueryClientProvider>
    );

    const perkList = await screen.findByRole("list", { name: /perk categories/i });
    const perkColumn = perkList.parentElement as HTMLElement;
    const perkInput = within(perkColumn).getByPlaceholderText("Add perk category");
    const addPerkButton = within(perkColumn).getByRole("button", { name: "Add perk category" });

    for (const category of ["Alpha", "Beta", "Gamma"]) {
      await user.type(perkInput, category);
      await user.click(addPerkButton);
    }

    const readOrder = (list: HTMLElement) =>
      within(list)
        .queryAllByRole("listitem")
        .map((item) => item.querySelector(".options__category-label")?.textContent?.trim())
        .filter((value): value is string => Boolean(value));

    await waitFor(() => {
      expect(readOrder(perkList)).toEqual(["Alpha", "Beta", "Gamma"]);
    });

    await user.click(within(perkList).getByRole("button", { name: "Move perk category Alpha down" }));
    await user.click(within(perkList).getByRole("button", { name: "Move perk category Alpha down" }));

    await waitFor(() => {
      expect(readOrder(perkList)).toEqual(["Beta", "Gamma", "Alpha"]);
    });

    await waitFor(async () => {
      const record = await getAppSetting(CATEGORY_PRESETS_SETTING_KEY);
      const parsed = parseCategoryPresets(record ?? null);
      expect(parsed.perkCategories).toEqual(["Beta", "Gamma", "Alpha"]);
    });

    first.unmount();
    queryClient.clear();

    const secondClient = createTestQueryClient();
    const second = render(
      <QueryClientProvider client={secondClient}>
        <JumpchainOptions />
      </QueryClientProvider>
    );

    const restoredList = await screen.findByRole("list", { name: /perk categories/i });
    await waitFor(() => {
      expect(readOrder(restoredList)).toEqual(["Beta", "Gamma", "Alpha"]);
    });

    second.unmount();
    secondClient.clear();
  });
});
