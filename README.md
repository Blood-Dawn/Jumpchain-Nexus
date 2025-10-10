# Jumpchain Nexus
## A new way to build, manage, and narrate your Jumpchain.

## Overview
Jumpchain Nexus (formerly the Jumpchain Character Builder) is a full lifecycle toolkit for running a Jumpchain: planning Jumps, budgeting and tracking purchases, managing companions, modeling supplements (Body Mod, Warehouse, Drawback systems), exporting builds, analyzing statistics, randomizing future Jumps, and now outlining the evolving story of your chain. Beyond structured data entry, the project's modern (Tauri + React) desktop rewrite introduces note & narrative scaffolding (onboarding prompts, markdown notes, perk mention indexing) so you can progressively develop a cohesive in-universe chronicle while you build. The classic WPF application automates repetitive bookkeeping (discounts, freebies, stipends, point banking, investment ratios, incremental supplement gains) so you can focus on creative and strategic decisions instead of manual recalculation.

The goal remains: minimize friction, surface insight, and preserve flexibility. If something does not fit your workflow, feel free to open feedback—no guarantee of adoption, but all signals are noted.

Jumpchain Nexus is now maintained by the Jumpchain Nexus maintainers (2025-present), continuing the lineage established by Age-Of-Ages.

## Credits & Attribution
Jumpchain Nexus is a continuation and adaptation of the original Jumpchain Character Builder by Age-Of-Ages. Core ideas, early data structures, and foundational workflows were inspired by (and in some cases ported from) that codebase.

- Maintained by the Jumpchain Nexus maintainers (2025-present).

Original repository: https://github.com/Age-Of-Ages/JumpchainCharacterBuilder

Additional acknowledgments:
- TobiasCook (Reddit): Originator of the early spreadsheet lineage that sparked later tooling.
- He_Who_Writes (Reddit): Expanded spreadsheet and early "skill" concept experimentation.

Thanks to the broader Jumpchain community for patterns, export formats, and category conventions reflected in configuration options.

## Contributing to the new desktop app
A Tauri + React rewrite lives in `apps/desktop`. A portable Node.js runtime is vendored under `tools/node/node-v22.12.0-win-x64`. Use the wrapper scripts at the repo root (`node.cmd`, `npm.cmd`, `npx.cmd`) so everyone targets the same toolchain.

From PowerShell (repository root):
```powershell
.\npm.cmd install
.\npm.cmd run dev        # launches the React + Tauri dev environment
.\npm.cmd run build      # production web build (Tauri bundling uses tauri:build)
.\npm.cmd run tauri:dev  # native shell with live reload
.\npm.cmd run tauri:build
```
Migration & DB scripts (SQLite via `@tauri-apps/plugin-sql`):
```powershell
.\npm.cmd run migrate
```
See `apps/desktop/README.md` (if present) for module details, schema evolution, and test commands.

## Feature List
1. Jumpchain Overview
   - Full storage of all Jumps and their builds.
   - Origin, Location, Species, Age, Gender, and custom Origin detail tracking.
   - Per-character Purchases, Drawbacks, Scenarios, Companion Imports.
   - Automated freebies/discounts based on Origin + threshold rules.
   - Purchase trait attributes feeding Passport stat & skill aggregation.
   - Gauntlet flag and per-Jump skip-number logic for supplement pacing.
2. Cosmic Passport
   - Complete character profile data: biography, physical & personality notes.
   - Alt-Forms list with strengths/weaknesses.
   - Aggregated Perks & Items auto-synchronized from all Jumps.
   - Attributes / Skills ranking + Booster tracking & derived calculations.
   - Body Mod linkage (generic, SB Body Mod, Essential Body Mod) with per-character supplement delays.
3. Cosmic Warehouse
   - Generic Warehouse or Personal Reality modes (core modes, incremental, unlimited, patient jumper, investment calculus).
   - Addons, Limitations, point investment & incremental gain modeling.
4. Cosmic Locker
   - Consolidated Item inventory (mirrors perk-style categorization & export grouping).
5. Drawback Supplement
   - Multiple supplement frameworks (Generic, UDS, UU) including suspend & revoke timelines, gauntlet rules, and point channel segmentation (Companion, Item, Warehouse).
6. Export
   - Build, Profile, Warehouse, Body Mod, Drawback Supplement export in Generic text, BBCode, or Markdown.
   - Reorderable sections, optional spoilers, per-mode formatting toggles, budget formatting variants.
   - Companion build inclusion, origin description controls, attribute & category selective output.
7. Statistics
   - Global and per-character spend/earn summaries, perk vs item point splits, drawback/scenario yields.
   - Category breakdowns, augmentation & addon tallies, point bank deltas.
8. Jumpchain Options
   - Global defaults (budgets, stipends, freebie thresholds, discount mode).
   - Point banking toggles (gauntlet access, shared supplemented Jump bank, companion bank caps).
   - Supplement selection + per-supplement tuning (investment ratios, incremental intervals, delays, modes).
   - User-defined perk & item categories with reorder and rename validations.
