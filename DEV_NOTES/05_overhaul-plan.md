# Jumpchain Nexus Modernization & Parity Plan (Updated)

_This document tracks the modernization effort and parity roadmap between the legacy WPF client and the new Tauri + React desktop rewrite._

## 1. Codebase Audit & Optimization

### ✅ Completed
- Established the modern stack (React 19 + TypeScript + Vite + Zustand + TanStack Query + Tauri 2) with modular feature directories under `apps/desktop/src/modules`.
- Wired SQLite FTS5 indices (notes, knowledge base, files, chapters, entities) with DAO helpers for global search and Knowledge Base import flows.
- Implemented streaming PDF ingestion via `pdf-worker.ts` to offload parsing from the UI thread, with `indexer.ts` coordinating persistence.
- Added virtualization-ready dependencies (`react-window`) and ensured Jump Memory Hub timelines and Knowledge Base lists already use windowing helpers.
- Refreshed repository metadata for new stewardship (`LICENSE.txt`, `.github/ISSUE_TEMPLATE/bug_report.md`) while retaining Age-Of-Ages attribution.
- Added a consolidated `npm run test:full` script chaining Vitest, WebdriverIO, Playwright a11y, and Rust-side tests to simplify full-suite execution.
- Introduced smoke/a11y Vitest tags and wired `predev` to `test:smoke` so regressions surface before launching the dev shell.

### ⚠️ Outstanding
- Remove or quarantine the WPF `.sln` and compiled artifacts from the active build graph so they cannot interfere with desktop bundling.
- Review `.gitignore` / `.gitattributes` for any missing entries tied to the Node/Tauri workflow (e.g., Playwright downloads, sqlite cache files).
- Enforce linting/formatting consistency (ESLint/Prettier baseline) across modules; currently only TypeScript compiler + Vitest guard syntax.
- Audit dependency graph for unused packages and size optimization (e.g., confirm pdfjs-dist tree-shaking, evaluate optional Monaco payloads).
- Introduce platform abstraction around filesystem/dialog access to prepare for a future web build (right now modules call Tauri APIs directly).

## 2. Test Suite Development & Automation

### ✅ Completed
- Vitest harness in place with smoke, coverage, a11y component tags, and DAO-focused specs for knowledge base ingestion.
- WebdriverIO runner scaffolding with `wdio.conf.ts` and Playwright-powered accessibility smoke tests.
- Rust-side tests (`npm run test:rust`) configured for the Tauri sidecar crate and included in `test:full` orchestration.

### ⚠️ Outstanding
- Expand Vitest coverage to jump asset DAOs, budgeting utilities, formatter edge cases, and export compositors.
- Author integration tests validating stipend math, draw/scenario ordering, and supplement defaults.
- Build robust WebdriverIO scenarios covering Jump Hub CRUD, Passport aggregation, Export toggles, Warehouse/Locker filters, Drawback Supplement flows, and Input Formatter interactions.
- Add Playwright accessibility runs for each major route (Jump Hub, Passport, Warehouse, Export, Options).
- Surface summary reporting in CI (JUnit or HTML) and archive artifacts for failing screenshots/logs.
- Implement an in-app developer dashboard (dev-only) using the Tauri shell plugin to trigger `npm run test:full` and render streaming output.

## 3. Feature Parity Roadmap (Legacy → Nexus)

### A. Jumpchain Overview (Jump Hub)
- **Current status:** ⚠️ Partial. Jump list management and narrative timeline (JMH) exist, but full build editing (origins, purchases, stipends, reorderable drawbacks/scenarios) remains unimplemented.
- **Completed enablers:** DAO helpers for jump assets (`listJumpAssets`, `createJumpAsset`, `updateJumpAsset`, `deleteJumpAsset`, `reorderJumpAssets`) and budget calculations exist server-side.
- **Outstanding:** Build an integrated editor supporting trait tagging, stipend calculators, misc origin categories, autosave messaging, and spellcheck toggles.

### B. Cosmic Passport
- **Current status:** ⚠️ Partial. Character identity panes render but attribute/skill aggregation, booster toggles, Essential Body Mod Essence tracker, alt-form management, and companion synchronization are missing.
- **Completed enablers:** Purchase trait schema exists; DAO exposes aggregated perk/item queries for Passport summaries.

