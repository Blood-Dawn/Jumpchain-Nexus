# Legacy WPF Solution (Archive Only)

This folder stores the unmaintained Windows Presentation Foundation solution that originally powered Jumpchain Nexus.

- **Status:** Archived for historical reference. There is no active development planned for the WPF client.
- **Coverage:** Only the Visual Studio solution file is retained here to help with migrations or file format inspection. The corresponding project files remain in the upstream Age-Of-Ages repository.
- **Support:** Issues discovered in this legacy client are not tracked. Contributors should focus on the Tauri + React desktop rewrite under `apps/desktop`.

When cloning or packaging the modern application, exclude this folder; it is not part of the build graph and is ignored by npm publishing via the `.npmignore` rule at the package root.
