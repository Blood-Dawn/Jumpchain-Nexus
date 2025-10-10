-- MIT License
--
-- Copyright (c) 2025 Age-Of-Ages
--
-- Permission is hereby granted, free of charge, to any person obtaining a copy
-- of this software and associated documentation files (the "Software"), to deal
-- in the Software without restriction, including without limitation the rights
-- to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
-- copies of the Software, and to permit persons to whom the Software is
-- furnished to do so, subject to the following conditions:
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

CREATE TABLE IF NOT EXISTS randomizer_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS randomizer_groups (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    filters_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_id) REFERENCES randomizer_lists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS randomizer_entries (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    weight INTEGER DEFAULT 1,
    link TEXT,
    tags_json TEXT,
    filters_json TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES randomizer_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS randomizer_rolls (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    seed TEXT,
    params_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_id) REFERENCES randomizer_lists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS randomizer_roll_results (
    id TEXT PRIMARY KEY,
    roll_id TEXT NOT NULL,
    entry_id TEXT,
    position INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,
    FOREIGN KEY (roll_id) REFERENCES randomizer_rolls(id) ON DELETE CASCADE,
    FOREIGN KEY (entry_id) REFERENCES randomizer_entries(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_randomizer_lists_order
    ON randomizer_lists (sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_randomizer_groups_list
    ON randomizer_groups (list_id ASC, sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_randomizer_entries_group
    ON randomizer_entries (group_id ASC, sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_randomizer_entries_name
    ON randomizer_entries (name COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_randomizer_rolls_list
    ON randomizer_rolls (list_id ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_randomizer_roll_results_roll
    ON randomizer_roll_results (roll_id ASC, position ASC);

INSERT INTO randomizer_lists (id, name, description, sort_order)
SELECT 'default-randomizer-list', 'Default Pool', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM randomizer_lists);

INSERT INTO randomizer_groups (id, list_id, name, sort_order)
SELECT 'default-randomizer-group', 'default-randomizer-list', 'Ungrouped', 0
WHERE NOT EXISTS (
    SELECT 1 FROM randomizer_groups WHERE list_id = 'default-randomizer-list'
);

INSERT INTO randomizer_entries (
    id,
    group_id,
    name,
    weight,
    link,
    sort_order,
    created_at,
    updated_at
)
SELECT
    COALESCE(id, lower(hex(randomblob(16)))),
    'default-randomizer-group',
    name,
    COALESCE(weight, 1),
    link,
    COALESCE(sort_order, 0),
    COALESCE(created_at, CURRENT_TIMESTAMP),
    COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM randomizer_pools
WHERE NOT EXISTS (SELECT 1 FROM randomizer_entries);

DROP INDEX IF EXISTS idx_randomizer_pools_order;
DROP TABLE IF EXISTS randomizer_pools;

