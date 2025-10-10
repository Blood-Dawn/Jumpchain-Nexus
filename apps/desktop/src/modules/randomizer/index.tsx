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
import { drawWeightedWithoutReplacement, type WeightedEntry } from "./weightedPicker";

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

const JumpRandomizerPlaceholder: React.FC = () => {
  return (
    <section className="module randomizer">
      <header>
        <h1>Jump Randomizer</h1>
        <p>Loading randomizer…</p>
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
  const [drawCountInput, setDrawCountInput] = useState("1");
  const [seedInput, setSeedInput] = useState("");
  const [minWeightInput, setMinWeightInput] = useState("0");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [drawScope, setDrawScope] = useState<DrawScope>("all");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

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

  const groupsQuery = useQuery({
    queryKey: selectedListId ? groupsQueryKey(selectedListId) : ["randomizer", "groups", "none"],
    queryFn: () => listRandomizerGroups(selectedListId ?? ""),
    enabled: Boolean(selectedListId),
  });
  const groups = groupsQuery.data ?? [];

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

  const createListMutation = useMutation({
    mutationFn: (input: Parameters<typeof createRandomizerList>[0]) => createRandomizerList(input ?? {}),
    onSuccess: (record) => {
      setSelectedListId(record.id);
      setSelectedGroupId("all");
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

  const handleCreateList = (): void => {
    const name = typeof window !== "undefined" ? window.prompt("Name for the new list?") : null;
    const trimmed = name?.trim();
    createListMutation.mutate(trimmed ? { name: trimmed } : {});
  };

  const handleRenameList = (): void => {
    if (!selectedList) {
      return;
    }
    const next = typeof window !== "undefined" ? window.prompt("Rename list", selectedList.name) : null;
    const trimmed = next?.trim();
    if (!trimmed || trimmed === selectedList.name) {
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

  const handleCreateGroup = (): void => {
    if (!selectedListId) {
      return;
    }
    const name = typeof window !== "undefined" ? window.prompt("Name for the new group?", "New Group") : null;
    const trimmed = name?.trim();
    createGroupMutation.mutate({
      list_id: selectedListId,
      name: trimmed && trimmed.length ? trimmed : undefined,
    });
  };

  const handleRenameGroup = (): void => {
    if (!selectedGroupId || selectedGroupId === "all") {
      return;
    }
    const group = groups.find((item) => item.id === selectedGroupId);
    if (!group) {
      return;
    }
    const next = typeof window !== "undefined" ? window.prompt("Rename group", group.name) : null;
    const trimmed = next?.trim();
    if (!trimmed || trimmed === group.name) {
      return;
    }
    updateGroupMutation.mutate({ id: group.id, updates: { name: trimmed } });
  };

  const handleDeleteGroup = (): void => {
    if (!selectedGroupId || selectedGroupId === "all") {
      return;
    }
    if (groups.length <= 1) {
      setCopyMessage("At least one group is required.");
      return;
    }
    const group = groups.find((item) => item.id === selectedGroupId);
    if (!group) {
      return;
    }
    const confirmDelete =
      typeof window === "undefined"
        ? false
        : window.confirm(`Delete group "${group.name}" and all entries in it?`);
    if (!confirmDelete) {
      return;
    }
    deleteGroupMutation.mutate(group.id);
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
    const drawCount = Number.parseInt(drawCountInput, 10);
    const resolvedCount = Number.isNaN(drawCount) || drawCount <= 0 ? 1 : drawCount;
    if (!filteredEntries.length) {
      setCopyMessage("No entries match the current filters.");
      return;
    }
    const entriesForDraw: WeightedEntry<RandomizerEntryRecord>[] = filteredEntries.map((entry) => ({
      id: entry.id,
      weight: entry.weight,
      payload: entry,
    }));
    const seed = seedInput.trim();
    const rng = createSeededRandom(seed.length ? seed : undefined);
    const picks = drawWeightedWithoutReplacement(entriesForDraw, resolvedCount, rng).map((entry) => entry.payload);
    try {
      await recordRollMutation.mutateAsync({
        listId: selectedListId,
        seed: seed.length ? seed : undefined,
        params: {
          drawCount: resolvedCount,
          scope: filters.scope,
          tags: filters.tags,
          minWeight: filters.minWeight,
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
      setCopyMessage("Roll failed to record.");
    }
  };

  const handleResetHistory = (): void => {
    if (!selectedListId) {
      return;
    }
    clearHistoryMutation.mutate(selectedListId);
  };

  const handleCopyHistory = async (): Promise<void> => {
    if (!historyRecords.length || typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyMessage("Clipboard unavailable");
      return;
    }
    const text = historyRecords
      .map((run, index) => {
        const parts = [`Roll ${index + 1} — ${formatTimestamp(run.created_at)}`];
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
    setCopyMessage("Export downloaded.");
  };

  const listControlsDisabled = createListMutation.isPending || deleteListMutation.isPending;
  const groupControlsDisabled = createGroupMutation.isPending || deleteGroupMutation.isPending;
  const entryControlsDisabled =
    createEntryMutation.isPending || updateEntryMutation.isPending || deleteEntryMutation.isPending;

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
        <p>Configuring randomizer placeholder.data…</p>
      </header>
      <pre className="debug-block">
        {JSON.stringify(
          {
            lists: lists.length,
            selectedListId,
            selectedGroupId,
            selectedEntryId,
            groups: groups.length,
            entries: entries.length,
            history: historyRecords.length,
            drawCountInput,
            minWeightInput,
            seedInput,
            selectedTags,
            drawScope,
            entryFormError,
            hasEntryForm: Boolean(entryForm),
          },
          null,
          2
        )}
      </pre>
    </section>
  );
};

export default JumpRandomizer;
