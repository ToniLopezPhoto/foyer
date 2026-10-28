# Contributing to Foyer

Thanks for helping make Foyer better. Foyer is a small, dependency-free Obsidian plugin: plain JavaScript and CSS, with no build step.

## Setup

1. Create or pick a test vault. Do not develop against your real vault.
2. Clone the repository into the vault's plugins folder:

   ```bash
   git clone https://github.com/ToniLopezPhoto/foyer.git <your-test-vault>/.obsidian/plugins/foyer
   ```

3. Open the test vault in Obsidian (1.8.7 or newer) and enable **Foyer** in **Settings → Community plugins**.
4. After editing `main.js` or `styles.css`, reload the plugin (or Obsidian) to see the change.

You need [Node.js](https://nodejs.org/) 20 or newer for the checks. Node is only used to check and test the plugin; nothing is built or bundled.

## Checks

Run both before opening a pull request:

```bash
node --check main.js
node --test tests/*.test.cjs
```

These are the same checks that CI runs on every pull request. CI also verifies that `versions.json` has an entry for the `manifest.json` version whose value equals `minAppVersion`, and that the diff has no whitespace errors (`git diff --check`).

## Conventions

- **Dependency-free.** No runtime dependencies and no build step. `main.js`, `styles.css` and `manifest.json` are the plugin.
- **Theme-native styling.** Use Obsidian's CSS variables (for example `--text-normal`, `--background-primary`, `--interactive-accent`) instead of hard-coded colors, so Foyer follows the active theme in light and dark modes.
- **Bilingual interface.** Every user-facing string lives in `STRINGS` in `main.js`, in both `en` and `es`. Do not add a string to only one language.
- **Tests with every behavior change.** Add or update a test in `tests/` for each behavior change or bug fix. Write the failing test first when you can.
- **Conventional Commits.** Use messages such as `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...` or `ci: ...`. Keep each commit to one reviewable change, with its tests and docs.
- **Releases.** Maintainers bump `version` in `manifest.json`, add the matching entry to `versions.json`, and update [CHANGELOG.md](CHANGELOG.md). Contributors do not need to do this.

## Translations welcome

Foyer ships in English and Spanish today. Translations into other languages are welcome and are planned for a future release. If you would like to help, open an [issue](https://github.com/ToniLopezPhoto/foyer/issues) to say which language you can cover. The strings to translate are in `STRINGS` in `main.js`.

## Reporting issues

Bug reports and ideas are welcome in [GitHub Issues](https://github.com/ToniLopezPhoto/foyer/issues). Please include your Obsidian version, the platform (desktop or mobile), and the steps to reproduce.
