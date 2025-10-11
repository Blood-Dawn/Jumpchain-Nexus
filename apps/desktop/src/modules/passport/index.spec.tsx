import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import {
  buildAttributeMatrix,
  buildEssenceSummary,
  buildSkillMatrix,
  PassportAggregations,
  type ProfileFormState,
} from "./index";
import {
  DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS,
  type EssentialBodyModEssenceRecord,
  type PassportDerivedSnapshot,
} from "../../db/dao";

const mockForm: ProfileFormState = {
  id: "profile-1",
  name: "Astra",
  alias: "",
  species: "Human",
  homeland: "Earth",
  biography: "",
  notes: "",
  attributes: [
    { id: "attr-1", key: "Strength", value: "40" },
    { id: "attr-2", key: "Resolve", value: "A" },
  ],
  traits: [
    { id: "trait-1", name: "Swordplay", description: "Master swordsman" },
  ],
  altForms: [
    { id: "alt-1", name: "Battle Mode", summary: "Combat stance" },
  ],
};

const mockDerived: PassportDerivedSnapshot = {
  perks: [
    {
      id: "perk-1",
      jumpId: "jump-1",
      jumpTitle: "Spark",
      assetType: "perk",
      name: "Colossus Might",
      category: null,
      subcategory: null,
      notes: null,
      traitTags: ["Strength"],
      attributes: [
        { key: "Strength", value: "10", numericValue: 10 },
        { key: "Resolve", value: "B", numericValue: null },
      ],
      altForms: [{ name: "Battle Mode", summary: "Combat stance" }],
      stipend: null,
    },
  ],
  companions: [
    {
      id: "companion-asset-1",
      jumpId: "jump-2",
      jumpTitle: "Trials",
      assetType: "companion",
      name: "Shield Maiden",
      category: null,
      subcategory: null,
      notes: null,
      traitTags: ["Guardian"],
      attributes: [{ key: "Strength", value: "5", numericValue: 5 }],
      altForms: [{ name: "Titan Form", summary: "Giant" }],
      stipend: null,
    },
  ],
  traits: [
    {
      name: "Strength",
      sources: [
        {
          assetId: "perk-1",
          assetName: "Colossus Might",
          assetType: "perk",
          jumpId: "jump-1",
          jumpTitle: "Spark",
        },
        {
          assetId: "companion-asset-1",
          assetName: "Shield Maiden",
          assetType: "companion",
          jumpId: "jump-2",
          jumpTitle: "Trials",
        },
      ],
    },
    {
      name: "Swordplay",
      sources: [
        {
          assetId: "perk-1",
          assetName: "Colossus Might",
          assetType: "perk",
          jumpId: "jump-1",
          jumpTitle: "Spark",
        },
        {
          assetId: "item-1",
          assetName: "Training Manual",
          assetType: "item",
          jumpId: "jump-1",
          jumpTitle: "Spark",
        },
      ],
    },
    {
      name: "Essence: Solar",
      sources: [
        {
          assetId: "perk-2",
          assetName: "Solar Core",
          assetType: "perk",
          jumpId: "jump-3",
          jumpTitle: "Radiance",
        },
      ],
    },
    {
      name: "Void Essence",
      sources: [
        {
          assetId: "item-2",
          assetName: "Void Relic",
          assetType: "item",
          jumpId: "jump-4",
          jumpTitle: "Abyss",
        },
      ],
    },
  ],
  altForms: [
    {
      name: "Battle Mode",
      summary: "Combat stance",
      sources: [
        {
          assetId: "perk-1",
          assetName: "Colossus Might",
          assetType: "perk",
          jumpId: "jump-1",
          jumpTitle: "Spark",
        },
      ],
    },
    {
      name: "Titan Form",
      summary: "Giant",
      sources: [
        {
          assetId: "companion-asset-1",
          assetName: "Shield Maiden",
          assetType: "companion",
          jumpId: "jump-2",
          jumpTitle: "Trials",
        },
      ],
    },
  ],
  attributes: [
    {
      key: "Strength",
      total: 15,
      numericCount: 2,
      entries: [
        {
          assetId: "perk-1",
          assetName: "Colossus Might",
          assetType: "perk",
          jumpId: "jump-1",
          jumpTitle: "Spark",
          value: "10",
          numericValue: 10,
        },
        {
          assetId: "companion-asset-1",
          assetName: "Shield Maiden",
          assetType: "companion",
          jumpId: "jump-2",
          jumpTitle: "Trials",
          value: "5",
          numericValue: 5,
        },
      ],
    },
    {
      key: "Resolve",
      total: 0,
      numericCount: 0,
      entries: [
        {
          assetId: "perk-1",
          assetName: "Colossus Might",
          assetType: "perk",
          jumpId: "jump-1",
          jumpTitle: "Spark",
          value: "B",
          numericValue: null,
        },
      ],
    },
  ],
  stipendTotal: 0,
  stipends: [],
};

