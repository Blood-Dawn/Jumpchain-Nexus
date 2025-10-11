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

/// <reference types="vitest" />

import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadMock = vi.fn<[string], Promise<FakeDb>>();

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: loadMock },
}));

class FakeDb {
  executeCalls: Array<{ sql: string; params: unknown[] }> = [];
  selectCalls: Array<{ sql: string; params: unknown[] }> = [];
  private selectQueue: Array<unknown> = [];
  private handlers: Array<{
    matcher: (sql: string, params: unknown[]) => boolean;
    resolver: (sql: string, params: unknown[]) => unknown;
    once: boolean;
  }> = [];

  enqueueSelect(result: unknown): void {
    this.selectQueue.push(result);
  }

  whenSelect(
    matcher: (sql: string, params: unknown[]) => boolean,
    resolver: (sql: string, params: unknown[]) => unknown,
    options: { once?: boolean } = {}
  ): void {
    this.handlers.push({ matcher, resolver, once: options.once ?? false });
  }

  clearCalls(): void {
    this.executeCalls = [];
    this.selectCalls = [];
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    this.executeCalls.push({ sql, params });
  }

  async select(sql: string, params: unknown[] = []): Promise<unknown> {
    this.selectCalls.push({ sql, params });
    const handlerIndex = this.handlers.findIndex((entry) => entry.matcher(sql, params));
    if (handlerIndex >= 0) {
      const handler = this.handlers[handlerIndex];
      const result = handler.resolver(sql, params);
      if (handler.once) {
        this.handlers.splice(handlerIndex, 1);
      }
      return result;
    }
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith("PRAGMA TABLE_INFO")) {
      return [];
    }
    if (normalized.includes("COUNT(*) AS COUNT FROM KNOWLEDGE_ARTICLES")) {
      return [{ count: 0 }];
    }
    if (normalized.includes("FROM KNOWLEDGE_ARTICLE_ASSETS")) {
      return [];
    }
    if (!this.selectQueue.length) {
      return [];
    }
    const next = this.selectQueue.shift();
    if (typeof next === "function") {
      return (next as (sql: string, params: unknown[]) => unknown)(sql, params);
    }
    return next;
  }
}

async function importDao() {
  return import("./dao");
}

type PurchaseCostInput = import("./dao").PurchaseCostInput;

const cryptoImpl = globalThis.crypto ?? webcrypto;

beforeEach(() => {
  vi.resetModules();
  loadMock.mockReset();
});

describe("computeBudget", () => {
  it("aggregates normal purchases", async () => {
    loadMock.mockResolvedValue(new FakeDb());
    const { computeBudget } = await importDao();
    const purchases: PurchaseCostInput[] = [
      { cost: 200 },
      { cost: 50 },
    ];
    expect(computeBudget(purchases)).toEqual({
      totalCost: 250,
      discounted: 0,
      freebies: 0,
      netCost: 250,
    });
  });

  it("halves discounted purchases", async () => {
    loadMock.mockResolvedValue(new FakeDb());
    const { computeBudget } = await importDao();
    const purchases: PurchaseCostInput[] = [
      { cost: 100, discount: true },
    ];
    expect(computeBudget(purchases)).toEqual({
      totalCost: 100,
      discounted: 100,
      freebies: 0,
      netCost: 50,
    });
  });

  it("ignores freebies from net cost", async () => {
    loadMock.mockResolvedValue(new FakeDb());
    const { computeBudget } = await importDao();
    const purchases: PurchaseCostInput[] = [
      { cost: 350, freebie: true },
    ];
    expect(computeBudget(purchases)).toEqual({
      totalCost: 350,
      discounted: 0,
      freebies: 350,
      netCost: 0,
    });
  });

  it("handles mixed purchases", async () => {
    loadMock.mockResolvedValue(new FakeDb());
    const { computeBudget } = await importDao();
    const purchases: PurchaseCostInput[] = [
      { cost: 200 },
      { cost: 150, discount: true },
      { cost: 75, freebie: true },
    ];
    expect(computeBudget(purchases)).toEqual({
      totalCost: 425,
      discounted: 150,
      freebies: 75,
      netCost: 275,
    });
  });

  it("clamps negative costs before aggregating", async () => {
    loadMock.mockResolvedValue(new FakeDb());
    const { computeBudget } = await importDao();
    const purchases: PurchaseCostInput[] = [
      { cost: -50 },
      { cost: -25, discount: true },
      { cost: -10, freebie: true },
    ];
    expect(computeBudget(purchases)).toEqual({
      totalCost: 0,
      discounted: 0,
      freebies: 0,
      netCost: 0,
    });
  });
});

