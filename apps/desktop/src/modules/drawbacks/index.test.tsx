import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type JumpRecord = import("../../db/dao").JumpRecord;
type JumpAssetRecord = import("../../db/dao").JumpAssetRecord;
type JumpBudgetSummary = import("../../db/dao").JumpBudgetSummary;

type DaoModule = typeof import("../../db/dao");

const now = new Date().toISOString();

const mockJump: JumpRecord = {
  id: "jump-1",
  title: "Test Jump",
  world: null,
  start_date: null,
  end_date: null,
  status: null,
  created_at: now,
  sort_order: 0,
  cp_budget: 1000,
  cp_spent: 0,
  cp_income: 0,
};

const mockDrawbacks: JumpAssetRecord[] = [
  {
    id: "drawback-1",
    jump_id: "jump-1",
    asset_type: "drawback",
    name: "Drawback One",
    category: "Category A",
    subcategory: null,
    cost: 100,
    quantity: 1,
    discounted: 0,
    freebie: 0,
    notes: null,
    metadata: JSON.stringify({ severity: "minor" }),
    sort_order: 0,
    created_at: now,
    updated_at: now,
  },
  {
    id: "drawback-2",
    jump_id: "jump-1",
    asset_type: "drawback",
    name: "Drawback Two",
    category: "Category B",
    subcategory: null,
    cost: 200,
    quantity: 1,
    discounted: 0,
    freebie: 0,
    notes: null,
    metadata: JSON.stringify({ severity: "severe" }),
    sort_order: 1,
    created_at: now,
    updated_at: now,
  },
];

const secondJump: JumpRecord = {
  id: "jump-2",
  title: "Second Jump",
  world: null,
  start_date: null,
  end_date: null,
  status: null,
  created_at: now,
  sort_order: 1,
  cp_budget: 500,
  cp_spent: 0,
  cp_income: 0,
};

const secondJumpDrawbacks: JumpAssetRecord[] = [
  {
    id: "drawback-3",
    jump_id: "jump-2",
    asset_type: "drawback",
    name: "Gamma Drawback",
    category: "Category C",
    subcategory: null,
    cost: 150,
    quantity: 1,
    discounted: 0,
    freebie: 0,
    notes: null,
    metadata: JSON.stringify({ severity: "moderate" }),
    sort_order: 0,
    created_at: now,
    updated_at: now,
  },
  {
    id: "drawback-4",
    jump_id: "jump-2",
    asset_type: "drawback",
    name: "Delta Drawback",
    category: "Category D",
    subcategory: null,
    cost: 50,
    quantity: 1,
    discounted: 0,
    freebie: 0,
    notes: null,
    metadata: JSON.stringify({ severity: "minor" }),
    sort_order: 1,
    created_at: now,
    updated_at: now,
  },
];

const mockBudget: JumpBudgetSummary = {
  totalCost: 0,
  discounted: 0,
  freebies: 0,
  netCost: 0,
  drawbackCredit: 300,
  balance: 0,
};

vi.mock("../../db/dao", async (): Promise<DaoModule> => {
  const actual = await vi.importActual<DaoModule>("../../db/dao");
  const supplementSettings = {
    ...actual.DEFAULT_SUPPLEMENT_SETTINGS,
    enableDrawbackSupplement: true,
  };

  return {
    ...actual,
    loadSupplementSettings: vi.fn(async () => supplementSettings),
    listJumps: vi.fn(async () => [mockJump, secondJump]),
    listJumpAssets: vi.fn<typeof actual.listJumpAssets>(async (jumpId, assetType) => {
      expect(assetType).toBe("drawback");
      return jumpId === secondJump.id ? secondJumpDrawbacks : mockDrawbacks;
    }),
    summarizeJumpBudget: vi.fn<typeof actual.summarizeJumpBudget>(async () => mockBudget),
    createJumpAsset: vi.fn<typeof actual.createJumpAsset>(),
    updateJumpAsset: vi.fn<typeof actual.updateJumpAsset>(),
    deleteJumpAsset: vi.fn<typeof actual.deleteJumpAsset>(),
    duplicateJump: vi.fn<typeof actual.duplicateJump>(),
    reorderJumpAssets: vi.fn<typeof actual.reorderJumpAssets>(async () => undefined),
  } satisfies DaoModule;
});

