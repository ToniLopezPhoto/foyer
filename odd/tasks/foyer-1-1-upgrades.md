# Foyer 1.1 upgrades

## Objective

Ship the improvements found in the post-1.0.1 audit: per-device history storage, configurable options, faster and better search, keyboard-navigable recents, accessibility, and small bug fixes.

## Problem

- `openHistory` is rewritten into `data.json` on every file open (2 s debounce), which churns sync tools (Syncthing, Obsidian Sync) and creates conflicts; the history is per device by nature.
- `CONFIG` (`openOnStartup`, `replaceNewTab`, `recentLimit`, `resultLimit`) is hardcoded; `replaceNewTab` clashes with other home-page plugins.
- `HomeView.updateResults` scans the whole vault, fuzzy-matches name and path, and fully sorts all matches on every keystroke.
- Search ignores frontmatter aliases, Obsidian "Excluded files", and recency.
- Recents come from Obsidian's short `getLastOpenFiles()` list; the 200-entry history is only used for timestamps.
- Recents are not keyboard navigable; results lack listbox/option ARIA; search results have no hover preview.
- Small bugs: typing `idea.md` creates `idea.md.md`; `/` cannot create notes in folders; greeting/date go stale while the view stays open; CI does not run `tests/`.

## Scope and constraints

- Single-file plugin, no build step: all runtime code stays in `main.js`, styles in `styles.css`.
- Public API of the Obsidian module only where possible; any private API (`metadataCache.isUserIgnored`, `internalPlugins`) must be feature-detected with a safe fallback.
- `minAppVersion` stays `1.8.7`. Mobile must keep working (`isDesktopOnly: false`).
- Both UI languages (`es`, `en`) must get every new string.
- Code comments follow the file's existing language (Spanish); tests and this document in English.
- Out of scope: pinning notes, "remove from recents", extra languages, a build pipeline.

## TDD

- Mode: strict TDD enabled (source: user global instructions).
- Runner: `node --test tests/*.test.cjs` (Node built-in test runner, no dependencies). Tests load `main.js` in a `vm` context with a stubbed `obsidian` module, following `tests/navigation.test.cjs`.
- Each task: observed RED, then GREEN, then REFACTOR.

## Delivery

- Branch: `feat/foyer-1-1-upgrades` (cut from `main` at `c9ea98c`).
- One work-unit commit (Conventional Commits) per task, tests and docs alongside the behavior. No push, PR, tag, or release without the user's decision.
- Forecast: about 900 authored changed lines (above the 400-line slice budget). Delivery strategy: `ask-on-risk`; chain strategy `stacked-to-main` (user decision): chained PRs, each based on the previous one, all ending in `main`. Slice boundaries are chosen from real per-task line counts; opening PRs still needs the user's go-ahead.
- Tasks run sequentially (all touch `main.js`), each in its own Claude session sharing this checkout.

## Tasks

| ID | Task | Model | Route | Depends on |
|---|---|---|---|---|
| T1 | Small bugs + CI tests | Haiku 5.5 | session, inline | — |
| T2 | Per-device history storage | Sonnet 5.5 | session, inline | T1 |
| T3 | Configurable options | Sonnet 5.5 | session, inline | T2 |
| T4 | Search performance | Sonnet 5.5 | session, inline | T3 |
| T5 | Search quality | Sonnet 5.5 | session, inline | T2, T4 |
| T6 | Recents, keyboard, accessibility | Sonnet 5.5 | session, inline | T2, T3 |
| T7 | Version 1.1.0 + README | Haiku 5.5 | session, inline | T1–T6 |

Route evidence: every task edits `main.js` plus at most a test file, `styles.css`, or `README.md`; the plan was prepared from a full read of `main.js`.

### T1 — Small bugs + CI tests
- [x] `createNote`: strip a trailing `.md` (case-insensitive) from the query; the "exact match" check in `updateResults` ignores it too.
- [x] `createNote`: `/` separates folders. Sanitize each segment, drop empty ones; when a folder is given, it is relative to the vault root (not the default new-note location); create missing folders with `vault.createFolder`.
- [x] Greeting and date refresh in the existing 30 s interval (no full re-render).
- [x] `.github/workflows/release.yml`: run `node --test tests/*.test.cjs` after the syntax check. (Ran as `node --test tests/*.test.cjs`: Node 22+ rejects a directory argument.)
- Acceptance: new tests cover each behavior; `node --test tests/*.test.cjs` and `node --check main.js` pass.
- Follow-up (done in the T2 commit): `parseNoteInput` drops `.` and `..` segments, so input like `../x` or `a/./b` cannot target paths outside the intended folder; tests added to `tests/create-note.test.cjs`.

