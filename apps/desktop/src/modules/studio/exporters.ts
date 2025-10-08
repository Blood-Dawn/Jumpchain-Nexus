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

import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import TurndownService from "turndown";
import type {
  ChapterRecord,
  StoryWithChapters,
} from "../../db/dao";
import {
  getChapterText,
  listChapterEntityLinks,
} from "../../db/dao";
import { createEntityMentionExtensions } from "./mentionExtension";

export type StoryExportFormat = "markdown" | "html" | "bbcode";

export interface ExportPayload {
  filename: string;
  content: string;
  mime: string;
}

function entityMapMarkdown(lines: Array<{ name: string; type: string; mentions: number }>): string {
  if (!lines.length) return "";
  const entries = lines
    .map((entry) => `- **${entry.name}** (${entry.type}) — ${entry.mentions} mention${entry.mentions === 1 ? "" : "s"}`)
    .join("\n");
  return `\n\n#### Entity Links\n${entries}`;
}

function entityMapHtml(lines: Array<{ name: string; type: string; mentions: number }>): string {
  if (!lines.length) return "";
  const items = lines
    .map(
      (entry) =>
        `<li><strong>${entry.name}</strong> <em>(${entry.type})</em> — ${entry.mentions} mention${entry.mentions === 1 ? "" : "s"}</li>`,
    )
    .join("");
  return `<section class="entity-links"><h3>Entity Links</h3><ul>${items}</ul></section>`;
}

function entityMapBbcode(lines: Array<{ name: string; type: string; mentions: number }>): string {
  if (!lines.length) return "";
  const items = lines
    .map(
      (entry) =>
        `[li][b]${entry.name}[/b] (${entry.type}) — ${entry.mentions} mention${entry.mentions === 1 ? "" : "s"}[/li]`,
    )
    .join("");
  return `\n[list]${items}[/list]`;
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-z0-9\-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function renderChapterHtml(json: string, entities: Array<{ name: string; type: string; mentions: number }>) {
  const html = generateHTML(JSON.parse(json), [
    StarterKit,
    ...createEntityMentionExtensions({ getEntities: () => [] }),
  ]);
  return { html, links: entities };
}

export async function exportChapter(
  story: StoryWithChapters,
  chapter: ChapterRecord,
  format: StoryExportFormat,
): Promise<ExportPayload> {
  const text = await getChapterText(chapter.id);
  if (!text) {
    throw new Error("Chapter has no saved content yet");
  }
  const entities = await listChapterEntityLinks(chapter.id);
  const normalizedLinks = entities.map((entry) => ({
    name: entry.name,
    type: entry.type,
    mentions: entry.mentions,
  }));
  const { html, links } = renderChapterHtml(text.json, normalizedLinks);
  const turndown = new TurndownService({ headingStyle: "atx" });

  if (format === "html") {
    const content = `<article data-chapter="${chapter.id}">
<h2>${chapter.title}</h2>
${html}
${entityMapHtml(links)}
</article>`;
    return {
      filename: `${sanitizeFileName(`${story.title}-${chapter.title}`)}.html`,
      content,
      mime: "text/html",
    };
  }

  if (format === "markdown") {
  const markdown = `${turndown.turndown(html)}${entityMapMarkdown(links)}`;
    return {
      filename: `${sanitizeFileName(`${story.title}-${chapter.title}`)}.md`,
      content: markdown,
      mime: "text/markdown",
    };
  }

  const markdown = turndown.turndown(html);
  const bbcodeBody = markdown
    .split(/\n{2,}/)
    .map((block: string) => `[p]${block}[/p]`)
    .join("\n");
  const bbcode = `[center][size=140]${chapter.title}[/size][/center]\n${bbcodeBody}${entityMapBbcode(links)}`;
  return {
    filename: `${sanitizeFileName(`${story.title}-${chapter.title}`)}.bbcode`,
    content: bbcode,
    mime: "text/plain",
  };
}

export async function exportStory(
  story: StoryWithChapters,
  format: StoryExportFormat,
): Promise<ExportPayload> {
  const pieces: string[] = [];
  for (const chapter of story.chapters) {
    const payload = await exportChapter(story, chapter, format);
    if (format === "markdown") {
      pieces.push(`## ${chapter.title}\n\n${payload.content}`);
    } else {
      pieces.push(payload.content);
    }
  }

  if (format === "html") {
    const joined = pieces.join("\n");
    return {
      filename: `${sanitizeFileName(story.title)}.html`,
      content: `<main class="story-export"><h1>${story.title}</h1>${joined}</main>`,
      mime: "text/html",
    };
  }

  if (format === "markdown") {
    const joined = pieces.join("\n\n");
    return {
      filename: `${sanitizeFileName(story.title)}.md`,
      content: `# ${story.title}\n\n${joined}`,
      mime: "text/markdown",
    };
  }

  const joined = pieces.join("\n\n");
  return {
    filename: `${sanitizeFileName(story.title)}.bbcode`,
    content: `[center][size=170]${story.title}[/size][/center]\n${joined}`,
    mime: "text/plain",
  };
}
