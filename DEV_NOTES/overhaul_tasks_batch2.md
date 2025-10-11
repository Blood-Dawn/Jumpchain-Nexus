# Overhaul Plan Task Breakdown – Batch 2

1. Story Studio still lacks template parity, save isolation, and clipboard/formatter hooks promised in the modernization plan.

:::task-stub{title="Restore Story Studio template parity"}
1. Port the legacy prompt/template library into `apps/desktop/src/modules/studio/templates/`, tagging entries for quick filtering and localization.
2. Add a template picker sidebar in `StoryStudio.tsx` that previews metadata and applies selected templates into the current draft without overwriting unsaved text.
3. Document the template system in the module README so writers know how to contribute new presets.
:::

2. Story Studio drafts currently bleed across saves; they need proper sandboxing per character build.

:::task-stub{title="Isolate Story Studio drafts per save"}
1. Extend the DAO layer to store studio drafts keyed by jump/build identifiers, including autosave timestamps for conflict detection.
2. Ensure the Story Studio store hydrates from the active build context and clears state when switching jumps.
3. Add regression tests verifying that drafts from Jump A never surface when switching to Jump B.
:::

3. Clipboard tools and the Input Formatter aren’t yet available inside Story Studio, reducing parity with the legacy workflow.

:::task-stub{title="Integrate formatter and clipboard helpers into Story Studio"}
1. Reuse the global Input Formatter component within `StoryStudioEditor.tsx`, exposing spellcheck toggles and cleaning utilities.
2. Add copy-to-clipboard buttons for common export targets (Markdown/BBCode) using the platform abstraction instead of direct Tauri calls.
3. Verify via Vitest UI tests that formatter preferences persist between Story Studio and other editor modules.
:::

4. Story Studio promises autosave messaging but still lacks resume/conflict dialogs akin to the legacy editor.

:::task-stub{title="Add Story Studio autosave status and versioning"}
1. Surface toast/inline status updates whenever autosave fires or resumes from a stale draft.
2. Provide a minimal version history drawer that lists autosave snapshots with restore previews.
3. Cover autosave conflict flows with unit tests ensuring the newest draft always wins unless the user selects a restore point.
:::

5. Automated coverage for Story Studio is thin despite its growing complexity.

:::task-stub{title="Expand Story Studio test coverage"}
1. Create Vitest suites for template insertion, autosave reducers, and formatter toggles under `apps/desktop/src/modules/studio/__tests__/`.
2. Author WebdriverIO journeys that open Story Studio, swap jumps, and confirm drafts remain isolated.
3. Hook the new specs into `npm run test:full` so regressions block CI.
:::

6. The streaming PDF ingestion pipeline lacks user-facing progress and resume affordances during large Knowledge Base imports.

:::task-stub{title="Expose Knowledge Base import progress and resume"}
1. Emit progress events from `pdf-worker.ts` and listen via TanStack Query subscriptions in the Knowledge Base UI.
2. Add a progress panel with pause/resume controls and persisted checkpoints so long imports can recover after app restarts.
3. Write integration tests simulating interrupted imports to ensure they resume from the saved checkpoint.
:::

7. Import failures currently disappear into logs; operators need actionable error handling.

:::task-stub{title="Improve Knowledge Base import error handling"}
1. Capture worker exceptions, persist them into an `import_failures` table, and surface retry buttons in the UI.
2. Provide a downloadable log bundle (JSON) for failed documents, leveraging the platform abstraction for file writes.
3. Add Vitest coverage for the retry queue to guarantee failed entries can be resubmitted without duplication.
:::

8. Manual curation of Knowledge Base entries remains awkward without an editor alongside the importer.

:::task-stub{title="Ship a Knowledge Base manual editor"}
1. Build CRUD views in `apps/desktop/src/modules/knowledge-base/editor/` that allow editing titles, tags, and body content using the shared formatter.
2. Wire DAO helpers for create/update/delete pathways with optimistic cache updates.
3. Cover the flows with smoke E2E tests that validate manual edits appear in global search immediately.
:::

9. Jump entries and Knowledge Base articles aren’t yet cross-linked, leaving research flows disconnected.

:::task-stub{title="Cross-link Knowledge Base articles with Jump Hub assets"}
1. Extend jump asset records to store related article IDs and expose them via `listJumpAssets`.
2. Surface related-article chips in the Jump Hub sidebar that deep-link into the Knowledge Base module.
3. Update the Knowledge Base view to show “Referenced by” panels that navigate back to the originating jump.
:::

10. Although SQLite FTS indices exist, there’s no omnipresent quick search to exploit them.

