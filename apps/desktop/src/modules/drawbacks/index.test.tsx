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
    listJumps: vi.fn(async () => [mockJump]),
    listJumpAssets: vi.fn(async () => mockDrawbacks),
    summarizeJumpBudget: vi.fn(async () => mockBudget),
    createJumpAsset: vi.fn<typeof actual.createJumpAsset>(),
    updateJumpAsset: vi.fn<typeof actual.updateJumpAsset>(),
    deleteJumpAsset: vi.fn<typeof actual.deleteJumpAsset>(),
    duplicateJump: vi.fn<typeof actual.duplicateJump>(),
    reorderJumpAssets: vi.fn<typeof actual.reorderJumpAssets>(async () => undefined),
  } satisfies DaoModule;
});

const { reorderJumpAssets } = await import("../../db/dao");
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
    queryClient.setQueryData(["jumps"], [mockJump]);
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

    const resetButton = screen.getByRole("button", { name: "Reset Order" });
    expect(resetButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Order" })).toBeDisabled();
  });
});

