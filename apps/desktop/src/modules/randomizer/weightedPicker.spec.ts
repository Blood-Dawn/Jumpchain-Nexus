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

/// <reference types="vitest" />

import { describe, expect, it } from "vitest";
import {
  createHistoryExportPayload,
  drawWeightedWithoutReplacement,
  formatWeightedDrawForClipboard,
  formatWeightedHistoryForClipboard,
  formatWeightedPickSummary,
  type WeightedEntry,
  type WeightedHistoryRun,
} from "./weightedPicker";

describe("drawWeightedWithoutReplacement", () => {
  it("returns an empty array when count is zero", () => {
    const entries: WeightedEntry<string>[] = [
      { id: "a", weight: 1, payload: "Alpha" },
    ];
    expect(drawWeightedWithoutReplacement(entries, 0)).toEqual([]);
  });

  it("selects entries proportional to their weight", () => {
    const entries: WeightedEntry<string>[] = [
      { id: "a", weight: 1, payload: "Alpha" },
      { id: "b", weight: 3, payload: "Beta" },
      { id: "c", weight: 6, payload: "Gamma" },
    ];

    const deterministicRngValues = [0.9, 0.6, 0.1];
    let cursor = 0;
    const rng = () => deterministicRngValues[cursor++ % deterministicRngValues.length]!;

    const picks = drawWeightedWithoutReplacement(entries, 3, rng);
    expect(picks.map((pick) => pick.id)).toEqual(["c", "b", "a"]);
  });

  it("never selects entries with zero weight", () => {
    const entries: WeightedEntry<string>[] = [
      { id: "a", weight: 0, payload: "Alpha" },
      { id: "b", weight: 5, payload: "Beta" },
    ];

    const picks = drawWeightedWithoutReplacement(entries, 2, () => 0.1);
    expect(picks.map((pick) => pick.id)).toEqual(["b"]);
  });

  it("performs draws without replacement", () => {
    const entries: WeightedEntry<string>[] = [
      { id: "a", weight: 5, payload: "Alpha" },
      { id: "b", weight: 5, payload: "Beta" },
    ];

    const picks = drawWeightedWithoutReplacement(entries, 3, () => 0.4);
    expect(picks.map((pick) => pick.id)).toEqual(["a", "b"]);
  });

  it("captures draw steps when requested", () => {
    const entries: WeightedEntry<string>[] = [
      { id: "a", weight: 5, payload: "Alpha" },
      { id: "b", weight: 5, payload: "Beta" },
      { id: "c", weight: 10, payload: "Gamma" },
    ];

    const result = drawWeightedWithoutReplacement(entries, 2, () => 0.25, { captureSteps: true });

    expect(result.picks).toHaveLength(2);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.available.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(result.steps[0]?.selected.id).toBeDefined();
    expect(result.steps[1]?.available).toHaveLength(2);
  });
});

describe("format helpers", () => {
  it("formats an individual pick summary", () => {
    expect(
      formatWeightedPickSummary({
        id: "pick-a",
        name: "Alpha",
        weight: 5,
        link: "https://example.com/alpha",
        tags: ["Foo", "Bar"],
      })
    ).toBe("Alpha (https://example.com/alpha) w5 [Foo, Bar]");
  });

  it("creates numbered clipboard output for draw results", () => {
    const text = formatWeightedDrawForClipboard([
      {
        id: "pick-a",
        name: "Alpha",
        weight: 5,
        link: "https://example.com/alpha",
        tags: ["Foo"],
      },
      {
        id: "pick-b",
        name: "Beta",
        weight: 2,
        tags: [],
      },
    ]);

    expect(text).toBe("1. Alpha (https://example.com/alpha) w5 [Foo]\n2. Beta w2");
  });

  it("summarizes history runs for clipboard export", () => {
    const history: WeightedHistoryRun[] = [
      {
        id: "roll-1",
        listId: "list-1",
        createdAt: "2024-01-01T12:00:00.000Z",
        seed: "seed-1",
        params: { drawCount: 2, scope: "all" },
        picks: [
          {
            id: "pick-1",
            entryId: "entry-1",
            position: 1,
            name: "Alpha",
            weight: 5,
            link: "https://example.com/alpha",
            tags: ["Foo"],
          },
        ],
      },
    ];

    const text = formatWeightedHistoryForClipboard(history, {
      formatTimestamp: (iso) => `formatted(${iso})`,
    });

    expect(text).toBe(
      "Roll 1 — formatted(2024-01-01T12:00:00.000Z) | Seed: seed-1\n1. Alpha (https://example.com/alpha) w5 [Foo]"
    );
  });

  it("builds a JSON-ready history export payload", () => {
    const history: WeightedHistoryRun[] = [
      {
        id: "roll-1",
        listId: "list-1",
        createdAt: "2024-01-01T12:00:00.000Z",
        seed: null,
        params: { drawCount: 1 },
        picks: [
          {
            id: "pick-1",
            entryId: "entry-1",
            position: 1,
            name: "Alpha",
            weight: 5,
            link: null,
            tags: [],
          },
        ],
      },
    ];

    expect(createHistoryExportPayload(history)).toEqual([
      {
        id: "roll-1",
        list_id: "list-1",
        created_at: "2024-01-01T12:00:00.000Z",
        seed: null,
        params: { drawCount: 1 },
        picks: [
          {
            id: "pick-1",
            entry_id: "entry-1",
            name: "Alpha",
            weight: 5,
            link: null,
            tags: [],
            position: 1,
          },
        ],
      },
    ]);
  });
});
