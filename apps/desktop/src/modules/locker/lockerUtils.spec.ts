/*
Bloodawn

Copyright (c) 2025 Bloodawn

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

import { describe, expect, it } from "vitest";

import type { InventoryItemRecord } from "../../db/dao";
import {
  collectLockerTags,
  computeLockerWarnings,
  filterLockerItems,
  mapLockerItems,
  type LockerFilters,
} from "./lockerUtils";

const baseTimestamp = new Date().toISOString();

function createInventoryItem(overrides: Partial<InventoryItemRecord>): InventoryItemRecord {
  return {
    id: "item-id",
    scope: "locker",
    name: "Sample Item",
    category: "General",
    quantity: 1,
    slot: null,
    notes: null,
    tags: null,
    jump_id: null,
    metadata: null,
    sort_order: 0,
    created_at: baseTimestamp,
    updated_at: baseTimestamp,
    ...overrides,
  };
}

describe("lockerUtils filtering", () => {
  const records: InventoryItemRecord[] = [
    createInventoryItem({
      id: "core",
      name: "Core Booster",
      tags: JSON.stringify(["booster:core", "body-mod:universal"]),
      metadata: JSON.stringify({ packed: true, priority: "medium", bodyMod: "universal" }),
    }),
    createInventoryItem({
      id: "strength",
      name: "Strength Surge",
      tags: JSON.stringify(["booster:strength", "requires:booster:core", "body-mod:essential"]),
      metadata: JSON.stringify({ packed: false, priority: "high", bodyMod: "essential" }),
    }),
    createInventoryItem({
      id: "medkit",
      name: "Medical Kit",
      tags: JSON.stringify(["medical", "support"]),
      metadata: JSON.stringify({ packed: false, priority: "medium" }),
    }),
  ];
  const analyzed = mapLockerItems(records);

  it("filters by body mod type", () => {
    const filters: LockerFilters = { packed: "all", priority: "all", bodyMod: "essential", booster: "all" };
    const result = filterLockerItems(analyzed, filters, "");
    expect(result).toHaveLength(1);
    expect(result[0].item.id).toBe("strength");
  });

  it("filters boosters only", () => {
    const filters: LockerFilters = { packed: "all", priority: "all", bodyMod: "all", booster: "booster" };
    const result = filterLockerItems(analyzed, filters, "");
    expect(result.map((entry) => entry.item.id)).toEqual(["core", "strength"]);
  });

  it("filters by normalized tag value", () => {
    const filters: LockerFilters = { packed: "all", priority: "all", bodyMod: "all", booster: "all" };
    const result = filterLockerItems(analyzed, filters, "", ["medical"]);
    expect(result).toHaveLength(1);
    expect(result[0].item.id).toBe("medkit");
  });

  it("requires all active tags to be present", () => {
    const filters: LockerFilters = { packed: "all", priority: "all", bodyMod: "all", booster: "all" };
    const result = filterLockerItems(analyzed, filters, "", ["medical", "support"]);
    expect(result).toHaveLength(1);
    expect(result[0].item.id).toBe("medkit");
    const none = filterLockerItems(analyzed, filters, "", ["medical", "support", "booster:core"]);
    expect(none).toHaveLength(0);
  });

  it("collects unique tag labels", () => {
    const tags = collectLockerTags(analyzed);
    const values = tags.map((option) => option.value);
    expect(values).toContain("booster:core");
    expect(values).toContain("medical");
    expect(tags.find((option) => option.value === "booster:core")?.label).toBe("Booster: Core");
  });
});

describe("lockerUtils priority mapping", () => {
  it("maps legacy priority values and adds manual warning for high priority items", () => {
    const legacyPriority = createInventoryItem({
      id: "legacy",
      metadata: JSON.stringify({ priority: "essential" }),
    });
    const analyzed = mapLockerItems([legacyPriority]);
    expect(analyzed[0].priority).toBe("high");
    expect(analyzed[0].manualWarnings).toEqual([
      { type: "priority-high", message: "Marked as high priority." },
    ]);

    const warnings = computeLockerWarnings(analyzed, {
      essentialEnabled: true,
      universalEnabled: true,
    });
    expect(warnings.legacy).toBeDefined();
    expect(warnings.legacy?.some((warning) => warning.type === "priority-high")).toBe(true);
  });
});

describe("lockerUtils dependency warnings", () => {
  it("flags missing booster prerequisites and respects availability toggles", () => {
    const dependent = createInventoryItem({
      id: "dependent",
      name: "Meteoric Surge",
      tags: JSON.stringify(["booster:meteoric", "requires:booster:core", "body-mod:essential"]),
      metadata: JSON.stringify({ priority: "high" }),
    });
    const analyzed = mapLockerItems([dependent]);
    const warnings = computeLockerWarnings(analyzed, { essentialEnabled: false, universalEnabled: true });
    expect(warnings.dependent).toBeDefined();
    expect(warnings.dependent?.some((warning) => warning.type === "missing-booster")).toBe(true);
    expect(warnings.dependent?.some((warning) => warning.type === "body-mod-disabled")).toBe(true);
  });

  it("does not warn when dependency is satisfied", () => {
    const core = createInventoryItem({
      id: "core",
      tags: JSON.stringify(["booster:core", "body-mod:universal"]),
      metadata: JSON.stringify({ bodyMod: "universal" }),
    });
    const dependent = createInventoryItem({
      id: "dependent",
      tags: JSON.stringify(["booster:meteoric", "requires:booster:core"]),
      metadata: JSON.stringify({ priority: "medium" }),
    });
    const analyzed = mapLockerItems([core, dependent]);
    const warnings = computeLockerWarnings(analyzed, { essentialEnabled: true, universalEnabled: true });
    expect(warnings.dependent).toBeUndefined();
  });

  it("respects universal availability flag", () => {
    const universalBooster = createInventoryItem({
      id: "universal",
      tags: JSON.stringify(["booster:flex", "body-mod:universal"]),
      metadata: JSON.stringify({ bodyMod: "universal" }),
    });
    const analyzed = mapLockerItems([universalBooster]);
    const warnings = computeLockerWarnings(analyzed, { essentialEnabled: true, universalEnabled: false });
    expect(warnings.universal).toBeDefined();
    expect(warnings.universal?.some((warning) => warning.type === "universal-disabled")).toBe(true);
  });
});