describe("knowledge base relationships", () => {
  it("includes related asset ids when fetching articles", async () => {
    const fakeDb = new FakeDb();
    fakeDb.whenSelect(
      (sql) => sql.toUpperCase().includes("COUNT(*) AS COUNT FROM KNOWLEDGE_ARTICLES"),
      () => [{ count: 1 }],
      { once: true },
    );
    const baseRow = {
      id: "article-1",
      title: "Sample",
      category: null,
      summary: null,
      content: "Body",
      tags: JSON.stringify(["tips"]),
      source: null,
      is_system: 0,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    } satisfies Record<string, unknown>;
    fakeDb.whenSelect(
      (sql) => sql.toUpperCase().includes("SELECT * FROM KNOWLEDGE_ARTICLES"),
      () => [baseRow],
      { once: true },
    );
    fakeDb.whenSelect(
      (sql) => sql.toUpperCase().includes("FROM KNOWLEDGE_ARTICLE_ASSETS"),
      () => [
        { article_id: "article-1", asset_id: "asset-42" },
        { article_id: "article-1", asset_id: "asset-24" },
      ],
      { once: true },
    );
    loadMock.mockResolvedValue(fakeDb);

    const { fetchKnowledgeArticles } = await importDao();
    const articles = await fetchKnowledgeArticles();
    expect(articles).toHaveLength(1);
    expect(articles[0]?.related_asset_ids).toEqual(["asset-42", "asset-24"]);
  });

  it("persists knowledge article asset links on upsert", async () => {
    const fakeDb = new FakeDb();
    fakeDb.whenSelect(
      (sql) => sql.toUpperCase().includes("COUNT(*) AS COUNT FROM KNOWLEDGE_ARTICLES"),
      () => [{ count: 1 }],
      { once: true },
    );
    const existingRow = {
      id: "article-9",
      title: "Existing",
      category: null,
      summary: null,
      content: "Body",
      tags: JSON.stringify([]),
      source: null,
      is_system: 0,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    } satisfies Record<string, unknown>;
    fakeDb.whenSelect(
      (sql) => sql.toUpperCase().includes("SELECT * FROM KNOWLEDGE_ARTICLES WHERE ID = $1"),
      () => [existingRow],
      { once: true },
    );
    fakeDb.whenSelect(
      (sql) => sql.toUpperCase().includes("SELECT * FROM KNOWLEDGE_ARTICLES WHERE ID = $1"),
      () => [
        {
          ...existingRow,
          title: "Existing",
          updated_at: "2025-01-02T00:00:00.000Z",
        },
      ],
      { once: true },
    );
    loadMock.mockResolvedValue(fakeDb);

    const { upsertKnowledgeArticle } = await importDao();
    await upsertKnowledgeArticle({
      id: "article-9",
      title: "Existing",
      category: null,
      summary: null,
      content: "Body",
      tags: ["tips"],
      source: null,
      relatedAssetIds: ["asset-a", "asset-b", "asset-a"],
    });

    const deleteCalls = fakeDb.executeCalls.filter((call) =>
      call.sql.toUpperCase().includes("DELETE FROM KNOWLEDGE_ARTICLE_ASSETS")
    );
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0]?.params).toEqual(["article-9"]);

    const insertCalls = fakeDb.executeCalls.filter((call) =>
      call.sql.toUpperCase().includes("INSERT INTO KNOWLEDGE_ARTICLE_ASSETS")
    );
    expect(insertCalls).toHaveLength(2);
    expect(insertCalls.map((call) => call.params)).toEqual([
      ["article-9", "asset-a"],
      ["article-9", "asset-b"],
    ]);
  });

  it("attaches knowledge article ids to jump assets", async () => {
    const fakeDb = new FakeDb();
    fakeDb.whenSelect(
      (sql) => sql.toUpperCase().includes("SELECT * FROM JUMP_ASSETS") && sql.includes("WHERE jump_id = $1"),
      () => [
        {
          id: "asset-1",
          jump_id: "jump-1",
          asset_type: "perk",
          name: "Perk One",
          category: null,
          subcategory: null,
          cost: 100,
          quantity: 1,
          discounted: 0,
          freebie: 0,
          notes: null,
          metadata: null,
          sort_order: 0,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      ],
      { once: true },
    );
    fakeDb.whenSelect(
      (sql) => sql.toUpperCase().includes("FROM KNOWLEDGE_ARTICLE_ASSETS"),
      () => [
        { article_id: "article-1", asset_id: "asset-1" },
        { article_id: "article-2", asset_id: "asset-1" },
      ],
      { once: true },
    );
    loadMock.mockResolvedValue(fakeDb);

    const { listJumpAssets } = await importDao();
    const rows = await listJumpAssets("jump-1");
    expect(rows[0]?.knowledge_article_ids).toEqual(["article-1", "article-2"]);
  });
});

describe("lookupKnowledgeArticleSummaries", () => {
  it("preserves the input order while removing duplicates", async () => {
    const fakeDb = new FakeDb();
    fakeDb.whenSelect(
      (sql) => sql.toUpperCase().includes("COUNT(*) AS COUNT FROM KNOWLEDGE_ARTICLES"),
      () => [{ count: 3 }],
      { once: true },
    );
    fakeDb.whenSelect(
      (sql) =>
        sql.toUpperCase().includes("SELECT ID, TITLE, SUMMARY") &&
        sql.toUpperCase().includes("FROM KNOWLEDGE_ARTICLES"),
      () => [
        { id: "article-b", title: "Beta", summary: "Second" },
        { id: "article-a", title: "Alpha", summary: "First" },
        { id: "article-c", title: "Gamma", summary: null },
      ],
      { once: true },
    );
    loadMock.mockResolvedValue(fakeDb);

    const { lookupKnowledgeArticleSummaries } = await importDao();
    const summaries = await lookupKnowledgeArticleSummaries([
      "article-a",
      "article-c",
      "article-a",
      "article-b",
      "article-missing",
    ]);

    expect(summaries).toEqual([
      { id: "article-a", title: "Alpha", summary: "First" },
      { id: "article-c", title: "Gamma", summary: null },
      { id: "article-b", title: "Beta", summary: "Second" },
    ]);
  });
});

