# Changelog

All notable changes to Foyer are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2026-10-28

### Changed

- The plugin description in the Obsidian Community directory now says what Foyer does: a calm home page for new tabs with fuzzy search, recently opened notes and a personal greeting, private and offline.
- The README starts the installation instructions with the Obsidian Community directory, including a direct `obsidian://show-plugin?id=foyer` link. BRAT and manual installation remain available as alternatives.

### Fixed

- The search box placeholder ends in a single ellipsis (`Search the vault…`, `Buscar en el vault…`) instead of four dots.

### Added

- This changelog and a contributing guide ([CONTRIBUTING.md](CONTRIBUTING.md)).

## [1.1.1] - 2026-10-17

### Added

- Release files (`main.js`, `manifest.json`, `styles.css`) are published with GitHub build provenance attestations, so you can verify they were built from this repository. This applies to releases published from 1.1.1 on.

### Changed

- The README explains how Foyer lists your vault files to power search, and that it does not read the contents of your notes for this.

No change in plugin behavior.

## [1.1.0] - 2026-10-17

### Added

- Settings to choose whether Foyer opens at startup, whether it replaces empty new tabs, and how many recent notes and search results are shown (3 to 20 each).
- Keyboard navigation through the recent notes list when the search box is empty.
- Search matches frontmatter `aliases`.
- Notes can be created inside folders by typing a path such as `Projects/Ideas/Plan`; missing folders are created.
- The search box and its results follow the combobox and listbox pattern for screen readers, and search results show Obsidian's hover preview.

### Changed

- Recent notes follow the history of notes you opened, kept per device and outside `data.json` so it does not sync or cause sync conflicts.
- Search skips notes hidden by Obsidian's **Excluded files**, prefers recently opened notes when names tie, and stays fast on large vaults.

### Fixed

- Typing `idea.md` opens or creates `idea.md` instead of `idea.md.md`.
- The date and greeting update while Foyer stays open, for example when the time of day changes.

## [1.0.1] - 2026-10-17

### Fixed

- Opening a note from Foyer keeps the right tab active when Obsidian's tab deduplication redirects the note to a tab that is already open.

## [1.0.0] - 2026-10-12

### Added

- Home page that replaces empty new tabs and opens when Obsidian starts.
- Fuzzy search over note titles and paths, with keyboard shortcuts: `Enter` opens the note, `Ctrl/Cmd + Enter` opens it in a new tab, and `Shift + Enter` searches note content with Obsidian's core Search plugin.
- Quick note creation when a query does not match an existing note, in your vault's default location for new notes.
- Recent notes based on when you actually opened them, not on when they were last edited, with relative timestamps.
- Greeting that changes with the time of day, with an optional name.
- Hero image picked from the vault or uploaded from your computer (PNG, JPEG, GIF, WebP, AVIF, BMP), with a theme-colored symbol when no image is set.
- Appearance inherited from the active Obsidian theme, in light and dark modes, with English and Spanish interface languages.

[1.1.2]: https://github.com/ToniLopezPhoto/foyer/compare/1.1.1...1.1.2
[1.1.1]: https://github.com/ToniLopezPhoto/foyer/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/ToniLopezPhoto/foyer/compare/1.0.1...1.1.0
[1.0.1]: https://github.com/ToniLopezPhoto/foyer/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/ToniLopezPhoto/foyer/releases/tag/1.0.0
