/*
Bloodawn

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
  buildArticleDraft,
  type KnowledgeBaseArticleDraft,
} from "./knowledgeBaseImportUtils";

export type KnowledgeBaseCuratedSourceType = "reddit-thread" | "fandom-page";

export interface KnowledgeBaseCuratedSource {
  id: string;
  name: string;
  description: string;
  url: string;
  type: KnowledgeBaseCuratedSourceType;
  category: string;
  tags: string[];
}

export interface KnowledgeBaseWebSourceMetadata {
  id: string;
  url: string;
  fetchedAt: string;
  title: string;
  author?: string;
  type: KnowledgeBaseCuratedSourceType;
  tags: string[];
}

export interface KnowledgeBaseWebHarvestResult {
  source: KnowledgeBaseCuratedSource;
  draft: KnowledgeBaseArticleDraft;
  metadata: KnowledgeBaseWebSourceMetadata;
}

export interface KnowledgeBaseWebHarvestError {
  source: KnowledgeBaseCuratedSource;
  path: string;
  reason: string;
}

export interface KnowledgeBaseWebHarvestProgress {
  currentId: string | null;
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
}

export interface KnowledgeBaseWebHarvestOptions {
  signal?: AbortSignal;
  onProgress?: (progress: KnowledgeBaseWebHarvestProgress) => void;
}

const RATE_LIMIT_MS = 1500;
const MAX_REDDIT_COMMENTS = 5;

const curatedSourcesData: KnowledgeBaseCuratedSource[] = [
  {
    id: "reddit:newcomer-megathread",
    name: "Newcomer FAQ & Resources (r/JumpChain)",
    description:
      "Community primer that outlines chain basics, etiquette, and the most linked beginner resources.",
    url: "https://www.reddit.com/r/JumpChain/comments/1cxl6a6/newcomer_megathread_faq_resources/",
    type: "reddit-thread",
    category: "Community",
    tags: ["reddit", "faq", "onboarding"],
  },
  {
    id: "reddit:build-crafting-tips",
    name: "Build Crafting Tips Compilation (r/JumpChain)",
    description:
      "Collected advice from veteran chain-runners covering budgeting discipline, drawbacks, and perk synergy.",
    url: "https://www.reddit.com/r/JumpChain/comments/15n16b8/build_crafting_tips_compilation/",
    type: "reddit-thread",
    category: "Community",
    tags: ["reddit", "guide", "tips"],
  },
  {
    id: "fandom:jumpchain-guide",
    name: "Jumpchain Guide (Fandom)",
    description:
      "Living documentation of Jumpchain fundamentals, terminology, and the structure of a typical chain.",
    url: "https://jumpchain.fandom.com/wiki/Jumpchain_Guide",
    type: "fandom-page",
    category: "Reference",
    tags: ["fandom", "guide", "overview"],
  },
  {
    id: "fandom:glossary",
    name: "Jumpchain Glossary (Fandom)",
    description:
      "Definitions for the most common Jumpchain jargon, abbreviations, and legacy WPF era terminology.",
    url: "https://jumpchain.fandom.com/wiki/Glossary",
    type: "fandom-page",
    category: "Reference",
    tags: ["fandom", "glossary", "terminology"],
  },
] as const;

export const curatedKnowledgeBaseSources: readonly KnowledgeBaseCuratedSource[] = curatedSourcesData;

let lastFetchTimestamp = 0;

function uniqueTags(...groups: (readonly string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of groups) {
    if (!group) continue;
    for (const tag of group) {
      const trimmed = tag.trim();
      if (!trimmed.length) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

function decodeHtmlEntities(input: string): string {
  if (typeof window !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = input;
    return textarea.value;
  }
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripRedditMarkdown(input: string): string {
  const decoded = decodeHtmlEntities(input);
  return decoded
    .replace(/\r\n?/g, "\n")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)")
    .replace(/^>+\s?/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*(\d+)\.\s+/gm, "$1. ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToPlainText(html: string): string {
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const documentFragment = parser.parseFromString(html, "text/html");
    const element = documentFragment.body;
    const text = element.innerText;
    return text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  return html
    .replace(/<br\s*\/?>(?=\s*<)/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function enforceRateLimit(signal?: AbortSignal): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastFetchTimestamp;
  if (elapsed < RATE_LIMIT_MS) {
    const waitTime = RATE_LIMIT_MS - elapsed;
    await new Promise<void>((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        if (typeof timeout !== "undefined") {
          clearTimeout(timeout);
        }
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
      };
      const onAbort = () => {
        cleanup();
        reject(new DOMException("The operation was aborted.", "AbortError"));
      };
      if (signal) {
        if (signal.aborted) {
          reject(new DOMException("The operation was aborted.", "AbortError"));
          return;
        }
        signal.addEventListener("abort", onAbort);
      }
      timeout = setTimeout(() => {
        cleanup();
        resolve();
      }, waitTime);
    });
  }
  lastFetchTimestamp = Date.now();
}

async function fetchWithRateLimit(
  input: string,
  init: RequestInit,
  signal?: AbortSignal
): Promise<Response> {
  await enforceRateLimit(signal);
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json, text/plain;q=0.9");
  }
  const options: RequestInit = {
    ...init,
    signal,
    headers,
  };
  try {
    const response = await fetch(input, options);
    if (response.status === 429) {
      await delay(RATE_LIMIT_MS);
      const retryResponse = await fetch(input, options);
      return retryResponse;
    }
    return response;
  } catch (error) {
    if (signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    throw error;
  }
}

interface RedditPostData {
  title?: string;
  author?: string;
  selftext?: string;
  link_flair_text?: string | null;
}

interface RedditCommentData {
  author?: string;
  body?: string;
  score?: number;
  stickied?: boolean;
  removed?: boolean;
  banned_by?: unknown;
}

interface RedditListing<T> {
  data?: {
    children?: Array<{
      kind?: string;
      data?: T;
    }>;
  };
}

interface RedditScrapeResult {
  title: string;
  author?: string;
  body: string;
  summary?: string;
  tags: string[];
}

interface FandomScrapeResult {
  title: string;
  body: string;
  summary?: string;
  categories: string[];
}

function resolveRedditJsonUrl(input: string): string {
  try {
    const url = new URL(input);
    if (!/\.reddit\.com$/i.test(url.hostname)) {
      throw new Error("URL must point to reddit.com");
    }
    if (!url.pathname.endsWith(".json")) {
      url.pathname = url.pathname.replace(/\/?$/, "/");
      url.pathname += ".json";
    }
    url.searchParams.set("raw_json", "1");
    return url.toString();
  } catch (error) {
    throw new Error(`Invalid Reddit URL: ${(error as Error).message}`);
  }
}

async function scrapeRedditThread(
  source: KnowledgeBaseCuratedSource,
  signal?: AbortSignal
): Promise<RedditScrapeResult> {
  const response = await fetchWithRateLimit(resolveRedditJsonUrl(source.url), {}, signal);
  if (!response.ok) {
    throw new Error(`Reddit responded with status ${response.status}`);
  }
  const payload = (await response.json()) as RedditListing<RedditPostData | RedditCommentData>[];
  const postListing = payload[0]?.data?.children ?? [];
  const post = postListing.find((child) => child.kind === "t3")?.data as RedditPostData | undefined;
  if (!post) {
    throw new Error("Unable to load Reddit post content.");
  }
  const commentListing = payload[1]?.data?.children ?? [];
  const comments = commentListing
    .filter((child) => child.kind === "t1")
    .map((child) => child.data as RedditCommentData)
    .filter((comment): comment is RedditCommentData => Boolean(comment && comment.body && !comment.removed && !comment.banned_by));

  const sortedComments = comments
    .filter((comment) => !comment.stickied && typeof comment.body === "string" && comment.body.trim().length > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_REDDIT_COMMENTS)
    .map((comment) => {
      const authorLabel = comment.author ? `u/${comment.author}` : "Community";
      const scoreLabel = typeof comment.score === "number" ? ` (${comment.score})` : "";
      return `${authorLabel}${scoreLabel}\n${stripRedditMarkdown(comment.body ?? "")}`.trim();
    })
    .filter((snippet) => snippet.length > 0);

  const postBody = post.selftext ? stripRedditMarkdown(post.selftext) : "";
  const sections = [postBody];
  if (sortedComments.length) {
    sections.push(["Community highlights:", ...sortedComments.map((snippet) => `• ${snippet}`)].join("\n"));
  }
  const body = sections.filter((section) => section.trim().length > 0).join("\n\n");
  if (!body.length) {
    throw new Error("Thread does not contain enough text to import.");
  }

  const title = post.title ? decodeHtmlEntities(post.title) : source.name;
  const summary = postBody.split(/\n{2,}/).map((line) => line.trim()).filter((line) => line.length > 0)[0];
  const flairTag = post.link_flair_text ? post.link_flair_text.replace(/[^\w\s-]/g, " ").trim() : null;

  return {
    title,
    author: post.author ?? undefined,
    body,
    summary,
    tags: uniqueTags(source.tags, flairTag ? [flairTag] : undefined),
  };
}

function parseFandomUrl(input: string): { origin: string; page: string } {
  try {
    const url = new URL(input);
    if (!/\.fandom\.com$/i.test(url.hostname)) {
      throw new Error("URL must point to fandom.com");
    }
    const segments = url.pathname.split("/").filter(Boolean);
    const wikiIndex = segments.indexOf("wiki");
    if (wikiIndex === -1 || wikiIndex === segments.length - 1) {
      throw new Error("URL must include a /wiki/ path");
    }
    const pageSegments = segments.slice(wikiIndex + 1);
    const page = pageSegments.join("/");
    return { origin: `${url.protocol}//${url.host}`, page: decodeURIComponent(page) };
  } catch (error) {
    throw new Error(`Invalid Fandom URL: ${(error as Error).message}`);
  }
}

async function scrapeFandomPage(
  source: KnowledgeBaseCuratedSource,
  signal?: AbortSignal
): Promise<FandomScrapeResult> {
  const { origin, page } = parseFandomUrl(source.url);
  const apiUrl = new URL("/api.php", origin);
  apiUrl.searchParams.set("action", "parse");
  apiUrl.searchParams.set("format", "json");
  apiUrl.searchParams.set("formatversion", "2");
  apiUrl.searchParams.set("page", page);
  apiUrl.searchParams.set("prop", "text|sections|categories|properties");
  apiUrl.searchParams.set("origin", "*");
  apiUrl.searchParams.set("redirects", "1");
  apiUrl.searchParams.set("disablelimitreport", "1");
  apiUrl.searchParams.set("disableeditsection", "1");
  apiUrl.searchParams.set("disabletoc", "1");

  const response = await fetchWithRateLimit(apiUrl.toString(), {}, signal);
  if (!response.ok) {
    throw new Error(`Fandom responded with status ${response.status}`);
  }
  const payload = (await response.json()) as {
    parse?: {
      title?: string;
      text?: string;
      sections?: Array<{ line?: string }>;
      categories?: Array<{ category?: string; hidden?: boolean }>;
      properties?: Array<{ name?: string; value?: string }>;
    };
    error?: { info?: string };
  };
  if (payload.error?.info) {
    throw new Error(payload.error.info);
  }
  const parsed = payload.parse;
  if (!parsed?.text) {
    throw new Error("Unable to load Fandom article content.");
  }

  const body = htmlToPlainText(parsed.text);
  if (!body.length) {
    throw new Error("Fandom page did not return textual content.");
  }

  const summaryProperty = parsed.properties?.find((prop) => prop.name === "description")?.value;
  const firstSection = parsed.sections?.[0]?.line;
  const summaryCandidate = summaryProperty ?? firstSection;
  const categories = parsed.categories
    ?.filter((category) => !category.hidden && category.category)
    .map((category) => category.category as string);

  return {
    title: parsed.title ?? source.name,
    body,
    summary: summaryCandidate ?? undefined,
    categories: uniqueTags(source.tags, categories),
  };
}

interface DraftResult {
  draft: KnowledgeBaseArticleDraft;
  metadata: KnowledgeBaseWebSourceMetadata;
}

interface DraftMetadata {
  title: string;
  summary?: string;
  author?: string;
  sourceLabel: string;
  tags: string[];
}

function createDraftFromScrape(
  source: KnowledgeBaseCuratedSource,
  text: string,
  metadata: DraftMetadata
): DraftResult {
  const draft = buildArticleDraft(source.url, text, source.category);
  const mergedTags = uniqueTags(draft.payload.tags, source.tags, metadata.tags);
  const fetchedAt = new Date().toISOString();

  const finalDraft: KnowledgeBaseArticleDraft = {
    ...draft,
    payload: {
      ...draft.payload,
      title: metadata.title,
      category: source.category,
      summary: metadata.summary ?? draft.payload.summary,
      tags: mergedTags,
      source: `${metadata.sourceLabel} • ${source.url}`,
    },
  };

  return {
    draft: finalDraft,
    metadata: {
      id: source.id,
      url: source.url,
      fetchedAt,
      title: metadata.title,
      author: metadata.author,
      type: source.type,
      tags: mergedTags,
    },
  };
}

export async function harvestCuratedKnowledgeBaseSources(
  ids: readonly string[],
  options: KnowledgeBaseWebHarvestOptions = {}
): Promise<{
  results: KnowledgeBaseWebHarvestResult[];
  errors: KnowledgeBaseWebHarvestError[];
  cancelled: boolean;
}> {
  const selectedSources = curatedSourcesData.filter((source) => ids.includes(source.id));
  const results: KnowledgeBaseWebHarvestResult[] = [];
  const errors: KnowledgeBaseWebHarvestError[] = [];
  const total = selectedSources.length;

  const emitProgress = (currentId: string | null, processed: number) => {
    options.onProgress?.({
      currentId,
      processed,
      total,
      succeeded: results.length,
      failed: errors.length,
    });
  };

  let processed = 0;
  emitProgress(null, processed);

  for (const source of selectedSources) {
    if (options.signal?.aborted) {
      return { results, errors, cancelled: true };
    }

    try {
      emitProgress(source.id, processed);
      if (source.type === "reddit-thread") {
        const scrape = await scrapeRedditThread(source, options.signal);
        const { draft, metadata } = createDraftFromScrape(source, scrape.body, {
          title: scrape.title,
          author: scrape.author,
          summary: scrape.summary,
          sourceLabel: scrape.author ? `Reddit · u/${scrape.author}` : "Reddit", 
          tags: scrape.tags,
        });
        results.push({ source, draft, metadata });
      } else if (source.type === "fandom-page") {
        const scrape = await scrapeFandomPage(source, options.signal);
        const { draft, metadata } = createDraftFromScrape(source, scrape.body, {
          title: scrape.title,
          summary: scrape.summary,
          sourceLabel: "Fandom Wiki",
          tags: scrape.categories,
        });
        results.push({ source, draft, metadata });
      } else {
        throw new Error(`Unsupported source type: ${source.type}`);
      }
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") {
        return { results, errors, cancelled: true };
      }
      errors.push({
        source,
        path: source.url,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      processed += 1;
      emitProgress(null, processed);
    }
  }

  emitProgress(null, processed);
  return { results, errors, cancelled: false };
}

export function getCuratedSourceById(id: string): KnowledgeBaseCuratedSource | undefined {
  return curatedSourcesData.find((source) => source.id === id);
}
