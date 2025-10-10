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

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRandomizerPool,
  deleteRandomizerPool,
  listRandomizerPools,
  updateRandomizerPool,
  type RandomizerPoolRecord,
} from "../../db/dao";
import { drawWeightedWithoutReplacement, type WeightedEntry } from "./weightedPicker";

interface PoolFormState {
  id: string;
  name: string;
  weight: string;
  link: string;
}

interface DrawRun {
  id: string;
  timestamp: string;
  picks: RandomizerPoolRecord[];
}

const POOLS_QUERY_KEY = ["randomizer-pools"] as const;

function generateRunId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

const JumpRandomizer: React.FC = () => {
  const queryClient = useQueryClient();
  const poolsQuery = useQuery({ queryKey: POOLS_QUERY_KEY, queryFn: () => listRandomizerPools() });

  const pools = poolsQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formState, setFormState] = useState<PoolFormState | null>(null);
  const [drawCountInput, setDrawCountInput] = useState("1");
  const [history, setHistory] = useState<DrawRun[]>([]);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pools.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !pools.some((pool) => pool.id === selectedId)) {
      setSelectedId(pools[0]!.id);
    }
  }, [pools, selectedId]);

  const selectedPool = useMemo(
    () => pools.find((pool) => pool.id === selectedId) ?? null,
    [pools, selectedId]
  );

  useEffect(() => {
    if (!selectedPool) {
      setFormState(null);
      return;
    }
    setFormState({
      id: selectedPool.id,
      name: selectedPool.name,
      weight: String(Math.max(selectedPool.weight ?? 0, 0)),
      link: selectedPool.link ?? "",
    });
  }, [selectedPool?.id, selectedPool?.name, selectedPool?.weight, selectedPool?.link, selectedPool?.updated_at]);

  useEffect(() => {
    if (!copyMessage || typeof window === "undefined") {
      return;
    }
    const timer = window.setTimeout(() => setCopyMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [copyMessage]);

  const createMutation = useMutation({
    mutationFn: () =>
      createRandomizerPool({
        name: "New Entry",
        weight: 1,
      }),
    onSuccess: (record) => {
      setSelectedId(record.id);
      queryClient.invalidateQueries({ queryKey: POOLS_QUERY_KEY }).catch(() => undefined);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; updates: Parameters<typeof updateRandomizerPool>[1] }) =>
      updateRandomizerPool(payload.id, payload.updates),
    onSuccess: (record) => {
      setFormState({
        id: record.id,
        name: record.name,
        weight: String(record.weight ?? 0),
        link: record.link ?? "",
      });
      queryClient.invalidateQueries({ queryKey: POOLS_QUERY_KEY }).catch(() => undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRandomizerPool(id),
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: POOLS_QUERY_KEY }).catch(() => undefined);
    },
  });

  const availablePools = useMemo(
    () => pools.filter((pool) => (pool.weight ?? 0) > 0),
    [pools]
  );

  const totalWeight = useMemo(
    () => availablePools.reduce((sum, pool) => sum + Math.max(pool.weight ?? 0, 0), 0),
    [availablePools]
  );

  const resolvedDrawCount = useMemo(() => {
    const parsed = Number.parseInt(drawCountInput, 10);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return Math.max(0, parsed);
  }, [drawCountInput]);

  const handleSave = (): void => {
    if (!formState) {
      return;
    }
    const name = formState.name.trim().length ? formState.name.trim() : "New Entry";
    const link = formState.link.trim();
    const weightValue = Number.parseInt(formState.weight, 10);
    const normalizedWeight = Number.isNaN(weightValue) ? 0 : Math.max(0, weightValue);
    updateMutation.mutate({
      id: formState.id,
      updates: {
        name,
        weight: normalizedWeight,
        link: link.length ? link : null,
      },
    });
  };

  const handleDelete = (): void => {
    if (!selectedPool) {
      return;
    }
    deleteMutation.mutate(selectedPool.id);
  };

  const handleDraw = (): void => {
    if (!availablePools.length || resolvedDrawCount <= 0) {
      return;
    }
    const entries: WeightedEntry<RandomizerPoolRecord>[] = availablePools.map((pool) => ({
      id: pool.id,
      weight: pool.weight,
      payload: pool,
    }));
    const picks = drawWeightedWithoutReplacement(entries, Math.min(resolvedDrawCount, entries.length)).map(
      (entry) => entry.payload
    );
    const runId = generateRunId();
    const timestamp = new Date().toISOString();
    setHistory((prev) => [{ id: runId, timestamp, picks }, ...prev].slice(0, 10));
  };

  const handleResetHistory = (): void => {
    setHistory([]);
  };

  const handleCopyHistory = async (): Promise<void> => {
    if (!history.length || typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyMessage("Clipboard unavailable");
      return;
    }
    const text = history
      .map((run, index) => {
        const header = `Roll ${index + 1} — ${formatTimestamp(run.timestamp)}`;
        if (!run.picks.length) {
          return header;
        }
        const lines = run.picks.map((pick, idx) => {
          const parts = [`${idx + 1}. ${pick.name}`];
          if (pick.link) {
            parts.push(`(${pick.link})`);
          }
          parts.push(`w${pick.weight}`);
          return parts.join(" ");
        });
        return [header, ...lines].join("\n");
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Results copied to clipboard.");
    } catch (error) {
      console.warn("Failed to copy results", error);
      setCopyMessage("Clipboard copy failed");
    }
  };

  const handleExportHistory = (): void => {
    if (!history.length || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const payload = history.map((run) => ({
      id: run.id,
      timestamp: run.timestamp,
      picks: run.picks.map((pick) => ({
        id: pick.id,
        name: pick.name,
        weight: pick.weight,
        link: pick.link,
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

  return (
    <section className="module randomizer">
      <header>
        <h1>Jump Randomizer</h1>
        <p>Manage weighted pools, run without-replacement rolls, and keep a shareable history.</p>
      </header>

      <div className="randomizer-layout">
        <div className="randomizer-pools">
          <div className="randomizer-toolbar">
            <button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              New entry
            </button>
            <span className="randomizer-summary">{pools.length} total entries</span>
          </div>
          {poolsQuery.isError ? (
            <p role="alert">Failed to load pools.</p>
          ) : poolsQuery.isLoading ? (
            <p>Loading pools…</p>
          ) : pools.length ? (
            <ul className="randomizer-pool-list">
              {pools.map((pool) => {
                const isSelected = pool.id === selectedId;
                return (
                  <li key={pool.id} className={isSelected ? "selected" : undefined}>
                    <button type="button" onClick={() => setSelectedId(pool.id)}>
                      <span className="name">{pool.name}</span>
                      <span className="weight">w{pool.weight}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No entries yet. Create one to get started.</p>
          )}
        </div>

        <div className="randomizer-form">
          <h2>Pool details</h2>
          {formState ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSave();
              }}
            >
              <label className="field">
                <span>Name</span>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                  placeholder="Entry name"
                />
              </label>
              <label className="field">
                <span>Weight</span>
                <input
                  type="number"
                  min="0"
                  value={formState.weight}
                  onChange={(event) => setFormState({ ...formState, weight: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Link</span>
                <input
                  type="url"
                  value={formState.link}
                  onChange={(event) => setFormState({ ...formState, link: event.target.value })}
                  placeholder="Optional reference URL"
                />
              </label>
              <div className="actions">
                <button type="submit" disabled={updateMutation.isPending}>
                  Save changes
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </button>
              </div>
            </form>
          ) : (
            <p>Select an entry to edit its details.</p>
          )}
        </div>

        <div className="randomizer-controls">
          <h2>Weighted selection</h2>
          <div className="control-row">
            <label>
              Draw count
              <input
                type="number"
                min="1"
                value={drawCountInput}
                onChange={(event) => setDrawCountInput(event.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={handleDraw}
              disabled={!availablePools.length || resolvedDrawCount <= 0}
            >
              Roll picks
            </button>
            <button type="button" onClick={handleResetHistory} disabled={!history.length}>
              Clear history
            </button>
          </div>
          <p className="control-hint">
            {availablePools.length} weighted entries available (total weight {totalWeight}). Each roll is without
            replacement per run.
          </p>
        </div>
      </div>

      <section className="randomizer-results">
        <header>
          <h2>Recent results</h2>
          <div className="result-actions">
            <button type="button" onClick={handleCopyHistory} disabled={!history.length}>
              Copy results
            </button>
            <button type="button" onClick={handleExportHistory} disabled={!history.length}>
              Export JSON
            </button>
            {copyMessage ? <span className="status">{copyMessage}</span> : null}
          </div>
        </header>
        {history.length ? (
          <div className="result-list">
            {history.map((run) => (
              <article key={run.id} className="result-run">
                <header>
                  <strong>{formatTimestamp(run.timestamp)}</strong>
                </header>
                {run.picks.length ? (
                  <ol>
                    {run.picks.map((pick) => (
                      <li key={pick.id}>
                        <span className="name">{pick.name}</span>
                        <span className="weight">w{pick.weight}</span>
                        {pick.link ? (
                          <a href={pick.link} target="_blank" rel="noreferrer">
                            Link
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>No picks produced.</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p>No rolls yet. Configure your pool and press “Roll picks”.</p>
        )}
      </section>
    </section>
  );
};

export default JumpRandomizer;
