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

import React, { useCallback, useMemo, useState } from "react";
import {
  createJump,
  deleteJump,
  duplicateJump,
  listJumps,
  reorderJumps,
  summarizeJumpBudget,
  type JumpRecord,
  type JumpBudgetSummary,
  loadFormatterSettings,
} from "../../db/dao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBudget } from "../../services/formatter";

interface JumpFormState {
  title: string;
  world: string;
  cpBudget: number;
}

const DEFAULT_FORM: JumpFormState = {
  title: "",
  world: "",
  cpBudget: 1000,
};

const formatDate = (value: string | null): string => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch (error) {
    return value.slice(0, 10);
  }
};

const JumpBudget: React.FC<{
  jumpId: string;
  expanded: boolean;
  formatBudgetValue: (value: number) => string;
}> = ({ jumpId, expanded, formatBudgetValue }) => {
  const budgetQuery = useQuery({
    queryKey: ["jump-budget", jumpId],
    queryFn: () => summarizeJumpBudget(jumpId),
    enabled: expanded,
  });

  if (!expanded) {
    return null;
  }

  if (budgetQuery.isLoading) {
    return <p className="jump-hub__summary">Loading budget…</p>;
  }

  if (budgetQuery.isError || !budgetQuery.data) {
    return <p className="jump-hub__summary jump-hub__summary--error">Failed to load budget.</p>;
  }

  const summary = budgetQuery.data as JumpBudgetSummary;

  return (
    <div className="jump-hub__summary">
      <div>
        <strong>Spent:</strong> {formatBudgetValue(summary.netCost)}
      </div>
      <div>
        <strong>Discounted:</strong> {formatBudgetValue(summary.discounted)}
      </div>
      <div>
        <strong>Freebies:</strong> {formatBudgetValue(summary.freebies)}
      </div>
      <div>
        <strong>Drawback Credit:</strong> {formatBudgetValue(summary.drawbackCredit)}
      </div>
      <div>
        <strong>Balance:</strong> {formatBudgetValue(summary.balance)}
      </div>
    </div>
  );
};

const JumpRow: React.FC<{
  jump: JumpRecord;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  formatBudgetValue: (value: number) => string;
}> = ({ jump, index, total, expanded, onToggle, onMove, onDuplicate, onDelete, formatBudgetValue }) => {
  const remaining = jump.cp_budget + jump.cp_income - jump.cp_spent;
  return (
    <article className={`jump-hub__card${expanded ? " jump-hub__card--expanded" : ""}`}>
      <header className="jump-hub__card-header">
        <button type="button" className="jump-hub__card-toggle" onClick={() => onToggle(jump.id)}>
          <div className="jump-hub__card-title">
            <h3>{jump.title}</h3>
            {jump.world && <span className="jump-hub__chip">{jump.world}</span>}
          </div>
          <dl className="jump-hub__metrics">
            <div>
              <dt>Budget</dt>
              <dd>{formatBudgetValue(jump.cp_budget)}</dd>
            </div>
            <div>
              <dt>Spent</dt>
              <dd>{formatBudgetValue(jump.cp_spent)}</dd>
            </div>
            <div>
              <dt>Drawbacks</dt>
              <dd>{formatBudgetValue(jump.cp_income)}</dd>
            </div>
            <div>
              <dt>Remaining</dt>
              <dd className={remaining < 0 ? "jump-hub__metric--negative" : undefined}>
                {formatBudgetValue(remaining)}
              </dd>
            </div>
          </dl>
        </button>
        <div className="jump-hub__actions">
          <button type="button" onClick={() => onMove(jump.id, -1)} disabled={index === 0}>
            ↑
          </button>
          <button type="button" onClick={() => onMove(jump.id, 1)} disabled={index === total - 1}>
            ↓
          </button>
          <button type="button" onClick={() => onDuplicate(jump.id)}>
            Duplicate
          </button>
          <button type="button" className="jump-hub__danger" onClick={() => onDelete(jump.id)}>
            Delete
          </button>
        </div>
      </header>
      <div className="jump-hub__meta">
        <div>
          <strong>Status:</strong> {jump.status ?? "planned"}
        </div>
        <div>
          <strong>Starts:</strong> {formatDate(jump.start_date)}
        </div>
        <div>
          <strong>Ends:</strong> {formatDate(jump.end_date)}
        </div>
      </div>
      <JumpBudget jumpId={jump.id} expanded={expanded} formatBudgetValue={formatBudgetValue} />
    </article>
  );
};

