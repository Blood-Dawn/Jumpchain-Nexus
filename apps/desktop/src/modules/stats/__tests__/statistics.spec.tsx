/*
Bloodawn

Copyright (c) 2025 Bloodawn

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
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StatisticsHub from "../index";

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

const daoMocks = vi.hoisted(() => ({
  mockLoadStatisticsSnapshot: vi.fn(),
}));

vi.mock("../../../db/dao", () => ({
  loadStatisticsSnapshot: daoMocks.mockLoadStatisticsSnapshot,
}));

const { mockLoadStatisticsSnapshot } = daoMocks;

type StatisticsSnapshot = import("../../../db/dao").StatisticsSnapshot;

describe("StatisticsHub analytics rendering", () => {
  function createQueryClient(snapshot: StatisticsSnapshot): QueryClient {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
          gcTime: Infinity,
        },
      },
    });
    client.setQueryData(["statistics-snapshot"], snapshot);
    return client;
  }

  beforeEach(() => {
    mockLoadStatisticsSnapshot.mockReset();
  });

  it("renders seeded TanStack Query data", async () => {
    const snapshot: StatisticsSnapshot = {
      cp: {
        totals: { budget: 2500, spent: 1450, earned: 450, net: -1000 },
        byJump: [
          {
            jumpId: "jump-1",
            title: "Arc One",
            status: "Gauntlet",
            budget: 1500,
            spent: 600,
            earned: 400,
            net: -200,
          },
          {
            jumpId: "jump-2",
            title: "World Two",
            status: "Completed",
            budget: 1000,
            spent: 850,
            earned: 50,
            net: -800,
          },
        ],
        byAssetType: [
          {
            assetType: "perk",
            itemCount: 4,
            gross: 1000,
            netCost: 900,
            credit: 0,
            discounted: 2,
            freebies: 1,
          },
          {
            assetType: "item",
            itemCount: 3,
            gross: 600,
            netCost: 550,
            credit: 0,
            discounted: 0,
            freebies: 0,
          },
          {
            assetType: "drawback",
            itemCount: 2,
            gross: 450,
            netCost: 0,
            credit: 450,
            discounted: 0,
            freebies: 0,
          },
        ],
      },
      inventory: {
        totalItems: 5,
        totalQuantity: 9,
        categories: [
          {
            category: "Weapons",
            itemCount: 4,
            totalQuantity: 8,
            warehouseCount: 3,
            lockerCount: 1,
          },
          {
            category: "Uncategorized",
            itemCount: 1,
            totalQuantity: 1,
            warehouseCount: 0,
            lockerCount: 1,
          },
        ],
      },
      gauntlet: {
        allowGauntlet: true,
        gauntletHalved: false,
        totalGauntlets: 2,
        completedGauntlets: 1,
        rows: [
          {
            jumpId: "jump-1",
            title: "Arc One",
            status: "Gauntlet",
            budget: 1500,
            spent: 600,
            earned: 400,
            progress: 0.4,
          },
          {
            jumpId: "jump-3",
            title: "Trial of Courage",
            status: "Gauntlet-Phase",
            budget: 1200,
            spent: 1300,
            earned: 200,
            progress: 1.0833,
          },
        ],
      },
      boosters: {
        totalCharacters: 3,
        charactersWithBoosters: 3,
        totalBoosters: 4,
        uniqueBoosters: 4,
        entries: [
          {
            booster: "Fire Core",
            count: 2,
            characters: [
              { id: "char-1", name: "Alicia Storm" },
              { id: "char-2", name: "Borin Flame" },
            ],
          },
          {
            booster: "Regeneration",
            count: 1,
            characters: [{ id: "char-1", name: "Alicia Storm" }],
          },
          {
            booster: "Shadow Blend",
            count: 1,
            characters: [{ id: "char-3", name: "Cara Shade" }],
          },
          {
            booster: "Speed Burst",
            count: 1,
            characters: [{ id: "char-2", name: "Borin Flame" }],
          },
        ],
      },
    };

    const queryClient = createQueryClient(snapshot);
    render(
      <QueryClientProvider client={queryClient}>
        <StatisticsHub />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Chain Analytics" })).toBeInTheDocument();
    expect(screen.getByText("Jumps Logged")).toBeInTheDocument();
    expect(screen.getAllByText("Arc One")[0]).toBeInTheDocument();
    expect(screen.getByText("Weapons")).toBeInTheDocument();
    expect(screen.getByText("Fire Core")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });
});
