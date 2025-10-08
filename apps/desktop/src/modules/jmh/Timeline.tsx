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

import React, { useMemo } from "react";
import { FixedSizeList as List, type ListChildComponentProps } from "react-window";
import type { JumpRecord, RecapRecord } from "../../db/dao";
import { filterRecapsByTimeline, useJmhStore } from "./store";
import { RecapCard } from "./RecapCard";

const ITEM_HEIGHT = 168;

interface RowData {
  items: RecapRecord[];
  jumpLookup: Map<string, JumpRecord>;
}

const TimelineRow: React.FC<ListChildComponentProps<RowData>> = ({ index, style, data }) => {
  const recap = data.items[index];
  const jump = recap.jump_id ? data.jumpLookup.get(recap.jump_id) ?? null : null;
  return (
    <div style={style} className="timeline__row">
      <RecapCard recap={recap} jump={jump} />
    </div>
  );
};

export const Timeline: React.FC = () => {
  const recaps = useJmhStore((state) => state.recaps);
  const jumps = useJmhStore((state) => state.jumps);
  const timelineFilter = useJmhStore((state) => state.timelineFilter);
  const setTimelineFilter = useJmhStore((state) => state.setTimelineFilter);

  const filtered = useMemo(
    () => filterRecapsByTimeline(recaps, jumps, timelineFilter),
    [recaps, jumps, timelineFilter]
  );
  const jumpLookup = useMemo(() => new Map(jumps.map((jump) => [jump.id, jump])), [jumps]);

  return (
    <section className="timeline">
      <header className="timeline__header">
        <h2>Jump Timeline</h2>
        <div className="timeline__filters">
          {(
            [
              { key: "all", label: "All" },
              { key: "current", label: "Current" },
              { key: "past", label: "Past" },
              { key: "future", label: "Future" },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              className={timelineFilter === option.key ? "active" : ""}
              onClick={() => setTimelineFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>
      {filtered.length === 0 ? (
        <div className="timeline__empty">
          <p>No recaps yet. Add one from the Story Studio once you finish your first session.</p>
        </div>
      ) : (
        <List
          height={Math.min(filtered.length * ITEM_HEIGHT, ITEM_HEIGHT * 4)}
          itemCount={filtered.length}
          itemSize={ITEM_HEIGHT}
          width="100%"
          overscanCount={3}
          itemData={{ items: filtered, jumpLookup }}
        >
          {TimelineRow}
        </List>
      )}
    </section>
  );
};
