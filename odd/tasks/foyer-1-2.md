# Foyer 1.2 — pinned notes, Recents management, new commands

## Objective

Ship Foyer 1.2: let people keep a few notes always at hand (Pinned), tidy the Recent list without deleting anything, and drive Foyer from the command palette. Foyer stays "a place to begin, not a dashboard": no widgets, no feeds, no network.

## Problem

- Recent only reflects what was opened last. Notes people return to every day drop out of it as soon as they open eight others.
- A note that should not be there (a private draft, a one-off file) cannot be removed from Recent.
- There is no command to clear the per-device history, and no way to reach the Foyer search without the mouse.

Roadmap context: 1.2 (this), 1.3 (greeting options, Recents grouped by date, random hero image), 1.4 (strings for community translations).

## Scope and constraints

- In scope: `main.js`, `styles.css`, `README.md`, `CHANGELOG.md`, `manifest.json`, `versions.json`, tests and the test fake in `tests/support/load-main.cjs`.
- Out of scope: push, PR, tag, release; anything planned for 1.3 / 1.4.
- Decided by the user: pinned notes live in `data.json` (settings) so they sync across devices; the open history stays per-device in local storage (`foyer-open-history`), as today.
- Dependency-free, no build step. `main.js` comments in Spanish, docs and commits in English, README keeps its Spanish section. Every UI string exists in `en` and `es`. Colors only through Obsidian theme CSS variables.

### Design decisions (made here, within the brief)

- Pinned paths are stored as `pinned: string[]` (order = the order they were pinned; newest last, shown in that order). No cap.
- `normalizeSettings` keeps only non-empty strings, removes duplicates, and falls back to `[]` for anything that is not an array.
- Pinned paths are not pruned at startup, only on rename/delete events (a note pinned on another device may not have synced yet). The view skips missing, hidden or excluded files at render time, like Recent does.
- Pinned and Recent are one listbox (`recentEl`): the section headings sit inside it as presentational elements, so `aria-controls` / `aria-activedescendant` keep working and arrow keys run Pinned then Recent.
- Pinned notes are excluded from Recent before the Recent limit is applied. If Recent ends up empty only because everything is pinned, the Recent section is omitted instead of claiming nothing was opened.
- Removing a Recent row (✕ or `Delete`) and "Clear Recent history" only touch the per-device history; they never delete files. The fallback to Obsidian's `getLastOpenFiles` (used when the history resolves to nothing) must not resurrect removed or cleared notes, so removed/cleared fallback paths are remembered in memory for the session.
- Pinned rows have no ✕ (unpin through command or file menu); `Delete` on a selected pinned row does nothing.

## TDD

- Mode: strict TDD enabled (source: user global instructions and the task brief). Runner: `node --test tests/*.test.cjs`.
- Each behavior change gets a RED test observed against the old code first, then GREEN, then refactor. RED/GREEN evidence is recorded under Progress.
- Checks at every task close: `node --check main.js`, the full test suite, `git diff --check`.

## Delivery

