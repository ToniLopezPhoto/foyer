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
| T6 | Pinned section becomes a reorderable sticky-note board (added after the user tested T1–T5 in a real vault) | inline, 6 sequential work units (T6.1–T6.6) | same two source files plus tests; each unit builds on the previous one |

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

### T6 — Sticky-note board for Pinned (requested after the first delivery)

Settled with the user (not reopened): square 1:1 cards with a deterministic ±1–2° tilt from a hash of the path, soft shadow, folded corner, straighten and lift on hover or selection, `prefers-reduced-motion` respected; the card shows only the note title and folder (note content is never read); optional color from the theme palette (`--color-*`, tint through `--color-*-rgb`), none = neutral card; right-click `Menu` with Open, Open in new tab, a Color submenu and Unpin; the color is stored with the pin (`pinned: [{ path, color }]`, and `normalizeSettings` still accepts the plain `string[]`); responsive grid (`auto-fill` / `minmax`, 2 columns on mobile), only the order is stored; reorder by dragging with pointer events (≈300 ms long press on touch, FLIP animation, persisted on drop) and `Alt+←/→/↑/↓` with an `aria-live` announcement; ↑/↓, Enter, the unpin ✕ and the hover preview keep working.

Design decisions made here:
- Entries are always written as objects `{ path, color }` (color is one of the eight palette names or an empty string). Invalid entries are dropped, duplicates keep the first, unknown colors become "none".
- Reordering works on the visible cards: hidden entries (not synced yet, excluded) keep their slots, so a drag never loses a pin (`reorderPinned`).
- `Alt+←/↑` moves the selected card one place earlier and `Alt+→/↓` one place later. A grid-aware row jump for `Alt+↑/↓` would need layout measurements; one place keeps it predictable.
- The board sits inside the same single listbox (`recentEl`) as presentational wrapper, so the combobox ARIA and the linear ↑/↓ navigation are unchanged. Cards have an unpin ✕ on hover (there was no unpin button before T6).
- A long press on touch that ends without moving opens the context menu (otherwise the menu would be unreachable on touch, because the long press starts the drag).
- While a drag is active, renders are deferred until the drop.

| Unit | Content |
|---|---|
| T6.1 | Data model: `pinned: [{ path, color }]` normalization (both schemas), `setPinColor`, `reorderPinned`, `cardTilt` helper; existing pinned tests updated for the new shape |
| T6.2 | Board render: grid of cards (title, folder, folded corner, unpin ✕, color class, tilt), CSS |
| T6.3 | Context menu: Open, Open in new tab, Color submenu, Unpin |
| T6.4 | Keyboard reorder (`Alt+arrows`) with `aria-live` announcement |
| T6.5 | Pointer-events drag and drop (mouse and touch long press) with FLIP, persisted on drop |
| T6.6 | README and CHANGELOG 1.2.0 describe the board; evidence and commits recorded |

## Progress