### C. Cosmic Warehouse
- **Current status:** ⚠️ Partial. Warehouse list view exists without Personal Reality modes, limitation tracking, or stat summaries.
- **Completed enablers:** Purchase tagging supports warehouse flagging; DAO aggregates addons by jump.

### D. Cosmic Locker
- **Current status:** ⚠️ Partial. Items list without Universal/Essential Body Mod distinctions, booster dependency warnings, or category filtering.

### E. Drawback Supplement
- **Current status:** ⚠️ Partial. Supplement route renders but lacks scenario category filters, U.U. supplement logic, default drawback point grants, and improved reward formatting.

### F. Export Center
- **Current status:** ⚠️ Partial. Basic export output exists but does not match legacy BBCode/Markdown formatting, spoiler wrapping, section persistence, or per-section previews.
- **Completed enablers:** Markdown/BBCode conversion libraries (`marked`, `turndown`) installed; export DAO can fetch consolidated data.

### G. Statistics
- **Current status:** 🚧 Not started. No comprehensive metrics pipeline or UI parity beyond placeholder widgets.

### H. Jumpchain Options
- **Current status:** ⚠️ Partial. Options page skeleton exists with limited wiring; body-mod toggles, export presets, custom categories, spellcheck settings, and point bank validations remain to build.
- **Completed enablers:** Settings DAO (`listAppSettings`, `getAppSetting`, `setAppSetting`) ready for use.

### I. Input Formatter
- **Current status:** ⚠️ Partial. Formatter cleans text and persists preferences, but global spellcheck toggle and editor integrations pending.

### J. Story Studio / Narrative Tools
- **Current status:** 🚧 Early WIP. Markdown editor live but lacks template parity, isolation per save, and clipboard/formatter integration.

## 4. Repository & Community Metadata

### ✅ Completed
- LICENSE updated to reflect 2025 Jumpchain Nexus maintainers with Age-Of-Ages historical credit.
- Bug report template modernized with Jumpchain Nexus branding and version prompts.
- README rewritten to document the modern stack, feature list, and usage instructions while acknowledging legacy WPF code as reference-only.

### ⚠️ Outstanding
- Create CONTRIBUTING.md and CODE_OF_CONDUCT.md aligned with new governance.
- Introduce CHANGELOG.md capturing modernization milestones.
- Document portable Node runtime usage and migration scripts in `apps/desktop/README.md` (currently missing).

## Outstanding Work Items (Task Backlog)
1. Build a full Jump Hub editor that surfaces origins, purchases, drawbacks, stipends, and trait tagging using the existing DAO helpers.
2. Implement drag-and-drop (or ordered controls) for drawbacks and scenarios with persisted ordering via `reorderJumpAssets`.
3. Wire stipend calculators and companion import handling so budgets update when stipends are toggled.
4. Extend Jumpchain Options with body-mod/warehouse/drawback supplement selectors that persist through the settings DAO.
5. Synchronize Passport attribute/skill matrices by aggregating purchase traits, including Essential Body Mod Essence tracking.
6. Add Personal Reality mode logic and limitation counters to the Warehouse route, with validation warnings when limits exceed caps.
7. Integrate Universal vs Essential Body Mod item flags into the Locker, including category filters and booster dependency warnings.
8. Port U.U. supplement rules, default drawback point grants, and reward formatting to the Drawback Supplement module.
9. Rebuild the Export Center with section presets, spoiler toggles, BBCode/Markdown parity, and per-section previews backed by saved preferences.
10. Construct the Statistics dashboard pipeline summarizing CP spend/earn, perk/item counts per category, gauntlet tracking, and boosters.
11. Expand Vitest/WebdriverIO/Playwright coverage across Jump Hub, Passport, Warehouse, Export, Options, and Formatter flows, adding CI reports.
12. Introduce developer-only in-app test dashboard leveraging the Tauri shell plugin to run `test:full` and visualize results.
13. Abstract filesystem/dialog helpers behind a platform service to support future web deployment without Tauri.
14. Add CONTRIBUTING, CODE_OF_CONDUCT, and CHANGELOG documents, and update module READMEs with current workflows.

_Updated: 2025-02-14._
