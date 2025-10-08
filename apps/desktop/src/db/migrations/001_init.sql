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

-- FTS5
CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(content, note_id UNINDEXED);
CREATE VIRTUAL TABLE IF NOT EXISTS file_fts USING fts5(content, file_id UNINDEXED);
CREATE VIRTUAL TABLE IF NOT EXISTS entity_fts USING fts5(name, search_terms, entity_id UNINDEXED);

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