describe("summarizeJumpBudget", () => {
  it("includes stipend toggles and companion import selections", async () => {
    const fakeDb = new FakeDb();
    const assetRows = [
      {
        id: "asset-perk",
        asset_type: "perk",
        name: "Perk A",
        cost: 400,
        quantity: 1,
        discounted: 0,
        freebie: 0,
        metadata: JSON.stringify({ stipend: { base: 100, frequency: "once", total: 100 } }),
      },
      {
        id: "asset-companion",
        asset_type: "companion",
        name: "Companion B",
        cost: 0,
        quantity: 1,
        discounted: 0,
        freebie: 0,
        metadata: JSON.stringify({ stipend: { base: 50, periods: 3, frequency: "monthly", total: 150 } }),
      },
      {
        id: "asset-drawback",
        asset_type: "drawback",
        name: "Drawback Z",
        cost: 200,
        quantity: 1,
        discounted: 0,
        freebie: 0,
        metadata: null,
      },
    ];
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM jump_assets") && sql.includes("WHERE jump_id = $1"),
      () => assetRows
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM jump_stipend_toggles"),
      () => [
        { asset_id: "asset-perk", enabled: 1, override_total: null },
        { asset_id: "asset-companion", enabled: 0, override_total: null },
      ]
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM companion_imports"),
      () => [
        {
          id: "import-1",
          asset_id: "asset-companion",
          companion_name: "Alice",
          option_value: 150,
          selected: 1,
        },
        {
          id: "import-2",
          asset_id: "asset-companion",
          companion_name: "Bob",
          option_value: 200,
          selected: 0,
        },
      ]
    );

    loadMock.mockResolvedValue(fakeDb);

    const { summarizeJumpBudget } = await importDao();
    const summary = await summarizeJumpBudget("jump-1");

    expect(summary.netCost).toBe(550);
    expect(summary.purchasesNetCost).toBe(400);
    expect(summary.companionImportCost).toBe(150);
    expect(summary.drawbackCredit).toBe(200);
    expect(summary.stipendAdjustments).toBe(100);
    expect(summary.stipendPotential).toBe(250);
    expect(summary.balance).toBe(-250);

    expect(summary.stipendToggles).toEqual([
      {
        assetId: "asset-perk",
        assetName: "Perk A",
        enabled: true,
        amount: 100,
        potentialAmount: 100,
      },
      {
        assetId: "asset-companion",
        assetName: "Companion B",
        enabled: false,
        amount: 150,
        potentialAmount: 150,
      },
    ]);

    expect(summary.companionImportSelections).toEqual([
      {
        id: "import-1",
        assetId: "asset-companion",
        assetName: "Companion B",
        companionName: "Alice",
        optionValue: 150,
        selected: true,
      },
      {
        id: "import-2",
        assetId: "asset-companion",
        assetName: "Companion B",
        companionName: "Bob",
        optionValue: 200,
        selected: false,
      },
    ]);
  });

  it("persists stipend toggle updates and refreshes jump costs", async () => {
    const fakeDb = new FakeDb();
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM jump_assets") && sql.includes("WHERE jump_id = $1"),
      () => [
        {
          id: "asset-perk",
          asset_type: "perk",
          name: "Perk A",
          cost: 100,
          quantity: 1,
          discounted: 0,
          freebie: 0,
          metadata: JSON.stringify({ stipend: { base: 50, frequency: "once", total: 50 } }),
        },
      ]
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM jump_stipend_toggles"),
      () => [],
      { once: true }
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM jump_stipend_toggles"),
      () => [{ asset_id: "asset-perk", enabled: 0, override_total: null }]
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM companion_imports"),
      () => []
    );

    loadMock.mockResolvedValue(fakeDb);

    const { summarizeJumpBudget, setJumpStipendToggle } = await importDao();

    const before = await summarizeJumpBudget("jump-1");
    expect(before.stipendAdjustments).toBe(50);
    expect(before.balance).toBe(-50);

    await setJumpStipendToggle("jump-1", "asset-perk", false);

    const insertCall = fakeDb.executeCalls.find((call) =>
      call.sql.includes("INSERT INTO jump_stipend_toggles")
    );
    expect(insertCall?.params.slice(0, 3)).toEqual(["jump-1", "asset-perk", 0]);

    const updateCall = fakeDb.executeCalls.find((call) =>
      call.sql.includes("UPDATE jumps SET cp_spent")
    );
    expect(updateCall).toBeTruthy();

    const after = await summarizeJumpBudget("jump-1");
    expect(after.stipendAdjustments).toBe(0);
    expect(after.balance).toBe(-100);
  });
});

