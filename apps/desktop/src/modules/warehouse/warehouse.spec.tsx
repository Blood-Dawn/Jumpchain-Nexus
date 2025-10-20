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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CosmicWarehouse from "./index";

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

describe("CosmicWarehouse", () => {
  it("@smoke surfaces Personal Reality warnings when caps are exceeded", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["warehouse-items"], [
      {
        id: "item-1",
        scope: "warehouse",
        name: "Test Item",
        category: "Structures",
        quantity: 1,
        slot: null,
        notes: null,
        tags: null,
        jump_id: null,
        metadata: null,
        sort_order: 0,
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      },
    ]);
    queryClient.setQueryData(["jumps"], []);
    queryClient.setQueryData(["warehouse-mode"], { mode: "personal-reality" });
    queryClient.setQueryData(["category-presets"], { perkCategories: [], itemCategories: [] });
    queryClient.setQueryData(["warehouse-personal-reality"], {
      wpTotal: 15,
      wpCap: 10,
      wpBaseCap: 10,
      wpOverride: undefined,
      limits: [
        { key: "structures", label: "Structures", provided: 4, used: 6, baseProvided: 4, override: undefined },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CosmicWarehouse />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { level: 1, name: /cosmic warehouse/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Personal Reality Limits/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/override stipend cap/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/override quota/i)).toHaveLength(1);
    expect(screen.getByText(/Warehouse Points exceed stipend by 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Structures limit exceeded by 2/i)).toBeInTheDocument();

    queryClient.clear();
  });

  it("filters the visible list when tag chips are toggled", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["warehouse-items"], [
      {
        id: "item-1",
        scope: "warehouse",
        name: "Food Printer",
        category: "Utilities",
        quantity: 1,
        slot: null,
        notes: null,
        tags: "[\"Food\", \"Essential\"]",
        jump_id: null,
        metadata: null,
        sort_order: 0,
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "item-2",
        scope: "warehouse",
        name: "Temporal Anchor",
        category: "Utilities",
        quantity: 1,
        slot: null,
        notes: null,
        tags: "[\"Temporal\"]",
        jump_id: null,
        metadata: null,
        sort_order: 0,
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      },
    ]);
    queryClient.setQueryData(["jumps"], []);
    queryClient.setQueryData(["warehouse-mode"], { mode: "generic" });
    queryClient.setQueryData(["category-presets"], { perkCategories: [], itemCategories: [] });

    render(
      <QueryClientProvider client={queryClient}>
        <CosmicWarehouse />
      </QueryClientProvider>
    );

    const user = userEvent.setup();

    expect(screen.getByText("Food Printer")).toBeInTheDocument();
    expect(screen.getByText("Temporal Anchor")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Food" }));

    expect(screen.getByText("Food Printer")).toBeInTheDocument();
    expect(screen.queryByText("Temporal Anchor")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Food" }));

    expect(screen.getByText("Temporal Anchor")).toBeInTheDocument();

    queryClient.clear();
  });
});
