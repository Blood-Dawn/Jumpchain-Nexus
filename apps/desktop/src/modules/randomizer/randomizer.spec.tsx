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

import { vi } from "vitest";

let listsData: unknown[] = [];
let groupsData: unknown[] = [];
let entriesDataForQuery: unknown[] = [];
let historyDataForQuery: unknown[] = [];

const reactQueryMock = vi.hoisted(() => {
  const React = require("react");
  const useQuery = ({ queryKey }) => {
    const [, key] = queryKey;
    if (key === "lists") {
      return { data: listsData };
    }
    if (key === "groups") {
      return { data: groupsData };
    }
    if (key === "entries") {
      return { data: entriesDataForQuery };
    }
    if (key === "history") {
      return { data: historyDataForQuery };
    }
    return { data: undefined };
  };
  const useMutation = ({ mutationFn, onSuccess }) => ({
    isPending: false,
    mutate: (payload) => {
      Promise.resolve(mutationFn(payload)).then((result) => onSuccess?.(result, payload));
    },
    mutateAsync: async (payload) => {
      const result = await mutationFn(payload);
      await onSuccess?.(result, payload);
      return result;
    },
  });
  const useQueryClient = () => ({
    invalidateQueries: () => Promise.resolve(),
  });
  const QueryClientProvider = ({ children }) => <>{children}</>;
  return { useQuery, useMutation, useQueryClient, QueryClientProvider };
});

vi.mock("@tanstack/react-query", () => reactQueryMock);

import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import * as dao from "../../db/dao";
import type {
  RandomizerEntryRecord,
  RandomizerGroupRecord,
  RandomizerListRecord,
  RandomizerRollRecord,
} from "../../db/dao";
import JumpRandomizer from "./index";

const baseList: RandomizerListRecord = {
  id: "list-1",
  name: "Test List",
  description: null,
  sort_order: 0,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

const baseGroup: RandomizerGroupRecord = {
  id: "group-1",
  list_id: baseList.id,
  name: "Default Group",
  sort_order: 0,
  filters: {},
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

const initialEntries: RandomizerEntryRecord[] = [
  {
    id: "entry-1",
    list_id: baseList.id,
    group_id: baseGroup.id,
    group_name: baseGroup.name,
    name: "Alpha Entry",
    weight: 5,
    link: null,
    tags: ["alpha"],
    filters: {},
    sort_order: 0,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "entry-2",
    list_id: baseList.id,
    group_id: baseGroup.id,
    group_name: baseGroup.name,
    name: "Beta Entry",
    weight: 3,
    link: "https://example.com/beta",
    tags: ["beta"],
    filters: {},
    sort_order: 1,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  },
];

let entriesData: RandomizerEntryRecord[] = [...initialEntries];
let historyData: RandomizerRollRecord[] = [];

describe("JumpRandomizer", () => {
  beforeEach(() => {
    entriesData = [...initialEntries];
    historyData = [];
    listsData = [baseList];
    groupsData = [baseGroup];
    entriesDataForQuery = entriesData;
    historyDataForQuery = historyData;
    vi.restoreAllMocks();
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }

    vi.spyOn(dao, "listRandomizerLists").mockResolvedValue([baseList]);
    vi.spyOn(dao, "listRandomizerGroups").mockResolvedValue([baseGroup]);
    vi.spyOn(dao, "listRandomizerEntriesForList").mockImplementation(async () => entriesData);
    vi.spyOn(dao, "listRandomizerRolls").mockImplementation(async () => historyData);
    vi.spyOn(dao, "recordRandomizerRoll").mockImplementation(async (input) => {
      const rollId = `roll-${historyData.length + 1}`;
      const createdAt = `2024-01-02T00:00:0${historyData.length}Z`;
      const picks = input.picks.map((pick, index) => ({
        id: `pick-${historyData.length + 1}-${index + 1}`,
        roll_id: rollId,
        entry_id: pick.entryId,
        position: index + 1,
        name: pick.name,
        weight: pick.weight,
        link: pick.link ?? null,
        tags: pick.tags ?? [],
      }));
      const record: RandomizerRollRecord = {
        id: rollId,
        list_id: input.listId,
        seed: input.seed ?? null,
        params: input.params ?? {},
        created_at: createdAt,
        picks,
      };
      historyData = [record, ...historyData];
      historyDataForQuery = historyData;
      return record;
    });
    vi.spyOn(dao, "clearRandomizerRolls").mockResolvedValue(undefined);

    vi.spyOn(dao, "createRandomizerList").mockResolvedValue(baseList);
    vi.spyOn(dao, "updateRandomizerList").mockResolvedValue(baseList);
    vi.spyOn(dao, "deleteRandomizerList").mockResolvedValue(undefined);
    vi.spyOn(dao, "createRandomizerGroup").mockResolvedValue(baseGroup);
    vi.spyOn(dao, "updateRandomizerGroup").mockResolvedValue(baseGroup);
    vi.spyOn(dao, "deleteRandomizerGroup").mockResolvedValue(undefined);
    vi.spyOn(dao, "createRandomizerEntry").mockImplementation(async () => entriesData[0]!);
    vi.spyOn(dao, "updateRandomizerEntry").mockImplementation(async () => entriesData[0]!);
    vi.spyOn(dao, "deleteRandomizerEntry").mockResolvedValue(undefined);
  });

  const renderRandomizer = () => {
    const view = render(
      <QueryClientProvider>
        <JumpRandomizer />
      </QueryClientProvider>
    );
    const user = userEvent.setup();
    return { user, ...view };
  };

  it("records draws and displays the persisted history", async () => {
    const { user } = renderRandomizer();

    expect(await screen.findByText("Jump Randomizer")).toBeInTheDocument();
    expect(screen.getByText("Alpha Entry")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^draw$/i }));

    await waitFor(() => {
      expect(dao.recordRandomizerRoll).toHaveBeenCalledTimes(1);
    });

    const drawSummaryChips = await screen.findAllByText(/Draw 1/);
    expect(drawSummaryChips.length).toBeGreaterThan(0);
    expect(screen.getByText(/Scope: Entire list/)).toBeInTheDocument();

    const call = vi.mocked(dao.recordRandomizerRoll).mock.calls[0]?.[0];
    const pickName = call?.picks[0]?.name;
    if (pickName) {
      const occurrences = await screen.findAllByText(pickName);
      expect(occurrences.length).toBeGreaterThan(0);
    }
  });

  it("shows an error when attempting to draw with only zero-weight entries", async () => {
    entriesData = entriesData.map((entry) => ({ ...entry, weight: 0 }));
    entriesDataForQuery = entriesData;

    const { user } = renderRandomizer();

    expect(await screen.findByText("Jump Randomizer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^draw$/i }));

    expect(await screen.findByText("No entries match the current filters.")).toBeInTheDocument();
    expect(dao.recordRandomizerRoll).not.toHaveBeenCalled();
  });

  it("prevents saving entries with a non-positive weight", async () => {
    const { user } = renderRandomizer();

    expect(await screen.findByText("Jump Randomizer")).toBeInTheDocument();

    const weightInput = await screen.findByLabelText("Weight");
    await user.clear(weightInput);
    await user.type(weightInput, "0");

    await user.click(screen.getByRole("button", { name: /save entry/i }));

    expect(await screen.findByText("Weight must be greater than 0.")).toBeInTheDocument();
    expect(dao.updateRandomizerEntry).not.toHaveBeenCalled();
  });
});
