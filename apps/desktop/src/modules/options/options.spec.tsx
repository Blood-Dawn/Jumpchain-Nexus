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
import {
  DEFAULT_SUPPLEMENT_SETTINGS,
  DEFAULT_WAREHOUSE_MODE,
  loadSupplementSettings,
  loadWarehouseModeSetting,
  listExportPresets,
  setAppSetting,
  SUPPLEMENT_SETTING_KEY,
  EXPORT_PREFERENCES_SETTING_KEY,
  WAREHOUSE_MODE_SETTING_KEY,
} from "../../db/dao";
import type {
  AppSettingRecord,
  EssentialBodyModEssenceRecord,
  UpsertEssentialBodyModEssenceInput,
} from "../../db/dao";

vi.mock("../../db/dao", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../db/dao")>();

  const memory = new Map<string, AppSettingRecord>();
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
  };

  reset();
  (globalThis as unknown as { __resetAppSettings?: () => void }).__resetAppSettings = reset;

  return {
    ...actual,
    listAppSettings: vi.fn(async () => Array.from(memory.values()).sort((a, b) => a.key.localeCompare(b.key))),
    getAppSetting: vi.fn(async (key: string) => memory.get(key) ?? null),
    setAppSetting: vi.fn(async (key: string, value: unknown) => setRecord(key, value)),
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
    const exportPresetsMock = vi.mocked(listExportPresets);
    exportPresetsMock.mockReset();
    exportPresetsMock.mockResolvedValue([]);
  });

  it("@smoke highlights the planned configuration surface", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["app-settings"], []);
    queryClient.setQueryData(["export-presets"], []);
    queryClient.setQueryData(["app-settings", "formatter"], {
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

    const secondClient = createTestQueryClient();
    const second = render(
      <QueryClientProvider client={secondClient}>
        <JumpchainOptions />
      </QueryClientProvider>
    );

    expect(await screen.findByLabelText(/personal reality focus/i)).toBeChecked();
    second.unmount();
  });

  it("shows the export preset summary and updates when the selection changes", async () => {
    const queryClient = createTestQueryClient();
    const user = userEvent.setup();

    const now = new Date().toISOString();
    const presets = [
      {
        id: "alpha",
        name: "Alpha Layout",
        description: null,
        options_json: JSON.stringify({
          format: "markdown",
          sectionPreferences: {
            header: { format: "markdown", spoiler: false },
            totals: { format: "markdown", spoiler: false },
            jumps: { format: "markdown", spoiler: true },
            inventory: { format: "bbcode", spoiler: false },
            profiles: { format: "bbcode", spoiler: true },
            notes: { format: "markdown", spoiler: false },
            recaps: { format: "markdown", spoiler: false },
          },
        }),
        created_at: now,
        updated_at: now,
      },
      {
        id: "beta",
        name: "Beta Layout",
        description: null,
        options_json: JSON.stringify({
          format: "bbcode",
          sectionPreferences: {
            header: { format: "bbcode", spoiler: false },
            totals: { format: "bbcode", spoiler: false },
            jumps: { format: "bbcode", spoiler: false },
            inventory: { format: "markdown", spoiler: false },
            profiles: { format: "markdown", spoiler: false },
            notes: { format: "markdown", spoiler: true },
            recaps: { format: "markdown", spoiler: false },
          },
        }),
        created_at: now,
        updated_at: now,
      },
    ];

    vi.mocked(listExportPresets).mockResolvedValue(presets);
    queryClient.setQueryData(["export-presets"], presets);
    queryClient.setQueryData(["app-settings", "formatter"], {
      removeAllLineBreaks: false,
      leaveDoubleLineBreaks: false,
      thousandsSeparator: "none",
      spellcheckEnabled: true,
    });

    await setAppSetting(EXPORT_PREFERENCES_SETTING_KEY, { defaultPresetId: "alpha" });

    render(
      <QueryClientProvider client={queryClient}>
        <JumpchainOptions />
      </QueryClientProvider>
    );

    const summary = await screen.findByTestId("preset-summary");
    expect(within(summary).getByTestId("preset-summary-format-value")).toHaveTextContent("Markdown");

    const jumpsSection = within(summary).getByTestId("preset-summary-section-jumps");
    expect(within(jumpsSection).getByText("Jump Breakdown")).toBeInTheDocument();
    expect(within(jumpsSection).getByText("Markdown · Spoiler")).toBeInTheDocument();

    const inventorySection = within(summary).getByTestId("preset-summary-section-inventory");
    expect(within(inventorySection).getByText("Inventory Snapshot")).toBeInTheDocument();
    expect(within(inventorySection).getByText("BBCode · Visible")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Default preset/i), "beta");

    await waitFor(() => {
      expect(screen.getByTestId("preset-summary-format-value")).toHaveTextContent("BBCode");
    });

    const updatedSummary = await screen.findByTestId("preset-summary");
    const updatedJumps = within(updatedSummary).getByTestId("preset-summary-section-jumps");
    expect(within(updatedJumps).getByText("BBCode · Visible")).toBeInTheDocument();

    const updatedNotes = within(updatedSummary).getByTestId("preset-summary-section-notes");
    expect(within(updatedNotes).getByText("Markdown · Spoiler")).toBeInTheDocument();
  });
});
