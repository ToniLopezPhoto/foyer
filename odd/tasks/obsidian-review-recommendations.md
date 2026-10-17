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
- [x] `.github/workflows/release.yml`: add `id-token: write` and `attestations: write` permissions (keep `contents: write`).
- [x] Add an `actions/attest-build-provenance` step (current major version, verified from its docs) for `main.js`, `manifest.json`, `styles.css`, before the draft release is created.
- [ ] README development/installation notes mention how to verify (`gh attestation verify main.js --repo ToniLopezPhoto/foyer`) — only if T3 has not already covered it; otherwise leave README alone. (Deferred to T3.)
- Acceptance: valid YAML; permissions and step present; existing checks unchanged.

### T3 — Vault enumeration disclosure
- [x] README "Privacy, by design": explain that Foyer lists the vault's file paths (`vault.getFiles`) locally to power search (built when you search, cached, refreshed on file changes) and the hero image picker; it reads names, paths and frontmatter aliases, not file contents; nothing leaves the device; Obsidian "Excluded files" are hidden from results.
- [x] Same disclosure, concise, in the Spanish section.
- [x] Add a one-line note on verifying release provenance with `gh attestation verify`.
- Acceptance: both languages cover enumeration; claims match `main.js`.

## Progress

- T1 done: `# Foyer` added after banner `</p>` in `README.md` (line 5). Checks: `grep -n -m1 '^# ' README.md` → `5:# Foyer`; `git diff --check` exit 0; `node --check main.js` exit 0.
- T2 done (workflow only): `actions/attest-build-provenance@v4` (latest release v4.2.2; v4 is a wrapper over `actions/attest`, which the README recommends for new implementations, but the existing action remains supported; source: https://github.com/actions/attest-build-provenance and its /releases page). Permissions `contents`, `id-token`, `attestations: write`; `create-storage-record` needs `push-to-registry`, so `artifact-metadata` is not required. Checks: PyYAML `safe_load` ok (permissions and step order verified, `subject-path` = main.js, manifest.json, styles.css); `git diff --check` exit 0; `node --check main.js` exit 0; `node --test tests/*.test.cjs` 134 pass, 0 fail. README verify note deferred to T3.
- T3 done: README "Privacy, by design" gained "Vault access" and "Release provenance" paragraphs (provenance scoped to releases after 1.1.0); Spanish privacy paragraph extended with the same disclosure. Claims checked against `main.js`: `getListedEntries` (lazy, cached in `listedEntries`, invalidated on vault create/delete/rename and `metadataCache` `changed`, skips `isUserIgnored`, aliases from `getFileCache(...).frontmatter`) and `getSupportedHeroFiles(vault.getFiles())` in the image picker. Checks: `grep -n -m1 '^# ' README.md` → `5:# Foyer`; `git diff --check` exit 0; `node --check main.js` exit 0; `node --test tests/*.test.cjs` 134 pass, 0 fail.
- Commits: T1 `ebe510c`, T2 `cb54ac8`, T3 `7933c32`. Native review: T1 candidate approved (low risk); full slice assessed high (shell in release.yml), user declined review for this candidate, so the orchestrator verified on the off path: YAML readback, `node --test tests/*.test.cjs` 134 pass, `node --check main.js`, `git diff --check`.
- Next: merge the PR; the attestation step takes effect on the next tagged release.