- Plan written before any code. Branch starts from `af603dc`.
- T1 done. RED: new `tests/pinned.test.cjs` (22 tests) against the old `main.js`: 4 pass (vacuous) / 18 fail (full suite 139 pass / 18 fail). GREEN: full suite 157 pass / 0 fail; `node --check main.js` ok; `git diff --check` clean. Refactor: `renameInPinned` rewritten as a plain loop. Note: the vault `rename`/`delete` handlers now also persist `pinned` through `updateSetting` (they became async).
- T2 done. RED: new `tests/pinned-view.test.cjs` (18 tests) + `tests/support/view-fixture.cjs` against the old view: 1 pass / 17 fail (full suite 158 pass / 17 fail). GREEN after `renderRecent` / `renderSection` / `renderRow`: 16 older recents tests failed only because `recentRows` took every child of the listbox; the helper in `tests/recents-keyboard.test.cjs` now keeps `role="option"` children (headings moved inside the listbox) with no assertion changed. Full suite 175 pass / 0 fail; `node --check main.js` ok; `git diff --check` clean. Decision implemented: the Obsidian fallback only kicks in when the history resolves to no file at all, even if all of it is pinned.
- T3 done. RED: new `tests/recents-management.test.cjs` (15 tests, plus `tests/support/plugin-fixture.cjs` extracted from the pinned tests) against the old code: 1 pass / 14 fail (full suite 176 pass / 14 fail). GREEN: full suite 190 pass / 0 fail; `node --check main.js` ok; `git diff --check` clean. Decision refined while implementing: rows that come from the Obsidian fallback also get the ✕ (it works through the in-memory `dismissedRecent` set, so they do not come back); `Delete` and ✕ keep the selection on the row that takes the removed row place. No code path calls vault delete or trash.
- T4 done. RED: new `tests/commands.test.cjs` (7 tests; `createPluginFixture` gained a `workspace` override) against the old code: 0 pass / 7 fail, failures are the missing commands/strings. GREEN: full suite 197 pass / 0 fail; `node --check main.js` ok; `git diff --check` clean. `focusSearch` reuses `openHome` only when no Foyer view is active; `openHomeInNewTab` always creates a tab with `getLeaf("tab")`.
- T5 done. Docs only, no RED applicable (docs and metadata): README EN + ES (What's new in 1.2, features, shortcut table with Delete, new Commands table, settings row, privacy note that pinned paths live in data.json), CHANGELOG [1.2.0] with compare link, `manifest.json` 1.2.0, `versions.json` `"1.2.0": "1.8.7"`. Simulated the release.yml tag check for tag `1.2.0`: tag equals manifest version, versions.json has the key, value equals minAppVersion (also the CI check). Checks: `node --check main.js` ok; full suite 197 pass / 0 fail; `git diff --check` clean; manifest and versions parse as JSON. The [1.2.0] date is 2026-10-28 (today); change it if the release ships on another day.
- Commits: plan `f48a6f4`; T1 `07e701d`; T2 `9b42dc6`; T3 `0127cc7`; T4 `a0654e3`; T5 `c53b671`.
- Size (insertions + deletions per commit, tests and docs included): T1 361, T2 368, T3 490, T4 154, T5 62, about 1,435 in total, well above the ~400 guide. About half of it is tests; `main.js` and `styles.css` account for about 320 of it.
- Where I would split into chained PRs (`feature-branch-chain` or `stacked-to-main`): PR 1 = T1 + T2 (Pinned: data, commands, section, ~730 incl. tests); PR 2 = T3 (Recents management, ~490, depends on the shared fixtures from PR 1); PR 3 = T4 + T5 (commands, docs and version bump, ~215). PR 3 is the one that must be merged last because it carries the 1.2.0 bump.
- Final checks on HEAD: `node --check main.js` ok; `node --test tests/*.test.cjs` 197 pass / 0 fail (was 135 before this feature); `git diff --check` clean.
- Not done (user decision): push, PR, tag `1.2.0`, release. RDD assessment not run. The built-in browser / a real Obsidian vault was not used: behavior is verified through the fake Obsidian in `tests/support/load-main.cjs` only, and the new CSS (✕ button, second section heading) has not been looked at in a real theme.
- Open questions for the maintainer: (1) the `[1.2.0]` changelog date is 2026-10-28; (2) `dismissedRecent` is in memory only, so after a restart the Obsidian fallback could show a note removed earlier if the history is empty (rare: only when the history has no resolvable file); (3) no cap on the number of pinned notes.
- T6 planned (this section), before any T6 code. T5 (docs/version) stays open until T6.6 updates the README and CHANGELOG 1.2.0 entries.
- T6.1 done (data model). RED: existing pinned tests moved to the `{ path, color }` shape and new tests added (normalization of both schemas, `setPinColor`, `reorderPinned`, `cardTilt`, palette) before touching `main.js`: 209 tests, 169 pass / 40 fail. GREEN: 209 pass / 0 fail (two failures after the first run were a wrong rename in my new test and a stale assertion in `recents-management.test.cjs`, both fixed in the tests). `node --check main.js` ok; `git diff --check` clean. Entries are always saved as objects; the old `string[]` is still read.
- T6.2 done (board render). RED: `tests/pin-board.test.cjs` (15 tests; fake DOM `style.setProperty`; `view-fixture` helpers look through the board; fake plugin `unpinFile`) against the old row layout: 212 pass / 12 fail of 224. GREEN: 224 pass / 0 fail; `node --check main.js` ok; `git diff --check` clean. CSS: auto-fill/minmax(110px) grid (about 5 columns at the 600px page width, 2 on `.is-mobile`), `aspect-ratio: 1/1`, `--shadow-s` / `--shadow-l`, tint from `--color-*-rgb` over `--background-secondary`, folded corner, tilt from `--foyer-tilt`, reduced-motion block keeps the static tilt but drops transitions and lift. Not verified visually in a real theme.
- T6.3 done (context menu). RED: `tests/pin-menu.test.cjs` (12 tests; the fake gained `Menu`, `menus` and a `submenus` option for older Obsidian) against the board without a menu: 225 pass / 11 fail of 236. GREEN: 236 pass / 0 fail; `node --check main.js` ok; `git diff --check` clean. `showCardMenu` uses `Menu.setSubmenu()` and falls back to listing the colors in the main menu when it does not exist. Not verified in real Obsidian: how the Color submenu looks and whether `setSubmenu` is available on 1.8.7.
- T6.4 done (keyboard reorder). RED: `tests/pin-reorder-keyboard.test.cjs` (13 tests) against the board without the shortcut: 239 pass / 10 fail of 249. GREEN: 249 pass / 0 fail; `node --check main.js` ok; `git diff --check` clean. `Alt+←/↑` moves a card one place earlier, `Alt+→/↓` one later (no wrap, never into Recent); a second press while the save is pending is ignored; hidden entries keep their slot; a polite `role="status"` live region (outside the listbox) announces the new position in English or Spanish. Plain ↑/↓/Enter navigation re-tested after a move. Not verified with a real screen reader.
- T6.5 done (drag and drop). RED: `tests/pin-drag.test.cjs` (18 tests, with a simulated 4-column grid, recorded FLIP animations and the long-press timer; the fake DOM gained `insertBefore`, pointer capture and `matchMedia`/`reducedMotion`) against the board without dragging: 253 pass / 14 fail of 267. GREEN: 267 pass / 0 fail; `node --check main.js` ok; `git diff --check` clean. Behavior: mouse starts after 4 px, touch after a 300 ms long press (moving more than 10 px first is a scroll and cancels); the card follows the pointer, others slide with `element.animate` on the `translate` property (180 ms, skipped with reduced motion), the order is saved once on drop through `reorderPinned`, renders are deferred during a drag, `pointercancel` restores the board, the click that closes a drag is swallowed, and a long press released without moving opens the card menu. Not verified on a real device: touch scrolling vs dragging (non-passive `touchmove`), pointer capture, the feel of the animation, auto-scroll near the viewport edge (not implemented).
- T6.6 done (docs). README (What's new in 1.2, the Keep a few notes at hand feature, shortcut table, commands table, privacy line, Spanish section) and CHANGELOG [1.2.0] now describe the board, the card menu, drag and Alt+arrow reordering. No RED applicable (docs). Checks: `node --check main.js` ok; 267 pass / 0 fail; `git diff --check` clean; manifest 1.2.0 and versions `"1.2.0": "1.8.7"` unchanged and consistent.
- T6 commits: plan `5e3e108`; T6.1 `f356ecb`; T6.2 `f2a01bb`; T6.3 `54a4d89`; T6.4 `00d37a4`; T6.5 `1c0a3bf`; T6.6 `0768692`. Size (insertions + deletions, tests included): T6.1 261, T6.2 369, T6.3 239, T6.4 233, T6.5 531, T6.6 18, about 1,650 for T6 and about 3,100 for the whole feature. Updated PR split: PR 1 = T1 + T2 + T6.1 (pinned data model and list); PR 2 = T3 (Recents management); PR 3 = T6.2 + T6.3 + T6.4 (board, menu, keyboard); PR 4 = T6.5 (drag, the riskiest part, easy to review on its own); PR 5 = T4 + T5 + T6.6 (commands, docs, version bump, merged last). If the maintainer prefers fewer PRs, merge PR 3 and PR 4.
- T6 final checks on HEAD: `node --check main.js` ok; `node --test tests/*.test.cjs` 267 pass / 0 fail (135 before 1.2, 197 after T5); `git diff --check` clean. Not verifiable without a real Obsidian: the look of the cards in real themes (tint, shadow, fold, tilt), the Color submenu and `Menu.setSubmenu` on 1.8.7, touch behavior (long press, `touchmove` preventDefault vs page scroll, pointer capture), the feel of the FLIP animation, screen-reader output of the live region, and auto-scroll when dragging near the edge of the pane (not implemented). Decisions made here beyond the brief: unpin ✕ on cards (none existed before), long press released without moving opens the card menu on touch, `Alt+↑/↓` move one place (no row jump).
