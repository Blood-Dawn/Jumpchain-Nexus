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

import Database from "@tauri-apps/plugin-sql";
import schema from "./migrations/001_init.sql?raw";

export type EntityKind =
  | "perk"
  | "item"
  | "companion"
  | "drawback"
  | "location"
  | "faction";

export interface JumpRecord {
  id: string;
  title: string;
  world: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  created_at: string;
}

export interface EntityRecord {
  id: string;
  type: EntityKind;
  name: string;
  meta_json: string | null;
  search_terms: string | null;
}

export interface NoteRecord {
  id: string;
  jump_id: string | null;
  md: string;
  created_at: string;
  updated_at: string;
}

export interface RecapRecord {
  id: string;
  jump_id: string;
  period: "weekly" | "monthly" | "custom";
  md: string;
  created_at: string;
}

export interface NextActionRecord {
  id: string;
  jump_id: string;
  summary: string;
  due_date: string | null;
}

export interface StoryRecord {
  id: string;
  title: string;
  jump_id: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChapterRecord {
  id: string;
  story_id: string;
  title: string;
  synopsis: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ChapterTextRecord {
  chapter_id: string;
  json: string;
  plain: string;
  updated_at: string;
}

export interface ChapterSnapshotRecord {
  id: string;
  chapter_id: string;
  json: string;
  created_at: string;
}

export interface ChapterMentionRecord {
  id: string;
  chapter_id: string;
  entity_id: string;
  start: number | null;
  end: number | null;
}

export interface StoryWithChapters extends StoryRecord {
  chapters: ChapterRecord[];
}

export interface ChapterEntityLinkSummary {
  entity_id: string;
  name: string;
  type: EntityKind;
  mentions: number;
}

const DB_FILENAME = "app.db";
let dbPromise: Promise<Database> | null = null;
let schemaApplied = false;

async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(`sqlite:${DB_FILENAME}`);
  }
  return dbPromise;
}

function splitStatements(sql: string): string[] {
  const lines = sql.split(/\r?\n/);
  const statements: string[] = [];
  let buffer: string[] = [];
  let insideBeginEnd = false;

  const flush = () => {
    if (!buffer.length) {
      return;
    }
    const statement = buffer.join("\n").trim();
    if (statement) {
      statements.push(statement);
    }
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (buffer.length) {
        buffer.push(line);
      }
      continue;
    }

    buffer.push(line);
    const upper = trimmed.toUpperCase();

    if (!insideBeginEnd && upper.endsWith("BEGIN")) {
      insideBeginEnd = true;
      continue;
    }

    if (insideBeginEnd) {
      if (upper.endsWith("END;")) {
        flush();
        insideBeginEnd = false;
      }
      continue;
    }

    if (trimmed.endsWith(";")) {
      flush();
    }
  }

  flush();

  return statements;
}

export async function ensureInitialized(): Promise<void> {
  if (schemaApplied) {
    return;
  }
  const db = await getDb();
  const statements = splitStatements(schema);
  for (const statement of statements) {
    await db.execute(statement);
  }
  schemaApplied = true;
}

async function withInit<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  await ensureInitialized();
  const db = await getDb();
  return fn(db);
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function createJump(payload: Omit<JumpRecord, "id" | "created_at">): Promise<JumpRecord> {
  return withInit(async (db) => {
    const id = uuid();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO jumps (id, title, world, start_date, end_date, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, payload.title, payload.world, payload.start_date, payload.end_date, payload.status, now]
    );
    return {
      id,
      created_at: now,
      ...payload,
    };
  });
}

export async function updateJump(
  id: string,
  updates: Partial<Omit<JumpRecord, "id" | "created_at">>
): Promise<void> {
  const columns = Object.keys(updates);
  if (!columns.length) return;
  await withInit(async (db) => {
    const assignments = columns.map((col, index) => `${col} = $${index + 1}`).join(", ");
    const values = Object.values(updates);
    await db.execute(`UPDATE jumps SET ${assignments} WHERE id = $${columns.length + 1}`, [
      ...values,
      id,
    ]);
  });
}

