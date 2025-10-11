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

const dialogPlatformMocks = vi.hoisted(() => {
  const confirmDialog = vi.fn(async () => false);
  const openFileDialog = vi.fn(async () => null as string[] | null);
  const saveFileDialog = vi.fn(async () => null);
  const readTextFile = vi.fn(async () => "");
  const getPlatform = vi.fn(async () => ({
    path: {
      appConfigDir: vi.fn(async () => "/"),
      join: vi.fn(async (...parts: string[]) =>
        parts.filter((segment, index) => segment || index === 0).join("/")
      ),
    },
    fs: {
      ensureDir: vi.fn(async () => undefined),
      exists: vi.fn(async () => false),
      readBinaryFile: vi.fn(async () => new Uint8Array()),
      readTextFile,
    },
    dialog: {
      confirm: vi.fn(async () => false),
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
    },
  }));
  return { confirmDialog, openFileDialog, saveFileDialog, readTextFile, getPlatform };
});

vi.mock("../../services/dialogService", () => ({
  confirmDialog: dialogPlatformMocks.confirmDialog,
  openFileDialog: dialogPlatformMocks.openFileDialog,
  saveFileDialog: dialogPlatformMocks.saveFileDialog,
}));

vi.mock("../../services/platform", () => ({
  getPlatform: dialogPlatformMocks.getPlatform,
}));