### T2 — Per-device history storage
- [x] Store `openHistory` with `app.saveLocalStorage` / `app.loadLocalStorage` (per vault, per device) under a namespaced key, not in `data.json`.
- [x] One-time migration: if `data.json` still has `openHistory`, merge it into local storage (max timestamp per path) and save settings without it.
- [x] Keep rename/delete tracking and the 200-entry cap; keep a debounced write and flush on unload.
- [x] README "data" section describes where history now lives.
- Acceptance: tests prove opens never call `saveData`, migration merges and strips, rename/delete still update history.

### T3 — Configurable options
- [ ] Settings: "Open on startup" (toggle), "Replace new tabs" (toggle), "Recent notes" (number, 3–20), "Search results" (number, 3–20). Defaults match current behavior.
- [ ] Toggling "Replace new tabs" takes effect without reload (register/unregister the `layout-change` handler).
- [ ] Strings in `es` and `en`; README settings section updated.
- Acceptance: tests cover normalization of the new settings and the live toggle.

### T4 — Search performance
- [ ] Coalesce input to one search per animation frame (or ≤ 50 ms debounce) without delaying Enter (Enter uses up-to-date results).
- [ ] Cache the listed-files array; invalidate on vault `create`, `delete`, `rename`.
- [ ] When the new query extends the previous one, filter only the previous candidate set.
- [ ] Keep only the top `resultLimit` matches (bounded insertion) instead of sorting everything; ranking order unchanged.
- Acceptance: tests prove identical ranking to the previous algorithm on a fixture vault, cache invalidation, and narrowing; a simple timing test on ~50k synthetic files is reported (not asserted).

### T5 — Search quality
- [ ] Match frontmatter `aliases` (string or array) from `metadataCache`; show the matched alias with the file name.
- [ ] Hide files matched by Obsidian "Excluded files" when `metadataCache.isUserIgnored` exists.
- [ ] Recency boost from the open history as a tie-breaker ahead of `mtime`, without overriding name-vs-path priority.
- Acceptance: tests for alias matching, excluded-file filtering (with and without the API), and recency ordering.

### T6 — Recents, keyboard, accessibility
- [ ] Recents ordered by the plugin's open history (most recent first), falling back to `getLastOpenFiles()` when history is empty; limit from settings.
- [ ] With an empty query, ↑/↓/Enter (and Mod+Enter) navigate and open recents.
- [ ] ARIA: input `role="combobox"` with `aria-controls`/`aria-expanded`/`aria-activedescendant`; result and recent lists `role="listbox"`, rows `role="option"` with `aria-selected`.
- [ ] Hover preview (`hover-link`) on file search results, matching recents.
- Acceptance: tests for ordering, fallback, keyboard navigation, and ARIA attributes.

### T7 — Version 1.1.0 + README
- [ ] Bump `manifest.json` and `versions.json` to `1.1.0` (`minAppVersion` unchanged).
- [ ] README: document every new setting and behavior; add a short "What's new in 1.1" section.
- [ ] Do not tag or push.
- [ ] Note-creation hardening from the T1 review (non-blocking advisory findings, accepted as later work):
  - Skip segments that start with `.` (they would create hidden folders that Foyer itself never lists).
  - Reuse an existing folder whose name differs only in case instead of creating a near-duplicate (`vault.getAbstractFileByPathInsensitive` when available).
  - Use one normalization (`parseNoteInput`) for both the "exact match" check in `updateResults` and `createNote`, so "Create note" is not offered for a name that would resolve to an existing note.
  - Ignore a trailing `/` (and `.md/`) in the typed name.
  - Strengthen the weak "exact match" assertion in `tests/create-note.test.cjs` and keep test comments in English.
- Acceptance: release workflow's version check passes locally; all tests pass.

## Progress

| Task | Status | Commit | Checks | Review |
|---|---|---|---|---|
| T1 | done | `532754c` | `node --test tests/*.test.cjs`: 17/17 pass (RED observed first on 9); `node --check main.js` OK; `git diff --check` OK | high (workflow shell); consent granted; 4 lenses approved, acknowledged (lineage `review-0e04b31a58d5e840`); 10 advisory findings moved to T7 |
| T2 | done | `e13b717` | `node --test tests/*.test.cjs`: 33/33 pass (RED observed first on 15: 13 history + 2 `parseNoteInput`); `node --check main.js` OK; `git diff --check` OK; coordinator re-ran tests: 33/33 | medium, under budget (350 lines from `532754c`): pending in slice |
| T3 | pending | | | |
| T4 | pending | | | |
| T5 | pending | | | |
| T6 | pending | | | |
| T7 | pending | | | |

## Next step

T3 in a Sonnet 5.5 session.
