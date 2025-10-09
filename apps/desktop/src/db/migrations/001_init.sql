-- MIT License
-- 
-- Copyright (c) 2025 Age-Of-Ages
-- 
-- Permission is hereby granted, free of charge, to any person obtaining a copy
-- of this software and associated documentation files (the "Software"), to deal
-- in the Software without restriction, including without limitation the rights
-- to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
-- copies of the Software, and to permit persons to do so, subject to the
-- following conditions:
-- 
-- The above copyright notice and this permission notice shall be included in all
-- copies or substantial portions of the Software.
-- 
-- THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
-- IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
-- FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
-- AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
-- LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
-- OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
-- SOFTWARE.

-- core tables
CREATE TABLE IF NOT EXISTS jumps (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    world TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE jumps ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE jumps ADD COLUMN IF NOT EXISTS cp_budget INTEGER DEFAULT 0;
ALTER TABLE jumps ADD COLUMN IF NOT EXISTS cp_spent INTEGER DEFAULT 0;
ALTER TABLE jumps ADD COLUMN IF NOT EXISTS cp_income INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    meta_json TEXT,
    search_terms TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    jump_id TEXT REFERENCES jumps(id) ON DELETE CASCADE,
    md TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mentions (
    id TEXT PRIMARY KEY,
    note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
    entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
    start INTEGER,
    "end" INTEGER
);

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    jump_id TEXT REFERENCES jumps(id) ON DELETE SET NULL,
    kind TEXT,
    path TEXT,
    original_name TEXT,
    content TEXT DEFAULT '',
    indexed_at TEXT
);

