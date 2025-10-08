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

import React from "react";
import type { JumpRecord, RecapRecord } from "../../db/dao";

export interface RecapCardProps {
  recap: RecapRecord;
  jump: JumpRecord | null;
}

function formatDate(input?: string | null): string {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.valueOf())) return input;
  return date.toLocaleDateString();
}

function toSnippet(markdown: string): string {
  return markdown.replace(/[#*_>`-]/g, "").replace(/\s+/g, " ").trim();
}

export const RecapCard: React.FC<RecapCardProps> = ({ recap, jump }) => {
  return (
    <article className="recap-card">
      <header>
        <h3>{jump?.title ?? "Untethered recap"}</h3>
        <span className="recap-card__meta">
          <span className={`recap-card__badge recap-card__badge--${recap.period}`}>
            {recap.period.toUpperCase()}
          </span>
          <time dateTime={recap.created_at}>{formatDate(recap.created_at)}</time>
        </span>
      </header>
      <p>{toSnippet(recap.md)}</p>
    </article>
  );
};
