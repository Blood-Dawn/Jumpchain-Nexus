import React from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type DaoModule = typeof import("../../db/dao");
type InventoryItemRecord = import("../../db/dao").InventoryItemRecord;

type CosmicLockerModule = typeof import("./index");

const now = new Date().toISOString();

const createInventoryItem = (overrides: Partial<InventoryItemRecord>): InventoryItemRecord => ({
  id: "locker-item",
  scope: "locker",
  name: "Sample",
  category: "General",
  quantity: 1,
  slot: null,
  notes: null,
  tags: null,
  jump_id: null,
  metadata: null,
  sort_order: 0,
  created_at: now,
  updated_at: now,
  ...overrides,
});

const mockItems: InventoryItemRecord[] = [
  createInventoryItem({
    id: "medkit",
    name: "Medical Kit",
    category: "Medical",
    tags: JSON.stringify(["medical", "support"]),
    metadata: JSON.stringify({ packed: false, priority: "standard" }),
  }),
  createInventoryItem({
    id: "field-dressing",
    name: "Field Dressing",
    category: "Medical",
    tags: JSON.stringify(["medical", "emergency"]),
    metadata: JSON.stringify({ packed: false, priority: "essential" }),
  }),
  createInventoryItem({
    id: "supply-crate",
    name: "Supply Crate",
    category: "Logistics",
    tags: JSON.stringify(["logistics", "support"]),
    metadata: JSON.stringify({ packed: true, priority: "luxury" }),
  }),
];

vi.mock("../../db/dao", async () => {
  const actual = await vi.importActual<DaoModule>("../../db/dao");
  return {
    ...actual,
    listInventoryItems: vi.fn(async () => mockItems),
    loadSupplementSettings: vi.fn(async () => actual.DEFAULT_SUPPLEMENT_SETTINGS),
    createInventoryItem: vi.fn<typeof actual.createInventoryItem>(),
    updateInventoryItem: vi.fn<typeof actual.updateInventoryItem>(),
    deleteInventoryItem: vi.fn<typeof actual.deleteInventoryItem>(),
    moveInventoryItem: vi.fn<typeof actual.moveInventoryItem>(),
  } satisfies DaoModule;
});

const cosmicLockerModule = (await import("./index")) as CosmicLockerModule;
const { default: CosmicLocker } = cosmicLockerModule;

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("CosmicLocker tag filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("combines category search and tag chips", async () => {
    const user = userEvent.setup();
    const queryClient = createClient();

    render(
      <QueryClientProvider client={queryClient}>
        <CosmicLocker />
      </QueryClientProvider>
    );

    const list = await screen.findByRole("list", { name: "Locker items" });

    await waitFor(() => {
      expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    });

    const search = screen.getByPlaceholderText("Search locker");
    await user.type(search, "Medical");

    await waitFor(() => {
      expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    });

    await user.click(screen.getByRole("button", { name: "Support" }));

    await waitFor(() => {
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(1);
      expect(within(items[0]).getByRole("button", { name: /Medical Kit/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Support" }));

    await waitFor(() => {
      expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    });

    await user.click(screen.getByRole("button", { name: "Emergency" }));

    await waitFor(() => {
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(1);
      expect(within(items[0]).getByRole("button", { name: /Field Dressing/ })).toBeInTheDocument();
    });
  });

  it("requires items to include all selected tags", async () => {
    const user = userEvent.setup();
    const queryClient = createClient();

    render(
      <QueryClientProvider client={queryClient}>
        <CosmicLocker />
      </QueryClientProvider>
    );

    const list = await screen.findByRole("list", { name: "Locker items" });

    await waitFor(() => {
      expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    });

    await user.click(screen.getByRole("button", { name: "Support" }));

    await waitFor(() => {
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(2);
    });

    await user.click(screen.getByRole("button", { name: "Medical" }));

    await waitFor(() => {
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(1);
      expect(within(items[0]).getByRole("button", { name: /Medical Kit/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Emergency" }));

    await waitFor(() => {
      expect(within(list).queryAllByRole("listitem")).toHaveLength(0);
    });

    await user.click(screen.getByRole("button", { name: "All" }));

    await waitFor(() => {
      expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    });
  });
});