- Branch: `claude/foyer-1-2-abe24f`, started from `chore/foyer-1-1-2-listing` (PR #12, to be merged first by the maintainer).
- One Conventional Commit per task, each ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Delivery strategy: `ask-on-risk`.
- Forecast: ~900 authored changed lines including tests, well beyond the ~400 guide. Where I would split into chained PRs is recorded at the end of Progress.
- Push, PR, tag and release stay the user's decision.

## Tasks

| ID | Task | Route | Trigger evidence |
|---|---|---|---|
| T1 | Pinned notes: settings, plugin API, rename/delete, commands, file menu | inline | 1 source file + 1 test file, understood after reading `main.js` and the fake |
| T2 | Pinned section in the view: render, one-listbox keyboard navigation, Recent exclusion, CSS | inline | same files, depends on T1 |
| T3 | Recents management: ✕ button, `Delete` key, "Clear Recent history" command and settings button | inline | same files, depends on T2 |
| T4 | Commands "Focus Foyer search" and "Open Foyer in a new tab" | inline | small, two commands + tests |
| T5 | Docs and version 1.2.0 | inline | docs and 2 JSON lines; no research needed |

Route note: the writer trigger (2+ non-trivial files) would fire for T3; I kept every task inline because the tasks are sequential edits to the same two files (`main.js`, tests) and a second writer would only add handoff cost. Recorded so the skip is visible.

### T1 — Pinned notes: model and commands
- [x] RED: `normalizeSettings` returns `pinned` as a clean list (invalid values give `[]`, duplicates and non-strings dropped); `DEFAULT_SETTINGS.pinned` is `[]`.
- [x] RED: plugin `pinFile` / `unpinFile` / `isPinned` persist through `saveData` and never touch the open history.
- [x] RED: vault `rename` moves pinned paths (file and folder prefix); `delete` drops them; both save once.
- [x] RED: commands "Pin current note to Foyer" / "Unpin current note from Foyer" use `checkCallback` (shown only when they apply, act only when not checking).
- [x] RED: `file-menu` adds a single pin or unpin item for listed files only.
- [x] GREEN: `pinned` in `DEFAULT_SETTINGS` / `normalizeSettings`; helpers `renameInPinned`, `deleteFromPinned`; plugin methods; commands; `file-menu` handler; strings `en` + `es`.
- Acceptance: pinned notes sync through `data.json`, history untouched, strings in both languages.

### T2 — Pinned section in the view
- [x] RED: with pinned notes, the listbox shows a "Pinned" heading and rows above "Recent"; hidden when empty.
- [x] RED: pinned notes do not appear again in Recent and the Recent limit still applies to Recent.
- [x] RED: ↑/↓ with an empty search box walk Pinned then Recent as one list; ARIA ids stay unique and `aria-activedescendant` follows.
- [x] RED: Enter opens a selected pinned row; the view refreshes when pinned changes.
- [x] GREEN: `getPinnedFiles`, `renderRecent` renders both sections into `recentEl`; CSS for the heading; existing test helpers adapted to ignore headings.
- Acceptance: existing recents-keyboard and settings tests stay green without behavior edits.

### T3 — Recents management
- [x] RED: hover ✕ button on a Recent row (accessible label) removes only its history entry and re-renders; the file is untouched.
- [x] RED: `Delete` on the selected Recent row removes it and keeps a sensible selection; no-op on pinned rows and while searching.
- [x] RED: fallback rows from `getLastOpenFiles` do not come back after removal / clear.
- [x] RED: "Clear Recent history" command empties the history, persists locally, shows a `Notice`; settings button does the same.
- [x] GREEN: plugin `removeFromHistory` / `clearHistory`; view button and key; command; settings button; strings; CSS.
- Acceptance: no code path calls `vault.delete`, `trash` or similar.

### T4 — Focus and new-tab commands
- [x] RED: "Focus Foyer search" focuses the input of the active Foyer, opens Foyer first when it is not active.
- [x] RED: "Open Foyer in a new tab" always opens a new Foyer tab (does not reuse the existing one).
- [x] GREEN: `focusSearch()` and `openHomeInNewTab()` on the plugin, commands, strings.

### T5 — Docs and version
- [x] README (English + Spanish): "What's new in 1.2", keyboard shortcut table.
- [x] `CHANGELOG.md` `[1.2.0]`; `manifest.json` 1.2.0; `versions.json` `"1.2.0": "1.8.7"`.
- Acceptance: the release workflow's tag check and the CI manifest/versions check would pass for tag `1.2.0`; JSON parses; `git diff --check` clean.

## Progress

- Plan written before any code. Branch starts from `af603dc`.
- T1 done. RED: new `tests/pinned.test.cjs` (22 tests) against the old `main.js`: 4 pass (vacuous) / 18 fail (full suite 139 pass / 18 fail). GREEN: full suite 157 pass / 0 fail; `node --check main.js` ok; `git diff --check` clean. Refactor: `renameInPinned` rewritten as a plain loop. Note: the vault `rename`/`delete` handlers now also persist `pinned` through `updateSetting` (they became async).
- T2 done. RED: new `tests/pinned-view.test.cjs` (18 tests) + `tests/support/view-fixture.cjs` against the old view: 1 pass / 17 fail (full suite 158 pass / 17 fail). GREEN after `renderRecent` / `renderSection` / `renderRow`: 16 older recents tests failed only because `recentRows` took every child of the listbox; the helper in `tests/recents-keyboard.test.cjs` now keeps `role="option"` children (headings moved inside the listbox) with no assertion changed. Full suite 175 pass / 0 fail; `node --check main.js` ok; `git diff --check` clean. Decision implemented: the Obsidian fallback only kicks in when the history resolves to no file at all, even if all of it is pinned.
- T3 done. RED: new `tests/recents-management.test.cjs` (15 tests, plus `tests/support/plugin-fixture.cjs` extracted from the pinned tests) against the old code: 1 pass / 14 fail (full suite 176 pass / 14 fail). GREEN: full suite 190 pass / 0 fail; `node --check main.js` ok; `git diff --check` clean. Decision refined while implementing: rows that come from the Obsidian fallback also get the ✕ (it works through the in-memory `dismissedRecent` set, so they do not come back); `Delete` and ✕ keep the selection on the row that takes the removed row place. No code path calls vault delete or trash.
- T4 done. RED: new `tests/commands.test.cjs` (7 tests; `createPluginFixture` gained a `workspace` override) against the old code: 0 pass / 7 fail, failures are the missing commands/strings. GREEN: full suite 197 pass / 0 fail; `node --check main.js` ok; `git diff --check` clean. `focusSearch` reuses `openHome` only when no Foyer view is active; `openHomeInNewTab` always creates a tab with `getLeaf("tab")`.
- T5 done. Docs only, no RED applicable (docs and metadata): README EN + ES (What's new in 1.2, features, shortcut table with Delete, new Commands table, settings row, privacy note that pinned paths live in data.json), CHANGELOG [1.2.0] with compare link, `manifest.json` 1.2.0, `versions.json` `"1.2.0": "1.8.7"`. Simulated the release.yml tag check for tag `1.2.0`: tag equals manifest version, versions.json has the key, value equals minAppVersion (also the CI check). Checks: `node --check main.js` ok; full suite 197 pass / 0 fail; `git diff --check` clean; manifest and versions parse as JSON. The [1.2.0] date is 2026-10-28 (today); change it if the release ships on another day.
