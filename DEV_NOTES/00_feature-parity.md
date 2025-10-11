# Feature Parity Matrix

_Last updated: 2025-10-09 (Dialog service shared across knowledge base, studio, export)_

## Scope & Method
- Legacy reference: `apps/desktop/legacy/old-wpf/` (WPF net8.0 MVVM solution archive).
- Modern target: `apps/desktop/src/` (React + Vite + Tauri).
- Status codes: ✅ complete · ⚠️ partial · 🚧 not started · 🛠 in progress · ❌ missing/blocked.
- Each row links the authoritative legacy artifact to the modern implementation and highlights gaps plus migration/QA follow-ups.

## UI Module Parity

| Legacy Module (WPF) | Key Responsibilities (legacy refs) | Modern Implementation | Parity Status | Gaps / Follow-ups |
| --- | --- | --- | --- | --- |
| Jumpchain Overview (`Views/JumpchainOverviewView.xaml`, `ViewModel/JumpchainOverviewViewModel.cs`) | Manage jump list CRUD, origin metadata, per-character builds, purchases, stipends, drawbacks, scenarios, supplements. Messenger hooks for save/load/settings. | `src/routes/jumpchain/overview` (JumpHub + nested tabs). Uses Zustand `useJumpStore`, TanStack Query for persistence. | ⚠️ | Missing: draw/scenario re-order drag, stipend calculators, origin misc categories, messenger-equivalent save triggers. Need purchase attribute editor, category management, spellcheck toggle. |
| Cosmic Passport (`Views/CosmicPassportView.xaml`, `ViewModel/CosmicPassportViewModel.cs`) | Character management, biography fields, stats, boosters, alt forms, attribute tables. | `src/routes/passport` (Character Passport). Core identity fields present. | ⚠️ | Outstanding: attribute/skill matrix, booster dependency toggles, EBMEssence tracker, alt-form editing parity, companion sync, spellcheck toggle. |
| Cosmic Warehouse (`Views/CosmicWarehouseView.xaml`, `ViewModel/CosmicWarehouseViewModel.cs`) | Supplement toggles (Generic/Personal Reality), statistics rollups, purchase categorization by warehouse mode. | `src/routes/warehouse` modules. | ⚠️ | Need Personal Reality switch logic, limitation tracking, section-specific export toggles, stat rollups. |
| Cosmic Locker (`Views/CosmicLockerView.xaml`, `ViewModel/CosmicLockerViewModel.cs`) | Body mod management (Universal + Essential + SB). Tracks costs, dependencies. | `src/routes/locker`. | ⚠️ | Missing Universal vs Essential feature flag parity, booster dependency warnings, purchase filtering. |
| Drawback Supplement (`Views/DrawbackSupplementView.xaml`, `ViewModel/DrawbackSupplementViewModel.cs`) | Manage drawback add-ons, scenario bank, UU supplement toggles. | `src/routes/drawbacks`. | ⚠️ | Need scenario category filters, UU supplement handling, reward text formatting. |
| Export Center (`Views/ExportView.xaml`, `ViewModel/ExportViewModel.cs`) | Assemble exports (Generic, BBCode, Markdown), toggle sections, format budgets, companion exports, mass write via `TxtAccess`. | `src/routes/export`. | ⚠️ | Lacks BBCode/Markdown formatting parity, spoiler formatting, section toggle persistence, per-section preview. |
| Statistics (`Views/StatisticsView.xaml`, `ViewModel/StatisticsViewModel.cs`) | Aggregate point totals, purchase metrics, companion stats, attribute rankings. | `src/routes/statistics`. | 🚧 | Implement full metrics pipeline, including booster/attribute calculations. |
| Jumpchain Options (`Views/JumpchainOptionsView.xaml`, `ViewModel/JumpchainOptionsViewModel.cs`) | Global defaults, supplement settings, export options, point bank policies. | `src/routes/options`. | ⚠️ | Pending: body mod toggle wiring, export option groups, default presets import, validation on point-bank limits. |
| Story Studio (`Views/StoryStudioView.xaml`, `ViewModel/StoryStudioViewModel.cs`) | Narrative editor with section templates, markdown export, clipboard helpers. | `src/routes/story-studio`. | 🚧 | Needs isolation per requirement, template parity, clipboard integration, auto-save. |
| Input Formatter (`Views/InputFormatterView.xaml`, `ViewModel/InputFormatterViewModel.cs`) | Clean pasted text, configurable line-break handling, XML-safe output, budget previews. | `src/routes/formatter`. | ⚠️ | Preferences persist via SQLite; clipboard helpers live. TODO: spellcheck toggle parity and expose formatter hooks in other editors/options UI once ported. |

## Cross-Cutting Services & Systems

