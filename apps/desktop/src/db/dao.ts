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
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((statement) => `${statement};`);
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

export interface RankedSearchResult {
  id: string;
  source: "note" | "file" | "entity";
  title: string;
  snippet: string;
  jump_id?: string | null;
  score: number;
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

export interface GlobalSearchPayload {
  term: string;
}

export interface GlobalSearchResults {
  notes: RankedSearchResult[];
  files: RankedSearchResult[];
  entities: RankedSearchResult[];
}

export async function globalSearch(term: string): Promise<GlobalSearchResults> {
  const [notes, files, entities] = await Promise.all([
    searchNotes(term),
    searchFiles(term),
    searchEntities(term),
  ]);
  return { notes, files, entities };
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
    await db.execute("DELETE FROM note_fts");
    await db.execute("DELETE FROM file_fts");
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