export async function listJumps(): Promise<JumpRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<JumpRecord[]>("SELECT * FROM jumps ORDER BY created_at DESC");
    return rows as JumpRecord[];
  });
}

export async function deleteJump(id: string): Promise<void> {
  await withInit((db) => db.execute("DELETE FROM jumps WHERE id = $1", [id]));
}

export async function upsertEntity(entity: Omit<EntityRecord, "search_terms"> & { search_terms?: string | null }): Promise<void> {
  await withInit(async (db) => {
    await db.execute(
      `INSERT INTO entities (id, type, name, meta_json, search_terms)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(id) DO UPDATE SET type = excluded.type, name = excluded.name, meta_json = excluded.meta_json, search_terms = excluded.search_terms`,
      [entity.id, entity.type, entity.name, entity.meta_json ?? null, entity.search_terms ?? null]
    );
  });
}

export async function listEntities(kind?: EntityKind): Promise<EntityRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<EntityRecord[]>(
      kind
        ? "SELECT * FROM entities WHERE type = $1 ORDER BY name COLLATE NOCASE"
        : "SELECT * FROM entities ORDER BY name COLLATE NOCASE",
      kind ? [kind] : []
    );
    return rows as EntityRecord[];
  });
}

export async function upsertNote(
  note: Omit<NoteRecord, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string }
): Promise<NoteRecord> {
  return withInit(async (db) => {
    const id = note.id ?? uuid();
    const created = note.created_at ?? new Date().toISOString();
    const updated = new Date().toISOString();
    await db.execute(
      `INSERT INTO notes (id, jump_id, md, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(id) DO UPDATE SET jump_id = excluded.jump_id, md = excluded.md, updated_at = excluded.updated_at`,
      [id, note.jump_id ?? null, note.md, created, updated]
    );
    return {
      ...note,
      id,
      jump_id: note.jump_id ?? null,
      created_at: created,
      updated_at: updated,
    };
  });
}

export async function listNotesForJump(jumpId: string): Promise<NoteRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<NoteRecord[]>(
      `SELECT * FROM notes WHERE jump_id = $1 ORDER BY updated_at DESC`,
      [jumpId]
    );
    return rows as NoteRecord[];
  });
}

export async function recordMention(
  noteId: string,
  entityId: string,
  start: number,
  end: number
): Promise<void> {
  await withInit((db) =>
    db.execute(
      `INSERT INTO mentions (id, note_id, entity_id, start, "end") VALUES ($1, $2, $3, $4, $5)`,
      [uuid(), noteId, entityId, start, end]
    )
  );
}

export async function clearMentionsForNote(noteId: string): Promise<void> {
  await withInit((db) => db.execute(`DELETE FROM mentions WHERE note_id = $1`, [noteId]));
}

export async function listAllNotes(): Promise<NoteRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<NoteRecord[]>("SELECT * FROM notes ORDER BY updated_at DESC");
    return rows as NoteRecord[];
  });
}

export async function upsertFileRecord(file: {
  id: string;
  jump_id?: string | null;
  kind: string;
  path: string;
  original_name: string;
  indexed_at?: string | null;
}): Promise<void> {
  await withInit((db) =>
    db.execute(
      `INSERT INTO files (id, jump_id, kind, path, original_name, content, indexed_at)
       VALUES ($1, $2, $3, $4, $5, '', $6)
       ON CONFLICT(id) DO UPDATE SET
         jump_id = excluded.jump_id,
         kind = excluded.kind,
         path = excluded.path,
         original_name = excluded.original_name,
         indexed_at = COALESCE(excluded.indexed_at, files.indexed_at)`,
      [
        file.id,
        file.jump_id ?? null,
        file.kind,
        file.path,
        file.original_name,
        file.indexed_at ?? null,
      ]
    )
  );
}

export async function indexFileText(fileId: string, content: string): Promise<void> {
  await withInit(async (db) => {
    await db.execute(
      `UPDATE files SET content = $2, indexed_at = $3 WHERE id = $1`,
      [fileId, content, new Date().toISOString()]
    );
  });
}