9. Input Formatter
   - Cleans PDF-origin text (line break normalization, double-line preservation toggle, whitespace trimming, XML-safe filtering).
10. Jump Randomizer
   - Weighted list management from a normalized text file (`JumpList.txt`).
   - Multi-pull selection without replacement, optional link association, template regeneration safeguards.
11. Narrative & Notes (Tauri rewrite)
   - Onboarding workflow seeds a Jump, associated note, default actions, and perk entities.
   - Markdown note storage (TipTap/ProseMirror based editor pipeline) enabling incremental story building.
   - Mention-ready perk insertion & future-ready for cross-linking narrative beats to mechanical state.
12. Point Banking & Investments
   - Configurable per-character banking with withdrawal constraints, gauntlet gating, and supplemented Jump sharing.
   - CP -> WP / BP / supplement investment ratios with incremental & capped modes (Unlimited / Access tiers / cumulative variants).

(Other features from earlier versions persist unless explicitly deprecated.)

## Use Instructions
### Download (Prebuilt)
Navigate to Releases and download the latest `JumpchainNexus.zip` (name may still appear as legacy until release naming is fully migrated). Extract and run the WPF executable (e.g., `JumpchainNexus.exe`). If Windows SmartScreen warns, choose "More Info" then "Run Anyway" or unblock via File Properties.

### Running Source (WPF)
> [!NOTE]
> The WPF project is considered legacy/reference-only. It remains in the repository for historical parity and migration support, but active development is focused on the modern Tauri desktop client.

Prerequisites: .NET 8 SDK (Windows). From repo root:
```powershell
dotnet restore
dotnet build
# Optionally:
dotnet run --project JumpchainCharacterBuilder/JumpchainCharacterBuilder.csproj
```
The WPF project remains under the original `JumpchainCharacterBuilder` folder pending full namespace remap.

### Running Source (Tauri + React)
Use the bundled Node runtime wrappers (do NOT rely on a different system Node to avoid drift):
```powershell
.\npm.cmd install
.\npm.cmd run dev          # web + rust dev
.\npm.cmd run tauri:dev    # native shell variant
```
Build production bundle:
```powershell
.\npm.cmd run tauri:build
```
Run DB migrations (idempotent):
```powershell
.\npm.cmd run migrate
```

### Saving & Backups
Saves are XML files in `Saves/`. On overwrite, up to 10 rolling backups are maintained in `Backups/` (`(1)` oldest ? rotated). Use "Save As" for branching timelines.

### Randomizer Lists
`JumpList.txt` regenerates with a template if missing. Edit via UI where possible—manual edits must preserve `JumpName | Weight | Link` format under `[Section]` tags.

## Technology Stack
### Legacy / Classic App (WPF)
- .NET 8 (Windows), WPF MVVM
- CommunityToolkit.Mvvm 8.2.0 (INPC / Commands / Messaging)
- Microsoft.Extensions.DependencyInjection 8.0.0 (DI container)
- XML DataContract serialization for `SaveFile`

### Modern Desktop (Tauri + React)
- React 19 + Vite + TypeScript 5
- State / Data: Zustand, TanStack Query
- Rich Text / Notes: TipTap (ProseMirror) + Mention extension
- Markdown parsing: `marked`
- PDF placeholder (future indexing): `pdfjs-dist`
- Packaging + Native Bridges: Tauri 2, plugins (dialog, fs, sql, opener)
- Local DB: SQLite via `@tauri-apps/plugin-sql` + migration scripts
- Utility: `jszip`, `zod` validation, `react-window` virtualization
- Rust Crate Dependencies: `tauri`, `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-sql`, `serde`, `serde_json`

## Dependencies Summary (Top Level)
WPF NuGet:
- CommunityToolkit.Mvvm (MIT)
- Microsoft.Extensions.DependencyInjection (MIT)

Node / Rust (Desktop rewrite): see `apps/desktop/package.json` & `Cargo.toml` for authoritative versions (locked via repository toolchain).

## Export Formats
All export modes generate plain text artifacts into `Exports/` subfolders. Section ordering & inclusion are controlled via `Options -> Export Settings`. Budget formatting variants (enclosure, order reversal, separator character) allow alignment with common community style conventions (BBCode spoilers, Markdown headings, dense list mode).

## Security Notes
- XML loading forbids DTD processing and nulls the resolver to mitigate XXE vectors.
- Rolling backups prevent silent corruption on abrupt save interruption.
- No external network calls are made by the WPF app during normal operation.

## Roadmap (Indicative / Non-Contractual)
- Unified domain core shared between WPF and Tauri front ends.
- Enhanced narrative linking (entity references, timeline synthesis, quest chains).
- PDF ingestion & structured perk parsing (opt-in pipeline).
- Modular plugin surface for custom supplement schemas.

## License
MIT License applies to derivative and original portions unless a subcomponent specifies otherwise.

## Previous Name
If you encounter references to "Jumpchain Character Builder" in folders or class namespaces, they persist for backward compatibility and will be gradually refactored.
