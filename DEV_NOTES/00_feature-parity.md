# Feature Parity Inventory

| Module | Current UI state | Data source(s) | Missing actions | Tauri permissions needed | Files to change |
| --- | --- | --- | --- | --- | --- |
| Jump Hub | Placeholder text only (`module-placeholder` section) | None (no data wiring) | Jump listing, summaries, CRUD, reorder, duplication, quick actions | `sql:default`, `sql:allow-execute` | `src/modules/overview/**`, `src/db/**`, `src/services/**`
| Jump Memory Hub | Functional timeline, notes editor, onboarding wizard; data loads via DAO snapshot | SQLite via `db/dao.ts`, Zustand stores, React Query | Link to other modules, entity management, syncing with new tables, error handling toasts | `sql:default`, `sql:allow-execute` | `src/modules/jmh/**`, `src/db/**`
| Cosmic Passport | Placeholder text only | None | Profile form, derived attributes, persistence | `sql:*`, possibly `fs:readTextFile` for imports | `src/modules/passport/**`, `src/db/**`, `src/services/forms/**`
| Cosmic Warehouse | Placeholder text only | None | Inventory CRUD, categories, drag/drop with locker, persistence | `sql:*` | `src/modules/warehouse/**`, `src/modules/locker/**`, `src/db/**`
| Cosmic Locker | Placeholder text only | None | Personal loadout tracking, counts, notes, sync with warehouse | `sql:*` | `src/modules/locker/**`, `src/db/**`
| Drawback Supplement | Placeholder text only | None | Point accounting UI, toggles, rule presets, persistence | `sql:*` | `src/modules/drawbacks/**`, `src/db/**`
| Export | Placeholder text only | None | Format options, preview, generation to clipboard/files, export to disk | `sql:*`, `fs:writeFile`, `fs:readTextFile`, `dialog:default` | `src/modules/export/**`, `src/services/export/**`
| Statistics | Placeholder text only | None | Aggregations, charts, cross-module metrics | `sql:*` | `src/modules/stats/**`, `src/db/**`
| Jump Settings/Options | Placeholder text only | None | Config presets, defaults management, schema editor, persistence | `sql:*` | `src/modules/options/**`, `src/db/**`
| Input Formatter | Placeholder text only | None | Paste normalization pipeline, preview, apply to DB entities | Possibly `fs:readTextFile` for imports; `sql:*` for applying results | `src/modules/formatter/**`, `src/services/formatter/**`
| Jump Randomizer | Placeholder text only | None | Weighted random selection, seeding, apply to DB | `sql:*` | `src/modules/randomizer/**`, `src/services/randomizer/**`
| Story Studio | Functional CRUD, editor, layouts; persists via DAO | SQLite via `db/dao.ts`, Zustand store | Entity linking UI, grammar hooks, cross-module references | `sql:*` | `src/modules/studio/**`, `src/db/**`, `src/modules/jmh/**` |
