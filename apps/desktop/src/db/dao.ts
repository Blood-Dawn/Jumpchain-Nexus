/*
Bloodawn

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
import {
  parseAssetMetadata,
  type AssetAltFormMetadata,
  type AssetAttributeBonus,
  type StipendMetadata,
} from "../assetMetadata";
import type { ThousandsSeparatorOption } from "../services/formatter";
import baseSchema from "./migrations/001_init.sql?raw";
import supplementsSchema from "./migrations/004_supplements.sql?raw";
import knowledgeImportErrorsSchema from "./migrations/005_knowledge_import_errors.sql?raw";
import { knowledgeSeed } from "./knowledgeSeed";
import { aggregatePersonalReality } from "./personalReality";

export type EntityKind =
  | "perk"
  | "item"
  | "companion"
  | "drawback"
  | "origin"
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
  related_asset_ids: string[];
}

export interface UpsertKnowledgeArticleInput {
  id?: string;
  title: string;
  category?: string | null;
  summary?: string | null;
  content: string;
  tags?: string[];
  source?: string | null;
  relatedAssetIds?: string[];
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

export interface KnowledgeBaseImportError {
  path: string;
  reason: string;
}

interface KnowledgeBaseImportErrorRow {
  id: string;
  path: string;
  reason: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseImportErrorRecord extends KnowledgeBaseImportError {
  id: string;
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
  knowledge_article_ids: string[];
}

interface JumpAssetRow {
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

export interface AssetReferenceSummary {
  asset_id: string;
  asset_name: string;
  asset_type: JumpAssetType;
  jump_id: string;
  jump_title: string;
}

export interface KnowledgeArticleReferenceSummary {
  id: string;
  title: string;
  summary: string | null;
}

interface AssetReferenceRow {
  asset_id: string;
  asset_name: string | null;
  asset_type: JumpAssetType;
  jump_id: string;
  jump_title: string | null;
}

interface KnowledgeArticleSummaryRow {
  id: string;
  title: string;
  summary: string | null;
}

interface JumpStipendToggleRow {
  asset_id: string;
  enabled: number;
  override_total: number | null;
}

interface CompanionImportRow {
  id: string;
  asset_id: string;
  companion_name: string;
  option_value: number | null;
  selected: number;
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
  asset_type?: JumpAssetType;
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

interface JumpAssetWithJump extends JumpAssetRecord {
  jump_title: string | null;
}

export interface PassportDerivedSource {
  assetId: string;
  assetName: string;
  assetType: JumpAssetType;
  jumpId: string;
  jumpTitle: string | null;
}

export interface PassportDerivedTrait {
  name: string;
  sources: PassportDerivedSource[];
}

export interface PassportDerivedAltForm {
  name: string;
  summary: string;
  sources: PassportDerivedSource[];
}

export interface PassportDerivedAttributeEntry extends PassportDerivedSource {
  value: string;
  numericValue: number | null;
}

export interface PassportDerivedAttribute {
  key: string;
  total: number;
  numericCount: number;
  entries: PassportDerivedAttributeEntry[];
}

export interface PassportDerivedAsset {
  id: string;
  jumpId: string;
  jumpTitle: string | null;
  assetType: JumpAssetType;
  name: string;
  category: string | null;
  subcategory: string | null;
  notes: string | null;
  traitTags: string[];
  attributes: AssetAttributeBonus[];
  altForms: AssetAltFormMetadata[];
  stipend: StipendMetadata | null;
}

export interface PassportDerivedSnapshot {
  perks: PassportDerivedAsset[];
  companions: PassportDerivedAsset[];
  traits: PassportDerivedTrait[];
  altForms: PassportDerivedAltForm[];
  attributes: PassportDerivedAttribute[];
  stipendTotal: number;
  stipends: Array<
    PassportDerivedSource & {
      amount: number;
      frequency: StipendMetadata["frequency"];
      notes?: string;
    }
  >;
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

export type AppearanceTheme = "andromeda" | "solstice";
export type AppearanceThemeOption = "starfield" | "nebula" | "minimal";

export interface AppearanceSettings {
  theme: AppearanceTheme;
  backgroundTheme: AppearanceThemeOption;
}

export interface FormatterSettings {
  removeAllLineBreaks: boolean;
  leaveDoubleLineBreaks: boolean;
  thousandsSeparator: ThousandsSeparatorOption;
  spellcheckEnabled: boolean;
}

export interface JumpDefaultsSettings {
  standardBudget: number;
  gauntletBudget: number;
  companionStipend: number;
}

export interface SupplementToggleSettings {
  enableDrawbackSupplement: boolean;
  enableUniversalDrawbacks: boolean;
  enableEssentialBodyMod: boolean;
  allowCompanionBodyMod: boolean;
}

export type EssentialStartingMode = "hardcore" | "standard" | "heroic";
export type EssentialEssenceMode = "none" | "single" | "dual" | "multi";
export type EssentialAdvancementMode = "standard" | "meteoric" | "heroic" | "questing";
export type EssentialEpAccessMode = "none" | "lesser" | "standard";
export type EssentialEpAccessModifier = "none" | "cumulative" | "retro-cumulative";
export type EssentialUnbalancedMode = "none" | "harmonized" | "very-harmonized" | "perfectly-harmonized";
export type EssentialLimiter =
  | "none"
  | "everyday-hero"
  | "street-level"
  | "mid-level"
  | "body-mod"
  | "scaling-i"
  | "scaling-ii"
  | "vanishing";

export interface EssentialBodyModSettings {
  budget: number;
  startingMode: EssentialStartingMode;
  essenceMode: EssentialEssenceMode;
  advancementMode: EssentialAdvancementMode;
  epAccessMode: EssentialEpAccessMode;
  epAccessModifier: EssentialEpAccessModifier;
  unlockableEssence: boolean;
  limitInvestment: boolean;
  investmentAllowed: boolean;
  investmentRatio: number;
  incrementalBudget: number;
  incrementalInterval: number;
  trainingAllowance: boolean;
  temperedBySuffering: boolean;
  unbalancedMode: EssentialUnbalancedMode;
  unbalancedDescription: string | null;
  limiter: EssentialLimiter;
  limiterDescription: string | null;
}

export interface EssentialBodyModSettingsRecord extends EssentialBodyModSettings {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface EssentialBodyModEssenceRecord {
  id: string;
  setting_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertEssentialBodyModEssenceInput {
  id?: string;
  name: string;
  description?: string | null;
  sort_order?: number;
}

export interface UniversalDrawbackSettings {
  totalCP: number;
  companionCP: number;
  itemCP: number;
  warehouseWP: number;
  allowGauntlet: boolean;
  gauntletHalved: boolean;
}

export interface UniversalDrawbackSettingsRecord extends UniversalDrawbackSettings {
  id: string;
  created_at: string;
  updated_at: string;
}

export type WarehouseModeOption = "generic" | "personal-reality";

export interface WarehouseModeSettings {
  mode: WarehouseModeOption;
}

export interface WarehousePersonalRealityLimitCounter {
  key: string;
  label: string;
  provided: number;
  used: number;
  baseProvided: number;
  override?: number | null;
}

export interface WarehousePersonalRealitySummary {
  wpTotal: number;
  wpCap: number | null;
  wpBaseCap: number | null;
  wpOverride?: number | null;
  limits: WarehousePersonalRealityLimitCounter[];
}

export interface CategoryPresetSettings {
  perkCategories: string[];
  itemCategories: string[];
}

export interface ExportPreferenceSettings {
  defaultPresetId: string | null;
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
const RANDOMIZER_HISTORY_LIMIT = 50;

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

async function getTableColumns(db: Database, table: string): Promise<Set<string>> {
  const rows = await db.select<{ name: string }[]>(`PRAGMA table_info('${table}')`);
  return new Set(rows.map((row) => row.name));
}

async function ensureColumn(
  db: Database,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const columns = await getTableColumns(db, table);
  if (!columns.has(column)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${definition};`);
  }
}

async function ensureLegacyColumns(db: Database): Promise<void> {
  await ensureColumn(db, "jumps", "sort_order", "sort_order INTEGER DEFAULT 0");
  await ensureColumn(db, "jumps", "cp_budget", "cp_budget INTEGER DEFAULT 0");
  await ensureColumn(db, "jumps", "cp_spent", "cp_spent INTEGER DEFAULT 0");
  await ensureColumn(db, "jumps", "cp_income", "cp_income INTEGER DEFAULT 0");
}

export async function ensureInitialized(): Promise<void> {
  if (schemaApplied) {
    return;
  }
  const db = await getDb();
  const schemas = [baseSchema, supplementsSchema];
  for (const source of schemas) {
    const statements = splitStatements(source);
    for (const statement of statements) {
      await db.execute(statement);
    }
  }
  await ensureLegacyColumns(db);
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

function sanitizeStringArray(value: string[] | null | undefined): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const result = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return result.length ? Array.from(new Set(result)) : null;
}

function encodeStringArray(value: string[] | null | undefined): string | null {
  const sanitized = sanitizeStringArray(value);
  if (!sanitized) {
    return null;
  }
  try {
    return JSON.stringify(sanitized);
  } catch (error) {
    console.warn("Failed to encode string array", error);
    return null;
  }
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0);
    }
  } catch (error) {
    console.warn("Failed to parse string array", error);
  }
  return [];
}

function encodeFilters(value: Record<string, unknown> | null | undefined): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const entries = Object.entries(value).filter(([key]) => typeof key === "string" && key.trim().length > 0);
  if (!entries.length) {
    return null;
  }
  const normalized: Record<string, unknown> = {};
  for (const [key, item] of entries) {
    normalized[key.trim()] = item;
  }
  try {
    return JSON.stringify(normalized);
  } catch (error) {
    console.warn("Failed to encode filters record", error);
    return null;
  }
}

function parseFilters(value: string | null | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.warn("Failed to parse filters record", error);
  }
  return {};
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

export async function deleteEntity(id: string): Promise<void> {
  await withInit((db) => db.execute(`DELETE FROM entities WHERE id = $1`, [id]));
}

function mapKnowledgeRow(
  row: KnowledgeArticleRow,
  relatedAssetIds: string[] = []
): KnowledgeArticleRecord {
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
    related_asset_ids: relatedAssetIds,
  };
}

function mapJumpAssetRow(
  row: JumpAssetRow,
  knowledgeArticleIds: string[] = []
): JumpAssetRecord {
  return {
    ...row,
    knowledge_article_ids: knowledgeArticleIds,
  };
}

function normalizeIdList(values: Iterable<unknown> | null | undefined): string[] {
  if (!values) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const text = typeof value === "string" ? value : String(value ?? "");
    const trimmed = text.trim();
    if (!trimmed.length || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

async function loadKnowledgeArticleAssetMap(
  db: Database,
  articleIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!articleIds.length) {
    return map;
  }
  const placeholders = articleIds.map((_, index) => `$${index + 1}`).join(", ");
  const rows = (await db.select<KnowledgeArticleAssetRow[]>(
    `SELECT article_id, asset_id
       FROM knowledge_article_assets
      WHERE article_id IN (${placeholders})
      ORDER BY article_id ASC, asset_id ASC`,
    articleIds
  )) as KnowledgeArticleAssetRow[];
  for (const row of rows) {
    const list = map.get(row.article_id) ?? [];
    if (!list.includes(row.asset_id)) {
      list.push(row.asset_id);
    }
    map.set(row.article_id, list);
  }
  return map;
}

async function loadAssetKnowledgeArticleMap(
  db: Database,
  assetIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!assetIds.length) {
    return map;
  }
  const placeholders = assetIds.map((_, index) => `$${index + 1}`).join(", ");
  const rows = (await db.select<KnowledgeArticleAssetRow[]>(
    `SELECT article_id, asset_id
       FROM knowledge_article_assets
      WHERE asset_id IN (${placeholders})
      ORDER BY asset_id ASC, article_id ASC`,
    assetIds
  )) as KnowledgeArticleAssetRow[];
  for (const row of rows) {
    const list = map.get(row.asset_id) ?? [];
    if (!list.includes(row.article_id)) {
      list.push(row.article_id);
    }
    map.set(row.asset_id, list);
  }
  return map;
}

async function replaceArticleAssetLinks(
  db: Database,
  articleId: string,
  assetIds: string[]
): Promise<void> {
  await db.execute(`DELETE FROM knowledge_article_assets WHERE article_id = $1`, [articleId]);
  if (!assetIds.length) {
    return;
  }
  for (const assetId of assetIds) {
    await db.execute(
      `INSERT INTO knowledge_article_assets (article_id, asset_id)
       VALUES ($1, $2)`,
      [articleId, assetId]
    );
  }
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

    const seen = new Set<string>();
    const articles = rows.reduce<KnowledgeArticleRecord[]>((acc, row) => {
      const record = mapKnowledgeRow(row);
      if (!seen.has(record.id)) {
        seen.add(record.id);
        acc.push(record);
      }
      return acc;
    }, []);
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
  return withInit(async (db) => {
    const rows = (await db.select<KnowledgeArticleRow[]>(
      `SELECT * FROM knowledge_articles WHERE id = $1`,
      [id]
    )) as KnowledgeArticleRow[];
    const row = rows[0];
    if (!row) {
      return null;
    }
    const relationMap = await loadKnowledgeArticleAssetMap(db, [row.id]);
    return mapKnowledgeRow(row, relationMap.get(row.id) ?? []);
  });
}

export async function lookupAssetReferenceSummaries(
  assetIds: string[]
): Promise<AssetReferenceSummary[]> {
  const normalized = normalizeIdList(assetIds);
  if (!normalized.length) {
    return [];
  }
  return withInit(async (db) => {
    const placeholders = normalized.map((_, index) => `$${index + 1}`).join(", ");
    const rows = (await db.select<AssetReferenceRow[]>(
      `SELECT a.id AS asset_id,
              a.name AS asset_name,
              a.asset_type,
              a.jump_id,
              j.title AS jump_title
         FROM jump_assets a
         JOIN jumps j ON j.id = a.jump_id
        WHERE a.id IN (${placeholders})
        ORDER BY j.title COLLATE NOCASE, a.asset_type, a.name COLLATE NOCASE`,
      normalized
    )) as AssetReferenceRow[];
    return rows.map((row) => ({
      asset_id: row.asset_id,
      asset_name: row.asset_name ?? "Unnamed Asset",
      asset_type: row.asset_type,
      jump_id: row.jump_id,
      jump_title: row.jump_title ?? "Untitled Jump",
    }));
  });
}

export async function listAssetReferenceSummaries(): Promise<AssetReferenceSummary[]> {
  return withInit(async (db) => {
    const rows = (await db.select<AssetReferenceRow[]>(
      `SELECT a.id AS asset_id,
              a.name AS asset_name,
              a.asset_type,
              a.jump_id,
              j.title AS jump_title
         FROM jump_assets a
         JOIN jumps j ON j.id = a.jump_id
        ORDER BY j.title COLLATE NOCASE, a.asset_type, a.name COLLATE NOCASE`
    )) as AssetReferenceRow[];
    return rows.map((row) => ({
      asset_id: row.asset_id,
      asset_name: row.asset_name ?? "Unnamed Asset",
      asset_type: row.asset_type,
      jump_id: row.jump_id,
      jump_title: row.jump_title ?? "Untitled Jump",
    }));
  });
}

export async function lookupKnowledgeArticleSummaries(
  articleIds: string[]
): Promise<KnowledgeArticleReferenceSummary[]> {
  await ensureKnowledgeBaseSeeded();
  const normalized = normalizeIdList(articleIds);
  if (!normalized.length) {
    return [];
  }
  return withInit(async (db) => {
    const placeholders = normalized.map((_, index) => `$${index + 1}`).join(", ");
    const rows = (await db.select<KnowledgeArticleSummaryRow[]>(
      `SELECT id, title, summary
         FROM knowledge_articles
        WHERE id IN (${placeholders})`,
      normalized
    )) as KnowledgeArticleSummaryRow[];
    const lookup = new Map(rows.map((row) => [row.id, row] as const));
    const summaries: KnowledgeArticleReferenceSummary[] = [];
    for (const id of normalized) {
      const row = lookup.get(id);
      if (!row) {
        continue;
      }
      summaries.push({
        id: row.id,
        title: row.title,
        summary: row.summary ?? null,
      });
    }
    return summaries;
  });
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
    const relatedAssetIds = normalizeIdList(input.relatedAssetIds ?? []);

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
      await replaceArticleAssetLinks(db, input.id, relatedAssetIds);
      const refreshed = await db.select<KnowledgeArticleRow[]>(
        `SELECT * FROM knowledge_articles WHERE id = $1`,
        [input.id]
      );
      const row = refreshed[0] as KnowledgeArticleRow;
      return mapKnowledgeRow(row, relatedAssetIds);
    }

    const id = uuid();
    await db.execute(
      `INSERT INTO knowledge_articles
         (id, title, category, summary, content, tags, source, is_system, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $8)`,
      [id, input.title, category, summary, input.content, tags, source, now]
    );
    await replaceArticleAssetLinks(db, id, relatedAssetIds);
    const rows = await db.select<KnowledgeArticleRow[]>(
      `SELECT * FROM knowledge_articles WHERE id = $1`,
      [id]
    );
    return mapKnowledgeRow(rows[0] as KnowledgeArticleRow, relatedAssetIds);
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

export async function recordKnowledgeBaseImportErrors(
  errors: KnowledgeBaseImportError[]
): Promise<void> {
  if (!errors.length) {
    return;
  }

  await withInit(async (db) => {
    for (const error of errors) {
      const timestamp = new Date().toISOString();
      await db.execute(
        `INSERT INTO knowledge_import_errors (id, path, reason, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT(path)
         DO UPDATE SET reason = excluded.reason, updated_at = excluded.updated_at`,
        [uuid(), error.path, error.reason, timestamp]
      );
    }
  });
}

export async function listKnowledgeBaseImportErrors(): Promise<KnowledgeBaseImportErrorRecord[]> {
  return withInit(async (db) => {
    const rows = (await db.select<KnowledgeBaseImportErrorRow[]>(
      `SELECT id, path, reason, created_at, updated_at
         FROM knowledge_import_errors
        ORDER BY updated_at DESC, created_at DESC`
    )) as KnowledgeBaseImportErrorRow[];

    return rows.map((row) => ({
      id: row.id,
      path: row.path,
      reason: row.reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  });
}

export async function deleteKnowledgeBaseImportError(id: string): Promise<void> {
  await withInit((db) => db.execute(`DELETE FROM knowledge_import_errors WHERE id = $1`, [id]));
}

export async function clearKnowledgeBaseImportErrors(): Promise<void> {
  await withInit((db) => db.execute(`DELETE FROM knowledge_import_errors`));
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

export interface JumpStipendToggleSummaryEntry {
  assetId: string;
  assetName: string | null;
  enabled: boolean;
  amount: number;
  potentialAmount: number;
}

export interface CompanionImportSummaryEntry {
  id: string;
  assetId: string;
  assetName: string | null;
  companionName: string;
  optionValue: number;
  selected: boolean;
}

export interface JumpBudgetSummary extends BudgetComputation {
  drawbackCredit: number;
  balance: number;
  purchasesNetCost: number;
  stipendAdjustments: number;
  stipendPotential: number;
  stipendToggles: JumpStipendToggleSummaryEntry[];
  companionImportCost: number;
  companionImportSelections: CompanionImportSummaryEntry[];
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
    await db.execute("DELETE FROM knowledge_import_errors");
    await db.execute("DELETE FROM companion_imports");
    await db.execute("DELETE FROM jump_stipend_toggles");
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
  const assetRows = (await db.select<JumpAssetRecord[]>(
    `SELECT id, asset_type, name, cost, quantity, discounted, freebie, metadata
     FROM jump_assets
     WHERE jump_id = $1`,
    [jumpId]
  )) as JumpAssetRecord[];

  const toggleRows = (await db.select<JumpStipendToggleRow[]>(
    `SELECT asset_id, enabled, override_total
     FROM jump_stipend_toggles
     WHERE jump_id = $1`,
    [jumpId]
  )) as JumpStipendToggleRow[];

  const companionImportRows = (await db.select<CompanionImportRow[]>(
    `SELECT id, asset_id, companion_name, option_value, selected
     FROM companion_imports
     WHERE jump_id = $1`,
    [jumpId]
  )) as CompanionImportRow[];

  const toggleMap = new Map<string, JumpStipendToggleRow>();
  for (const row of toggleRows) {
    toggleMap.set(row.asset_id, row);
  }

  const assetNameMap = new Map<string, string | null>();
  const purchases: PurchaseCostInput[] = [];
  const stipendToggles: JumpStipendToggleSummaryEntry[] = [];
  let stipendAdjustments = 0;
  let stipendPotential = 0;
  let drawbackCredit = 0;

  for (const row of assetRows) {
    const quantity = Math.max(row.quantity ?? 1, 1);
    const cost = Math.max(row.cost ?? 0, 0) * quantity;
    assetNameMap.set(row.id, row.name ?? null);

    if (row.asset_type === "drawback") {
      drawbackCredit += cost;
    } else {
      purchases.push({
        cost,
        discount: row.discounted === 1,
        freebie: row.freebie === 1,
      });
    }

    const metadata = parseAssetMetadata(row.metadata);
    if (metadata.stipend) {
      const baseAmount = Number.isFinite(metadata.stipend.total)
        ? Number(metadata.stipend.total)
        : 0;
      const toggle = toggleMap.get(row.id);
      const override = toggle?.override_total;
      const overrideAmount =
        override !== null && override !== undefined && Number.isFinite(override)
          ? Number(override)
          : null;
      const appliedAmount = overrideAmount ?? baseAmount;
      const enabled = toggle ? toggle.enabled === 1 : true;

      stipendPotential += baseAmount;
      if (enabled) {
        stipendAdjustments += appliedAmount;
      }

      stipendToggles.push({
        assetId: row.id,
        assetName: row.name ?? null,
        enabled,
        amount: appliedAmount,
        potentialAmount: baseAmount,
      });
    }
  }

  const companionImportSelections: CompanionImportSummaryEntry[] = companionImportRows.map((row) => {
    const optionValueRaw = row.option_value ?? 0;
    const optionValue = Number.isFinite(optionValueRaw) ? Number(optionValueRaw) : 0;
    return {
      id: row.id,
      assetId: row.asset_id,
      assetName: assetNameMap.get(row.asset_id) ?? null,
      companionName: row.companion_name,
      optionValue,
      selected: row.selected === 1,
    } satisfies CompanionImportSummaryEntry;
  });

  const companionImportCost = companionImportSelections.reduce((total, entry) => {
    if (!entry.selected) {
      return total;
    }
    const normalized = Number.isFinite(entry.optionValue) ? entry.optionValue : 0;
    return total + normalized;
  }, 0);

  const computation = computeBudget(purchases);
  const purchasesNetCost = computation.netCost;
  const netCost = purchasesNetCost + companionImportCost;
  const balance = drawbackCredit + stipendAdjustments - netCost;

  return {
    totalCost: computation.totalCost,
    discounted: computation.discounted,
    freebies: computation.freebies,
    netCost,
    purchasesNetCost,
    drawbackCredit,
    balance,
    stipendAdjustments,
    stipendPotential,
    stipendToggles,
    companionImportCost,
    companionImportSelections,
  };
}

export async function summarizeJumpBudget(jumpId: string): Promise<JumpBudgetSummary> {
  return withInit((db) => summarizeJumpBudgetWithDb(db, jumpId));
}

export async function setJumpStipendToggle(
  jumpId: string,
  assetId: string,
  enabled: boolean,
  overrideTotal?: number | null
): Promise<void> {
  await withInit(async (db) => {
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO jump_stipend_toggles (jump_id, asset_id, enabled, override_total, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(jump_id, asset_id) DO UPDATE SET
         enabled = excluded.enabled,
         override_total = excluded.override_total,
         updated_at = excluded.updated_at`,
      [jumpId, assetId, boolToInt(enabled), overrideTotal ?? null, now]
    );
    await updateJumpCostSummaryWithDb(db, jumpId);
  });
}

export async function setCompanionImportSelection(importId: string, selected: boolean): Promise<void> {
  await withInit(async (db) => {
    const rows = (await db.select<{ jump_id: string }[]>(
      `SELECT jump_id FROM companion_imports WHERE id = $1`,
      [importId]
    )) as { jump_id: string }[];

    if (!rows.length) {
      return;
    }

    const jumpId = rows[0].jump_id;
    const now = new Date().toISOString();
    await db.execute(
      `UPDATE companion_imports
       SET selected = $2, updated_at = $3
       WHERE id = $1`,
      [importId, boolToInt(selected), now]
    );

    await updateJumpCostSummaryWithDb(db, jumpId);
  });
}

async function updateJumpCostSummaryWithDb(db: Database, jumpId: string): Promise<void> {
  const summary = await summarizeJumpBudgetWithDb(db, jumpId);
  await db.execute(`UPDATE jumps SET cp_spent = $1, cp_income = $2 WHERE id = $3`, [
    summary.netCost,
    summary.drawbackCredit + summary.stipendAdjustments,
    jumpId,
  ]);
}

async function updateJumpCostSummary(jumpId: string): Promise<void> {
  await withInit((db) => updateJumpCostSummaryWithDb(db, jumpId));
}

export async function listJumpAssets(
  jumpId: string,
  types?: JumpAssetType | JumpAssetType[]
): Promise<JumpAssetRecord[]> {
  return withInit(async (db) => {
    const typeList = Array.isArray(types) ? types : types ? [types] : [];
    if (typeList.length) {
      const placeholders = typeList.map((_, index) => `$${index + 2}`).join(", ");
      const rows = (await db.select<JumpAssetRow[]>(
        `SELECT * FROM jump_assets
         WHERE jump_id = $1 AND asset_type IN (${placeholders})
         ORDER BY sort_order ASC, created_at ASC`,
        [jumpId, ...typeList]
      )) as JumpAssetRow[];
      const relationMap = await loadAssetKnowledgeArticleMap(
        db,
        rows.map((row) => row.id)
      );
      return rows.map((row) =>
        mapJumpAssetRow(row, relationMap.get(row.id) ?? [])
      );
    }
    const rows = (await db.select<JumpAssetRow[]>(
      `SELECT * FROM jump_assets
       WHERE jump_id = $1
       ORDER BY asset_type ASC, sort_order ASC, created_at ASC`,
      [jumpId]
    )) as JumpAssetRow[];
    const relationMap = await loadAssetKnowledgeArticleMap(
      db,
      rows.map((row) => row.id)
    );
    return rows.map((row) => mapJumpAssetRow(row, relationMap.get(row.id) ?? []));
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
    const rows = (await db.select<JumpAssetRow[]>(
      `SELECT * FROM jump_assets WHERE id = $1`,
      [id]
    )) as JumpAssetRow[];
    return mapJumpAssetRow(rows[0] as JumpAssetRow, []);
  });
}

export async function updateJumpAsset(
  id: string,
  updates: UpdateJumpAssetInput
): Promise<JumpAssetRecord> {
  return withInit(async (db) => {
    const existingRows = (await db.select<JumpAssetRow[]>(
      `SELECT * FROM jump_assets WHERE id = $1`,
      [id]
    )) as JumpAssetRow[];
    const existingRow = existingRows[0];
    if (!existingRow) {
      throw new Error(`Jump asset ${id} not found`);
    }
    const existingRelations = await loadAssetKnowledgeArticleMap(db, [id]);
    const existing = mapJumpAssetRow(existingRow, existingRelations.get(id) ?? []);

    const sets: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (updates.name !== undefined) {
      sets.push(`name = $${index++}`);
      values.push(updates.name);
    }
    if (updates.asset_type !== undefined) {
      sets.push(`asset_type = $${index++}`);
      values.push(updates.asset_type);
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

    sets.push(`updated_at = $${index++}`);
    const now = new Date().toISOString();
    values.push(now);
    values.push(id);

    await db.execute(
      `UPDATE jump_assets SET ${sets.join(", ")} WHERE id = $${index}`,
      values
    );

    await updateJumpCostSummary(existing.jump_id);

    const rows = (await db.select<JumpAssetRow[]>(
      `SELECT * FROM jump_assets WHERE id = $1`,
      [id]
    )) as JumpAssetRow[];
    const relationMap = await loadAssetKnowledgeArticleMap(db, [id]);
    return mapJumpAssetRow(rows[0] as JumpAssetRow, relationMap.get(id) ?? existing.knowledge_article_ids);
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

interface PersonalRealityContribution {
  wpCost: number;
  provides: Record<string, number>;
  consumes: Record<string, number>;
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeLimitEntries = (value: unknown): Record<string, number> => {
  const result: Record<string, number> = {};
  if (!value) {
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const record = entry as Record<string, unknown>;
      const keyRaw = record.key ?? record.name ?? record.type ?? record.label;
      if (keyRaw == null) {
        return;
      }
      const key = String(keyRaw).trim();
      if (!key.length) {
        return;
      }
      const numberValue =
        toFiniteNumber(record.value ?? record.amount ?? record.count ?? record.quantity ?? record.capacity) ?? 0;
      if (!numberValue) {
        return;
      }
      result[key] = (result[key] ?? 0) + numberValue;
    });
    return result;
  }
  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([rawKey, rawValue]) => {
      const key = rawKey.trim();
      if (!key.length) {
        return;
      }
      if (typeof rawValue === "object" && rawValue !== null) {
        const nested = rawValue as Record<string, unknown>;
        const numberValue = toFiniteNumber(nested.value ?? nested.amount ?? nested.count ?? nested.quantity);
        if (numberValue !== null && numberValue !== 0) {
          result[key] = (result[key] ?? 0) + numberValue;
        }
        return;
      }
      const numberValue = toFiniteNumber(rawValue);
      if (numberValue !== null && numberValue !== 0) {
        result[key] = (result[key] ?? 0) + numberValue;
      }
    });
  }
  return result;
};

const parsePersonalRealityContribution = (raw: string | null): PersonalRealityContribution | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const personalRealityRaw =
      (record.personalReality as Record<string, unknown> | undefined) ??
      (record.personal_reality as Record<string, unknown> | undefined) ??
      (record.pr as Record<string, unknown> | undefined) ??
      null;
    const container = personalRealityRaw ?? record;

    const wpValue =
      toFiniteNumber(container.wp ?? container.wpCost ?? record.wp ?? record.warehouseWp ?? record.wp_cost) ?? 0;

    const providesRaw = container.provides ?? container.capacity ?? container.slots ?? record.provides;
    const consumesRaw = container.consumes ?? container.uses ?? container.requirements ?? record.consumes;
    const capsRaw = container.caps ?? container.cap ?? container.limits;

    const provides = normalizeLimitEntries(providesRaw);
    const consumes = normalizeLimitEntries(consumesRaw);
    const caps = normalizeLimitEntries(capsRaw);

    Object.entries(caps).forEach(([key, value]) => {
      provides[key] = (provides[key] ?? 0) + value;
    });

    if (!wpValue && !Object.keys(provides).length && !Object.keys(consumes).length) {
      return null;
    }

    return {
      wpCost: wpValue,
      provides,
      consumes,
    };
  } catch {
    return null;
  }
};

const formatLimitLabel = (key: string): string => {
  return key
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const aggregatePersonalReality = (
  items: InventoryItemRecord[]
): { wpTotal: number; limits: WarehousePersonalRealityLimitCounter[] } => {
  let wpTotal = 0;
  const limitMap = new Map<string, WarehousePersonalRealityLimitCounter>();

  const ensureEntry = (key: string): WarehousePersonalRealityLimitCounter => {
    const normalizedKey = key.trim().toLowerCase();
    const existing = limitMap.get(normalizedKey);
    if (existing) {
      return existing;
    }
    const entry: WarehousePersonalRealityLimitCounter = {
      key: normalizedKey,
      label: formatLimitLabel(key),
      provided: 0,
      used: 0,
      baseProvided: 0,
    };
    limitMap.set(normalizedKey, entry);
    return entry;
  };

  items.forEach((item) => {
    const contribution = parsePersonalRealityContribution(item.metadata ?? null);
    if (!contribution) {
      return;
    }
    const quantityRaw = typeof item.quantity === "number" ? item.quantity : 1;
    const normalizedQuantity = Number.isFinite(quantityRaw) ? (quantityRaw as number) : 1;
    const multiplier = normalizedQuantity > 0 ? normalizedQuantity : 0;
    if (contribution.wpCost && multiplier > 0) {
      wpTotal += contribution.wpCost * multiplier;
    }

    Object.entries(contribution.provides).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value === 0 || multiplier === 0) {
        return;
      }
      const entry = ensureEntry(key);
      entry.provided += value * multiplier;
    });

    Object.entries(contribution.consumes).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value === 0 || multiplier === 0) {
        return;
      }
      const entry = ensureEntry(key);
      entry.used += value * multiplier;
    });
  });

  const limits = Array.from(limitMap.values())
    .filter((entry) => entry.provided !== 0 || entry.used !== 0)
    .map((entry) => {
      const sanitizedProvided = Number.isFinite(entry.provided) ? entry.provided : 0;
      const sanitizedUsed = Number.isFinite(entry.used) ? entry.used : 0;
      return {
        ...entry,
        provided: sanitizedProvided,
        used: sanitizedUsed,
        baseProvided: sanitizedProvided,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  return { wpTotal, limits };
};

interface WarehousePersonalRealitySettingsParseResult {
  wpCap: number | null | undefined;
  hasWpCapOverride: boolean;
  limits: Record<string, number | null>;
}

const parseWarehousePersonalRealitySettings = (
  raw: string | null
): WarehousePersonalRealitySettingsParseResult => {
  const result: WarehousePersonalRealitySettingsParseResult = {
    wpCap: undefined,
    hasWpCapOverride: false,
    limits: {},
  };

  if (!raw) {
    return result;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return result;
    }

    if (Object.prototype.hasOwnProperty.call(parsed, "wpCap")) {
      const value = (parsed as Record<string, unknown>).wpCap;
      if (value === null) {
        result.hasWpCapOverride = true;
        result.wpCap = null;
      } else {
        const numeric = toFiniteNumber(value);
        if (numeric !== null) {
          result.hasWpCapOverride = true;
          result.wpCap = numeric;
        }
      }
    }

    const limitsRaw = (parsed as Record<string, unknown>).limits;
    if (limitsRaw && typeof limitsRaw === "object") {
      Object.entries(limitsRaw as Record<string, unknown>).forEach(([key, value]) => {
        const normalizedKey = key.trim().toLowerCase();
        if (!normalizedKey.length) {
          return;
        }
        if (value === null) {
          result.limits[normalizedKey] = null;
          return;
        }
        const numeric = toFiniteNumber(value);
        if (numeric !== null) {
          result.limits[normalizedKey] = numeric;
        }
      });
    }
  } catch {
    return result;
  }

  return result;
};

export async function loadWarehousePersonalRealitySummary(): Promise<WarehousePersonalRealitySummary> {
  return withInit(async (db) => {
    const [itemRows, universalRows, metadataRows] = await Promise.all([
      db.select<InventoryItemRecord[]>(
        `SELECT * FROM inventory_items WHERE scope = $1 ORDER BY sort_order ASC, created_at ASC`,
        ["warehouse"]
      ),
      db.select<UniversalDrawbackSettingsRow[]>(
        `SELECT * FROM universal_drawback_settings WHERE id = $1`,
        [UNIVERSAL_DRAWBACK_SETTING_ID]
      ),
      db.select<AppSettingRecord[]>(
        `SELECT * FROM app_settings WHERE key = $1`,
        [WAREHOUSE_PERSONAL_REALITY_SETTING_KEY]
      ),
    ]);

    const { wpTotal, limits: baseLimits } = aggregatePersonalReality(itemRows as InventoryItemRecord[]);
    const universalSettings = mapUniversalSettings(universalRows[0]);
    const overrides = parseWarehousePersonalRealitySettings(
      (metadataRows as AppSettingRecord[])[0]?.value ?? null
    );

    const cap = Number.isFinite(universalSettings.warehouseWP)
      ? (universalSettings.warehouseWP as number)
      : DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS.warehouseWP;
    const baseCap = Number.isFinite(cap) ? (cap as number) : null;

    let effectiveCap = baseCap;
    let wpOverride: number | null | undefined = undefined;
    if (overrides.hasWpCapOverride) {
      wpOverride = overrides.wpCap ?? null;
      effectiveCap = overrides.wpCap ?? null;
    }

    const limitMap = new Map<string, WarehousePersonalRealityLimitCounter>();
    baseLimits.forEach((limit) => {
      const overrideApplied = Object.prototype.hasOwnProperty.call(overrides.limits, limit.key);
      const overrideValue = overrides.limits[limit.key];
      const entry: WarehousePersonalRealityLimitCounter = {
        ...limit,
        override: undefined,
        provided: limit.provided,
        baseProvided: limit.baseProvided,
      };
      if (overrideApplied) {
        entry.override = overrideValue ?? null;
        entry.provided = overrideValue ?? 0;
      }
      limitMap.set(limit.key, entry);
    });

    Object.entries(overrides.limits).forEach(([key, value]) => {
      const normalizedKey = key.trim().toLowerCase();
      if (!normalizedKey.length) {
        return;
      }
      if (limitMap.has(normalizedKey)) {
        return;
      }
      limitMap.set(normalizedKey, {
        key: normalizedKey,
        label: formatLimitLabel(normalizedKey),
        provided: value ?? 0,
        used: 0,
        baseProvided: 0,
        override: value ?? null,
      });
    });

    const limits = Array.from(limitMap.values())
      .map((entry) => ({
        ...entry,
        provided: Number.isFinite(entry.provided) ? entry.provided : 0,
        used: Number.isFinite(entry.used) ? entry.used : 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

    return {
      wpTotal,
      wpCap: effectiveCap,
      wpBaseCap: baseCap,
      wpOverride,
      limits,
    };
  });
}

interface UpdateWarehousePersonalRealityPayload {
  wpCap?: number | null | undefined;
  limitQuotas?: Record<string, number | null | undefined>;
}

export async function updateWarehousePersonalRealitySummary(
  payload: UpdateWarehousePersonalRealityPayload
): Promise<void> {
  await withInit(async (db) => {
    const rows = await db.select<AppSettingRecord[]>(
      `SELECT * FROM app_settings WHERE key = $1`,
      [WAREHOUSE_PERSONAL_REALITY_SETTING_KEY]
    );
    const existingValue = rows[0]?.value ?? null;
    const parsed = parseWarehousePersonalRealitySettings(existingValue);

    let nextWpCap: number | null | undefined = parsed.hasWpCapOverride
      ? parsed.wpCap ?? null
      : undefined;
    if (Object.prototype.hasOwnProperty.call(payload, "wpCap")) {
      const value = payload.wpCap;
      if (value === undefined) {
        nextWpCap = undefined;
      } else if (value === null) {
        nextWpCap = null;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        nextWpCap = value;
      }
    }

    const nextLimits: Record<string, number | null> = { ...parsed.limits };
    if (payload.limitQuotas) {
      Object.entries(payload.limitQuotas).forEach(([key, value]) => {
        const normalized = key.trim().toLowerCase();
        if (!normalized.length) {
          return;
        }
        if (value === undefined) {
          delete nextLimits[normalized];
          return;
        }
        if (value === null) {
          nextLimits[normalized] = null;
          return;
        }
        if (typeof value === "number" && Number.isFinite(value)) {
          nextLimits[normalized] = value;
        }
      });
    }

    const settings: Record<string, unknown> = {};
    if (nextWpCap !== undefined) {
      settings.wpCap = nextWpCap;
    }
    if (Object.keys(nextLimits).length > 0) {
      settings.limits = nextLimits;
    }

    if (Object.keys(settings).length === 0) {
      await db.execute(`DELETE FROM app_settings WHERE key = $1`, [WAREHOUSE_PERSONAL_REALITY_SETTING_KEY]);
      return;
    }

    await db.execute(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [WAREHOUSE_PERSONAL_REALITY_SETTING_KEY, JSON.stringify(settings)]
    );
  });
}

export async function listAppSettings(): Promise<AppSettingRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<AppSettingRecord[]>(
      `SELECT * FROM app_settings ORDER BY key COLLATE NOCASE`
    );
    return rows as AppSettingRecord[];
  });
}

export async function listCharacterProfiles(): Promise<CharacterProfileRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<CharacterProfileRecord[]>(
      `SELECT id, name, alias, species, homeland, biography, attributes_json, traits_json, alt_forms_json, notes, created_at, updated_at
       FROM character_profiles
       ORDER BY created_at ASC`
    );
    return rows as CharacterProfileRecord[];
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

const FORMATTER_REMOVE_ALL_KEY = "formatter.deleteAllLineBreaks";
const FORMATTER_LEAVE_DOUBLE_KEY = "formatter.leaveDoubleLineBreaks";
const FORMATTER_SEPARATOR_KEY = "formatter.thousandsSeparator";
const FORMATTER_SPELLCHECK_KEY = "formatter.spellcheckEnabled";

export const JUMP_DEFAULTS_SETTING_KEY = "options.jumpDefaults";
export const SUPPLEMENT_SETTING_KEY = "options.supplements";
export const WAREHOUSE_MODE_SETTING_KEY = "options.warehouseMode";
export const CATEGORY_PRESETS_SETTING_KEY = "options.categoryPresets";
export const EXPORT_PREFERENCES_SETTING_KEY = "options.exportPreferences";
export const APPEARANCE_SETTING_KEY = "options.appearance";
export const WAREHOUSE_PERSONAL_REALITY_SETTING_KEY = "warehouse.personalReality";
export const APPEARANCE_SETTINGS_KEY = "options.appearance";

export const DEFAULT_JUMP_DEFAULTS: JumpDefaultsSettings = {
  standardBudget: 1000,
  gauntletBudget: 1500,
  companionStipend: 0,
};

export const DEFAULT_SUPPLEMENT_SETTINGS: SupplementToggleSettings = {
  enableDrawbackSupplement: true,
  enableUniversalDrawbacks: false,
  enableEssentialBodyMod: true,
  allowCompanionBodyMod: true,
};

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: "andromeda",
  backgroundTheme: "starfield",
};

const APPEARANCE_THEME_VALUES: readonly AppearanceTheme[] = ["andromeda", "solstice"];
const APPEARANCE_BACKGROUND_VALUES: readonly AppearanceThemeOption[] = [
  "starfield",
  "nebula",
  "minimal",
];

export const ESSENTIAL_BODY_MOD_SETTING_ID = "essential-default";
export const UNIVERSAL_DRAWBACK_SETTING_ID = "universal-default";

export const DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS: EssentialBodyModSettings = {
  budget: 1000,
  startingMode: "standard",
  essenceMode: "none",
  advancementMode: "standard",
  epAccessMode: "none",
  epAccessModifier: "none",
  unlockableEssence: false,
  limitInvestment: false,
  investmentAllowed: false,
  investmentRatio: 1,
  incrementalBudget: 0,
  incrementalInterval: 1,
  trainingAllowance: false,
  temperedBySuffering: false,
  unbalancedMode: "none",
  unbalancedDescription: null,
  limiter: "none",
  limiterDescription: null,
};

export const DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS: UniversalDrawbackSettings = {
  totalCP: 0,
  companionCP: 0,
  itemCP: 0,
  warehouseWP: 0,
  allowGauntlet: false,
  gauntletHalved: false,
};

export const DEFAULT_WAREHOUSE_MODE: WarehouseModeSettings = {
  mode: "generic",
};

export const DEFAULT_CATEGORY_PRESETS: CategoryPresetSettings = {
  perkCategories: [],
  itemCategories: [],
};

export const DEFAULT_EXPORT_PREFERENCES: ExportPreferenceSettings = {
  defaultPresetId: null,
};

const DEFAULT_FORMATTER_SETTINGS: FormatterSettings = {
  removeAllLineBreaks: false,
  leaveDoubleLineBreaks: false,
  thousandsSeparator: "none",
  spellcheckEnabled: true,
};

function parseAppearanceTheme(value: unknown): AppearanceTheme {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase() as AppearanceTheme;
    if (APPEARANCE_THEME_VALUES.includes(normalized)) {
      return normalized;
    }
  }
  return DEFAULT_APPEARANCE_SETTINGS.theme;
}

function parseBackgroundTheme(value: unknown): AppearanceThemeOption {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase() as AppearanceThemeOption;
    if (APPEARANCE_BACKGROUND_VALUES.includes(normalized)) {
      return normalized;
    }
  }
  return DEFAULT_APPEARANCE_SETTINGS.backgroundTheme;
}

export function parseAppearanceSettings(record: AppSettingRecord | null): AppearanceSettings {
  if (!record || record.value === null) {
    return { ...DEFAULT_APPEARANCE_SETTINGS };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(record.value) as unknown;
  } catch (error) {
    console.warn("Failed to parse appearance settings", error);
  }

  if (parsed && typeof parsed === "object") {
    const data = parsed as Record<string, unknown>;
    return {
      theme: parseAppearanceTheme(data.theme),
      backgroundTheme: parseBackgroundTheme(data.backgroundTheme),
    } satisfies AppearanceSettings;
  }

  if (typeof parsed === "string") {
    const normalized = parsed.trim().toLowerCase();
    if (APPEARANCE_BACKGROUND_VALUES.includes(normalized as AppearanceThemeOption)) {
      return {
        theme: DEFAULT_APPEARANCE_SETTINGS.theme,
        backgroundTheme: normalized as AppearanceThemeOption,
      } satisfies AppearanceSettings;
    }
    if (APPEARANCE_THEME_VALUES.includes(normalized as AppearanceTheme)) {
      return {
        theme: normalized as AppearanceTheme,
        backgroundTheme: DEFAULT_APPEARANCE_SETTINGS.backgroundTheme,
      } satisfies AppearanceSettings;
    }
  }

  if (typeof record.value === "string") {
    const normalized = record.value.trim().toLowerCase();
    if (APPEARANCE_BACKGROUND_VALUES.includes(normalized as AppearanceThemeOption)) {
      return {
        theme: DEFAULT_APPEARANCE_SETTINGS.theme,
        backgroundTheme: normalized as AppearanceThemeOption,
      } satisfies AppearanceSettings;
    }
    if (APPEARANCE_THEME_VALUES.includes(normalized as AppearanceTheme)) {
      return {
        theme: normalized as AppearanceTheme,
        backgroundTheme: DEFAULT_APPEARANCE_SETTINGS.backgroundTheme,
      } satisfies AppearanceSettings;
    }
  }

  return { ...DEFAULT_APPEARANCE_SETTINGS };
}

export async function loadAppearanceSettings(): Promise<AppearanceSettings> {
  const record = await getAppSetting(APPEARANCE_SETTINGS_KEY);
  return parseAppearanceSettings(record);
}

export async function saveAppearanceSettings(settings: AppearanceSettings): Promise<AppearanceSettings> {
  const record = await setAppSetting(APPEARANCE_SETTINGS_KEY, settings);
  return parseAppearanceSettings(record);
}

function parseBooleanSetting(record: AppSettingRecord | null, fallback: boolean): boolean {
  if (!record || record.value === null) {
    return fallback;
  }

  const normalized = record.value.trim().toLowerCase();

  if (normalized === "true" || normalized === "false") {
    return normalized === "true";
  }

  if (normalized === "1" || normalized === "0") {
    return normalized === "1";
  }

  try {
    const parsed = JSON.parse(record.value);
    if (typeof parsed === "boolean") {
      return parsed;
    }
  } catch {
    // ignore parse errors
  }

  return fallback;
}

function parseSeparatorSetting(
  record: AppSettingRecord | null,
  fallback: ThousandsSeparatorOption
): ThousandsSeparatorOption {
  if (!record || record.value === null) {
    return fallback;
  }

  const normalized = record.value.trim().toLowerCase();
  const allowed: ThousandsSeparatorOption[] = ["none", "comma", "period", "space"];

  if (allowed.includes(normalized as ThousandsSeparatorOption)) {
    return normalized as ThousandsSeparatorOption;
  }

  return fallback;
}

function parseJsonValue(record: AppSettingRecord | null): unknown {
  if (!record?.value) {
    return null;
  }

  try {
    return JSON.parse(record.value);
  } catch {
    return null;
  }
}

function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return fallback;
}

function coerceStringArray(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry ?? "").trim()))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry ?? "").trim()))
          .filter((entry) => entry.length > 0);
      }
    } catch {
      return value
        .split(/[,;\n]+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }
  }

  return [];
}

export function parseJumpDefaults(record: AppSettingRecord | null): JumpDefaultsSettings {
  const raw = parseJsonValue(record);
  if (!raw || typeof raw !== "object") {
    return DEFAULT_JUMP_DEFAULTS;
  }

  const value = raw as Partial<JumpDefaultsSettings>;
  return {
    standardBudget: Math.max(0, coerceNumber(value.standardBudget, DEFAULT_JUMP_DEFAULTS.standardBudget)),
    gauntletBudget: Math.max(0, coerceNumber(value.gauntletBudget, DEFAULT_JUMP_DEFAULTS.gauntletBudget)),
    companionStipend: Math.max(0, coerceNumber(value.companionStipend, DEFAULT_JUMP_DEFAULTS.companionStipend)),
  };
}

export function parseSupplementSettings(record: AppSettingRecord | null): SupplementToggleSettings {
  const raw = parseJsonValue(record);
  if (!raw || typeof raw !== "object") {
    return DEFAULT_SUPPLEMENT_SETTINGS;
  }

  const value = raw as Partial<SupplementToggleSettings>;
  return {
    enableDrawbackSupplement: coerceBoolean(
      value.enableDrawbackSupplement,
      DEFAULT_SUPPLEMENT_SETTINGS.enableDrawbackSupplement
    ),
    enableUniversalDrawbacks: coerceBoolean(
      value.enableUniversalDrawbacks,
      DEFAULT_SUPPLEMENT_SETTINGS.enableUniversalDrawbacks
    ),
    enableEssentialBodyMod: coerceBoolean(
      value.enableEssentialBodyMod,
      DEFAULT_SUPPLEMENT_SETTINGS.enableEssentialBodyMod
    ),
    allowCompanionBodyMod: coerceBoolean(
      value.allowCompanionBodyMod,
      DEFAULT_SUPPLEMENT_SETTINGS.allowCompanionBodyMod
    ),
  };
}

const ESSENTIAL_STARTING_MODE_VALUES: readonly EssentialStartingMode[] = ["hardcore", "standard", "heroic"];
const ESSENTIAL_ESSENCE_MODE_VALUES: readonly EssentialEssenceMode[] = ["none", "single", "dual", "multi"];
const ESSENTIAL_ADVANCEMENT_MODE_VALUES: readonly EssentialAdvancementMode[] = [
  "standard",
  "meteoric",
  "heroic",
  "questing",
];
const ESSENTIAL_EP_ACCESS_MODE_VALUES: readonly EssentialEpAccessMode[] = ["none", "lesser", "standard"];
const ESSENTIAL_EP_ACCESS_MODIFIER_VALUES: readonly EssentialEpAccessModifier[] = [
  "none",
  "cumulative",
  "retro-cumulative",
];
const ESSENTIAL_UNBALANCED_MODE_VALUES: readonly EssentialUnbalancedMode[] = [
  "none",
  "harmonized",
  "very-harmonized",
  "perfectly-harmonized",
];
const ESSENTIAL_LIMITER_VALUES: readonly EssentialLimiter[] = [
  "none",
  "everyday-hero",
  "street-level",
  "mid-level",
  "body-mod",
  "scaling-i",
  "scaling-ii",
  "vanishing",
];

interface EssentialBodyModSettingsRow {
  id: string;
  budget: number | null;
  starting_mode: string | null;
  essence_mode: string | null;
  advancement_mode: string | null;
  ep_access_mode: string | null;
  ep_access_modifier: string | null;
  unlockable_essence: number | null;
  limit_investment: number | null;
  investment_allowed: number | null;
  investment_ratio: number | null;
  incremental_budget: number | null;
  incremental_interval: number | null;
  training_allowance: number | null;
  tempered_by_suffering: number | null;
  unbalanced_mode: string | null;
  unbalanced_description: string | null;
  limiter: string | null;
  limiter_description: string | null;
  created_at: string;
  updated_at: string;
}

interface UniversalDrawbackSettingsRow {
  id: string;
  total_cp: number | null;
  companion_cp: number | null;
  item_cp: number | null;
  warehouse_wp: number | null;
  allow_gauntlet: number | null;
  gauntlet_halved: number | null;
  created_at: string;
  updated_at: string;
}

function normalizeEnumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase() as T;
    if (allowed.includes(normalized)) {
      return normalized;
    }
  }
  return fallback;
}

function normalizeNonNegative(value: unknown, fallback: number, minimum = 0): number {
  const coerced = coerceNumber(value, fallback);
  if (!Number.isFinite(coerced)) {
    return fallback;
  }
  return Math.max(minimum, Math.round(coerced));
}

function normalizeOptionalTextInput(value: unknown, fallback: string | null): string | null {
  if (value === undefined) {
    return fallback;
  }
  if (value === null) {
    return null;
  }
  return toNullableText(String(value));
}

function mapEssentialSettings(row: EssentialBodyModSettingsRow | undefined): EssentialBodyModSettings {
  if (!row) {
    return DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS;
  }
  return {
    budget: normalizeNonNegative(row.budget, DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.budget),
    startingMode: normalizeEnumValue(
      row.starting_mode,
      ESSENTIAL_STARTING_MODE_VALUES,
      DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.startingMode
    ),
    essenceMode: normalizeEnumValue(
      row.essence_mode,
      ESSENTIAL_ESSENCE_MODE_VALUES,
      DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.essenceMode
    ),
    advancementMode: normalizeEnumValue(
      row.advancement_mode,
      ESSENTIAL_ADVANCEMENT_MODE_VALUES,
      DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.advancementMode
    ),
    epAccessMode: normalizeEnumValue(
      row.ep_access_mode,
      ESSENTIAL_EP_ACCESS_MODE_VALUES,
      DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.epAccessMode
    ),
    epAccessModifier: normalizeEnumValue(
      row.ep_access_modifier,
      ESSENTIAL_EP_ACCESS_MODIFIER_VALUES,
      DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.epAccessModifier
    ),
    unlockableEssence: coerceBoolean(row.unlockable_essence, DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.unlockableEssence),
    limitInvestment: coerceBoolean(row.limit_investment, DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.limitInvestment),
    investmentAllowed: coerceBoolean(row.investment_allowed, DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.investmentAllowed),
    investmentRatio: normalizeNonNegative(
      row.investment_ratio,
      DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.investmentRatio,
      1
    ),
    incrementalBudget: normalizeNonNegative(
      row.incremental_budget,
      DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.incrementalBudget
    ),
    incrementalInterval: normalizeNonNegative(
      row.incremental_interval,
      DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.incrementalInterval,
      1
    ),
    trainingAllowance: coerceBoolean(row.training_allowance, DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.trainingAllowance),
    temperedBySuffering: coerceBoolean(
      row.tempered_by_suffering,
      DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.temperedBySuffering
    ),
    unbalancedMode: normalizeEnumValue(
      row.unbalanced_mode,
      ESSENTIAL_UNBALANCED_MODE_VALUES,
      DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.unbalancedMode
    ),
    unbalancedDescription: toNullableText(row.unbalanced_description ?? null),
    limiter: normalizeEnumValue(row.limiter, ESSENTIAL_LIMITER_VALUES, DEFAULT_ESSENTIAL_BODY_MOD_SETTINGS.limiter),
    limiterDescription: toNullableText(row.limiter_description ?? null),
  };
}

function mapUniversalSettings(row: UniversalDrawbackSettingsRow | undefined): UniversalDrawbackSettings {
  if (!row) {
    return DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS;
  }
  return {
    totalCP: normalizeNonNegative(row.total_cp, DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS.totalCP),
    companionCP: normalizeNonNegative(row.companion_cp, DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS.companionCP),
    itemCP: normalizeNonNegative(row.item_cp, DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS.itemCP),
    warehouseWP: normalizeNonNegative(row.warehouse_wp, DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS.warehouseWP),
    allowGauntlet: coerceBoolean(row.allow_gauntlet, DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS.allowGauntlet),
    gauntletHalved: coerceBoolean(row.gauntlet_halved, DEFAULT_UNIVERSAL_DRAWBACK_SETTINGS.gauntletHalved),
  };
}

export function parseWarehouseMode(record: AppSettingRecord | null): WarehouseModeSettings {
  const raw = parseJsonValue(record);
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "personal-reality") {
      return { mode: "personal-reality" };
    }
    if (normalized === "generic") {
      return { mode: "generic" };
    }
  }

  if (raw && typeof raw === "object" && "mode" in raw) {
    const modeValue = String((raw as { mode?: unknown }).mode ?? "generic").trim().toLowerCase();
    if (modeValue === "personal-reality") {
      return { mode: "personal-reality" };
    }
  }

  return DEFAULT_WAREHOUSE_MODE;
}

export function parseCategoryPresets(record: AppSettingRecord | null): CategoryPresetSettings {
  const raw = parseJsonValue(record);
  if (!raw || typeof raw !== "object") {
    return DEFAULT_CATEGORY_PRESETS;
  }

  const value = raw as Partial<CategoryPresetSettings>;
  const perkCategories = coerceStringArray(value.perkCategories);
  const itemCategories = coerceStringArray(value.itemCategories);

  const unique = (entries: string[]) => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const entry of entries) {
      const trimmed = entry.trim();
      if (!trimmed.length) {
        continue;
      }
      const normalized = trimmed.toLowerCase();
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      ordered.push(trimmed);
    }
    return ordered;
  };

  return {
    perkCategories: unique(perkCategories),
    itemCategories: unique(itemCategories),
  };
}

export function parseExportPreferences(record: AppSettingRecord | null): ExportPreferenceSettings {
  const raw = parseJsonValue(record);
  if (!raw || typeof raw !== "object") {
    return DEFAULT_EXPORT_PREFERENCES;
  }

  const value = raw as Partial<ExportPreferenceSettings> & { defaultPresetId?: unknown };
  const defaultPresetId = typeof value.defaultPresetId === "string" ? value.defaultPresetId : null;
  return {
    defaultPresetId,
  };
}

export async function loadJumpDefaults(): Promise<JumpDefaultsSettings> {
  const record = await getAppSetting(JUMP_DEFAULTS_SETTING_KEY);
  return parseJumpDefaults(record);
}

export async function loadSupplementSettings(): Promise<SupplementToggleSettings> {
  const record = await getAppSetting(SUPPLEMENT_SETTING_KEY);
  return parseSupplementSettings(record);
}

export async function loadEssentialBodyModSettings(): Promise<EssentialBodyModSettings> {
  return withInit(async (db) => {
    const rows = await db.select<EssentialBodyModSettingsRow[]>(
      `SELECT * FROM essential_body_mod_settings WHERE id = $1`,
      [ESSENTIAL_BODY_MOD_SETTING_ID]
    );
    return mapEssentialSettings(rows[0]);
  });
}

export async function saveEssentialBodyModSettings(
  overrides: Partial<EssentialBodyModSettings>
): Promise<EssentialBodyModSettings> {
  return withInit(async (db) => {
    const existingRows = await db.select<EssentialBodyModSettingsRow[]>(
      `SELECT * FROM essential_body_mod_settings WHERE id = $1`,
      [ESSENTIAL_BODY_MOD_SETTING_ID]
    );
    const current = mapEssentialSettings(existingRows[0]);
    const next: EssentialBodyModSettings = {
      budget:
        overrides.budget !== undefined
          ? normalizeNonNegative(overrides.budget, current.budget)
          : current.budget,
      startingMode:
        overrides.startingMode !== undefined
          ? normalizeEnumValue(overrides.startingMode, ESSENTIAL_STARTING_MODE_VALUES, current.startingMode)
          : current.startingMode,
      essenceMode:
        overrides.essenceMode !== undefined
          ? normalizeEnumValue(overrides.essenceMode, ESSENTIAL_ESSENCE_MODE_VALUES, current.essenceMode)
          : current.essenceMode,
      advancementMode:
        overrides.advancementMode !== undefined
          ? normalizeEnumValue(overrides.advancementMode, ESSENTIAL_ADVANCEMENT_MODE_VALUES, current.advancementMode)
          : current.advancementMode,
      epAccessMode:
        overrides.epAccessMode !== undefined
          ? normalizeEnumValue(overrides.epAccessMode, ESSENTIAL_EP_ACCESS_MODE_VALUES, current.epAccessMode)
          : current.epAccessMode,
      epAccessModifier:
        overrides.epAccessModifier !== undefined
          ? normalizeEnumValue(
              overrides.epAccessModifier,
              ESSENTIAL_EP_ACCESS_MODIFIER_VALUES,
              current.epAccessModifier
            )
          : current.epAccessModifier,
      unlockableEssence:
        overrides.unlockableEssence !== undefined ? overrides.unlockableEssence : current.unlockableEssence,
      limitInvestment:
        overrides.limitInvestment !== undefined ? overrides.limitInvestment : current.limitInvestment,
      investmentAllowed:
        overrides.investmentAllowed !== undefined ? overrides.investmentAllowed : current.investmentAllowed,
      investmentRatio:
        overrides.investmentRatio !== undefined
          ? normalizeNonNegative(overrides.investmentRatio, current.investmentRatio, 1)
          : current.investmentRatio,
      incrementalBudget:
        overrides.incrementalBudget !== undefined
          ? normalizeNonNegative(overrides.incrementalBudget, current.incrementalBudget)
          : current.incrementalBudget,
      incrementalInterval:
        overrides.incrementalInterval !== undefined
          ? normalizeNonNegative(overrides.incrementalInterval, current.incrementalInterval, 1)
          : current.incrementalInterval,
      trainingAllowance:
        overrides.trainingAllowance !== undefined ? overrides.trainingAllowance : current.trainingAllowance,
      temperedBySuffering:
        overrides.temperedBySuffering !== undefined ? overrides.temperedBySuffering : current.temperedBySuffering,
      unbalancedMode:
        overrides.unbalancedMode !== undefined
          ? normalizeEnumValue(overrides.unbalancedMode, ESSENTIAL_UNBALANCED_MODE_VALUES, current.unbalancedMode)
          : current.unbalancedMode,
      unbalancedDescription: normalizeOptionalTextInput(overrides.unbalancedDescription, current.unbalancedDescription),
      limiter:
        overrides.limiter !== undefined
          ? normalizeEnumValue(overrides.limiter, ESSENTIAL_LIMITER_VALUES, current.limiter)
          : current.limiter,
      limiterDescription: normalizeOptionalTextInput(overrides.limiterDescription, current.limiterDescription),
    };

    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO essential_body_mod_settings (
         id,
         budget,
         starting_mode,
         essence_mode,
         advancement_mode,
         ep_access_mode,
         ep_access_modifier,
         unlockable_essence,
         limit_investment,
         investment_allowed,
         investment_ratio,
         incremental_budget,
         incremental_interval,
         training_allowance,
         tempered_by_suffering,
         unbalanced_mode,
         unbalanced_description,
         limiter,
         limiter_description,
         created_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20
       )
       ON CONFLICT(id) DO UPDATE SET
         budget = excluded.budget,
         starting_mode = excluded.starting_mode,
         essence_mode = excluded.essence_mode,
         advancement_mode = excluded.advancement_mode,
         ep_access_mode = excluded.ep_access_mode,
         ep_access_modifier = excluded.ep_access_modifier,
         unlockable_essence = excluded.unlockable_essence,
         limit_investment = excluded.limit_investment,
         investment_allowed = excluded.investment_allowed,
         investment_ratio = excluded.investment_ratio,
         incremental_budget = excluded.incremental_budget,
         incremental_interval = excluded.incremental_interval,
         training_allowance = excluded.training_allowance,
         tempered_by_suffering = excluded.tempered_by_suffering,
         unbalanced_mode = excluded.unbalanced_mode,
         unbalanced_description = excluded.unbalanced_description,
         limiter = excluded.limiter,
         limiter_description = excluded.limiter_description,
         updated_at = excluded.updated_at`,
      [
        ESSENTIAL_BODY_MOD_SETTING_ID,
        next.budget,
        next.startingMode,
        next.essenceMode,
        next.advancementMode,
        next.epAccessMode,
        next.epAccessModifier,
        boolToInt(next.unlockableEssence),
        boolToInt(next.limitInvestment),
        boolToInt(next.investmentAllowed),
        next.investmentRatio,
        next.incrementalBudget,
        next.incrementalInterval,
        boolToInt(next.trainingAllowance),
        boolToInt(next.temperedBySuffering),
        next.unbalancedMode,
        toNullableText(next.unbalancedDescription ?? null),
        next.limiter,
        toNullableText(next.limiterDescription ?? null),
        now,
      ]
    );

    const rows = await db.select<EssentialBodyModSettingsRow[]>(
      `SELECT * FROM essential_body_mod_settings WHERE id = $1`,
      [ESSENTIAL_BODY_MOD_SETTING_ID]
    );
    return mapEssentialSettings(rows[0]);
  });
}

export async function listEssentialBodyModEssences(): Promise<EssentialBodyModEssenceRecord[]> {
  return withInit(async (db) => {
    const rows = await db.select<EssentialBodyModEssenceRecord[]>(
      `SELECT * FROM essential_body_mod_essences
       WHERE setting_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [ESSENTIAL_BODY_MOD_SETTING_ID]
    );
    return rows as EssentialBodyModEssenceRecord[];
  });
}

export async function upsertEssentialBodyModEssence(
  input: UpsertEssentialBodyModEssenceInput
): Promise<EssentialBodyModEssenceRecord> {
  return withInit(async (db) => {
    const id = input.id ?? uuid();
    let sortOrder = input.sort_order;
    if (typeof sortOrder !== "number" || Number.isNaN(sortOrder)) {
      const [row] = (await db.select<{ max_order: number }[]>(
        `SELECT COALESCE(MAX(sort_order), -1) AS max_order
         FROM essential_body_mod_essences
         WHERE setting_id = $1`,
        [ESSENTIAL_BODY_MOD_SETTING_ID]
      )) as { max_order: number }[];
      sortOrder = (row?.max_order ?? -1) + 1;
    }

    const trimmedName = input.name.trim();
    if (!trimmedName.length) {
      throw new Error("Essence name is required");
    }

    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO essential_body_mod_essences (
         id,
         setting_id,
         name,
         description,
         sort_order,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
      [
        id,
        ESSENTIAL_BODY_MOD_SETTING_ID,
        trimmedName,
        toNullableText(input.description ?? null),
        sortOrder,
        now,
      ]
    );

    const rows = await db.select<EssentialBodyModEssenceRecord[]>(
      `SELECT * FROM essential_body_mod_essences WHERE id = $1`,
      [id]
    );
    return rows[0];
  });
}

export async function deleteEssentialBodyModEssence(id: string): Promise<void> {
  await withInit((db) =>
    db.execute(`DELETE FROM essential_body_mod_essences WHERE id = $1`, [id])
  );
}

export async function loadUniversalDrawbackSettings(): Promise<UniversalDrawbackSettings> {
  return withInit(async (db) => {
    const rows = await db.select<UniversalDrawbackSettingsRow[]>(
      `SELECT * FROM universal_drawback_settings WHERE id = $1`,
      [UNIVERSAL_DRAWBACK_SETTING_ID]
    );
    return mapUniversalSettings(rows[0]);
  });
}

export async function saveUniversalDrawbackSettings(
  overrides: Partial<UniversalDrawbackSettings>
): Promise<UniversalDrawbackSettings> {
  return withInit(async (db) => {
    const rows = await db.select<UniversalDrawbackSettingsRow[]>(
      `SELECT * FROM universal_drawback_settings WHERE id = $1`,
      [UNIVERSAL_DRAWBACK_SETTING_ID]
    );
    const current = mapUniversalSettings(rows[0]);
    const next: UniversalDrawbackSettings = {
      totalCP:
        overrides.totalCP !== undefined
          ? normalizeNonNegative(overrides.totalCP, current.totalCP)
          : current.totalCP,
      companionCP:
        overrides.companionCP !== undefined
          ? normalizeNonNegative(overrides.companionCP, current.companionCP)
          : current.companionCP,
      itemCP:
        overrides.itemCP !== undefined
          ? normalizeNonNegative(overrides.itemCP, current.itemCP)
          : current.itemCP,
      warehouseWP:
        overrides.warehouseWP !== undefined
          ? normalizeNonNegative(overrides.warehouseWP, current.warehouseWP)
          : current.warehouseWP,
      allowGauntlet:
        overrides.allowGauntlet !== undefined ? overrides.allowGauntlet : current.allowGauntlet,
      gauntletHalved:
        overrides.gauntletHalved !== undefined ? overrides.gauntletHalved : current.gauntletHalved,
    };

    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO universal_drawback_settings (
         id,
         total_cp,
         companion_cp,
         item_cp,
         warehouse_wp,
         allow_gauntlet,
         gauntlet_halved,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       ON CONFLICT(id) DO UPDATE SET
         total_cp = excluded.total_cp,
         companion_cp = excluded.companion_cp,
         item_cp = excluded.item_cp,
         warehouse_wp = excluded.warehouse_wp,
         allow_gauntlet = excluded.allow_gauntlet,
         gauntlet_halved = excluded.gauntlet_halved,
         updated_at = excluded.updated_at`,
      [
        UNIVERSAL_DRAWBACK_SETTING_ID,
        next.totalCP,
        next.companionCP,
        next.itemCP,
        next.warehouseWP,
        boolToInt(next.allowGauntlet),
        boolToInt(next.gauntletHalved),
        now,
      ]
    );

    const updatedRows = await db.select<UniversalDrawbackSettingsRow[]>(
      `SELECT * FROM universal_drawback_settings WHERE id = $1`,
      [UNIVERSAL_DRAWBACK_SETTING_ID]
    );
    return mapUniversalSettings(updatedRows[0]);
  });
}

export async function loadWarehouseModeSetting(): Promise<WarehouseModeSettings> {
  const record = await getAppSetting(WAREHOUSE_MODE_SETTING_KEY);
  return parseWarehouseMode(record);
}

export async function loadCategoryPresets(): Promise<CategoryPresetSettings> {
  const record = await getAppSetting(CATEGORY_PRESETS_SETTING_KEY);
  return parseCategoryPresets(record);
}

export async function loadExportPreferences(): Promise<ExportPreferenceSettings> {
  const record = await getAppSetting(EXPORT_PREFERENCES_SETTING_KEY);
  return parseExportPreferences(record);
}

export async function loadFormatterSettings(): Promise<FormatterSettings> {
  const [removeAllRecord, leaveDoubleRecord, separatorRecord, spellcheckRecord] = await Promise.all([
    getAppSetting(FORMATTER_REMOVE_ALL_KEY),
    getAppSetting(FORMATTER_LEAVE_DOUBLE_KEY),
    getAppSetting(FORMATTER_SEPARATOR_KEY),
    getAppSetting(FORMATTER_SPELLCHECK_KEY),
  ]);

  return {
    removeAllLineBreaks: parseBooleanSetting(removeAllRecord, DEFAULT_FORMATTER_SETTINGS.removeAllLineBreaks),
    leaveDoubleLineBreaks: parseBooleanSetting(leaveDoubleRecord, DEFAULT_FORMATTER_SETTINGS.leaveDoubleLineBreaks),
    thousandsSeparator: parseSeparatorSetting(
      separatorRecord,
      DEFAULT_FORMATTER_SETTINGS.thousandsSeparator
    ),
    spellcheckEnabled: parseBooleanSetting(spellcheckRecord, DEFAULT_FORMATTER_SETTINGS.spellcheckEnabled),
  };
}

export async function updateFormatterSettings(
  overrides: Partial<FormatterSettings>
): Promise<FormatterSettings> {
  const current = await loadFormatterSettings();
  const next: FormatterSettings = {
    ...current,
    ...overrides,
  };

  await Promise.all([
    setAppSetting(FORMATTER_REMOVE_ALL_KEY, next.removeAllLineBreaks),
    setAppSetting(FORMATTER_LEAVE_DOUBLE_KEY, next.leaveDoubleLineBreaks),
    setAppSetting(FORMATTER_SEPARATOR_KEY, next.thousandsSeparator),
    setAppSetting(FORMATTER_SPELLCHECK_KEY, next.spellcheckEnabled),
  ]);

  return next;
}

export async function saveFormatterSpellcheck(spellcheckEnabled: boolean): Promise<FormatterSettings> {
  return updateFormatterSettings({ spellcheckEnabled });
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

export async function loadPassportDerivedSnapshot(): Promise<PassportDerivedSnapshot> {
  return withInit(async (db) => {
    const rows = await db.select<JumpAssetWithJump[]>(
      `SELECT a.*, j.title AS jump_title
         FROM jump_assets a
         LEFT JOIN jumps j ON j.id = a.jump_id
         ORDER BY j.sort_order ASC, a.asset_type ASC, a.sort_order ASC, a.created_at ASC`
    );

    const perks: PassportDerivedAsset[] = [];
    const companions: PassportDerivedAsset[] = [];
    const traitMap = new Map<string, PassportDerivedTrait>();
    const altFormMap = new Map<string, PassportDerivedAltForm>();
    const attributeMap = new Map<string, PassportDerivedAttribute>();
    const stipends: PassportDerivedSnapshot["stipends"] = [];
    let stipendTotal = 0;

    for (const row of rows) {
      const metadata = parseAssetMetadata(row.metadata);
      const source: PassportDerivedSource = {
        assetId: row.id,
        assetName: row.name,
        assetType: row.asset_type,
        jumpId: row.jump_id,
        jumpTitle: row.jump_title ?? null,
      };

      const derivedAsset: PassportDerivedAsset = {
        id: row.id,
        jumpId: row.jump_id,
        jumpTitle: row.jump_title ?? null,
        assetType: row.asset_type,
        name: row.name,
        category: row.category ?? null,
        subcategory: row.subcategory ?? null,
        notes: row.notes ?? null,
        traitTags: metadata.traitTags,
        attributes: metadata.attributes,
        altForms: metadata.altForms,
        stipend: metadata.stipend,
      };

      if (row.asset_type === "perk") {
        perks.push(derivedAsset);
      } else if (row.asset_type === "companion") {
        companions.push(derivedAsset);
      }

      for (const trait of metadata.traitTags) {
        const key = trait.toLowerCase();
        const existing = traitMap.get(key);
        if (existing) {
          existing.sources.push(source);
        } else {
          traitMap.set(key, { name: trait, sources: [source] });
        }
      }

      for (const altForm of metadata.altForms) {
        const summary = altForm.summary ?? "";
        const key = `${altForm.name.toLowerCase()}::${summary.toLowerCase()}`;
        const existing = altFormMap.get(key);
        if (existing) {
          existing.sources.push(source);
        } else {
          altFormMap.set(key, {
            name: altForm.name,
            summary,
            sources: [source],
          });
        }
      }

      for (const attribute of metadata.attributes) {
        const normalizedKey = attribute.key.toLowerCase();
        const entry: PassportDerivedAttributeEntry = {
          ...source,
          value: attribute.value,
          numericValue: attribute.numericValue ?? null,
        };
        const existing = attributeMap.get(normalizedKey);
        if (existing) {
          existing.entries.push(entry);
          if (entry.numericValue !== null && Number.isFinite(entry.numericValue)) {
            existing.total += entry.numericValue;
            existing.numericCount += 1;
          }
        } else {
          const numeric = entry.numericValue;
          const hasNumeric = numeric !== null && Number.isFinite(numeric);
          attributeMap.set(normalizedKey, {
            key: attribute.key,
            total: hasNumeric ? (numeric as number) : 0,
            numericCount: hasNumeric ? 1 : 0,
            entries: [entry],
          });
        }
      }

      if (metadata.stipend) {
        stipendTotal += metadata.stipend.total;
        stipends.push({
          ...source,
          amount: metadata.stipend.total,
          frequency: metadata.stipend.frequency,
          notes: metadata.stipend.notes,
        });
      }
    }

    const traits = Array.from(traitMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    const altForms = Array.from(altFormMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    const attributes = Array.from(attributeMap.values()).sort((a, b) =>
      a.key.localeCompare(b.key, undefined, { sensitivity: "base" })
    );

    return {
      perks,
      companions,
      traits,
      altForms,
      attributes,
      stipendTotal,
      stipends: stipends.sort((a, b) => a.assetName.localeCompare(b.assetName, undefined, { sensitivity: "base" })),
    };
  });
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

interface JumpCpRow {
  jump_id: string;
  title: string;
  status: string | null;
  cp_budget: number | null;
  spent: number | null;
  earned: number | null;
}

interface AssetTypeAggregateRow {
  asset_type: JumpAssetType;
  item_count: number | null;
  gross_cost: number | null;
  net_cost: number | null;
  credit: number | null;
  discounted_count: number | null;
  freebie_count: number | null;
}

interface InventoryCategoryAggregateRow {
  category: string | null;
  item_count: number | null;
  total_quantity: number | null;
  warehouse_count: number | null;
  locker_count: number | null;
}

interface GauntletAggregateRow {
  jump_id: string;
  title: string;
  status: string | null;
  cp_budget: number | null;
  spent: number | null;
  earned: number | null;
}

interface BoosterSourceRow {
  id: string;
  name: string;
  attributes_json: string | null;
  traits_json: string | null;
}

export interface CpSpendEarnRow {
  jumpId: string;
  title: string;
  status: string | null;
  budget: number;
  spent: number;
  earned: number;
  net: number;
}

export interface CpAssetTypeBreakdown {
  assetType: JumpAssetType;
  itemCount: number;
  gross: number;
  netCost: number;
  credit: number;
  discounted: number;
  freebies: number;
}

export interface CpSpendEarnSummary {
  totals: {
    budget: number;
    spent: number;
    earned: number;
    net: number;
  };
  byJump: CpSpendEarnRow[];
  byAssetType: CpAssetTypeBreakdown[];
}

export interface InventoryCategorySummary {
  category: string;
  itemCount: number;
  totalQuantity: number;
  warehouseCount: number;
  lockerCount: number;
}

export interface GauntletProgressRow {
  jumpId: string;
  title: string;
  status: string | null;
  budget: number;
  spent: number;
  earned: number;
  progress: number;
}

export interface GauntletProgressSummary {
  allowGauntlet: boolean;
  gauntletHalved: boolean;
  totalGauntlets: number;
  completedGauntlets: number;
  rows: GauntletProgressRow[];
}

export interface BoosterUsageEntry {
  booster: string;
  count: number;
  characters: Array<{ id: string; name: string }>;
}

export interface BoosterUsageSummary {
  totalCharacters: number;
  charactersWithBoosters: number;
  totalBoosters: number;
  uniqueBoosters: number;
  entries: BoosterUsageEntry[];
}

export interface StatisticsSnapshot {
  cp: CpSpendEarnSummary;
  inventory: {
    totalItems: number;
    totalQuantity: number;
    categories: InventoryCategorySummary[];
  };
  gauntlet: GauntletProgressSummary;
  boosters: BoosterUsageSummary;
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function normalizeCategory(value: string | null): string {
  if (!value) {
    return "Uncategorized";
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "Uncategorized";
}

function safeJsonParse(value: string | null): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const BOOSTER_META_KEYS = new Set([
  "rank",
  "notes",
  "description",
  "value",
  "amount",
  "type",
  "category",
  "level",
  "rating",
]);

function collectBoosterNames(value: unknown, contextIsBooster: boolean, result: Set<string>): void {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === "string") {
    if (contextIsBooster) {
      value
        .split(/[,;\n]+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .forEach((entry) => result.add(entry));
    }
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string") {
        if (contextIsBooster) {
          const trimmed = entry.trim();
          if (trimmed.length) {
            result.add(trimmed);
          }
        }
        continue;
      }
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        if (contextIsBooster) {
          const nameRaw = record.name ?? record.title ?? record.label;
          if (typeof nameRaw === "string") {
            const trimmed = nameRaw.trim();
            if (trimmed.length) {
              result.add(trimmed);
            }
          }
        }
        for (const [key, nested] of Object.entries(record)) {
          const keyIsBooster = key.toLowerCase().includes("boost");
          collectBoosterNames(nested, contextIsBooster || keyIsBooster, result);
        }
      }
    }
    return;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (contextIsBooster) {
      for (const [key, nested] of entries) {
        const normalized = key.trim();
        if (!normalized.length) {
          continue;
        }
        const isMeta = BOOSTER_META_KEYS.has(normalized.toLowerCase());
        if (!isMeta) {
          result.add(normalized);
          collectBoosterNames(nested, true, result);
          continue;
        }
        if (nested && typeof nested === "object") {
          collectBoosterNames(nested, true, result);
        }
      }
      return;
    }

    for (const [key, nested] of entries) {
      const keyIsBooster = key.toLowerCase().includes("boost");
      if (keyIsBooster && typeof nested === "string") {
        const trimmed = nested.trim();
        if (trimmed.length) {
          result.add(trimmed);
        }
      }
      collectBoosterNames(nested, keyIsBooster, result);
    }
  }
}

function extractBoosters(record: BoosterSourceRow): string[] {
  const names = new Set<string>();
  const attributes = safeJsonParse(record.attributes_json);
  collectBoosterNames(attributes, false, names);

  const traits = safeJsonParse(record.traits_json);
  if (Array.isArray(traits)) {
    for (const entry of traits) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const trait = entry as Record<string, unknown>;
      const type = typeof trait.type === "string" ? trait.type.toLowerCase() : "";
      const categories = Array.isArray(trait.categories)
        ? (trait.categories as unknown[]).map((value) =>
            typeof value === "string" ? value.toLowerCase() : ""
          )
        : [];
      if (type.includes("booster") || categories.some((category) => category.includes("booster"))) {
        const nameRaw = trait.name ?? trait.title ?? trait.label;
        if (typeof nameRaw === "string") {
          const trimmed = nameRaw.trim();
          if (trimmed.length) {
            names.add(trimmed);
          }
        }
      }
    }
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export async function loadStatisticsSnapshot(): Promise<StatisticsSnapshot> {
  return withInit(async (db) => {
    const [cpRows, assetRows, inventoryRows, gauntletRows, universalRows, boosterRows] = await Promise.all([
      db.select<JumpCpRow[]>(
        `SELECT
           j.id AS jump_id,
           j.title AS title,
           j.status AS status,
           j.cp_budget AS cp_budget,
           COALESCE(SUM(
             CASE
               WHEN a.asset_type = 'drawback' THEN 0
               WHEN COALESCE(a.freebie, 0) = 1 THEN 0
               WHEN COALESCE(a.discounted, 0) = 1 THEN COALESCE(a.cost, 0) * CASE WHEN a.quantity IS NULL OR a.quantity <= 0 THEN 1 ELSE a.quantity END / 2.0
               ELSE COALESCE(a.cost, 0) * CASE WHEN a.quantity IS NULL OR a.quantity <= 0 THEN 1 ELSE a.quantity END
             END
           ), 0) AS spent,
           COALESCE(SUM(
             CASE
               WHEN a.asset_type = 'drawback' THEN COALESCE(a.cost, 0) * CASE WHEN a.quantity IS NULL OR a.quantity <= 0 THEN 1 ELSE a.quantity END
               ELSE 0
             END
           ), 0) AS earned
         FROM jumps j
         LEFT JOIN jump_assets a ON a.jump_id = j.id
         GROUP BY j.id
         ORDER BY j.sort_order ASC, j.created_at ASC`
      ),
      db.select<AssetTypeAggregateRow[]>(
        `SELECT
           asset_type,
           COUNT(*) AS item_count,
           COALESCE(SUM(COALESCE(cost, 0) * CASE WHEN quantity IS NULL OR quantity <= 0 THEN 1 ELSE quantity END), 0) AS gross_cost,
           COALESCE(SUM(
             CASE
               WHEN asset_type = 'drawback' THEN 0
               WHEN COALESCE(freebie, 0) = 1 THEN 0
               WHEN COALESCE(discounted, 0) = 1 THEN COALESCE(cost, 0) * CASE WHEN quantity IS NULL OR quantity <= 0 THEN 1 ELSE quantity END / 2.0
               ELSE COALESCE(cost, 0) * CASE WHEN quantity IS NULL OR quantity <= 0 THEN 1 ELSE quantity END
             END
           ), 0) AS net_cost,
           COALESCE(SUM(
             CASE
               WHEN asset_type = 'drawback' THEN COALESCE(cost, 0) * CASE WHEN quantity IS NULL OR quantity <= 0 THEN 1 ELSE quantity END
               ELSE 0
             END
           ), 0) AS credit,
           COALESCE(SUM(CASE WHEN asset_type <> 'drawback' AND COALESCE(discounted, 0) = 1 AND COALESCE(freebie, 0) = 0 THEN 1 ELSE 0 END), 0) AS discounted_count,
           COALESCE(SUM(CASE WHEN COALESCE(freebie, 0) = 1 THEN 1 ELSE 0 END), 0) AS freebie_count
         FROM jump_assets
         GROUP BY asset_type`
      ),
      db.select<InventoryCategoryAggregateRow[]>(
        `WITH normalized_inventory AS (
           SELECT
             CASE
               WHEN category IS NULL OR TRIM(category) = '' THEN 'Uncategorized'
               ELSE TRIM(category)
             END AS category,
             scope,
             CASE
               WHEN quantity IS NULL OR quantity < 0 THEN 0
               ELSE quantity
             END AS quantity
           FROM inventory_items
         )
         SELECT
           category,
           COUNT(*) AS item_count,
           COALESCE(SUM(quantity), 0) AS total_quantity,
           COALESCE(SUM(CASE WHEN scope = 'warehouse' THEN 1 ELSE 0 END), 0) AS warehouse_count,
           COALESCE(SUM(CASE WHEN scope = 'locker' THEN 1 ELSE 0 END), 0) AS locker_count
         FROM normalized_inventory
         GROUP BY category
         ORDER BY item_count DESC, category COLLATE NOCASE`
      ),
      db.select<GauntletAggregateRow[]>(
        `WITH gauntlet_jumps AS (
           SELECT
             j.id,
             j.title,
             j.status,
             COALESCE(j.cp_budget, 0) AS cp_budget,
             j.sort_order,
             j.created_at,
             a.asset_type,
             COALESCE(a.cost, 0) AS cost,
             CASE WHEN a.quantity IS NULL OR a.quantity <= 0 THEN 1 ELSE a.quantity END AS quantity,
             COALESCE(a.discounted, 0) AS discounted,
             COALESCE(a.freebie, 0) AS freebie
           FROM jumps j
           LEFT JOIN jump_assets a ON a.jump_id = j.id
           WHERE LOWER(COALESCE(j.status, '')) LIKE '%gauntlet%'
         )
         SELECT
           id AS jump_id,
           title,
           status,
           cp_budget,
           COALESCE(SUM(
             CASE
               WHEN asset_type = 'drawback' THEN 0
               WHEN freebie = 1 THEN 0
               WHEN discounted = 1 THEN cost * quantity / 2.0
               ELSE cost * quantity
             END
           ), 0) AS spent,
           COALESCE(SUM(
             CASE
               WHEN asset_type = 'drawback' THEN cost * quantity
               ELSE 0
             END
           ), 0) AS earned
         FROM gauntlet_jumps
         GROUP BY id
         ORDER BY MIN(sort_order) ASC, MIN(created_at) ASC, title COLLATE NOCASE`
      ),
      db.select<UniversalDrawbackSettingsRow[]>(
        `SELECT * FROM universal_drawback_settings WHERE id = $1`,
        [UNIVERSAL_DRAWBACK_SETTING_ID]
      ),
      db.select<BoosterSourceRow[]>(
        `SELECT id, name, attributes_json, traits_json FROM character_profiles ORDER BY created_at ASC`
      ),
    ]);

    const cpByJump: CpSpendEarnRow[] = (cpRows as JumpCpRow[]).map((row) => {
      const budget = Math.max(0, toNumber(row.cp_budget));
      const spent = Math.max(0, toNumber(row.spent));
      const earned = Math.max(0, toNumber(row.earned));
      return {
        jumpId: row.jump_id,
        title: row.title,
        status: row.status,
        budget,
        spent,
        earned,
        net: earned - spent,
      } satisfies CpSpendEarnRow;
    });

    const cpTotals = cpByJump.reduce(
      (totals, row) => {
        totals.budget += row.budget;
        totals.spent += row.spent;
        totals.earned += row.earned;
        totals.net += row.net;
        return totals;
      },
      { budget: 0, spent: 0, earned: 0, net: 0 }
    );

    const cpByAssetType: CpAssetTypeBreakdown[] = (assetRows as AssetTypeAggregateRow[])
      .map((row) => ({
        assetType: row.asset_type,
        itemCount: Math.max(0, Math.floor(toNumber(row.item_count))),
        gross: Math.max(0, toNumber(row.gross_cost)),
        netCost: Math.max(0, toNumber(row.net_cost)),
        credit: Math.max(0, toNumber(row.credit)),
        discounted: Math.max(0, Math.floor(toNumber(row.discounted_count))),
        freebies: Math.max(0, Math.floor(toNumber(row.freebie_count))),
      }))
      .sort((a, b) => {
        if (a.assetType === b.assetType) {
          return 0;
        }
        return a.assetType.localeCompare(b.assetType);
      });

    const inventoryCategories: InventoryCategorySummary[] = (inventoryRows as InventoryCategoryAggregateRow[])
      .map((row) => ({
        category: normalizeCategory(row.category ?? null),
        itemCount: Math.max(0, Math.floor(toNumber(row.item_count))),
        totalQuantity: Math.max(0, toNumber(row.total_quantity)),
        warehouseCount: Math.max(0, Math.floor(toNumber(row.warehouse_count))),
        lockerCount: Math.max(0, Math.floor(toNumber(row.locker_count))),
      }))
      .sort((a, b) => {
        if (a.itemCount === b.itemCount) {
          return a.category.localeCompare(b.category, undefined, { sensitivity: "base" });
        }
        return b.itemCount - a.itemCount;
      });

    const inventoryTotals = inventoryCategories.reduce(
      (totals, row) => {
        totals.totalItems += row.itemCount;
        totals.totalQuantity += row.totalQuantity;
        return totals;
      },
      { totalItems: 0, totalQuantity: 0 }
    );

    const gauntletSummaryRows: GauntletProgressRow[] = (gauntletRows as GauntletAggregateRow[]).map((row) => {
      const budget = Math.max(0, toNumber(row.cp_budget));
      const spent = Math.max(0, toNumber(row.spent));
      const earned = Math.max(0, toNumber(row.earned));
      const progress = budget > 0 ? spent / budget : 0;
      return {
        jumpId: row.jump_id,
        title: row.title,
        status: row.status,
        budget,
        spent,
        earned,
        progress,
      } satisfies GauntletProgressRow;
    });

    const completedGauntlets = gauntletSummaryRows.filter((row) => row.budget > 0 && row.spent >= row.budget).length;

    const universalSettings = mapUniversalSettings((universalRows as UniversalDrawbackSettingsRow[])[0]);

    const boosterSources = boosterRows as BoosterSourceRow[];
    const boosterMap = new Map<string, BoosterUsageEntry>();
    let totalBoosters = 0;
    let charactersWithBoosters = 0;

    for (const profile of boosterSources) {
      const boosters = extractBoosters(profile);
      if (boosters.length > 0) {
        charactersWithBoosters += 1;
      }
      totalBoosters += boosters.length;
      for (const booster of boosters) {
        const existing = boosterMap.get(booster);
        if (existing) {
          existing.count += 1;
          existing.characters.push({ id: profile.id, name: profile.name });
        } else {
          boosterMap.set(booster, {
            booster,
            count: 1,
            characters: [{ id: profile.id, name: profile.name }],
          });
        }
      }
    }

    const boosterEntries = Array.from(boosterMap.values()).map((entry) => ({
      ...entry,
      characters: entry.characters.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    }));

    boosterEntries.sort((a, b) => {
      if (b.count === a.count) {
        return a.booster.localeCompare(b.booster, undefined, { sensitivity: "base" });
      }
      return b.count - a.count;
    });

    return {
      cp: {
        totals: cpTotals,
        byJump: cpByJump,
        byAssetType: cpByAssetType,
      },
      inventory: {
        totalItems: inventoryTotals.totalItems,
        totalQuantity: inventoryTotals.totalQuantity,
        categories: inventoryCategories,
      },
      gauntlet: {
        allowGauntlet: universalSettings.allowGauntlet,
        gauntletHalved: universalSettings.gauntletHalved,
        totalGauntlets: gauntletSummaryRows.length,
        completedGauntlets,
        rows: gauntletSummaryRows,
      },
      boosters: {
        totalCharacters: boosterSources.length,
        charactersWithBoosters,
        totalBoosters,
        uniqueBoosters: boosterEntries.length,
        entries: boosterEntries,
      },
    } satisfies StatisticsSnapshot;
  });
}