describe("statistics snapshot", () => {
  it("aggregates cp, inventory, gauntlet, and boosters", async () => {
    const fakeDb = new FakeDb();
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM jumps j") && sql.includes("GROUP BY j.id") && !sql.includes("gauntlet_jumps"),
      () => [
        {
          jump_id: "jump-1",
          title: "Arc One",
          status: "Gauntlet",
          cp_budget: 1500,
          spent: 600,
          earned: 400,
        },
        {
          jump_id: "jump-2",
          title: "World Two",
          status: "Completed",
          cp_budget: 1000,
          spent: 850,
          earned: 50,
        },
      ]
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM jump_assets") && sql.includes("GROUP BY asset_type"),
      () => [
        {
          asset_type: "perk",
          item_count: 4,
          gross_cost: 1000,
          net_cost: 900,
          credit: 0,
          discounted_count: 2,
          freebie_count: 1,
        },
        {
          asset_type: "item",
          item_count: 3,
          gross_cost: 600,
          net_cost: 550,
          credit: 0,
          discounted_count: 0,
          freebie_count: 0,
        },
        {
          asset_type: "drawback",
          item_count: 2,
          gross_cost: 450,
          net_cost: 0,
          credit: 450,
          discounted_count: 0,
          freebie_count: 0,
        },
      ]
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM normalized_inventory"),
      () => [
        {
          category: "Weapons",
          item_count: 4,
          total_quantity: 8,
          warehouse_count: 3,
          locker_count: 1,
        },
        {
          category: null,
          item_count: 1,
          total_quantity: 1,
          warehouse_count: 0,
          locker_count: 1,
        },
      ]
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM gauntlet_jumps"),
      () => [
        {
          jump_id: "jump-1",
          title: "Arc One",
          status: "Gauntlet",
          cp_budget: 1500,
          spent: 600,
          earned: 400,
        },
        {
          jump_id: "jump-3",
          title: "Trial of Courage",
          status: "GAUNTLET-PHASE",
          cp_budget: 1200,
          spent: 1300,
          earned: 200,
        },
      ]
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM universal_drawback_settings"),
      () => [
        {
          id: "universal-default",
          total_cp: 500,
          companion_cp: 200,
          item_cp: 150,
          warehouse_wp: 50,
          allow_gauntlet: 1,
          gauntlet_halved: 0,
          created_at: "2025-02-03T04:05:06.000Z",
          updated_at: "2025-02-03T04:05:06.000Z",
        },
      ]
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM character_profiles"),
      () => [
        {
          id: "char-1",
          name: "Alicia Storm",
          attributes_json: JSON.stringify({ boosters: ["Regeneration", { name: "Speed Burst" }] }),
          traits_json: JSON.stringify([{ name: "Courage", type: "virtue" }]),
        },
        {
          id: "char-2",
          name: "Borin Flame",
          attributes_json: JSON.stringify({ boosters: { "Fire Core": { rank: "A" } } }),
          traits_json: JSON.stringify([{ name: "Fire Core", type: "booster" }]),
        },
        {
          id: "char-3",
          name: "Cara Shade",
          attributes_json: null,
          traits_json: JSON.stringify([{ name: "Shadow Blend", type: "booster" }]),
        },
      ]
    );

    loadMock.mockResolvedValue(fakeDb);
    const { loadStatisticsSnapshot } = await importDao();
    const snapshot = await loadStatisticsSnapshot();

    expect(snapshot.cp.totals).toEqual({ budget: 2500, spent: 1450, earned: 450, net: -1000 });
    expect(snapshot.cp.byAssetType.find((entry) => entry.assetType === "perk")).toMatchObject({
      itemCount: 4,
      netCost: 900,
      discounted: 2,
      freebies: 1,
    });
    expect(snapshot.inventory.totalItems).toBe(5);
    expect(snapshot.inventory.totalQuantity).toBe(9);
    expect(snapshot.inventory.categories[0]).toMatchObject({ category: "Weapons", itemCount: 4 });
    expect(snapshot.gauntlet.allowGauntlet).toBe(true);
    expect(snapshot.gauntlet.totalGauntlets).toBe(2);
    expect(snapshot.gauntlet.completedGauntlets).toBe(1);
    expect(snapshot.gauntlet.rows[1]).toMatchObject({ jumpId: "jump-3", spent: 1300 });
    expect(snapshot.boosters.totalCharacters).toBe(3);
    expect(snapshot.boosters.totalBoosters).toBe(4);
    expect(snapshot.boosters.entries.map((entry) => entry.booster)).toEqual([
      "Fire Core",
      "Regeneration",
      "Shadow Blend",
      "Speed Burst",
    ]);
    const fireCore = snapshot.boosters.entries[0];
    expect(fireCore.characters.map((character) => character.name)).toEqual(["Borin Flame"]);
  });
});

