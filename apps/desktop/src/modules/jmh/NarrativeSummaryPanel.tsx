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

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./NarrativeSummaryPanel.css";
import { useJmhStore } from "./store";

interface NarrativeItem {
  id: string;
  kind: "note" | "recap";
  title: string;
  snippet: string;
  updatedAt: string | null;
  jumpLabel: string;
}

const MAX_ITEMS = 5;

function normalizeText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/[#*_>`~-]/g, "")
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function toSnippet(markdown: string): string {
  const normalized = normalizeText(markdown);
  if (normalized.length <= 240) {
    return normalized;
  }
  return `${normalized.slice(0, 237)}…`;
}

function toTimestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value: string | null): string {
  if (!value) return "Updated just now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return `Updated ${parsed.toLocaleDateString()}`;
}

export const NarrativeSummaryPanel: React.FC = () => {
  const navigate = useNavigate();
  const notes = useJmhStore((state) => state.notes);
  const recaps = useJmhStore((state) => state.recaps);
  const jumps = useJmhStore((state) => state.jumps);

  const items = useMemo(() => {
    if (!notes.length && !recaps.length) {
      return [] as NarrativeItem[];
    }

    const jumpLookup = new Map(jumps.map((jump) => [jump.id, jump.title] as const));

    const noteItems: NarrativeItem[] = notes.map((note) => {
      const title = note.jump_id ? jumpLookup.get(note.jump_id) ?? "Jump note" : "General note";
      const snippet = toSnippet(note.md);
      return {
        id: note.id,
        kind: "note",
        title,
        snippet: snippet || "No prose saved yet.",
        updatedAt: note.updated_at ?? note.created_at ?? null,
        jumpLabel: note.jump_id ? title : "Applies to all jumps",
      };
    });

    const recapItems: NarrativeItem[] = recaps.map((recap) => {
      const title = jumpLookup.get(recap.jump_id) ?? "Untethered recap";
      const snippet = toSnippet(recap.md);
      return {
        id: recap.id,
        kind: "recap",
        title,
        snippet: snippet || "Add highlights from your latest session.",
        updatedAt: recap.created_at ?? null,
        jumpLabel: title,
      };
    });

    return [...noteItems, ...recapItems]
      .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))
      .slice(0, MAX_ITEMS);
  }, [jumps, notes, recaps]);

  return (
    <div className="narrative-panel">
      <header className="narrative-panel__header">
        <div>
          <h2>Narrative Highlights</h2>
          <p>Skim recent notes and recaps, then dive into the studio for full editing.</p>
        </div>
        <button type="button" className="narrative-panel__cta" onClick={() => navigate("/studio")}> 
          Open Story Studio
        </button>
      </header>
      {items.length === 0 ? (
        <div className="narrative-panel__empty">
          <p>No narrative entries yet. Launch the Story Studio to capture your first session recap.</p>
          <button type="button" onClick={() => navigate("/studio")}>
            Start writing
          </button>
        </div>
      ) : (
        <ul className="narrative-panel__list">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="narrative-panel__item">
              <article>
                <div className="narrative-panel__meta">
                  <span className={`narrative-panel__badge narrative-panel__badge--${item.kind}`}>
                    {item.kind === "note" ? "Session Note" : "Recap"}
                  </span>
                  <span className="narrative-panel__timestamp">{formatDate(item.updatedAt)}</span>
                </div>
                <h3>{item.title}</h3>
                <p className="narrative-panel__jump">{item.jumpLabel}</p>
                <p className="narrative-panel__snippet">{item.snippet}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NarrativeSummaryPanel;
