# Module Inventory — October 2025

| Capability | Status | Notes |
| --- | --- | --- |
| Database migrations | Present | `apps/desktop/src/db/migrations/001_init.sql` creates core tables, FTS5 indexes, and triggers. Will review for spec alignment in Step 1. |
| DAO layer | Present | `apps/desktop/src/db/dao.ts` exposes CRUD/search helpers. Search queries use LIKE-style wildcards; FTS-driven ranking refinement pending. |
| PDF worker | Present | `apps/desktop/src/pdf/pdf-worker.ts` extracts text and reports progress. Needs verification that inserts go to `file_fts` via DAO. |
| PDF viewer UI | Present | `apps/desktop/src/components/PdfViewer.tsx` renders pages, search, and highlights. Styling/hooks refinement likely needed. |
| Jump Memory Hub (JMH) UI shell | Partial | Individual panels exist (`NavRail`, `Timeline`, `NextActionsPanel`, etc.) but not yet assembled in `App` shell. |
| TipTap mentions | Present | `NotesEditor.tsx` integrates `@` mentions with hover cards; multi-trigger support to confirm. |
| Global search | Present | `modules/jmh/GlobalSearch.tsx` uses DAO search endpoints; results grouping exists, but entrypoint wiring pending. |
| Help content | Present | Markdown topics under `content/help/`. Need right-pane integration and onboarding references. |
| VS Code tasks | Present | `.vscode/tasks.json` defines Dev/Build/Migrate commands. |
| Continuous integration | Missing | No workflows under `.github/workflows/`; CI pipeline not configured yet. |

## Desktop workspace generated assets

| Path | Producer | Notes |
| --- | --- | --- |
| `apps/desktop/test-results/` | Playwright & WebdriverIO | Stores `.last-run.json`, traces, and WebdriverIO logs after UI runs. Clean with `rm -rf apps/desktop/test-results`. |
| `apps/desktop/node_modules/.playwright/` | Playwright | Bundled browser binaries downloaded by `npx playwright install`; already covered by the `node_modules/` ignore rule. |
| `apps/desktop/coverage/` | Vitest | Created by `npm run test:coverage`; contains HTML/LCOV reports and should be blown away between runs. |
| `apps/desktop/playwright-report/` | Playwright | Only appears when the HTML reporter is enabled locally; safe to delete. |
| `apps/desktop/app.db` & `apps/desktop/*.sqlite*` | SQLite-backed features | Frontend DAO loads `app.db` via sql.js, generating SQLite cache files alongside `*-journal`, `*-shm`, and `*-wal` companions during tests. |

These paths are ignored in the root `.gitignore` and `apps/desktop/.gitignore` so contributors do not accidentally commit local test artifacts.
