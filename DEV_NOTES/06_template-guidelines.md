# Studio Template Guidelines

The Studio editor now supports inserting narrative templates directly into the TipTap canvas. When adding or updating templates, keep the following guardrails in mind:

## Location & format

- Store templates in `apps/desktop/src/modules/studio/templates/`.
- Extend the `studioTemplates` array in `index.ts`. Each template must provide an `id`, human-friendly `title`, `description`, and a TipTap-compatible JSON structure in `content`.
- Use the helper factories (e.g., `heading`, `paragraph`, `bulletList`) or provide raw `JSONContent` nodes. Templates should be expressed as arrays of block nodes so they insert cleanly beside existing prose.

## Content best practices

- Keep descriptions short (≤ 100 characters) so they render well inside the sidebar.
- Favor high-level prompts over finished prose; users should be encouraged to adapt the sections.
- When introducing new structural conventions (e.g., new heading hierarchy), update accompanying documentation and tests if behaviour changes.
- Validate that template content renders in TipTap by running `npm run test -- templates` from `apps/desktop` or `npm run test` to execute the full Vitest suite.

## Testing additions

- New templates should be accompanied by unit coverage that exercises any new insertion helpers or behaviours.
- Avoid brittle HTML assertions—prefer checking the editor's text content or node tree to confirm expected placement.
- When templates rely on new TipTap extensions, register them in `StudioEditor` *before* using the template in production code.
