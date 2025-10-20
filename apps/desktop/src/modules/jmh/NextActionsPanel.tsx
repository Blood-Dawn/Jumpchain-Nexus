/*
MIT License

Copyright (c) 2025 Bloodawn

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

import { useMutation } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { deleteNextAction, upsertNextAction } from "../../db/dao";
import { sortNextActions, useJmhShallow, useJmhStore } from "./store";

const NextActionsPanelComponent: React.FC = () => {
  const [nextActions, setNextActions, selectedJumpId, jumps] = useJmhShallow((state) =>
    [state.nextActions, state.setNextActions, state.selectedJumpId, state.jumps] as const,
  );
  const actions = useMemo(() => sortNextActions(nextActions), [nextActions]);
  const [summary, setSummary] = useState("");
  const [dueDate, setDueDate] = useState<string>("");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!summary.trim()) return;
      const action = {
        id: crypto.randomUUID(),
        jump_id: selectedJumpId ?? (jumps[0]?.id ?? null),
        summary: summary.trim(),
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      } as const;
      await upsertNextAction({ ...action });
      const current = useJmhStore.getState().nextActions;
      setNextActions(sortNextActions([...current, action]));
      setSummary("");
      setDueDate("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteNextAction(id);
      const current = useJmhStore.getState().nextActions;
      setNextActions(current.filter((action) => action.id !== id));
    },
  });

  return (
    <section className="next-actions">
      <header>
        <h2>Pinned Next Actions</h2>
      </header>
      {actions.length === 0 ? (
        <p className="next-actions__empty">
          No tasks yet. Add one to track prep work between jumps.
        </p>
      ) : (
        <ul className="next-actions__list">
          {actions.map((action) => (
            <li key={action.id}>
              <div>
                <strong>{action.summary}</strong>
                {action.due_date && (
                  <time dateTime={action.due_date}>
                    Due {new Date(action.due_date).toLocaleDateString()}
                  </time>
                )}
              </div>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(action.id)}
                disabled={deleteMutation.isPending}
              >
                Done
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="next-actions__form"
        onSubmit={(event) => {
          event.preventDefault();
          createMutation.mutate();
        }}
      >
        <input
          type="text"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="New action…"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
        <button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Adding…" : "Add"}
        </button>
      </form>
    </section>
  );
};

export const NextActionsPanel = React.memo(NextActionsPanelComponent);
NextActionsPanel.displayName = "NextActionsPanel";
