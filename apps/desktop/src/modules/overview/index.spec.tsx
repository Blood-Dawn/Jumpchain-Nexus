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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import JumpchainOverview from "./index";

const daoMocks = vi.hoisted(() => ({
  mockListJumps: vi.fn(),
  mockSummarizeJumpBudget: vi.fn(),
  mockSetJumpStipendToggle: vi.fn(),
  mockCreateJump: vi.fn(),
  mockDeleteJump: vi.fn(),
  mockDuplicateJump: vi.fn(),
  mockReorderJumps: vi.fn(),
  mockLoadFormatterSettings: vi.fn(),
  mockLoadJumpDefaults: vi.fn(),
}));

vi.mock("../../db/dao", () => ({
  createJump: daoMocks.mockCreateJump,
  deleteJump: daoMocks.mockDeleteJump,
  duplicateJump: daoMocks.mockDuplicateJump,
  listJumps: daoMocks.mockListJumps,
  reorderJumps: daoMocks.mockReorderJumps,
  summarizeJumpBudget: daoMocks.mockSummarizeJumpBudget,
  setJumpStipendToggle: daoMocks.mockSetJumpStipendToggle,
  loadFormatterSettings: daoMocks.mockLoadFormatterSettings,
  loadJumpDefaults: daoMocks.mockLoadJumpDefaults,
}));

const {
  mockListJumps,
  mockSummarizeJumpBudget,
  mockSetJumpStipendToggle,
  mockCreateJump,
  mockDeleteJump,
  mockDuplicateJump,
  mockReorderJumps,
  mockLoadFormatterSettings,
  mockLoadJumpDefaults,
} = daoMocks;

type JumpBudgetSummary = import("../../db/dao").JumpBudgetSummary;
type JumpRecord = import("../../db/dao").JumpRecord;

describe("JumpchainOverview stipend adjustments", () => {
  let summaryState: JumpBudgetSummary;
  let jumpState: JumpRecord[];

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

  beforeEach(() => {
    summaryState = {
      totalCost: 400,
      discounted: 0,
      freebies: 0,
      netCost: 550,
      purchasesNetCost: 400,
      drawbackCredit: 200,
      balance: -250,
      stipendAdjustments: 100,
      stipendPotential: 250,
      stipendToggles: [
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
      ],
      companionImportCost: 150,
      companionImportSelections: [
        {
          id: "import-1",
          assetId: "asset-companion",
          assetName: "Companion B",
          companionName: "Alice",
          optionValue: 150,
          selected: true,
        },
      ],
    } as JumpBudgetSummary;

    jumpState = [
      {
        id: "jump-1",
        title: "Alpha Jump",
        world: "Gaia",
        start_date: null,
        end_date: null,
        status: "planned",
        created_at: "2025-01-01T00:00:00.000Z",
        sort_order: 0,
        cp_budget: 1000,
        cp_spent: summaryState.netCost,
        cp_income: summaryState.drawbackCredit + summaryState.stipendAdjustments,
      },
    ];

    mockListJumps.mockReset();
    mockSummarizeJumpBudget.mockReset();
    mockSetJumpStipendToggle.mockReset();
    mockCreateJump.mockReset();
    mockDeleteJump.mockReset();
    mockDuplicateJump.mockReset();
    mockReorderJumps.mockReset();
    mockLoadFormatterSettings.mockReset();
    mockLoadJumpDefaults.mockReset();

    mockListJumps.mockResolvedValue(jumpState);
    mockLoadFormatterSettings.mockResolvedValue({
      removeAllLineBreaks: false,
      leaveDoubleLineBreaks: false,
      thousandsSeparator: "none",
    });
    mockLoadJumpDefaults.mockResolvedValue({
      standardBudget: 1000,
      gauntletBudget: 1500,
      companionStipend: 0,
    });

    mockSummarizeJumpBudget.mockImplementation(async () =>
      JSON.parse(JSON.stringify(summaryState))
    );

    mockSetJumpStipendToggle.mockImplementation(async (_jumpId: string, assetId: string, enabled: boolean) => {
      const nextToggles = summaryState.stipendToggles.map((entry) =>
        entry.assetId === assetId ? { ...entry, enabled } : entry
      );
      const nextAdjustments = nextToggles.reduce((total, entry) => {
        return entry.enabled ? total + entry.amount : total;
      }, 0);
      summaryState = {
        ...summaryState,
        stipendToggles: nextToggles,
        stipendAdjustments: nextAdjustments,
        balance: summaryState.drawbackCredit + nextAdjustments - summaryState.netCost,
      };
      jumpState = jumpState.map((jump) =>
        jump.id === _jumpId
          ? {
              ...jump,
              cp_spent: summaryState.netCost,
              cp_income: summaryState.drawbackCredit + summaryState.stipendAdjustments,
            }
          : jump
      );
      mockListJumps.mockResolvedValue(jumpState);
    });
  });

  it("recomputes stipend totals when toggles change", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <JumpchainOverview />
      </QueryClientProvider>
    );

    const jumpHeading = await screen.findByRole("heading", { level: 3, name: "Alpha Jump" });
    fireEvent.click(jumpHeading.closest("button")!);

    await screen.findByText(/Stipend Sources/i);
    const adjustmentsRow = screen.getByText(/Stipend Adjustments:/i).parentElement;
    const balanceRow = screen.getByText(/Balance:/i).parentElement;
    expect(adjustmentsRow).toHaveTextContent("Stipend Adjustments: 100");
    expect(balanceRow).toHaveTextContent("Balance: -250");

    const stipendToggle = screen.getByLabelText("Perk A") as HTMLInputElement;
    expect(stipendToggle.checked).toBe(true);

    fireEvent.click(stipendToggle);

    await waitFor(() => {
      expect(screen.getByText(/Stipend Adjustments:/i).parentElement).toHaveTextContent(
        "Stipend Adjustments: 0"
      );
    });
    expect(screen.getByText(/Balance:/i).parentElement).toHaveTextContent("Balance: -350");
    expect(stipendToggle.checked).toBe(false);
    expect(mockSetJumpStipendToggle).toHaveBeenCalledWith("jump-1", "asset-perk", false);

    queryClient.clear();
  });
});
