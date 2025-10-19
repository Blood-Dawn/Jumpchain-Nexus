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

import type { UpsertKnowledgeArticleInput } from "../db/dao";
import {
  buildArticleDraft,
  extractFileName,
  type KnowledgeBaseArticleDraft,
} from "./knowledgeBaseImportUtils";
import type { KnowledgeArticleRecord } from "../db/dao";
import { openFileDialog } from "./dialogService";
import { getPlatform } from "./platform";

export interface KnowledgeBaseImportError {
  path: string;
  reason: string;
}

export interface KnowledgeBaseImportSelection {
  drafts: KnowledgeBaseArticleDraft[];
  errors: KnowledgeBaseImportError[];
}

const SUPPORTED_TEXT_EXTENSIONS = new Set(["txt", "md", "markdown"]);

function getExtension(path: string): string {
  const fileName = extractFileName(path);
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) {
    return "";
  }
  return fileName.slice(dotIndex + 1).toLowerCase();
}

async function buildDraftFromFile(path: string): Promise<KnowledgeBaseArticleDraft> {
  const ext = getExtension(path);

  if (ext === "pdf") {
    const { readPdfText } = await import("./pdfText");
    const result = await readPdfText(path);
    const text = result.text;
    return buildArticleDraft(path, text, "Imported");
  }

  if (SUPPORTED_TEXT_EXTENSIONS.has(ext)) {
    const platform = await getPlatform();
    const raw = await platform.fs.readTextFile(path);
    return buildArticleDraft(path, raw, "Imported");
  }

  throw new Error(`Unsupported file type: ${ext ? `.${ext}` : "unknown"}`);
}

async function buildSelectionFromPaths(paths: string[]): Promise<KnowledgeBaseImportSelection> {
  const drafts: KnowledgeBaseArticleDraft[] = [];
  const errors: KnowledgeBaseImportError[] = [];

  for (const path of paths) {
    try {
      const draft = await buildDraftFromFile(path);
      drafts.push(draft);
    } catch (error) {
      errors.push({
        path,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { drafts, errors };
}

export async function collectKnowledgeBaseDraftsFromPaths(
  paths: string[]
): Promise<KnowledgeBaseImportSelection> {
  return buildSelectionFromPaths(paths);
}

export async function promptKnowledgeBaseImport(): Promise<KnowledgeBaseImportSelection | null> {
  const selection = await openFileDialog({
    title: "Import knowledge base articles",
    multiple: true,
    filters: [
      { name: "Knowledge resources", extensions: ["pdf", "txt", "md", "markdown"] },
      { name: "PDF", extensions: ["pdf"] },
      { name: "Text", extensions: ["txt", "md", "markdown"] },
    ],
  });

  if (!selection || selection.length === 0) {
    return null;
  }

  const result = await buildSelectionFromPaths(selection);

  return result;
}

export interface KnowledgeBaseImportProgress {
  processed: number;
  total: number;
  saved: number;
  failed: number;
  currentPath: string | null;
}

export interface KnowledgeBaseImportOptions {
  signal?: AbortSignal;
  onProgress?: (progress: KnowledgeBaseImportProgress) => void;
  waitIfPaused?: () => Promise<void> | void;
}

export async function importKnowledgeBaseArticles(
  drafts: KnowledgeBaseArticleDraft[],
  save: (payload: UpsertKnowledgeArticleInput) => Promise<KnowledgeArticleRecord>,
  options: KnowledgeBaseImportOptions = {}
): Promise<{ saved: KnowledgeArticleRecord[]; errors: KnowledgeBaseImportError[]; cancelled: boolean }> {
  const saved: KnowledgeArticleRecord[] = [];
  const errors: KnowledgeBaseImportError[] = [];
  const total = drafts.length;

  const emitProgress = (currentPath: string | null = null) => {
    options.onProgress?.({
      processed: saved.length + errors.length,
      total,
      saved: saved.length,
      failed: errors.length,
      currentPath,
    });
  };

  const finish = (cancelled: boolean) => {
    emitProgress(null);
    return { saved, errors, cancelled };
  };

  emitProgress(null);

  for (const draft of drafts) {
    if (options.signal?.aborted) {
      return finish(true);
    }

    emitProgress(draft.path);

    if (options.waitIfPaused) {
      await options.waitIfPaused();
    }

    if (options.signal?.aborted) {
      return finish(true);
    }

    try {
      const record = await save(draft.payload);
      saved.push(record);
    } catch (error) {
      errors.push({
        path: draft.path,
        reason: error instanceof Error ? error.message : "Failed to save article",
      });
    }

    emitProgress(null);
  }

  return finish(options.signal?.aborted ?? false);
}
