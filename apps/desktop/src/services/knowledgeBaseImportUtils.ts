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

import { formatInputText } from "./formatter";
import type { UpsertKnowledgeArticleInput } from "../db/dao";

export interface KnowledgeBaseArticleDraft {
  path: string;
  payload: UpsertKnowledgeArticleInput;
  meta: {
    fileName: string;
    wordCount: number;
  };
}

const SUMMARY_LIMIT = 280;
const MIN_CONTENT_LENGTH = 20;

export function extractFileName(path: string): string {
  const segments = path.split(/[/\\]/);
  return segments[segments.length - 1] ?? path;
}

export function sanitizeImportedText(raw: string): string {
  const prepared = raw
    .replace(/\u0000/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\f/g, "\n\n")
    .replace(/\r\n?/g, "\n");

  const cleaned = formatInputText(prepared, {
    removeAllLineBreaks: false,
    leaveDoubleLineBreaks: true,
    xmlSafe: true,
  });

  return cleaned.replace(/\n{3,}/g, "\n\n");
}

function deriveTitleFromPath(path: string): string {
  const fileName = extractFileName(path);
  const base = fileName.replace(/\.[^.]+$/, "");
  const normalized = base.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized.length) {
    return "Imported Article";
  }
  return normalized
    .split(" ")
    .map((word) => {
      if (!word.length) {
        return word;
      }
      const lower = word.toLowerCase();
      if (lower === lower.toUpperCase()) {
        return word;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function createSummary(paragraphs: string[], limit = SUMMARY_LIMIT): string | null {
  if (!paragraphs.length) {
    return null;
  }

  const preferred = paragraphs.find((paragraph) => paragraph.length >= 80);
  const fallback = paragraphs.reduce((longest, current) =>
    current.length > longest.length ? current : longest
  );

  const candidate = preferred ?? fallback;
  const normalized = candidate.replace(/\s+/g, " ").trim();
  if (!normalized.length) {
    return null;
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

export function buildArticleDraft(
  path: string,
  rawText: string,
  category = "Imported"
): KnowledgeBaseArticleDraft {
  const content = sanitizeImportedText(rawText).trim();
  if (content.length < MIN_CONTENT_LENGTH) {
    throw new Error("File does not contain enough text to import.");
  }

  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const title = deriveTitleFromPath(path);
  const fileName = extractFileName(path);
  const summary = createSummary(paragraphs);
  const words = content.split(/\s+/).filter(Boolean);

  const payload: UpsertKnowledgeArticleInput = {
    title,
    category,
    summary,
    content,
    tags: [],
    source: fileName,
  };

  return {
    path,
    payload,
    meta: {
      fileName,
      wordCount: words.length,
    },
  };
}
