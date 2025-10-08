# Acceptance Checklist — Jumpchain Nexus Hub

- [x] **FTS5 search** — `searchNotes` / `searchFiles` now use `MATCH` with `bm25()` ordering and prefix queries, feeding the Global Search header to jump directly into notes or PDFs.
- [x] **PDF ingestion** — `pdf-worker.ts` streams page text, while `indexFileText` updates the `files` table so FTS triggers refresh `file_fts`; the `PdfViewer` toolbar still highlights finds and warns on empty pages.
- [x] **TipTap mentions** — Story Studio advertises `@perk`, `@item`, and `@companion` triggers; hover cards pull entity summaries for linked mentions.
- [x] **Jump Memory Hub shell** — Nav rail, timeline virtualization, pinned next-actions, onboarding wizard, and the toggleable help pane all render within the new hub layout.
- [x] **VS Code tasks** — `.vscode/tasks.json` describes Dev (Vite), Dev (Tauri), Migrate DB, and Build (Tauri) runs with guidance text for quick execution.
