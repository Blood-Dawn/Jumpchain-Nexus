# Changelog

## [Unreleased]
### Changed
- Lazy-load pdf.js for the desktop PDF viewer and importer so the base UI bundle excludes heavy reader code until it is needed.

### Removed
- Dropped the unused `jszip` dependency from the desktop workspace to slim the install footprint.

### Developer Notes
- Run `npm install` from the repository root after pulling to sync the workspace lockfile, then reinstall Playwright browsers on demand with `npx playwright install --with-deps` if you rely on the optional E2E stack.
