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

import React, { useEffect, useMemo, useState } from "react";
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
import {
  createHistoryExportPayload,
  drawWeightedWithoutReplacement,
  formatWeightedDrawForClipboard,
  formatWeightedHistoryForClipboard,
  formatWeightedPickSummary,
  type WeightedEntry,
  type WeightedHistoryRun,
} from "./weightedPicker";

const LISTS_QUERY_KEY = ["randomizer", "lists"] as const;
const groupsQueryKey = (listId: string) => ["randomizer", "groups", listId] as const;
const entriesQueryKey = (listId: string) => ["randomizer", "entries", listId] as const;
const historyQueryKey = (listId: string) => ["randomizer", "history", listId] as const;
const HISTORY_DISPLAY_LIMIT = 20;

type DrawScope = "all" | "group";

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
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawResults, setDrawResults] = useState<RandomizerEntryRecord[]>([]);
  const [lastDrawSummary, setLastDrawSummary] = useState<DrawSummary | null>(null);

  useEffect(() => {
    if (!lists.length) {
      setSelectedListId(null);
      return;
    }
    if (!selectedListId || !lists.some((list) => list.id === selectedListId)) {
      setSelectedListId(lists[0]!.id);
    }
  }, [lists, selectedListId]);

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
  const historySnapshots = useMemo<WeightedHistoryRun[]>(
    () =>
      historyRecords.map((run) => ({
        id: run.id,
        listId: run.list_id,
        createdAt: run.created_at,
        seed: run.seed,
        params: run.params,
        picks: run.picks.map((pick) => ({
          id: pick.id,
          entryId: pick.entry_id,
          position: pick.position,
          name: pick.name,
          weight: pick.weight,
          link: pick.link,
          tags: pick.tags,
        })),
      })),
    [historyRecords]
  );

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
      setCopyMessage("At least one group is required.");
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

  const handleEntryFieldChange =
    (field: keyof EntryFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setEntryForm((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          [field]: value,
        };
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

  const getGroupName = (groupId: string | "all"): string => {
    if (groupId === "all") {
      return "All groups";
    }
    const group = groups.find((item) => item.id === groupId);
    return group?.name ?? "Unknown group";
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
    } catch (error) {
      console.warn("Failed to record randomizer roll", error);
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to record randomizer roll.";
      setDrawError(message);
      setCopyMessage("Roll failed to record.");
    }
  };

  const handleCopyResult = async (entry: RandomizerEntryRecord, mode: "name" | "link" | "full") => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyMessage("Clipboard unavailable");
      return;
    }
    if (mode === "link" && !entry.link) {
      setCopyMessage("Entry has no link to copy.");
      return;
    }
    let text = entry.name;
    if (mode === "link") {
      text = entry.link ?? "";
    } else if (mode === "full") {
      text = formatWeightedPickSummary({
        id: entry.id,
        entryId: entry.id,
        name: entry.name,
        weight: entry.weight,
        link: entry.link,
        tags: entry.tags,
      });
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Copied to clipboard.");
    } catch (error) {
      console.warn("Failed to copy result", error);
      setCopyMessage("Clipboard copy failed.");
    }
  };

  const handleCopyDrawResults = async (): Promise<void> => {
    if (!drawResults.length) {
      setCopyMessage("No results available to copy.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyMessage("Clipboard unavailable");
      return;
    }
    const text = formatWeightedDrawForClipboard(
      drawResults.map((entry, index) => ({
        id: entry.id,
        entryId: entry.id,
        position: index + 1,
        name: entry.name,
        weight: entry.weight,
        link: entry.link,
        tags: entry.tags,
      }))
    );
    if (!text.length) {
      setCopyMessage("No results available to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Results copied to clipboard.");
    } catch (error) {
      console.warn("Failed to copy results", error);
      setCopyMessage("Clipboard copy failed.");
    }
  };

  const handleResetHistory = (): void => {
    if (!selectedListId) {
      return;
    }
    clearHistoryMutation.mutate(selectedListId);
  };

  const handleCopyHistory = async (): Promise<void> => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyMessage("Clipboard unavailable");
      return;
    }
    const text = formatWeightedHistoryForClipboard(historySnapshots, { formatTimestamp });
    if (!text.length) {
      setCopyMessage("No history available to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Results copied to clipboard.");
    } catch (error) {
      console.warn("Failed to copy results", error);
      setCopyMessage("Clipboard copy failed.");
    }
  };

  const handleExportHistory = (): void => {
    if (!historyRecords.length || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const payload = createHistoryExportPayload(historySnapshots);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `randomizer-results-${Date.now()}.json`;
    anchor.rel = "noopener";
    anchor.click();
    window.URL.revokeObjectURL(url);
    setCopyMessage("Export downloaded.");
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
            <h2>History</h2>
            {historyRecords.length ? (
              <ul className="history-list">
                {historyRecords.map((run) => (
                  <li key={run.id}>
                    <div className="history-header">
                      <strong>{formatTimestamp(run.created_at)}</strong>
                      {run.seed ? <span>{` · Seed: ${run.seed}`}</span> : null}
                    </div>
                    <div className="history-meta">
                      Draw {run.params.drawCount} · Scope {run.params.scope}
                      {Array.isArray(run.params.tags) && run.params.tags.length
                        ? ` · Tags ${run.params.tags.join(", ")}`
                        : ""}
                      {typeof run.params.minWeight === "number" ? ` · Min w${run.params.minWeight}` : ""}
                    </div>
                    {run.picks.length ? (
                      <ol className="history-picks">
                        {run.picks.map((pick) => (
                          <li key={pick.id}>
                            {pick.name}
                            <span>{` w${pick.weight}`}</span>
                            {pick.tags.length ? <span>{` [${pick.tags.join(", ")}]`}</span> : null}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="empty-state">No picks recorded.</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No history yet.</p>
            )}
            <div className="form-actions">
              <button type="button" onClick={handleCopyHistory} disabled={!historyRecords.length}>
                Copy History
              </button>
              <button type="button" onClick={handleExportHistory} disabled={!historyRecords.length}>
                Export History
              </button>
              <button type="button" onClick={handleResetHistory} disabled={!historyRecords.length || historyBusy}>
                {historyBusy ? "Clearing…" : "Clear History"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {copyMessage ? <p className="status-message">{copyMessage}</p> : null}
    </section>
  );
};

export default JumpRandomizer;