const { reorderJumpAssets, summarizeJumpBudget, listJumpAssets } = await import("../../db/dao");
const { default: DrawbackSupplement } = await import("./index");

describe("DrawbackSupplement ordering", () => {
  const createClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reorders drawbacks locally and persists via the DAO when confirmed", async () => {
    const queryClient = createClient();
    queryClient.setQueryData(["supplement-settings"], {
      enableDrawbackSupplement: true,
    });
    queryClient.setQueryData(["jumps"], [mockJump, secondJump]);
    queryClient.setQueryData(["jump-drawbacks", mockJump.id], mockDrawbacks);
    queryClient.setQueryData(["jump-budget", mockJump.id], mockBudget);

    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <DrawbackSupplement />
      </QueryClientProvider>
    );

    const list = await screen.findByRole("list", { name: /drawback order/i });

    await waitFor(() => {
      expect(within(list).queryAllByRole("listitem").length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(listJumpAssets).toHaveBeenCalledWith(mockJump.id, "drawback");
    });

    const initialBudgetCalls = summarizeJumpBudget.mock.calls.length;

    const initialItems = within(list).queryAllByRole("listitem");
    expect(initialItems.length).toBe(2);
    const names = initialItems.map((item) => within(item).getByText(/Drawback/).textContent?.trim());
    expect(names).toEqual(["Drawback One", "Drawback Two"]);

    await user.click(screen.getByRole("button", { name: "Move Drawback One later" }));

    await waitFor(() => {
      const reordered = within(list)
        .queryAllByRole("listitem")
        .map((item) => within(item).getByText(/Drawback/).textContent?.trim());
      expect(reordered).toEqual(["Drawback Two", "Drawback One"]);
    });

    const saveButton = screen.getByRole("button", { name: "Save Order" });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    await waitFor(() => {
      expect(reorderJumpAssets).toHaveBeenCalledTimes(1);
    });

    expect(reorderJumpAssets).toHaveBeenCalledWith("jump-1", "drawback", [
      "drawback-2",
      "drawback-1",
    ]);

    await waitFor(() => {
      expect(summarizeJumpBudget.mock.calls.length).toBeGreaterThan(initialBudgetCalls);
    });

    const resetButton = screen.getByRole("button", { name: "Reset Order" });
    expect(resetButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Order" })).toBeDisabled();
  });

  it("resets the local order when switching between jumps", async () => {
    const queryClient = createClient();
    queryClient.setQueryData(["supplement-settings"], {
      enableDrawbackSupplement: true,
    });
    queryClient.setQueryData(["jumps"], [mockJump, secondJump]);
    queryClient.setQueryData(["jump-drawbacks", mockJump.id], mockDrawbacks);
    queryClient.setQueryData(["jump-drawbacks", secondJump.id], secondJumpDrawbacks);
    queryClient.setQueryData(["jump-budget", mockJump.id], mockBudget);
    queryClient.setQueryData(["jump-budget", secondJump.id], mockBudget);

    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <DrawbackSupplement />
      </QueryClientProvider>
    );

    const list = await screen.findByRole("list", { name: /drawback order/i });

    await waitFor(() => {
      expect(within(list).queryAllByRole("listitem").length).toBe(2);
    });

    const items = within(list).queryAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Drawback One");

    await user.click(screen.getByRole("button", { name: "Move Drawback One later" }));

    await waitFor(() => {
      const reordered = within(list)
        .queryAllByRole("listitem")
        .map((item) => within(item).getByText(/Drawback/).textContent?.trim());
      expect(reordered).toEqual(["Drawback Two", "Drawback One"]);
    });

    const jumpSelect = screen.getByLabelText("Active Jump");
    await user.selectOptions(jumpSelect, secondJump.id);

    await waitFor(() => {
      expect(listJumpAssets).toHaveBeenCalledWith(secondJump.id, "drawback");
    });

    await waitFor(() => {
      const secondItems = within(list).queryAllByRole("listitem");
      expect(secondItems[0]).toHaveTextContent("Gamma Drawback");
    });

    await user.selectOptions(jumpSelect, mockJump.id);

    await waitFor(() => {
      const firstItems = within(list).queryAllByRole("listitem");
      expect(firstItems[0]).toHaveTextContent("Drawback One");
    });
  });
});