describe("jump asset dao", () => {
  it("@smoke creates jump assets with derived defaults and summary updates", async () => {
    const fakeDb = new FakeDb();
    const insertedAt = new Date("2025-01-02T03:04:05.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(insertedAt);
    const uuidSpy = vi.spyOn(cryptoImpl, "randomUUID").mockReturnValue("asset-123");
    fakeDb.whenSelect(
      (sql) => sql.includes("COALESCE(MAX(sort_order)"),
      () => [{ max_order: 2 }],
      { once: true }
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("SELECT id, asset_type, name, cost, quantity, discounted, freebie, metadata") && sql.includes("FROM jump_assets"),
      () => [
        {
          id: "asset-123",
          asset_type: "perk",
          name: "Sword of Dawn",
          cost: 200,
          quantity: 1,
          discounted: 0,
          freebie: 0,
          metadata: JSON.stringify({ stipend: null }),
        },
      ],
      { once: true }
    );
    const storedRecord = {
      id: "asset-123",
      jump_id: "jump-1",
      asset_type: "perk",
      name: "Sword of Dawn",
      category: null,
      subcategory: null,
      cost: 200,
      quantity: 1,
      discounted: 0,
      freebie: 0,
      notes: "Keep away from water",
      metadata: "{\"rarity\":\"legendary\"}",
      sort_order: 3,
      created_at: insertedAt.toISOString(),
      updated_at: insertedAt.toISOString(),
      knowledge_article_ids: [],
    };
    fakeDb.whenSelect(
      (sql, params) => sql.includes("SELECT * FROM jump_assets WHERE id = $1") && params[0] === "asset-123",
      () => [storedRecord],
      { once: true }
    );
    loadMock.mockResolvedValue(fakeDb);

    const { createJumpAsset } = await importDao();
    const result = await createJumpAsset({
      jump_id: "jump-1",
      asset_type: "perk",
      name: "Sword of Dawn",
      cost: 200,
      metadata: { rarity: "legendary" },
      notes: "Keep away from water",
    });

    expect(result).toEqual(storedRecord);

    const insertCall = fakeDb.executeCalls.find((call) =>
      call.sql.includes("INSERT INTO jump_assets")
    );
    expect(insertCall?.params).toEqual([
      "asset-123",
      "jump-1",
      "perk",
      "Sword of Dawn",
      null,
      null,
      200,
      1,
      0,
      0,
      "Keep away from water",
      "{\"rarity\":\"legendary\"}",
      3,
      insertedAt.toISOString(),
    ]);

    const summaryUpdate = fakeDb.executeCalls.find((call) =>
      call.sql.includes("UPDATE jumps SET cp_spent")
    );
    expect(summaryUpdate?.params).toEqual([200, 0, "jump-1"]);

    vi.useRealTimers();
    uuidSpy.mockRestore();
  });

  it("lists jump assets scoped by type", async () => {
    const fakeDb = new FakeDb();
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM jump_assets") && sql.includes("asset_type IN"),
      () => [
        {
          id: "asset-1",
          jump_id: "jump-1",
          asset_type: "perk",
          name: "Perk A",
          category: null,
          subcategory: null,
          cost: 100,
          quantity: 1,
          discounted: 0,
          freebie: 0,
          notes: null,
          metadata: null,
          sort_order: 0,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
        {
          id: "asset-2",
          jump_id: "jump-1",
          asset_type: "item",
          name: "Item B",
          category: null,
          subcategory: null,
          cost: 50,
          quantity: 1,
          discounted: 0,
          freebie: 0,
          notes: null,
          metadata: null,
          sort_order: 1,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      ],
      { once: true }
    );
    loadMock.mockResolvedValue(fakeDb);

    const { listJumpAssets } = await importDao();
    const rows = await listJumpAssets("jump-1", ["perk", "item"]);
    expect(rows).toHaveLength(2);
    const listCall = fakeDb.selectCalls.find((call) => call.sql.includes("asset_type IN"));
    expect(listCall?.sql).toContain("asset_type IN ($2, $3)");
    expect(listCall?.params).toEqual(["jump-1", "perk", "item"]);
  });

  it("reorders jump assets inside a transaction", async () => {
    const fakeDb = new FakeDb();
    loadMock.mockResolvedValue(fakeDb);

    const { reorderJumpAssets } = await importDao();
    await reorderJumpAssets("jump-9", "item", ["asset-a", "asset-b"]);

    const executedSql = fakeDb.executeCalls.map((entry) => entry.sql.trim());
    expect(executedSql.some((sql) => sql === "BEGIN TRANSACTION")).toBe(true);
    expect(executedSql.some((sql) => sql === "COMMIT")).toBe(true);
    const updateCalls = fakeDb.executeCalls.filter((entry) =>
      entry.sql.replace(/\s+/g, " ").toUpperCase().includes("UPDATE JUMP_ASSETS SET SORT_ORDER")
    );
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0]?.params?.[0]).toBe(0);
    expect(typeof updateCalls[0]?.params?.[1]).toBe("string");
    expect(updateCalls[0]?.params?.[2]).toBe("asset-a");
    expect(updateCalls[0]?.params?.[3]).toBe("jump-9");
    expect(updateCalls[0]?.params?.[4]).toBe("item");
    expect(updateCalls[1]?.params?.[0]).toBe(1);
    expect(typeof updateCalls[1]?.params?.[1]).toBe("string");
    expect(updateCalls[1]?.params?.[2]).toBe("asset-b");
    expect(updateCalls[1]?.params?.[3]).toBe("jump-9");
    expect(updateCalls[1]?.params?.[4]).toBe("item");
  });
});

describe("formatter settings dao", () => {
  it("reads persisted overrides with tolerant parsing", async () => {
    const fakeDb = new FakeDb();
    const formatterSelects: Record<string, unknown[][]> = {
      "formatter.deleteAllLineBreaks": [
        [
          { key: "formatter.deleteAllLineBreaks", value: "true", updated_at: "2025-01-01T00:00:00.000Z" },
        ],
      ],
      "formatter.leaveDoubleLineBreaks": [
        [
          { key: "formatter.leaveDoubleLineBreaks", value: "0", updated_at: "2025-01-01T00:00:00.000Z" },
        ],
      ],
      "formatter.thousandsSeparator": [
        [
          { key: "formatter.thousandsSeparator", value: "space", updated_at: "2025-01-01T00:00:00.000Z" },
        ],
      ],
      "formatter.spellcheckEnabled": [
        [
          { key: "formatter.spellcheckEnabled", value: "false", updated_at: "2025-01-01T00:00:00.000Z" },
        ],
      ],
    };
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM app_settings WHERE key = $1"),
      (_, params) => {
        const key = params[0] as string;
        const responses = formatterSelects[key];
        if (!responses || !responses.length) {
          return [];
        }
        return responses.shift() ?? [];
      }
    );
    loadMock.mockResolvedValue(fakeDb);

    const { loadFormatterSettings } = await importDao();
    await expect(loadFormatterSettings()).resolves.toEqual({
      removeAllLineBreaks: true,
      leaveDoubleLineBreaks: false,
      thousandsSeparator: "space",
      spellcheckEnabled: false,
    });
  });

  it("updates formatter settings and persists overrides", async () => {
    const fakeDb = new FakeDb();
    const now = new Date("2025-02-03T04:05:06.000Z").toISOString();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const updateSelects: Record<string, unknown[][]> = {
      "formatter.deleteAllLineBreaks": [
        [],
        [
          { key: "formatter.deleteAllLineBreaks", value: "true", updated_at: now },
        ],
      ],
      "formatter.leaveDoubleLineBreaks": [
        [],
        [
          { key: "formatter.leaveDoubleLineBreaks", value: "false", updated_at: now },
        ],
      ],
      "formatter.thousandsSeparator": [
        [
          { key: "formatter.thousandsSeparator", value: "period", updated_at: now },
        ],
        [
          { key: "formatter.thousandsSeparator", value: "comma", updated_at: now },
        ],
      ],
      "formatter.spellcheckEnabled": [
        [
          { key: "formatter.spellcheckEnabled", value: "true", updated_at: now },
        ],
        [
          { key: "formatter.spellcheckEnabled", value: "true", updated_at: now },
        ],
      ],
    };
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM app_settings WHERE key = $1"),
      (_, params) => {
        const key = params[0] as string;
        const responses = updateSelects[key];
        if (!responses || !responses.length) {
          return [];
        }
        return responses.shift() ?? [];
      }
    );
    loadMock.mockResolvedValue(fakeDb);

    const { updateFormatterSettings } = await importDao();
    const result = await updateFormatterSettings({
      removeAllLineBreaks: true,
      thousandsSeparator: "comma",
    });

    expect(result).toEqual({
      removeAllLineBreaks: true,
      leaveDoubleLineBreaks: false,
      thousandsSeparator: "comma",
      spellcheckEnabled: true,
    });

    const persistedCalls = fakeDb.executeCalls.filter((call) =>
      call.sql.includes("INSERT INTO app_settings")
    );
    expect(persistedCalls).toHaveLength(4);
    expect(persistedCalls.map((call) => call.params.slice(0, 2))).toEqual([
      ["formatter.deleteAllLineBreaks", "true"],
      ["formatter.leaveDoubleLineBreaks", "false"],
      ["formatter.thousandsSeparator", "comma"],
      ["formatter.spellcheckEnabled", "true"],
    ]);

    vi.useRealTimers();
  });
});