const essenceRecords: EssentialBodyModEssenceRecord[] = [
  {
    id: "ess-1",
    setting_id: "setting-1",
    name: "Solar",
    description: null,
    sort_order: 0,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "ess-2",
    setting_id: "setting-1",
    name: "Lunar",
    description: null,
    sort_order: 1,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
];

describe("passport aggregation utilities", () => {
  it("builds attribute matrices respecting booster toggles", () => {
    const allTypes = new Set(["perk", "companion", "origin", "drawback"] as const);
    const rows = buildAttributeMatrix(mockForm, mockDerived, {
      enabledAssetTypes: allTypes,
      includeBoosterEntries: true,
    });
    const strength = rows.find((row) => row.key === "Strength");
    expect(strength?.numericTotal).toBeCloseTo(55);
    expect(strength?.derivedNumericTotal).toBeCloseTo(15);

    const perkOnly = buildAttributeMatrix(mockForm, mockDerived, {
      enabledAssetTypes: new Set(["perk", "origin", "drawback"] as const),
      includeBoosterEntries: true,
    });
    const filteredStrength = perkOnly.find((row) => row.key === "Strength");
    expect(filteredStrength?.numericTotal).toBeCloseTo(50);
    expect(filteredStrength?.derivedNumericTotal).toBeCloseTo(10);
  });

  it("builds skill matrices filtered by asset type", () => {
    const matrix = buildSkillMatrix(mockForm, mockDerived, {
      enabledAssetTypes: new Set(["perk", "origin", "drawback"] as const),
      includeBoosterEntries: true,
    });
    const swordplay = matrix.find((row) => row.name === "Swordplay");
    expect(swordplay?.derivedCount).toBe(1);
    expect(swordplay?.totalCount).toBe(2);
  });

  it("summarizes essences across derived and recorded lists", () => {
    const matrix = buildSkillMatrix(mockForm, mockDerived, {
      enabledAssetTypes: new Set(["perk", "item", "companion", "origin", "drawback"] as const),
      includeBoosterEntries: true,
    });
    const summary = buildEssenceSummary(matrix, essenceRecords, { essenceMode: "dual" });
    const solar = summary.find((entry) => entry.name === "Solar");
    expect(solar).toMatchObject({ derivedCount: 1, recorded: true, missing: false });
    const voidEssence = summary.find((entry) => entry.name.toLowerCase().includes("void"));
    expect(voidEssence).toMatchObject({ missing: true, recorded: false });
    const lunar = summary.find((entry) => entry.name === "Lunar");
    expect(lunar).toMatchObject({ derivedCount: 0, recorded: true, trackedOnly: true });
  });

  it("omits booster-derived entries when includeBoosterEntries is false", () => {
    const rows = buildAttributeMatrix(mockForm, mockDerived, {
      enabledAssetTypes: new Set(["perk", "companion", "origin", "drawback"] as const),
      includeBoosterEntries: false,
    });
    const strength = rows.find((row) => row.key === "Strength");
    expect(strength?.derivedEntries).toHaveLength(0);
    expect(strength?.numericTotal).toBeCloseTo(40);

    const matrix = buildSkillMatrix(mockForm, mockDerived, {
      enabledAssetTypes: new Set(["perk", "item", "companion", "origin", "drawback"] as const),
      includeBoosterEntries: false,
    });
    const swordplay = matrix.find((row) => row.name === "Swordplay");
    expect(swordplay?.derivedCount).toBe(0);
    expect(swordplay?.totalCount).toBe(1);
  });
});

describe("PassportAggregations", () => {
  it("updates totals when boosters are toggled", () => {
    const onSyncAltForms = vi.fn();
    const onSyncCompanions = vi.fn();
    render(
      <PassportAggregations
        form={mockForm}
        derived={mockDerived}
        derivedLoading={false}
        essenceSettings={{ ...DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS, essenceMode: "dual" }}
        essences={essenceRecords}
        companionStatuses={[
          { id: "companion-asset-1", name: "Shield Maiden", jumpTitle: "Trials", synced: false },
        ]}
        onSyncAltForms={onSyncAltForms}
        onSyncCompanions={onSyncCompanions}
      />
    );

    expect(screen.getByTestId("attribute-total-strength")).toHaveTextContent("Total: 55");
    fireEvent.click(screen.getByLabelText("Companion Boosters"));
    expect(screen.getByTestId("attribute-total-strength")).toHaveTextContent("Total: 50");
    expect(screen.getByText("Add 1 form(s)")).toBeInTheDocument();
    expect(screen.getByText("Sync 1 companion(s)")).toBeInTheDocument();
    expect(screen.getByText(/Derived: 1 · Recorded/i)).toBeInTheDocument();
  });

  it("retains manual entries when booster entries are hidden", () => {
    const onSyncAltForms = vi.fn();
    const onSyncCompanions = vi.fn();
    render(
      <PassportAggregations
        form={mockForm}
        derived={mockDerived}
        derivedLoading={false}
        essenceSettings={{ ...DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS, essenceMode: "dual" }}
        essences={essenceRecords}
        companionStatuses={[]}
        onSyncAltForms={onSyncAltForms}
        onSyncCompanions={onSyncCompanions}
      />
    );

    fireEvent.click(screen.getByTestId("toggle-include-boosters"));

    expect(screen.getByTestId("attribute-total-strength")).toHaveTextContent("Total: 40");
    const skillMatrix = screen.getByTestId("skill-matrix");
    expect(within(skillMatrix).getAllByText("Swordplay").length).toBeGreaterThan(0);
    expect(screen.getByTestId("skill-total-swordplay")).toHaveTextContent("Manual: 1");
  });
});
