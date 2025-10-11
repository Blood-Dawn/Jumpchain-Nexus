/*
MIT License

Copyright (c) 2025 Age-Of-Ages

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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearRandomizerRolls,
  createRandomizerEntry,
  createRandomizerGroup,
  createRandomizerList,
  deleteRandomizerEntry,
  deleteRandomizerGroup,
  deleteRandomizerList,
  listRandomizerEntriesForList,
  listRandomizerGroups,
  listRandomizerLists,
  listRandomizerRolls,
  recordRandomizerRoll,
  updateRandomizerEntry,
  updateRandomizerGroup,
  updateRandomizerList,
  type RandomizerEntryRecord,
  type RandomizerGroupRecord,
  type RandomizerListRecord,
  type RandomizerRollRecord,
} from "../../db/dao";
import { drawWeightedWithoutReplacement, type WeightedEntry } from "./weightedPicker";

const LISTS_QUERY_KEY = ["randomizer", "lists"] as const;
const groupsQueryKey = (listId: string) => ["randomizer", "groups", listId] as const;
const entriesQueryKey = (listId: string) => ["randomizer", "entries", listId] as const;
const historyQueryKey = (listId: string) => ["randomizer", "history", listId] as const;
const HISTORY_DISPLAY_LIMIT = 20;
const PRESETS_STORAGE_KEY = "jumpchain.randomizer.presets.v1";
const MAX_PRESETS_PER_LIST = 12;

type DrawScope = "all" | "group";
type ToastTone = "info" | "success" | "error";

interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
}

interface PresetSnapshot {
  listId: string;
  drawCount: number;
  scope: DrawScope;
  tags: string[];
  minWeight: number;
  groupId: string | "all";
  seed?: string;
}

interface SavedRandomizerPreset extends PresetSnapshot {
  id: string;
  createdAt: string;
  signature: string;
}

type PresetStore = Record<string, SavedRandomizerPreset[]>;

function createId(prefix: string): string {
  const globalCrypto =
    typeof globalThis !== "undefined" ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return `${prefix}-${globalCrypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
}

function computePresetSignature(snapshot: PresetSnapshot): string {
  const tagKey = normalizeTags(snapshot.tags).join("|");
  const seedKey = snapshot.seed ?? "";
  return [snapshot.listId, snapshot.drawCount, snapshot.scope, snapshot.groupId, snapshot.minWeight, seedKey, tagKey]
    .map((value) => String(value ?? ""))
    .join("::");
}

function sanitizePresetCandidate(listId: string, candidate: unknown): SavedRandomizerPreset | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const value = candidate as Partial<SavedRandomizerPreset>;
  const drawCountRaw = typeof value.drawCount === "number" ? value.drawCount : Number(value.drawCount);
  const drawCount = Number.isFinite(drawCountRaw) && drawCountRaw > 0 ? Math.floor(drawCountRaw) : 1;
  const scope: DrawScope = value.scope === "group" ? "group" : "all";
  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const minWeightRaw = typeof value.minWeight === "number" ? value.minWeight : Number(value.minWeight);
  const minWeight = Number.isFinite(minWeightRaw) && minWeightRaw >= 0 ? minWeightRaw : 0;
  const groupId =
    typeof value.groupId === "string" && value.groupId.length ? (value.groupId as string) : "all";
  const seed = typeof value.seed === "string" && value.seed.length ? value.seed : undefined;
  const snapshot: PresetSnapshot = {
    listId,
    drawCount,
    scope,
    tags: normalizeTags(tags),
    minWeight,
    groupId,
    seed,
  };
  const id = typeof value.id === "string" && value.id.length ? value.id : createId("preset");
  const createdAt =
    typeof value.createdAt === "string" && value.createdAt.length
      ? value.createdAt
      : new Date().toISOString();
  const signature =
    typeof value.signature === "string" && value.signature.length
      ? value.signature
      : computePresetSignature(snapshot);
  return {
    ...snapshot,
    id,
    createdAt,
    signature,
  };
}

function loadPresetStore(): PresetStore {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const store: PresetStore = {};
    for (const [listId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) {
        continue;
      }
      const sanitized = value
        .map((item) => sanitizePresetCandidate(listId, item))
        .filter((item): item is SavedRandomizerPreset => Boolean(item));
      if (sanitized.length) {
        store[listId] = sanitized.slice(0, MAX_PRESETS_PER_LIST);
      }
    }
    return store;
  } catch (error) {
    console.warn("Failed to load randomizer presets", error);
    return {};
  }
}

function parseRollParams(
  params: Record<string, unknown> | undefined
): { drawCount: number | null; scope: DrawScope; tags: string[]; minWeight: number | null; groupId: string | "all" } {
  if (!params || typeof params !== "object") {
    return { drawCount: null, scope: "all", tags: [], minWeight: null, groupId: "all" };
  }
  const drawCountValue =
    typeof (params as { drawCount?: unknown }).drawCount === "number"
      ? (params as { drawCount?: number }).drawCount
      : Number((params as { drawCount?: unknown }).drawCount);
  const scopeValue = (params as { scope?: unknown }).scope === "group" ? "group" : "all";
  const tagsValue = Array.isArray((params as { tags?: unknown }).tags)
    ? ((params as { tags?: unknown }).tags as unknown[]).filter((tag): tag is string => typeof tag === "string")
    : [];
  const minWeightValue =
    typeof (params as { minWeight?: unknown }).minWeight === "number"
      ? (params as { minWeight?: number }).minWeight
      : Number((params as { minWeight?: unknown }).minWeight);
  const groupIdValue =
    typeof (params as { groupId?: unknown }).groupId === "string"
      ? ((params as { groupId?: unknown }).groupId as string)
      : "all";
  return {
    drawCount: Number.isFinite(drawCountValue) ? Number(drawCountValue) : null,
    scope: scopeValue,
    tags: normalizeTags(tagsValue),
    minWeight: Number.isFinite(minWeightValue) ? Number(minWeightValue) : null,
    groupId: groupIdValue && groupIdValue.length ? groupIdValue : "all",
  };
}

interface EntryFormState {
  id: string;
  name: string;
  weight: string;
  link: string;
  tags: string;
  filters: string;
  groupId: string;
}

interface DrawSummary {
  count: number;
  seed?: string;
  scope: DrawScope;
  tags: string[];
  minWeight: number;
  groupId: string | "all";
}

function tagsToInputValue(tags: string[]): string {
  return tags.join(", ");
}

function filtersToInputValue(filters: Record<string, unknown>): string {
  if (!filters || !Object.keys(filters).length) {
    return "";
  }
  try {
    return JSON.stringify(filters, null, 2);
  } catch (error) {
    console.warn("Failed to stringify entry filters", error);
    return "";
  }
}

function stringToTags(value: string): string[] {
  const unique = new Set<string>();
  for (const raw of value.split(",")) {
    const trimmed = raw.trim();
    if (trimmed.length) {
      unique.add(trimmed);
    }
  }
  return Array.from(unique);
}

function parseFiltersInput(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed.length) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.warn("Failed to parse filters JSON", error);
  }
  throw new Error("Filters must be a valid JSON object.");
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

function hashSeed(source: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string | undefined): () => number {
  if (!seed) {
    return Math.random;
  }
  let state = hashSeed(seed);
  if (state === 0) {
    state = 0x6d2b79f5;
  }
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function validateSeedInput(seed: string): string | null {
  if (!seed.length) {
    return null;
  }
  if (seed.length > 64) {
    return "Seed must be 64 characters or fewer.";
  }
  if (!/^[\w\s-]+$/.test(seed)) {
    return "Seed may only contain letters, numbers, spaces, hyphen, or underscore.";
  }
  return null;
}

const JumpRandomizerPlaceholder: React.FC = () => {
  return (
    <section className="module randomizer">
      <header>
        <h1>Jump Randomizer</h1>
        <p>Loading randomizerΓÇª</p>
      </header>
    </section>
  );
};

const JumpRandomizer: React.FC = () => {
  const queryClient = useQueryClient();
  const listsQuery = useQuery({ queryKey: LISTS_QUERY_KEY, queryFn: () => listRandomizerLists() });
  const lists = listsQuery.data ?? [];

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | "all">("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState<EntryFormState | null>(null);
  const [entryFormError, setEntryFormError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [listNameDraft, setListNameDraft] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [drawCountInput, setDrawCountInput] = useState("1");
  const [seedInput, setSeedInput] = useState("");
  const [minWeightInput, setMinWeightInput] = useState("0");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [drawScope, setDrawScope] = useState<DrawScope>("all");
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawResults, setDrawResults] = useState<RandomizerEntryRecord[]>([]);
  const [lastDrawSummary, setLastDrawSummary] = useState<DrawSummary | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [presetStore, setPresetStore] = useState<PresetStore>(() => loadPresetStore());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimers = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timerId = toastTimers.current.get(id);
    if (typeof timerId === "number" && typeof window !== "undefined") {
      window.clearTimeout(timerId);
    }
    toastTimers.current.delete(id);
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const toastId = createId("toast");
      setToasts((prev) => [...prev, { id: toastId, message, tone }]);
      if (typeof window !== "undefined") {
        const timeout = window.setTimeout(() => {
          removeToast(toastId);
        }, 3200);
        toastTimers.current.set(toastId, timeout);
      }
    },
    [removeToast]
  );

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        for (const timerId of toastTimers.current.values()) {
          window.clearTimeout(timerId);
        }
      }
      toastTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!lists.length) {
      setSelectedListId(null);
      return;
    }
    if (!selectedListId || !lists.some((list) => list.id === selectedListId)) {
      setSelectedListId(lists[0]!.id);
    }
  }, [lists, selectedListId]);

  const recentPresets = useMemo(
    () => (selectedListId ? presetStore[selectedListId] ?? [] : []),
    [presetStore, selectedListId]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presetStore));
    } catch (error) {
      console.warn("Failed to persist randomizer presets", error);
    }
  }, [presetStore]);

  const rememberPreset = useCallback(
    (snapshot: PresetSnapshot) => {
      if (!snapshot.listId) {
        return;
      }
      setPresetStore((prev) => {
        const current = prev[snapshot.listId] ?? [];
        const signature = computePresetSignature(snapshot);
        const nextList = [
          {
            ...snapshot,
            id: createId("preset"),
            createdAt: new Date().toISOString(),
            signature,
            tags: normalizeTags(snapshot.tags),
          },
          ...current.filter((item) => item.signature !== signature),
        ].slice(0, MAX_PRESETS_PER_LIST);
        return {
          ...prev,
          [snapshot.listId]: nextList,
        };
      });
    },
    []
  );

  const removePreset = useCallback((presetId: string) => {
    setPresetStore((prev) => {
      let changed = false;
      const next: PresetStore = {};
      for (const [listId, presets] of Object.entries(prev)) {
        const filtered = presets.filter((preset) => preset.id !== presetId);
        if (filtered.length !== presets.length) {
          changed = true;
        }
        if (filtered.length) {
          next[listId] = filtered;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const clearPresets = useCallback(() => {
    if (!selectedListId) {
      return;
    }
    setPresetStore((prev) => {
      if (!(selectedListId in prev)) {
        return prev;
      }
      const { [selectedListId]: _removed, ...rest } = prev;
      return rest;
    });
  }, [selectedListId]);

  const applyPreset = useCallback(
    (preset: SavedRandomizerPreset, options?: { silent?: boolean }) => {
      setDrawCountInput(String(preset.drawCount));
      setSeedInput(preset.seed ?? "");
      setDrawScope(preset.scope);
      setMinWeightInput(String(preset.minWeight));
      setSelectedTags([...preset.tags]);
      if (preset.scope === "group") {
        setSelectedGroupId(preset.groupId);
      } else {
        setSelectedGroupId("all");
      }
      if (!options?.silent) {
        showToast("Configuration loaded.", "success");
      }
    },
    [setDrawCountInput, setSeedInput, setDrawScope, setMinWeightInput, setSelectedTags, setSelectedGroupId, showToast]
  );

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) ?? null,
    [lists, selectedListId]
  );

  useEffect(() => {
    setListNameDraft(selectedList?.name ?? "");
  }, [selectedList]);

  const groupsQuery = useQuery({
    queryKey: selectedListId ? groupsQueryKey(selectedListId) : ["randomizer", "groups", "none"],
    queryFn: () => listRandomizerGroups(selectedListId ?? ""),
    enabled: Boolean(selectedListId),
  });
  const groups = groupsQuery.data ?? [];

  const selectedGroup = useMemo(
    () =>
      selectedGroupId === "all"
        ? null
        : groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  useEffect(() => {
    setGroupNameDraft(selectedGroup?.name ?? "");
  }, [selectedGroup]);

  useEffect(() => {
    setNewGroupName("");
  }, [selectedListId]);

  useEffect(() => {
    if (!selectedListId) {
      setSelectedGroupId("all");
      return;
    }
    if (!groups.length) {
      setSelectedGroupId("all");
      return;
    }
    if (selectedGroupId !== "all" && !groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(groups[0]!.id);
    }
  }, [groups, selectedGroupId, selectedListId]);

  useEffect(() => {
    if (drawScope === "group" && selectedGroupId === "all") {
      setDrawScope("all");
    }
  }, [drawScope, selectedGroupId]);

  const entriesQuery = useQuery({
    queryKey: selectedListId ? entriesQueryKey(selectedListId) : ["randomizer", "entries", "none"],
    queryFn: () => listRandomizerEntriesForList(selectedListId ?? ""),
    enabled: Boolean(selectedListId),
  });
  const entries = entriesQuery.data ?? [];

  useEffect(() => {
    if (!entries.length) {
      setSelectedEntryId(null);
      return;
    }
    if (!selectedEntryId || !entries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(entries[0]!.id);
    }
  }, [entries, selectedEntryId]);

  useEffect(() => {
    if (!selectedGroup) {
      setGroupNameDraft("");
      return;
    }
    setGroupNameDraft(selectedGroup.name ?? "");
  }, [selectedGroup?.id, selectedGroup?.name]);

  useEffect(() => {
    if (selectedGroupId === "all") {
      return;
    }
    if (
      selectedEntryId &&
      entries.some((entry) => entry.id === selectedEntryId && entry.group_id === selectedGroupId)
    ) {
      return;
    }
    const fallback = entries.find((entry) => entry.group_id === selectedGroupId);
    setSelectedEntryId(fallback?.id ?? null);
  }, [entries, selectedEntryId, selectedGroupId]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  );

  useEffect(() => {
    if (!selectedEntry) {
      setEntryForm(null);
      setEntryFormError(null);
      return;
    }
    setEntryForm({
      id: selectedEntry.id,
      name: selectedEntry.name,
      weight: String(Math.max(selectedEntry.weight ?? 0, 0)),
      link: selectedEntry.link ?? "",
      tags: tagsToInputValue(selectedEntry.tags),
      filters: filtersToInputValue(selectedEntry.filters),
      groupId: selectedEntry.group_id,
    });
    setEntryFormError(null);
  }, [
    selectedEntry?.filters,
    selectedEntry?.group_id,
    selectedEntry?.id,
    selectedEntry?.link,
    selectedEntry?.name,
    selectedEntry?.tags,
    selectedEntry?.updated_at,
    selectedEntry?.weight,
  ]);

  const availableEntries = useMemo(() => {
    if (selectedGroupId === "all") {
      return entries;
    }
    return entries.filter((entry) => entry.group_id === selectedGroupId);
  }, [entries, selectedGroupId]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const entry of entries) {
      for (const tag of entry.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  useEffect(() => {
    setSelectedTags((prev) => prev.filter((tag) => availableTags.includes(tag)));
  }, [availableTags]);

  const filters = useMemo(() => {
    const minWeight = Number.parseInt(minWeightInput, 10);
    return {
      minWeight: Number.isNaN(minWeight) ? 0 : Math.max(minWeight, 0),
      tags: selectedTags,
      scope: drawScope,
      groupId: selectedGroupId,
    };
  }, [minWeightInput, selectedTags, drawScope, selectedGroupId]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (entry.weight <= 0) {
        return false;
      }
      if (filters.scope === "group" && filters.groupId !== "all" && entry.group_id !== filters.groupId) {
        return false;
      }
      if (entry.weight < filters.minWeight) {
        return false;
      }
      if (filters.tags.length && !filters.tags.every((tag) => entry.tags.includes(tag))) {
        return false;
      }
      return true;
    });
  }, [entries, filters]);

  const totalWeight = useMemo(
    () => filteredEntries.reduce((sum, entry) => sum + Math.max(entry.weight ?? 0, 0), 0),
    [filteredEntries]
  );

  const historyQuery = useQuery({
    queryKey: selectedListId ? historyQueryKey(selectedListId) : ["randomizer", "history", "none"],
    queryFn: () => listRandomizerRolls(selectedListId ?? "", HISTORY_DISPLAY_LIMIT),
    enabled: Boolean(selectedListId),
  });
  const historyRecords = historyQuery.data ?? [];

  const createListMutation = useMutation({
    mutationFn: (input: Parameters<typeof createRandomizerList>[0]) => createRandomizerList(input ?? {}),
    onSuccess: (record) => {
      setSelectedListId(record.id);
      setSelectedGroupId("all");
      setNewListName("");
      queryClient.invalidateQueries({ queryKey: LISTS_QUERY_KEY }).catch(() => undefined);
    },
  });

  const updateListMutation = useMutation({
    mutationFn: (payload: { id: string; updates: Parameters<typeof updateRandomizerList>[1] }) =>
      updateRandomizerList(payload.id, payload.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTS_QUERY_KEY }).catch(() => undefined);
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: (id: string) => deleteRandomizerList(id),
    onSuccess: (_, id) => {
      if (selectedListId === id) {
        setSelectedListId(null);
        setSelectedGroupId("all");
        setSelectedEntryId(null);
      }
      queryClient.invalidateQueries({ queryKey: LISTS_QUERY_KEY }).catch(() => undefined);
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: (input: Parameters<typeof createRandomizerGroup>[0]) => createRandomizerGroup(input),
    onSuccess: (record) => {
      setSelectedGroupId(record.id);
      setNewGroupName("");
      queryClient.invalidateQueries({ queryKey: groupsQueryKey(record.list_id) }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: entriesQueryKey(record.list_id) }).catch(() => undefined);
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: (payload: { id: string; updates: Parameters<typeof updateRandomizerGroup>[1] }) =>
      updateRandomizerGroup(payload.id, payload.updates),
    onSuccess: () => {
      if (selectedListId) {
        queryClient.invalidateQueries({ queryKey: groupsQueryKey(selectedListId) }).catch(() => undefined);
        queryClient.invalidateQueries({ queryKey: entriesQueryKey(selectedListId) }).catch(() => undefined);
      }
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => deleteRandomizerGroup(id),
    onSuccess: (_, id) => {
      if (selectedGroupId === id) {
        setSelectedGroupId("all");
      }
      if (selectedListId) {
        queryClient.invalidateQueries({ queryKey: groupsQueryKey(selectedListId) }).catch(() => undefined);
        queryClient.invalidateQueries({ queryKey: entriesQueryKey(selectedListId) }).catch(() => undefined);
      }
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: (input: Parameters<typeof createRandomizerEntry>[0]) => createRandomizerEntry(input),
    onSuccess: (record) => {
      setSelectedEntryId(record.id);
      setEntryFormError(null);
      if (selectedListId) {
        queryClient.invalidateQueries({ queryKey: entriesQueryKey(selectedListId) }).catch(() => undefined);
      }
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: (payload: { id: string; updates: Parameters<typeof updateRandomizerEntry>[1] }) =>
      updateRandomizerEntry(payload.id, payload.updates),
    onSuccess: () => {
      if (selectedListId) {
        queryClient.invalidateQueries({ queryKey: entriesQueryKey(selectedListId) }).catch(() => undefined);
      }
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => deleteRandomizerEntry(id),
    onSuccess: (_, id) => {
      if (selectedEntryId === id) {
        setSelectedEntryId(null);
      }
      if (selectedListId) {
        queryClient.invalidateQueries({ queryKey: entriesQueryKey(selectedListId) }).catch(() => undefined);
      }
    },
  });

  const recordRollMutation = useMutation({
    mutationFn: (input: Parameters<typeof recordRandomizerRoll>[0]) => recordRandomizerRoll(input),
    onSuccess: () => {
      if (selectedListId) {
        queryClient.invalidateQueries({ queryKey: historyQueryKey(selectedListId) }).catch(() => undefined);
      }
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: (listId: string) => clearRandomizerRolls(listId),
    onSuccess: () => {
      if (selectedListId) {
        queryClient.invalidateQueries({ queryKey: historyQueryKey(selectedListId) }).catch(() => undefined);
      }
      showToast("History cleared.", "success");
    },
    onError: () => {
      showToast("Failed to clear history.", "error");
    },
  });

  const handleCreateList = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = newListName.trim();
    createListMutation.mutate(trimmed.length ? { name: trimmed } : {});
  };

  const handleRenameList = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!selectedList) {
      return;
    }
    const trimmed = listNameDraft.trim();
    if (!trimmed.length || trimmed === selectedList.name) {
      return;
    }
    updateListMutation.mutate({ id: selectedList.id, updates: { name: trimmed } });
  };

  const handleDeleteList = (): void => {
    if (!selectedList) {
      return;
    }
    const confirmDelete =
      typeof window === "undefined"
        ? false
        : window.confirm(
            `Delete "${selectedList.name}" and all associated groups, entries, and history? This cannot be undone.`
          );
    if (!confirmDelete) {
      return;
    }
    deleteListMutation.mutate(selectedList.id);
  };

  const handleCreateGroup = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!selectedListId) {
      showToast("Select a list before creating groups.", "info");
      return;
    }
    createGroupMutation.mutate({
      list_id: selectedListId,
      name: newGroupName.trim().length ? newGroupName.trim() : undefined,
    });
  };

  const handleRenameGroup = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!selectedGroupId || selectedGroupId === "all" || !selectedGroup) {
      return;
    }
    const trimmed = groupNameDraft.trim();
    if (!trimmed.length || trimmed === selectedGroup.name) {
      return;
    }
    updateGroupMutation.mutate({ id: selectedGroup.id, updates: { name: trimmed } });
  };

  const handleDeleteGroup = (): void => {
    if (!selectedGroupId || selectedGroupId === "all" || !selectedGroup) {
      return;
    }
    if (groups.length <= 1) {
      showToast("At least one group is required.", "error");
      return;
    }
    const confirmDelete =
      typeof window === "undefined"
        ? false
        : window.confirm(`Delete group "${selectedGroup.name}" and all entries in it?`);
    if (!confirmDelete) {
      return;
    }
    deleteGroupMutation.mutate(selectedGroup.id);
  };

  const handleAddEntry = (): void => {
    if (!selectedListId || !groups.length) {
      return;
    }
    const targetGroup =
      selectedGroupId !== "all" && groups.some((group) => group.id === selectedGroupId)
        ? selectedGroupId
        : groups[0]!.id;
    createEntryMutation.mutate({
      list_id: selectedListId,
      group_id: targetGroup,
    });
  };

  const handleEntrySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!entryForm) {
      return;
    }
    setEntryFormError(null);
    let filtersObject: Record<string, unknown>;
    try {
      filtersObject = parseFiltersInput(entryForm.filters);
    } catch (error) {
      setEntryFormError((error as Error).message);
      return;
    }
    const weight = Number.parseInt(entryForm.weight, 10);
    updateEntryMutation.mutate({
      id: entryForm.id,
      updates: {
        name: entryForm.name,
        weight,
        link: entryForm.link,
        tags: stringToTags(entryForm.tags),
        filters: filtersObject,
        group_id: entryForm.groupId,
      },
    });
  };

  const handleDeleteEntry = (): void => {
    if (!selectedEntryId) {
      return;
    }
    const entry = entries.find((item) => item.id === selectedEntryId);
    const confirmDelete =
      typeof window === "undefined"
        ? false
        : window.confirm(`Delete "${entry?.name ?? "entry"}"? This cannot be undone.`);
    if (!confirmDelete) {
      return;
    }
    deleteEntryMutation.mutate(selectedEntryId);
  };

  const handleSelectList = (id: string): void => {
    setSelectedListId(id);
    setSelectedGroupId("all");
    setSelectedEntryId(null);
    setSelectedTags([]);
    setDrawResults([]);
    setLastDrawSummary(null);
    setDrawError(null);
  };

  const handleSelectGroup = (value: string | "all"): void => {
    if (value === "all") {
      setSelectedGroupId("all");
      return;
    }
    setSelectedGroupId(value);
  };

  const handleScopeChange = (scope: DrawScope) => {
    if (scope === "group") {
      if (!groups.length) {
        setDrawError("At least one group is required to draw within a group.");
        return;
      }
      if (selectedGroupId === "all") {
        const firstGroup = groups[0];
        if (firstGroup) {
          setSelectedGroupId(firstGroup.id);
        }
      }
    }
    setDrawScope(scope);
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((item) => item !== tag);
      }
      return [...prev, tag];
    });
  };

  const handleDraw = async (): Promise<void> => {
    if (!selectedListId) {
      return;
    }
    if (recordRollMutation.isPending) {
      setDrawError("A draw is already in progress.");
      return;
    }
    setDrawError(null);
    setCopyMessage(null);
    const drawCount = Number.parseInt(drawCountInput, 10);
    if (Number.isNaN(drawCount)) {
      setDrawError("Draw count must be a number.");
      return;
    }
    if (drawCount <= 0) {
      setDrawError("Draw count must be at least 1.");
      return;
    }
    if (!filteredEntries.length) {
      setDrawError("No entries match the current filters.");
      return;
    }
    if (drawCount > filteredEntries.length) {
      setDrawError(`Only ${filteredEntries.length} entries are available for this draw.`);
      return;
    }
    const entriesForDraw: WeightedEntry<RandomizerEntryRecord>[] = filteredEntries.map((entry) => ({
      id: entry.id,
      weight: entry.weight,
      payload: entry,
    }));
    const seed = seedInput.trim();
    const seedValidationError = validateSeedInput(seed);
    if (seedValidationError) {
      setDrawError(seedValidationError);
      return;
    }
    const normalizedSeed = seed.length ? seed : undefined;
    const rng = createSeededRandom(normalizedSeed);
    const picks = drawWeightedWithoutReplacement(entriesForDraw, drawCount, rng).map((entry) => entry.payload);
    setDrawResults(picks);
    setLastDrawSummary({
      count: drawCount,
      seed: normalizedSeed,
      scope: filters.scope,
      tags: [...filters.tags],
      minWeight: filters.minWeight,
      groupId: filters.groupId,
    });
    try {
      await recordRollMutation.mutateAsync({
        listId: selectedListId,
        seed: normalizedSeed,
        params: {
          drawCount,
          scope: filters.scope,
          tags: filters.tags,
          minWeight: filters.minWeight,
          groupId: filters.groupId,
        },
        picks: picks.map((entry) => ({
          entryId: entry.id,
          name: entry.name,
          weight: entry.weight,
          link: entry.link,
          tags: entry.tags,
        })),
      });
      if (selectedListId) {
        rememberPreset({
          listId: selectedListId,
          drawCount,
          scope: filters.scope,
          tags: filters.tags,
          minWeight: filters.minWeight,
          groupId: filters.scope === "group" ? filters.groupId : "all",
          seed: normalizedSeed,
        });
      }
    } catch (error) {
      console.warn("Failed to record randomizer roll", error);
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to record randomizer roll.";
      setDrawError(message);
      showToast("Roll failed to record.", "error");
    }
  };

  const handleCopyResult = async (entry: RandomizerEntryRecord, mode: "name" | "link" | "full") => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      showToast("Clipboard unavailable.", "error");
      return;
    }
    if (mode === "link" && !entry.link) {
      showToast("Entry has no link to copy.", "info");
      return;
    }
    let text = entry.name;
    if (mode === "link") {
      text = entry.link ?? "";
    } else if (mode === "full") {
      const parts = [entry.name];
      if (entry.link) {
        parts.push(`(${entry.link})`);
      }
      parts.push(`w${entry.weight}`);
      if (entry.tags.length) {
        parts.push(`[${entry.tags.join(", ")}]`);
      }
      text = parts.join(" ");
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard.", "success");
    } catch (error) {
      console.warn("Failed to copy result", error);
      showToast("Clipboard copy failed.", "error");
    }
  };

  const handleCopyDrawResults = async (): Promise<void> => {
    if (!drawResults.length) {
      showToast("No results available to copy.", "info");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      showToast("Clipboard unavailable.", "error");
      return;
    }
    const text = drawResults
      .map((entry, index) => {
        const segments = [`${index + 1}. ${entry.name}`];
        if (entry.link) {
          segments.push(`(${entry.link})`);
        }
        segments.push(`w${entry.weight}`);
        if (entry.tags.length) {
          segments.push(`[${entry.tags.join(", ")}]`);
        }
        return segments.join(" ");
      })
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Results copied to clipboard.", "success");
    } catch (error) {
      console.warn("Failed to copy results", error);
      showToast("Clipboard copy failed.", "error");
    }
  };

  const handleApplyPreset = (preset: SavedRandomizerPreset) => {
    applyPreset(preset);
  };

  const handleRemovePreset = (presetId: string) => {
    removePreset(presetId);
    showToast("Preset removed.", "info");
  };

  const handleClearPresetList = () => {
    if (!recentPresets.length) {
      showToast("There are no presets to clear.", "info");
      return;
    }
    clearPresets();
    showToast("Preset list cleared.", "info");
  };

  const handleSavePreset = () => {
    if (!selectedListId) {
      showToast("Select a list before saving a configuration.", "info");
      return;
    }
    const drawCount = Number.parseInt(drawCountInput, 10);
    if (Number.isNaN(drawCount) || drawCount <= 0) {
      showToast("Enter a valid draw count before saving.", "error");
      return;
    }
    const normalizedSeed = seedInput.trim();
    const normalizedMinWeight = Number.parseInt(minWeightInput, 10);
    const presetGroupId = drawScope === "group" && selectedGroupId !== "all" ? selectedGroupId : "all";
    rememberPreset({
      listId: selectedListId,
      drawCount,
      scope: drawScope,
      tags: selectedTags,
      minWeight: Number.isNaN(normalizedMinWeight) ? 0 : Math.max(normalizedMinWeight, 0),
      groupId: presetGroupId,
      seed: normalizedSeed.length ? normalizedSeed : undefined,
    });
    showToast("Configuration saved.", "success");
  };

  const handleApplyPresetAndDraw = async (preset: SavedRandomizerPreset) => {
    if (recordRollMutation.isPending) {
      showToast("A draw is already in progress.", "info");
      return;
    }
    applyPreset(preset, { silent: true });
    await new Promise<void>((resolve) => {
      if (typeof window === "undefined") {
        resolve();
      } else {
        window.setTimeout(() => resolve(), 0);
      }
    });
    await handleDraw();
  };

  const handleResetHistory = (): void => {
    if (!selectedListId) {
      return;
    }
    clearHistoryMutation.mutate(selectedListId);
  };

  const handleCopyHistory = async (): Promise<void> => {
    if (!historyRecords.length || typeof navigator === "undefined" || !navigator.clipboard) {
      showToast("Clipboard unavailable.", "error");
      return;
    }
    const text = historyRecords
      .map((run, index) => {
        const parts = [`Roll ${index + 1} ΓÇö ${formatTimestamp(run.created_at)}`];
        if (run.seed) {
          parts.push(`Seed: ${run.seed}`);
        }
        const header = parts.join(" | ");
        if (!run.picks.length) {
          return header;
        }
        const lines = run.picks.map((pick, idx) => {
          const segments = [`${idx + 1}. ${pick.name}`];
          if (pick.link) {
            segments.push(`(${pick.link})`);
          }
          segments.push(`w${pick.weight}`);
          if (pick.tags.length) {
            segments.push(`[${pick.tags.join(", ")}]`);
          }
          return segments.join(" ");
        });
        return [header, ...lines].join("\n");
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast("History copied to clipboard.", "success");
    } catch (error) {
      console.warn("Failed to copy results", error);
      showToast("Clipboard copy failed.", "error");
    }
  };

  const handleExportHistory = (): void => {
    if (!historyRecords.length || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const payload = historyRecords.map((run) => ({
      id: run.id,
      list_id: run.list_id,
      created_at: run.created_at,
      seed: run.seed,
      params: run.params,
      picks: run.picks.map((pick) => ({
        id: pick.id,
        entry_id: pick.entry_id,
        name: pick.name,
        weight: pick.weight,
        link: pick.link,
        tags: pick.tags,
        position: pick.position,
      })),
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `randomizer-results-${Date.now()}.json`;
    anchor.rel = "noopener";
    anchor.click();
    window.URL.revokeObjectURL(url);
    showToast("Export downloaded.", "success");
  };

  const listControlsDisabled =
    createListMutation.isPending || deleteListMutation.isPending || updateListMutation.isPending;
  const groupControlsDisabled =
    createGroupMutation.isPending || deleteGroupMutation.isPending || updateGroupMutation.isPending;
  const entryControlsDisabled =
    createEntryMutation.isPending || updateEntryMutation.isPending || deleteEntryMutation.isPending;
  const drawInProgress = recordRollMutation.isPending;
  const historyBusy = clearHistoryMutation.isPending;

  useEffect(() => {
    if (!copyMessage || typeof window === "undefined") {
      return;
    }
    const timer = window.setTimeout(() => setCopyMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [copyMessage]);

  return (
    <section className="module randomizer">
      <header>
        <h1>Jump Randomizer</h1>
        <p>Manage lists, groups, and entries to run weighted draws.</p>
      </header>
      <div className="randomizer-layout">
        <aside className="randomizer-sidebar">
          <div className="randomizer-panel">
            <h2>Lists</h2>
            {lists.length ? (
              <ul className="randomizer-list">
                {lists.map((list) => {
                  const isSelected = list.id === selectedListId;
                  return (
                    <li key={list.id}>
                      <button
                        type="button"
                        className={isSelected ? "list-button is-selected" : "list-button"}
                        onClick={() => handleSelectList(list.id)}
                        aria-pressed={isSelected}
                      >
                        {list.name || "Untitled list"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="empty-state">No lists yet.</p>
            )}
            <form className="stack-form" onSubmit={handleCreateList}>
              <label>
                <span>Create List</span>
                <input
                  type="text"
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  placeholder="List name"
                  disabled={listControlsDisabled}
                  autoComplete="off"
                />
              </label>
              <button type="submit" disabled={listControlsDisabled}>
                Add List
              </button>
            </form>
            {selectedList ? (
              <div className="stack-form">
                <form onSubmit={handleRenameList}>
                  <label>
                    <span>Rename List</span>
                    <input
                      type="text"
                      value={listNameDraft}
                      onChange={(event) => setListNameDraft(event.target.value)}
                      disabled={listControlsDisabled}
                      autoComplete="off"
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      type="submit"
                      disabled={
                        listControlsDisabled ||
                        !listNameDraft.trim().length ||
                        listNameDraft.trim() === selectedList.name
                      }
                    >
                      Save
                    </button>
                  </div>
                </form>
                <button type="button" onClick={handleDeleteList} disabled={listControlsDisabled}>
                  Delete List
                </button>
              </div>
            ) : null}
          </div>

          <div className="randomizer-panel">
            <h2>Groups</h2>
            {selectedListId ? (
              <>
                <ul className="randomizer-list">
                  <li key="all">
                    <button
                      type="button"
                      className={selectedGroupId === "all" ? "list-button is-selected" : "list-button"}
                      onClick={() => handleSelectGroup("all")}
                      aria-pressed={selectedGroupId === "all"}
                    >
                      All Entries
                    </button>
                  </li>
                  {groups.map((group) => {
                    const isSelected = group.id === selectedGroupId;
                    return (
                      <li key={group.id}>
                        <button
                          type="button"
                          className={isSelected ? "list-button is-selected" : "list-button"}
                          onClick={() => handleSelectGroup(group.id)}
                          aria-pressed={isSelected}
                        >
                          {group.name || "Untitled group"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <form className="stack-form" onSubmit={handleCreateGroup}>
                  <label>
                    <span>Create Group</span>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(event) => setNewGroupName(event.target.value)}
                      placeholder="Group name"
                      disabled={groupControlsDisabled || !selectedListId}
                      autoComplete="off"
                    />
                  </label>
                  <button type="submit" disabled={groupControlsDisabled || !selectedListId}>
                    Add Group
                  </button>
                </form>
                {selectedGroup ? (
                  <div className="stack-form">
                    <form onSubmit={handleRenameGroup}>
                      <label>
                        <span>Rename Group</span>
                        <input
                          type="text"
                          value={groupNameDraft}
                          onChange={(event) => setGroupNameDraft(event.target.value)}
                          disabled={groupControlsDisabled}
                          autoComplete="off"
                        />
                      </label>
                      <div className="form-actions">
                        <button
                          type="submit"
                          disabled={
                            groupControlsDisabled ||
                            !groupNameDraft.trim().length ||
                            groupNameDraft.trim() === selectedGroup.name
                          }
                        >
                          Save
                        </button>
                      </div>
                    </form>
                    <button
                      type="button"
                      onClick={handleDeleteGroup}
                      disabled={groupControlsDisabled || groups.length <= 1}
                    >
                      Delete Group
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="empty-state">Select a list to manage groups.</p>
            )}
          </div>

          <div className="randomizer-panel">
            <h2>Filters</h2>
            <div className="stack-form">
              <label>
                <span>Minimum Weight</span>
                <input
                  type="number"
                  min="0"
                  value={minWeightInput}
                  onChange={(event) => setMinWeightInput(event.target.value)}
                />
              </label>
              <fieldset className="scope-fieldset">
                <legend>Draw Scope</legend>
                <label>
                  <input
                    type="radio"
                    name="draw-scope"
                    value="all"
                    checked={drawScope === "all"}
                    onChange={() => handleScopeChange("all")}
                  />
                  Entire list
                </label>
                <label>
                  <input
                    type="radio"
                    name="draw-scope"
                    value="group"
                    checked={drawScope === "group"}
                    onChange={() => handleScopeChange("group")}
                    disabled={!groups.length && selectedGroupId === "all"}
                  />
                  Selected group only
                </label>
              </fieldset>
              <div className="tag-selector">
                <span>Tags</span>
                {availableTags.length ? (
                  <div className="tag-options">
                    {availableTags.map((tag) => (
                      <label key={tag}>
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={() => handleToggleTag(tag)}
                        />
                        {tag}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No tags discovered yet.</p>
                )}
              </div>
              <div className="filter-summary">
                <span>{`Matching entries: ${filteredEntries.length}`}</span>
                <span>{`Total weight: ${totalWeight}`}</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="randomizer-content">
          <div className="randomizer-panel">
            <div className="panel-heading">
              <h2>Entries</h2>
              <button
                type="button"
                onClick={handleAddEntry}
                disabled={!selectedListId || !groups.length || entryControlsDisabled}
              >
                Add Entry
              </button>
            </div>
            {selectedListId ? (
              availableEntries.length ? (
                <ul className="entry-list">
                  {availableEntries.map((entry) => {
                    const isSelected = entry.id === selectedEntryId;
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className={isSelected ? "entry-button is-selected" : "entry-button"}
                          onClick={() => setSelectedEntryId(entry.id)}
                          aria-pressed={isSelected}
                        >
                          <span className="entry-name">{entry.name || "Untitled entry"}</span>
                          <span className="entry-weight">{`w${entry.weight}`}</span>
                          {entry.tags.length ? (
                            <span className="entry-tags">{entry.tags.join(", ")}</span>
                          ) : (
                            <span className="entry-tags muted">No tags</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="empty-state">No entries in this selection.</p>
              )
            ) : (
              <p className="empty-state">Select a list to view entries.</p>
            )}
          </div>

          <div className="randomizer-panel">
            <h2>Entry Details</h2>
            {entryForm ? (
              <form className="stack-form" onSubmit={handleEntrySubmit}>
                <label>
                  <span>Name</span>
                  <input
                    type="text"
                    value={entryForm.name}
                    onChange={handleEntryFieldChange("name")}
                    disabled={entryControlsDisabled}
                    required
                  />
                </label>
                <div className="field-row">
                  <label>
                    <span>Weight</span>
                    <input
                      type="number"
                      value={entryForm.weight}
                      onChange={handleEntryFieldChange("weight")}
                      disabled={entryControlsDisabled}
                    />
                  </label>
                  <label>
                    <span>Group</span>
                    <select
                      value={entryForm.groupId}
                      onChange={handleEntryFieldChange("groupId")}
                      disabled={entryControlsDisabled || !groups.length}
                    >
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name || "Untitled group"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  <span>Link</span>
                  <input
                    type="url"
                    value={entryForm.link}
                    onChange={handleEntryFieldChange("link")}
                    disabled={entryControlsDisabled}
                    placeholder="https://example.com"
                  />
                </label>
                <label>
                  <span>Tags (comma separated)</span>
                  <input
                    type="text"
                    value={entryForm.tags}
                    onChange={handleEntryFieldChange("tags")}
                    disabled={entryControlsDisabled}
                  />
                </label>
                <label>
                  <span>Filters (JSON object)</span>
                  <textarea
                    value={entryForm.filters}
                    onChange={handleEntryFieldChange("filters")}
                    disabled={entryControlsDisabled}
                    rows={4}
                  />
                </label>
                {entryFormError ? <p className="error-message">{entryFormError}</p> : null}
                <div className="form-actions">
                  <button type="submit" disabled={entryControlsDisabled}>
                    Save Entry
                  </button>
                  <button type="button" onClick={handleDeleteEntry} disabled={entryControlsDisabled}>
                    Delete Entry
                  </button>
                </div>
              </form>
            ) : (
              <p className="empty-state">Select an entry to edit.</p>
            )}
          </div>

          <div className="randomizer-panel">
            <h2>Draw</h2>
            <form
              className="stack-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleDraw();
              }}
            >
              <label>
                <span>Draw Count</span>
                <input
                  type="number"
                  min="1"
                  value={drawCountInput}
                  onChange={(event) => setDrawCountInput(event.target.value)}
                  disabled={drawInProgress || !selectedListId}
                />
              </label>
              <label>
                <span>Seed (optional)</span>
                <input
                  type="text"
                  value={seedInput}
                  onChange={(event) => setSeedInput(event.target.value)}
                  disabled={drawInProgress}
                  placeholder="Leave blank for random seed"
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={drawInProgress || !selectedListId}>
                  {drawInProgress ? "Recording…" : "Draw"}
                </button>
                <button
                  type="button"
                  onClick={handleCopyDrawResults}
                  disabled={drawInProgress || !drawResults.length}
                >
                  Copy Results
                </button>
              </div>
            </form>
            {drawError ? <p className="error-message">{drawError}</p> : null}
            {lastDrawSummary ? (
              <div className="draw-summary">
                <h3>Last Draw</h3>
                <dl>
                  <div>
                    <dt>Count</dt>
                    <dd>{lastDrawSummary.count}</dd>
                  </div>
                  <div>
                    <dt>Scope</dt>
                    <dd>{lastDrawSummary.scope === "group" ? "Selected group" : "Entire list"}</dd>
                  </div>
                  <div>
                    <dt>Group</dt>
                    <dd>{getGroupName(lastDrawSummary.groupId)}</dd>
                  </div>
                  <div>
                    <dt>Minimum Weight</dt>
                    <dd>{lastDrawSummary.minWeight}</dd>
                  </div>
                  <div>
                    <dt>Tags</dt>
                    <dd>{lastDrawSummary.tags.length ? lastDrawSummary.tags.join(", ") : "None"}</dd>
                  </div>
                  <div>
                    <dt>Seed</dt>
                    <dd>{lastDrawSummary.seed ?? "Random"}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
            {drawResults.length ? (
              <ol className="draw-results">
                {drawResults.map((entry) => (
                  <li key={entry.id}>
                    <div className="result-line">
                      <strong>{entry.name}</strong>
                      <span>{` w${entry.weight}`}</span>
                      {entry.link ? (
                        <span>
                          {" "}·{" "}
                          <a href={entry.link} target="_blank" rel="noopener noreferrer">
                            Link
                          </a>
                        </span>
                      ) : null}
                      {entry.tags.length ? <span>{` · ${entry.tags.join(", ")}`}</span> : null}
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        onClick={() => handleCopyResult(entry, "name")}
                        disabled={drawInProgress}
                      >
                        Copy Name
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyResult(entry, "full")}
                        disabled={drawInProgress}
                      >
                        Copy Line
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyResult(entry, "link")}
                        disabled={drawInProgress || !entry.link}
                      >
                        Copy Link
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-state">Run a draw to see results.</p>
            )}
          </div>

          <div className="randomizer-panel">
            <div className="panel-heading">
              <h2>Recent Configurations</h2>
              <div className="panel-heading__actions">
                <button type="button" onClick={handleSavePreset} disabled={!selectedListId}>
                  Save Current
                </button>
                <button type="button" onClick={handleClearPresetList} disabled={!recentPresets.length}>
                  Clear Saved
                </button>
              </div>
            </div>
            {recentPresets.length ? (
              <ul className="preset-list">
                {recentPresets.map((preset) => (
                  <li key={preset.id} className="preset-card">
                    <div className="preset-card__header">
                      <div>
                        <time dateTime={preset.createdAt}>{formatTimestamp(preset.createdAt)}</time>
                        <span className="preset-card__seed">
                          {preset.seed ? `Seed: ${preset.seed}` : "Random seed"}
                        </span>
                      </div>
                      <span className="preset-card__scope">
                        {preset.scope === "group" ? "Group draw" : "Full list"}
                      </span>
                    </div>
                    <div className="preset-card__meta">
                      <span>{`Draw ${preset.drawCount}`}</span>
                      <span>{`Group: ${getGroupName(preset.groupId)}`}</span>
                      <span>{`Min w${preset.minWeight}`}</span>
                      {preset.tags.length ? <span>{`Tags: ${preset.tags.join(", ")}`}</span> : null}
                    </div>
                    <div className="preset-card__actions form-actions">
                      <button type="button" onClick={() => handleApplyPreset(preset)}>
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPresetAndDraw(preset)}
                        disabled={drawInProgress}
                      >
                        Load &amp; Draw
                      </button>
                      <button type="button" onClick={() => handleRemovePreset(preset.id)}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">Saved configurations will appear here after you draw.</p>
            )}
          </div>

          <div className="randomizer-panel">
            <div className="panel-heading">
              <h2>History</h2>
              <div className="panel-heading__actions">
                <button type="button" onClick={handleCopyHistory} disabled={!historyRecords.length}>
                  Copy History
                </button>
                <button type="button" onClick={handleExportHistory} disabled={!historyRecords.length}>
                  Export History
                </button>
                <button
                  type="button"
                  onClick={handleResetHistory}
                  disabled={!historyRecords.length || historyBusy}
                >
                  {historyBusy ? "Clearing…" : "Clear History"}
                </button>
              </div>
            </div>
            {historyRecords.length ? (
              <div className="history-timeline">
                {historyRecords.map((run, index) => {
                  const params = parseRollParams(run.params);
                  const sequence = historyRecords.length - index;
                  return (
                    <article key={run.id} className="history-timeline__item">
                      <div className="history-timeline__marker" aria-hidden="true" />
                      <div className="history-timeline__content">
                        <header className="history-timeline__header">
                          <div>
                            <time dateTime={run.created_at}>{formatTimestamp(run.created_at)}</time>
                            <span className="history-timeline__seed">
                              {run.seed ? `Seed: ${run.seed}` : "Random seed"}
                            </span>
                          </div>
                          <span className="history-timeline__run">{`#${sequence}`}</span>
                        </header>
                        <div className="history-timeline__meta">
                          {params.drawCount !== null ? <span>{`Draw ${params.drawCount}`}</span> : null}
                          <span>{`Scope: ${params.scope === "group" ? "Selected group" : "Entire list"}`}</span>
                          <span>{`Group: ${getGroupName(params.groupId)}`}</span>
                          {params.minWeight !== null ? <span>{`Min w${params.minWeight}`}</span> : null}
                          {params.tags.length ? <span>{`Tags: ${params.tags.join(", ")}`}</span> : null}
                        </div>
                        {run.picks.length ? (
                          <table className="history-picks-table">
                            <thead>
                              <tr>
                                <th scope="col">#</th>
                                <th scope="col">Pick</th>
                                <th scope="col">Weight</th>
                                <th scope="col">Tags</th>
                              </tr>
                            </thead>
                            <tbody>
                              {run.picks.map((pick, pickIndex) => (
                                <tr key={pick.id}>
                                  <td>{pickIndex + 1}</td>
                                  <td>{pick.name}</td>
                                  <td>{`w${pick.weight}`}</td>
                                  <td>{pick.tags.length ? pick.tags.join(", ") : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="empty-state">No picks recorded.</p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">No history yet.</p>
            )}
          </div>
        </div>
      </div>

      <ToastViewport toasts={toasts} onDismiss={removeToast} />
    </section>
  );
};

interface ToastViewportProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const ToastViewport: React.FC<ToastViewportProps> = ({ toasts, onDismiss }) => {
  if (!toasts.length) {
    return null;
  }
  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default JumpRandomizer;