const JumpchainOverview: React.FC = () => {
  const queryClient = useQueryClient();
  const jumpsQuery = useQuery({ queryKey: ["jumps"], queryFn: listJumps });
  const formatterSettingsQuery = useQuery({
    queryKey: ["app-settings", "formatter"],
    queryFn: loadFormatterSettings,
  });
  const [formState, setFormState] = useState<JumpFormState>(DEFAULT_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const thousandsSeparator = formatterSettingsQuery.data?.thousandsSeparator ?? "none";
  const formatBudgetValue = useCallback(
    (value: number) => formatBudget(value, thousandsSeparator),
    [thousandsSeparator]
  );

  const createMutation = useMutation({
    mutationFn: createJump,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jumps"] }).catch(() => undefined);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (jumpId: string) => duplicateJump(jumpId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jumps"] }).catch(() => undefined);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteJump,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jumps"] }).catch(() => undefined);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderJumps,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jumps"] }).catch(() => undefined);
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) {
      return;
    }
    await createMutation.mutateAsync({
      title: formState.title.trim(),
      world: formState.world.trim() || null,
      status: "planned",
  cp_budget: Number.isFinite(formState.cpBudget) ? Math.max(formState.cpBudget, 0) : 0,
      start_date: new Date().toISOString(),
    });
    setFormState(DEFAULT_FORM);
    setFormOpen(false);
  };

  const handleMove = (id: string, direction: -1 | 1) => {
    if (!jumpsQuery.data) return;
    const currentOrder = [...jumpsQuery.data];
    const index = currentOrder.findIndex((jump) => jump.id === id);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= currentOrder.length) return;
    const [entry] = currentOrder.splice(index, 1);
    currentOrder.splice(target, 0, entry);
    reorderMutation.mutate(currentOrder.map((jump) => jump.id));
  };

  const jumps = useMemo(() => jumpsQuery.data ?? [], [jumpsQuery.data]);

  return (
    <section className="jump-hub">
      <header className="jump-hub__header">
        <div>
          <h1>Jump Hub</h1>
          <p>Manage every jump, budget, and quick action across your chain.</p>
        </div>
        <button type="button" className="jump-hub__cta" onClick={() => setFormOpen((open) => !open)}>
          {formOpen ? "Cancel" : "New Jump"}
        </button>
      </header>

      {formOpen && (
        <form className="jump-hub__form" onSubmit={handleSubmit}>
          <label>
            <span>Jump Title</span>
            <input
              type="text"
              value={formState.title}
              onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
          </label>
          <label>
            <span>Universe</span>
            <input
              type="text"
              value={formState.world}
              onChange={(event) => setFormState((prev) => ({ ...prev, world: event.target.value }))}
            />
          </label>
          <label>
            <span>CP Budget</span>
            <input
              type="number"
              min={0}
              value={formState.cpBudget}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, cpBudget: Number(event.target.value) }))
              }
            />
          </label>
          <div className="jump-hub__form-actions">
            <button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Jump"}
            </button>
          </div>
        </form>
      )}

      <div className="jump-hub__list">
        {jumpsQuery.isLoading && <p className="jump-hub__empty">Loading jumps…</p>}
        {jumpsQuery.isError && <p className="jump-hub__empty">Failed to load jumps.</p>}
        {!jumpsQuery.isLoading && !jumps.length && (
          <p className="jump-hub__empty">No jumps yet. Create one to get started.</p>
        )}
        {jumps.map((jump, index) => (
          <JumpRow
            key={jump.id}
            jump={jump}
            index={index}
            total={jumps.length}
            expanded={expanded === jump.id}
            onToggle={(id) => setExpanded((current) => (current === id ? null : id))}
            onMove={handleMove}
            onDuplicate={(id) => duplicateMutation.mutate(id)}
            onDelete={(id) => deleteMutation.mutate(id)}
            formatBudgetValue={formatBudgetValue}
          />
        ))}
      </div>
    </section>
  );
};

export default JumpchainOverview;