describe("passport derived snapshot", () => {
  it("aggregates assets into derived perks, traits, companions, and metadata summaries", async () => {
    const fakeDb = new FakeDb();
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM jump_assets") && sql.includes("JOIN jumps"),
      () => [
        {
          id: "asset-perk-1",
          jump_id: "jump-1",
          asset_type: "perk",
          name: "Might of the Colossus",
          category: "Physical",
          subcategory: null,
          cost: 200,
          quantity: 1,
          discounted: 0,
          freebie: 0,
          notes: "Grants tremendous strength.",
          metadata: JSON.stringify({
            traitTags: ["Strength", "Power"],
            attributes: [
              { key: "Strength", value: "50" },
              { key: "Resolve", value: "A" },
            ],
            stipend: { base: 100, periods: 3, frequency: "monthly", notes: "Arena winnings" },
            altForms: [{ name: "Titan Form", summary: "Colossal battle avatar." }],
          }),
          sort_order: 0,
          created_at: "2025-01-02T03:04:05.000Z",
          updated_at: "2025-01-02T03:04:05.000Z",
          jump_title: "Spark of Adventure",
        },
        {
          id: "asset-companion-1",
          jump_id: "jump-2",
          asset_type: "companion",
          name: "Kara the Shield",
          category: null,
          subcategory: null,
          cost: 300,
          quantity: 1,
          discounted: 0,
          freebie: 0,
          notes: "Unwavering guardian.",
          metadata: JSON.stringify({
            traitTags: ["Ally", "Strength"],
            attributes: [{ key: "Strength", value: "25" }],
            stipend: { base: 50, frequency: "once" },
            altForms: [{ name: "Battle Mode", summary: "" }],
          }),
          sort_order: 1,
          created_at: "2025-01-03T04:05:06.000Z",
          updated_at: "2025-01-03T04:05:06.000Z",
          jump_title: "Trial of Champions",
        },
      ],
      { once: true }
    );
    loadMock.mockResolvedValue(fakeDb);

    const { loadPassportDerivedSnapshot } = await importDao();
    const snapshot = await loadPassportDerivedSnapshot();

    expect(snapshot.perks).toHaveLength(1);
    expect(snapshot.perks[0]).toMatchObject({
      id: "asset-perk-1",
      jumpTitle: "Spark of Adventure",
      traitTags: ["Strength", "Power"],
    });

    expect(snapshot.companions).toHaveLength(1);
    expect(snapshot.companions[0]).toMatchObject({
      id: "asset-companion-1",
      jumpTitle: "Trial of Champions",
    });

    const strengthTrait = snapshot.traits.find((entry) => entry.name === "Strength");
    expect(strengthTrait?.sources.map((source) => source.assetId)).toEqual([
      "asset-perk-1",
      "asset-companion-1",
    ]);

    expect(snapshot.altForms.map((entry) => entry.name)).toEqual(["Battle Mode", "Titan Form"]);

    const strengthAttribute = snapshot.attributes.find((entry) => entry.key === "Strength");
    expect(strengthAttribute).toMatchObject({
      total: 75,
      numericCount: 2,
    });
    expect(strengthAttribute?.entries.map((entry) => entry.assetId)).toEqual([
      "asset-perk-1",
      "asset-companion-1",
    ]);

    const resolveAttribute = snapshot.attributes.find((entry) => entry.key === "Resolve");
    expect(resolveAttribute?.numericCount).toBe(0);

    expect(snapshot.stipendTotal).toBe(350);
    expect(snapshot.stipends).toEqual([
      expect.objectContaining({
        assetId: "asset-companion-1",
        amount: 50,
        frequency: "once",
      }),
      expect.objectContaining({
        assetId: "asset-perk-1",
        amount: 300,
        frequency: "monthly",
      }),
    ]);
  });
});
describe("supplement settings dao", () => {
  it("returns defaults when essential body mod settings are missing", async () => {
    const fakeDb = new FakeDb();
    loadMock.mockResolvedValue(fakeDb);

    const { loadEssentialBodyModSettings, DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS } = await importDao();
    await expect(loadEssentialBodyModSettings()).resolves.toEqual(DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS);
  });

  it("persists essential body mod settings overrides", async () => {
    const fakeDb = new FakeDb();
    let selectCount = 0;
    const now = new Date("2025-03-04T05:06:07.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    fakeDb.whenSelect(
      (sql) => sql.includes("FROM essential_body_mod_settings WHERE id = $1"),
      () => {
        selectCount += 1;
        if (selectCount === 1) {
          return [];
        }
        return [
          {
            id: "essential-default",
            budget: 1250,
            starting_mode: "heroic",
            essence_mode: "dual",
            advancement_mode: "meteoric",
            ep_access_mode: "standard",
            ep_access_modifier: "retro-cumulative",
            unlockable_essence: 1,
            limit_investment: 1,
            investment_allowed: 1,
            investment_ratio: 3,
            incremental_budget: 150,
            incremental_interval: 2,
            training_allowance: 1,
            tempered_by_suffering: 0,
            unbalanced_mode: "harmonized",
            unbalanced_description: "Stay balanced",
            limiter: "body-mod",
            limiter_description: "Limited by body mod",
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          },
        ];
      }
    );
    loadMock.mockResolvedValue(fakeDb);

    const { saveEssentialBodyModSettings } = await importDao();
    const result = await saveEssentialBodyModSettings({
      budget: 1250,
      startingMode: "heroic",
      essenceMode: "dual",
      advancementMode: "meteoric",
      epAccessMode: "standard",
      epAccessModifier: "retro-cumulative",
      unlockableEssence: true,
      limitInvestment: true,
      investmentAllowed: true,
      investmentRatio: 3,
      incrementalBudget: 150,
      incrementalInterval: 2,
      trainingAllowance: true,
      temperedBySuffering: false,
      unbalancedMode: "harmonized",
      unbalancedDescription: "Stay balanced",
      limiter: "body-mod",
      limiterDescription: "Limited by body mod",
    });

    expect(result).toEqual({
      budget: 1250,
      startingMode: "heroic",
      essenceMode: "dual",
      advancementMode: "meteoric",
      epAccessMode: "standard",
      epAccessModifier: "retro-cumulative",
      unlockableEssence: true,
      limitInvestment: true,
      investmentAllowed: true,
      investmentRatio: 3,
      incrementalBudget: 150,
      incrementalInterval: 2,
      trainingAllowance: true,
      temperedBySuffering: false,
      unbalancedMode: "harmonized",
      unbalancedDescription: "Stay balanced",
      limiter: "body-mod",
      limiterDescription: "Limited by body mod",
    });

    const essentialInserts = fakeDb.executeCalls.filter((call) =>
      call.sql.includes("INSERT INTO essential_body_mod_settings")
    );
    const insertCall = essentialInserts[essentialInserts.length - 1];
    expect(insertCall?.params.slice(0, 10)).toEqual([
      "essential-default",
      1250,
      "heroic",
      "dual",
      "meteoric",
      "standard",
      "retro-cumulative",
      1,
      1,
      1,
    ]);
    vi.useRealTimers();
  });

  it("manages essential body mod essences", async () => {
    const fakeDb = new FakeDb();
    let selectCount = 0;
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM essential_body_mod_essences WHERE id = $1"),
      () => {
        selectCount += 1;
        if (selectCount === 1) {
          return [
            {
              id: "essence-1",
              setting_id: "essential-default",
              name: "Regen",
              description: "Recovery boost",
              sort_order: 0,
              created_at: "2025-03-04T05:06:07.000Z",
              updated_at: "2025-03-04T05:06:07.000Z",
            },
          ];
        }
        return [
          {
            id: "essence-1",
            setting_id: "essential-default",
            name: "Regeneration",
            description: "Recovery boost",
            sort_order: 0,
            created_at: "2025-03-04T05:06:07.000Z",
            updated_at: "2025-03-04T05:06:07.000Z",
          },
        ];
      }
    );
    fakeDb.enqueueSelect([
      {
        id: "essence-1",
        setting_id: "essential-default",
        name: "Regeneration",
        description: "Recovery boost",
        sort_order: 0,
        created_at: "2025-03-04T05:06:07.000Z",
        updated_at: "2025-03-04T05:06:07.000Z",
      },
    ]);
    loadMock.mockResolvedValue(fakeDb);

    const {
      upsertEssentialBodyModEssence,
      listEssentialBodyModEssences,
      deleteEssentialBodyModEssence,
    } = await importDao();
    await upsertEssentialBodyModEssence({
      id: "essence-1",
      name: "Regen",
      description: "Recovery boost",
      sort_order: 0,
    });
    const updateCall = fakeDb.executeCalls.find((call) =>
      call.sql.includes("INSERT INTO essential_body_mod_essences")
    );
    expect(updateCall?.params[2]).toBe("Regen");

    const essences = await listEssentialBodyModEssences();
    expect(essences).toHaveLength(1);
    expect(essences[0]?.name).toBe("Regeneration");

    await deleteEssentialBodyModEssence("essence-1");
    const deleteCall = fakeDb.executeCalls.find((call) =>
      call.sql.includes("DELETE FROM essential_body_mod_essences")
    );
    expect(deleteCall?.params).toEqual(["essence-1"]);
  });

  it("persists universal drawback settings overrides", async () => {
    const fakeDb = new FakeDb();
    let selectCount = 0;
    const now = new Date("2025-03-04T08:09:10.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM universal_drawback_settings WHERE id = $1"),
      () => {
        selectCount += 1;
        if (selectCount === 1) {
          return [];
        }
        return [
          {
            id: "universal-default",
            total_cp: 500,
            companion_cp: 200,
            item_cp: 150,
            warehouse_wp: 50,
            allow_gauntlet: 1,
            gauntlet_halved: 0,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          },
        ];
      }
    );
    loadMock.mockResolvedValue(fakeDb);

    const { saveUniversalDrawbackSettings } = await importDao();
    const record = await saveUniversalDrawbackSettings({
      totalCP: 500,
      companionCP: 200,
      itemCP: 150,
      warehouseWP: 50,
      allowGauntlet: true,
      gauntletHalved: false,
    });

    expect(record).toEqual({
      totalCP: 500,
      companionCP: 200,
      itemCP: 150,
      warehouseWP: 50,
      allowGauntlet: true,
      gauntletHalved: false,
    });

    const universalInserts = fakeDb.executeCalls.filter((call) =>
      call.sql.includes("INSERT INTO universal_drawback_settings")
    );
    const insertCall = universalInserts[universalInserts.length - 1];
    expect(insertCall?.params).toEqual([
      "universal-default",
      500,
      200,
      150,
      50,
      1,
      0,
      now.toISOString(),
    ]);
    vi.useRealTimers();
  });
});

