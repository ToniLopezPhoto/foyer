# Obsidian review recommendations (post-1.1.0)

## Objective

Resolve the findings from the Obsidian community directory's automated review of release 1.1.0.

## Problem

- **README (warning):** the README title does not match the manifest name `Foyer`. The README has no Markdown H1 (the banner is an image); the first `# ` line the checker finds is `# From your test vault`, a comment inside a bash code block.
- **Releases (recommendation):** `main.js` and `styles.css` have no GitHub artifact attestations, so users cannot verify they were built from this repository.
- **Behavior (recommendation):** "Vault Enumeration" — `vault.getFiles()` is called in `HomeView.getListedEntries` (search index) and `HeroImageSuggestModal.getItems` (hero image picker).

## Scope and constraints

- Vault enumeration is intrinsic: fuzzy search over every note and the image picker cannot work without listing files. Decision: keep the code, disclose it clearly in the README (English and Spanish), stating that paths are read locally, only on demand, and never leave the device.
- No runtime code changes, no version bump, no tag, no release (the attestation step takes effect on the next tagged release).
- README stays bilingual; technical artifacts in English.

## TDD

- Mode: strict TDD enabled (source: user global instructions). Runner: `node --test tests/*.test.cjs`.
- These tasks change documentation and CI only; no runtime behavior to drive with RED/GREEN. Checks: `node --check main.js`, `node --test tests/*.test.cjs`, `git diff --check`, YAML readback.

## Delivery

- Branch: `chore/obsidian-review-recommendations` (from `main` at `0e7b4c9`).
- One Conventional Commit per task. Forecast well under 400 authored lines: single PR.
- Push and PR by the orchestrator after review (user asked to publish). Merge and the next release stay the user's decision.

## Tasks

| ID | Task | Model | Route | Depends on |
|---|---|---|---|---|
| T1 | README H1 title matches manifest | Haiku 5.5 | session, inline (1 mechanical file) | — |
| T2 | Artifact attestations in release workflow | Sonnet 5.5 | session, inline (1 file, needs current action docs) | — |
| T3 | Disclose vault enumeration in README | Sonnet 5.5 | session, inline (1 file, bilingual wording) | T1 (same file) |

T1 and T2 touch different files and run in parallel; T3 runs after T1.

### T1 — README H1 title
- [x] Add a Markdown `# Foyer` heading near the top of `README.md` (after the banner block), so it is the first H1 in the file and matches `manifest.json` `name`.
- Acceptance: the first line matching `^# ` in `README.md` is `# Foyer`; layout still renders centered banner + tagline.

### T2 — Release artifact attestations
- [ ] `.github/workflows/release.yml`: add `id-token: write` and `attestations: write` permissions (keep `contents: write`).
- [ ] Add an `actions/attest-build-provenance` step (current major version, verified from its docs) for `main.js`, `manifest.json`, `styles.css`, before the draft release is created.
- [ ] README development/installation notes mention how to verify (`gh attestation verify main.js --repo ToniLopezPhoto/foyer`) — only if T3 has not already covered it; otherwise leave README alone.
- Acceptance: valid YAML; permissions and step present; existing checks unchanged.

### T3 — Vault enumeration disclosure
- [ ] README "Privacy, by design": explain that Foyer lists the vault's file paths (`vault.getFiles`) locally to power search (built when you search, cached, refreshed on file changes) and the hero image picker; it reads names, paths and frontmatter aliases, not file contents; nothing leaves the device; Obsidian "Excluded files" are hidden from results.
- [ ] Same disclosure, concise, in the Spanish section.
- [ ] Add a one-line note on verifying release provenance with `gh attestation verify`.
- Acceptance: both languages cover enumeration; claims match `main.js`.

## Progress

- T1 done: `# Foyer` added after banner `</p>` in `README.md` (line 5). Checks: `grep -n -m1 '^# ' README.md` → `5:# Foyer`; `git diff --check` exit 0; `node --check main.js` exit 0.
- T2, T3: not started.
