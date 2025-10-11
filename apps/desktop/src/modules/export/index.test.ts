import { beforeEach, describe, expect, test } from "vitest";
import {
  composeDocument,
  createDefaultOptions,
  createDefaultSectionPreferences,
  generateSections,
  useExportConfigStore,
  type ExportSectionContent,
} from "./index";
import type { ExportSnapshot } from "../../db/dao";

const SAMPLE_SNAPSHOT: ExportSnapshot = {
  jumps: [
    {
      id: "jump-1",
      title: "Mass Effect",
      world: "Citadel Space",
      start_date: null,
      end_date: null,
      status: "completed",
      created_at: "2025-01-02T00:00:00.000Z",
      sort_order: 1,
      cp_budget: 1000,
      cp_spent: 600,
      cp_income: 200,
    },
    {
      id: "jump-2",
      title: "Star Wars",
      world: "Galaxy Far Away",
      start_date: null,
      end_date: null,
      status: "planned",
      created_at: "2026-01-02T00:00:00.000Z",
      sort_order: 2,
      cp_budget: 800,
      cp_spent: 450,
      cp_income: 150,
    },
  ],
  jumpAssets: [
    {
      id: "asset-1",
      jump_id: "jump-1",
      asset_type: "origin",
      name: "Systems Alliance",
      category: null,
      subcategory: null,
      cost: 0,
      quantity: 1,
      discounted: 0,
      freebie: 1,
      notes: null,
      metadata: null,
      sort_order: 1,
      created_at: "2025-01-02T00:00:00.000Z",
      updated_at: "2025-01-02T00:00:00.000Z",
    },
    {
      id: "asset-2",
      jump_id: "jump-1",
      asset_type: "perk",
      name: "Biotic Mastery",
      category: null,
      subcategory: null,
      cost: 200,
      quantity: 1,
      discounted: 1,
      freebie: 0,
      notes: "Focus training",
      metadata: null,
      sort_order: 2,
      created_at: "2025-01-02T00:00:00.000Z",
      updated_at: "2025-01-02T00:00:00.000Z",
    },
    {
      id: "asset-3",
      jump_id: "jump-1",
      asset_type: "item",
      name: "Omni-Tool",
      category: "Tech",
      subcategory: null,
      cost: 150,
      quantity: 2,
      discounted: 0,
      freebie: 0,
      notes: "Refillable",
      metadata: null,
      sort_order: 3,
      created_at: "2025-01-02T00:00:00.000Z",
      updated_at: "2025-01-02T00:00:00.000Z",
    },
    {
      id: "asset-4",
      jump_id: "jump-1",
      asset_type: "drawback",
      name: "Spectre Scrutiny",
      category: null,
      subcategory: null,
      cost: 100,
      quantity: 1,
      discounted: 0,
      freebie: 0,
      notes: null,
      metadata: null,
      sort_order: 4,
      created_at: "2025-01-02T00:00:00.000Z",
      updated_at: "2025-01-02T00:00:00.000Z",
    },
    {
      id: "asset-5",
      jump_id: "jump-2",
      asset_type: "companion",
      name: "Astromech Ally",
      category: null,
      subcategory: null,
      cost: 150,
      quantity: 1,
      discounted: 0,
      freebie: 0,
      notes: null,
      metadata: null,
      sort_order: 1,
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    },
    {
      id: "asset-6",
      jump_id: "jump-2",
      asset_type: "drawback",
      name: "Imperial Attention",
      category: null,
      subcategory: null,
      cost: 200,
      quantity: 1,
      discounted: 0,
      freebie: 0,
      notes: null,
      metadata: null,
      sort_order: 2,
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    },
  ],
  inventory: [
    {
      id: "inv-1",
      scope: "warehouse",
      name: "Element Zero Cache",
      category: "Resource",
      quantity: 3,
      slot: null,
      notes: "volatile",
      tags: JSON.stringify(["rare"]),
      jump_id: "jump-1",
      metadata: null,
      sort_order: 1,
      created_at: "2025-01-02T00:00:00.000Z",
      updated_at: "2025-01-02T00:00:00.000Z",
    },
    {
      id: "inv-2",
      scope: "locker",
      name: "N7 Armor",
      category: "Gear",
      quantity: 1,
      slot: null,
      notes: null,
      tags: JSON.stringify(["signature"]),
      jump_id: null,
      metadata: null,
      sort_order: 2,
      created_at: "2025-01-02T00:00:00.000Z",
      updated_at: "2025-01-02T00:00:00.000Z",
    },
  ],
  notes: [
    {
      id: "note-1",
      jump_id: "jump-1",
      md: "Remember to visit the Citadel markets.",
      created_at: "2025-01-05T00:00:00.000Z",
      updated_at: "2025-01-05T00:00:00.000Z",
    },
    {
      id: "note-2",
      jump_id: null,
      md: "Schedule training between jumps.",
      created_at: "2025-01-10T00:00:00.000Z",
      updated_at: "2025-01-10T00:00:00.000Z",
    },
  ],
  recaps: [
    {
      id: "recap-1",
      jump_id: "jump-1",
      period: "monthly",
      md: "Secured Spectre mentorship.",
      created_at: "2025-01-31T00:00:00.000Z",
    },
  ],
  profiles: [
    {
      id: "profile-1",
      name: "Jumper Prime",
      alias: "Shepard",
      species: "Human",
      homeland: "Earth",
      biography: "Veteran commander with a knack for diplomacy.",
      attributes_json: null,
      traits_json: null,
      alt_forms_json: null,
      notes: null,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    },
  ],
  settings: [],
  presets: [
    {
      id: "preset-1",
      name: "Spoiler Export",
      description: "Default with spoilers",
      options_json: JSON.stringify({
        includeNotes: true,
        sectionPreferences: {
          notes: { spoiler: true },
          jumps: { format: "bbcode" },
        },
      }),
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  useExportConfigStore.getState().reset();
});

describe("useExportConfigStore", () => {
  test("persists preset selection and section preferences", async () => {
    useExportConfigStore.getState().setSelectedPresetId("alpha");
    useExportConfigStore.getState().setFormState({
      id: "alpha",
      name: "Alpha",
      description: "",
      options: createDefaultOptions(),
    });
    useExportConfigStore.getState().setSectionSpoiler("jumps", true);
    useExportConfigStore.getState().setSectionFormat("notes", "bbcode");

    const serialized = localStorage.getItem("export-config") ?? "";

    useExportConfigStore.getState().reset();

    localStorage.setItem("export-config", serialized);
    await useExportConfigStore.persist.rehydrate();

    const after = useExportConfigStore.getState();
    expect(after.selectedPresetId).toBe("alpha");
    expect(after.sectionPreferences.jumps.spoiler).toBe(true);
    expect(after.sectionPreferences.notes.format).toBe("bbcode");
    expect(after.formState?.options.sectionPreferences.jumps.spoiler).toBe(true);
    expect(after.formState?.options.sectionPreferences.notes.format).toBe("bbcode");
    expect(after.formState?.id).toBe("alpha");
  });
});

describe("composeDocument", () => {
  const options = {
    ...createDefaultOptions(),
    includeNotes: true,
    includeRecaps: true,
  };
  const sections: ExportSectionContent[] = generateSections(SAMPLE_SNAPSHOT, options);

  test("matches legacy markdown layout", () => {
    const markdown = composeDocument(
      "markdown",
      sections,
      createDefaultSectionPreferences()
    );
    const expected = [
      "# Jumpchain Export",
      [
        "- **Total Budget:** 1800 CP",
        "- **Total Spent:** 1050 CP",
        "- **Drawback Credit:** 350 CP",
        "- **Balance:** -700 CP",
      ].join("\n"),
      [
        "## Mass Effect (Citadel Space)",
        "",
        "- **Status:** completed",
        "- **Dates:** — → —",
        "- **Budget:** 1000 CP",
        "- **Spent:** 400 CP",
        "- **Drawbacks:** 100 CP",
        "- **Balance:** -300 CP",
        "",
        "### Origins",
        "",
        "- Systems Alliance — freebie",
        "",
        "### Perks",
        "",
        "- Biotic Mastery — 200 CP • discounted ⇒ 100 CP net • Focus training",
        "",
        "### Items",
        "",
        "- Omni-Tool (Tech) — 300 CP • 2×150 • Refillable",
        "",
        "### Drawbacks",
        "",
        "- Spectre Scrutiny — credit 100 CP",
      ].join("\n"),
      [
        "## Star Wars (Galaxy Far Away)",
        "",
        "- **Status:** planned",
        "- **Dates:** — → —",
        "- **Budget:** 800 CP",
        "- **Spent:** 150 CP",
        "- **Drawbacks:** 200 CP",
        "- **Balance:** 50 CP",
        "",
        "### Companions",
        "",
        "- Astromech Ally — 150 CP",
        "",
        "### Drawbacks",
        "",
        "- Imperial Attention — credit 200 CP",
      ].join("\n"),
      [
        "## Inventory Snapshot",
        "",
        "### Warehouse",
        "",
        "- Element Zero Cache — Resource • qty 3 • tags: rare • volatile",
        "",
        "### Locker",
        "",
        "- N7 Armor — Gear • qty 1 • tags: signature",
      ].join("\n"),
      [
        "## Character Profiles",
        "",
        "### Jumper Prime",
        "",
        "- **Alias:** Shepard",
        "- **Species:** Human",
        "- **Homeland:** Earth",
        "- **Bio:** Veteran commander with a knack for diplomacy.",
      ].join("\n"),
      [
        "## Notes Overview",
        "",
        "- Mass Effect (Citadel Space) — 1 note • Remember to visit the Citadel markets.",
        "- Global — 1 note • Schedule training between jumps.",
      ].join("\n"),
      [
        "## Recap Highlights",
        "",
        "- Mass Effect (Citadel Space) — 1 recap • Secured Spectre mentorship.",
      ].join("\n"),
    ].join("\n\n");

    expect(markdown).toBe(expected);
  });

  test("matches legacy bbcode structure", () => {
    const bbcode = composeDocument(
      "bbcode",
      sections,
      createDefaultSectionPreferences()
    );
    const expected = `[size=155][b]Jumpchain Export[/b][/size]

[list]
[*][b]Total Budget:[/b] 1800 CP
[*][b]Total Spent:[/b] 1050 CP
[*][b]Drawback Credit:[/b] 350 CP
[*][b]Balance:[/b] -700 CP
[/list]

[size=135][b]Mass Effect (Citadel Space)[/b][/size]

[list]
[*][b]Status:[/b] completed
[*][b]Dates:[/b] — → —
[*][b]Budget:[/b] 1000 CP
[*][b]Spent:[/b] 400 CP
[*][b]Drawbacks:[/b] 100 CP
[*][b]Balance:[/b] -300 CP
[/list]
[size=120][b]Origins[/b][/size]

[list]
[*]Systems Alliance — freebie
[/list]
[size=120][b]Perks[/b][/size]

[list]
[*]Biotic Mastery — 200 CP • discounted ⇒ 100 CP net • Focus training
[/list]
[size=120][b]Items[/b][/size]

[list]
[*]Omni-Tool (Tech) — 300 CP • 2×150 • Refillable
[/list]
[size=120][b]Drawbacks[/b][/size]

[list]
[*]Spectre Scrutiny — credit 100 CP
[/list]
[size=135][b]Star Wars (Galaxy Far Away)[/b][/size]

[list]
[*][b]Status:[/b] planned
[*][b]Dates:[/b] — → —
[*][b]Budget:[/b] 800 CP
[*][b]Spent:[/b] 150 CP
[*][b]Drawbacks:[/b] 200 CP
[*][b]Balance:[/b] 50 CP
[/list]
[size=120][b]Companions[/b][/size]

[list]
[*]Astromech Ally — 150 CP
[/list]
[size=120][b]Drawbacks[/b][/size]

[list]
[*]Imperial Attention — credit 200 CP
[/list]

[size=135][b]Inventory Snapshot[/b][/size]

[size=120][b]Warehouse[/b][/size]

[list]
[*]Element Zero Cache — Resource • qty 3 • tags: rare • volatile
[/list]
[size=120][b]Locker[/b][/size]

[list]
[*]N7 Armor — Gear • qty 1 • tags: signature
[/list]

[size=135][b]Character Profiles[/b][/size]

[size=120][b]Jumper Prime[/b][/size]

[list]
[*][b]Alias:[/b] Shepard
[*][b]Species:[/b] Human
[*][b]Homeland:[/b] Earth
[*][b]Bio:[/b] Veteran commander with a knack for diplomacy.
[/list]

[size=135][b]Notes Overview[/b][/size]

[list]
[*]Mass Effect (Citadel Space) — 1 note • Remember to visit the Citadel markets.
[*]Global — 1 note • Schedule training between jumps.
[/list]

[size=135][b]Recap Highlights[/b][/size]

[list]
[*]Mass Effect (Citadel Space) — 1 recap • Secured Spectre mentorship.
[/list]`;

    expect(bbcode).toBe(expected);
  });

  test("wraps sections in spoilers when enabled", () => {
    const preferences = createDefaultSectionPreferences();
    preferences.notes = { ...preferences.notes, spoiler: true };
    const bbcode = composeDocument("bbcode", sections, preferences);
    expect(bbcode).toContain("[spoiler=Notes Overview]");
    expect(bbcode).toContain("[/spoiler]");
  });
});
