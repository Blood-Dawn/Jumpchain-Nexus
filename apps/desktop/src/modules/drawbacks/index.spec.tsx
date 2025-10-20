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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DrawbackSupplement from "./index";
import { FORMATTER_PREFERENCES_QUERY_KEY } from "../../hooks/useFormatterPreferences";

vi.mock("../../db/dao", () => {
  const DEFAULT_SUPPLEMENT_SETTINGS = {
    enableDrawbackSupplement: true,
    enableUniversalDrawbacks: false,
    enableEssentialBodyMod: true,
    allowCompanionBodyMod: true,
  } as const;

  const DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS = {
    totalCP: 0,
    companionCP: 0,
    itemCP: 0,
    warehouseWP: 0,
    allowGauntlet: false,
    gauntletHalved: false,
  } as const;

  return {
    DEFAULT_SUPPLEMENT_SETTINGS,
    DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS,
    loadSupplementSettings: vi.fn(),
    listJumps: vi.fn(),
    listJumpAssets: vi.fn(),
    summarizeJumpBudget: vi.fn(),
    loadUniversalDrawbackSettings: vi.fn(),
    loadFormatterSettings: vi.fn(),
    createJumpAsset: vi.fn(),
    deleteJumpAsset: vi.fn(),
    duplicateJump: vi.fn(),
    updateJumpAsset: vi.fn(),
  };
});

import {
  DEFAULT_SUPPLEMENT_SETTINGS,
  DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS,
  loadSupplementSettings,
  listJumps,
  listJumpAssets,
  summarizeJumpBudget,
  loadUniversalDrawbackSettings,
  loadFormatterSettings,
  type JumpAssetRecord,
  type JumpBudgetSummary,
  type JumpRecord,
} from "../../db/dao";

const ISO_ZERO = new Date(2020, 0, 1).toISOString();

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

function buildJump(overrides: Partial<JumpRecord> = {}): JumpRecord {
  return {
    id: "jump-1",
    title: "Test Jump",
    world: null,
    start_date: null,
    end_date: null,
    status: "Standard",
    created_at: ISO_ZERO,
    sort_order: 0,
    cp_budget: 1000,
    cp_spent: 0,
    cp_income: 0,
    ...overrides,
  };
}

function buildDrawback(overrides: Partial<JumpAssetRecord> = {}): JumpAssetRecord {
  return {
    id: "drawback-1",
    jump_id: "jump-1",
    asset_type: "drawback",
    name: "Test Drawback",
    category: null,
    subcategory: null,
    cost: 100,
    quantity: 1,
    discounted: 0,
    freebie: 0,
    notes: null,
    metadata: null,
    sort_order: 0,
    created_at: ISO_ZERO,
    updated_at: ISO_ZERO,
    ...overrides,
  };
}

function buildBudget(overrides: Partial<JumpBudgetSummary> = {}): JumpBudgetSummary {
  return {
    totalCost: 0,
    discounted: 0,
    freebies: 0,
    netCost: 0,
    drawbackCredit: 0,
    balance: 0,
    ...overrides,
  };
}

async function renderDrawbackSupplement(options: {
  supplements?: Partial<typeof DEFAULT_SUPPLEMENT_SETTINGS>;
  universal?: Partial<typeof DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS>;
  jumps?: JumpRecord[];
  assets?: JumpAssetRecord[];
  budget?: Partial<JumpBudgetSummary>;
  thousandsSeparator?: "none" | "comma" | "period" | "space";
} = {}): Promise<QueryClient> {
  const supplements = {
    ...DEFAULT_SUPPLEMENT_SETTINGS,
    ...options.supplements,
  };
  const universal = {
    ...DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS,
    ...options.universal,
  };
  const jumps = options.jumps ?? [buildJump()];
  const assets = options.assets ?? [];
  const budget = buildBudget(options.budget);
  const formatter = {
    removeAllLineBreaks: false,
    leaveDoubleLineBreaks: false,
    thousandsSeparator: options.thousandsSeparator ?? "comma",
    spellcheckEnabled: true,
  } as const;

  loadSupplementSettings.mockResolvedValue(supplements);
  loadUniversalDrawbackSettings.mockResolvedValue(universal);
  loadFormatterSettings.mockResolvedValue(formatter);
  listJumps.mockResolvedValue(jumps);
  listJumpAssets.mockResolvedValue(assets);
  summarizeJumpBudget.mockResolvedValue(budget);

  const queryClient = createTestQueryClient();
  const firstJumpId = jumps[0]?.id ?? "jump-1";
  queryClient.setQueryData(["supplement-settings"], supplements);
  queryClient.setQueryData(FORMATTER_PREFERENCES_QUERY_KEY, formatter);
  queryClient.setQueryData(["jumps"], jumps);
  queryClient.setQueryData(["jump-drawbacks", firstJumpId], assets);
  queryClient.setQueryData(["jump-budget", firstJumpId], budget);
  if (supplements.enableUniversalDrawbacks) {
    queryClient.setQueryData(["universal-drawbacks"], universal);
  }

  render(
    <QueryClientProvider client={queryClient}>
      <DrawbackSupplement />
    </QueryClientProvider>
  );

  await screen.findByTestId("total-credit");
  return queryClient;
}