| Legacy Component | Responsibilities | Modern Status | Action Items |
| --- | --- | --- | --- |
| `SaveFileLoader`, `SaveMigration` | Load/save XML, migrate older versions (<1.1, <1.3, <1.4). | DAO layer `src/data/sqlite/*`, JSON schemas. | Recreate migration steps in SQLite migrations; ensure triggers align with legacy field defaults. Map `saveVersion` to schema version table. |
| `RandomizeListAccess` & `RandomizeServices` | Provide random jump/drawback/companion selection with filters. | Randomizer route placeholder. | Port randomizer logic; ensure seed/history tracking; hook into Zustand store. |
| `FormatHelper` | Clean imported text, budget formatting (thousand separators, custom enclosures). | Formatter service + React module (`src/services/formatter.ts`, `src/routes/formatter`). | Integrate cleanup shortcuts into jump editors/export flows; add bullet normalization presets once those UIs land. |
| `DialogService` | Prompts for confirmation, file dialogs (open/save). | `src/services/dialogService.ts` centralises confirm/open/save helpers, wired into Knowledge Base, Story Studio, Export modules. | Expand coverage to remaining routes, add message/ask helpers, and integrate save dialogs for export/download flows. |
| `WeakReferenceMessenger` messages (`Messages/`) | Decoupled notifications (save/load, settings, randomizer). | Partial custom events. | Establish event bus (React context or Zustand slices) with parity message payloads. |
| `TxtAccess`/`XmlAccess`/`FileAccess` | Export writing, config handling, backups. | Tauri fs setup with SQLite exports. | Recreate backup rotation, ensure hashed filenames, implement export directory chooser. |
| `AttributeCalculationClass` | Rank-based numeric conversions for stats. | Not ported. | Port rank table, integrate with stats + booster calculators. |
| `BudgetCalculationsClass` | Calculate budgets, freebies, stipends. | Partial (jump store). | Finish calculations, including origin thresholds and bank rules. |
| `AppSettingsModel` (`CfgAccess`) | Window size, spellcheck toggles, theme. | Basic settings store. | Wire to Tauri `settings.json`, persist per user, feed into UI toggles. |

## Data Model Coverage Snapshot

| Entity | Legacy Fields Covered? | Modern Coverage | Notes |
| --- | --- | --- | --- |
| `SaveFile` root | ✅ | ⚠️ | Supplements missing (`GenericDrawbackSupplement`, `UUSupplement`, `GenericWarehouse`, etc.). Need SQLite tables + DAO + Zustand hydration. |
| `Jump` & nested `JumpBuild` | ✅ | ⚠️ | Most core fields ported, but purchase attribute lists & stipend arrays need parity. |
| `Character` | ✅ | ⚠️ | Alt forms, boosters, EBMEssence partial. Ensure biography string fields accept large text with formatting. |
| Supplements (`GenericWarehouse`, `PersonalReality`, `EssentialBodyMod`, `UUSupplement`, etc.) | ✅ | 🚧 | Create dedicated tables, UI slices, export integration. |
| `Options` + `ExportOptions` | ✅ | ⚠️ | Persisted defaults not wired into all UIs; export toggle arrays incomplete. |
| `KnowledgeBase` (legacy `KnowledgeBaseViewModel.cs`) | ✅ | ⚠️ | React module online with seeded articles, category/tag filters, CRUD + FTS search. PDF/text import pipeline lands here. Remaining: bulk import UI, rich-text formatting parity, advanced tagging. |

## High-Priority Parity Gaps

1. **Knowledge Base module**
	- Legacy: `ViewModel/KnowledgeBaseViewModel.cs` provides searchable entries sourced from XML.
	- To-do: Extend knowledge base with bulk import batches, PDF attachment previews, and rich-text editing.

2. **Randomizer parity**
	- Port filters (origin, cost ceiling, gauntlet flag) and ensure deterministic seed support.
	- Add history list + undo, mimic `RandomizeListAccess` weighting rules.

3. **Formatter utilities** — ✅ React formatter now mirrors `FormatHelper`
	- Line-break controls, XML sanitisation, and thousands-separator previews ship in `src/routes/formatter`.
	- Follow-up: surface formatter shortcuts inside Jump Overview editors and export composer once those surfaces are rebuilt.

4. **Options & Export**
	- Migrate export toggle matrices, spoiler formatting, per-format output writer.
	- Implement reverse budget format + section separators.

5. **Tauri SQLite migrations**
	- Mirror versions: base schema, supplement tables, triggers ensuring budget auto-updates.
	- Add migration tests to guard regression.

6. **Story Studio isolation**
	- Ensure independent route + store slice; support templates, Markdown preview, and safe-save to disk.

## Testing & QA Backlog
- Snapshot tests for Zustand stores to verify default state matches legacy defaults (`Options`, `SaveFile` seeds).
- End-to-end test plan covering:
  - Jump CRUD → export roundtrip.
  - Character creation → passport export.
  - Supplement toggles → stats recalculation.
  - Randomizer run with deterministic seed.
  - Knowledge Base search + PDF ingestion stub.
- Migration regression tests to validate upgrade from legacy XML import to SQLite schema.

## Next Implementation Targets
1. Build migration scripts (`src-tauri/migrations/`) for supplement tables + triggers; fix existing syntax issues.
2. Flesh out Story Studio with template parity and separate persistence.
3. Port Randomizer filters and history UX.
4. Expand export options and formatting toggles.
5. Extend Knowledge Base with PDF ingestion + bulk import tooling.
6. Wire formatter presets into Jump Overview/Options forms once those UIs ship.

---
_This matrix should be updated after each module reaches ✅ parity or when new gaps emerge._