const mockConfirmDialog = dialogPlatformMocks.confirmDialog;
const mockOpenFileDialog = dialogPlatformMocks.openFileDialog;
const mockReadTextFile = dialogPlatformMocks.readTextFile;
const mockGetPlatform = dialogPlatformMocks.getPlatform;

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

    mockConfirmDialog.mockReset();
    mockConfirmDialog.mockResolvedValue(false);
    mockOpenFileDialog.mockReset();
    mockOpenFileDialog.mockResolvedValue(null);
    mockReadTextFile.mockReset();
    mockReadTextFile.mockResolvedValue("");
    mockGetPlatform.mockReset();
    mockGetPlatform.mockResolvedValue({
      path: {
        appConfigDir: vi.fn(async () => "/"),
        join: vi.fn(async (...parts: string[]) =>
          parts.filter((segment, index) => segment || index === 0).join("/")
        ),
      },
      fs: {
        ensureDir: vi.fn(async () => undefined),
        exists: vi.fn(async () => false),
        readBinaryFile: vi.fn(async () => new Uint8Array()),
        readTextFile: mockReadTextFile,
      },
      dialog: {
        confirm: vi.fn(async () => false),
        openFile: vi.fn(async () => null),
        saveFile: vi.fn(async () => null),
      },
    });

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
    vi.spyOn(dao, "upsertRandomizerList").mockResolvedValue(baseList);
    vi.spyOn(dao, "upsertRandomizerGroup").mockResolvedValue(baseGroup);
    vi.spyOn(dao, "upsertRandomizerEntry").mockImplementation(async () => entriesData[0]!);
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

    await user.click(screen.getByRole("button", { name: /draw/i }));

    await waitFor(() => {
      expect(dao.recordRandomizerRoll).toHaveBeenCalledTimes(1);
    });

    const drawCountMatches = await screen.findAllByText(/Draw 1/);
    expect(drawCountMatches.length).toBeGreaterThan(0);
    expect(screen.getByText(/Scope: Entire list/)).toBeInTheDocument();

    const call = vi.mocked(dao.recordRandomizerRoll).mock.calls[0]?.[0];
    const pickName = call?.picks[0]?.name;
    if (pickName) {
      const occurrences = await screen.findAllByText(pickName);
      expect(occurrences.length).toBeGreaterThan(0);
    }
  });

  it("exports configuration JSON and reimports it", async () => {
    const sampleRun: RandomizerRollRecord = {
      id: "roll-1",
      list_id: baseList.id,
      seed: "seed-123",
      params: { drawCount: 1 },
      created_at: "2024-01-02T00:00:00.000Z",
      picks: [
        {
          id: "pick-1",
          roll_id: "roll-1",
          entry_id: initialEntries[0]!.id,
          position: 1,
          name: initialEntries[0]!.name,
          weight: initialEntries[0]!.weight,
          link: initialEntries[0]!.link,
          tags: initialEntries[0]!.tags,
        },
      ],
    };
    historyData = [sampleRun];
    historyDataForQuery = historyData;
    mockConfirmDialog.mockResolvedValueOnce(true);

    const originalBlob = globalThis.Blob;
    class MockBlob {
      private readonly parts: BlobPart[];

      readonly type: string;

      constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) {
        this.parts = Array.isArray(parts) ? [...parts] : [parts];
        this.type = options?.type ?? "";
      }

      async text(): Promise<string> {
        let result = "";
        const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
        for (const part of this.parts) {
          if (typeof part === "string") {
            result += part;
            continue;
          }
          if (part instanceof ArrayBuffer) {
            result += decoder ? decoder.decode(new Uint8Array(part)) : "";
            continue;
          }
          if (ArrayBuffer.isView(part)) {
            result += decoder ? decoder.decode(part as ArrayBufferView) : "";
            continue;
          }
          if (typeof (part as { text?: () => Promise<string> }).text === "function") {
            result += await (part as { text: () => Promise<string> }).text();
            continue;
          }
          result += String(part ?? "");
        }
        return result;
      }
    }

    (globalThis as unknown as { Blob: typeof Blob }).Blob = MockBlob as unknown as typeof Blob;

    let capturedBlob: MockBlob | null = null;
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    const createObjectURLSpy = vi.fn((blob: Blob) => {
      capturedBlob = blob as unknown as MockBlob;
      return "blob:export";
    });
    const revokeObjectURLSpy = vi.fn(() => undefined);
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURLSpy,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURLSpy,
    });
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    const { user } = renderRandomizer();

    try {
      const exportButton = await screen.findByRole("button", { name: "Export History" });
      await user.click(exportButton);

      await waitFor(() => {
        expect(createObjectURLSpy).toHaveBeenCalled();
      });

      if (!capturedBlob) {
        throw new Error("Export payload was not captured");
      }
      const exportJson = await capturedBlob.text();
      const parsed = JSON.parse(exportJson);
      expect(Array.isArray(parsed.history)).toBe(true);
      expect(parsed.history.length).toBe(1);
      expect(Array.isArray(parsed.lists)).toBe(true);
      expect(parsed.lists.length).toBe(1);
      expect(Array.isArray(parsed.entries)).toBe(true);
      expect(parsed.entries.length).toBe(entriesData.length);

      mockOpenFileDialog.mockResolvedValueOnce(["/tmp/randomizer.json"]);
      mockReadTextFile.mockResolvedValueOnce(exportJson);

      const importButton = await screen.findByRole("button", { name: "Import JSON" });
      await user.click(importButton);

      await waitFor(() => {
        expect(dao.upsertRandomizerList).toHaveBeenCalled();
        expect(dao.upsertRandomizerGroup).toHaveBeenCalled();
        expect(dao.upsertRandomizerEntry).toHaveBeenCalled();
      });

      const listPayload = vi.mocked(dao.upsertRandomizerList).mock.calls[0]?.[0];
      expect(listPayload).toMatchObject({ id: baseList.id, name: baseList.name });
      const groupPayload = vi.mocked(dao.upsertRandomizerGroup).mock.calls[0]?.[0];
      expect(groupPayload).toMatchObject({ id: baseGroup.id, list_id: baseList.id });
      const entryPayload = vi.mocked(dao.upsertRandomizerEntry).mock.calls[0]?.[0];
      expect(entryPayload).toMatchObject({ id: initialEntries[0]!.id, group_id: baseGroup.id });

      expect(mockOpenFileDialog).toHaveBeenCalled();
      expect(mockReadTextFile).toHaveBeenCalledWith("/tmp/randomizer.json");
    } finally {
      if (originalBlob) {
        (globalThis as unknown as { Blob: typeof Blob }).Blob = originalBlob;
      } else {
        delete (globalThis as { Blob?: typeof Blob }).Blob;
      }

      if (originalCreateObjectURL) {
        Object.defineProperty(window.URL, "createObjectURL", {
          configurable: true,
          writable: true,
          value: originalCreateObjectURL,
        });
      } else {
        delete (window.URL as { createObjectURL?: typeof createObjectURLSpy }).createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(window.URL, "revokeObjectURL", {
          configurable: true,
          writable: true,
          value: originalRevokeObjectURL,
        });
      } else {
        delete (window.URL as { revokeObjectURL?: typeof revokeObjectURLSpy }).revokeObjectURL;
      }
      anchorClickSpy.mockRestore();
    }
  });
});