export type RankedSearchSource = "note" | "file" | "entity" | "chapter";

export interface RankedSearchResult {
  id: string;
  source: RankedSearchSource;
  title: string;
  snippet: string;
  score: number;
  jump_id?: string | null;
  story_id?: string | null;
  story_title?: string | null;
}

const SNIPPET_LEN = 160;

function toFtsPrefixQuery(term: string): string {
  const trimmed = term.trim();
  if (!trimmed) return trimmed;
  const escaped = trimmed.replace(/"/g, '""');
  return escaped
    .split(/\s+/)
    .map((token) => `${token}*`)
    .join(" ");
}

function sanitizeSnippet(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

interface NoteSearchRow {
  id: string;
  jump_id: string | null;
  raw_snippet: string;
  score: number;
}

interface FileSearchRow {
  id: string;
  jump_id: string | null;
  title: string;
  raw_snippet: string;
  score: number;
}

interface EntitySearchRow {
  id: string;
  title: string;
  raw_snippet: string;
  score: number;
}

interface ChapterSearchRow {
  id: string;
  story_id: string;
  story_title: string | null;
  title: string;
  raw_snippet: string;
  score: number;
}

export async function searchNotes(term: string): Promise<RankedSearchResult[]> {
  const expression = toFtsPrefixQuery(term);
  if (!expression) {
    return [];
  }
  const rows = await withInit((db) =>
    db.select<NoteSearchRow[]>(
      `SELECT n.id as id,
              n.jump_id as jump_id,
              substr(n.md, 1, $2) as raw_snippet,
              bm25(note_fts) AS score
       FROM note_fts
       JOIN notes n ON n.id = note_fts.note_id
       WHERE note_fts MATCH $1
       ORDER BY score ASC
       LIMIT 20`,
      [expression, SNIPPET_LEN]
    )
  );
  return (rows as NoteSearchRow[]).map((row) => ({
    id: row.id,
    source: "note",
    title: `Note ${row.id.slice(0, 6)}`,
    snippet: sanitizeSnippet(row.raw_snippet ?? ""),
    jump_id: row.jump_id,
    score: row.score,
  }));
}

export async function searchFiles(term: string): Promise<RankedSearchResult[]> {
  const expression = toFtsPrefixQuery(term);
  if (!expression) {
    return [];
  }
  const rows = await withInit((db) =>
    db.select<FileSearchRow[]>(
      `SELECT f.id as id,
              f.jump_id as jump_id,
              f.original_name as title,
              substr(file_fts.content, 1, $2) as raw_snippet,
              bm25(file_fts) AS score
       FROM file_fts
       JOIN files f ON f.id = file_fts.file_id
       WHERE file_fts MATCH $1
       ORDER BY score ASC
       LIMIT 20`,
      [expression, SNIPPET_LEN]
    )
  );
  return (rows as FileSearchRow[]).map((row) => ({
    id: row.id,
    source: "file",
    title: row.title,
    snippet: sanitizeSnippet(row.raw_snippet ?? ""),
    jump_id: row.jump_id,
    score: row.score,
  }));
}

export async function searchEntities(term: string): Promise<RankedSearchResult[]> {
  const expression = toFtsPrefixQuery(term);
  if (!expression) {
    return [];
  }
  const rows = await withInit((db) =>
    db.select<EntitySearchRow[]>(
      `SELECT e.id as id,
              e.name as title,
              COALESCE(e.meta_json, '') as raw_snippet,
              bm25(entity_fts) AS score
       FROM entity_fts
       JOIN entities e ON e.id = entity_fts.entity_id
       WHERE entity_fts MATCH $1
       ORDER BY score ASC
       LIMIT 20`,
      [expression]
    )
  );
  return (rows as EntitySearchRow[]).map((row) => ({
    id: row.id,
    source: "entity",
    title: row.title,
    snippet: sanitizeSnippet(row.raw_snippet ?? ""),
    score: row.score,
  }));
}

export async function searchChapters(term: string): Promise<RankedSearchResult[]> {
  const expression = toFtsPrefixQuery(term);
  if (!expression) {
    return [];
  }
  const rows = await withInit((db) =>
    db.select<ChapterSearchRow[]>(
      `SELECT c.id as id,
              c.story_id as story_id,
              s.title as story_title,
              c.title as title,
              substr(chapter_fts.content, 1, $2) as raw_snippet,
              bm25(chapter_fts) AS score
       FROM chapter_fts
       JOIN chapters c ON c.id = chapter_fts.chapter_id
       LEFT JOIN stories s ON s.id = c.story_id
       WHERE chapter_fts MATCH $1
       ORDER BY score ASC
       LIMIT 20`,
      [expression, SNIPPET_LEN]
    )
  );
  return (rows as ChapterSearchRow[]).map((row) => ({
    id: row.id,
    source: "chapter",
    title: row.title,
    snippet: sanitizeSnippet(row.raw_snippet ?? ""),
    score: row.score,
    story_id: row.story_id,
    story_title: row.story_title ?? null,
  }));
}

export async function listStories(): Promise<StoryWithChapters[]> {
  return withInit(async (db) => {
    const stories = (await db.select<StoryRecord[]>(
      `SELECT * FROM stories ORDER BY created_at DESC`
    )) as StoryRecord[];
    if (!stories.length) {
      return [];
    }
    const storyIds = stories.map((story) => story.id);
    const chapters = (await db.select<ChapterRecord[]>(
      `SELECT * FROM chapters WHERE story_id IN (${storyIds.map((_, idx) => `$${idx + 1}`).join(", ")})
       ORDER BY sort_order ASC, created_at ASC`,
      storyIds
    )) as ChapterRecord[];
    const grouped = new Map<string, ChapterRecord[]>();
    for (const story of stories) {
      grouped.set(story.id, []);
    }
    for (const chapter of chapters) {
      const bucket = grouped.get(chapter.story_id);
      if (bucket) {
        bucket.push(chapter);
      }
    }
    return stories.map<StoryWithChapters>((story) => ({
      ...story,
      chapters: grouped.get(story.id) ?? [],
    }));
  });
}

export async function getStoryById(id: string): Promise<StoryRecord | null> {
  const rows = await withInit((db) =>
    db.select<StoryRecord[]>(`SELECT * FROM stories WHERE id = $1`, [id])
  );
  return (rows as StoryRecord[])[0] ?? null;
}

export async function createStory(input: {
  title: string;
  summary?: string | null;
  jump_id?: string | null;
}): Promise<StoryRecord> {
  return withInit(async (db) => {
    const id = uuid();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO stories (id, title, jump_id, summary, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [id, input.title, input.jump_id ?? null, input.summary ?? null, now]
    );
    return {
      id,
      title: input.title,
      jump_id: input.jump_id ?? null,
      summary: input.summary ?? null,
      created_at: now,
      updated_at: now,
    };
  });
}

export async function updateStory(
  id: string,
  updates: Partial<Pick<StoryRecord, "title" | "summary" | "jump_id">>
): Promise<StoryRecord> {
  return withInit(async (db) => {
    const now = new Date().toISOString();
    const sets: string[] = [];
    const values: unknown[] = [];
    let index = 1;
    if (typeof updates.title === "string") {
      sets.push(`title = $${index++}`);
      values.push(updates.title);
    }
    if (updates.summary !== undefined) {
      sets.push(`summary = $${index++}`);
      values.push(updates.summary);
    }
    if (updates.jump_id !== undefined) {
      sets.push(`jump_id = $${index++}`);
      values.push(updates.jump_id);
    }
    sets.push(`updated_at = $${index++}`);
    values.push(now);
    values.push(id);
    await db.execute(`UPDATE stories SET ${sets.join(", ")} WHERE id = $${index}`, values);
    const rows = await db.select<StoryRecord[]>(`SELECT * FROM stories WHERE id = $1`, [id]);
    const record = rows[0] as StoryRecord | undefined;
    if (!record) {
      throw new Error("Story not found after update");
    }
    return record;
  });
}

export async function deleteStory(id: string): Promise<void> {
  await withInit((db) => db.execute(`DELETE FROM stories WHERE id = $1`, [id]));
}

export async function createChapter(input: {
  story_id: string;
  title: string;
  synopsis?: string | null;
}): Promise<ChapterRecord> {
  return withInit(async (db) => {
    const now = new Date().toISOString();
    const [row] = (await db.select<{ max_order: number }[]>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM chapters WHERE story_id = $1`,
      [input.story_id]
    )) as { max_order: number }[];
    const sortOrder = (row?.max_order ?? -1) + 1;
    const id = uuid();
    await db.execute(
      `INSERT INTO chapters (id, story_id, title, synopsis, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [id, input.story_id, input.title, input.synopsis ?? null, sortOrder, now]
    );
    await db.execute(`UPDATE stories SET updated_at = $1 WHERE id = $2`, [now, input.story_id]);
    return {
      id,
      story_id: input.story_id,
      title: input.title,
      synopsis: input.synopsis ?? null,
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
    };
  });
}

export async function updateChapter(
  id: string,
  updates: Partial<Pick<ChapterRecord, "title" | "synopsis" | "sort_order">>
): Promise<ChapterRecord> {
  return withInit(async (db) => {
    const rows = await db.select<ChapterRecord[]>(`SELECT * FROM chapters WHERE id = $1`, [id]);
    const existing = rows[0] as ChapterRecord | undefined;
    if (!existing) {
      throw new Error("Chapter not found");
    }
    const now = new Date().toISOString();
    const sets: string[] = [];
    const values: unknown[] = [];
    let index = 1;
    if (typeof updates.title === "string") {
      sets.push(`title = $${index++}`);
      values.push(updates.title);
    }
    if (updates.synopsis !== undefined) {
      sets.push(`synopsis = $${index++}`);
      values.push(updates.synopsis);
    }
    if (typeof updates.sort_order === "number") {
      sets.push(`sort_order = $${index++}`);
      values.push(updates.sort_order);
    }
    sets.push(`updated_at = $${index++}`);
    values.push(now);
    values.push(id);
    await db.execute(`UPDATE chapters SET ${sets.join(", ")} WHERE id = $${index}`, values);
    await db.execute(`UPDATE stories SET updated_at = $1 WHERE id = $2`, [now, existing.story_id]);
    const refreshed = await db.select<ChapterRecord[]>(`SELECT * FROM chapters WHERE id = $1`, [id]);
    return refreshed[0] as ChapterRecord;
  });
}

export async function reorderChapters(storyId: string, orderedIds: string[]): Promise<void> {
  await withInit(async (db) => {
    await db.execute("BEGIN TRANSACTION");
    try {
      const now = new Date().toISOString();
      for (let index = 0; index < orderedIds.length; index += 1) {
        const chapterId = orderedIds[index];
        await db.execute(`UPDATE chapters SET sort_order = $1, updated_at = $2 WHERE id = $3`, [
          index,
          now,
          chapterId,
        ]);
      }
      await db.execute(`UPDATE stories SET updated_at = $1 WHERE id = $2`, [now, storyId]);
      await db.execute("COMMIT");
    } catch (error) {
      await db.execute("ROLLBACK");
      throw error;
    }
  });
}

export async function deleteChapter(id: string): Promise<void> {
  await withInit(async (db) => {
    const rows = await db.select<ChapterRecord[]>(`SELECT story_id FROM chapters WHERE id = $1`, [id]);
    const storyId = rows[0]?.story_id ?? null;
    await db.execute(`DELETE FROM chapters WHERE id = $1`, [id]);
    if (storyId) {
      const now = new Date().toISOString();
      await db.execute(`UPDATE stories SET updated_at = $1 WHERE id = $2`, [now, storyId]);
    }
  });
}

export async function getChapterText(chapterId: string): Promise<ChapterTextRecord | null> {
  const rows = await withInit((db) =>
    db.select<ChapterTextRecord[]>(`SELECT * FROM chapter_text WHERE chapter_id = $1`, [chapterId])
  );
  return (rows as ChapterTextRecord[])[0] ?? null;
}

export async function saveChapterText(input: {
  chapter_id: string;
  json: string;
  plain: string;
}): Promise<ChapterTextRecord> {
  return withInit(async (db) => {
    const now = new Date().toISOString();
    const storyRows = await db.select<{ story_id: string }[]>(
      `SELECT story_id FROM chapters WHERE id = $1`,
      [input.chapter_id]
    );
    const storyId = storyRows[0]?.story_id ?? null;
    await db.execute(
      `INSERT INTO chapter_text (chapter_id, json, plain, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(chapter_id) DO UPDATE SET json = excluded.json, plain = excluded.plain, updated_at = excluded.updated_at`,
      [input.chapter_id, input.json, input.plain, now]
    );
    await db.execute(
      `UPDATE chapters SET updated_at = $1 WHERE id = $2`,
      [now, input.chapter_id]
    );
    if (storyId) {
      await db.execute(`UPDATE stories SET updated_at = $1 WHERE id = $2`, [now, storyId]);
    }
    const rows = await db.select<ChapterTextRecord[]>(
      `SELECT * FROM chapter_text WHERE chapter_id = $1`,
      [input.chapter_id]
    );
    return rows[0] as ChapterTextRecord;
  });
}

export async function recordChapterSnapshot(
  chapterId: string,
  json: string
): Promise<ChapterSnapshotRecord> {
  const id = uuid();
  const now = new Date().toISOString();
  await withInit((db) =>
    db.execute(
      `INSERT INTO chapter_snapshots (id, chapter_id, json, created_at)
       VALUES ($1, $2, $3, $4)`,
      [id, chapterId, json, now]
    )
  );
  return { id, chapter_id: chapterId, json, created_at: now };
}

export async function listChapterSnapshots(
  chapterId: string,
  limit = 20
): Promise<ChapterSnapshotRecord[]> {
  const rows = await withInit((db) =>
    db.select<ChapterSnapshotRecord[]>(
      `SELECT * FROM chapter_snapshots WHERE chapter_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [chapterId, limit]
    )
  );
  return rows as ChapterSnapshotRecord[];
}

export async function clearChapterMentions(chapterId: string): Promise<void> {
  await withInit((db) => db.execute(`DELETE FROM chapter_mentions WHERE chapter_id = $1`, [chapterId]));
}

export async function recordChapterMention(
  chapterId: string,
  entityId: string,
  start: number | null,
  end: number | null
): Promise<void> {
  await withInit((db) =>
    db.execute(
      `INSERT INTO chapter_mentions (id, chapter_id, entity_id, start, "end")
       VALUES ($1, $2, $3, $4, $5)`,
      [uuid(), chapterId, entityId, start, end]
    )
  );
}

export async function listChapterMentions(chapterId: string): Promise<ChapterMentionRecord[]> {
  const rows = await withInit((db) =>
    db.select<ChapterMentionRecord[]>(
      `SELECT * FROM chapter_mentions WHERE chapter_id = $1`,
      [chapterId]
    )
  );
  return rows as ChapterMentionRecord[];
}

export async function listChapterEntityLinks(
  chapterId: string
): Promise<ChapterEntityLinkSummary[]> {
  const rows = await withInit((db) =>
    db.select<ChapterEntityLinkSummary[]>(
      `SELECT cm.entity_id AS entity_id,
              e.name AS name,
              e.type AS type,
              COUNT(*) AS mentions
       FROM chapter_mentions cm
       JOIN entities e ON e.id = cm.entity_id
       WHERE cm.chapter_id = $1
       GROUP BY cm.entity_id, e.name, e.type
       ORDER BY mentions DESC, name COLLATE NOCASE ASC`,
      [chapterId]
    )
  );
  return rows as ChapterEntityLinkSummary[];
}

export interface GlobalSearchPayload {
  term: string;
}

export interface GlobalSearchResults {
  notes: RankedSearchResult[];
  files: RankedSearchResult[];
  entities: RankedSearchResult[];
  chapters: RankedSearchResult[];
}

export async function globalSearch(term: string): Promise<GlobalSearchResults> {
  const [notes, files, entities, chapters] = await Promise.all([
    searchNotes(term),
    searchFiles(term),
    searchEntities(term),
    searchChapters(term),
  ]);
  return { notes, files, entities, chapters };
}

export interface PurchaseCostInput {
  cost: number;
  discount?: boolean;
  freebie?: boolean;
}

export interface BudgetComputation {
  totalCost: number;
  discounted: number;
  freebies: number;
  netCost: number;
}

export function computeBudget(purchases: PurchaseCostInput[]): BudgetComputation {
  const result: BudgetComputation = {
    totalCost: 0,
    discounted: 0,
    freebies: 0,
    netCost: 0,
  };

  for (const item of purchases) {
    const cost = Math.max(item.cost, 0);
    result.totalCost += cost;

    if (item.freebie) {
      result.freebies += cost;
      continue;
    }

    if (item.discount) {
      result.discounted += cost;
      result.netCost += cost / 2;
      continue;
    }

    result.netCost += cost;
  }

  return result;
}

export async function runInTransaction<T>(callback: (db: Database) => Promise<T>): Promise<T> {
  return withInit(async (db) => {
    await db.execute("BEGIN TRANSACTION");
    try {
      const result = await callback(db);
      await db.execute("COMMIT");
      return result;
    } catch (error) {
      await db.execute("ROLLBACK");
      throw error;
    }
  });
}

export async function clearAllData(): Promise<void> {
  await withInit(async (db) => {
    await db.execute("DELETE FROM mentions");
    await db.execute("DELETE FROM chapter_mentions");
    await db.execute("DELETE FROM chapter_snapshots");
    await db.execute("DELETE FROM chapter_text");
    await db.execute("DELETE FROM chapters");
    await db.execute("DELETE FROM stories");
    await db.execute("DELETE FROM note_fts");
    await db.execute("DELETE FROM file_fts");
    await db.execute("DELETE FROM chapter_fts");
    await db.execute("DELETE FROM entity_fts");
    await db.execute("DELETE FROM notes");
    await db.execute("DELETE FROM files");
    await db.execute("DELETE FROM recaps");
    await db.execute("DELETE FROM next_actions");
    await db.execute("DELETE FROM entities");
    await db.execute("DELETE FROM jumps");
  });
}

export async function listRecaps(): Promise<RecapRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<RecapRecord[]>(
      `SELECT * FROM recaps ORDER BY created_at DESC`
    );
    return rows as RecapRecord[];
  });
}

export async function listRecapsForJump(jumpId: string): Promise<RecapRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<RecapRecord[]>(
      `SELECT * FROM recaps WHERE jump_id = $1 ORDER BY created_at DESC`,
      [jumpId]
    );
    return rows as RecapRecord[];
  });
}

export async function upsertRecap(
  record: Omit<RecapRecord, "id" | "created_at"> & { id?: string; created_at?: string }
): Promise<RecapRecord> {
  return withInit(async (db) => {
    const id = record.id ?? uuid();
    const created = record.created_at ?? new Date().toISOString();
    await db.execute(
      `INSERT INTO recaps (id, jump_id, period, md, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(id) DO UPDATE SET jump_id = excluded.jump_id, period = excluded.period, md = excluded.md`,
      [id, record.jump_id, record.period, record.md, created]
    );
    return {
      ...record,
      id,
      created_at: created,
    };
  });
}

export async function listNextActions(): Promise<NextActionRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<NextActionRecord[]>(
      `SELECT * FROM next_actions ORDER BY COALESCE(due_date, datetime('now'))`
    );
    return rows as NextActionRecord[];
  });
}

export async function upsertNextAction(action: NextActionRecord): Promise<void> {
  await withInit((db) =>
    db.execute(
      `INSERT INTO next_actions (id, jump_id, summary, due_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(id) DO UPDATE SET jump_id = excluded.jump_id, summary = excluded.summary, due_date = excluded.due_date`,
      [action.id, action.jump_id, action.summary, action.due_date]
    )
  );
}

export async function deleteNextAction(id: string): Promise<void> {
  await withInit((db) => db.execute(`DELETE FROM next_actions WHERE id = $1`, [id]));
}
