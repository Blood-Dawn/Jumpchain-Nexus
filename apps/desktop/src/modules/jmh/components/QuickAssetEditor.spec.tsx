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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickAssetEditor } from "./QuickAssetEditor";
import type { JumpAssetRecord } from "../../../db/dao";

const daoMocks = vi.hoisted(() => ({
  listJumpAssets: vi.fn(),
  createJumpAsset: vi.fn(),
  updateJumpAsset: vi.fn(),
  deleteJumpAsset: vi.fn(),
  reorderJumpAssets: vi.fn(),
}));

vi.mock("../../../db/dao", async () => {
  const actual = await vi.importActual<typeof import("../../../db/dao")>("../../../db/dao");
  return {
    ...actual,
    ...daoMocks,
  };
});

const { listJumpAssets, createJumpAsset, updateJumpAsset, deleteJumpAsset, reorderJumpAssets } = daoMocks;

const baseAsset: JumpAssetRecord = {
  id: "asset-1",
  jump_id: "jump-1",
  asset_type: "origin",
  name: "Starter Origin",
  category: null,
  subcategory: null,
  cost: 100,
  quantity: 1,
  discounted: 0,
  freebie: 0,
  notes: null,
  metadata: JSON.stringify({
    attributes: [{ key: "Strength", value: "+2" }],
  }),
  sort_order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const renderComponent = async (options?: { assets?: JumpAssetRecord[] }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });

  const user = userEvent.setup();
  const assets = options?.assets ?? [baseAsset];
  listJumpAssets.mockResolvedValueOnce(assets);
  render(
    <QueryClientProvider client={queryClient}>
      <QuickAssetEditor
        jumpId="jump-1"
        title="Origins"
        assetTypes={["origin"]}
        enabled
        formatCurrency={(value) => `${value} CP`}
      />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(listJumpAssets).toHaveBeenCalled());
  return { user, queryClient };
};

const extractMetadata = (value: unknown) => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return JSON.parse(value) as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
};

