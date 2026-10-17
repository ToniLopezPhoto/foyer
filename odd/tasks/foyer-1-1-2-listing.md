# Foyer 1.1.2 — directory listing polish

## Objective

Prepare release 1.1.2 so the Obsidian Community directory listing explains Foyer on its own and stops sending users to workarounds: up-to-date README, a user-facing changelog, a search-friendly manifest description, a contributing guide and a polished search placeholder.

## Problem

Audit of https://community.obsidian.md/plugins/foyer (17 Oct 2026, 27 downloads):

- The README says direct installation will work "once its release passes the directory's automated review" and lists BRAT first. The review already passed.
- "What's new" stops at 1.1; 1.1.1 (build provenance, vault access disclosure) is invisible and its GitHub release only has generated notes.
- The manifest description lacks the words people search for ("home page", "new tab", "private/offline").
- The scorecard hygiene check reports a missing contributing guide.
- Both search placeholders end in four dots: `Search the vault....` / `Buscar en el vault....`.

Design context: Figma file https://www.figma.com/design/7uPpQphbQxiWKJt8Q6z8bm (gallery G1–G6, before/after listing, 12 proposals). This feature covers proposals 4, 5, 6 (CHANGELOG part), 8 (CONTRIBUTING part) and 9.

## Scope and constraints

- In scope: `README.md`, `CHANGELOG.md` (new), `CONTRIBUTING.md` (new), `manifest.json`, `versions.json`, `main.js` placeholder strings, one test.
- Out of scope: directory author-panel changes (icon, categories, gallery upload), release workflow changes, deleting the stale draft release, tagging, pushing, opening a PR, publishing.
- README stays bilingual (English first, Spanish section). Technical artifacts in English. Dependency-free, no build step.

## TDD

- Mode: strict TDD enabled (source: user global instructions). Runner: `node --test tests/*.test.cjs`.
- T1 changes runtime strings: RED test first. Other tasks are docs/metadata: checks are `node --check main.js`, the full test suite, `git diff --check`, JSON parse of manifest/versions.

## Delivery

- Branch: `chore/foyer-1-1-2-listing` (from `main` at `33f4419`).
- One Conventional Commit per task. Forecast ~200 authored lines: single PR. Delivery strategy: `ask-on-risk`.
- Push, PR, tag and release stay the user's decision.

## Tasks

| ID | Task | Route | Trigger evidence |
|---|---|---|---|
| T1 | Search placeholder ends in one ellipsis | inline | 2 mechanical edits in 1 file + 1 test |
| T2 | Search-friendly manifest description | inline | 1 mechanical line |
| T3 | README, CHANGELOG and CONTRIBUTING | delegated writer | 3 non-trivial docs files (writer trigger) |
| T4 | Bump to 1.1.2 | inline | 2 mechanical JSON lines |

### T1 — Placeholder ellipsis
- [x] RED: test asserting both `searchPlaceholder` strings end with a single `…` and contain no `...`.
- [x] GREEN: `Search the vault…` / `Buscar en el vault…` in `main.js`.
- Acceptance: test passes; full suite green.

### T2 — Manifest description
- [x] `manifest.json` description: "Turn every new tab into a calm home page: instant fuzzy search, recently opened notes, and a personal greeting. Private and offline."
- Acceptance: valid JSON, under 250 characters, starts with a verb, ends with a period, no "Obsidian".

### T3 — Docs
- [ ] README: remove the pending-review notice; native install first with an `obsidian://show-plugin?id=foyer` link; BRAT and manual install as alternatives; "What's new in 1.1.2" (and 1.1.1) at the top, pointing to CHANGELOG; Spanish section updated the same way.
- [ ] `CHANGELOG.md`: Keep a Changelog format, entries 1.0.0 → 1.1.2 written for users.
- [ ] `CONTRIBUTING.md`: setup, checks, conventions (dependency-free, theme variables, bilingual strings, tests, Conventional Commits).
- Acceptance: claims match code and git history; links valid; `git diff --check` clean.

### T4 — Version 1.1.2
- [ ] `manifest.json` version `1.1.2`; `versions.json` adds `"1.1.2": "1.8.7"`; CHANGELOG 1.1.2 dated.
- Acceptance: release workflow tag check would pass for tag `1.1.2`.

## Progress

- Branch created from `main` (`33f4419`).
- T1 done (`b90f731`): RED observed on old main.js (settings suite 20 pass / 1 fail); GREEN full suite 135 pass / 0 fail; `node --check main.js` ok.
- T2 done (`d447f73`): description 132 chars, valid JSON.
- Paused (usage limit): T3 docs and T4 bump pending. RDD assessment not run yet.