describe("export preset dao", () => {
  it("persists presets with serialized options", async () => {
    const fakeDb = new FakeDb();
    const now = new Date("2025-01-05T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    fakeDb.whenSelect(
      (sql, params) => sql.includes("FROM export_presets WHERE id = $1") && params[0] === "preset-1",
      () => [
        {
          id: "preset-1",
          name: "Quick Export",
          description: "Short form",
          options_json: "{\"mode\":\"compact\"}",
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      ],
      { once: true }
    );
    loadMock.mockResolvedValue(fakeDb);

    const { upsertExportPreset } = await importDao();
    const record = await upsertExportPreset({
      id: "preset-1",
      name: "Quick Export",
      description: "Short form",
      options: { mode: "compact" },
    });

    expect(record).toEqual({
      id: "preset-1",
      name: "Quick Export",
      description: "Short form",
      options_json: "{\"mode\":\"compact\"}",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    const insertCall = fakeDb.executeCalls.find((call) =>
      call.sql.includes("INSERT INTO export_presets")
    );
    expect(insertCall?.params).toEqual([
      "preset-1",
      "Quick Export",
      "Short form",
      "{\"mode\":\"compact\"}",
      now.toISOString(),
    ]);

    vi.useRealTimers();
  });

  it("lists presets sorted by name", async () => {
    const fakeDb = new FakeDb();
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM export_presets ORDER BY name"),
      () => [
        {
          id: "preset-a",
          name: "Alpha",
          description: null,
          options_json: "{}",
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
        {
          id: "preset-b",
          name: "Beta",
          description: null,
          options_json: "{}",
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      ],
      { once: true }
    );
    loadMock.mockResolvedValue(fakeDb);

    const { listExportPresets } = await importDao();
    const presets = await listExportPresets();
    expect(presets.map((preset) => preset.name)).toEqual(["Alpha", "Beta"]);
    const selectCall = fakeDb.selectCalls.find((call) => call.sql.includes("FROM export_presets"));
    expect(selectCall?.sql).toContain("ORDER BY name COLLATE NOCASE");
  });
});

describe("warehouse personal reality summary", () => {
  it("aggregates WP and limit contributions", async () => {
    const fakeDb = new FakeDb();
    loadMock.mockResolvedValue(fakeDb);
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM inventory_items") && sql.includes("scope = $1"),
      () => [
        {
          id: "item-1",
          scope: "warehouse",
          name: "Stasis Pods",
          category: null,
          quantity: 2,
          slot: null,
          notes: null,
          tags: null,
          jump_id: null,
          metadata: JSON.stringify({
            personalReality: {
              wp: 5,
              consumes: { structures: 1, residents: 2 },
            },
          }),
          sort_order: 0,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
        {
          id: "item-2",
          scope: "warehouse",
          name: "Dormitory",
          category: null,
          quantity: 1,
          slot: null,
          notes: null,
          tags: null,
          jump_id: null,
          metadata: JSON.stringify({
            personalReality: {
              provides: { structures: 3, residents: 6 },
            },
          }),
          sort_order: 1,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      ],
      { once: true }
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM universal_drawback_settings"),
      () => [
        {
          id: "universal-default",
          total_cp: 0,
          companion_cp: 0,
          item_cp: 0,
          warehouse_wp: 12,
          allow_gauntlet: 0,
          gauntlet_halved: 0,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      ],
      { once: true }
    );

    const { loadWarehousePersonalRealitySummary } = await importDao();
    const summary = await loadWarehousePersonalRealitySummary();
    expect(summary).toEqual({
      wpTotal: 10,
      wpCap: 12,
      limits: [
        { key: "residents", label: "Residents", provided: 6, used: 4 },
        { key: "structures", label: "Structures", provided: 3, used: 2 },
      ],
    });
  });

  it("normalizes string values and ignores malformed metadata", async () => {
    const fakeDb = new FakeDb();
    loadMock.mockResolvedValue(fakeDb);
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM inventory_items") && sql.includes("scope = $1"),
      () => [
        {
          id: "item-1",
          scope: "warehouse",
          name: "Generator",
          category: null,
          quantity: 1,
          slot: null,
          notes: null,
          tags: null,
          jump_id: null,
          metadata: JSON.stringify({
            personal_reality: {
              wpCost: "7",
              provides: { power: "10" },
            },
          }),
          sort_order: 0,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
        {
          id: "item-2",
          scope: "warehouse",
          name: "Luxury Suite",
          category: null,
          quantity: 0,
          slot: null,
          notes: null,
          tags: null,
          jump_id: null,
          metadata: "not-json",
          sort_order: 1,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      ],
      { once: true }
    );
    fakeDb.whenSelect(
      (sql) => sql.includes("FROM universal_drawback_settings"),
      () => [],
      { once: true }
    );

    const { loadWarehousePersonalRealitySummary, DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS } = await importDao();
    const summary = await loadWarehousePersonalRealitySummary();
    expect(summary.wpTotal).toBe(7);
    expect(summary.wpCap).toBe(DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS.warehouseWP);
    expect(summary.limits).toEqual([
      { key: "power", label: "Power", provided: 10, used: 0 },
    ]);
  });
});