describe("DrawbackSupplement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enforces Universal Drawback gauntlet restrictions", async () => {
    await renderDrawbackSupplement({
      supplements: { enableUniversalDrawbacks: true },
      universal: { totalCP: 400, allowGauntlet: false },
      jumps: [buildJump({ status: "Gauntlet" })],
    });

    expect(screen.getByTestId("reward-jumper")).toHaveTextContent("0");
    expect(screen.getByText(/gauntlet stipends disabled/i)).toBeInTheDocument();
    expect(screen.getByTestId("total-credit")).toHaveTextContent("0");
  });

  it("grants automatic jumper credit when Universal Drawbacks apply", async () => {
    await renderDrawbackSupplement({
      supplements: { enableUniversalDrawbacks: true },
      universal: { totalCP: 400, allowGauntlet: true },
      jumps: [buildJump({ status: "Standard" })],
      assets: [buildDrawback({ cost: 100 })],
      budget: { drawbackCredit: 100, balance: 100 },
    });

    expect(screen.getByTestId("reward-jumper")).toHaveTextContent("400");
    expect(screen.getByTestId("manual-credit")).toHaveTextContent("100");
    expect(screen.getByTestId("total-credit")).toHaveTextContent("500");
    expect(screen.getByTestId("balance-with-grants")).toHaveTextContent("500");
  });

  it("halves Universal Drawback rewards for gauntlets when configured", async () => {
    await renderDrawbackSupplement({
      supplements: { enableUniversalDrawbacks: true },
      universal: {
        totalCP: 1250,
        companionCP: 600,
        itemCP: 300,
        warehouseWP: 75,
        allowGauntlet: true,
        gauntletHalved: true,
      },
      jumps: [buildJump({ status: "Gauntlet" })],
    });

    expect(screen.getByTestId("reward-jumper")).toHaveTextContent("625");
    expect(screen.getByTestId("reward-companion")).toHaveTextContent("300");
    expect(screen.getByTestId("reward-item")).toHaveTextContent("150");
    expect(screen.getByTestId("reward-warehouse")).toHaveTextContent("37");
    expect(screen.getByText(/halved per universal drawback options/i)).toBeInTheDocument();
    expect(screen.getByTestId("total-credit")).toHaveTextContent("625");
  });

  it("filters drawbacks by category and severity before rendering", async () => {
    await renderDrawbackSupplement({
      assets: [
        buildDrawback({
          id: "drawback-1",
          name: "Combat Clause",
          category: "Combat",
          cost: 150,
          metadata: JSON.stringify({ severity: "moderate" }),
        }),
        buildDrawback({
          id: "drawback-2",
          name: "House Emergency",
          category: null,
          cost: 200,
          quantity: 2,
          metadata: JSON.stringify({ severity: "severe", houseRule: true }),
        }),
        buildDrawback({
          id: "drawback-3",
          name: "House Minor",
          category: null,
          cost: 75,
          metadata: JSON.stringify({ severity: "minor", houseRule: true }),
        }),
      ],
      budget: { balance: 625, drawbackCredit: 400 },
    });

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Filter by category"), "house");
    await user.click(screen.getByRole("button", { name: "Severe" }));

    const list = screen.getByRole("list", { name: /drawback order/i });
    const visibleItems = within(list).getAllByRole("listitem");
    expect(visibleItems).toHaveLength(1);
    expect(within(visibleItems[0]).getByText("House Emergency")).toBeInTheDocument();

    expect(screen.getByTestId("total-credit")).toHaveTextContent("400");
    expect(screen.getByTestId("manual-credit")).toHaveTextContent("400");
    expect(screen.getByTestId("balance-with-grants")).toHaveTextContent("625");
    const visibleSummary = screen.getByText(/Visible Drawbacks/i).parentElement?.querySelector("span");
    expect(visibleSummary).toHaveTextContent("1 / 3");
  });
});
