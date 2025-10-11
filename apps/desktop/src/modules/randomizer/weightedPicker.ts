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

export interface WeightedEntry<T = unknown> {
  id: string;
  weight: number;
  payload: T;
}

export interface WeightedDrawStep<T = unknown> {
  roll: number;
  totalWeight: number;
  available: WeightedEntry<T>[];
  selected: WeightedEntry<T>;
}

export interface WeightedDrawResult<T = unknown> {
  picks: WeightedEntry<T>[];
  steps: WeightedDrawStep<T>[];
}

export interface WeightedClipboardPick {
  id?: string;
  entryId?: string | null;
  position?: number;
  name: string;
  weight: number;
  link?: string | null;
  tags?: string[];
}

export interface WeightedHistoryRun {
  id?: string;
  listId?: string;
  createdAt: string;
  seed?: string | null;
  params?: Record<string, unknown> | null;
  picks: WeightedClipboardPick[];
}

export interface WeightedHistoryExportRun {
  id?: string;
  list_id?: string;
  created_at: string;
  seed: string | null;
  params: Record<string, unknown> | null;
  picks: WeightedHistoryExportPick[];
}

export interface WeightedHistoryExportPick {
  id?: string;
  entry_id?: string | null;
  name: string;
  weight: number;
  link: string | null;
  tags: string[];
  position: number;
}

interface DrawOptions {
  captureSteps?: boolean;
}

function isValidWeight(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function cloneEntry<T>(entry: WeightedEntry<T>): WeightedEntry<T> {
  return { ...entry };
}

export function formatWeightedPickSummary(
  pick: WeightedClipboardPick,
  options: { includePosition?: boolean; positionOverride?: number } = {}
): string {
  const includePosition = options.includePosition ?? false;
  const position = options.positionOverride ?? pick.position;
  const tags = Array.isArray(pick.tags) ? pick.tags : [];
  const segments: string[] = [];

  if (includePosition) {
    const ordinal = typeof position === "number" && Number.isFinite(position) ? position : undefined;
    if (ordinal !== undefined) {
      segments.push(`${ordinal}. ${pick.name}`);
    } else {
      segments.push(pick.name);
    }
  } else {
    segments.push(pick.name);
  }

  if (pick.link) {
    segments.push(`(${pick.link})`);
  }

  segments.push(`w${pick.weight}`);

  if (tags.length) {
    segments.push(`[${Array.from(new Set(tags)).join(", ")}]`);
  }

  return segments.join(" ");
}

export function formatWeightedDrawForClipboard(picks: WeightedClipboardPick[]): string {
  if (!Array.isArray(picks) || !picks.length) {
    return "";
  }

  return picks
    .map((pick, index) =>
      formatWeightedPickSummary(pick, {
        includePosition: true,
        positionOverride: pick.position ?? index + 1,
      })
    )
    .join("\n");
}

export function formatWeightedHistoryForClipboard(
  runs: WeightedHistoryRun[],
  options: { formatTimestamp?: (iso: string) => string } = {}
): string {
  if (!Array.isArray(runs) || !runs.length) {
    return "";
  }

  const formatTimestamp = options.formatTimestamp ?? ((iso: string) => iso);

  return runs
    .map((run, index) => {
      const headerParts = [`Roll ${index + 1} — ${formatTimestamp(run.createdAt)}`];
      if (run.seed) {
        headerParts.push(`Seed: ${run.seed}`);
      }
      const header = headerParts.join(" | ");
      if (!Array.isArray(run.picks) || !run.picks.length) {
        return header;
      }
      const lines = run.picks.map((pick, pickIndex) =>
        formatWeightedPickSummary(pick, {
          includePosition: true,
          positionOverride: pick.position ?? pickIndex + 1,
        })
      );
      return [header, ...lines].join("\n");
    })
    .join("\n\n");
}

export function createHistoryExportPayload(runs: WeightedHistoryRun[]): WeightedHistoryExportRun[] {
  if (!Array.isArray(runs) || !runs.length) {
    return [];
  }

  return runs.map((run) => ({
    id: run.id,
    list_id: run.listId,
    created_at: run.createdAt,
    seed: run.seed ?? null,
    params: run.params && typeof run.params === "object" && !Array.isArray(run.params) ? run.params : {},
    picks: Array.isArray(run.picks)
      ? run.picks.map((pick, index) => ({
          id: pick.id,
          entry_id: pick.entryId ?? null,
          name: pick.name,
          weight: pick.weight,
          link: pick.link ?? null,
          tags: Array.isArray(pick.tags) ? pick.tags : [],
          position: pick.position ?? index + 1,
        }))
      : [],
  }));
}

export function drawWeightedWithoutReplacement<T>(
  entries: WeightedEntry<T>[],
  count: number,
  rng?: () => number
): WeightedEntry<T>[];
export function drawWeightedWithoutReplacement<T>(
  entries: WeightedEntry<T>[],
  count: number,
  rng: () => number,
  options: { captureSteps: true }
): WeightedDrawResult<T>;
export function drawWeightedWithoutReplacement<T>(
  entries: WeightedEntry<T>[],
  count: number,
  rng: () => number = Math.random,
  options: DrawOptions = {}
): WeightedEntry<T>[] | WeightedDrawResult<T> {
  if (!Array.isArray(entries) || !entries.length || count <= 0) {
    return options.captureSteps ? { picks: [], steps: [] } : [];
  }

  const pool = entries.filter((entry) => isValidWeight(entry.weight)).map(cloneEntry);
  const limit = Math.min(count, pool.length);
  const results: WeightedEntry<T>[] = [];
  const steps: WeightedDrawStep<T>[] = [];

  for (let pickIndex = 0; pickIndex < limit; pickIndex += 1) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    if (!isValidWeight(totalWeight)) {
      break;
    }

    const roll = rng() * totalWeight;
    const poolSnapshot = pool.map(cloneEntry);

    let threshold = roll;
    let selectedIndex = pool.length - 1;

    for (let index = 0; index < pool.length; index += 1) {
      threshold -= pool[index]!.weight;
      if (threshold <= 0) {
        selectedIndex = index;
        break;
      }
    }

    const [selected] = pool.splice(selectedIndex, 1);
    if (!selected) {
      break;
    }

    results.push(selected);

    if (options.captureSteps) {
      steps.push({
        roll,
        totalWeight,
        available: poolSnapshot,
        selected,
      });
    }
  }

  if (options.captureSteps) {
    return { picks: results, steps };
  }

  return results;
}
