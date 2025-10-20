/*
MIT License

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
import { fireEvent, render, screen, within } from "@testing-library/react";

import StatisticsHub from "./index";
import type { StatisticsSnapshot } from "../../db/dao";

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

const snapshot: StatisticsSnapshot = {
  cp: {
    totals: { budget: 700, spent: 490, earned: 100, net: -390 },
    byJump: [
      { jumpId: "jump-1", title: "Alpha", status: "active", budget: 400, spent: 300, earned: 0, net: -300 },
      { jumpId: "jump-2", title: "Beta", status: "completed", budget: 200, spent: 150, earned: 100, net: -50 },
      { jumpId: "jump-3", title: "Gamma", status: "abandoned", budget: 100, spent: 40, earned: 0, net: -40 },
    ],
    byAssetType: [
      { assetType: "origin", itemCount: 1, gross: 100, netCost: 100, credit: 0, discounted: 0, freebies: 0 },
      { assetType: "perk", itemCount: 3, gross: 250, netCost: 200, credit: 0, discounted: 1, freebies: 0 },
      { assetType: "item", itemCount: 2, gross: 120, netCost: 80, credit: 0, discounted: 0, freebies: 1 },
      { assetType: "companion", itemCount: 1, gross: 150, netCost: 150, credit: 0, discounted: 0, freebies: 0 },
      { assetType: "drawback", itemCount: 1, gross: 0, netCost: 0, credit: 150, discounted: 0, freebies: 0 },
    ],
  },
  inventory: { totalItems: 0, totalQuantity: 0, categories: [] },
  gauntlet: { allowGauntlet: false, gauntletHalved: false, totalGauntlets: 0, completedGauntlets: 0, rows: [] },
  boosters: { totalCharacters: 0, charactersWithBoosters: 0, totalBoosters: 0, uniqueBoosters: 0, entries: [] },
};

describe("StatisticsHub filters", () => {
  it("filters asset breakdown by type and recomputes totals", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["statistics-snapshot"], snapshot);

    render(
      <QueryClientProvider client={queryClient}>
        <StatisticsHub />
      </QueryClientProvider>
    );

    const assetSelect = screen.getByLabelText(/Asset Type/i) as HTMLSelectElement;
    expect(assetSelect.value).toBe("all");

    fireEvent.change(assetSelect, { target: { value: "perk" } });

    const grid = screen.getByTestId("asset-breakdown-grid");
    const headings = within(grid)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent ?? "");
    expect(headings).toEqual(["Perks"]);
    expect(screen.getByText(/200 CP spent • 0 CP earned/i)).toBeInTheDocument();

    queryClient.clear();
  });

  it("filters jumps by status and updates virtualization counts", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["statistics-snapshot"], snapshot);

    render(
      <QueryClientProvider client={queryClient}>
        <StatisticsHub />
      </QueryClientProvider>
    );

    const statusSelect = screen.getByLabelText(/Jump Status/i) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "Completed" } });

    expect(screen.getByText(/1 jump • 150 CP spent • 100 CP earned/i)).toBeInTheDocument();

    const table = screen.getByTestId("cp-table");
    expect(table).toHaveAttribute("data-row-count", "1");
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();

    queryClient.clear();
  });
});