describe("QuickAssetEditor", () => {
  beforeEach(() => {
    listJumpAssets.mockReset();
    createJumpAsset.mockReset();
    updateJumpAsset.mockReset();
    deleteJumpAsset.mockReset();
    reorderJumpAssets.mockReset();
    listJumpAssets.mockResolvedValue([baseAsset]);
  });

  it("saves edited asset details with trait tags and stipend metadata", async () => {
    const updatedAsset: JumpAssetRecord = {
      ...baseAsset,
      name: "Updated Origin",
      category: "Test",
      subcategory: "Binder",
      cost: 125,
      quantity: 2,
      discounted: 1,
      freebie: 0,
      notes: "Prepared in tests",
      metadata: JSON.stringify({
        traitTags: ["Arcane"],
        stipend: {
          base: 50,
          frequency: "monthly",
          periods: 3,
          total: 150,
        },
      }),
      updated_at: new Date().toISOString(),
    };

    updateJumpAsset.mockImplementation(async (_id: string, updates: Record<string, unknown>) => {
      const metadata = typeof updates.metadata === "string" ? updates.metadata : JSON.stringify(updates.metadata);
      return {
        ...updatedAsset,
        ...updates,
        discounted: updates.discounted ? 1 : 0,
        freebie: updates.freebie ? 1 : 0,
        metadata: metadata ?? updatedAsset.metadata,
        updated_at: new Date().toISOString(),
      };
    });

    const { user } = await renderComponent();

    const nameInput = await screen.findByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Origin");

    await user.type(screen.getByLabelText("Category"), "Test");
    await user.type(screen.getByLabelText("Slot / Location"), "Binder");
    await user.clear(screen.getByLabelText("Cost"));
    await user.type(screen.getByLabelText("Cost"), "125");
    await user.clear(screen.getByLabelText("Quantity"));
    await user.type(screen.getByLabelText("Quantity"), "2");
    await user.click(screen.getByLabelText("Discounted"));

    const attributeKeyInputs = await screen.findAllByLabelText("Attribute Key");
    expect(attributeKeyInputs[0]).toHaveValue("Strength");
    const attributeValueInputs = screen.getAllByLabelText("Attribute Value");
    await user.clear(attributeValueInputs[0]);
    await user.type(attributeValueInputs[0], "+4");

    await user.click(screen.getByTestId("quick-asset-attribute-add"));
    let keys = screen.getAllByLabelText("Attribute Key");
    let values = screen.getAllByLabelText("Attribute Value");
    const secondIndex = keys.length - 1;
    await user.type(keys[secondIndex], "Dexterity");
    await user.type(values[secondIndex], "+1");

    await user.click(screen.getByTestId("quick-asset-attribute-add"));
    keys = screen.getAllByLabelText("Attribute Key");
    values = screen.getAllByLabelText("Attribute Value");
    const thirdIndex = keys.length - 1;
    await user.type(keys[thirdIndex], "Wisdom");
    await user.type(values[thirdIndex], "+3");

    await user.click(screen.getByRole("button", { name: "Remove attribute 2" }));

    keys = screen.getAllByLabelText("Attribute Key");
    values = screen.getAllByLabelText("Attribute Value");
    expect(keys).toHaveLength(2);
    expect(values).toHaveLength(2);
    expect(keys[0]).toHaveValue("Strength");
    expect(values[0]).toHaveValue("+4");
    expect(keys[1]).toHaveValue("Wisdom");
    expect(values[1]).toHaveValue("+3");

    await user.type(screen.getByTestId("quick-asset-tag-input"), "Arcane");
    await user.keyboard("{Enter}");

    fireEvent.change(screen.getByLabelText("Base CP"), { target: { value: "50" } });
    await user.selectOptions(screen.getByLabelText("Frequency"), "monthly");
    fireEvent.change(screen.getByLabelText("Periods"), { target: { value: "3" } });
    const [stipendNotesField, generalNotesField] = screen.getAllByLabelText("Notes");
    await user.type(stipendNotesField, "Monthly payment");
    await user.type(generalNotesField, "Prepared in tests");

    await user.click(screen.getByTestId("quick-asset-save"));

    await waitFor(() => expect(updateJumpAsset).toHaveBeenCalled());
    const payload = updateJumpAsset.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toBeTruthy();
    const metadataValue = payload.metadata as string | Record<string, unknown>;
    const metadata = typeof metadataValue === "string" ? JSON.parse(metadataValue) : metadataValue;
    expect(metadata.traitTags).toContain("Arcane");
    expect(metadata.stipend?.base).toBe(50);
    expect(metadata.stipend?.periods).toBe(3);
    expect(metadata.stipend?.total).toBe(150);
    expect(metadata.attributes).toEqual([
      { key: "Strength", value: "+4" },
      { key: "Wisdom", value: "+3" },
    ]);
    expect(payload.discounted).toBe(true);
    expect(screen.getByText("Saved.")).toBeInTheDocument();
  });

  it("creates a new asset when none exist", async () => {
    listJumpAssets.mockResolvedValueOnce([]);
    createJumpAsset.mockResolvedValue({
      ...baseAsset,
      id: "asset-2",
      name: "New Origin",
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <QuickAssetEditor jumpId="jump-1" title="Origins" assetTypes={["origin"]} enabled />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(listJumpAssets).toHaveBeenCalled());
    const addButton = await screen.findByTestId("quick-asset-add");
    fireEvent.click(addButton);
    await waitFor(() => expect(createJumpAsset).toHaveBeenCalled());
  });

  describe("alternate forms", () => {
    it("updates existing alt forms and serializes metadata", async () => {
      const assetWithAltForms: JumpAssetRecord = {
        ...baseAsset,
        metadata: JSON.stringify({ altForms: [{ name: "Battle Mode", summary: "Combat stance" }] }),
      };

      let queryClientRef: QueryClient | null = null;
      updateJumpAsset.mockImplementation(async (_id: string, updates: Record<string, unknown>) => {
        const { metadata, ...rest } = updates;
        const serialized =
          metadata === undefined ? undefined : metadata === null ? null : JSON.stringify(metadata);
        if (queryClientRef) {
          const cached = queryClientRef.getQueryData<JumpAssetRecord[]>(["jump-assets", "jump-1"]);
          if (serialized !== undefined) {
            expect(cached?.[0]?.metadata).toBe(serialized);
          }
        }
        return {
          ...assetWithAltForms,
          ...(rest as Partial<JumpAssetRecord>),
          metadata: serialized ?? assetWithAltForms.metadata,
          updated_at: new Date().toISOString(),
        } satisfies JumpAssetRecord;
      });

      const { user, queryClient } = await renderComponent({ assets: [assetWithAltForms] });
      queryClientRef = queryClient;

      const nameField = await screen.findByLabelText("Alt Form 1 Name");
      await user.clear(nameField);
      await user.type(nameField, "Battle Mode Prime");

      const summaryField = screen.getByLabelText("Alt Form 1 Summary");
      await user.clear(summaryField);
      await user.type(summaryField, "Combat stance upgraded");

      await user.click(screen.getByTestId("quick-asset-save"));

      await waitFor(() => expect(updateJumpAsset).toHaveBeenCalled());
      const payload = updateJumpAsset.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(extractMetadata(payload.metadata)).toMatchInlineSnapshot(`
        {
          "altForms": [
            {
              "name": "Battle Mode Prime",
              "summary": "Combat stance upgraded",
            },
          ],
        }
      `);
    });

    it("adds new alt forms", async () => {
      const assetWithoutAltForms: JumpAssetRecord = { ...baseAsset, metadata: null };
      let queryClientRef: QueryClient | null = null;

      updateJumpAsset.mockImplementation(async (_id: string, updates: Record<string, unknown>) => {
        const { metadata, ...rest } = updates;
        const serialized =
          metadata === undefined ? undefined : metadata === null ? null : JSON.stringify(metadata);
        if (queryClientRef) {
          const cached = queryClientRef.getQueryData<JumpAssetRecord[]>(["jump-assets", "jump-1"]);
          if (serialized !== undefined) {
            expect(cached?.[0]?.metadata).toBe(serialized);
          }
        }
        return {
          ...assetWithoutAltForms,
          ...(rest as Partial<JumpAssetRecord>),
          metadata: serialized ?? assetWithoutAltForms.metadata,
          updated_at: new Date().toISOString(),
        } satisfies JumpAssetRecord;
      });

      const { user, queryClient } = await renderComponent({ assets: [assetWithoutAltForms] });
      queryClientRef = queryClient;

      const addButton = await screen.findByRole("button", { name: /Add Alternate Form/i });
      await user.click(addButton);

      const nameField = await screen.findByLabelText("Alt Form 1 Name");
      await user.type(nameField, "Titan Form");

      const summaryField = screen.getByLabelText("Alt Form 1 Summary");
      await user.type(summaryField, "Colossal battle avatar");

      await user.click(screen.getByTestId("quick-asset-save"));

      await waitFor(() => expect(updateJumpAsset).toHaveBeenCalled());
      const payload = updateJumpAsset.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(extractMetadata(payload.metadata)).toMatchInlineSnapshot(`
        {
          "altForms": [
            {
              "name": "Titan Form",
              "summary": "Colossal battle avatar",
            },
          ],
        }
      `);
    });

    it("removes alt forms and clears metadata", async () => {
      const assetWithAltForms: JumpAssetRecord = {
        ...baseAsset,
        metadata: JSON.stringify({ altForms: [{ name: "Battle Mode", summary: "Combat stance" }] }),
      };

      let queryClientRef: QueryClient | null = null;
      updateJumpAsset.mockImplementation(async (_id: string, updates: Record<string, unknown>) => {
        const { metadata, ...rest } = updates;
        const serialized =
          metadata === undefined ? undefined : metadata === null ? null : JSON.stringify(metadata);
        if (queryClientRef) {
          const cached = queryClientRef.getQueryData<JumpAssetRecord[]>(["jump-assets", "jump-1"]);
          if (serialized !== undefined) {
            expect(cached?.[0]?.metadata).toBe(serialized);
          }
        }
        return {
          ...assetWithAltForms,
          ...(rest as Partial<JumpAssetRecord>),
          metadata: serialized ?? assetWithAltForms.metadata,
          updated_at: new Date().toISOString(),
        } satisfies JumpAssetRecord;
      });

      const { user, queryClient } = await renderComponent({ assets: [assetWithAltForms] });
      queryClientRef = queryClient;

      const removeButton = await screen.findByRole("button", { name: "Remove Alt Form 1" });
      await user.click(removeButton);
      await waitFor(() => expect(screen.getByText("No alternate forms yet.")).toBeInTheDocument());

      await user.click(screen.getByTestId("quick-asset-save"));

      await waitFor(() => expect(updateJumpAsset).toHaveBeenCalled());
      const payload = updateJumpAsset.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(payload.metadata).toMatchInlineSnapshot(`null`);
    });
  });
});
