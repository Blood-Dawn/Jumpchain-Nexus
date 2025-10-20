/*
MIT License

Copyright (c) 2025 Bloodawn

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

import {
  createSummary,
  extractFileName,
  sanitizeImportedText,
} from "./knowledgeBaseImportUtils";
import { getPlatform } from "./platform";

export interface StoryChapterDraft {
  path: string;
  title: string;
  synopsis: string | null;
  plain: string;
  json: string;
}

export interface StoryChapterImportError {
  path: string;
  reason: string;
}

export interface StoryChapterImportSelection {
  drafts: StoryChapterDraft[];
  errors: StoryChapterImportError[];
}

const SUPPORTED_TEXT_EXTENSIONS = new Set(["txt", "md", "markdown"]);
const MIN_CONTENT_LENGTH = 10;

function getExtension(path: string): string {
  const fileName = extractFileName(path);
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) {
    return "";
  }
  return fileName.slice(dotIndex + 1).toLowerCase();
}

function deriveTitleFromPath(path: string): string {
  const fileName = extractFileName(path);
  const base = fileName.replace(/\.[^.]+$/, "");
  const normalized = base.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized.length) {
    return "Imported Chapter";
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

function buildChapterDocument(title: string, paragraphs: string[]) {
  const content: Array<{ type: string; attrs?: Record<string, unknown>; content?: unknown[] }> = [];

  if (title.trim().length) {
    content.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: title }],
    });
  }

  if (paragraphs.length === 0) {
    content.push({ type: "paragraph", content: [] });
  } else {
    for (const paragraph of paragraphs) {
      content.push({
        type: "paragraph",
        content: [{ type: "text", text: paragraph }],
      });
    }
  }

  return { type: "doc", content };
}

async function buildChapterDraft(path: string): Promise<StoryChapterDraft> {
  const ext = getExtension(path);
  if (!SUPPORTED_TEXT_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file type: ${ext ? `.${ext}` : "unknown"}`);
  }

  const platform = await getPlatform();
  const raw = await platform.fs.readTextFile(path);
  const sanitized = sanitizeImportedText(raw).trim();
  if (sanitized.length < MIN_CONTENT_LENGTH) {
    throw new Error("File does not contain enough text to import.");
  }

  const paragraphs = sanitized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);

  const title = deriveTitleFromPath(path);
  const synopsis = createSummary(paragraphs);
  const doc = buildChapterDocument(title, paragraphs);

  return {
    path,
    title,
    synopsis,
    plain: sanitized,
    json: JSON.stringify(doc),
  };
}

export async function collectStoryChapterDraftsFromPaths(
  paths: string[]
): Promise<StoryChapterImportSelection> {
  const drafts: StoryChapterDraft[] = [];
  const errors: StoryChapterImportError[] = [];

  for (const path of paths) {
    try {
      const draft = await buildChapterDraft(path);
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
