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
import { knowledgeSeed } from "./knowledgeSeed";

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
  sort_order: number;
  cp_budget: number;
  cp_spent: number;
  cp_income: number;
}

export interface CreateJumpInput {
  title: string;
  world?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  sort_order?: number;
  cp_budget?: number;
  cp_spent?: number;
  cp_income?: number;
}

export interface EntityRecord {
  id: string;
  type: EntityKind;
  name: string;
  meta_json: string | null;
  search_terms: string | null;
}

export interface KnowledgeArticleRecord {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  content: string;
  tags: string[];
  source: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsertKnowledgeArticleInput {
  id?: string;
  title: string;
  category?: string | null;
  summary?: string | null;
  content: string;
  tags?: string[];
  source?: string | null;
}

export interface KnowledgeArticleQuery {
  search?: string;
  category?: string | null;
  tag?: string | null;
  includeSystem?: boolean;
}

interface KnowledgeArticleRow {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  content: string;
  tags: string | null;
  source: string | null;
  is_system: number;
  created_at: string;
  updated_at: string;
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

export type JumpAssetType = "origin" | "perk" | "item" | "drawback" | "companion";

export interface JumpAssetRecord {
  id: string;
  jump_id: string;
  asset_type: JumpAssetType;
  name: string;
  category: string | null;
  subcategory: string | null;
  cost: number;
  quantity: number;
  discounted: 0 | 1;
  freebie: 0 | 1;
  notes: string | null;
  metadata: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateJumpAssetInput {
  jump_id: string;
  asset_type: JumpAssetType;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  cost?: number;
  quantity?: number;
  discounted?: boolean;
  freebie?: boolean;
  notes?: string | null;
  metadata?: Record<string, unknown> | string | null;
  sort_order?: number;
}

export interface UpdateJumpAssetInput {
  name?: string;
  category?: string | null;
  subcategory?: string | null;
  cost?: number;
  quantity?: number;
  discounted?: boolean;
  freebie?: boolean;
  notes?: string | null;
  metadata?: Record<string, unknown> | string | null;
  sort_order?: number;
}

export type InventoryScope = "warehouse" | "locker";

export interface InventoryItemRecord {
  id: string;
  scope: InventoryScope;
  name: string;
  category: string | null;
  quantity: number;
  slot: string | null;
  notes: string | null;
  tags: string | null;
  jump_id: string | null;
  metadata: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryItemInput {
  scope: InventoryScope;
  name: string;
  category?: string | null;
  quantity?: number;
  slot?: string | null;
  notes?: string | null;
  tags?: string[] | string | null;
  jump_id?: string | null;
  metadata?: Record<string, unknown> | string | null;
  sort_order?: number;
}

export interface UpdateInventoryItemInput {
  scope?: InventoryScope;
  name?: string;
  category?: string | null;
  quantity?: number;
  slot?: string | null;
  notes?: string | null;
  tags?: string[] | string | null;
  jump_id?: string | null;
  metadata?: Record<string, unknown> | string | null;
  sort_order?: number;
}

export interface CharacterProfileRecord {
  id: string;
  name: string;
  alias: string | null;
  species: string | null;
  homeland: string | null;
  biography: string | null;
  attributes_json: string | null;
  traits_json: string | null;
  alt_forms_json: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertCharacterProfileInput {
  id?: string;
  name: string;
  alias?: string | null;
  species?: string | null;
  homeland?: string | null;
  biography?: string | null;
  attributes?: Record<string, unknown> | string | null;
  traits?: Record<string, unknown> | string | null;
  alt_forms?: Record<string, unknown> | string | null;
  notes?: string | null;
}

export interface AppSettingRecord {
  key: string;
  value: string | null;
  updated_at: string;
}

export interface ExportPresetRecord {
  id: string;
  name: string;
  description: string | null;
  options_json: string;
  created_at: string;
  updated_at: string;
}

export interface UpsertExportPresetInput {
  id?: string;
  name: string;
  description?: string | null;
  options: Record<string, unknown> | string;
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
let knowledgeSeedInitialized = false;

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

function toJsonString(value: Record<string, unknown> | string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn("Failed to serialize value to JSON", error);
    return null;
  }
}

function toNullableText(value: string | null | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

function boolToInt(value: boolean | undefined): 0 | 1 {
  return value ? 1 : 0;
}

function serializeTags(value: string[] | string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.warn("Failed to serialize tags", error);
      return null;
    }
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function deserializeTags(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag)).filter((tag) => tag.trim().length > 0);
    }
  } catch (error) {
    console.warn("Failed to parse tags JSON", error);
  }
  return trimmed
    .split(/[,;\n]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export async function createJump(payload: CreateJumpInput): Promise<JumpRecord> {
  return withInit(async (db) => {
    const id = uuid();
    const now = new Date().toISOString();
    const [row] = (await db.select<{ max_order: number }[]>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM jumps`
    )) as { max_order: number }[];
    const sortOrder =
      typeof payload.sort_order === "number" ? payload.sort_order : (row?.max_order ?? -1) + 1;
    const cpBudget = payload.cp_budget ?? 0;
    const cpSpent = payload.cp_spent ?? 0;
    const cpIncome = payload.cp_income ?? 0;
    await db.execute(
      `INSERT INTO jumps (id, title, world, start_date, end_date, status, created_at, sort_order, cp_budget, cp_spent, cp_income)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        payload.title,
        payload.world ?? null,
        payload.start_date ?? null,
        payload.end_date ?? null,
        payload.status ?? null,
        now,
        sortOrder,
        cpBudget,
        cpSpent,
        cpIncome,
      ]
    );
    return {
      id,
      title: payload.title,
      world: payload.world ?? null,
      start_date: payload.start_date ?? null,
      end_date: payload.end_date ?? null,
      status: payload.status ?? null,
      created_at: now,
      sort_order: sortOrder,
      cp_budget: cpBudget,
      cp_spent: cpSpent,
      cp_income: cpIncome,
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
    const rows = await db.select<JumpRecord[]>(
      "SELECT * FROM jumps ORDER BY sort_order ASC, created_at DESC"
    );
    return rows as JumpRecord[];
  });
}

export async function deleteJump(id: string): Promise<void> {
  await withInit((db) => db.execute("DELETE FROM jumps WHERE id = $1", [id]));
}

export async function reorderJumps(orderedIds: string[]): Promise<void> {
  await withInit(async (db) => {
    await db.execute("BEGIN TRANSACTION");
    try {
      for (let index = 0; index < orderedIds.length; index += 1) {
        const jumpId = orderedIds[index];
        await db.execute(`UPDATE jumps SET sort_order = $1 WHERE id = $2`, [index, jumpId]);
      }
      await db.execute("COMMIT");
    } catch (error) {
      await db.execute("ROLLBACK");
      throw error;
    }
  });
}

export async function duplicateJump(
  jumpId: string,
  overrides: Partial<CreateJumpInput> = {}
): Promise<JumpRecord> {
  return withInit(async (db) => {
    await db.execute("BEGIN TRANSACTION");
    try {
      const rows = await db.select<JumpRecord[]>(`SELECT * FROM jumps WHERE id = $1`, [jumpId]);
      const original = rows[0];
      if (!original) {
        throw new Error(`Jump ${jumpId} not found`);
      }

      const [maxOrderRow] = (await db.select<{ max_order: number }[]>(
        `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM jumps`
      )) as { max_order: number }[];

      const newId = uuid();
      const now = new Date().toISOString();
      const sortOrder = overrides.sort_order ?? (maxOrderRow?.max_order ?? -1) + 1;
      const title = overrides.title ?? `${original.title} (Copy)`;
      const world = overrides.world ?? original.world;
      const startDate = overrides.start_date ?? original.start_date;
      const endDate = overrides.end_date ?? original.end_date;
      const status = overrides.status ?? original.status;
      const cpBudget = overrides.cp_budget ?? original.cp_budget ?? 0;

      await db.execute(
        `INSERT INTO jumps (id, title, world, start_date, end_date, status, created_at, sort_order, cp_budget, cp_spent, cp_income)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          newId,
          title,
          world,
          startDate,
          endDate,
          status,
          now,
          sortOrder,
          cpBudget,
          overrides.cp_spent ?? 0,
          overrides.cp_income ?? 0,
        ]
      );

      const assets = (await db.select<JumpAssetRecord[]>(
        `SELECT * FROM jump_assets WHERE jump_id = $1`,
        [jumpId]
      )) as JumpAssetRecord[];

      for (const asset of assets) {
        await db.execute(
          `INSERT INTO jump_assets
             (id, jump_id, asset_type, name, category, subcategory, cost, quantity, discounted, freebie, notes, metadata, sort_order, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)`,
          [
            uuid(),
            newId,
            asset.asset_type,
            asset.name,
            asset.category,
            asset.subcategory,
            asset.cost,
            asset.quantity,
            asset.discounted,
            asset.freebie,
            asset.notes,
            asset.metadata,
            asset.sort_order,
            now,
          ]
        );
      }

      const summary = await summarizeJumpBudgetWithDb(db, newId);
      await db.execute(`UPDATE jumps SET cp_spent = $1, cp_income = $2 WHERE id = $3`, [
        summary.netCost,
        summary.drawbackCredit,
        newId,
      ]);

      await db.execute("COMMIT");

      const newRows = await db.select<JumpRecord[]>(`SELECT * FROM jumps WHERE id = $1`, [newId]);
      return newRows[0] as JumpRecord;
    } catch (error) {
      await db.execute("ROLLBACK");
      throw error;
    }
  });
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

function mapKnowledgeRow(row: KnowledgeArticleRow): KnowledgeArticleRecord {
  return {
    id: row.id,
    title: row.title,
    category: row.category ?? null,
    summary: row.summary ?? null,
    content: row.content,
    tags: deserializeTags(row.tags),
    source: row.source ?? null,
    is_system: row.is_system === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function seedKnowledgeBase(): Promise<void> {
  if (knowledgeSeedInitialized) {
    return;
  }
  await withInit(async (db) => {
    const rows = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) AS count FROM knowledge_articles`
    );
    const count = rows[0]?.count ?? 0;
    if (count > 0) {
      knowledgeSeedInitialized = true;
      return;
    }
    const now = new Date().toISOString();
    for (const entry of knowledgeSeed) {
      await db.execute(
        `INSERT INTO knowledge_articles
           (id, title, category, summary, content, tags, source, is_system, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $8)`,
        [
          uuid(),
          entry.title,
          toNullableText(entry.category ?? null),
          toNullableText(entry.summary ?? null),
          entry.content,
          serializeTags(entry.tags ?? []) ?? null,
          toNullableText(entry.source ?? null),
          now,
        ]
      );
    }
  });
  knowledgeSeedInitialized = true;
}

export async function ensureKnowledgeBaseSeeded(): Promise<void> {
  if (knowledgeSeedInitialized) {
    return;
  }
  await seedKnowledgeBase();
}

export async function countKnowledgeArticles(): Promise<number> {
  await ensureKnowledgeBaseSeeded();
  const rows = await withInit((db) =>
    db.select<{ count: number }[]>(`SELECT COUNT(*) AS count FROM knowledge_articles`)
  );
  return rows[0]?.count ?? 0;
}

export async function fetchKnowledgeArticles(
  query: KnowledgeArticleQuery = {}
): Promise<KnowledgeArticleRecord[]> {
  await ensureKnowledgeBaseSeeded();
  return withInit(async (db) => {
    const categoryValue = query.category?.trim();
    const includeSystem = query.includeSystem ?? true;
    const baseConditions: string[] = [];
    const baseParams: unknown[] = [];

    if (categoryValue) {
      baseConditions.push("COALESCE(category, '') = $" + (baseParams.length + 1));
      baseParams.push(categoryValue);
    }

    if (!includeSystem) {
      baseConditions.push("is_system = 0");
    }

    let rows: KnowledgeArticleRow[] = [];

    if (query.search && query.search.trim()) {
      const expression = toFtsPrefixQuery(query.search);
      if (expression) {
        const whereClauses: string[] = [];
        const params: unknown[] = [expression];
        let paramIndex = 2;
        if (categoryValue) {
          whereClauses.push(`COALESCE(ka.category, '') = $${paramIndex}`);
          params.push(categoryValue);
          paramIndex += 1;
        }
        if (!includeSystem) {
          whereClauses.push("ka.is_system = 0");
        }
        const where = whereClauses.length ? ` AND ${whereClauses.join(" AND ")}` : "";
        rows = (await db.select<KnowledgeArticleRow[]>(
          `SELECT ka.*,
                  bm25(knowledge_fts) AS score
             FROM knowledge_fts
             JOIN knowledge_articles ka ON ka.id = knowledge_fts.article_id
            WHERE knowledge_fts MATCH $1${where}
            ORDER BY score ASC, ka.title COLLATE NOCASE`,
          params
        )) as KnowledgeArticleRow[];
      } else {
        rows = (await db.select<KnowledgeArticleRow[]>(
          `SELECT * FROM knowledge_articles
            ${baseConditions.length ? `WHERE ${baseConditions.join(" AND ")}` : ""}
            ORDER BY is_system DESC, title COLLATE NOCASE`,
          baseParams
        )) as KnowledgeArticleRow[];
      }
    } else {
      rows = (await db.select<KnowledgeArticleRow[]>(
        `SELECT * FROM knowledge_articles
          ${baseConditions.length ? `WHERE ${baseConditions.join(" AND ")}` : ""}
          ORDER BY is_system DESC, title COLLATE NOCASE`,
        baseParams
      )) as KnowledgeArticleRow[];
    }

    const articles = rows.map(mapKnowledgeRow);
    if (query.tag && query.tag.trim()) {
      const tag = query.tag.trim().toLowerCase();
      return articles.filter((article) =>
        article.tags.some((candidate) => candidate.toLowerCase() === tag)
      );
    }
    return articles;
  });
}

export async function getKnowledgeArticle(id: string): Promise<KnowledgeArticleRecord | null> {
  await ensureKnowledgeBaseSeeded();
  const rows = await withInit((db) =>
    db.select<KnowledgeArticleRow[]>(`SELECT * FROM knowledge_articles WHERE id = $1`, [id])
  );
  const row = rows[0];
  return row ? mapKnowledgeRow(row) : null;
}

export async function upsertKnowledgeArticle(
  input: UpsertKnowledgeArticleInput
): Promise<KnowledgeArticleRecord> {
  await ensureKnowledgeBaseSeeded();
  return withInit(async (db) => {
    const now = new Date().toISOString();
    const category = toNullableText(input.category ?? null);
    const summary = toNullableText(input.summary ?? null);
    const source = toNullableText(input.source ?? null);
    const tags = serializeTags(input.tags ?? null);

    if (input.id) {
      const existingRows = await db.select<KnowledgeArticleRow[]>(
        `SELECT * FROM knowledge_articles WHERE id = $1`,
        [input.id]
      );
      const existing = existingRows[0];
      if (!existing) {
        throw new Error(`Knowledge article ${input.id} not found`);
      }
      await db.execute(
        `UPDATE knowledge_articles
            SET title = $1,
                category = $2,
                summary = $3,
                content = $4,
                tags = $5,
                source = $6,
                updated_at = $7
          WHERE id = $8`,
        [input.title, category, summary, input.content, tags, source, now, input.id]
      );
      const refreshed = await db.select<KnowledgeArticleRow[]>(
        `SELECT * FROM knowledge_articles WHERE id = $1`,
        [input.id]
      );
      return mapKnowledgeRow(refreshed[0] as KnowledgeArticleRow);
    }

    const id = uuid();
    await db.execute(
      `INSERT INTO knowledge_articles
         (id, title, category, summary, content, tags, source, is_system, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $8)`,
      [id, input.title, category, summary, input.content, tags, source, now]
    );
    const rows = await db.select<KnowledgeArticleRow[]>(
      `SELECT * FROM knowledge_articles WHERE id = $1`,
      [id]
    );
    return mapKnowledgeRow(rows[0] as KnowledgeArticleRow);
  });
}

export async function deleteKnowledgeArticle(id: string): Promise<void> {
  await ensureKnowledgeBaseSeeded();
  await withInit(async (db) => {
    const rows = await db.select<{ is_system: number }[]>(
      `SELECT is_system FROM knowledge_articles WHERE id = $1`,
      [id]
    );
    const isSystem = rows[0]?.is_system ?? 0;
    if (isSystem === 1) {
      throw new Error("System knowledge base articles cannot be deleted");
    }
    await db.execute(`DELETE FROM knowledge_articles WHERE id = $1`, [id]);
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

export interface JumpBudgetSummary extends BudgetComputation {
  drawbackCredit: number;
  balance: number;
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
    await db.execute("DELETE FROM knowledge_fts");
    await db.execute("DELETE FROM notes");
    await db.execute("DELETE FROM files");
    await db.execute("DELETE FROM recaps");
    await db.execute("DELETE FROM next_actions");
    await db.execute("DELETE FROM entities");
    await db.execute("DELETE FROM knowledge_articles");
    await db.execute("DELETE FROM jumps");
  });
  knowledgeSeedInitialized = false;
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

async function summarizeJumpBudgetWithDb(db: Database, jumpId: string): Promise<JumpBudgetSummary> {
  const rows = (await db.select<JumpAssetRecord[]>(
    `SELECT asset_type, cost, quantity, discounted, freebie
     FROM jump_assets
     WHERE jump_id = $1`,
    [jumpId]
  )) as JumpAssetRecord[];

  const purchases: PurchaseCostInput[] = [];
  let drawbackCredit = 0;

  for (const row of rows) {
    const quantity = Math.max(row.quantity ?? 1, 1);
    const cost = Math.max(row.cost ?? 0, 0) * quantity;
    if (row.asset_type === "drawback") {
      drawbackCredit += cost;
      continue;
    }
    purchases.push({
      cost,
      discount: row.discounted === 1,
      freebie: row.freebie === 1,
    });
  }

  const computation = computeBudget(purchases);
  return {
    ...computation,
    drawbackCredit,
    balance: drawbackCredit - computation.netCost,
  };
}

export async function summarizeJumpBudget(jumpId: string): Promise<JumpBudgetSummary> {
  return withInit((db) => summarizeJumpBudgetWithDb(db, jumpId));
}

async function updateJumpCostSummary(jumpId: string): Promise<void> {
  await withInit(async (db) => {
    const summary = await summarizeJumpBudgetWithDb(db, jumpId);
    await db.execute(`UPDATE jumps SET cp_spent = $1, cp_income = $2 WHERE id = $3`, [
      summary.netCost,
      summary.drawbackCredit,
      jumpId,
    ]);
  });
}

export async function listJumpAssets(
  jumpId: string,
  types?: JumpAssetType | JumpAssetType[]
): Promise<JumpAssetRecord[]> {
  return withInit(async (db) => {
    const typeList = Array.isArray(types) ? types : types ? [types] : [];
    if (typeList.length) {
      const placeholders = typeList.map((_, index) => `$${index + 2}`).join(", ");
      const rows = await db.select<JumpAssetRecord[]>(
        `SELECT * FROM jump_assets
         WHERE jump_id = $1 AND asset_type IN (${placeholders})
         ORDER BY sort_order ASC, created_at ASC`,
        [jumpId, ...typeList]
      );
      return rows as JumpAssetRecord[];
    }
    const rows = await db.select<JumpAssetRecord[]>(
      `SELECT * FROM jump_assets
       WHERE jump_id = $1
       ORDER BY asset_type ASC, sort_order ASC, created_at ASC`,
      [jumpId]
    );
    return rows as JumpAssetRecord[];
  });
}

export async function createJumpAsset(input: CreateJumpAssetInput): Promise<JumpAssetRecord> {
  return withInit(async (db) => {
    const id = uuid();
    const now = new Date().toISOString();
    const [row] = (await db.select<{ max_order: number }[]>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order
       FROM jump_assets
       WHERE jump_id = $1 AND asset_type = $2`,
      [input.jump_id, input.asset_type]
    )) as { max_order: number }[];
    const sortOrder =
      typeof input.sort_order === "number" ? input.sort_order : (row?.max_order ?? -1) + 1;
    const quantity = input.quantity ?? 1;
    const discounted = boolToInt(input.discounted);
    const freebie = boolToInt(input.freebie);
    await db.execute(
      `INSERT INTO jump_assets
         (id, jump_id, asset_type, name, category, subcategory, cost, quantity, discounted, freebie, notes, metadata, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)`,
      [
        id,
        input.jump_id,
        input.asset_type,
        input.name,
        toNullableText(input.category ?? null),
        toNullableText(input.subcategory ?? null),
        input.cost ?? 0,
        quantity,
        discounted,
        freebie,
        toNullableText(input.notes ?? null),
        toJsonString(input.metadata ?? null),
        sortOrder,
        now,
      ]
    );
    await updateJumpCostSummary(input.jump_id);
    const rows = await db.select<JumpAssetRecord[]>(`SELECT * FROM jump_assets WHERE id = $1`, [id]);
    return rows[0] as JumpAssetRecord;
  });
}

export async function updateJumpAsset(
  id: string,
  updates: UpdateJumpAssetInput
): Promise<JumpAssetRecord> {
  return withInit(async (db) => {
    const existingRows = await db.select<JumpAssetRecord[]>(
      `SELECT * FROM jump_assets WHERE id = $1`,
      [id]
    );
    const existing = existingRows[0];
    if (!existing) {
      throw new Error(`Jump asset ${id} not found`);
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (updates.name !== undefined) {
      sets.push(`name = $${index++}`);
      values.push(updates.name);
    }
    if (updates.category !== undefined) {
      sets.push(`category = $${index++}`);
      values.push(toNullableText(updates.category));
    }
    if (updates.subcategory !== undefined) {
      sets.push(`subcategory = $${index++}`);
      values.push(toNullableText(updates.subcategory));
    }
    if (updates.cost !== undefined) {
      sets.push(`cost = $${index++}`);
      values.push(updates.cost ?? 0);
    }
    if (updates.quantity !== undefined) {
      sets.push(`quantity = $${index++}`);
      values.push(Math.max(updates.quantity ?? 1, 1));
    }
    if (updates.discounted !== undefined) {
      sets.push(`discounted = $${index++}`);
      values.push(boolToInt(updates.discounted));
    }
    if (updates.freebie !== undefined) {
      sets.push(`freebie = $${index++}`);
      values.push(boolToInt(updates.freebie));
    }
    if (updates.notes !== undefined) {
      sets.push(`notes = $${index++}`);
      values.push(toNullableText(updates.notes));
    }
    if (updates.metadata !== undefined) {
      sets.push(`metadata = $${index++}`);
      values.push(toJsonString(updates.metadata));
    }
    if (updates.sort_order !== undefined) {
      sets.push(`sort_order = $${index++}`);
      values.push(updates.sort_order);
    }

    if (!sets.length) {
      return existing;
    }

    sets.push(`updated_at = $${index++}`);
    const now = new Date().toISOString();
    values.push(now);
    values.push(id);

    await db.execute(
      `UPDATE jump_assets SET ${sets.join(", ")} WHERE id = $${index}`,
      values
    );

    await updateJumpCostSummary(existing.jump_id);

    const rows = await db.select<JumpAssetRecord[]>(`SELECT * FROM jump_assets WHERE id = $1`, [id]);
    return rows[0] as JumpAssetRecord;
  });
}

export async function deleteJumpAsset(id: string): Promise<void> {
  await withInit(async (db) => {
    const rows = await db.select<Pick<JumpAssetRecord, "jump_id">[]>(
      `SELECT jump_id FROM jump_assets WHERE id = $1`,
      [id]
    );
    const jumpId = rows[0]?.jump_id;
    await db.execute(`DELETE FROM jump_assets WHERE id = $1`, [id]);
    if (jumpId) {
      await updateJumpCostSummary(jumpId);
    }
  });
}

export async function reorderJumpAssets(
  jumpId: string,
  assetType: JumpAssetType,
  orderedIds: string[]
): Promise<void> {
  await withInit(async (db) => {
    await db.execute("BEGIN TRANSACTION");
    try {
      for (let index = 0; index < orderedIds.length; index += 1) {
        const assetId = orderedIds[index];
        await db.execute(
          `UPDATE jump_assets
             SET sort_order = $1, updated_at = $2
           WHERE id = $3 AND jump_id = $4 AND asset_type = $5`,
          [index, new Date().toISOString(), assetId, jumpId, assetType]
        );
      }
      await db.execute("COMMIT");
    } catch (error) {
      await db.execute("ROLLBACK");
      throw error;
    }
  });
}

export async function listInventoryItems(
  scope?: InventoryScope
): Promise<InventoryItemRecord[]> {
  return withInit(async (db) => {
    if (scope) {
      const rows = await db.select<InventoryItemRecord[]>(
        `SELECT * FROM inventory_items
         WHERE scope = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [scope]
      );
      return rows as InventoryItemRecord[];
    }
    const rows = await db.select<InventoryItemRecord[]>(
      `SELECT * FROM inventory_items ORDER BY scope ASC, sort_order ASC, created_at ASC`
    );
    return rows as InventoryItemRecord[];
  });
}

export async function createInventoryItem(
  input: CreateInventoryItemInput
): Promise<InventoryItemRecord> {
  return withInit(async (db) => {
    const id = uuid();
    const now = new Date().toISOString();
    const [row] = (await db.select<{ max_order: number }[]>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order
       FROM inventory_items
       WHERE scope = $1`,
      [input.scope]
    )) as { max_order: number }[];
    const sortOrder =
      typeof input.sort_order === "number" ? input.sort_order : (row?.max_order ?? -1) + 1;
    await db.execute(
      `INSERT INTO inventory_items
         (id, scope, name, category, quantity, slot, notes, tags, jump_id, metadata, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
      [
        id,
        input.scope,
        input.name,
        toNullableText(input.category ?? null),
        input.quantity ?? 1,
        toNullableText(input.slot ?? null),
        toNullableText(input.notes ?? null),
        serializeTags(input.tags ?? null),
        input.jump_id ?? null,
        toJsonString(input.metadata ?? null),
        sortOrder,
        now,
      ]
    );
    const rows = await db.select<InventoryItemRecord[]>(
      `SELECT * FROM inventory_items WHERE id = $1`,
      [id]
    );
    return rows[0] as InventoryItemRecord;
  });
}

export async function updateInventoryItem(
  id: string,
  updates: UpdateInventoryItemInput
): Promise<InventoryItemRecord> {
  return withInit(async (db) => {
    const existingRows = await db.select<InventoryItemRecord[]>(
      `SELECT * FROM inventory_items WHERE id = $1`,
      [id]
    );
    const existing = existingRows[0];
    if (!existing) {
      throw new Error(`Inventory item ${id} not found`);
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (updates.scope !== undefined) {
      sets.push(`scope = $${index++}`);
      values.push(updates.scope);
    }
    if (updates.name !== undefined) {
      sets.push(`name = $${index++}`);
      values.push(updates.name);
    }
    if (updates.category !== undefined) {
      sets.push(`category = $${index++}`);
      values.push(toNullableText(updates.category));
    }
    if (updates.quantity !== undefined) {
      sets.push(`quantity = $${index++}`);
      values.push(Math.max(updates.quantity ?? 1, 0));
    }
    if (updates.slot !== undefined) {
      sets.push(`slot = $${index++}`);
      values.push(toNullableText(updates.slot));
    }
    if (updates.notes !== undefined) {
      sets.push(`notes = $${index++}`);
      values.push(toNullableText(updates.notes));
    }
    if (updates.tags !== undefined) {
      sets.push(`tags = $${index++}`);
      values.push(serializeTags(updates.tags));
    }
    if (updates.jump_id !== undefined) {
      sets.push(`jump_id = $${index++}`);
      values.push(updates.jump_id ?? null);
    }
    if (updates.metadata !== undefined) {
      sets.push(`metadata = $${index++}`);
      values.push(toJsonString(updates.metadata));
    }
    if (updates.sort_order !== undefined) {
      sets.push(`sort_order = $${index++}`);
      values.push(updates.sort_order ?? 0);
    }

    if (!sets.length) {
      return existing;
    }

    sets.push(`updated_at = $${index++}`);
    const now = new Date().toISOString();
    values.push(now);
    values.push(id);

    await db.execute(
      `UPDATE inventory_items SET ${sets.join(", ")} WHERE id = $${index}`,
      values
    );

    const rows = await db.select<InventoryItemRecord[]>(
      `SELECT * FROM inventory_items WHERE id = $1`,
      [id]
    );
    return rows[0] as InventoryItemRecord;
  });
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await withInit((db) => db.execute(`DELETE FROM inventory_items WHERE id = $1`, [id]));
}

export async function moveInventoryItem(
  id: string,
  scope: InventoryScope,
  sortOrder?: number
): Promise<void> {
  await withInit(async (db) => {
    const newOrder =
      typeof sortOrder === "number"
        ? sortOrder
        : ((await db.select<{ max_order: number }[]>(
            `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM inventory_items WHERE scope = $1`,
            [scope]
          )) as { max_order: number }[])[0]?.max_order ?? -1;
    await db.execute(
      `UPDATE inventory_items SET scope = $1, sort_order = $2, updated_at = $3 WHERE id = $4`,
      [scope, typeof sortOrder === "number" ? sortOrder : newOrder + 1, new Date().toISOString(), id]
    );
  });
}

export async function listCharacterProfiles(): Promise<CharacterProfileRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<CharacterProfileRecord[]>(
      `SELECT * FROM character_profiles ORDER BY created_at DESC`
    );
    return rows as CharacterProfileRecord[];
  });
}

export async function getCharacterProfile(id: string): Promise<CharacterProfileRecord | null> {
  const rows = await withInit((db) =>
    db.select<CharacterProfileRecord[]>(`SELECT * FROM character_profiles WHERE id = $1`, [id])
  );
  return (rows as CharacterProfileRecord[])[0] ?? null;
}

export async function upsertCharacterProfile(
  input: UpsertCharacterProfileInput
): Promise<CharacterProfileRecord> {
  return withInit(async (db) => {
    const id = input.id ?? uuid();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO character_profiles
         (id, name, alias, species, homeland, biography, attributes_json, traits_json, alt_forms_json, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         alias = excluded.alias,
         species = excluded.species,
         homeland = excluded.homeland,
         biography = excluded.biography,
         attributes_json = excluded.attributes_json,
         traits_json = excluded.traits_json,
         alt_forms_json = excluded.alt_forms_json,
         notes = excluded.notes,
         updated_at = excluded.updated_at`,
      [
        id,
        input.name,
        toNullableText(input.alias ?? null),
        toNullableText(input.species ?? null),
        toNullableText(input.homeland ?? null),
        toNullableText(input.biography ?? null),
        toJsonString(input.attributes ?? null),
        toJsonString(input.traits ?? null),
        toJsonString(input.alt_forms ?? null),
        toNullableText(input.notes ?? null),
        now,
      ]
    );
    const rows = await db.select<CharacterProfileRecord[]>(
      `SELECT * FROM character_profiles WHERE id = $1`,
      [id]
    );
    return rows[0] as CharacterProfileRecord;
  });
}

export async function deleteCharacterProfile(id: string): Promise<void> {
  await withInit((db) => db.execute(`DELETE FROM character_profiles WHERE id = $1`, [id]));
}

export async function listAppSettings(): Promise<AppSettingRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<AppSettingRecord[]>(
      `SELECT * FROM app_settings ORDER BY key COLLATE NOCASE`
    );
    return rows as AppSettingRecord[];
  });
}

export async function getAppSetting(key: string): Promise<AppSettingRecord | null> {
  const rows = await withInit((db) =>
    db.select<AppSettingRecord[]>(`SELECT * FROM app_settings WHERE key = $1`, [key])
  );
  return (rows as AppSettingRecord[])[0] ?? null;
}

export async function setAppSetting(
  key: string,
  value: unknown
): Promise<AppSettingRecord> {
  return withInit(async (db) => {
    const serialized =
      value === null || value === undefined
        ? null
        : typeof value === "string"
          ? value
          : JSON.stringify(value);
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, serialized, now]
    );
    const rows = await db.select<AppSettingRecord[]>(
      `SELECT * FROM app_settings WHERE key = $1`,
      [key]
    );
    return rows[0] as AppSettingRecord;
  });
}

export async function deleteAppSetting(key: string): Promise<void> {
  await withInit((db) => db.execute(`DELETE FROM app_settings WHERE key = $1`, [key]));
}

export async function listExportPresets(): Promise<ExportPresetRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<ExportPresetRecord[]>(
      `SELECT * FROM export_presets ORDER BY name COLLATE NOCASE`
    );
    return rows as ExportPresetRecord[];
  });
}

export async function upsertExportPreset(
  input: UpsertExportPresetInput
): Promise<ExportPresetRecord> {
  return withInit(async (db) => {
    const id = input.id ?? uuid();
    const now = new Date().toISOString();
    const options =
      typeof input.options === "string" ? input.options : JSON.stringify(input.options ?? {});
    await db.execute(
      `INSERT INTO export_presets (id, name, description, options_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         options_json = excluded.options_json,
         updated_at = excluded.updated_at`,
      [id, input.name, toNullableText(input.description ?? null), options, now]
    );
    const rows = await db.select<ExportPresetRecord[]>(
      `SELECT * FROM export_presets WHERE id = $1`,
      [id]
    );
    return rows[0] as ExportPresetRecord;
  });
}

export async function deleteExportPreset(id: string): Promise<void> {
  await withInit((db) => db.execute(`DELETE FROM export_presets WHERE id = $1`, [id]));
}

export interface ExportSnapshot {
  jumps: JumpRecord[];
  jumpAssets: JumpAssetRecord[];
  inventory: InventoryItemRecord[];
  notes: NoteRecord[];
  recaps: RecapRecord[];
  profiles: CharacterProfileRecord[];
  settings: AppSettingRecord[];
  presets: ExportPresetRecord[];
}

export async function loadExportSnapshot(): Promise<ExportSnapshot> {
  const [jumps, jumpAssets, inventory, notes, recaps, profiles, settings, presets] = await Promise.all([
    listJumps(),
    withInit((db) =>
      db.select<JumpAssetRecord[]>(
        `SELECT * FROM jump_assets ORDER BY jump_id ASC, asset_type ASC, sort_order ASC`
      )
    ).then((rows) => rows as JumpAssetRecord[]),
    listInventoryItems(),
    listAllNotes(),
    listRecaps(),
    listCharacterProfiles(),
    listAppSettings(),
    listExportPresets(),
  ]);

  return {
    jumps,
    jumpAssets,
    inventory,
    notes,
    recaps,
    profiles,
    settings,
    presets,
  };
}
