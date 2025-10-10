from pathlib import Path
from textwrap import dedent

content = dedent("""
import React, { useEffect, useMemo, useState } from \"react\";
import { useMutation, useQuery, useQueryClient } from \"@tanstack/react-query\";
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
} from \"../../db/dao\";
import { drawWeightedWithoutReplacement, type WeightedEntry } from \"./weightedPicker\";

const LISTS_QUERY_KEY = [\"randomizer\", \"lists\"] as const;
const groupsQueryKey = (listId: string) => [\"randomizer\", \"groups\", listId] as const;
const entriesQueryKey = (listId: string) => [\"randomizer\", \"entries\", listId] as const;
const historyQueryKey = (listId: string) => [\"randomizer\", \"history\", listId] as const;
const HISTORY_DISPLAY_LIMIT = 20;

type DrawScope = \"all\" | \"group\";

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
  return tags.join(\", \" );
}

function filtersToInputValue(filters: Record<string, unknown>): string {
  if (!filters || !Object.keys(filters).length) {
    return \"\";
  }
  try {
    return JSON.stringify(filters, null, 2);
  } catch (error) {
    console.warn(\"Failed to stringify entry filters\", error);
    return \"\";
  }
}

function stringToTags(value: string): string[] {
  const unique = new Set<string>();
  for (const raw of value.split(\",\")) {
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
    if (parsed && typeof parsed === \"object\" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.warn(\"Failed to parse filters JSON\", error);
  }
  throw new Error(\"Filters must be a valid JSON object.\");
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

const JumpRandomizer: React.FC = () => {
  const queryClient = useQueryClient();
  const listsQuery = useQuery({ queryKey: LISTS_QUERY_KEY, queryFn: () => listRandomizerLists() });
  const lists = listsQuery.data ?? [];

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | \"all\">(\"all\");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState<EntryFormState | null>(null);
  const [entryFormError, setEntryFormError] = useState<string | null>(null);
  const [drawCountInput, setDrawCountInput] = useState(\"1\");
  const [seedInput, setSeedInput] = useState(\"\");
  const [minWeightInput, setMinWeightInput] = useState(\"0\");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [drawScope, setDrawScope] = useState<DrawScope>(\"all\");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