CREATE TABLE IF NOT EXISTS recaps (
    id TEXT PRIMARY KEY,
    jump_id TEXT REFERENCES jumps(id) ON DELETE CASCADE,
    period TEXT,
    md TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS next_actions (
    id TEXT PRIMARY KEY,
    jump_id TEXT REFERENCES jumps(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    due_date TEXT
);

CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    jump_id TEXT REFERENCES jumps(id) ON DELETE SET NULL,
    summary TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    synopsis TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chapter_text (
    chapter_id TEXT PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
    json TEXT NOT NULL,
    plain TEXT DEFAULT '',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chapter_snapshots (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chapter_mentions (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    start INTEGER,
    "end" INTEGER
);

CREATE TABLE IF NOT EXISTS jump_assets (
    id TEXT PRIMARY KEY,
    jump_id TEXT NOT NULL REFERENCES jumps(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    subcategory TEXT,
    cost INTEGER DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    discounted INTEGER DEFAULT 0,
    freebie INTEGER DEFAULT 0,
    notes TEXT,
    metadata TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER DEFAULT 1,
    slot TEXT,
    notes TEXT,
    tags TEXT,
    jump_id TEXT REFERENCES jumps(id) ON DELETE SET NULL,
    metadata TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS character_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    alias TEXT,
    species TEXT,
    homeland TEXT,
    biography TEXT,
    attributes_json TEXT,
    traits_json TEXT,
    alt_forms_json TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS export_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    options_json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jump_assets_jump_type ON jump_assets (jump_id, asset_type, sort_order);
CREATE INDEX IF NOT EXISTS idx_inventory_scope ON inventory_items (scope, sort_order);
CREATE INDEX IF NOT EXISTS idx_inventory_jump ON inventory_items (jump_id);
CREATE INDEX IF NOT EXISTS idx_export_presets_name ON export_presets (name COLLATE NOCASE);

-- FTS5
CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(content, note_id UNINDEXED);
CREATE VIRTUAL TABLE IF NOT EXISTS file_fts USING fts5(content, file_id UNINDEXED);
CREATE VIRTUAL TABLE IF NOT EXISTS entity_fts USING fts5(name, search_terms, entity_id UNINDEXED);
CREATE VIRTUAL TABLE IF NOT EXISTS chapter_fts USING fts5(content, chapter_id UNINDEXED);

-- triggers keep FTS in sync
CREATE TRIGGER IF NOT EXISTS note_ai AFTER INSERT ON notes BEGIN
    INSERT INTO note_fts(rowid, content, note_id) VALUES (new.rowid, new.md, new.id);
END;

CREATE TRIGGER IF NOT EXISTS note_au AFTER UPDATE ON notes BEGIN
    INSERT INTO note_fts(note_fts, rowid, content, note_id) VALUES('delete', old.rowid, old.md, old.id);
    INSERT INTO note_fts(rowid, content, note_id) VALUES (new.rowid, new.md, new.id);
END;

CREATE TRIGGER IF NOT EXISTS note_ad AFTER DELETE ON notes BEGIN
    INSERT INTO note_fts(note_fts, rowid, content, note_id) VALUES('delete', old.rowid, old.md, old.id);
END;

CREATE TRIGGER IF NOT EXISTS file_ai AFTER INSERT ON files BEGIN
    INSERT INTO file_fts(rowid, content, file_id)
    VALUES (new.rowid, COALESCE(new.content, ''), new.id);
END;

CREATE TRIGGER IF NOT EXISTS file_au AFTER UPDATE ON files BEGIN
    INSERT INTO file_fts(file_fts, rowid, content, file_id)
    VALUES('delete', old.rowid, COALESCE(old.content, ''), old.id);
    INSERT INTO file_fts(rowid, content, file_id)
    VALUES (new.rowid, COALESCE(new.content, ''), new.id);
END;

CREATE TRIGGER IF NOT EXISTS file_ad AFTER DELETE ON files BEGIN
    INSERT INTO file_fts(file_fts, rowid, content, file_id)
    VALUES('delete', old.rowid, COALESCE(old.content, ''), old.id);
END;

CREATE TRIGGER IF NOT EXISTS entity_ai AFTER INSERT ON entities BEGIN
    INSERT INTO entity_fts(rowid, name, search_terms, entity_id)
    VALUES (new.rowid, new.name, COALESCE(new.search_terms, ''), new.id);
END;

CREATE TRIGGER IF NOT EXISTS entity_au AFTER UPDATE ON entities BEGIN
    INSERT INTO entity_fts(entity_fts, rowid, name, search_terms, entity_id)
    VALUES('delete', old.rowid, old.name, COALESCE(old.search_terms, ''), old.id);
    INSERT INTO entity_fts(rowid, name, search_terms, entity_id)
    VALUES (new.rowid, new.name, COALESCE(new.search_terms, ''), new.id);
END;

CREATE TRIGGER IF NOT EXISTS entity_ad AFTER DELETE ON entities BEGIN
    INSERT INTO entity_fts(entity_fts, rowid, name, search_terms, entity_id)
    VALUES('delete', old.rowid, old.name, COALESCE(old.search_terms, ''), old.id);
END;

CREATE TRIGGER IF NOT EXISTS chapter_text_ai AFTER INSERT ON chapter_text BEGIN
    INSERT INTO chapter_fts(rowid, content, chapter_id)
    VALUES ((SELECT rowid FROM chapters WHERE id = new.chapter_id), COALESCE(new.plain, ''), new.chapter_id);
END;

CREATE TRIGGER IF NOT EXISTS chapter_text_au AFTER UPDATE ON chapter_text BEGIN
    INSERT INTO chapter_fts(chapter_fts, rowid, content, chapter_id)
    VALUES('delete', (SELECT rowid FROM chapters WHERE id = old.chapter_id), COALESCE(old.plain, ''), old.chapter_id);
    INSERT INTO chapter_fts(rowid, content, chapter_id)
    VALUES ((SELECT rowid FROM chapters WHERE id = new.chapter_id), COALESCE(new.plain, ''), new.chapter_id);
END;

CREATE TRIGGER IF NOT EXISTS chapter_text_ad AFTER DELETE ON chapter_text BEGIN
    INSERT INTO chapter_fts(chapter_fts, rowid, content, chapter_id)
    VALUES('delete', (SELECT rowid FROM chapters WHERE id = old.chapter_id), COALESCE(old.plain, ''), old.chapter_id);
END;