:::task-stub{title="Build a global command palette backed by FTS search"}
1. Implement a command palette overlay (e.g., `Ctrl+K`) that queries FTS indices for jumps, articles, and assets in a single list.
2. Provide keyboard navigation and result grouping (Jumps, Knowledge Base, Warehouse, etc.) for accessibility parity.
3. Add smoke tests ensuring palette searches respect permissions and return expected rankings.
:::

11. Only a subset of modules leverage the new virtualization helpers, risking sluggishness in large inventories.

:::task-stub{title="Virtualize Warehouse and Locker item lists"}
1. Refactor Warehouse and Locker list components to render through `react-window`, preserving keyboard navigation and filtering.
2. Ensure row heights remain responsive for cards with expanded metadata or booster warnings.
3. Measure before/after performance and document gains in the module READMEs.
:::

12. Contributors need guidance on when to apply virtualization within the modular architecture.

:::task-stub{title="Document list virtualization best practices"}
1. Draft a DEV_NOTES entry outlining when to use `react-window`, dynamic sizing strategies, and accessibility considerations.
2. Reference existing implementations (Knowledge Base, Jump Memory Hub) as exemplars with annotated code snippets.
3. Link the guidance from CONTRIBUTING.md once governance docs land.
:::

13. The PDF worker operates silently without telemetry or unit coverage, making regressions hard to diagnose.

:::task-stub{title="Instrument and test the PDF ingestion worker"}
1. Add structured logging (timings, bytes processed) to `pdf-worker.ts` and emit telemetry events consumable by the UI.
2. Write Vitest unit tests around the worker entry point using mock PDF fragments to validate chunking and indexing.
3. Capture worker metrics in the dev console or a hidden diagnostics panel for troubleshooting.
:::

14. Power users request a scripted way to batch import/export Knowledge Base archives outside the UI.

:::task-stub{title="Provide Knowledge Base bulk import/export CLI"}
1. Expose a Tauri command or Node script in `tools/` that accepts a directory of PDFs/JSON and triggers the existing ingestion pipeline.
2. Support exporting selected articles into a portable archive for backups, reusing DAO helpers.
3. Update documentation with usage examples and warnings about long-running imports.
:::

15. QA lacks seeded content to validate Knowledge Base and search scenarios consistently.

:::task-stub{title="Seed sample Knowledge Base datasets"}
1. Create fixture bundles (JSON/PDF) with varied metadata and store them in `content/fixtures/knowledge-base/`.
2. Add a development script that loads the fixtures into a fresh database for local testing.
3. Reference the fixtures in automated tests to ensure query regressions are caught.
:::

16. Current Knowledge Base search offers only keyword matching; contributors want filters aligned with legacy metadata.

:::task-stub{title="Add Knowledge Base advanced search filters"}
1. Extend DAO queries to filter by jump, tag, author, and document type in addition to full-text search.
2. Update the Knowledge Base UI with faceted filter controls that combine with the existing search box.
3. Cover filter combinations with unit tests and snapshot expected result counts for regression detection.
:::

17. Export Center outputs would benefit from referencing Knowledge Base citations when assembling jump write-ups.

:::task-stub{title="Surface Knowledge Base citations inside Export Center"}
1. Allow export templates to insert citation tokens that resolve to Knowledge Base article links or footnotes.
2. Provide an article picker modal within the Export Center that filters via the global FTS service.
3. Add tests confirming citations render correctly in both Markdown and BBCode outputs.
:::

18. As TanStack Query usage grows, cache invalidation bugs appear across Story Studio and Knowledge Base routes.

:::task-stub{title="Audit TanStack Query caching for editorial modules"}
1. Map all query/mutation keys in Story Studio and Knowledge Base, consolidating constants to avoid typos.
2. Ensure mutations invalidate or update the correct caches when drafts or articles change.
3. Add unit tests leveraging `@tanstack/query-testing` utilities to catch stale cache regressions.
:::

19. Drag-and-drop ingestion for Knowledge Base PDFs and Story Studio assets still uses direct Tauri calls, blocking future web builds.

:::task-stub{title="Extend the platform service for drag-and-drop ingestion"}
1. Enhance the platform abstraction with drop-target helpers that deliver file metadata independent of Tauri APIs.
2. Refactor Knowledge Base and Story Studio modules to consume the new helpers, falling back to browser APIs when available.
3. Add tests validating that drag-drop works in both desktop (Tauri) and mocked web environments.
:::

20. Contributors need clearer documentation of the Knowledge Base and Story Studio workflows introduced by the modernization.

:::task-stub{title="Document editorial workflows in DEV_NOTES"}
1. Author a DEV_NOTES guide that walks through importing articles, editing drafts, and exporting stories using the new modules.
2. Embed screenshots or animated GIFs (where feasible) illustrating key flows like template insertion and command palette search.
3. Link the guide from README.md so new contributors can find the editorial tooling overview quickly.
:::
