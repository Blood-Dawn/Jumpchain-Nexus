-- MIT License
--
-- Copyright (c) 2025 Bloodawn
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

CREATE TABLE IF NOT EXISTS essential_body_mod_settings (
    id TEXT PRIMARY KEY,
    budget INTEGER DEFAULT 1000,
    starting_mode TEXT DEFAULT 'standard',
    essence_mode TEXT DEFAULT 'none',
    advancement_mode TEXT DEFAULT 'standard',
    ep_access_mode TEXT DEFAULT 'none',
    ep_access_modifier TEXT DEFAULT 'none',
    unlockable_essence INTEGER DEFAULT 0,
    limit_investment INTEGER DEFAULT 0,
    investment_allowed INTEGER DEFAULT 0,
    investment_ratio INTEGER DEFAULT 1,
    incremental_budget INTEGER DEFAULT 0,
    incremental_interval INTEGER DEFAULT 1,
    training_allowance INTEGER DEFAULT 0,
    tempered_by_suffering INTEGER DEFAULT 0,
    unbalanced_mode TEXT DEFAULT 'none',
    unbalanced_description TEXT,
    limiter TEXT DEFAULT 'none',
    limiter_description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS essential_body_mod_essences (
    id TEXT PRIMARY KEY,
    setting_id TEXT NOT NULL REFERENCES essential_body_mod_settings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ebm_essences_setting_order
    ON essential_body_mod_essences (setting_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS universal_drawback_settings (
    id TEXT PRIMARY KEY,
    total_cp INTEGER DEFAULT 0,
    companion_cp INTEGER DEFAULT 0,
    item_cp INTEGER DEFAULT 0,
    warehouse_wp INTEGER DEFAULT 0,
    allow_gauntlet INTEGER DEFAULT 0,
    gauntlet_halved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO essential_body_mod_settings (
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
    'essential-default',
    1000,
    'standard',
    'none',
    'standard',
    'none',
    'none',
    0,
    0,
    0,
    1,
    0,
    1,
    0,
    0,
    'none',
    NULL,
    'none',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT(id) DO NOTHING;

INSERT INTO universal_drawback_settings (
    id,
    total_cp,
    companion_cp,
    item_cp,
    warehouse_wp,
    allow_gauntlet,
    gauntlet_halved,
    created_at,
    updated_at
) VALUES (
    'universal-default',
    0,
    0,
    0,
    0,
    0,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT(id) DO NOTHING;
