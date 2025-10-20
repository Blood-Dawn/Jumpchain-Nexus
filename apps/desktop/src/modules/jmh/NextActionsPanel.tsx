/*
Bloodawn

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

type DueStatus = "overdue" | "due-soon" | "upcoming" | "scheduled" | "none";
type PriorityLevel = "urgent" | "high" | "medium" | "low" | "backlog";

interface DueInfo {
  status: DueStatus;
  label: string;
  tooltip: string;
  priorityLevel: PriorityLevel;
  priorityLabel: string;
}

const DAY_IN_MS = 86_400_000;

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }
  return parsed.toLocaleDateString();
};

function getDueInfo(dueDate: string | null): DueInfo {
  if (!dueDate) {
    return {
      status: "none",
      label: "No due date",
      tooltip: "This task is not scheduled yet.",
      priorityLevel: "backlog",
      priorityLabel: "Backlog",
    };
  }

  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    return {
      status: "none",
      label: "Invalid due date",
      tooltip: "The stored due date could not be parsed.",
      priorityLevel: "low",
      priorityLabel: "Low",
    };
  }

  const now = Date.now();
  const diff = parsed.getTime() - now;
  if (diff < 0) {
    return {
      status: "overdue",
      label: `Overdue • ${formatDate(dueDate)}`,
      tooltip: `This task was due on ${formatDate(dueDate)} and needs immediate attention.`,
      priorityLevel: "urgent",
      priorityLabel: "Urgent",
    };
  }

  if (diff <= 3 * DAY_IN_MS) {
    return {
      status: "due-soon",
      label: `Due soon • ${formatDate(dueDate)}`,
      tooltip: `Due within the next three days (${formatDate(dueDate)}).`,
      priorityLevel: "high",
      priorityLabel: "High",
    };
  }

  if (diff <= 7 * DAY_IN_MS) {
    return {
      status: "upcoming",
      label: `Upcoming • ${formatDate(dueDate)}`,
      tooltip: `Planned for ${formatDate(dueDate)} (within the next week).`,
      priorityLevel: "medium",
      priorityLabel: "Medium",
    };
  }

  return {
    status: "scheduled",
    label: `Scheduled • ${formatDate(dueDate)}`,
    tooltip: `Scheduled for ${formatDate(dueDate)}.`,
    priorityLevel: "low",
    priorityLabel: "Low",
  };
}

const PriorityIcon: React.FC<{ level: PriorityLevel }> = ({ level }) => {
  const stroke = "#0f1626";
  const fillMap: Record<PriorityLevel, string> = {
    urgent: "#ff6b6b",
    high: "#ff9f43",
    medium: "#ffd166",
    low: "#54d6bb",
    backlog: "#6b7fa5",
  };

  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      role="img"
      focusable="false"
    >
      <path
        d="M8 1.5l1.9 3.88 4.28.62-3.09 3.02.73 4.26L8 11.7l-3.82 2.02.73-4.26L1.82 6l4.28-.62L8 1.5z"
        fill={fillMap[level]}
        stroke={stroke}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const CalendarIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 16 16"
    role="img"
    focusable="false"
  >
    <rect x="2.5" y="3.5" width="11" height="10" rx="1.4" fill="#1c2a44" stroke="#7acbff" strokeWidth="0.7" />
    <path d="M2.2 6.1h11.6" stroke="#7acbff" strokeWidth="0.7" />
    <path d="M5 1.8v2.8M11 1.8v2.8" stroke="#7acbff" strokeWidth="0.7" strokeLinecap="round" />
  </svg>
);

const NextActionsPanelComponent: React.FC = () => {
  const [nextActions, setNextActions, selectedJumpId, jumps] = useJmhShallow((state) =>
    [state.nextActions, state.setNextActions, state.selectedJumpId, state.jumps] as const,
  );
  const actions = useMemo(() => sortNextActions(nextActions), [nextActions]);
  const [summary, setSummary] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [completingId, setCompletingId] = useState<string | null>(null);

  const jumpLookup = useMemo(() => new Map(jumps.map((jump) => [jump.id, jump])), [jumps]);

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
    mutationFn: async (id: string) => deleteNextAction(id),
  });

  const handleComplete = (id: string) => {
    setCompletingId(id);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        window.setTimeout(() => {
          const current = useJmhStore.getState().nextActions;
          setNextActions(current.filter((action) => action.id !== id));
          setCompletingId((value) => (value === id ? null : value));
        }, 420);
      },
      onError: () => {
        setCompletingId((value) => (value === id ? null : value));
      },
    });
  };

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
          {actions.map((action) => {
            const dueInfo = getDueInfo(action.due_date);
            const jump = action.jump_id ? jumpLookup.get(action.jump_id) : null;
            const itemClassName = [
              "next-actions__list-item",
              `next-actions__list-item--${dueInfo.status}`,
              completingId === action.id ? "is-completing" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const buttonClassName = [
              "next-actions__complete-btn",
              completingId === action.id ? "is-completing" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const jumpLabel = jump?.title ?? "Any Jump";
            const jumpTooltip = jump
              ? [jump.title, jump.world].filter(Boolean).join(" • ")
              : "Available across all jumps";

            return (
              <li key={action.id} className={itemClassName}>
                <div className="next-actions__content">
                  <div className="next-actions__summary-row">
                    <span
                      className={`next-actions__priority next-actions__priority--${dueInfo.priorityLevel}`}
                      aria-label={`Priority: ${dueInfo.priorityLabel}`}
                      title={`Priority: ${dueInfo.priorityLabel}`}
                    >
                      <PriorityIcon level={dueInfo.priorityLevel} />
                      <span>{dueInfo.priorityLabel}</span>
                    </span>
                    <strong>{action.summary}</strong>
                  </div>
                  <div className="next-actions__meta">
                    <span
                      className={`next-actions__due next-actions__due--${dueInfo.status}`}
                      title={dueInfo.tooltip}
                    >
                      <CalendarIcon />
                      <span>{dueInfo.label}</span>
                    </span>
                    <span className="next-actions__chip" title={jumpTooltip}>
                      {jumpLabel}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className={buttonClassName}
                  onClick={() => handleComplete(action.id)}
                  disabled={deleteMutation.isPending && completingId !== action.id}
                >
                  <span className="next-actions__complete-label">Done</span>
                  <span aria-hidden="true" className="next-actions__complete-icon">
                    ✓
                  </span>
                </button>
              </li>
            );
          })}
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
        <button
          type="submit"
          className="next-actions__submit-btn"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? "Adding…" : "Add"}
        </button>
      </form>
    </section>
  );
};

export const NextActionsPanel = React.memo(NextActionsPanelComponent);
NextActionsPanel.displayName = "NextActionsPanel";
